# Architecture Contract — Story Blocks Simulation Engine

> **This document is permanent and authoritative.** It records the finalized
> architecture for the Story Blocks simulation engine. Every implementation
> step must remain consistent with this contract. Any proposed deviation must
> be explicitly identified and approved before implementation.

---

## 1. Purpose of the System

Story Blocks is transitioning from **narrative-first generation** to a
**state-driven narrative simulation**.

The world is modeled as an independent simulation that evolves through
character actions, delayed consequences, and information propagation. The
narrative layer (Story Blocks) observes and dramatizes the simulation's
state — it does not own world continuity.

---

## 2. The Finalized Five Spheres

| # | Sphere | Role |
|---|-------|------|
| 1 | **Objective Registry** | The current factual truth of the world: locations, characters, assets, physical relationships, and the simulation clock. |
| 2 | **Active Situations** | Persistent, evolving processes (debts, investigations, threats) that have their own escalation and resolution logic. They persist independently of whether they appear in a Story Block. |
| 3 | **Subjective Interpretation** | Character-specific perception: beliefs, goals, intentions, and emotional states. Character beliefs may differ from objective truth. |
| 4 | **Socially Distributed Information** | The transmission network: claims, rumours, reputation, and public sentiment — tracking how information flows and mutates between characters and groups. |
| 5 | **Narrative Director** | The reader/orchestrator that evaluates the simulation state and selects which consequences are most valuable to dramatize. It reads state but does not own world continuity. |

---

## 3. Cross-Sphere Systems

These systems operate *across* the spheres and are not contained within any
single sphere:

| System | Responsibility |
|--------|---------------|
| **Character Action** | A cross-sphere transaction initiated by a character. It is **not** an Active Situation. It bridges a character's intention and an objective consequence. |
| **Action Resolver** | Validates physical/temporal preconditions, resolves success/failure/interruption, identifies immediate witnesses, generates objective state changes, creates Observation records, and updates directly affected Active Situations. Handles **direct, immediate** consequences only. |
| **State Change & Consequence** | The transaction log produced by resolved actions. State Change records objective mutations; Consequence records the impact on Active Situations. |
| **Observation** | A record that a witness perceived an action, a state change, or a condition. An observation creates **private knowledge** for the witness — it does **not** automatically become socially distributed. |
| **Information Network Resolver** | Operates separately from the Action Resolver and may run during **later** simulation ticks. Determines whether an observation is understood, what belief it creates, whether and when the character communicates it, who receives it, how the claim mutates, whether it becomes a rumour, and whether it affects reputation. Handles **delayed** discovery, communication, claim mutation, rumours, and reputation. |
| **Simulation Tick** | Orchestrates both resolvers and the advance of time. It does not collapse their responsibilities into one operation. |

---

## 4. Responsibility Boundaries

1. **CharacterAction is not an ActiveSituation.** It is a cross-sphere transaction that may affect one or several Active Situations but is not itself a persistent situation.
2. **The Action Resolver handles direct physical and immediate consequences only.** It does not process delayed discovery, communication, or social propagation.
3. **The Information Network Resolver handles delayed discovery, communication, claim mutation, rumours, and reputation.** It operates on Observation records and may run ticks after the action was resolved.
4. **The Narrative Director reads the simulation state but does not own world continuity.** It selects and dramatizes; it does not mutate objective truth.
5. **Active Situations persist independently of whether they are shown in a Story Block.** The simulation runs even when the narrative camera is elsewhere.
6. **The Objective Registry contains the current factual truth.** It is the single source of "what actually happened."
7. **Character beliefs may differ from that truth.** The Subjective sphere is allowed to be wrong; this is a feature, not a bug.

---

## 5. The Action Lifecycle

