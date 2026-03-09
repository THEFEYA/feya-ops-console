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

## 2026-03-09 — Analytics action layer: stage history views + velocity analytics

- Change: Добавлены три query-функции (`getLeadCurrentStage`, `getLeadEverStage`, `getStageTransitions`), зарегистрированы в `/api/sb/query` (три новых allowed names). В `/analytics` добавлены два блока: «Стадии лидов» (toggle текущая/ever-reached + таблица по источникам) и «Скорость воронки» (таблица переходов с median/p75 + таблица зависших лидов >72 ч.). Исправлен баг в `insertLeadStage`: dedup-запрос использовал колонку `id` вместо `outcome_id`. Удалён upsert-fallback в `insertLeadStage` и `setLeadOutcome` (таблица append-only, нет unique constraint на lead_id).
- Why: Нужна операционная видимость — где лиды застревают, насколько быстро двигаются по воронке, и что происходит с rollback-стадиями. Без этого невозможно выявить узкие места.
- Risk: Минимальный. Блоки в analytics рендерятся только если view-данные вернулись (best-effort). Если view не существует в runtime — блок просто не появится. Upsert-удаление: lead_outcomes не имеет unique constraint на lead_id (он был намеренно дропнут ранее), поэтому upsert-fallback был мёртвым кодом.
- How to verify: `/analytics` — появляется секция «Стадии лидов» (если в lead_outcomes есть записи с stage), появляется «Скорость воронки» (если есть ≥2 записей на одного лида). Если views не созданы в Supabase — блоки отсутствуют, ошибок нет. DB views необходимы: `v_lead_current_stage`, `v_lead_ever_stage`, `v_stage_transitions`.
- Rollback: Удалить три кейса из query/route.ts, три функции из queries.ts, state/useMemo/useEffect + два UI блока из analytics/page.tsx, вернуть `.select('id, stage, created_at')` в actions.ts.

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
