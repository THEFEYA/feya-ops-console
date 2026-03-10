# FEYA — Current State (Baseline)

## What works now

- Ops Console UI exists (Flow / Inbox / Analytics / Control).
- Lead sources: SERP, OSM Overpass, Reddit RSS, Places (in progress).
- Lead kinds: page/thread/person emerging.
- Inbox has enriched views, explain blocks, and stage controls.
- Analytics has rollup-based charts + funnel block + source health table ("Здоровье источников").
- Stage history: `lead_outcomes` is append-only; views `v_lead_current_stage` / `v_lead_ever_stage` / `v_stage_transitions` available.
- Schema contract locked in `lib/domain/stage.ts` (single source of truth for stages).
- All operator-facing UI is Russian-first (Rule 9).
- Manager action memory: `lead_actions` table + API + panel section in Inbox.

## Current bottlenecks

- Contact extraction incomplete for many lead kinds.
- No queue / SLA view yet (next phase).
- No playbooks or AI hints yet (future phase).
- Funnel views don't yet respect event/persona filters.

## Near-term priorities

1) Manager action memory in active use — validate that managers log actions.
2) Queue + SLA: surface overdue actions, "what to work on now".
3) Funnel by event + persona filters.
4) Improve explainability: RU reasons, contact path, next action.
