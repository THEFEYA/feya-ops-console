# FEYA Decisions Log (коротко и по делу)

Шаблон записи:

## YYYY-MM-DD — <короткое название>

- Change:
- Why:
- Risk:
- How to verify:
- Rollback:

---

<!-- Добавляй новые записи сверху, самые свежие первыми -->

## 2026-03-09 — Stage transition policy / contract

- Change: Создан `lib/domain/stageTransitions.ts` — единый источник правил переходов между стадиями лида. Определены три группы стадий: decision (shortlisted/approved/rejected), progress chain (qualified→contacted→replied→meeting→proposal), terminal (won/lost). В `/api/actions/lead-outcome` POST добавлена проверка: читаем latest stage, вызываем `checkTransition(from, to)`, если переход запрещён — HTTP 400 с русскоязычной ошибкой. В `meta` каждой записи `lead_outcomes` теперь сохраняется `transition_kind`. UI в `LeadDetailPanel` обновлён: разные тосты для forward ("Стадия обновлена"), rollback ("Откат стадии"), reopen ("Лид переоткрыт"), forbidden ("Этот переход запрещён…"). Добавлен `docs/feya/06_SCHEMA_CONTRACT.md`.
- Why: Без политики менеджер мог случайно нажать `won→contacted`, что логически бессмысленно и ломает аналитику воронки. Нужен явный контракт: что разрешено, что нет, и какого рода каждый переход. Rollback внутри воронки (meeting→contacted) — допустим; reopen из финала — только в proposal/meeting; decision-стадии — всегда свободны.
- Risk: Минимальный. Блокируются только два сценария: won/lost → qualified/contacted/replied. Для них ошибка очевидна и объясняется. Все остальные переходы по-прежнему разрешены. Политика расширяемая — добавить новую стадию в нужную группу достаточно.
- How to verify: В Inbox выбрать лид → поставить Сделка → попробовать нажать «Написали» → получить toast с ошибкой "Переход из Сделка разрешён только в КП или Встречу". Нажать «КП отправлено» → toast "Лид переоткрыт → КП отправлено". Нажать «Встреча» → toast "Откат стадии → Встреча".
- Rollback: Удалить `lib/domain/stageTransitions.ts`, убрать `checkTransition` из route handler, вернуть прямой вызов `insertLeadStage` без transition check, вернуть единый toast `"Стадия: <label>"` в LeadDetailPanel.

## 2026-03-09 — Stage velocity + bottleneck analytics

- Change: Добавлен DB view `v_stage_transitions` (каждый переход между стадиями = строка: from_stage, to_stage, hours_elapsed, source_slug). Новые JS-хелперы `computeVelocity()` (median/p75 времени per transition type) и `computeStuck()` (лиды, зависшие в текущей стадии > 72 ч). В аналитике новый блок "Скорость воронки": таблица переходов с Median/P75 часами и таблица зависших лидов по стадиям. Фильтрация по source_slug. Rollback-переходы помечены иконкой ↩.
- Why: Append-only история стадий позволяет видеть скорость движения лида. Bottleneck-анализ: какие переходы долгие → куда смотреть первым делом. Stuck analysis: какие лиды залипли → откуда начинать follow-up. Без этой аналитики история стадий бесполезна для операционных решений.
- Risk: Данных сейчас мало (несколько десятков тестовых лидов). Для переходов с < 2 наблюдений median не показывается (помечается "мало"). По мере накопления реальных данных аналитика станет точнее.
- How to verify: Проставить стадии нескольким лидам с паузами. Аналитика → "Скорость воронки": переходы в таблице, median часов для переходов с ≥ 2 наблюдениями. Лиды, зависшие в стадии > 72 ч, появятся в правой таблице.
- Rollback: DROP VIEW v_stage_transitions; убрать velocity-блок из analytics/page.tsx.

## 2026-03-09 — Разделить current stage и ever-reached stage в аналитике

