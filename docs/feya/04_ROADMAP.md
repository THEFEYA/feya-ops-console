# FEYA — Roadmap (Phases)

## Phase A — Stability ✓

- [x] Schema drift guardrails (stage/outcome/updated_at)
- [x] Stable funnel views (lead_outcomes append-only, v_lead_current_stage, v_lead_ever_stage)
- [x] Batch fetching for inbox stage badges
- [x] Single source of truth for stages (lib/domain/stage.ts)
- [x] Russian-first UI enforced

## Phase B — Operational visibility ✓

- [x] Source health analytics ("Здоровье источников")
- [x] Stage velocity + bottleneck analytics ("Скорость воронки")
- [x] Deterministic action signals ("Что делать сейчас")

## Phase C — Manager action memory ← current

- [x] lead_actions table (planned/done/canceled, typed action_type)
- [x] API: GET + POST + PATCH for lead actions
- [x] Inbox panel: "Следующее действие" + action journal
- [ ] Queue view: all planned actions sorted by due_at
- [ ] Overdue alerts: surface past-due actions in inbox

## Phase D — Queue + SLA

- [ ] Manager queue page (all leads with planned actions)
- [ ] SLA rules: auto-flag overdue by action_type
- [ ] Daily digest: what requires attention today

## Phase E — Scenarios + Playbooks

- [ ] Action templates per lead_kind / source
- [ ] Guided flows ("next step" suggestion based on current stage)
- [ ] Scenario logs tied to lead_actions

## Phase F — AI layer (grounded)

- [ ] AI hints grounded in lead_actions memory + canon
- [ ] Contact extraction pipelines
- [ ] AI Copilot with DB context
- [ ] Decision → auto-policy feedback loop

## Rules for sequencing

- Do not build Phase N+1 before Phase N is validated in production.
- Each phase must have a clear "how to verify" before moving forward.
- Scripts, playbooks, and AI hints are Phase E/F — not current MVP.
