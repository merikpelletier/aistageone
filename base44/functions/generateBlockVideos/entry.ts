import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REPLICATE_API = 'https://api.replicate.com/v1';
const FALLBACK_POLL_MS = 90 * 1000;
const webhookUrl = '';

function extractUrl(output) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return extractUrl(output[0]);
  if (typeof output === 'object') {
    if (typeof output.url === 'string') return output.url;
    if (typeof output.image === 'string') return output.image;
    if (typeof output.video === 'string') return output.video;
    const strVal = Object.values(output).find(v => typeof v === 'string' && v.startsWith('http'));
    if (strVal) return strVal;
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { block_id } = await req.json();
    if (!block_id) return Response.json({ error: 'block_id required' }, { status: 400 });

    const block = await base44.entities.StoryBlock.get(block_id);
    if (!block) return Response.json({ error: 'Block not found' }, { status: 404 });

    const session = await base44.entities.StorySession.get(block.session_id);
    if (!session || session.user_email !== user.email) {
      return Response.json({ error: 'Not your block' }, { status: 403 });
    }

    // If block is in 'pending' (plan ready, awaiting user approval), flip to 'generating'
    if (block.generation_status === 'pending') {
      await base44.entities.StoryBlock.update(block_id, { generation_status: 'generating' });
    }

    if (block.generation_status === 'completed') {
      // Re-enter only if narration is still missing (e.g. block was marked complete before audio code existed)
      const _segs = block.segment_instructions || [];
      const _narr = block.narration_audio_urls || [];
      const _vids = block.video_segments || [];
      const needsNarration = _segs.some((s, i) => _vids[i] && s?.narration_text && !_narr[i]);
      console.log(`[generateBlockMedia] Re-entry check: needsNarration=${needsNarration}`);
      if (!needsNarration) {
        return Response.json({
          block_id: block.id,
          status: 'completed',
          video_segments: block.video_segments || [],
          narration_audio_urls: block.narration_audio_urls || [],
          total_segments: _segs.length,
          completed_segments: (block.video_segments || []).filter(Boolean).length,
        });
      }
      // Narration missing — flip back to generating and fall through
      await base44.entities.StoryBlock.update(block_id, { generation_status: 'generating' });
    }

    // ── Cooldown gate: if we recently got rate-limited, refuse to call Replicate ──
    if (block.rate_limited_until) {
      const untilMs = new Date(block.rate_limited_until).getTime();
      const remainingMs = untilMs - Date.now();
      if (remainingMs > 0) {
        const remainingSec = Math.ceil(remainingMs / 1000);
        return Response.json({
          block_id: block.id,
          status: 'generating',
          total_segments: (block.segment_instructions || []).length,
          completed_segments: (block.video_segments || []).filter(Boolean).length,
          cooldown_sec: remainingSec,
          message: `Rate-limited — waiting ${remainingSec}s…`,
        });
      }
    }

    const TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    if (!TOKEN) throw new Error('REPLICATE_API_TOKEN not set');

    // Derive working arrays from the block entity
    const segments = block.segment_instructions || [];
    const allMedia = [...(block.video_segments || [])];

    // Guard: no segments means nothing to generate
    if (segments.length === 0) {
      await base44.entities.StoryBlock.update(block_id, { generation_status: 'completed' });
      return Response.json({
        block_id: block.id,
        status: 'completed',
        video_segments: [],
        narration_audio_urls: [],
        total_segments: 0,
        completed_segments: 0,
      });
    }

    // Find the first segment index that has no media URL (null, undefined, or empty string)
    let nextSegmentIndex = 0;
    while (nextSegmentIndex < segments.length && allMedia[nextSegmentIndex]) {
      nextSegmentIndex++;
    }
    const existingMedia = allMedia.filter(m => m && m.length > 0);

    if (nextSegmentIndex >= segments.length) {
      // All media done — generate missing TTS narration before completing
      // 0. Generate missing TTS narration for segments that have media but no audio URL
      const narrationUrls = [...(block.narration_audio_urls || [])];
      for (let i = 0; i < segments.length; i++) {
        const segTtsText = [segments[i]?.narration_text, segments[i]?.dialogue].filter(Boolean).join(' ');
        if (allMedia[i] && !narrationUrls[i] && segTtsText) {
          try {
            console.log(`[generateBlockMedia] Generating missing TTS for segment ${i + 1}`);
            const speechRes = await base44.integrations.Core.GenerateSpeech({
              text: segTtsText,
              voice: session.narrator_voice || 'Rachel',
            });
            if (speechRes?.url) {
              while (narrationUrls.length < i) narrationUrls.push('');
              narrationUrls[i] = speechRes.url;
              await base44.entities.StoryBlock.update(block_id, { narration_audio_urls: narrationUrls });
              console.log(`[generateBlockMedia] Missing TTS saved for segment ${i + 1}`);
              return Response.json({
                block_id: block.id, status: 'generating', total_segments: segments.length,
                completed_segments: allMedia.filter(Boolean).length,
                narration_audio_urls: narrationUrls,
                message: `Narration for scene ${i + 1} ready…`,
              });
            }
          } catch (e) {
            console.log(`[generateBlockMedia] Missing TTS failed for segment ${i + 1}: ${e.message}`);
          }
        }
      }

      // 2. Everything done — mark complete
      await base44.entities.StoryBlock.update(block_id, { generation_status: 'completed' });
      return Response.json({
        block_id: block.id,
        status: 'completed',
        video_segments: allMedia,
        narration_audio_urls: block.narration_audio_urls || [],
        total_segments: segments.length,
        completed_segments: allMedia.filter(Boolean).length,
      });
    }

    const segment = segments[nextSegmentIndex];
    const mediaType = segment.media_type || 'image';

    // ── 1. Check if segment already has an active prediction ──
    let predictionId = segment.prediction_id;

    if (predictionId) {
      const createdAt = segment.prediction_created_at ? new Date(segment.prediction_created_at).getTime() : 0;
      const ageMs = Date.now() - createdAt;

      if (ageMs > FALLBACK_POLL_MS) {
        console.log(`[generateBlockMedia] Fallback poll for ${predictionId} (${mediaType}, age: ${Math.round(ageMs / 1000)}s)`);
        const pollRes = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        });

        if (pollRes.status === 429) {
          return Response.json({
            block_id: block.id,
            status: 'generating',
            total_segments: segments.length,
            completed_segments: existingMedia.length,
            current_segment: nextSegmentIndex + 1,
            message: `Rate-limited — waiting…`,
          });
        }

        if (pollRes.ok) {
          const pollData = await pollRes.json();

          if (pollData.status === 'succeeded') {
            const mediaUrl = extractUrl(pollData.output);
            if (mediaUrl) {
              const ext = mediaType === 'video' ? 'mp4' : 'jpg';
              const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
              const mediaRes = await fetch(mediaUrl);
              if (mediaRes.ok) {
                const blob = await mediaRes.blob();
                const file = new File([blob], `segment_${nextSegmentIndex}.${ext}`, { type: contentType });
                const uploaded = await base44.integrations.Core.UploadFile({ file });

                // Video two-step: if this was the image stage, start kling-v2.6 animation
                if (mediaType === 'video' && segment.video_stage !== 'video') {
                  const klingInput = {
                    start_image: uploaded.file_url,
                    prompt: (segment.prompt || 'Cinematic subtle natural motion, professional film quality.').substring(0, 500),
                    duration: 5,
                    aspect_ratio: '9:16',
                    generate_audio: false,
                  };
                  const klingBody = { input: klingInput };
                  if (webhookUrl) { klingBody.webhook = webhookUrl; klingBody.webhook_events_filter = ['completed']; }
                  const klingRes = await fetch(`${REPLICATE_API}/models/kwaivgi/kling-v2.6/predictions`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Prefer': 'wait=5' },
                    body: JSON.stringify(klingBody),
                  });
                  const klingData = await klingRes.json();
                  if (klingRes.ok && klingData.id) {
                    const klingNow = new Date().toISOString();
                    const updatedSegs = [...segments];
                    updatedSegs[nextSegmentIndex] = { ...segment, prediction_id: klingData.id, prediction_created_at: klingNow, video_stage: 'video', first_frame_url: uploaded.file_url };
                    await base44.entities.StoryBlock.update(block_id, { segment_instructions: updatedSegs, active_prediction_id: klingData.id, last_error: null });
                    return Response.json({
                      block_id: block.id, status: 'generating', total_segments: segments.length,
                      completed_segments: existingMedia.length, current_segment: nextSegmentIndex + 1,
                      message: `Animating segment ${nextSegmentIndex + 1}/${segments.length}…`,
                    });
                  }
                  console.log(`[generateBlockMedia] Kling start failed, using still image: ${klingData.detail || JSON.stringify(klingData)}`);
                  // Kling failed to start — fall through and use the image as segment media
                }

                const updatedMedia = [...(block.video_segments || [])];
                while (updatedMedia.length < nextSegmentIndex) updatedMedia.push('');
                updatedMedia[nextSegmentIndex] = uploaded.file_url;

                const updatedSegments = [...segments];
                updatedSegments[nextSegmentIndex] = { ...segment,       prediction_id: null, prediction_created_at: null, redo_note: null };
                const allDone = updatedMedia.filter(Boolean).length >= segments.length;

                await base44.entities.StoryBlock.update(block_id, {
                  video_segments: updatedMedia,
                  segment_instructions: updatedSegments,
                  active_prediction_id: null,
                  last_error: null,
                  generation_status: 'generating',
                });

                return Response.json({
                  block_id: block.id,
                  status: 'generating',
                  total_segments: segments.length,
                  completed_segments: updatedMedia.filter(Boolean).length,
                  video_segments: updatedMedia,
                  message: `Segment ${nextSegmentIndex + 1}/${segments.length} done. Generating audio…`,
                });
              }
            }
          } else if (pollData.status === 'failed' || pollData.status === 'canceled') {
            const errorMsg = pollData.error || `Generation ${pollData.status}`;
            console.log(`[generateBlockMedia] Prediction failed: ${errorMsg}`);
            const updatedSegments = [...segments];
            updatedSegments[nextSegmentIndex] = { ...segment, prediction_id: null, prediction_created_at: null };
            await base44.entities.StoryBlock.update(block_id, {
              segment_instructions: updatedSegments,
              active_prediction_id: null,
              last_error: errorMsg,
            });
            predictionId = null;
          }
        }
      }

      if (predictionId) {
        return Response.json({
          block_id: block.id,
          status: 'generating',
          total_segments: segments.length,
          completed_segments: existingMedia.length,
          current_segment: nextSegmentIndex + 1,
          message: `Generating ${mediaType} ${nextSegmentIndex + 1}/${segments.length}…`,
        });
      }
    }

    // ── 2. No prediction — generate TTS narration + create new prediction ──

    // 2a. Generate TTS narration (if not already generated)
    const narrationUrls = [...(block.narration_audio_urls || [])];
    const ttsText = [segment.narration_text, segment.dialogue].filter(Boolean).join(' ');
    if (!narrationUrls[nextSegmentIndex] && ttsText) {
      try {
        console.log(`[generateBlockMedia] Generating TTS for segment ${nextSegmentIndex + 1}`);
        const speechRes = await base44.integrations.Core.GenerateSpeech({
          text: ttsText,
          voice: session.narrator_voice || 'Rachel',
        });
        if (speechRes?.url) {
          while (narrationUrls.length < nextSegmentIndex) narrationUrls.push(null);
          narrationUrls[nextSegmentIndex] = speechRes.url;
          await base44.entities.StoryBlock.update(block_id, {
            narration_audio_urls: narrationUrls,
          });
          console.log(`[generateBlockMedia] TTS saved for segment ${nextSegmentIndex + 1}`);
        }
      } catch (e) {
        console.log(`[generateBlockMedia] TTS failed: ${e.message}`);
      }
    }

    // 2b. Load theme/characters/sets for reference images
    const hero = await base44.entities.StoryCharacter.get(session.hero_story_character_id).catch(() => null);
    let themeCharacters = [hero].filter(Boolean);
    let sets = [];

    if (session.theme_id) {
      const theme = await base44.entities.StoryTheme.get(session.theme_id).catch(() => null);
      if (theme?.story_character_ids?.length > 0) {
        const supporting = await Promise.all(
          theme.story_character_ids.map(id => base44.entities.StoryCharacter.get(id).catch(() => null))
        );
        themeCharacters = [...themeCharacters, ...supporting.filter(Boolean)];
      }
      if (theme?.story_set_ids?.length > 0) {
        sets = await Promise.all(
          theme.story_set_ids.map(id => base44.entities.StorySet.get(id).catch(() => null))
        );
        sets = sets.filter(Boolean);
      }
    }

    const characterMap = {};
    for (const c of themeCharacters) {
      if (c?.name) characterMap[c.name.toLowerCase().trim()] = c;
    }
    // Build a list of available character names for fuzzy matching and logging
    const availableCharNames = Object.keys(characterMap);

    // Build reference images — use REFERENCE_SHEET first (dedicated identity anchor),
    // fall back to portrait photo if no reference sheet exists
    const referenceImages = [];
    const refLegend = [];
    const charsPresent = segment.characters_present || segment.selected_characters || [];
    const charsPresentLower = charsPresent.map(c => c?.toLowerCase?.().trim()).filter(Boolean);
    const heroNameLower = hero?.name?.toLowerCase?.().trim();
    // Only attach hero ref if the hero actually appears in this segment
    const heroInSegment = !heroNameLower || charsPresentLower.includes(heroNameLower);
    // Use portrait photo as PRIMARY identity reference (single clean shot works better
    // with Seedream/Seedance than a multi-view turnaround sheet), then add the
    // reference_sheet as a SECONDARY reference for additional identity detail
    const heroPortrait = hero?.photos?.[0];
    const heroSheet = hero?.reference_sheet;
    if (heroPortrait && heroInSegment) {
      referenceImages.push(heroPortrait);
      refLegend.push(`Hero (${hero?.name || 'Hero'}) — preserve exact face, skin tone, hair, body type, and full costume/wardrobe — the clothing shown in this reference must be worn identically in the generated image`);
    }
    if (heroSheet && heroInSegment && heroSheet !== heroPortrait && !referenceImages.includes(heroSheet)) {
      referenceImages.push(heroSheet);
      refLegend.push(`Hero reference sheet (${hero?.name || 'Hero'}) — same person, additional angles`);
    }
    const unmatchedNames = [];
    for (const charName of charsPresent) {
      if (referenceImages.length >= 8) break;
      const nameLower = charName?.toLowerCase?.().trim();
      if (!nameLower || nameLower === 'npc' || nameLower === heroNameLower) continue;
      const matched = characterMap[nameLower];
      if (matched) {
        const charPortrait = matched.photos?.[0];
        const charSheet = matched.reference_sheet;
        if (charPortrait && !referenceImages.includes(charPortrait)) {
          referenceImages.push(charPortrait);
          refLegend.push(`Character (${matched.name}) — preserve exact face, skin tone, hair, body type, and full costume/wardrobe — the clothing shown in this reference must be worn identically in the generated image`);
        }
        if (charSheet && charSheet !== charPortrait && !referenceImages.includes(charSheet) && referenceImages.length < 8) {
          referenceImages.push(charSheet);
          refLegend.push(`Character reference sheet (${matched.name}) — same person, additional angles`);
        }
      } else {
        unmatchedNames.push(charName);
      }
    }
    if (unmatchedNames.length > 0) {
      console.warn(`[generateBlockMedia] WARNING: Agent invented character names not in theme pack: ${unmatchedNames.join(', ')}. Available: ${availableCharNames.join(', ')}`);
    }
    if (referenceImages.length < 9 && segment.selected_set) {
      const matchedSet = sets.find(s => s.name === segment.selected_set);
      if (matchedSet?.images?.length > 0) {
        const setImg = matchedSet.images[0];
        if (!referenceImages.includes(setImg)) {
          referenceImages.push(setImg);
          refLegend.push(`Set (${matchedSet.name}) — preserve layout, lighting, and atmosphere`);
        }
      }
    }

    // ── CONTINUITY REFERENCES (intra-block) ──
    // Pull the most recent generated STILL frames from THIS block (the scenes that
    // already play before this one) so a new/regenerated segment matches the look
    // already on screen — same face, skin tone, hair, wardrobe, lighting, film style.
    // This is the key fix for character drift across scenes AND for redo: a redone
    // scene must look like the SAME people as the surrounding scenes, not a fresh
    // interpretation of the portrait. Only still images can be passed (not mp4s).
    const allSegMedia = block.video_segments || [];
    const segInstructions = block.segment_instructions || [];
    let continuityAdded = 0;
    for (let ci = nextSegmentIndex - 1; ci >= 0 && continuityAdded < 3 && referenceImages.length < 13; ci--) {
      const ciMedia = allSegMedia[ci];
      const ciInst = segInstructions[ci] || {};
      if (!ciMedia || typeof ciMedia !== 'string') continue;
      if ((ciInst.media_type || 'image') !== 'image') continue;
      if (referenceImages.includes(ciMedia)) continue;
      referenceImages.push(ciMedia);
      refLegend.push(`Continuity frame from scene ${ci + 1} — the people here MUST be the SAME people: identical face, skin tone, hair, body type, and wardrobe as this earlier frame. Match its lighting, color grade, and film style. This is the established on-screen look — do not redesign or reinterpret the characters.`);
      continuityAdded++;
    }

    // Build reference legend — both Nano Banana 2 and Kling v2.6 use natural language.
    const refLegendLines = refLegend.map((l, i) => `Image ${i + 1}: ${l}`);
    const refLegendText = refLegendLines.length > 0
      ? `Reference images provided:\n${refLegendLines.join('\n')}\nCRITICAL CONTINUITY RULE: Each character must wear the EXACT SAME costume, wardrobe, and clothing shown in their reference image. Do NOT change, redesign, or alter any character's outfit. The same person must have the same face, the same hair, the same body, and the same clothing in every frame.\n\n`
      : '';
    // ── DIRECTIVE INJECTION ──
    // Establishing exterior shots focus on LOCATION/ATMOSPHERE, not character faces.
    // Character segments get the identity-first emotion rule to prevent blank stares.
    const emotionalTone = segment.emotional_tone || '';
    const isEstablishingExterior = segment.segment_purpose === 'establishing_exterior';

    const emotionDirective = isEstablishingExterior
      ? (emotionalTone
        ? `\n\nATMOSPHERE DIRECTIVE: This is an EXTERIOR ESTABLISHING SHOT — no character close-up needed. Convey the mood "${emotionalTone}" through the environment: lighting, weather, sky, shadows, color grading, and the feel of the place. The location itself should radiate ${emotionalTone}.\n\n`
        : `\n\nATMOSPHERE DIRECTIVE: This is an EXTERIOR ESTABLISHING SHOT — no character close-up needed. Convey mood through lighting, weather, and environment.\n\n`)
      : (emotionalTone
        ? `\n\nIDENTITY-FIRST EMOTION RULE — TWO-LAYER:\n1. PRESERVE IDENTITY (highest priority): The character MUST remain the EXACT SAME PERSON as in the reference image — same facial bone structure, same face shape, same jawline, same nose, same eyes, same skin tone, same age, same hair. Do NOT change the person's face into someone else. The emotion changes the EXPRESSION, never the IDENTITY.\n2. APPLY EMOTION (mandatory): On that SAME face, the expression MUST visibly show ${emotionalTone}. Do NOT render a neutral, blank, calm, or stoic expression. The emotion "${emotionalTone}" must be clearly readable in the eyes, eyebrows, mouth, jaw, and facial muscles — on the SAME face from the reference image. For example: fear = wide eyes, raised brows, tense mouth; anger = furrowed brow, clenched jaw, narrowed eyes; grief = downcast eyes, trembling lips, tear-streaked cheeks; joy = bright eyes, raised cheeks, genuine smile; shock = parted lips, wide unblinking eyes, raised brows.\nThe result: the SAME PERSON, showing ${emotionalTone}.\n\n`
        : `\n\nIDENTITY-FIRST EMOTION RULE: The character must remain the exact same person as in the reference image (same face structure, same identity). On that same face, show a clear visible emotion matching the scene — not a neutral or blank expression.\n\n`);

    // Photorealistic film still — explicitly reject illustration/art styles.
    // Establishing exterior shots use LANDSCAPE framing; character shots use PORTRAIT.
    const styleNote = isEstablishingExterior
      ? `\n\nShot on 35mm film, live-action photograph, cinematic film still, photorealistic, real photography, natural lighting, film grain, anamorphic lens. NOT an illustration, NOT digital art, NOT a painting, NOT 3D render, NOT anime, NOT cartoon, NOT concept art. Real architecture, real textures, real sky, real stone. VERTICAL WIDE composition — the building/location fills the frame top to bottom, showing the exterior facade, street, sky, and surrounding environment. This is a location establishing shot — the focus is the PLACE, not people.`
      : `\n\nShot on 35mm film, live-action photograph, cinematic film still, photorealistic, real photography, natural lighting, shallow depth of field, film grain, anamorphic lens. NOT an illustration, NOT digital art, NOT a painting, NOT 3D render, NOT anime, NOT cartoon, NOT concept art. Real people, real textures, real skin, real fabric. VERTICAL PORTRAIT composition — subject fills the frame, face and expression clearly visible. WARDROBE CONTINUITY: Every character must keep the exact same costume and clothing as their reference image — no outfit changes between scenes.`;
    const redoDirective = segment.redo_note
      ? `\n\nCORRECTION FROM DIRECTOR: ${segment.redo_note} — fix this specific issue while keeping everything else (identity, costume, setting, continuity) exactly as in the reference images.`
      : '';
    const segmentPrompt = refLegendText + (segment.prompt || 'Cinematic film scene.') + emotionDirective + styleNote + redoDirective;

    // Both image and video segments start by generating a still frame with nano-banana-2.
    // Video segments then get animated by kling-v2.6 in a second step (handled in the
    // success handler below when video_stage === 'image').
    const modelPath = 'google/nano-banana-2';
    const predictionBody = {
      input: {
        prompt: segmentPrompt,
        image_input: referenceImages.slice(0, 14),
        aspect_ratio: '9:16',
        resolution: '2K',
        output_format: 'jpg',
      },
    };

    if (webhookUrl) {
      predictionBody.webhook = webhookUrl;
      predictionBody.webhook_events_filter = ['completed'];
    }

    console.log(`[generateBlockMedia] Segment ${nextSegmentIndex + 1}/${segments.length} (${mediaType}) | refs: ${referenceImages.length} | model: ${modelPath}`);
    console.log(`[generateBlockMedia] Reference image URLs:`, JSON.stringify(referenceImages));
    console.log(`[generateBlockMedia] charsPresent:`, JSON.stringify(charsPresent));
    console.log(`[generateBlockMedia] characterMap keys:`, JSON.stringify(Object.keys(characterMap)));
    console.log(`[generateBlockMedia] Full prompt (${segmentPrompt.length} chars):`, segmentPrompt.substring(0, 500) + '...');

    const predRes = await fetch(`${REPLICATE_API}/models/${modelPath}/predictions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Prefer': 'wait=5' },
      body: JSON.stringify(predictionBody),
    });
    const predData = await predRes.json();

    if (!predRes.ok) {
      if (predRes.status === 429) {
        const retryAfter = parseInt(predRes.headers.get('Retry-After') || '30', 10);
        const cooldownSec = Math.min(Math.max(retryAfter, 30), 120);
        const rateLimitedUntil = new Date(Date.now() + cooldownSec * 1000).toISOString();
        await base44.entities.StoryBlock.update(block_id, { rate_limited_until: rateLimitedUntil });
        return Response.json({
          block_id: block.id,
          status: 'generating',
          total_segments: segments.length,
          completed_segments: existingMedia.length,
          current_segment: nextSegmentIndex + 1,
          cooldown_sec: cooldownSec,
          message: `Rate-limited — cooling down ${cooldownSec}s…`,
        });
      }
      // Non-rate-limit error: log it, mark segment with error, skip to next segment
      const errorMsg = predData.detail || JSON.stringify(predData);
      console.error(`[generateBlockMedia] Segment ${nextSegmentIndex + 1} failed: ${errorMsg}`);
      // Push a null placeholder so we skip this segment and move to the next
      const updatedMedia = [...(block.video_segments || [])];
      while (updatedMedia.length < nextSegmentIndex) updatedMedia.push(null);
      updatedMedia[nextSegmentIndex] = null; // null = skipped/failed
      const updatedSegs = [...segments];
      updatedSegs[nextSegmentIndex] = { ...segment, prediction_id: null, prediction_created_at: null, last_error: errorMsg };
      // Count completed as non-null entries
      const completedCount = updatedMedia.filter(Boolean).length;
      const allDone = completedCount >= segments.length || nextSegmentIndex + 1 >= segments.length;
      await base44.entities.StoryBlock.update(block_id, {
        video_segments: updatedMedia,
        segment_instructions: updatedSegs,
        active_prediction_id: null,
        last_error: null,
        generation_status: 'generating',
      });
      return Response.json({
        block_id: block.id,
        status: 'generating',
        total_segments: segments.length,
        completed_segments: completedCount,
        current_segment: nextSegmentIndex + 1,
        message: `Segment ${nextSegmentIndex + 1} failed, skipping…`,
      });
    }

    // If Replicate returned immediately with succeeded status
    if (predData.status === 'succeeded') {
      const mediaUrl = extractUrl(predData.output);
      if (mediaUrl) {
        const ext = mediaType === 'video' ? 'mp4' : 'jpg';
        const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        const mediaRes = await fetch(mediaUrl);
        if (mediaRes.ok) {
          const blob = await mediaRes.blob();
          const file = new File([blob], `segment_${nextSegmentIndex}.${ext}`, { type: contentType });
          const uploaded = await base44.integrations.Core.UploadFile({ file });

          // Video two-step: if this was the image stage, start kling-v2.6 animation
          if (mediaType === 'video' && segment.video_stage !== 'video') {
            const klingInput = {
              start_image: uploaded.file_url,
              prompt: (segment.prompt || 'Cinematic subtle natural motion, professional film quality.').substring(0, 500),
              duration: 5,
              aspect_ratio: '9:16',
              generate_audio: false,
            };
            const klingBody = { input: klingInput };
            if (webhookUrl) { klingBody.webhook = webhookUrl; klingBody.webhook_events_filter = ['completed']; }
            const klingRes = await fetch(`${REPLICATE_API}/models/kwaivgi/kling-v2.6/predictions`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Prefer': 'wait=5' },
              body: JSON.stringify(klingBody),
            });
            const klingData = await klingRes.json();
            if (klingRes.ok && klingData.id) {
              const klingNow = new Date().toISOString();
              const updatedSegs = [...segments];
              updatedSegs[nextSegmentIndex] = { ...segment, prediction_id: klingData.id, prediction_created_at: klingNow, video_stage: 'video', first_frame_url: uploaded.file_url };
              await base44.entities.StoryBlock.update(block_id, { segment_instructions: updatedSegs, active_prediction_id: klingData.id, last_error: null });
              return Response.json({
                block_id: block.id, status: 'generating', total_segments: segments.length,
                completed_segments: existingMedia.length, current_segment: nextSegmentIndex + 1,
                message: `Animating segment ${nextSegmentIndex + 1}/${segments.length}…`,
              });
            }
            console.log(`[generateBlockMedia] Kling start failed, using still image: ${klingData.detail || JSON.stringify(klingData)}`);
          }

          const updatedMedia = [...(block.video_segments || [])];
          while (updatedMedia.length < nextSegmentIndex) updatedMedia.push('');
          updatedMedia[nextSegmentIndex] = uploaded.file_url;

          const updatedSegments = [...segments];
          updatedSegments[nextSegmentIndex] = { ...segment,       prediction_id: null, prediction_created_at: null, redo_note: null };
          const allDone = updatedMedia.filter(Boolean).length >= segments.length;

          await base44.entities.StoryBlock.update(block_id, {
            video_segments: updatedMedia,
            segment_instructions: updatedSegments,
            active_prediction_id: null,
            last_error: null,
            generation_status: 'generating',
          });

          return Response.json({
            block_id: block.id,
            status: 'generating',
            total_segments: segments.length,
            completed_segments: updatedMedia.filter(Boolean).length,
            video_segments: updatedMedia,
            message: `Segment ${nextSegmentIndex + 1}/${segments.length} done. Generating audio…`,
          });
        }
      }
    }

    // Store prediction_id (for video segments, mark as image stage)
    predictionId = predData.id;
    const now = new Date().toISOString();
    const updatedSegments = [...segments];
    updatedSegments[nextSegmentIndex] = {
      ...segment,
      prediction_id: predictionId,
      prediction_created_at: now,
      video_stage: mediaType === 'video' ? 'image' : undefined,
    };
    await base44.entities.StoryBlock.update(block_id, {
      segment_instructions: updatedSegments,
      active_prediction_id: predictionId,
      last_error: null,
    });

    return Response.json({
      block_id: block.id,
      status: 'generating',
      total_segments: segments.length,
      completed_segments: existingMedia.length,
      current_segment: nextSegmentIndex + 1,
      message: `Segment ${nextSegmentIndex + 1}/${segments.length} (${mediaType}) started…`,
    });

  } catch (error) {
    console.error('generateBlockMedia error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
