# FEYA — Working Rules (How we work)

## Prime directive

Every change must make the system:
- more stable,
- more explainable,
- more actionable,
- less noisy.

## Rule 1: One source of truth

Canonical logic lives in docs/feya.
Supabase is runtime data, not documentation.

## Rule 2: Never "fix UI" without fixing meaning

UI reflects truth in DB. If it looks right but is wrong — it's a bug.

## Rule 3: Always protect against schema drift

Before using any column in code:
- verify it exists in DB views/tables,
- handle fallback,
- never assume `updated_at` exists,
- never assume `outcome` vs `stage` naming.

## Rule 4: Small PRs, layered rollout

One PR = one coherent goal.
No "mega PRs" mixing analytics + inbox + db schema unless unavoidable.

## Rule 5: Hard-gate before score

Noise must be cut before any clever scoring.

## Rule 6: Explainability is a product feature

Every lead should answer:
- Why is it a lead?
- What signal triggered it?
- What next action is suggested?

## Rule 7: Evaluation loop

We track:
- precision by source
- % leads with contact path
- % threads that produce people
- conversion by stage
- top noisy keywords/domains

## Rule 8: Decisions become training data

Human decisions must be logged (why approved/rejected).
This becomes future auto-policy.

## Rule 9: Russian-first UI

All operator-facing labels, buttons, table headers, toasts, and placeholders must be in Russian.
Internal identifiers (DB column names, API fields, TypeScript identifiers) may be English.
Rule: if a string is visible in the browser to an operator — it must be Russian.

## Rule 10: Build memory before automation

Correct order of layers:
1. **Memory** — record what happened, what is planned (current MVP)
2. **Queue + SLA** — surface what is overdue, what to do next
3. **Scenarios** — guided flows and playbooks
4. **AI hints** — grounded in memory + canon, not speculation

Do not skip ahead. Build and validate each layer before the next.