```
1. Action Proposal      — A character forms an intention based on goals, beliefs, and current pressures.
2. Preconditions Check — The system verifies location, time, access, assets, witnesses, and physical constraints.
3. Action Resolution    — The system determines success, partial success, failure, or interruption.
4. Objective Changes    — Objects move, access changes, characters relocate, evidence is created or removed.
5. Situation Updates    — Relevant Active Situations advance, regress, escalate, branch, or remain unchanged.
6. Subjective Updates   — The actor and witnesses gain knowledge, revise beliefs, and experience emotional changes.
7. Information Propagation — Only communicated observations become claims, rumours, or public knowledge.
8. Narrative Evaluation — The Director evaluates the resulting state and selects which consequence is most valuable to dramatize next.
```

---

## 6. The Simulation Tick

The Simulation Tick orchestrates both resolvers while keeping them
independent:

```
1. Generate proposed character actions.        ← DEFERRED in Phase 1 (manual seeding)
2. Resolve executable actions.                 ← Action Resolver
3. Apply objective and situation changes.      ← Action Resolver
4. Create observations and subjective updates. ← Action Resolver
5. Process eligible information transmissions. ← Information Network Resolver
6. Advance time and active pressures.
7. Let the Narrative Director evaluate.       ← DEFERRED in Phase 1
```

---

## 7. Phase 1 Exclusion Rule

> **Anything excluded from the prototype is deferred, not removed from the
> architecture.**

