# FEYA — Current State (Baseline)

## What works now

- Ops Console UI exists (Flow / Inbox / Analytics / Control).
- Lead sources: SERP, OSM Overpass, Reddit RSS, Places (in progress).
- Lead kinds: page/thread/person emerging.
- Inbox has enriched views and explain blocks.
- Analytics has rollup-based charts + funnel block.

## Current bottlenecks

- Contact extraction incomplete for many lead kinds.
- Stage logging and funnel metrics recently stabilized (stage vs outcome drift).
- Need strict canon so changes don't conflict.

## Near-term priorities

1) Stabilize lead_outcomes (stage history + batch fetch + views).
2) Build funnel_by_event + funnel_by_persona (so conversion respects filters).
3) Improve explainability: RU reasons, contact path, next action.
4) Lock the canon into GitHub docs.
