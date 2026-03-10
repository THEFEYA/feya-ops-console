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

## 2026-03-10 — Observability control layer: human-readable function registry + unified run history

- Change: Создан `lib/domain/functionRegistry.ts` — единый источник истины: 7 функций с русскими метками, группами, нормализацией статусов (`getStatusLabelRu`), нормализацией ошибок (`normalizeErrorRu`). Добавлены `getRunsUnified` и `getSystemStatus` в `lib/api/queries.ts` — объединяют все 4 run-таблицы (`runs`, `extract_runs`, `b2b_place_runs`, `lm_tg_runs`) в единый нормализованный формат `RunUnified`. Зарегистрированы query-endpoints `runs_unified` и `system_status` в `/api/sb/query`. Создан `components/flow/SystemStatusBlock.tsx` — карточки по каждой функции (статус, последний запуск, ошибки за 24ч, вход/выход) + итоговая полоса (сколько работает / требует внимания / ошибок за 24ч). Обновлены `ActivityTable.tsx` и `RecentRunsTable.tsx` — используют `runs_unified`, показывают русские метки функций вместо UUID.
- Why: Оператор видел сырые UUID в таблице прогонов вместо читаемых названий функций, а статусы были на английском. Невозможно было понять состояние системы без знания внутренних идентификаторов. Теперь `/flow` показывает состояние каждой функции по-русски с историей ошибок.
- Risk: Минимальный. `getRunsUnified` — read-only, join-запросы к существующим таблицам. Если таблица недоступна — блок тихо не появляется. `SystemStatusBlock` рендерится только если данные вернулись.
- How to verify: `/flow` — появляется секция «Состояние функций» с карточками по функциям. Таблица прогонов показывает «SERP сбор (Serper)» вместо UUID. `/control` → вкладка «Прогоны» — аналогично читаемые названия.
- Rollback: Удалить `lib/domain/functionRegistry.ts`, удалить `getRunsUnified`/`getSystemStatus` из queries.ts, удалить два кейса из route.ts, удалить `SystemStatusBlock.tsx`, вернуть `ActivityTable.tsx` и `RecentRunsTable.tsx` к использованию `runs_recent` + `normaliseRun`.

## 2026-03-10 — Manager work queue: /queue page + SLA buckets

- Change: Добавлена страница `/queue` («Очередь менеджера») с 5 бакетами: Просрочено, На сегодня, Ждёт ответа, Без следующего действия, Выполнено сегодня. Новый API endpoint `GET /api/actions/queue` агрегирует данные из `lead_actions` + `leads` + `v_lead_current_stage`. Портированы `lib/api/leadActions.ts` и `app/api/actions/lead-action/route.ts` из ветки manager-action-memory (не была смержена в main до этого PR). Обновлён `LeadDetailPanel` с секциями «Следующее действие», «Добавить действие», «Журнал действий». Добавлен пункт «Очередь» в сайдбар.
- Why: Без очереди менеджер не знает с чего начать рабочий день — нет единого места где видно все просроченные / запланированные / ждущие ответа действия по лидам.
- Queue rules: overdue = planned + due_at < start of today; today = planned + due_at >= now AND <= end of today; waiting = planned contact/follow_up with NULL due_at; no_action = lead in active stage (shortlisted/approved/qualified/contacted/replied/meeting/proposal) with zero planned actions; done_today = action_status=done + done_at today.
- Not implemented: SLA escalation, manager assignment (auth.uid), auto-triggers, push notifications, bulk-status.
- How to verify: `/queue` — отображаются бакеты; фильтры работают; клик на элемент открывает LeadDetailPanel справа; можно добавить действие из панели и оно появится в очереди после обновления.
- Rollback: Удалить `app/(dashboard)/queue/`, `app/api/actions/queue/route.ts`, `lib/api/leadActions.ts`, `app/api/actions/lead-action/route.ts`, убрать пункт «Очередь» из Sidebar, откатить изменения LeadDetailPanel.

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
