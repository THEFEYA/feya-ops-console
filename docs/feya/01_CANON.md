# FEYA — Canon (Source of Truth)

## 0) What FEYA is (in one line)

FEYA is a signal-driven leadgen OS for event-driven fashion expression — capture intent → qualify → extract people → outreach.

## 1) Core principle: "actionable-first"

A lead is not a page. A lead is an actionable entity with a plausible path to contact.

If we cannot reach anyone, the object is either:
- (A) a monitor-only candidate (watchlist), or
- (B) a precursor to an extraction task (thread → person).

## 2) Entity model (canonical)

### Query

Represents an intent hypothesis and its operational parameters (source, purpose, event context).

### Lead

A discovered candidate entity.

Must include:
- lead_kind: page | thread | person | org | venue | vendor
- source_slug / source_platform / source_family
- score + score parts (intent, reach, freshness)
- event tag (optional)
- persona tag (optional)
- parent_lead_id (optional)
- status/stage (operational)

### Task

An action that the system requests from operator or automation:
- review
- extract_people
- outreach_person
- enrich_contact
- domain_rule_update
- etc.

### Decision log (operator truth)

What the human decided and why. This becomes training signal.

## 3) Pipeline (validated operational path)

SERP / Reddit / Places / OSM / Forum threads
→ normalize + hard-gate (negative/domain/irrelevant/noise)
→ create review tasks
→ if thread-like → extract people tasks
→ if person found → outreach queue tasks
→ digest only for actionable items

## 4) Gate vs Score (must be separated)

### Hard gate first (stop early)

Examples:
- forbidden/negative
- domain blocked
- irrelevant to purpose
- stale/noisy pattern
- cannot extract people AND no contact path

### Score second (prioritize)

Intent score, reach score, freshness score, event relevance, business value.

### Action policy third

- create task
- monitor
- discard

## 5) B2C vs B2B must be separate tracks

B2C: event prep, outfit buying, "where to buy", commission, custom.
B2B: organizer/vendor/procurement/wardrobe sourcing — must avoid job noise.

## 6) Source-of-truth hierarchy

1) This Canon (docs/feya/01_CANON.md)
2) Working rules (docs/feya/02_WORKING_RULES.md)
3) Current state (docs/feya/03_CURRENT_STATE.md)
4) Decisions log (docs/feya/05_DECISIONS.md)
5) Everything else is supportive/appendix.