- Change: Созданы две новые DB views: `v_lead_current_stage` (latest stage by created_at per lead) и `v_lead_ever_stage` (max-ever stage by STAGE_ORDER per lead, + rollback_count). В блок Конверсия добавлен переключатель "Текущая стадия / Дошли до стадии". Inbox и правая карточка продолжают использовать latest-by-created_at (current stage), без изменений.
- Why: После удаления unique index на (lead_id, stage) возникли две различные истины, которые нельзя смешивать: (1) что сейчас — последняя запись по created_at; (2) чего когда-либо достигал лид — максимальный stage_order по всей истории. Смешение даёт ложную аналитику: лид откатился с Сделки на Написали → в "текущей" он Написали, но в "дошли до" он Сделка. Обе метрики нужны для разных управленческих решений.
- Risk: Новые views читаются best-effort (не блокируют загрузку страницы). rollback_count вычисляется через LAG() window function — корректно для append-only модели.
- How to verify: В Inbox: лид → Квалифицирован → Написали → Встреча → откат на Написали. Аналитика → Конверсия → "Текущая стадия": лид считается в Написали. Переключить на "Дошли до стадии": тот же лид считается в Встреча.
- Rollback: DROP VIEW v_lead_current_stage; DROP VIEW v_lead_ever_stage; убрать stage-mode блок из analytics/page.tsx.

## 2026-03-08 — Allow stage rollback: drop lead_outcomes_lead_stage_uniq index

- Change: Удалили уникальный индекс `lead_outcomes_lead_stage_uniq ON (lead_id, stage)` из БД (миграция). Исправили dedup-запрос в `insertLeadStage` — он обращался к несуществующей колонке `id` (реальное имя PK — `outcome_id`), из-за чего dedup всегда молча падал.
- Why: Уникальный индекс на `(lead_id, stage)` не даёт записать одну и ту же стадию дважды для одного лида. Это блокировало любой rollback: попытка вернуться на ранее выставленную стадию (например, Сделка → Встреча) давала ошибку "duplicate key value violates unique constraint". Прямые переходы вперёд работали, потому что каждая новая стадия была уникальной. `lead_outcomes` — append-only history: текущая стадия = последняя запись по `created_at`, а не единственная запись per stage. Менеджер должен иметь право двигать стадию в любую сторону.
- Risk: Минимальный. Dedup-окно (2 мин) защищает от случайных двойных кликов. Убирая unique constraint, мы разрешаем корректное поведение CRM. Аналитика не пострадает — она читает latest row by created_at.
- How to verify: В Inbox выбрать лид → поставить Квалифицирован → Написали → Встреча → Сделка → вернуть назад на Встреча. Все шаги — 200 без error toast. После F5 должна показываться последняя выставленная стадия.
- Rollback: `CREATE UNIQUE INDEX lead_outcomes_lead_stage_uniq ON public.lead_outcomes USING btree (lead_id, stage);` — но это снова сломает rollback.

## 2026-03-08 — Remove ON CONFLICT / upsert from lead_outcomes writes

- Change: Удалили upsert-fallback с `onConflict: 'lead_id'` из `insertLeadStage` и `setLeadOutcome` в `lib/api/actions.ts`. `insertLeadStage` стал чисто append-only: dedup-check → plain INSERT (без fallback). `setLeadOutcome` делегирует в `insertLeadStage` вместо своего отдельного upsert. Сообщение об ошибке в LeadDetailPanel переведено на русский и унифицировано.
- Why: `lead_outcomes` — это таблица-история (append-only), у неё нет unique constraint на `lead_id`. Supabase возвращал runtime ошибку: "there is no unique or exclusion constraint matching the ON CONFLICT specification". Upsert по lead_id логически неверен для таблицы событий.
- Risk: Минимальный — поведение не меняется при нормальном сценарии (dedup отсекает дубли). Единственное изменение: если INSERT упадёт с другой ошибкой, она теперь прокидывается напрямую вместо попытки upsert.
- How to verify: Открыть Inbox → выбрать лид → нажать «Одобрить» → в DevTools Network убедиться, что POST /api/actions/lead-outcome возвращает 200 без ошибки про ON CONFLICT. Повторное нажатие той же кнопки → 200 со `skipped: true`.
- Rollback: Вернуть upsert-блок в `insertLeadStage` и `setLeadOutcome`. Но правильный fix — добавить unique constraint на (lead_id) только если таблица переходит к upsert-модели, что противоречит дизайну.
