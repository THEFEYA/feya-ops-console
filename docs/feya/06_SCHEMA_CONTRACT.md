# FEYA — Schema Contract

> If the contract is violated — UI shows a warning (see `/api/debug/db-health`).

## Canonical table: `public.lead_outcomes`

Stores the full stage history for each lead (one row per stage change — NOT upsert).

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint / uuid | PK |
| `lead_id` | bigint / uuid | FK → `leads.id` |
| `stage` | text | one of the canonical stage values (see below) |
| `note` | text | optional, stored in meta or dedicated column |
| `created_at` | timestamptz | set on insert; **no `updated_at`** |

### Columns that do NOT exist (never reference them in code)

- ~~`outcome`~~ — historical name, replaced by `stage`
- ~~`updated_at`~~ — this table is append-only; rows are never updated

## Canonical stage values

These are the only valid values for `lead_outcomes.stage`.
Defined in `lib/domain/stage.ts` — import from there, never hardcode.

| Stage | Group | RU Label |
|-------|-------|----------|
| `shortlisted` | decision | Шортлист |
| `approved` | decision | Одобрен |
| `rejected` | decision | Отклонён |
| `qualified` | progress | Квалифицирован |
| `contacted` | progress | Написали |
| `replied` | progress | Ответил |
| `meeting` | progress | Встреча |
| `proposal` | progress | КП |
| `won` | progress | Сделка |
| `lost` | progress | Провал |

## Required views for UI

| View | Used by | Columns expected |
|------|---------|-----------------|
| `v_source_funnel_daily` | Analytics → Conversion block | `source_slug`, `day`, `leads_captured`, `approved`, `shortlisted`, `rejected`, `qualified`, `contacted`, `replied`, `meeting`, `proposal`, `won`, `lost`, `conversion_rate` |
| `mv_inbox_b2b_hot` | Inbox → B2B tab | `id`, `lead_id`, `title`, `url`, `score`, `warmth`, `source_slug`, `created_at` |
| `mv_inbox_people_hot` | Inbox → People tab | same shape as b2b_hot |
| `mv_inbox_event_review` | Inbox → Event Review tab | same shape |
| `mv_inbox_extract_people` | Inbox → Extract Queue tab | same shape |
| `v_kpi_today` | Flow page / KPI strip | `leads_today`, `approved_today`, `rejected_today` |

## Healthcheck

`GET /api/debug/db-health` verifies:
1. `lead_outcomes` has columns: `id`, `lead_id`, `stage`, `created_at`
2. `v_source_funnel_daily` exists as a view

Returns `{ ok: boolean, missing: string[] }`.
If `ok: false` — the Analytics conversion block and Inbox stage badges may be broken.

## Canonical table: `public.lead_actions`

Stores manager action memory — one row per action event (mutable via `action_status`).
Created via migration `create_lead_actions`.

| Column | Type | Notes |
|--------|------|-------|
| `action_id` | uuid | PK, default gen_random_uuid() |
| `lead_id` | uuid | FK → `leads.id` |
| `action_type` | text | CHECK: research \| contact \| follow_up \| meeting \| proposal \| close |
| `action_status` | text | CHECK: planned \| done \| canceled; default 'planned' |
| `note` | text | nullable |
| `due_at` | timestamptz | nullable; used for overdue detection |
| `done_at` | timestamptz | nullable; set automatically when status → done |
| `actor_label` | text | nullable; free-text name of the manager |
| `meta` | jsonb | default '{}'; arbitrary metadata |
| `created_at` | timestamptz | set on insert |

### Action type Russian labels (canonical)

| action_type | RU label |
|-------------|----------|
| `research` | Изучить |
| `contact` | Написать |
| `follow_up` | Напомнить |
| `meeting` | Встреча |
| `proposal` | КП |
| `close` | Закрыть |

### Action status Russian labels

| action_status | RU label |
|---------------|----------|
| `planned` | Запланировано |
| `done` | Выполнено |
| `canceled` | Отменено |

### API

- `GET /api/actions/lead-action?lead_id=<id>` — returns `{ data: LeadAction[] }` newest first
- `POST /api/actions/lead-action` body: `{ lead_id, action_type, note?, due_at?, actor_label? }` — creates planned action
- `PATCH /api/actions/lead-action` body: `{ action_id, action_status: 'done'|'canceled' }` — updates status

### Indexes

- `lead_actions_lead_id_idx` on `(lead_id, created_at DESC)` — primary fetch pattern
- `lead_actions_due_at_idx` on `(due_at)` WHERE planned — for future SLA/overdue queue
- `lead_actions_status_idx` on `(action_status, due_at)` — for queue views

## How to add a new stage

1. Add the value to `STAGES` in `lib/domain/stage.ts`
2. Add a Russian label to `STAGE_LABEL_RU`
3. Assign it a group in `STAGE_GROUP`
4. Add an entry to `docs/feya/05_DECISIONS.md`
5. Ensure the DB accepts the new value (no enum constraint) — currently stored as free-text `stage`
