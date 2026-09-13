import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

// Simulation Initialization — connects admin-authored pack data to a live
// StorySession when a user begins a Story Block session.
//
// Input:
//   { theme_id, hero_story_character_id, starting_topic_id }        — new session
//   { session_id }                                                   — init an existing (un-initialized) session
//
// Behaviour:
//   • New session path: validate theme/hero/topic, create a StorySession with a
//     fresh unique simulation_run_id, then initialize the simulation once.
//   • Existing-session path: load the session, reuse its simulation_run_id. If
//     Sim records already exist for that (session_id, simulation_run_id), return
//     idempotently without creating anything. Otherwise initialize.
//
// Initialization copies admin-authored values VERBATIM from StoryCharacter /
// StartingTopic. Nothing is derived or invented from descriptions or backstories.
// The ledger prototype constants/records are NOT referenced by this flow.

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const theme_id = body.theme_id;
    const hero_story_character_id = body.hero_story_character_id;
    const starting_topic_id = body.starting_topic_id;
    const existing_session_id = body.session_id;

    let session;

    if (existing_session_id) {
      // ── Existing-session path ──
      session = await base44.asServiceRole.entities.StorySession
        .get(existing_session_id).catch(() => null);
      if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

      // Ownership / admin bypass (mirrors actionResolver / informationNetworkResolver)
      const adminEmail = (Deno.env.get('ADMIN_EMAIL') || '').toLowerCase().trim();
      const fullUser = await base44.asServiceRole.entities.User
        .filter({ email: user.email }).then(r => r[0]).catch(() => null);
      const isAdmin = (fullUser?.role || user.role) === 'admin' || (user.email || '').toLowerCase().trim() === adminEmail;
      if (session.user_email && session.user_email !== user.email && !isAdmin) {
        return Response.json({ error: 'Not your session' }, { status: 403 });
      }

      if (!session.simulation_run_id) {
        const simulationRunId = crypto.randomUUID();
        session = await base44.asServiceRole.entities.StorySession.update(session.id, {
          simulation_run_id: simulationRunId,
        });
      }

      // Idempotency: if Sim records already exist for this run, do nothing.
      const existingChars = await base44.asServiceRole.entities.SimCharacter
        .filter({ session_id: session.id, simulation_run_id: session.simulation_run_id });
      if (existingChars.length > 0) {
        return Response.json({
          initialized: false,
          already_initialized: true,
          session_id: session.id,
          simulation_run_id: session.simulation_run_id,
          existing_sim_character_count: existingChars.length,
        });
      }

      // Fall through to initialization using the existing session's ids.
      // (theme/hero/topic are read from the session itself.)
      return await initialize(base44, {
        session,
        theme_id: session.theme_id,
        hero_story_character_id: session.hero_story_character_id,
        starting_topic_id: session.starting_topic_id,
        user_email: session.user_email,
      });
    }

    // ── New-session path ──
    if (!theme_id || !hero_story_character_id || !starting_topic_id) {
      return Response.json({ error: 'theme_id, hero_story_character_id and starting_topic_id are required' }, { status: 400 });
    }

    const simulation_run_id = 'sim_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    session = await base44.asServiceRole.entities.StorySession.create({
      user_email: user.email,
      theme_id,
      hero_story_character_id,
      starting_topic_id,
      simulation_run_id,
      status: 'active',
      block_count: 0,
      arc_chapter_count: 0,
    });

    return await initialize(base44, {
      session,
      theme_id,
      hero_story_character_id,
      starting_topic_id,
      user_email: user.email,
    });
  } catch (error) {
    console.error('initializeSimulation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── Core initialization, shared by both paths ──────────────────────────────
async function initialize(base44, { session, theme_id, hero_story_character_id, starting_topic_id, user_email }) {
  const session_id = session.id;
  const simulation_run_id = session.simulation_run_id;
  const sr = base44.asServiceRole.entities;

  // ── Validate pack assets (read-only; never written) ──
  const topic = await sr.StartingTopic.get(starting_topic_id).catch(() => null);
  if (!topic) return Response.json({ error: 'StartingTopic not found' }, { status: 404 });
  if (topic.theme_id !== theme_id) {
    return Response.json({ error: 'StartingTopic does not belong to the selected theme' }, { status: 400 });
  }
  const heroChar = await sr.StoryCharacter.get(hero_story_character_id).catch(() => null);
  if (!heroChar) return Response.json({ error: 'Hero StoryCharacter not found' }, { status: 404 });

  // ── Determine the full set of involved StoryCharacters ──
  // seed = topic.character_ids + hero + topic private-fact chars + topic hero-goal chars
  const seedIds = new Set();
  for (const id of (topic.character_ids || [])) if (id) seedIds.add(id);
  if (hero_story_character_id) seedIds.add(hero_story_character_id);
  for (const p of (topic.sim_private_facts_by_character || [])) if (p.character_id) seedIds.add(p.character_id);
  for (const g of (topic.sim_hero_initial_goals || [])) if (g.character_id) seedIds.add(g.character_id);

  // expand by authored relationships on the seed characters (one level)
  const seedChars = await loadChars(sr, [...seedIds]);
  for (const c of seedChars) {
    for (const r of (c.sim_relationships || [])) {
      if (r.character_id) seedIds.add(r.character_id);
    }
  }

  const involvedChars = await loadChars(sr, [...seedIds]);
  // de-dupe by id
  const byId = new Map();
  for (const c of involvedChars) if (c && c.id && !byId.has(c.id)) byId.set(c.id, c);
  const chars = [...byId.values()];

  // ── SimWorldTime (created early so time profiles can apply to locations) ──
  const worldTime = await sr.SimWorldTime.create({
    session_id,
    simulation_run_id,
    current_tick: 0,
    current_time_label: 'Day 1, Morning',
    tick_duration_label: '~1 hour',
  });
  const currentPeriod = periodFromLabel(worldTime.current_time_label);

  // ── SimLocations from StorySets actually referenced by the involved chars ──
  // Each SimLocation copies the StorySet's environment fields verbatim, then the
  // matching time profile (by SimWorldTime period) overrides only the fields the
  // profile provides. The StorySet is never modified.
  const setIds = new Set();
  for (const c of chars) if (c.sim_starting_story_set_id) setIds.add(c.sim_starting_story_set_id);
  const sets = await loadSets(sr, [...setIds]);
  const setLocationId = {}; // storySetId -> simLocationId
  const createdLocationIds = [];
  for (const s of sets) {
    const baseEnv = {
      sim_location_type: s.sim_location_type || null,
      sim_public_access: s.sim_public_access || null,
      sim_crowd_level: s.sim_crowd_level || null,
      sim_visibility: s.sim_visibility || null,
      sim_privacy: s.sim_privacy || null,
      sim_guard_presence: s.sim_guard_presence || null,
      sim_general_danger: s.sim_general_danger || null,
      sim_ambush_risk: s.sim_ambush_risk || null,
      sim_surveillance_risk: s.sim_surveillance_risk || null,
      sim_escape_difficulty: s.sim_escape_difficulty || null,
      sim_entry_points: s.sim_entry_points || [],
      sim_exit_routes: s.sim_exit_routes || [],
      sim_hiding_places: s.sim_hiding_places || [],
      sim_environmental_hazards: s.sim_environmental_hazards || [],
      sim_suitable_actions: s.sim_suitable_actions || [],
      sim_unsuitable_actions: s.sim_unsuitable_actions || [],
      sim_special_rules: s.sim_special_rules || [],
    };
    const effectiveEnv = applyTimeProfile(baseEnv, s.sim_time_profiles, currentPeriod);
    const loc = await sr.SimLocation.create({
      session_id,
      simulation_run_id,
      name: s.name,
      description: s.description || '',
      source_story_set_id: s.id,
      sim_time_profiles: s.sim_time_profiles || [],
      ...effectiveEnv,
    });
    setLocationId[s.id] = loc.id;
    createdLocationIds.push(loc.id);
  }

  // ── SimCharacters ──
  const charSimId = {}; // sourceStoryCharacterId -> simCharacterId
  const createdCharIds = [];
  for (const c of chars) {
    const locId = c.sim_starting_story_set_id ? (setLocationId[c.sim_starting_story_set_id] || null) : null;
    const sim = await sr.SimCharacter.create({
      session_id,
      simulation_run_id,
      name: c.name,
      description: c.description || '',
      source_story_character_id: c.id,
      current_location_id: locId,
      traits: c.traits || [],
      physical_description: c.physical_description || '',
      sim_goals: c.sim_goals || [],
      sim_immediate_needs: c.sim_immediate_needs || [],
      sim_relationships: c.sim_relationships || [],
      sim_responsibilities: c.sim_responsibilities || [],
    });
    charSimId[c.id] = sim.id;
    createdCharIds.push(sim.id);
  }

  // ── SimAssets from each character's controlled assets ──
  const createdAssetIds = [];
  for (const c of chars) {
    const holderSimId = charSimId[c.id];
    const holderLocId = c.sim_starting_story_set_id ? (setLocationId[c.sim_starting_story_set_id] || null) : null;
    for (const a of (c.sim_controlled_assets || [])) {
      const asset = await sr.SimAsset.create({
        session_id,
        simulation_run_id,
        name: a.name,
        description: a.description || '',
        current_holder_id: holderSimId,
        current_location_id: holderLocId,
        is_secured: false,
      });
      createdAssetIds.push(asset.id);
    }
  }

  // ── Processed starting observations ──
  const createdObservationIds = [];
  const makeObs = async (observerSimId, fact) => {
    const o = await sr.SimObservation.create({
      session_id,
      simulation_run_id,
      observer_id: observerSimId,
      observation_source_type: 'prior_knowledge',
      observation_tick: 0,
      is_understood: true,
      understanding_description: fact,
      available_from_tick: 0,
      processing_status: 'processed',
    });
    createdObservationIds.push(o.id);
  };
  // (a) each character's sim_starting_knowledge
  for (const c of chars) {
    const simId = charSimId[c.id];
    for (const k of (c.sim_starting_knowledge || [])) await makeObs(simId, k);
  }
  // (b) public facts for ALL initialized characters
  const allSimIds = chars.map(c => charSimId[c.id]);
  for (const f of (topic.sim_public_facts || [])) {
    for (const sid of allSimIds) await makeObs(sid, f);
  }
  // (c) private facts only for the specified character
  for (const p of (topic.sim_private_facts_by_character || [])) {
    const simId = charSimId[p.character_id];
    if (!simId) continue;
    for (const f of (p.facts || [])) await makeObs(simId, f);
  }

  // ── Prior SimBeliefs ──
  const createdBeliefIds = [];
  for (const c of chars) {
    const simId = charSimId[c.id];
    for (const b of (c.sim_starting_beliefs || [])) {
      const payload = {
        session_id,
        simulation_run_id,
        character_id: simId,
        belief_text: b.text,
        belief_type: b.belief_type,
        source: 'prior',
        created_tick: 0,
      };
      if (b.confidence !== undefined && b.confidence !== null && b.confidence !== '') {
        payload.confidence = b.confidence;
      }
      const belief = await sr.SimBelief.create(payload);
      createdBeliefIds.push(belief.id);
    }
  }

  // ── SimActiveSituations ──
  const createdSituationIds = [];
  // affected = topic.character_ids resolved to SimCharacters; fallback to all initialized
  const topicAffected = (topic.character_ids || [])
    .map(id => charSimId[id])
    .filter(Boolean);
  const affected = topicAffected.length ? topicAffected : allSimIds;
  for (const s of (topic.sim_initial_active_situations || [])) {
    const sit = await sr.SimActiveSituation.create({
      session_id,
      simulation_run_id,
      name: s.name,
      description: s.description || '',
      situation_type: s.situation_type,
      status: s.status,
      affected_character_ids: affected,
      escalation_stage: 0,
      created_tick: 0,
      source_starting_topic_id: topic.id,
    });
    createdSituationIds.push(sit.id);
  }

  // (SimWorldTime was created before SimLocations so time profiles could apply.)

  // ── Apply the Hero's goal from the topic onto the hero SimCharacter ──
  let heroGoalApplied = null;
  const heroSimId = charSimId[hero_story_character_id];
  if (heroSimId) {
    const heroGoalEntry = (topic.sim_hero_initial_goals || []).find(g => g.character_id === hero_story_character_id);
    if (heroGoalEntry && heroGoalEntry.goal) {
      const heroSim = await sr.SimCharacter.get(heroSimId);
      const goals = [...(heroSim.sim_goals || [])];
      if (!goals.includes(heroGoalEntry.goal)) goals.push(heroGoalEntry.goal);
      await sr.SimCharacter.update(heroSimId, { sim_goals: goals });
      heroGoalApplied = heroGoalEntry.goal;
    }
  }

  return Response.json({
    initialized: true,
    session_id,
    simulation_run_id,
    story_session: { id: session.id, theme_id, hero_story_character_id, starting_topic_id, user_email },
    counts: {
      sim_characters: createdCharIds.length,
      sim_locations: createdLocationIds.length,
      sim_assets: createdAssetIds.length,
      sim_observations: createdObservationIds.length,
      sim_beliefs: createdBeliefIds.length,
      sim_active_situations: createdSituationIds.length,
      sim_world_time: 1,
    },
    ids: {
      sim_characters: createdCharIds,
      sim_locations: createdLocationIds,
      sim_assets: createdAssetIds,
      sim_observations: createdObservationIds,
      sim_beliefs: createdBeliefIds,
      sim_active_situations: createdSituationIds,
      sim_world_time: worldTime.id,
    },
    hero_goal_applied: heroGoalApplied,
  });
}

async function loadChars(sr, ids) {
  const out = [];
  for (const id of ids) {
    const c = await sr.StoryCharacter.get(id).catch(() => null);
    if (c) out.push(c);
  }
  return out;
}

async function loadSets(sr, ids) {
  const out = [];
  for (const id of ids) {
    const s = await sr.StorySet.get(id).catch(() => null);
    if (s) out.push(s);
  }
  return out;
}

// Map a SimWorldTime human label to a standard time period.
function periodFromLabel(label) {
  const s = (label || '').toLowerCase();
  if (s.includes('late night') || s.includes('late_night')) return 'late_night';
  if (s.includes('dawn')) return 'dawn';
  if (s.includes('morning')) return 'morning';
  if (s.includes('afternoon')) return 'afternoon';
  if (s.includes('evening')) return 'evening';
  if (s.includes('night')) return 'night';
  return null;
}

// Apply a matching time profile over base environment fields. Only the fields
// the profile actually provides are overridden; omitted fields keep their base.
// Profile keys (no sim_ prefix) map onto the SimLocation's sim_-prefixed fields.
function applyTimeProfile(baseEnv, profiles, period) {
  if (!period) return baseEnv;
  const prof = (profiles || []).find(p => p.time_period === period);
  if (!prof) return baseEnv;
  const eff = { ...baseEnv };
  const map = [
    ['crowd_level', 'sim_crowd_level'],
    ['visibility', 'sim_visibility'],
    ['privacy', 'sim_privacy'],
    ['guard_presence', 'sim_guard_presence'],
    ['general_danger', 'sim_general_danger'],
    ['ambush_risk', 'sim_ambush_risk'],
    ['surveillance_risk', 'sim_surveillance_risk'],
  ];
  for (const [pk, ek] of map) {
    if (prof[pk]) eff[ek] = prof[pk];
  }
  if (Array.isArray(prof.special_rules)) eff.sim_special_rules = prof.special_rules;
  return eff;
}
