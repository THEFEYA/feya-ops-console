# FEYA Schema Contract

Описание инвариантов схемы БД и бизнес-правил, которые обязательны для соблюдения в коде.

---

## lead_outcomes — Stage Transition Policy

### Модель данных

Таблица `lead_outcomes` — **append-only история стадий**. Текущая стадия лида = последняя запись по `created_at`.

Схема: `outcome_id` (uuid PK), `lead_id` (uuid FK→leads), `stage` (text NOT NULL), `note` (text), `meta` (jsonb NOT NULL default `{}`), `created_at` (timestamptz NOT NULL default now()).

Уникального индекса на `(lead_id, stage)` нет — rollback разрешён намеренно.

### Типы стадий

| Группа | Стадии |
|--------|--------|
| Decision (решение) | `shortlisted`, `approved`, `rejected` |
| Progress (воронка) | `qualified` → `contacted` → `replied` → `meeting` → `proposal` |
| Terminal (финал) | `won`, `lost` |

### Типы переходов

| Kind | Описание |
|------|----------|
| `decision` | → shortlisted / approved / rejected. Всегда разрешён. |
| `forward` | движение вперёд по воронке (qualified→contacted, contacted→replied и т.д.) |
| `rollback` | возврат назад по воронке (meeting→contacted и т.д.) |
| `terminal` | → won / lost. Разрешён из любой стадии воронки (qualified..proposal) и decision. |
| `reopen` | won/lost → proposal или meeting. Единственный разрешённый выход из terminal. |
| `forbidden` | всё остальное из terminal: won/lost → qualified/contacted/replied. |

### Матрица разрешений

```
from \ to          decision  qualified  contacted  replied  meeting  proposal  won  lost
─────────────────────────────────────────────────────────────────────────────────────────
null (первый)        ✓          ✓          ✓          ✓        ✓        ✓       ✓    ✓
decision             ✓          ✓          ✓          ✓        ✓        ✓       ✓    ✓
qualified            ✓          ✓          ✓          ✓        ✓        ✓       ✓    ✓
contacted            ✓          ✓(↩)       ✓          ✓        ✓        ✓       ✓    ✓
replied              ✓          ✓(↩)       ✓(↩)       ✓        ✓        ✓       ✓    ✓
meeting              ✓          ✓(↩)       ✓(↩)       ✓(↩)     ✓        ✓       ✓    ✓
proposal             ✓          ✓(↩)       ✓(↩)       ✓(↩)     ✓(↩)     ✓       ✓    ✓
won                  ✓          ✗          ✗          ✗        ✓(reopen) ✓(reopen) ✓  ✓*
lost                 ✓          ✗          ✗          ✗        ✓(reopen) ✓(reopen) ✓* ✓

✓(↩) = rollback   ✗ = forbidden (HTTP 400)   * = same terminal (dedup пропустит)
```

### Серверная валидация

Реализована в `app/api/actions/lead-outcome/route.ts`:

1. Читаем latest stage по `lead_id` из `lead_outcomes` (ORDER BY created_at DESC LIMIT 1).
2. Вызываем `checkTransition(from, to)` из `lib/domain/stageTransitions.ts`.
3. Если `!allowed` — возвращаем HTTP 400 с `{ error: "...", transition_kind: "forbidden", from, to }`.
4. Если allowed — INSERT с `meta.transition_kind = kind`.

### Единый источник правил

`lib/domain/stageTransitions.ts` — единственный файл, где описана политика. Используется и сервером, и клиентом.

### UI поведение (LeadDetailPanel)

- Успех `forward` / `terminal` / `decision`: `"Стадия обновлена: <label>"`
- Успех `rollback`: `"Откат стадии → <label>"`
- Успех `reopen`: `"Лид переоткрыт → <label>"`
- Ошибка `forbidden` (HTTP 400 с `transition_kind: "forbidden"`): показываем `json.error` из сервера
- Ошибка DB / сеть: `"Не удалось сохранить стадию. Изменение не записано в базу."`

Оптимистичный апдейт с rollback при любой ошибке.

### Dedup

Если latest stage == target stage И created_at < 2 минут назад → INSERT пропускается, возвращается `{ ok: true, skipped: true }`. Это происходит **после** проверки политики.
