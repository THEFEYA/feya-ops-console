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

## 2026-03-10 — Manager action memory layer (lead_actions)

- Change: Создана таблица `public.lead_actions` (action_id uuid PK, lead_id, action_type, action_status, note, due_at, done_at, actor_label, meta, created_at). Добавлены три API endpoint'а: GET/POST/PATCH `/api/actions/lead-action`. В `LeadDetailPanel` добавлены секции: «Следующее действие» (карточка с просрочкой), «Добавить действие» (быстрые кнопки + заметка + срок), «Журнал действий» (последние 5). Обновлены docs/feya/01_CANON.md, 02_WORKING_RULES.md, 03_CURRENT_STATE.md, 04_ROADMAP.md.
- Why: До этого менеджеры никак не фиксировали в системе что они делают с лидом. Невозможно было понять — писали ли, договорились ли о встрече, есть ли договорённость. Это первый слой памяти: что запланировано, что сделано. Следующий слой — очередь и SLA — строится на этой же таблице.
- Risk: Минимальный. Новая таблица с RLS, API защищён авторизацией. UI не блокирует существующий функционал — секция рендерится после кнопок стадий. Если таблица отсутствует в runtime — секция журнала пустая, кнопки создания вернут 500 (видно в консоли).
- How to verify: Открыть Inbox → выбрать лид → появляется секция «Добавить действие» с кнопками (Изучить / Написать / Напомнить / Встреча / КП / Закрыть). Нажать — появляется запись в «Журнал действий». Установить срок в прошлом → в «Следующее действие» появляется красная метка «Просрочено». Нажать галочку → статус меняется на «Выполнено».
- Rollback: DROP TABLE public.lead_actions; удалить app/api/actions/lead-action/route.ts; удалить lib/api/leadActions.ts; удалить actions-секцию из LeadDetailPanel.tsx.

## 2026-03-10 — Docs update: canon + working rules + roadmap aligned to agreed MVP plan

- Change: Обновлены docs/feya/01_CANON.md (добавлена сущность Manager Action, правило Russian-first UI), 02_WORKING_RULES.md (Rule 9: Russian-first UI, Rule 10: Build memory before automation), 03_CURRENT_STATE.md (актуализировано под реальное состояние), 04_ROADMAP.md (переписан с отметками фаз A/B выполнены, C в процессе, D-F будущее).
- Why: Docs отставали от реального состояния на несколько PR. Нужно синхронизировать перед следующими фазами чтобы не было расхождений между canon и кодом.
- Risk: Нулевой. Только документация.
- How to verify: Прочитать docs/feya/ — всё согласовано с текущим кодом и согласованным планом.
- Rollback: git revert — только docs, никакого влияния на runtime.

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
