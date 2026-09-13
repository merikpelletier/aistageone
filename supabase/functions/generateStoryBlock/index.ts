import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('generateStoryBlock');
import { createClientFromRequest } from './_legacy/base44Compat.ts';
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from './_legacy/credits.ts';

serveWithCors(async (req) => {
  try {
    const billing = await createCreditBillingContext(req);
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, is_storyline_switch, override_hero_id, override_topic_id } = await req.json();
    if (!session_id) return Response.json({ error: 'session_id required' }, { status: 400 });
    const isStorylineSwitch = is_storyline_switch === true;

    // ── 1. Load session data ──────────────────────────────────────────────────
    const session = await base44.entities.StorySession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    if (session.user_email !== user.email) {
      return Response.json({ error: 'Not your session' }, { status: 403 });
    }
    const simEntities = base44.asServiceRole.entities;

    // A storyline switch is a ONE-CHAPTER pivot — it must NOT mutate the session's
    // permanent hero/topic (those define the main story's identity/title).
    const heroId = override_hero_id || session.hero_story_character_id;
    const topicId = override_topic_id || session.starting_topic_id;
    const [theme, hero, topic] = await Promise.all([
      base44.entities.StoryTheme.get(session.theme_id),
      base44.entities.StoryCharacter.get(heroId),
      base44.entities.StartingTopic.get(topicId),
    ]);

    if (!theme) return Response.json({ error: 'Theme not found' }, { status: 404 });
    if (!hero) return Response.json({ error: 'Hero character not found' }, { status: 404 });
    if (!topic) return Response.json({ error: 'Starting topic not found' }, { status: 404 });

    // ── 2. Check credit balance (NO deduction yet — that happens when plan completes) ──
    const pricing = await base44.entities.ToolPricing.filter({ tool_id: 'story_block', is_active: true }).then(r => r[0]);
    const tokenCost = pricing?.token_cost ?? theme.credit_cost_per_block ?? 10;

    let balance = await base44.entities.UserTokenBalance.filter({ user_email: user.email }).then(r => r[0]);
    if (!balance) {
      balance = await base44.entities.UserTokenBalance.create({
        user_email: user.email, balance: 0, last_updated: new Date().toISOString(),
      });
    }

    const adminEmail = (Deno.env.get('ADMIN_EMAIL') || '').toLowerCase().trim();
    const fullUser = await base44.asServiceRole.entities.User.filter({ email: user.email }).then(r => r[0]).catch(() => null);
    const isAdmin = (fullUser?.role || user.role) === 'admin' || (user.email || '').toLowerCase().trim() === adminEmail;

    if (!isAdmin && balance.balance < tokenCost) {
      return Response.json({
        error: 'Insufficient tokens',
        required: tokenCost,
        balance: balance.balance,
        message: `Story Block requires ${tokenCost} tokens. Your balance: ${balance.balance}.`,
      }, { status: 402 });
    }

    // ── 3. Load reference material ──────────────────────────────────────────────
    const heroPhotos = hero.photos || [];

    let sets = [];
    if (theme.story_set_ids?.length > 0) {
      sets = await Promise.all(
        theme.story_set_ids.map(id => base44.entities.StorySet.get(id).catch(() => null))
      );
      sets = sets.filter(Boolean);
    }
    const setImages = sets.flatMap(s => s.images || []);

    let supportingChars = [];
    if (theme.story_character_ids?.length > 0) {
      supportingChars = await Promise.all(
        theme.story_character_ids.map(id => base44.entities.StoryCharacter.get(id).catch(() => null))
      );
      supportingChars = supportingChars.filter(Boolean);
    }

    const supportingCharPhotos = supportingChars.flatMap(c => c.photos || []);
    const allReferenceImages = [...heroPhotos, ...setImages, ...supportingCharPhotos];

    // ── 4. Load existing blocks for context ─────────────────────────────────────
    const existingBlocks = await base44.entities.StoryBlock.filter({ session_id }, 'order', 50);
    const blockOrder = existingBlocks.length;
    const isFirstBlock = blockOrder === 0;
    const lastBlock = existingBlocks[existingBlocks.length - 1];

    // ── 4b. Scoped, read-only simulation retrieval (Hero's perspective only) ──
    // Mechanism 3: deterministic backend fetch immediately before the planning
    // call. We load ONLY what the Hero can currently perceive/know (knowledge
    // boundary), scoped to the active StorySession + matching simulation_run_id,
    // with record caps, excluding all unrelated simulation state. No raw IDs are
    // exposed as narrative material — names/values only. Read-only: no Sim*
    // writes occur here or after generation.
    let simStateText = '';
    if (session.simulation_run_id) {
      const runId = session.simulation_run_id;
      const OBS_LIMIT = 12, BELIEF_LIMIT = 20, CLAIM_LIMIT = 10, TRANS_LIMIT = 10;

      const allSimChars = await simEntities.SimCharacter.filter({ session_id, simulation_run_id: runId });
      // Resolve the Hero's simulation avatar by back-link to the authored Hero.
      const heroSim = allSimChars.find(c => c.source_story_character_id === heroId) || null;

      if (heroSim) {
        const heroLocId = heroSim.current_location_id || null;
        let heroLoc = heroLocId ? await simEntities.SimLocation.get(heroLocId).catch(() => null) : null;
        // Defense: the Hero's location must belong to the same session + run.
        if (heroLoc && (heroLoc.session_id !== session_id || heroLoc.simulation_run_id !== runId)) {
          heroLoc = null; // mismatched run — exclude
        }

        const colocated = allSimChars.filter(c => c.current_location_id && c.current_location_id === heroLocId && c.id !== heroSim.id);
        const colocatedIds = new Set(colocated.map(c => c.id));

        const allSimAssets = heroLocId ? await simEntities.SimAsset.filter({ session_id, simulation_run_id: runId }) : [];
        const relevantAssets = allSimAssets.filter(a => a.current_location_id === heroLocId || (a.current_holder_id && (colocatedIds.has(a.current_holder_id) || a.current_holder_id === heroSim.id)));

        const allSits = await simEntities.SimActiveSituation.filter({ session_id, simulation_run_id: runId });
        const heroSits = allSits.filter(s => (s.affected_character_ids || []).includes(heroSim.id));

        const allObs = await simEntities.SimObservation.filter({ session_id, simulation_run_id: runId });
        const heroObs = allObs.filter(o => o.observer_id === heroSim.id).sort((a, b) => (b.observation_tick ?? 0) - (a.observation_tick ?? 0)).slice(0, OBS_LIMIT);

        const allBeliefs = await simEntities.SimBelief.filter({ session_id, simulation_run_id: runId });
        const heroBeliefs = allBeliefs.filter(b => b.character_id === heroSim.id).sort((a, b) => (b.created_tick ?? 0) - (a.created_tick ?? 0)).slice(0, BELIEF_LIMIT);

        const allTrans = await simEntities.SimInformationTransmission.filter({ session_id, simulation_run_id: runId });
        const heroTrans = allTrans.filter(t => t.sender_id === heroSim.id || t.receiver_id === heroSim.id).sort((a, b) => (b.transmission_tick ?? 0) - (a.transmission_tick ?? 0)).slice(0, TRANS_LIMIT);
        const heroTransClaimIds = new Set(heroTrans.map(t => t.claim_id).filter(Boolean));
        const allClaims = heroTransClaimIds.size ? await simEntities.SimClaim.filter({ session_id, simulation_run_id: runId }) : [];
        const heroClaims = allClaims.filter(c => heroTransClaimIds.has(c.id) || c.originator_id === heroSim.id || (c.subject_character_ids || []).includes(heroSim.id)).slice(0, CLAIM_LIMIT);

        const nameOf = (id) => { if (!id) return 'n/a'; if (id === heroSim.id) return heroSim.name || 'the Hero'; const c = allSimChars.find(x => x.id === id); return c ? (c.name || 'a character') : 'n/a'; };
        const simNameByPackId = (packId) => { if (!packId) return 'n/a'; if (packId === heroSim.source_story_character_id) return heroSim.name || 'the Hero'; const c = allSimChars.find(x => x.source_story_character_id === packId); return c ? (c.name || 'a character') : 'n/a'; };

        // ── 4c. Chapter-level cast control ──
        // Determine this chapter's named cast from the Hero's scoped context, ranked
        // by relevance. Target 2–4 active; hard max 6 meaningful characters. Extras
        // appear only as a brief background environmental note (no individual
        // SimCharacter records loaded for them). Full character state is loaded ONLY
        // for the selected active cast. Read-only: no Sim* writes.
        const CAST_HARD_MAX = 6, CAST_TARGET_MIN = 2;
        const lastSeg = (lastBlock?.segment_instructions || []).slice(-1)[0] || {};
        const prevEndingNames = new Set([
          ...((lastBlock?.selected_characters || []).map(n => (n || '').toLowerCase().trim())),
          ...((lastSeg.characters_present || []).map(n => (n || '').toLowerCase().trim())),
        ].filter(Boolean));
        const actionInvolvedNames = new Set((lastSeg.characters_present || []).map(n => (n || '').toLowerCase().trim()).filter(Boolean));
        const heroSitAffectedIds = new Set(heroSits.flatMap(s => s.affected_character_ids || []));
        const knowledgeText = [
          ...heroObs.map(o => o.understanding_description || ''),
          ...heroClaims.map(c => c.claim_text || ''),
        ].join(' ').toLowerCase();
        const simByName = (n) => allSimChars.find(c => (c.name || '').toLowerCase().trim() === n) || null;

        const candidateMap = new Map();
        const ensureCand = (c) => {
          if (!c || c.id === heroSim.id) return null;
          if (!candidateMap.has(c.id)) {
            const lname = (c.name || '').toLowerCase().trim();
            candidateMap.set(c.id, {
              c, isColocated: colocatedIds.has(c.id),
              isPrevEnding: prevEndingNames.has(lname),
              isActionInvolved: actionInvolvedNames.has(lname),
              isSituationAffected: heroSitAffectedIds.has(c.id),
              isKnowledgeRelevant: !!(lname && knowledgeText.includes(lname)),
              sources: [],
            });
          }
          return candidateMap.get(c.id);
        };
        colocated.forEach(c => { const cand = ensureCand(c); if (cand) cand.sources.push('present at Hero location'); });
        allSimChars.forEach(c => { if (heroSitAffectedIds.has(c.id)) { const cand = ensureCand(c); if (cand && !cand.sources.includes('affected by active situation')) cand.sources.push('affected by active situation'); } });
        prevEndingNames.forEach(n => { const c = simByName(n); if (c) { const cand = ensureCand(c); if (cand && !cand.sources.includes('required by previous ending')) cand.sources.push('required by previous ending'); } });
        actionInvolvedNames.forEach(n => { const c = simByName(n); if (c) { const cand = ensureCand(c); if (cand && !cand.sources.includes('involved in selected next action')) cand.sources.push('involved in selected next action'); } });

        const isMeaningful = (cand) => cand.isPrevEnding || cand.isActionInvolved || cand.isSituationAffected || cand.isKnowledgeRelevant;
        let meaningful = [...candidateMap.values()].filter(isMeaningful);
        const colocatedOnly = [...candidateMap.values()].filter(c => c.isColocated && !isMeaningful(c))
          .sort((a, b) => ((b.c.sim_immediate_needs || []).length) - ((a.c.sim_immediate_needs || []).length));
        let pi = 0;
        while (meaningful.length < CAST_TARGET_MIN && pi < colocatedOnly.length) { meaningful.push(colocatedOnly[pi]); pi++; }

        for (const cand of meaningful) {
          cand.bucket = cand.isPrevEnding ? 2 : cand.isActionInvolved ? 3 : cand.isSituationAffected ? 4 : 5;
          cand.score = (cand.isColocated ? 100 : 0) + (cand.isPrevEnding ? 80 : 0) + (cand.isActionInvolved ? 80 : 0) + (cand.isSituationAffected ? 60 : 0) + (cand.isKnowledgeRelevant ? 30 : 0);
        }
        meaningful.sort((a, b) => a.bucket - b.bucket || b.score - a.score);

        const activeCast = [heroSim];
        const activeIds = new Set([heroSim.id]);
        for (const cand of meaningful) {
          if (activeIds.size >= CAST_HARD_MAX) break;
          activeCast.push(cand.c); activeIds.add(cand.c.id);
        }
        const deferred = meaningful.filter(cand => !activeIds.has(cand.c.id));
        const deferredReason = (cand) => {
          const tags = [];
          if (cand.isPrevEnding) tags.push('previous-ending');
          if (cand.isActionInvolved) tags.push('action-involved');
          if (cand.isSituationAffected) tags.push('situation-affected');
          if (cand.isKnowledgeRelevant) tags.push('knowledge-relevant');
          if (cand.isColocated) tags.push('present');
          return `deferred to a later chapter (chapter cast hard max ${CAST_HARD_MAX}); relevance: ${tags.join(', ') || 'present'}`;
        };

        // Background extras: derived crowd note from the location — no individual SimCharacter records.
        const deriveBackgroundExtras = () => {
          const types = [];
          if (!heroLoc) return types;
          const crowd = heroLoc.sim_crowd_level || '';
          if (!crowd || crowd === 'empty') return types;
          const key = `${heroLoc.name || ''} ${heroLoc.sim_location_type || ''}`.toLowerCase();
          if (/(tavern|inn|pub|taberna)/.test(key)) types.push('tavern patrons');
          else if (/(market|bazaar|souk|forum|macellum)/.test(key)) types.push('market crowd');
          else if (/(senate|curia|council|court)/.test(key)) types.push('senators');
          else if (/(arena|colosseum|stadium|theatre|theater|amphitheatre)/.test(key)) types.push('spectators');
          else if (/(temple|shrine|sanctuary)/.test(key)) types.push('worshippers');
          else if (/(palace|villa|manor|domus)/.test(key)) types.push('courtiers');
          else if (/(barracks|guard|garrison|watch)/.test(key)) types.push('guards');
          else if (/(street|road|alley|vicus)/.test(key)) types.push('passersby');
          else types.push('bystanders');
          if (heroLoc.sim_guard_presence && heroLoc.sim_guard_presence !== 'none' && !types.includes('guards')) types.push('guards');
          return types;
        };
        const backgroundExtraTypes = deriveBackgroundExtras();

        const wt = (await simEntities.SimWorldTime.filter({ session_id, simulation_run_id: runId }))[0];

        const locBlock = heroLoc ? `HERO'S CURRENT LOCATION: ${heroLoc.name || 'unnamed'}\n  type: ${heroLoc.sim_location_type || 'n/a'} | access: ${heroLoc.sim_public_access || 'n/a'} | escape: ${heroLoc.sim_escape_difficulty || 'n/a'}\n  crowd: ${heroLoc.sim_crowd_level || 'n/a'} | visibility: ${heroLoc.sim_visibility || 'n/a'} | privacy: ${heroLoc.sim_privacy || 'n/a'} | guards: ${heroLoc.sim_guard_presence || 'n/a'}\n  danger: ${heroLoc.sim_general_danger || 'n/a'} | ambush: ${heroLoc.sim_ambush_risk || 'n/a'} | surveillance: ${heroLoc.sim_surveillance_risk || 'n/a'}\n  entry: ${(heroLoc.sim_entry_points || []).join(', ') || 'n/a'} | exits: ${(heroLoc.sim_exit_routes || []).join(', ') || 'n/a'}\n  hiding: ${(heroLoc.sim_hiding_places || []).join(', ') || 'n/a'} | hazards: ${(heroLoc.sim_environmental_hazards || []).join(', ') || 'n/a'}\n  suitable actions: ${(heroLoc.sim_suitable_actions || []).join(', ') || 'n/a'} | unsuitable: ${(heroLoc.sim_unsuitable_actions || []).join(', ') || 'n/a'} | special rules: ${(heroLoc.sim_special_rules || []).join('; ') || 'n/a'}` : "HERO'S CURRENT LOCATION: unknown (not set)";

        const activeCastBlock = activeCast.map(c => {
          const isHero = c.id === heroSim.id;
          const rels = (c.sim_relationships || []).map(r => `${simNameByPackId(r.character_id)}: ${r.relationship_type || 'related'}`).join('; ');
          return `- ${c.name || 'Unnamed'}${isHero ? ' (HERO)' : (c.source_story_character_id ? ' (pack character)' : '')} | goals: ${(c.sim_goals || []).join('; ') || 'n/a'} | needs: ${(c.sim_immediate_needs || []).join('; ') || 'n/a'} | traits: ${(c.traits || []).join(', ') || 'n/a'}${c.physical_description ? ` | appearance: ${c.physical_description}` : ''}${rels ? ` | relationships: ${rels}` : ''}`;
        }).join('\n');
        const deferredBlock = deferred.map(cand => `- ${cand.c.name || 'Unnamed'} — ${deferredReason(cand)}`).join('\n');
        const backgroundBlock = backgroundExtraTypes.length ? backgroundExtraTypes.join(', ') : 'none (location empty or no crowd)';
        const assetsBlock = relevantAssets.map(a => `- ${a.name || 'unnamed asset'}${a.description ? `: ${a.description}` : ''} | held by: ${a.current_holder_id ? nameOf(a.current_holder_id) : 'unattended'} | secured: ${a.is_secured ? 'yes' : 'no'}`).join('\n');
        const sitsBlock = heroSits.map(s => `- ${s.name || 'unnamed situation'} [${s.situation_type || 'other'}/${s.status || 'active'}]${s.description ? `: ${s.description}` : ''} | escalation: ${s.escalation_stage ?? 0}${(s.resolution_conditions || []).length ? ` | resolves when: ${s.resolution_conditions.map(rc => `${rc.description}${rc.is_met ? ' (met)' : ''}`).join('; ')}` : ''}`).join('\n');
        const obsBlock = heroObs.map(o => `- tick ${o.observation_tick ?? '?'}: ${o.understanding_description || o.observation_source_type || 'perceived something'}${o.is_understood ? '' : ' (not fully understood)'}`).join('\n');
        const beliefsBlock = heroBeliefs.map(b => `- "${b.belief_text}" [${b.belief_type || 'belief'}${b.confidence != null ? `, confidence ${b.confidence}` : ''}] (source: ${b.source || 'n/a'})`).join('\n');
        const commBlock = heroTrans.map(t => `- ${nameOf(t.sender_id)} → ${nameOf(t.receiver_id)}${t.transmitted_claim_text ? `: "${t.transmitted_claim_text}"` : ''}${t.mutation_type && t.mutation_type !== 'none' ? ` [${t.mutation_type}]` : ''}`).join('\n');
        const claimsBlock = heroClaims.map(c => `- "${c.claim_text}" [${c.claim_type || 'claim'}] about: ${(c.subject_character_ids || []).map(nameOf).join(', ') || 'n/a'}`).join('\n');

        simStateText = `HERO SCENE CONTEXT (read-only simulation snapshot, scoped to what the Hero currently perceives/knows — authoritative for who is present, the environment, and the Hero's knowledge; narrate consistently; do NOT contradict; do NOT modify simulation records):

WORLD TIME: ${wt?.current_time_label || 'n/a'} (tick ${wt?.current_tick ?? 0}${wt?.tick_duration_label ? `, ${wt.tick_duration_label}` : ''})

${locBlock}

ACTIVE CHAPTER CAST — named characters for this chapter; use ONLY these for named actions and dialogue (count ${activeCast.length}; hard max ${CAST_HARD_MAX}; target 2–4):
${activeCastBlock || 'the Hero is alone this chapter'}

DEFERRED RELEVANT CHARACTERS (do NOT feature this chapter — they return in later chapters; no dialogue, goals, or continuity):
${deferredBlock || 'none'}

BACKGROUND EXTRAS (unnamed crowd only — NO dialogue, NO individual goals, beliefs, knowledge, or continuity tracking):
${backgroundBlock}

ASSETS HERE (at the Hero's location or held by those present) (${relevantAssets.length}):
${assetsBlock || 'none'}

ACTIVE SITUATIONS PRESSING THE HERO (${heroSits.length}):
${sitsBlock || 'none'}

WHAT THE HERO HAS PERCEIVED (Hero's observations only — knowledge boundary; most recent ${heroObs.length}):
${obsBlock || 'none'}

WHAT THE HERO BELIEVES (Hero's private beliefs only — knowledge boundary; ${heroBeliefs.length}):
${beliefsBlock || 'none'}

COMMUNICATION THE HERO HAS BEEN PART OF (most recent ${heroTrans.length}):
${commBlock || 'none'}${heroClaims.length ? `\n\nCLAIMS INVOLVING THE HERO (${heroClaims.length}):\n${claimsBlock}` : ''}

Use this Hero-scene context TOGETHER WITH the previous chapter ending and the user's selected action below. It reflects ONLY what the Hero currently knows/perceives — do NOT reveal information the Hero does not have (other characters' private beliefs, offscreen events, or anything not listed here). Keep the scene consistent with who is present, the environment, and the Hero's knowledge. You are NOT asked to change simulation records — only to narrate consistently with them. CAST CONTROL: use ONLY the ACTIVE CHAPTER CAST for named actions and dialogue. Background extras are unnamed crowd — give them NO dialogue, goals, beliefs, or continuity. Deferred relevant characters must NOT appear as named actors this chapter unless a justified transition is written; they return in later chapters.`;
      }
    }

    // ── 5. Build prompt (data only — rules are in the agent's config) ───────────
    const memory = session.story_memory || {};

    const setsDescription = sets.map(s =>
      `- ${s.name}: ${s.description || ''}${s.images?.length ? ` | Reference images: ${s.images.join(', ')}` : ''}`
    ).join('\n');

    // NOTE: Backstories are intentionally NOT included inline — they are large and
    // dumping all of them caused a 422 "message content too long". The agent has
    // read access to the StoryCharacter entity and fetches each featured
    // character's full backstory on demand using the ID provided here.
    const charsDescription = supportingChars.map(c =>
      `- ${c.name || 'Unnamed'} (type: ${c.character_type || 'character'}): ${c.description || 'N/A'} | Traits: ${(c.traits || []).join(', ') || 'N/A'}${c.photos?.length ? ` | Photos: ${c.photos.join(', ')}` : ''}`
    ).join('\n');

    const blocksHistory = existingBlocks.map((b, i) =>
      `Block ${i + 1}: ${b.narrative_summary || '(no summary)'} | User chose: ${b.choice_options?.find(c => c.id === b.selected_choice)?.label || b.selected_choice || 'N/A'}`
    ).join('\n');

    // ── Build detailed "last scene" context for strict continuity ──
    let lastSceneContext = 'None (this is the first block).';
    if (lastBlock) {
      const lastSegments = lastBlock.segment_instructions || [];
      const lastSeg = lastSegments[lastSegments.length - 1] || {};
      const lastChoice = lastBlock.choice_options?.find(c => c.id === lastBlock.selected_choice);
      lastSceneContext = `LAST BLOCK ENDED WITH:
- Block title: "${lastBlock.block_title || `Block ${existingBlocks.length}`}"
- Full narrative summary: ${lastBlock.narrative_summary || '(none)'}
- User's choice: ${lastChoice ? `${lastChoice.label} — ${lastChoice.description || ''}` : lastBlock.selected_choice || 'N/A'}
- Characters who were present at the end: ${(lastSeg.characters_present || lastBlock.selected_characters || []).join(', ') || 'N/A'}
- Final location/set: ${lastSeg.selected_set || (lastBlock.selected_sets || []).join(', ') || 'N/A'}
- Last visual action: ${lastSeg.story_action || 'N/A'}
- Last narration heard: ${lastSeg.narration_text || 'N/A'}
- Emotional tone at end: ${lastSeg.emotional_tone || 'N/A'}
- Continuity notes from last block: ${(lastSeg.continuity_notes || '').toString() || 'N/A'}
- Hero's appearance (COSTUME LOCK — must match): ${isStorylineSwitch ? 'N/A — new hero for this chapter, establish their look' : (memory?.hero_appearance || 'N/A')}`;
    }

    const allowedNames = [
      `- Hero: "${hero.name || 'Hero'}"`,
      ...(theme?.story_character_ids || []).map((id) => {
        const c = supportingChars.find(sc => sc.id === id);
        return c ? `- "${c.name}"` : '';
      }).filter(Boolean),
      `- "NPC" (background persons — no reference photo)`,
    ].join('\n');

    // ── Story arc blueprint (persists across all chapters, even on hero/topic switches) ──
    const arcChapterCount = session.arc_chapter_count || 0;
    const currentChapter = blockOrder + 1; // 1-based
    let arcPhase = 'unstructured';
    let arcGuidance = 'No fixed arc is set — develop the story organically based on the topic and the user\'s choices, but keep it cohesive and escalating.';
    if (arcChapterCount > 0 && (session.arc_start || session.arc_middle || session.arc_reveal)) {
      const startEnd = Math.max(1, Math.round(arcChapterCount / 3));
      const midEnd = Math.max(startEnd + 1, Math.round(arcChapterCount * 2 / 3));
      if (currentChapter <= startEnd) {
        arcPhase = 'START';
        arcGuidance = 'Establish the world, the Hero, and the central conflict. Set up the stakes described in the Start phase below.';
      } else if (currentChapter <= midEnd) {
        arcPhase = 'MIDDLE';
        arcGuidance = 'Raise the stakes, introduce complications and twists, and deepen character conflict as described in the Middle phase below.';
      } else {
        arcPhase = 'REVEAL';
        arcGuidance = 'Steer toward the climax and resolution described in the Reveal/Conclusion phase below. Bring threads together and escalate toward resolution rather than opening new ones.';
      }
    }

    const prompt = `STORY BLOCK GENERATION REQUEST
===============================

THEME:
- Title: ${theme.title}
- Type: ${theme.type || 'N/A'}
- Description: ${theme.description}
- Tone Rules: ${theme.tone_rules || 'N/A'}
- Story Rules: ${theme.story_rules || 'N/A'}

STORY ARC BLUEPRINT (this guides the WHOLE story and persists across every chapter — even if the hero or storyline shifts):
- Total chapters planned: ${arcChapterCount || 'unlimited'}
- START (the beginning setup): ${session.arc_start || 'N/A'}
- MIDDLE (rising action / complications): ${session.arc_middle || 'N/A'}
- REVEAL / CONCLUSION (climax the story builds toward): ${session.arc_reveal || 'N/A'}

CURRENT CHAPTER: ${currentChapter}${arcChapterCount ? ` of ${arcChapterCount}` : ''} — phase: ${arcPhase}

ARC PACING RULES:
1. Use the blueprint above to keep the story moving toward the Reveal. Every chapter must advance the overall arc, not wander off it.
2. This chapter is in the ${arcPhase} phase. ${arcGuidance}
3. If the current chapter is at or near the total, steer hard toward the Reveal/Conclusion — escalate toward resolution instead of opening new threads.
4. On a storyline/hero switch (pivot chapter), the arc blueprint STILL applies — the new storyline and new hero must serve this same overall arc and push toward the same Reveal.

HERO CHARACTER:
- Name: ${hero.name || 'Unnamed'}
- Bio: ${hero.description || 'N/A'}
- Backstory: ${hero.backstory || 'N/A'}
- Traits: ${(hero.traits || []).join(', ') || 'N/A'}
- Reference Photos: ${heroPhotos.join(', ') || 'N/A'}

STARTING TOPIC:
- Title: ${topic.title}
- Description: ${topic.description}
- Tagged Characters (the AI SHOULD feature these characters in this block when the story starts from this topic): ${(() => {
  const taggedIds = topic.character_ids || [];
  if (taggedIds.length === 0) return 'None — the AI may choose freely from the cast.';
  // Combine hero + supporting so we can resolve IDs to names/descriptions
  const pool = [hero, ...supportingChars];
  const tagged = taggedIds
    .map(id => pool.find(c => c && c.id === id))
    .filter(Boolean)
    .map(c => `"${c.name}" (${c.character_type || 'character'}): ${c.description || 'N/A'}`);
  return tagged.length ? tagged.join('; ') : 'None — the AI may choose freely from the cast.';
})()}

AVAILABLE SETS:
${setsDescription || 'No sets available — generate environments from the theme description.'}

SUPPORTING CHARACTERS (ONLY actors besides the Hero):
${charsDescription || 'No supporting characters linked to this theme. The Hero can be alone.'}

CHARACTER DATA RULE: Use ONLY the character canon supplied inline above. No external character-reading tool is available. Never invent a named character, occupation, relationship, motive, or biography. Unnamed background people may be represented only as "NPC" and may not drive the plot or receive dialogue.

EXACT ALLOWED CHARACTER NAMES (use these in characters_present):
${allowedNames}

CAST LOCK (NON-NEGOTIABLE):
1. Every named person in narration, dialogue, story_action, selected_characters, and characters_present MUST be the Hero or one of the exact allowed names above.
2. Preserve each character's supplied description, occupation, relationships, personality, and motives.
3. Do not replace an existing pack character with an invented generic equivalent.
4. If the arc blueprint mentions a person outside this list, ignore that invented person and reassign the dramatic function to the most appropriate allowed pack character.
5. "NPC" means an unnamed background extra only: no proper name, no personal subplot, no important revelation, and no dialogue.

STORY MEMORY:
${JSON.stringify(memory, null, 2)}

PREVIOUS STORY BLOCKS:
${blocksHistory || 'None yet.'}

${simStateText ? simStateText + '\n\n' : ''}${isFirstBlock
  ? 'This is the FIRST Story Block. Use the Starting Topic as inspiration to begin the story.'
  : isStorylineSwitch
    ? `This is a CONTINUATION block, BUT the user has chosen a NEW HERO and/or NEW STORYLINE for this next chapter. This chapter must pivot the story into the new storyline while keeping a smooth transition from the previous block.

  NEW STORYLINE TO PIVOT INTO:
  - Title: ${topic.title}
  - Premise: ${topic.description}

  PIVOT INSTRUCTIONS:
  1. Begin from where the previous block ended (see LAST BLOCK context below) for a smooth handoff.
  2. Then pivot the narrative toward the NEW storyline premise above — this chapter launches that new storyline as its focus.
  3. The Hero for this chapter is "${hero.name}" (${hero.description || 'N/A'}). They are now the PROTAGONIST and the POV the story follows — introduce them naturally into the ongoing world and make them central to this chapter.
  4. The previous lead (named in STORY MEMORY's hero_appearance / active_characters) MAY still appear as a supporting or instigator character — keep them in the world, but they are NO LONGER the lead. The story must follow "${hero.name}", not the previous lead.
  5. Do NOT treat the previous lead as the protagonist, narrate from their POV, or center the scene on them — they are now a supporting character only.
  6. The previous conflict can wrap up or hand off; the new storyline's premise becomes the main focus of this chapter.
  7. Keep the world/setting consistent, but open a fresh chapter/episode arc around the new storyline and hero.
  8. STORY MEMORY below reflects the PREVIOUS lead's situation, appearance, and emotional state. Use it for world/plot continuity, but establish "${hero.name}"'s own appearance and emotional state fresh for this chapter.

  ${lastSceneContext}`
    : `This is a CONTINUATION block. You MUST continue from the EXACT situation where the previous block ended.

  ${lastSceneContext}

  CRITICAL CONTINUITY RULES:
  1. START where the last block ended — do NOT restart, time-skip, or jump to a new plot line.
  2. The Hero must still be in the same location (unless the last choice explicitly caused a move).
  3. All characters who were present at the end of the last block must still be present at the start of this block (unless the story explicitly states they left).
  4. Respect the last scene's unresolved conflict — do not resolve it off-screen or skip past it.
  5. Match the Hero's emotional state from the end of the last block — do not reset their feelings.
  6. The user's selected choice was: "${lastBlock?.choice_options?.find(c => c.id === lastBlock.selected_choice)?.label || lastBlock?.selected_choice || 'N/A'}". The new block must be a direct consequence of that choice.
  7. The Hero's clothing/appearance MUST stay identical (Costume Lock) — use the hero_appearance from story memory.`}

${session.director_note ? `DIRECTOR'S NOTE (high-priority user directive for THIS chapter — weave it into the narrative naturally, consistent with the simulation state, character motivations, and story continuity. This steering instruction MUST be honored as the chapter's dramatic direction):

${session.director_note}

` : ''}Generate the next Story Block now. Return ONLY the JSON object.`;

    // ── 6. Create conversation + send message to agent (NON-BLOCKING) ──────────
    const conversation = await base44.agents.createConversation({
      agent_name: 'story_orchestrator',
      metadata: { session_id, block_order: blockOrder },
    });

    const { result, charge } = await withCreditCharge({
      ...billing,
      toolId: 'story_block',
      provider: 'replicate',
      relatedEntity: `story_session_${session_id}`,
    }, async () => {
      await base44.agents.startMessage(conversation, {
        role: 'user',
        content: prompt,
        file_urls: allReferenceImages.length > 0 ? allReferenceImages : undefined,
      });

      // Keep the paid provider response and its database record atomic. If the
      // StoryBlock cannot be stored, withCreditCharge refunds the reservation.
      const storyBlock = await base44.entities.StoryBlock.create({
        session_id,
        order: blockOrder,
        video_segments: [],
        choice_options: [],
        selected_choice: null,
        narrative_summary: '',
        segment_instructions: [],
        block_title: `Block ${blockOrder + 1}`,
        selected_characters: [],
        selected_sets: [],
        generation_status: 'planning',
        planning_conversation_id: conversation.id,
        is_storyline_switch: isStorylineSwitch,
        director_note: session.director_note || '',
      });
      return { storyBlock };
    });
    const { storyBlock } = result;

    // ── 7. Create block with "planning" status — return IMMEDIATELY ────────────
    // Clear the session-level director note — it's been consumed into this block's
    // prompt and preserved on the block itself for reference. Prevents looping.
    if (session.director_note) {
      await base44.entities.StorySession.update(session_id, { director_note: '' }).catch(() => {});
    }

    // ── 8. Return immediately — no waiting for agent ──────────────────────────
    return Response.json({
      story_block: storyBlock,
      phase: 'planning_started',
      next_step: 'poll checkStoryBlockPlan with block_id',
      credit_cost: charge.cost,
      balance_after: charge.balanceAfter,
    });

  } catch (error) {
    console.error('generateStoryBlock error:', error.message);
    throw error;
  }
});
