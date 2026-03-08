# Contributing to FEYA Ops Console

## Как работаем

**1 PR = 1 цель.**
Не смешивать аналитику + инбокс + схему БД в одном PR без необходимости.

Перед любым PR:
1. Прочитай [`docs/feya/00_START_HERE.md`](./docs/feya/00_START_HERE.md)
2. Проверь [`docs/feya/03_CURRENT_STATE.md`](./docs/feya/03_CURRENT_STATE.md) — где сейчас bottleneck?
3. Приоритет: data correctness → gate/noise → throughput → UI

## Где правда (Source of Truth)

| Что | Где |
|-----|-----|
| Канон проекта, entity model, пайплайн | [`docs/feya/01_CANON.md`](./docs/feya/01_CANON.md) |
| Правила работы, schema guardrails | [`docs/feya/02_WORKING_RULES.md`](./docs/feya/02_WORKING_RULES.md) |
| Текущее состояние, bottlenecks | [`docs/feya/03_CURRENT_STATE.md`](./docs/feya/03_CURRENT_STATE.md) |
| Roadmap | [`docs/feya/04_ROADMAP.md`](./docs/feya/04_ROADMAP.md) |
| Лог решений | [`docs/feya/05_DECISIONS.md`](./docs/feya/05_DECISIONS.md) |
| Runtime данные | Supabase tables/views |

## Правила изменения схемы БД

- `lead_outcomes` имеет колонки: `lead_id`, `stage`, `meta`, `created_at`. **Нет `outcome`, нет `updated_at`.**
- Стадии (stage) всегда EN: `qualified / contacted / replied / meeting / proposal / won / lost / approved / shortlisted / rejected`
- Перед добавлением новой колонки в `select()` — убедись что она существует в реальной БД.

## Как запускать изменения через Claude

1. Открой новую сессию Claude Code в репо
2. Claude читает `docs/feya/` как контекст — **не нужно каждый раз объяснять всё с нуля**
3. Для любого изменения логики попроси Claude добавить запись в `docs/feya/05_DECISIONS.md`
4. Для срочных фиксов: опиши баг + ожидаемое поведение + имя таблицы/колонки

## Запуск локально

```bash
pnpm install
cp .env.example .env.local   # заполни SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, FEYA_DASH_TOKEN
pnpm dev
```

Сборка: `pnpm build` — должна проходить без ошибок перед любым PR.
