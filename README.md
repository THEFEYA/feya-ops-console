# FEYA Ops Console

**Операционная консоль управления лидогенерационным пайплайном**

Современный dark-neon дашборд на Next.js 14, подключённый к Supabase. Мониторинг пайплайна в реальном времени, обработка лидов, аналитика и ручной запуск Edge Functions.

---

## Стек технологий

- **Next.js 14** App Router + TypeScript
- **TailwindCSS** + кастомная neon-тема
- **shadcn/ui** компоненты (Radix UI)
- **Recharts** для графиков
- **Supabase JS v2** (server-only для privileged calls)
- **Sonner** для toast-уведомлений

---

## Структура страниц

| Путь | Назначение |
|------|-----------|
| `/flow` | Поток / Мониторинг пайплайна |
| `/inbox` | Лиды / Инбокс с детальной панелью |
| `/analytics` | Графики и KPI |
| `/control` | Ручной запуск Edge Functions |
| `/docs` | Справка на русском |
| `/debug/schema` | Ключи схемы БД (только `development`) |

---

## Быстрый старт (локально)

### 1. Предварительные требования

- Node.js 18+
- pnpm 8+

### 2. Установка зависимостей

```bash
pnpm install
```

### 3. Настройка переменных окружения

Скопируйте `.env.example` в `.env.local` и заполните значения:

```bash
cp .env.example .env.local
```

Отредактируйте `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ваш-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-anon-key
SUPABASE_SERVICE_ROLE_KEY=ваш-service-role-key
FEYA_DASH_TOKEN=придумайте-длинную-случайную-строку
FEYA_DASH_TOKEN_REQUIRED=true
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` никогда не попадает в браузер — используется только на сервере.

### 4. Запуск в dev-режиме

```bash
pnpm dev
```

Откройте: `http://localhost:3000?t=ВАШ_ТОКЕН`

---

## Настройка токена доступа

Консоль защищена простым token-based доступом:

1. **Задайте токен** в `.env.local`: `FEYA_DASH_TOKEN=секретный-токен`
2. **Первый вход**: добавьте `?t=секретный-токен` к URL
3. Токен сохраняется в `httpOnly` cookie на **7 дней**
4. Последующие визиты — без параметра `?t=`

Для **отключения проверки** (только для разработки):
```env
FEYA_DASH_TOKEN_REQUIRED=false
```

---

## Подключение к Supabase

### Необходимые данные из Supabase Dashboard

1. Перейдите в **Project Settings → API**
2. Скопируйте:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

### Используемые таблицы и вью

| Объект | Тип | Использование |
|--------|-----|--------------|
| `v_kpi_today` | View | KPI-карточки на /flow |
| `mv_inbox_b2b_hot` | Mat. View | Инбокс B2B |
| `mv_inbox_people_hot` | Mat. View | Инбокс People |
| `mv_inbox_event_review` | Mat. View | Event Review |
| `mv_inbox_extract_people` | Mat. View | Extract Queue |
| `leads` | Table | Аналитика |
| `lead_outcomes` | Table | Исходы лидов |
| `runs` | Table | История прогонов |
| `tasks` | Table | Статистика задач |

---

## Деплой на Vercel

### 1. Подготовка

```bash
git push origin main
```

### 2. Создание проекта в Vercel

1. Перейдите на [vercel.com](https://vercel.com) → **New Project**
2. Импортируйте репозиторий
3. Framework: **Next.js** (определяется автоматически)

### 3. Переменные окружения в Vercel

В **Settings → Environment Variables** добавьте:

| Переменная | Значение | Тип |
|-----------|---------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Secret |
| `FEYA_DASH_TOKEN` | `длинная-строка` | Secret |
| `FEYA_DASH_TOKEN_REQUIRED` | `true` | Public |

> ⚠️ Отметьте `SUPABASE_SERVICE_ROLE_KEY` и `FEYA_DASH_TOKEN` как **Sensitive** в Vercel.

### 4. Деплой

Нажмите **Deploy**. После деплоя откройте:
```
https://ваш-домен.vercel.app?t=ВАШ_ТОКЕН
```

---

## Ручной запуск Edge Functions (Управление)

На странице `/control` доступны 7 кнопок запуска:

| Кнопка | Edge Function | Назначение |
|--------|--------------|-----------|
| SERP сбор | `collector_serp_serper` | Сбор SERP через Serper API |
| Reddit RSS | `collector_reddit_rss` | RSS-фиды Reddit |
| Extract Reddit | `extract_people_reddit` | Извлечение людей из Reddit |
| Extract RPF | `extract_people_rpf` | RPF-экстрактор |
| Дайджест | `digest_email_daily` | Email-дайджест |
| Google Places | `collector_google_places` | Google Places API |
| OSM Overpass | `collector_osm_overpass` | OpenStreetMap данные |

**Параметры по умолчанию** задаются в компоненте `components/control/RunButtons.tsx`.
**Расширенные параметры** — JSON-объект в модальном окне (поле «Расширенные параметры»).

---

## Исходы лидов (Инбокс)

В панели лида доступны три действия:

- **Одобрить** → вызывает `lead_outcome_action` с `outcome: "approved"`
- **Шортлист** → `outcome: "shortlisted"`
- **Отклонить** → `outcome: "rejected"`

Если Edge Function недоступна — автоматически делается прямой upsert в `public.lead_outcomes`.

---

## Безопасность

- `SUPABASE_SERVICE_ROLE_KEY` используется только в `/api/**` route handlers
- Токен хранится в `httpOnly secure cookie`, недоступен JS
- Все API-маршруты проверяют токен перед выполнением
- Edge Functions вызываются только из whitelist в `lib/api/actions.ts`
- Произвольный SQL от клиента невозможен

---

## Разработка

```bash
# Dev режим с отключённой проверкой токена
FEYA_DASH_TOKEN_REQUIRED=false pnpm dev

# Проверить схему БД (только в dev)
open http://localhost:3000/debug/schema

# Сборка для продакшена
pnpm build
pnpm start
```

---

## Лицензия

Приватное использование.