import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Information Network Resolver — Stages A + B.
// Stage A (Delayed Awareness): eligible StateChange → discovery Observation →
//   factual and hypothetical private Beliefs → Observation marked processed.
// Stage B1 (Communication Decision): a configured private belief → recorded
//   decision to communicate (deferred + scheduled tick + target recipient).
//   Creates NO claim, transmission, or receiver observation.
// Stage B2 (Controlled Transmission): a deferred belief whose scheduled tick
//   has arrived → create/recover the single Claim, single Transmission, single
//   pending receiver Observation, then flip the belief to communicated only
//   after all three are confirmed. The neighbour's Observation is left pending —
//   it is NOT processed into a Belief in this step (separate next stage).
// Stage C (Recipient Interpretation): a receiver's pending
//   communicated_information Observation → the recipient's own private Beliefs,
//   with a provenance split (a communication FACT "X said it" + a derived
//   HYPOTHESIS about the claim content). Creates no Claim/Transmission. The
//   observation flips to processed only after all intended Beliefs are confirmed.
//
// Idempotency is database-authoritative:
//   - Discovery Observation key: (source_state_change_id, observer_id, observation_source_type)
//   - Belief key: (source_observation_id, belief_type, belief_text)
//   - Belief communication_status: the authoritative guard for the decision/transmit state machine
//   - Claim key: (source_belief_id, claim_text)
//   - Transmission key: (claim_id, sender_id, receiver_id)
//   - Receiver Observation key: (source_transmission_id, observer_id, observation_source_type)
//   - Recipient Belief key: (source_observation_id, belief_type, belief_text)
// Both DISCOVERY_CONFIG, COMMUNICATION_CONFIG, and RECIPIENT_INTERPRETATION_CONFIG
// are IMMUTABLE scenario configuration. They carry no mutable state — if
// persistent trigger state is ever needed it must become a stored entity/field,
// never a mutable code constant.

// ── Immutable Discovery Configuration (seeded Subura ledger scenario) ────────
const DISCOVERY_CONFIG = [
  {
    config_id: 'subura_ledger_missing',
    session_id: '6a5951f3c51da337ffeba70c',
    simulation_run_id: 'subura_run_1',
    source_state_change_id: '6a59522cb4607865e655837b',
    eligible_discoverer_id: '6a5951f4283a447a745239fd', // Gaius the Grain Merchant
    available_from_tick: 5,
    expected_entity_state: {
      entity_type: 'asset',
      entity_id: '6a5951f4ec682bb881dfecfc', // Grain Merchant's Ledger
      expected_location_id: '6a5951f48845d07252f14a24', // shop counter
      expected_holder_id: null,
    },
    discovery_condition: 'merchant returns to shop and inspects counter',
    observation_text: 'The ledger is missing from the counter.',
    fact_belief: {
      belief_text: 'The ledger is missing from the counter.',
      belief_type: 'fact',
      confidence: 0.9,
      source: 'observation',
    },
    hypothesis_belief: {
      belief_text: 'Someone took the ledger.',
      belief_type: 'hypothesis',
      confidence: 0.3,
      source: 'inference',
    },
  },
];

// ── Immutable Communication Configuration (Stage B — seeded Subura scenario) ──
// Same immutability discipline as DISCOVERY_CONFIG. The belief's
// communication_status, the Claim, the Transmission, and the receiver
// Observation are the authoritative idempotency AND recovery state — the
// resolver reuses any earlier record that already exists and continues.
const COMMUNICATION_CONFIG = [
  {
    config_id: 'gaius_tells_cassia_ledger_missing',
    session_id: '6a5951f3c51da337ffeba70c',
    simulation_run_id: 'subura_run_1',
    source_belief_id: '6a59557e6928eec0d220a71d',   // Gaius's factual belief: "The ledger is missing from the counter."
    originator_id: '6a5951f4283a447a745239fd',       // Gaius the Grain Merchant (configured sender)
    target_recipient_id: '6a595655a59df7b4b6c6f553', // Cassia the Baker (controlled recipient)
    claim_text: 'The ledger is missing from the counter.',
    claim_type: 'fact',
    subject_character_ids: [],                       // Gaius does not yet know WHO — his hypothesis is private
    communication_scheduled_tick: 6,                 // belief formed tick 5; transmission eligible tick 6
    mutation: 'none',                                 // first transmission, unmutated
  },
];

