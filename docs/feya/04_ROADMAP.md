# FEYA — Roadmap (Phases)

## Phase A — Stability ✓

- [x] Schema drift guardrails (stage/outcome/updated_at)
- [x] Stable funnel views
- [x] Batch fetching to avoid N+1
- [x] Observability control layer: unified run history + function registry + system status block
- [x] SERP runtime stabilization: error body capture + preflight validation + Russian error labels (edge fn v16)

## Phase B — Operational visibility ✓

- [x] Stage history views (v_lead_current_stage, v_lead_ever_stage, v_stage_transitions)
- [x] Stage velocity / bottleneck analytics
- [x] Source health analytics (Здоровье источников)
- [x] Schema contract + db-health endpoint

## Phase C — Manager action memory ← текущий

- [x] lead_actions table (DB migration applied)
- [x] API layer: GET / POST / PATCH /api/actions/lead-action
- [x] LeadDetailPanel: Следующее действие + Добавить действие + Журнал действий
- [x] Manager work queue: /queue page with 5 buckets + filter tabs + LeadDetailPanel integration

## Phase D — SLA & queue automation (следующий)

- [ ] SLA rules: escalation if action overdue > N days
- [ ] Manager assignment (auth.uid per action)
- [ ] Auto-create follow_up on stage change
- [ ] Push notifications for overdue actions
- [ ] Bulk status update

## Phase E — Conversion & Learning loop

- [ ] Conversion by source/event/persona
- [ ] Precision/noise dashboards
- [ ] Decision logging -> training signal

## Phase F — Automation

- [ ] Contact extraction pipelines
- [ ] Outreach queue + templates
- [ ] AI Copilot grounded in DB + canon
