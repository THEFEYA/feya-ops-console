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

## 2026-03-08 — Remove ON CONFLICT / upsert from lead_outcomes writes

- Change: Удалили upsert-fallback с `onConflict: 'lead_id'` из `insertLeadStage` и `setLeadOutcome` в `lib/api/actions.ts`. `insertLeadStage` стал чисто append-only: dedup-check → plain INSERT (без fallback). `setLeadOutcome` делегирует в `insertLeadStage` вместо своего отдельного upsert. Сообщение об ошибке в LeadDetailPanel переведено на русский и унифицировано.
- Why: `lead_outcomes` — это таблица-история (append-only), у неё нет unique constraint на `lead_id`. Supabase возвращал runtime ошибку: "there is no unique or exclusion constraint matching the ON CONFLICT specification". Upsert по lead_id логически неверен для таблицы событий.
- Risk: Минимальный — поведение не меняется при нормальном сценарии (dedup отсекает дубли). Единственное изменение: если INSERT упадёт с другой ошибкой, она теперь прокидывается напрямую вместо попытки upsert.
- How to verify: Открыть Inbox → выбрать лид → нажать «Одобрить» → в DevTools Network убедиться, что POST /api/actions/lead-outcome возвращает 200 без ошибки про ON CONFLICT. Повторное нажатие той же кнопки → 200 со `skipped: true`.
- Rollback: Вернуть upsert-блок в `insertLeadStage` и `setLeadOutcome`. Но правильный fix — добавить unique constraint на (lead_id) только если таблица переходит к upsert-модели, что противоречит дизайну.
