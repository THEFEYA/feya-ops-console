# FEYA_CANON

## 1. Что такое FEYA

FEYA — это intent-driven leadgen system.
Цель проекта — не просто собирать лиды, а находить **реальный actionable demand** там, где у человека, организатора или бизнеса уже есть причина покупать, искать, сравнивать, обсуждать или подбирать продукт.

Система должна работать по принципу:
- people-first
- actionable-first
- noise-controlled
- system-first, а не хаос-first

---

## 2. Смысловая суть (ядро)

FEYA ловит момент, когда спрос уже есть (или почти есть), и превращает его в:
- лид
- задачу
- контактный путь
- готовое действие (outreach / follow-up / triage)

Главное: **не "красота UI" и не "сбор всего подряд"**, а **операционная пригодность**.

---

## 3. Каноническая логика пайплайна

Валидированный боевой путь:

1) Source → (SERP / reddit / forums / places)
2) Query → Run
3) Lead ingestion → gate (hard rules)
4) Scoring → intent + reach + freshness
5) Task gating → create tasks только если есть actionability
6) Extract people (если нужно)
7) Person lead → contact path → outreach tasks
8) Digest → только actionable сущности

---

## 4. Нельзя ломать (hard constraints)

### 4.1. Hard gate всегда раньше score

Сначала блокируем:
- negative keywords / adult-only policy
- запрещённые домены / domain rules
- job noise / role noise (особенно B2B)
- junk / irrelevant / stale

Только потом считаем score.

### 4.2. "Лиды" — не плоские

В системе обязаны существовать разные виды сущностей:
- lead_kind: person / page / thread / business
- parent_lead_id / lead relations
- query_purpose (почему мы искали)
- blocked_reason (почему отсеяно)
- actionability status (можно ли реально действовать)

### 4.3. Нельзя плодить tasks без triage capacity

Если open tasks растут бесконтрольно — система деградирует.

### 4.4. B2C и B2B — разные operational tracks

Нельзя держать B2B и B2C в одной логике скоринга и gating.
B2B заражается job-noise и role-noise, если не разделять контуры.

---

## 5. Приоритеты системы (как в корпорации)

В порядке важности:

1) Actionability (можем ли реально написать / позвонить / сделать шаг)
2) Noise-control (не допустить мусора)
3) Throughput / triage (операционный контроль)
4) Только потом UI/визуал
5) Только потом "идеальные" словари/вселенная событий

---

## 6. Что считается успехом (MVP definition)

MVP считается достигнутым, когда:
- система стабильно генерирует actionable лиды
- есть понятные причины "почему это лид"
- есть контактный путь у значимой доли лидов
- triage работает (не захлёбываемся в задачах)
- есть базовая конверсия по стадиям (stage funnel)
- можно управлять источниками и видеть, что даёт результат
