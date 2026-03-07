# FEYA_CURRENT_STATE

## 1. Что уже подтверждено

Ниже — текущие подтверждённые факты по проекту FEYA.

---

## 2. Старые документы были проанализированы

Уже разобраны и осмыслены:
- паспорт проекта
- B2C-аватары
- intent / keywords
- negative keywords
- event universe
- roadmap / status update
- keyword master CSV

Главный вывод по старым файлам:
Фундамент проекта сильный, но документы уже переросли стадию "вдохновения" и требуют канонизации в строгую операционную систему.

---

## 3. Текущая структура Supabase (runtime)

В проекте уже существуют основные сущности:
- events, signals, sources
- queries, runs
- leads, tasks
- keyword_master, keyword_packs
- negative_keywords, domain_rules
- digests, extract_runs
- decision_log
- b2b_places и связанные b2b_* таблицы

---

## 4. Подтверждённые метрики

Текущие значения (как baseline):

- leads: 7861
- tasks: 13519
- queries: 2857
- runs: 1983
- signals: 375
- sources: 62
- events: 19
- domain_rules: 23
- decision_log: 85
- digests: 32
- keyword_master: 8772
- keyword_packs: 13
- negative_keywords: 49

Лиды по типам:
- person: 4794
- page: 2617
- thread: 236
- business: 96

Лиды по статусу:
- new: 6089
- blocked: 1642

Задачи:
- open: 7771
- closed: 5559

---

## 5. Главные bottleneck'и (узкие места)

### 5.1. Task pressure критичен

Open tasks слишком много. Это главный риск деградации системы.

### 5.2. Legacy B2B noise отравляет pipeline

Почти весь blocked_reason связан с:
- b2b_roles_deprecated
- b2b_job_noise

Это технический долг, который нужно decommission'ить.

---

## 6. Валидированный operational path

Сейчас подтверждённый рабочий путь:

SERP / forums → leads → tasks → extract_people → person leads → outreach → digest

Event Universe пока поддерживающий слой, а не ядро MVP.

---

## 7. Что нужно закрепить как канон v3

1) Source of truth должен жить в GitHub docs, иначе Claude "слепой"
2) Supabase docs = зеркало (project_docs), чтобы Copilot мог читать
3) Hard gate раньше scoring
4) B2C и B2B — разные контуры
5) Политика triage: task vs monitor vs digest-only vs discard

---

## 8. Следующий приоритетный шаг

Phase A — Governance / Source of Truth:
- перенести CANON / WORKING_RULES / CURRENT_STATE в GitHub docs
- добавить ROADMAP и DECISIONS
- ввести правило: любой PR обновляет docs

Дальше Phase C — throughput / triage / reduction open tasks
