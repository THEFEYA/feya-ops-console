# FEYA_CANON

## 1. Что такое FEYA

FEYA — это intent-driven leadgen engine для нишевых fashion/expression продуктов, который:
- ловит спрос в момент подготовки к событию (event-driven);
- переводит "страницы/треды" в actionable tasks (люди/контакты);
- хранит объяснение "почему это лид" + stage прогресса;
- даёт Ops Console для контроля пайплайна и аналитики.

Ключевая философия: **intent-first + people-first + actionable-first + noise-controlled**.

## 2. Базовые сущности (канонично)

**Query** → **Run** → **Lead (page/thread/person/org)** → **Task** → **Outreach/Decision** → **Outcome**.

Lead обязан поддерживать:
- lead_kind (page/thread/person/org/event/b2b)
- source_slug / source_platform / source_family
- query_purpose
- persona_tag (если применимо)
- blocked_reason (если отфильтрован)
- evidence_text / match_terms / snippet
- contact_path / username / business_phone / business_website (если найдено)
- score + компонентные скоры (intent/reach/freshness/…)
- stage (pipeline stage) + history

## 3. Разделение "gate vs score" (не смешивать)

**Gate (hard rules)**:
- стоп-слова / forbidden policy
- blocked domains / domain rules
- нерелевантный event/source
- нет пути extraction → нет шанса на contact
- очевидный шум (jobs, pdf patterns и т.п.)

**Score (ranking)**:
- intent_score
- reach_score (contactability)
- freshness_score
- event_relevance
- business_value (опционально)

**Action policy** (после gate+score):
- create task / enqueue extract / show in review / digest-only / discard

## 4. B2C vs B2B — разные operational tracks

B2C: человек готовится к событию → buying intent → outfit / custom / commission.
B2B: vendor/procurement/организатор/стилист → sourcing → decision-maker extraction.

Не смешивать в одной логике без отдельного noise control.

## 5. "Source of truth" (что считать правдой)

- Код + миграции: GitHub.
- Runtime данные/метрики: Supabase.
- Канон/правила/текущее состояние: docs/feya/* (в GitHub) + зеркало в Supabase (опционально).

## 6. Что нельзя ломать (constraints)

- Стадии должны быть в одном словаре (stage), не outcome.
- Любой UI/аналитика должны читать stage единообразно.
- Любая новая витрина (view) должна иметь ясный контракт полей и проверку в UI.