Phase 1 tests simulation integrity through a controlled Subura scenario
(Aelia steals the grain merchant's ledger). The following are **deferred** for
Phase 1 but remain in the architecture:

| Deferred | Reason |
|----------|--------|
| Routine | Starting positions are initialized manually. |
| Rumour (as distinct from Claim) | Phase 1 only needs to reach the first private claim transmission. |
| Narrative Director | Phase 1 tests simulation integrity, not Story Block selection. |
| Group / Faction | Phase 1 operates at the individual character level. |
| Reputation / PublicSentiment | Phase 1 does not need aggregated social sentiment. |
| DynamicRelationshipState | Phase 1 uses static relationships. |
| Automatic character action proposal | Phase 1 actions are manually initialized. Simulation Tick step 1 (Generate proposed character actions) is replaced by manual seeding. |
| Goal / Intention as entities | Phase 1 actions are manually initialized with motivation fields on SimCharacterAction. Automatic proposal from goals and pressures is deferred. |
| Pressure / Deadline / EscalationStage / ResolutionCondition as separate entities | Phase 1 models these as fields within SimActiveSituation. |

**WorldTime is NOT deferred.** Delayed discovery and delayed communication
require at least a minimal simulation clock / tick timestamp.

---

## 8. Phase 1 Entity Set (Approved)

**Total: 12 entities** (4 Objective Registry + 1 Active Situations + 4
Subjective & Social + 3 Cross-sphere).

All entities link to the existing **StorySession** via a `session_id` field
rather than a free-form simulation identifier. An optional `simulation_run_id`
allows multiple independent runs within one session.

| Sphere | Entities |
|--------|----------|
| Objective Registry | SimCharacter, SimLocation, SimAsset, SimWorldTime |
| Active Situations | SimActiveSituation |
| Subjective & Social | SimObservation, SimBelief, SimClaim, SimInformationTransmission |
| Cross-sphere | SimCharacterAction, SimStateChange, SimConsequence |
| Systems (logic, not entities) | Action Resolver, Information Network Resolver, Simulation Tick |

### SimAsset Location Invariant

* **Unattended asset:** has `current_location_id` and **no** `current_holder_id`.
* **Held asset:** has `current_holder_id`, and its effective location is
  **inherited from the holder** — `current_location_id` is cleared or set to
  the holder's location.
* **After possession transfer:** the asset must **not** independently remain
  recorded inside its former container. The Action Resolver must update both
  `current_holder_id` and `current_location_id` atomically.

### SimObservation Source Model

An observation is **not limited** to witnessing a CharacterAction. It supports
multiple origins via `observation_source_type`:

* `direct_action` — witnessed a CharacterAction in progress (`source_action_id`).
* `discovered_state_change` — noticed a StateChange after the fact
  (`source_state_change_id`). E.g. merchant discovers the ledger is missing.
* `asset_condition` — noticed something about an asset's state
  (`source_entity_type` = "asset", `source_entity_id`).
* `character_condition` — noticed something about a character's state
  (`source_entity_type` = "character", `source_entity_id`).
* `communicated_information` — received information via a transmission
  (`source_transmission_id`).

An observation is **private knowledge** for the witness. It does **not**
automatically become a claim or rumour — that requires the Information
Network Resolver to process it and the witness to communicate it.

### Latency Model (available_from_tick)

Delayed discovery and delayed communication are modeled via `available_from_tick`:

* A **SimStateChange** occurs at `change_tick` but is only discoverable from
  `available_from_tick`.
* A **SimObservation** is created at `observation_tick` but is only eligible
  for Information Network Resolver processing from `available_from_tick`.
* The resolver checks `current_tick >= available_from_tick && processing_status == "pending"`.
  It does **not** hard-code a fixed delay — the gap is stored per record.

### Automatic Action Proposal (Deferred)

Phase 1 actions are **manually initialized**. The Simulation Tick step 1
(Generate proposed character actions) is replaced by manual seeding for this
prototype. Automatic proposal from goals and pressures is deferred.

---

## 8a. Phase 1 Known Limitations (Action Resolver)

These limitations were identified after the controlled ledger-theft test and
must be addressed before production use. They are recorded here so the
Information Network Resolver and future phases are not built on incorrect
assumptions.

### Limitation 1 — The action transaction is best-effort, not atomic

* The **SimAsset possession update is atomic**: `current_holder_id` and
  `current_location_id` are changed in a single update call, so the asset can
  never be left "in the shop and in Aelia's possession" simultaneously. The
  SimAsset location invariant is therefore atomically enforced.
* The **complete action transaction is currently best-effort**: the asset
  update, the `SimStateChange` creation, the immediate `SimObservation`
  creation, the `SimConsequence` creation, and the `SimCharacterAction` update
  are **separate** operations. The platform does not provide cross-entity
  transactions.
* Consequence: a failure **after** the asset mutation but **before** all audit
  records are created could leave incomplete transaction records (e.g. an
  asset transferred but no `SimStateChange` log).
* **True transaction handling, rollback, or recovery remains required before
  production use.** Phase 1 mitigates this via an idempotency guard on the
  action status, but does not guarantee full recovery from a partial write.

### Limitation 2 — The two-tick discovery delay is prototype configuration, not general behaviour

* The current Action Resolver hard-codes `available_from_tick = change_tick + 2`.
  This is **prototype configuration for the seeded ledger scenario only**, not
  a general rule that every possession transfer becomes discoverable exactly
  two ticks later.
* The future system must **derive discovery eligibility** from situational
  factors, such as:
  * the asset's expected location;
  * the owner's return or routine;
  * who is responsible for the asset;
  * whether the absence is visible;
  * location access;
  * inspection or inventory events.
* Until those factors are modeled, the delay must remain an explicit,
  scenario-specific configuration value, not an implicit Action Resolver
  constant.

### Limitation 3 — Direct-witness logic is provisional

* The current direct-witness rule — "every other character at the same
  location is an immediate observer" — is **provisional**.
* Physical presence alone does not guarantee that someone saw or understood an
  action. Visibility, attention, and obstruction are **deferred**.
* Until those factors are modeled, the witness set produced by the Action
  Resolver must be treated as a maximal candidate set, not a confirmed set of
  actual perceptions.

---

## 9. Implementation Discipline

At the beginning and end of every implementation step, restate:
- the current Phase 1 objective;
- which architectural responsibilities are being implemented;
- which responsibilities remain deliberately deferred;
- whether any proposed change conflicts with this Architecture Contract.

Do not expand the scope, rename the architectural responsibilities, or move
entities between spheres without explicitly identifying the change and
obtaining approval.