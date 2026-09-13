import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { block_id, voice } = await req.json();
    if (!block_id || !voice) {
      return Response.json({ error: 'block_id and voice are required' }, { status: 400 });
    }

    const VALID_VOICES = ['Rachel', 'Drew', 'Paul', 'Aria', 'Domi', 'Dave', 'Roger', 'Sarah', 'James', 'Jane'];
    if (!VALID_VOICES.includes(voice)) {
      return Response.json({ error: 'Invalid voice' }, { status: 400 });
    }

    const block = await base44.entities.StoryBlock.get(block_id);
    if (!block) return Response.json({ error: 'Block not found' }, { status: 404 });

    // Verify ownership via session
    const session = await base44.entities.StorySession.get(block.session_id);
    if (!session || session.user_email !== user.email) {
      return Response.json({ error: 'Not your block' }, { status: 403 });
    }

    const segments = block.segment_instructions || [];
    const narrationUrls = [];

    for (let i = 0; i < segments.length; i++) {
      const ttsText = [segments[i]?.narration_text, segments[i]?.dialogue].filter(Boolean).join(' ');
      if (ttsText) {
        try {
          const speechRes = await base44.integrations.Core.GenerateSpeech({
            text: ttsText,
            voice: voice,
          });
          narrationUrls[i] = speechRes?.url || '';
        } catch (e) {
          console.log(`[regenerateNarration] TTS failed for segment ${i + 1}: ${e.message}`);
          narrationUrls[i] = '';
        }
      } else {
        narrationUrls[i] = '';
      }
    }

    await base44.entities.StoryBlock.update(block_id, { narration_audio_urls: narrationUrls });

    // Update session voice so future blocks use the new voice
    await base44.entities.StorySession.update(block.session_id, { narrator_voice: voice }).catch(() => {});

    return Response.json({
      block_id,
      narration_audio_urls: narrationUrls,
      voice,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
