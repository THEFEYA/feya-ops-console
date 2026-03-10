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

### Manager Action (оперативный слой памяти)

A human-created action record tied to a specific lead.
Represents what the manager plans to do or has done — not automation.

Must include:
- action_type: research | contact | follow_up | meeting | proposal | close
- action_status: planned | done | canceled
- lead_id (FK → leads)
- optional: note, due_at, done_at, actor_label

Manager actions are the first layer of human memory. They answer:
"Что мы уже пробовали с этим лидом? Что запланировано на сейчас?"

Scripts, playbooks, and smart hints are future layers built on top of this memory —
they are NOT part of the current MVP.

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

## 6) UI language rule

All operator-facing UI text must be in Russian.
Internal identifiers (DB column names, API field names, TypeScript type values) may remain English.
If a string is visible in the browser — it must be Russian.

## 7) Source-of-truth hierarchy

1) This Canon (docs/feya/01_CANON.md)
2) Working rules (docs/feya/02_WORKING_RULES.md)
3) Current state (docs/feya/03_CURRENT_STATE.md)
4) Decisions log (docs/feya/05_DECISIONS.md)
5) Schema contract (docs/feya/06_SCHEMA_CONTRACT.md)
6) Everything else is supportive/appendix.
