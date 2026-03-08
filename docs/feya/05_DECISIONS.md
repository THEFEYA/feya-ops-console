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

## 2026-03-08 — Process guardrails: PR template + CONTRIBUTING

Date: 2026-03-08
Decision: Добавили `.github/pull_request_template.md` и `CONTRIBUTING.md`.
Why: Повторяющиеся баги (`outcome` вместо `stage`, `updated_at` которого нет, глобальные фильтры ломающие funnel) возникали из-за отсутствия формализованных guardrails. PR template с чеклистом и schema drift check-секцией предотвращает повторение.
Impact: Каждый PR теперь явно требует: прочитать canon, добавить запись в decisions log, указать "How to verify". Нет влияния на runtime/код.
Links: branch `claude/process-guardrails-BpS8q`
Notes: Это первая запись в decisions log — шаблон отныне обязателен для всех PR, меняющих логику.