// ── Immutable Recipient Interpretation Configuration (Stage C) ───────────────
// Same immutability discipline. Provenance rule: the recipient did NOT observe
// the claim's content directly — they observed the originator communicating it.
// So the recipient's first fact is about the ACT of communication ("X said …"),
// not the claim content. A separate derived hypothesis reasons about the content
// at lower confidence. The recipient is never given the claim's asserted fact as
// their own direct knowledge.
const RECIPIENT_INTERPRETATION_CONFIG = [
  {
    config_id: 'cassia_interprets_gaius_ledger_missing',
    session_id: '6a5951f3c51da337ffeba70c',
    simulation_run_id: 'subura_run_1',
    receiver_id: '6a595655a59df7b4b6c6f553', // Cassia the Baker
    source_claim_text: 'The ledger is missing from the counter.', // identifies the communication by claim text (no runtime id)
    interpretation_eligibility_tick: 7, // received tick 6; interprets tick 7 (one tick of deliberation)
    fact_belief: {
      belief_text: 'Gaius says his ledger is missing from the counter.',
      belief_type: 'fact',
      confidence: 0.9,
      source: 'communication',
    },
    hypothesis_belief: {
      belief_text: "Gaius's ledger may be missing.",
      belief_type: 'hypothesis',
      confidence: 0.4,
      source: 'inference',
    },
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const session_id = body.session_id;
    const simulation_run_id = body.simulation_run_id || null;
    if (!session_id) return Response.json({ error: 'session_id required' }, { status: 400 });

    // ── Ownership / auth (admin bypass, mirrors actionResolver) ──────────────
    const session = await base44.asServiceRole.entities.StorySession.get(session_id).catch(() => null);
    const adminEmail = (Deno.env.get('ADMIN_EMAIL') || '').toLowerCase().trim();
    const fullUser = await base44.asServiceRole.entities.User.filter({ email: user.email }).then(r => r[0]).catch(() => null);
    const isAdmin = (fullUser?.role || user.role) === 'admin' || (user.email || '').toLowerCase().trim() === adminEmail;
    if (session && session.user_email && session.user_email !== user.email && !isAdmin) {
      return Response.json({ error: 'Not your session' }, { status: 403 });
    }

    // ── Determine current tick (SimWorldTime, or body override for testing) ──
    const worldTimeRecords = await base44.asServiceRole.entities.SimWorldTime
      .filter({ session_id, simulation_run_id });
    const worldTime = worldTimeRecords[0] || null;
    const currentTick = body.current_tick ?? worldTime?.current_tick ?? 0;

    const createdObservationIds = [];
    const createdBeliefIds = [];
    const skipped = [];
    const errors = [];

    // ── Process each eligible, immutable discovery rule ─────────────────────
    for (const cfg of DISCOVERY_CONFIG) {
      // Match this config entry to the requested session/run
      if (cfg.session_id !== session_id) continue;
      if (simulation_run_id && cfg.simulation_run_id && cfg.simulation_run_id !== simulation_run_id) continue;

      // Eligibility: available_from_tick must have arrived
      if (cfg.available_from_tick > currentTick) {
        skipped.push({ config_id: cfg.config_id, reason: 'not_yet_eligible', available_from_tick: cfg.available_from_tick, current_tick: currentTick });
        continue;
      }

      // Validate the linked StateChange exists and belongs to this session/run
      const stateChange = await base44.asServiceRole.entities.SimStateChange
        .get(cfg.source_state_change_id).catch(() => null);
      if (!stateChange || stateChange.session_id !== session_id) {
        skipped.push({ config_id: cfg.config_id, reason: 'state_change_not_found_or_mismatched' });
        continue;
      }

      // ── Idempotency 1: discovery Observation key ───────────────────────────
      // (source_state_change_id, observer_id, observation_source_type)
      // Several characters may independently discover the same StateChange;
      // the key is per-observer, so the same observer cannot discover twice.
      const existingObs = await base44.asServiceRole.entities.SimObservation.filter({
        session_id,
        source_state_change_id: cfg.source_state_change_id,
        observer_id: cfg.eligible_discoverer_id,
        observation_source_type: 'discovered_state_change',
      });
      if (existingObs.length > 0) {
        skipped.push({ config_id: cfg.config_id, reason: 'already_discovered', observation_id: existingObs[0].id });
        continue;
      }

      // ── Create the discovery Observation ──────────────────────────────────
      let observation;
      try {
        observation = await base44.asServiceRole.entities.SimObservation.create({
          session_id,
          simulation_run_id,
          observer_id: cfg.eligible_discoverer_id,
          observation_source_type: 'discovered_state_change',
          source_state_change_id: cfg.source_state_change_id,
          observation_tick: currentTick,
          is_understood: true,
          understanding_description: cfg.observation_text,
          available_from_tick: currentTick,
          processing_status: 'pending',
        });
        createdObservationIds.push(observation.id);
      } catch (e) {
        errors.push({ config_id: cfg.config_id, step: 'create_observation', message: e.message });
        continue;
      }

      // ── Create the two private Beliefs (fact + hypothesis) ────────────────
      // Idempotency 2: belief key (source_observation_id, belief_type, belief_text).
      // Checked before EACH belief so a partial write (fact created, hypothesis
      // failed) cannot duplicate the fact on retry.
      const beliefSpecs = [cfg.fact_belief, cfg.hypothesis_belief];
      let bothBeliefsConfirmed = true;
      for (const spec of beliefSpecs) {
        const existingBelief = await base44.asServiceRole.entities.SimBelief.filter({
          session_id,
          source_observation_id: observation.id,
          belief_type: spec.belief_type,
          belief_text: spec.belief_text,
        });
        if (existingBelief.length > 0) {
          // Already exists from a prior partial run — record, do not duplicate.
          createdBeliefIds.push(existingBelief[0].id);
          continue;
        }
        try {
          const belief = await base44.asServiceRole.entities.SimBelief.create({
            session_id,
            simulation_run_id,
            character_id: cfg.eligible_discoverer_id,
            belief_text: spec.belief_text,
            belief_type: spec.belief_type,
            confidence: spec.confidence,
            source: spec.source,
            source_observation_id: observation.id,
            created_tick: currentTick,
          });
          createdBeliefIds.push(belief.id);
        } catch (e) {
          bothBeliefsConfirmed = false;
          errors.push({ config_id: cfg.config_id, step: 'create_belief', belief_type: spec.belief_type, message: e.message });
        }
      }

      // ── Mark the Observation processed ONLY after both Beliefs are confirmed ─
      if (bothBeliefsConfirmed) {
        try {
          await base44.asServiceRole.entities.SimObservation.update(observation.id, {
            processing_status: 'processed',
          });
        } catch (e) {
          errors.push({ config_id: cfg.config_id, step: 'mark_processed', observation_id: observation.id, message: e.message });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Stage B1 — Communication Decision (separate, auditable substep)
    // For each eligible private belief in COMMUNICATION_CONFIG: record the
    // decision to communicate. Creates NO claim, transmission, or observation.
    // ═══════════════════════════════════════════════════════════════════════
    const b1 = { updated_belief_ids: [], skipped: [], errors: [] };
    for (const cfg of COMMUNICATION_CONFIG) {
      if (cfg.session_id !== session_id) continue;
      if (simulation_run_id && cfg.simulation_run_id && cfg.simulation_run_id !== simulation_run_id) continue;

      const sourceBelief = await base44.asServiceRole.entities.SimBelief
        .get(cfg.source_belief_id).catch(() => null);
      if (!sourceBelief || sourceBelief.session_id !== session_id) {
        b1.skipped.push({ config_id: cfg.config_id, reason: 'source_belief_not_found_or_mismatched' });
        continue;
      }

      // Verify the configured sender owns the belief.
      if (sourceBelief.character_id !== cfg.originator_id) {
        b1.skipped.push({ config_id: cfg.config_id, reason: 'sender_does_not_own_belief', belief_holder: sourceBelief.character_id, configured_sender: cfg.originator_id });
        continue;
      }

      // A belief that predates the schema addition has null communication_status;
      // treat null as not_evaluated.
      const b1Status = sourceBelief.communication_status ?? 'not_evaluated';

      // Only an un-decided belief can enter the decision step.
      if (b1Status !== 'not_evaluated') {
        b1.skipped.push({ config_id: cfg.config_id, reason: 'already_decided', communication_status: b1Status });
        continue;
      }

      // The decision is eligible from the belief's formation tick onward.
      const decisionEligibleTick = sourceBelief.created_tick ?? 0;
      if (decisionEligibleTick > currentTick) {
        b1.skipped.push({ config_id: cfg.config_id, reason: 'decision_not_yet_eligible', belief_created_tick: decisionEligibleTick, current_tick: currentTick });
        continue;
      }

      // Verify the recipient exists in the same session + run.
      const recipient = await base44.asServiceRole.entities.SimCharacter
        .get(cfg.target_recipient_id).catch(() => null);
      if (!recipient || recipient.session_id !== session_id || recipient.simulation_run_id !== simulation_run_id) {
        b1.skipped.push({ config_id: cfg.config_id, reason: 'recipient_not_found_or_mismatched' });
        continue;
      }

      // Record the decision — defer the actual transmission until the scheduled tick.
      try {
        await base44.asServiceRole.entities.SimBelief.update(sourceBelief.id, {
          communication_status: 'deferred',
          communication_scheduled_tick: cfg.communication_scheduled_tick,
          target_recipient_id: cfg.target_recipient_id,
        });
        b1.updated_belief_ids.push(sourceBelief.id);
      } catch (e) {
        b1.errors.push({ config_id: cfg.config_id, step: 'b1_decision', message: e.message });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Stage B2 — Controlled Transmission (separate, auditable substep)
    // For each deferred belief whose scheduled tick has arrived: create or
    // recover the single Claim, the single Transmission, and the single pending
    // receiver Observation, then flip the belief to communicated ONLY after all
    // three are confirmed. Each record is recovered independently so a partial
    // write resumes without duplication.
    // ═══════════════════════════════════════════════════════════════════════
    const b2 = {
      created_claim_ids: [], recovered_claim_ids: [],
      created_transmission_ids: [], recovered_transmission_ids: [],
      created_observation_ids: [], recovered_observation_ids: [],
      updated_belief_ids: [], skipped: [], errors: [],
    };
    for (const cfg of COMMUNICATION_CONFIG) {
      if (cfg.session_id !== session_id) continue;
      if (simulation_run_id && cfg.simulation_run_id && cfg.simulation_run_id !== simulation_run_id) continue;

      const sourceBelief = await base44.asServiceRole.entities.SimBelief
        .get(cfg.source_belief_id).catch(() => null);
      if (!sourceBelief || sourceBelief.session_id !== session_id) {
        b2.skipped.push({ config_id: cfg.config_id, reason: 'source_belief_not_found_or_mismatched' });
        continue;
      }
      const b2Status = sourceBelief.communication_status ?? 'not_evaluated';

      // Only a deferred belief with a scheduled tick that has arrived transmits.
      if (b2Status === 'communicated') {
        b2.skipped.push({ config_id: cfg.config_id, reason: 'already_communicated' });
        continue;
      }
      if (b2Status !== 'deferred') {
        b2.skipped.push({ config_id: cfg.config_id, reason: 'not_deferred', communication_status: b2Status });
        continue;
      }
      const scheduledTick = sourceBelief.communication_scheduled_tick ?? cfg.communication_scheduled_tick;
      if (scheduledTick > currentTick) {
        b2.skipped.push({ config_id: cfg.config_id, reason: 'transmission_not_yet_eligible', communication_scheduled_tick: scheduledTick, current_tick: currentTick });
        continue;
      }
      if (sourceBelief.target_recipient_id !== cfg.target_recipient_id) {
        b2.skipped.push({ config_id: cfg.config_id, reason: 'recipient_mismatch', belief_target: sourceBelief.target_recipient_id, configured_target: cfg.target_recipient_id });
        continue;
      }

      // ── (1) Claim: create or recover via key (source_belief_id, claim_text) ──
      let claim;
      const existingClaim = await base44.asServiceRole.entities.SimClaim.filter({
        session_id,
        source_belief_id: cfg.source_belief_id,
        claim_text: cfg.claim_text,
      });
      if (existingClaim.length > 0) {
        claim = existingClaim[0];
        b2.recovered_claim_ids.push(claim.id);
      } else {
        try {
          claim = await base44.asServiceRole.entities.SimClaim.create({
            session_id,
            simulation_run_id,
            claim_text: cfg.claim_text,
            claim_type: cfg.claim_type,
            originator_id: cfg.originator_id,
            source_belief_id: cfg.source_belief_id,
            subject_character_ids: cfg.subject_character_ids,
            created_tick: currentTick,
            mutation_count: 0,
          });
          b2.created_claim_ids.push(claim.id);
        } catch (e) {
          b2.errors.push({ config_id: cfg.config_id, step: 'b2_create_claim', message: e.message });
          continue;
        }
      }

      // ── (2) Transmission: create or recover via key (claim_id, sender_id, receiver_id) ──
      let transmission;
      const existingTransmission = await base44.asServiceRole.entities.SimInformationTransmission.filter({
        session_id,
        claim_id: claim.id,
        sender_id: cfg.originator_id,
        receiver_id: cfg.target_recipient_id,
      });
      if (existingTransmission.length > 0) {
        transmission = existingTransmission[0];
        b2.recovered_transmission_ids.push(transmission.id);
      } else {
        try {
          transmission = await base44.asServiceRole.entities.SimInformationTransmission.create({
            session_id,
            simulation_run_id,
            claim_id: claim.id,
            sender_id: cfg.originator_id,
            receiver_id: cfg.target_recipient_id,
            transmission_tick: currentTick,
            original_claim_text: cfg.claim_text,
            transmitted_claim_text: cfg.claim_text,
            mutation_type: cfg.mutation,
          });
          b2.created_transmission_ids.push(transmission.id);
        } catch (e) {
          b2.errors.push({ config_id: cfg.config_id, step: 'b2_create_transmission', message: e.message });
          continue;
        }
      }

      // ── (3) Receiver Observation: create or recover via key (source_transmission_id, observer_id, observation_source_type) ──
      let receiverObs;
      const existingReceiverObs = await base44.asServiceRole.entities.SimObservation.filter({
        session_id,
        source_transmission_id: transmission.id,
        observer_id: cfg.target_recipient_id,
        observation_source_type: 'communicated_information',
      });
      if (existingReceiverObs.length > 0) {
        receiverObs = existingReceiverObs[0];
        b2.recovered_observation_ids.push(receiverObs.id);
      } else {
        try {
          receiverObs = await base44.asServiceRole.entities.SimObservation.create({
            session_id,
            simulation_run_id,
            observer_id: cfg.target_recipient_id,
            observation_source_type: 'communicated_information',
            source_transmission_id: transmission.id,
            observation_tick: currentTick,
            is_understood: false,        // the recipient has not yet interpreted it
            understanding_description: null,
            available_from_tick: currentTick,
            processing_status: 'pending', // NOT processed — interpreting it is a separate next stage
          });
          b2.created_observation_ids.push(receiverObs.id);
        } catch (e) {
          b2.errors.push({ config_id: cfg.config_id, step: 'b2_create_receiver_observation', message: e.message });
          continue;
        }
      }

      // ── (4) Flip belief to communicated ONLY after all three records are confirmed ──
      try {
        await base44.asServiceRole.entities.SimBelief.update(sourceBelief.id, {
          communication_status: 'communicated',
        });
        b2.updated_belief_ids.push(sourceBelief.id);
      } catch (e) {
        b2.errors.push({ config_id: cfg.config_id, step: 'b2_mark_communicated', message: e.message });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Stage C — Recipient Interpretation
    // For each receiver's pending communicated_information Observation whose
    // interpretation tick has arrived: create the recipient's private Belief(s)
    // — a communication FACT ("X said …") and a derived HYPOTHESIS about the
    // content — then mark the Observation processed only after all intended
    // Beliefs are confirmed. Creates no Claim/Transmission.
    // ═══════════════════════════════════════════════════════════════════════
    const c = { created_belief_ids: [], recovered_belief_ids: [], updated_observation_ids: [], skipped: [], errors: [] };
    for (const cfg of RECIPIENT_INTERPRETATION_CONFIG) {
      if (cfg.session_id !== session_id) continue;
      if (simulation_run_id && cfg.simulation_run_id && cfg.simulation_run_id !== simulation_run_id) continue;

      // Eligibility: the interpretation tick must have arrived.
      if (cfg.interpretation_eligibility_tick > currentTick) {
        c.skipped.push({ config_id: cfg.config_id, reason: 'interpretation_not_yet_eligible', interpretation_eligibility_tick: cfg.interpretation_eligibility_tick, current_tick: currentTick });
        continue;
      }

      // Locate the matching Transmission to this receiver (by claim text), then
      // the receiver's pending communicated_information Observation for it.
      const transmissionsToReceiver = await base44.asServiceRole.entities.SimInformationTransmission.filter({
        session_id,
        receiver_id: cfg.receiver_id,
      });
      const matchingTransmission = transmissionsToReceiver.find(t => t.original_claim_text === cfg.source_claim_text);
      if (!matchingTransmission) {
        c.skipped.push({ config_id: cfg.config_id, reason: 'no_matching_transmission' });
        continue;
      }

      const receiverObsList = await base44.asServiceRole.entities.SimObservation.filter({
        session_id,
        observer_id: cfg.receiver_id,
        observation_source_type: 'communicated_information',
        source_transmission_id: matchingTransmission.id,
      });
      if (receiverObsList.length === 0) {
        c.skipped.push({ config_id: cfg.config_id, reason: 'no_pending_observation' });
        continue;
      }
      const receiverObs = receiverObsList[0];

      // A processed observation is never re-interpreted.
      if (receiverObs.processing_status === 'processed') {
        c.skipped.push({ config_id: cfg.config_id, reason: 'already_processed', observation_id: receiverObs.id });
        continue;
      }

      // The observation's own latency floor must also be respected.
      const obsEligible = receiverObs.available_from_tick ?? receiverObs.observation_tick ?? 0;
      if (obsEligible > currentTick) {
        c.skipped.push({ config_id: cfg.config_id, reason: 'observation_not_yet_available', available_from_tick: obsEligible, current_tick: currentTick });
        continue;
      }

      // Create/recover the recipient's private Beliefs. Key per belief:
      // (source_observation_id, belief_type, belief_text). Checked before EACH
      // belief so a partial write (fact created, hypothesis failed) cannot
      // duplicate the fact on retry. Beliefs stay private: no communication_status
      // decision, no target_recipient_id, no communication_scheduled_tick.
      const beliefSpecs = [cfg.fact_belief, cfg.hypothesis_belief];
      let allBeliefsConfirmed = true;
      for (const spec of beliefSpecs) {
        const existingBelief = await base44.asServiceRole.entities.SimBelief.filter({
          session_id,
          source_observation_id: receiverObs.id,
          belief_type: spec.belief_type,
          belief_text: spec.belief_text,
        });
        if (existingBelief.length > 0) {
          c.recovered_belief_ids.push(existingBelief[0].id);
          continue;
        }
        try {
          const belief = await base44.asServiceRole.entities.SimBelief.create({
            session_id,
            simulation_run_id,
            character_id: cfg.receiver_id,
            belief_text: spec.belief_text,
            belief_type: spec.belief_type,
            confidence: spec.confidence,
            source: spec.source,
            source_observation_id: receiverObs.id,
            created_tick: currentTick,
          });
          c.created_belief_ids.push(belief.id);
        } catch (e) {
          allBeliefsConfirmed = false;
          c.errors.push({ config_id: cfg.config_id, step: 'c_create_belief', belief_type: spec.belief_type, message: e.message });
        }
      }

      // Mark the Observation processed ONLY after all intended Beliefs are confirmed.
      if (allBeliefsConfirmed) {
        try {
          await base44.asServiceRole.entities.SimObservation.update(receiverObs.id, {
            processing_status: 'processed',
          });
          c.updated_observation_ids.push(receiverObs.id);
        } catch (e) {
          c.errors.push({ config_id: cfg.config_id, step: 'c_mark_processed', observation_id: receiverObs.id, message: e.message });
        }
      }
    }

    return Response.json({
      resolver_status: 'run_complete',
      current_tick: currentTick,
      stage_a: {
        created_observation_ids: createdObservationIds,
        created_belief_ids: createdBeliefIds,
        skipped,
        errors,
      },
      stage_b1_decision: b1,
      stage_b2_transmission: b2,
      stage_c_recipient_interpretation: c,
    });
  } catch (error) {
    console.error('informationNetworkResolver error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});