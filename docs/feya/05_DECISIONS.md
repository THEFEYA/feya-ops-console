# FEYA — Decisions Log

## Template

Date:
Decision:
Why:
Impact:
Links (PR/Issue):
Notes:

## Log

---

<!-- Добавляй новые записи сверху, самые свежие первыми -->

## 2026-03-10 — Source health analytics: "Здоровье источников" + "Что делать сейчас"

- Change: Новый аналитический блок в `/analytics` — таблица «Здоровье источников» (source_slug × метрики: current stage counts, ever-reached counts, reject/win/rollback rate, action label) + блок «Что делать сейчас» (до 5 сигналов: высокий reject rate, застрявшие лиды, лучший Встреча→КП переход, лучший КП→Сделка, кандидат на масштабирование). Логика action labels: Scale (win_rate ≥ 5% + ever_proposal ≥ 2 + ever_won ≥ 1), Review (reject_rate ≥ 40% + total ≥ 5), Stuck (cur_qualified ≥ 3 + ever_meeting == 0 + total ≥ 5), Watch (по умолчанию). Добавлены `getLeadCurrentStage`, `getLeadEverStage`, `getStageTransitions` в queries.ts и `/api/sb/query`.
- Why: Analytics был пассивным. Нужен операционный сигнал — что конкретно делать сейчас с каждым источником, без ручного анализа таблиц.
- Risk: Минимальный. Блок рендерится только если views вернули данные. Все расчёты детерминированы, без AI. Если views отсутствуют в runtime — блок просто не появится.
- How to verify: `/analytics` → блок «Здоровье источников» появляется ниже всех блоков. У источника с ≥5 лидами и ≥40% rejected → action = «Разобраться». У источника с won ≥ 1 и win_rate ≥ 5% → «Масштаб». Таблица «Что делать сейчас» показывает не более 5 сигналов.
- Rollback: Удалить `computeSourceHealth`, `deriveActionSignals`, `deriveAction`, `pct`, `SourceHealthRow`, `ActionSignal` из page.tsx; удалить sourceHealth state/memo/useEffect; удалить блок «Здоровье источников» из JSX; удалить три query-функции из queries.ts и route.ts.

## 2026-03-08 — Schema contract: single stage module + db-health endpoint

- Change: Создали `lib/domain/stage.ts` (STAGES, Stage, STAGE_LABEL_RU, STAGE_ORDER, STAGE_GROUP, stageLabel, stageVariant). Заменили локальные маппинги в LeadTable, LeadDetailPanel, actions.ts, analytics. Добавили `GET /api/debug/db-health` и `docs/feya/06_SCHEMA_CONTRACT.md`.
- Why: Дублирование определений стадий в 3+ местах → при добавлении стадии нужно менять несколько файлов. DB healthcheck даёт ранний сигнал о schema drift (outcome/stage/updated_at).
- Risk: Минимальный — только рефакторинг импортов, runtime поведение не меняется при здоровой БД.
- How to verify: `pnpm build` проходит; /analytics показывает жёлтый алерт только если БД не совпадает с контрактом; добавить стадию в STAGES → она автоматически появится во всех UI.
- Rollback: Удалить lib/domain/stage.ts, восстановить локальные определения в каждом файле.

## 2026-03-08 — Process guardrails: PR template + CONTRIBUTING

Date: 2026-03-08
Decision: Добавили `.github/pull_request_template.md` и `CONTRIBUTING.md`.
Why: Повторяющиеся баги (`outcome` вместо `stage`, `updated_at` которого нет, глобальные фильтры ломающие funnel) возникали из-за отсутствия формализованных guardrails. PR template с чеклистом и schema drift check-секцией предотвращает повторение.
Impact: Каждый PR теперь явно требует: прочитать canon, добавить запись в decisions log, указать "How to verify". Нет влияния на runtime/код.
Links: branch `claude/process-guardrails-BpS8q`
Notes: Это первая запись в decisions log — шаблон отныне обязателен для всех PR, меняющих логику.
