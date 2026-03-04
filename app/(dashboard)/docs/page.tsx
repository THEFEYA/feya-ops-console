import { NeonCard } from '@/components/shared/NeonCard'
import { BookOpen, Shield, Search, Play, Info, Zap } from 'lucide-react'

const sections = [
  {
    icon: Zap,
    title: 'Основные понятия',
    color: 'cyan' as const,
    items: [
      {
        term: 'Lead (Лид)',
        def: 'Запись о потенциальном клиенте или возможности, обнаруженная автоматически. Содержит URL, заголовок, источник, скоринг и доказательства.',
      },
      {
        term: 'Task (Задача)',
        def: 'Единица работы в пайплайне. Например: «собрать SERP для запроса X», «извлечь людей из поста Reddit». Имеет статус: queued → running → done/error.',
      },
      {
        term: 'Run (Прогон)',
        def: 'Однократное выполнение Edge Function. В таблице runs хранится история всех вызовов с результатами и ошибками.',
      },
      {
        term: 'Signal (Сигнал)',
        def: 'Признак, указывающий на то, что запись является лидом. Например: наличие контактного пути, WTB-фраз, высокого охвата аудитории.',
      },
      {
        term: 'Warmth (Интент)',
        def: 'Уровень «горячести» лида: hot (горячий) — высокое намерение купить прямо сейчас; warm (тёплый) — интерес, но без срочности; cold (холодный) — слабый сигнал.',
      },
      {
        term: 'Score (Скоринг)',
        def: 'Числовая оценка качества лида от 0 до 100. Учитывает интент, охват, тип источника, наличие контактных данных.',
      },
    ],
  },
  {
    icon: Search,
    title: 'Работа с фильтрами (Инбокс)',
    color: 'green' as const,
    items: [
      {
        term: 'Поиск',
        def: 'Полнотекстовый поиск по заголовку и URL лида. Работает на клиенте мгновенно; поиск по сниппету — серверный запрос.',
      },
      {
        term: 'Фильтр по интенту',
        def: 'Горячий / Тёплый / Холодный. Ограничивает выборку по полю warmth. Рекомендуется начинать с «Горячих» для максимальной конверсии.',
      },
      {
        term: 'Фильтр по скору',
        def: 'Задайте диапазон Min–Max (0–100). Обычно осмысленно фильтровать от 60+.',
      },
      {
        term: 'Статус',
        def: 'Открытые / Одобренные / Шортлист / Отклонённые. Позволяет работать с очередью: сначала «открытые», затем — переработка «шортлиста».',
      },
      {
        term: 'Источник и страна',
        def: 'Частичное совпадение (ILIKE). Например, «reddit» покажет все Reddit-лиды; «US» — все из США.',
      },
    ],
  },
  {
    icon: Play,
    title: 'Как работает «Run Now» (Управление)',
    color: 'yellow' as const,
    items: [
      {
        term: 'Принцип работы',
        def: 'Нажатие на кнопку открывает диалог. После подтверждения параметров сервер вызывает Supabase Edge Function через service role key. Ответ — JSON-результат или ошибка.',
      },
      {
        term: 'Параметры',
        def: 'Стандартные: limitTasks (сколько задач обработать), lookbackHours (глубина в часах), minIntentForTask (мин. скор для создания задачи), maxActorAgeDays (макс. возраст профиля).',
      },
      {
        term: 'Расширенный JSON',
        def: 'Если нужно передать нестандартные параметры — используйте textarea «Расширенные параметры». Введите валидный JSON-объект, который будет смёржен с основными параметрами.',
      },
      {
        term: 'dry_run',
        def: 'У некоторых функций (digest) есть параметр dryRun=true — запустит генерацию без реальной отправки письма. Используйте для тестирования.',
      },
    ],
  },
  {
    icon: Info,
    title: 'Доказательства (Evidence)',
    color: 'none' as const,
    items: [
      {
        term: 'Что такое «доказательства»',
        def: 'Набор признаков, объясняющих, почему система посчитала запись лидом. Отображается в правой панели при открытии лида.',
      },
      {
        term: 'WTB / ISO / Searching',
        def: 'Фразы «Want to Buy», «In Search Of», «ищу», «куплю» — сильные сигналы покупательского намерения.',
      },
      {
        term: 'Контактный сигнал',
        def: 'Наличие email, Telegram, WhatsApp, призыва «DM me» или «write me» рядом с профилем.',
      },
      {
        term: 'Ключевое слово',
        def: 'Поисковый запрос или ключевое слово, по которому был найден лид. Чем точнее совпадение — тем выше доверие.',
      },
    ],
  },
  {
    icon: Shield,
    title: 'Безопасность токена',
    color: 'red' as const,
    items: [
      {
        term: 'Где хранить токен',
        def: 'Токен задаётся в переменной окружения FEYA_DASH_TOKEN на сервере (Vercel). Никогда не коммитьте его в git.',
      },
      {
        term: 'Первый вход',
        def: 'Добавьте ?t=ВАШ_ТОКЕН к URL. Токен сохраняется в httpOnly cookie на 7 дней. После этого входить без параметра.',
      },
      {
        term: 'Ротация токена',
        def: 'Смените FEYA_DASH_TOKEN в Vercel env, перезапустите деплой. Все существующие сессии станут недействительными.',
      },
      {
        term: 'Service Role Key',
        def: 'Ключ SUPABASE_SERVICE_ROLE_KEY используется только сервером. Никогда не попадает в браузер. Проверяйте через Network DevTools — там не должно быть этого ключа.',
      },
    ],
  },
]

export default function DocsPage() {
  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-neon-cyan" />
        <div>
          <h1 className="text-xl font-bold">Справка по FEYA Ops Console</h1>
          <p className="text-sm text-muted-foreground">Объяснение концепций, фильтров и управления</p>
        </div>
      </div>

      {sections.map((section) => {
        const Icon = section.icon
        return (
          <NeonCard key={section.title} glow={section.color}>
            <div className="flex items-center gap-2 mb-4">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">{section.title}</h2>
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <div key={item.term}>
                  <dt className="text-sm font-medium text-neon-cyan/90 mb-0.5">{item.term}</dt>
                  <dd className="text-sm text-muted-foreground leading-relaxed">{item.def}</dd>
                </div>
              ))}
            </div>
          </NeonCard>
        )
      })}

      {/* Quick links */}
      <NeonCard glow="cyan">
        <h2 className="font-semibold mb-3">Быстрые ссылки</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['/flow', 'Поток — мониторинг пайплайна'],
            ['/inbox', 'Инбокс — обработка лидов'],
            ['/analytics', 'Аналитика — графики и KPI'],
            ['/control', 'Управление — ручной запуск'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-2 text-neon-cyan/80 hover:text-neon-cyan transition-colors"
            >
              <span className="text-neon-cyan">→</span> {label}
            </a>
          ))}
        </div>
      </NeonCard>
    </div>
  )
}
