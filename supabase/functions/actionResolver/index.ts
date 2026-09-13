import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

// Action Resolver — Phase 1 (direct physical transaction only).
// Contract scope: preconditions, outcome, atomic objective update, immediate
// observations, situation consequence, idempotency. Does NOT process delayed
// discovery, communication, claim mutation, or reputation (Information Network
// Resolver territory).

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action_id = body.action_id;
    const simulation_run_id = body.simulation_run_id;
    if (!action_id) return Response.json({ error: 'action_id required' }, { status: 400 });

    // ── Load the action ─────────────────────────────────────────────────────
    const action = await base44.asServiceRole.entities.SimCharacterAction.get(action_id);
    if (!action) return Response.json({ error: 'Action not found' }, { status: 404 });

    const actionRunId = simulation_run_id || action.simulation_run_id || null;

    // ── Idempotency: already resolved? Return existing audit, create nothing ──
    const RESOLVED = ['executed', 'failed', 'interrupted'];
    if (RESOLVED.includes(action.status)) {
      const stateChanges = (action.resulting_state_change_ids || []).length
        ? await Promise.all((action.resulting_state_change_ids || []).map(id => base44.asServiceRole.entities.SimStateChange.get(id).catch(() => null)))
        : [];
      const observations = (action.resulting_observation_ids || []).length
        ? await Promise.all((action.resulting_observation_ids || []).map(id => base44.asServiceRole.entities.SimObservation.get(id).catch(() => null)))
        : [];
      const consequences = await base44.asServiceRole.entities.SimConsequence.filter({ session_id: action.session_id, source_action_id: action.id });
      const assetNow = action.target_asset_id ? await base44.asServiceRole.entities.SimAsset.get(action.target_asset_id).catch(() => null) : null;
      return Response.json({
        resolver_status: 'already_resolved',
        action_outcome: action.outcome,
        action_status: action.status,
        precondition_results: [],
        created_state_change_ids: action.resulting_state_change_ids || [],
        created_observation_ids: action.resulting_observation_ids || [],
        created_consequence_ids: consequences.map(c => c.id),
        objective_state: {
          asset: assetNow ? {
            id: assetNow.id, name: assetNow.name,
            current_holder_id: assetNow.current_holder_id,
            current_location_id: assetNow.current_location_id,
          } : null,
        },
        errors: [],
      });
    }

    // ── Load referenced records ────────────────────────────────────────────
    const session = action.session_id ? await base44.asServiceRole.entities.StorySession.get(action.session_id).catch(() => null) : null;
    const actor = action.actor_id ? await base44.asServiceRole.entities.SimCharacter.get(action.actor_id).catch(() => null) : null;
    const asset = action.target_asset_id ? await base44.asServiceRole.entities.SimAsset.get(action.target_asset_id).catch(() => null) : null;
    const targetLocation = action.target_location_id ? await base44.asServiceRole.entities.SimLocation.get(action.target_location_id).catch(() => null) : null;
    const situation = action.motivation_situation_id ? await base44.asServiceRole.entities.SimActiveSituation.get(action.motivation_situation_id).catch(() => null) : null;
    const belief = action.motivation_belief_id ? await base44.asServiceRole.entities.SimBelief.get(action.motivation_belief_id).catch(() => null) : null;
    const worldTimeRecords = await base44.asServiceRole.entities.SimWorldTime.filter({ session_id: action.session_id, simulation_run_id: actionRunId });
    const worldTime = worldTimeRecords[0] || null;

    // ── Ownership / auth (admin bypass, mirrors generateStoryBlock pattern) ──
    const adminEmail = (Deno.env.get('ADMIN_EMAIL') || '').toLowerCase().trim();
    const fullUser = await base44.asServiceRole.entities.User.filter({ email: user.email }).then(r => r[0]).catch(() => null);
    const isAdmin = (fullUser?.role || user.role) === 'admin' || (user.email || '').toLowerCase().trim() === adminEmail;
    if (session && session.user_email && session.user_email !== user.email && !isAdmin) {
      return Response.json({ error: 'Not your session' }, { status: 403 });
    }

    // ── Precondition checks ────────────────────────────────────────────────
    const preconditionResults = [];
    const record = (code, passed, message) => preconditionResults.push({ code, passed, message: message || null });
    const currentTick = worldTime?.current_tick ?? 0;

    record('action_status_proposed', action.status === 'proposed', `Action status is "${action.status}"`);
    record('actor_exists', !!actor, actor ? null : 'Actor SimCharacter not found');
    record('asset_exists', !!asset, asset ? null : 'Target SimAsset not found');

    // Actor & asset same location (respecting the location invariant)
    let sameLocation = false;
    if (actor && asset) {
      let assetEffectiveLocation;
      if (asset.current_holder_id) {
        const holder = await base44.asServiceRole.entities.SimCharacter.get(asset.current_holder_id).catch(() => null);
        assetEffectiveLocation = holder?.current_location_id || null;
      } else {
        assetEffectiveLocation = asset.current_location_id || null;
      }
      sameLocation = !!actor.current_location_id && actor.current_location_id === assetEffectiveLocation;
    }
    record('actor_asset_same_location', sameLocation, sameLocation ? null : 'Actor and target asset are not at the same effective location');

    const notHeldByOther = !asset || !asset.current_holder_id || asset.current_holder_id === action.actor_id;
    record('asset_not_held_by_other', notHeldByOther, notHeldByOther ? null : 'Asset is already held by another character');

    record('asset_secured_state_evaluated', !!asset, asset ? `is_secured=${asset.is_secured}` : 'Asset missing');
    record('action_not_already_resolved', !RESOLVED.includes(action.status), null);

    // Session + simulation run consistency across all referenced entities
    const loadedEntities = [actor, asset, targetLocation, situation, belief, worldTime].filter(Boolean);
    const allSameSession = loadedEntities.every(e => e.session_id === action.session_id);
    const allSameRun = actionRunId ? loadedEntities.every(e => (e.simulation_run_id || null) === actionRunId || !e.simulation_run_id) : true;
    const sessionOk = !!session && action.session_id === session.id;
    record('session_run_consistency', sessionOk && allSameSession && allSameRun,
      (sessionOk && allSameSession && allSameRun) ? null : 'Referenced entities do not all belong to the same StorySession / simulation run');

    const allPassed = preconditionResults.every(p => p.passed);

    // ── Outcome determination (deterministic; no character-stat system) ─────
    // - any precondition failed        → failure
    // - all pass + is_secured === true → failure (secured asset blocks simple theft)
    // - all pass + is_secured === false → success
    // partial_success / interruption: defined but reserved for future capability.
    let outcome, actionStatus;
    if (!allPassed) {
      outcome = 'failure'; actionStatus = 'failed';
    } else if (asset.is_secured) {
      outcome = 'failure'; actionStatus = 'failed';
    } else {
      outcome = 'success'; actionStatus = 'executed';
    }

    const createdStateChangeIds = [];
    const createdObservationIds = [];
    const createdConsequenceIds = [];
    let updatedAsset = asset;

    if (outcome === 'success' && asset) {
      // ── 1. Atomic asset update (holder + cleared location in one call) ──
      const previousState = {
        current_location_id: asset.current_location_id || null,
        current_holder_id: asset.current_holder_id || null,
        is_secured: asset.is_secured,
      };
      const newState = {
        current_location_id: null, // cleared — held asset inherits holder's location
        current_holder_id: action.actor_id,
        is_secured: asset.is_secured,
      };
      updatedAsset = await base44.asServiceRole.entities.SimAsset.update(asset.id, {
        current_holder_id: action.actor_id,
        current_location_id: null,
      });

      // ── 2. StateChange (discoverable later via available_from_tick) ─────
      const discoveryDelay = 2; // merchant notices the absence 2 ticks later
      const stateChange = await base44.asServiceRole.entities.SimStateChange.create({
        session_id: action.session_id,
        simulation_run_id: action.simulation_run_id || actionRunId,
        action_id: action.id,
        change_type: 'possession_transfer',
        entity_type: 'asset',
        entity_id: asset.id,
        previous_state: previousState,
        new_state: newState,
        change_tick: currentTick,
        available_from_tick: currentTick + discoveryDelay,
      });
      createdStateChangeIds.push(stateChange.id);

      // ── 3. Immediate observations: direct witnesses only (exclude actor) ─
      const presentChars = await base44.asServiceRole.entities.SimCharacter.filter({
        session_id: action.session_id,
        current_location_id: actor.current_location_id,
      });
      const witnesses = presentChars.filter(c => c.id !== action.actor_id);
      for (const w of witnesses) {
        const obs = await base44.asServiceRole.entities.SimObservation.create({
          session_id: action.session_id,
          simulation_run_id: action.simulation_run_id || actionRunId,
          observer_id: w.id,
          observation_source_type: 'direct_action',
          source_action_id: action.id,
          observation_tick: currentTick,
          is_understood: true,
          understanding_description: `${w.name} witnessed ${actor.name} take the ${asset.name}.`,
          available_from_tick: currentTick,
          processing_status: 'pending',
        });
        createdObservationIds.push(obs.id);
      }

      // ── 4. Consequence on the linked ActiveSituation (advance, not resolve) ─
      if (situation) {
        const consequence = await base44.asServiceRole.entities.SimConsequence.create({
          session_id: action.session_id,
          simulation_run_id: action.simulation_run_id || actionRunId,
          source_action_id: action.id,
          source_state_change_id: stateChange.id,
          consequence_type: 'situation_advance',
          affected_situation_id: situation.id,
          description: `${actor.name} stole the ${asset.name}, advancing "${situation.name}". Resolution conditions remain unmet — the situation is NOT resolved.`,
          consequence_tick: currentTick,
        });
        createdConsequenceIds.push(consequence.id);
        // Intentionally do NOT auto-resolve: theft alone does not meet resolution_conditions.
      }

      // ── 5. Update the CharacterAction (final, links records) ────────────
      await base44.asServiceRole.entities.SimCharacterAction.update(action.id, {
        status: actionStatus,
        outcome,
        execution_tick: currentTick,
        resulting_state_change_ids: createdStateChangeIds,
        resulting_observation_ids: createdObservationIds,
      });
    } else {
      // Failure path: no objective change; record outcome only.
      await base44.asServiceRole.entities.SimCharacterAction.update(action.id, {
        status: actionStatus,
        outcome,
        execution_tick: currentTick,
      });
    }

    return Response.json({
      resolver_status: 'resolved',
      action_outcome: outcome,
      action_status: actionStatus,
      precondition_results: preconditionResults,
      created_state_change_ids: createdStateChangeIds,
      created_observation_ids: createdObservationIds,
      created_consequence_ids: createdConsequenceIds,
      objective_state: {
        asset: updatedAsset ? {
          id: updatedAsset.id,
          name: updatedAsset.name,
          current_holder_id: updatedAsset.current_holder_id,
          current_location_id: updatedAsset.current_location_id,
        } : null,
      },
      errors: [],
    });
  } catch (error) {
    console.error('actionResolver error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});