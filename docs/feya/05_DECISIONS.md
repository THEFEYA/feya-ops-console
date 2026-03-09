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
