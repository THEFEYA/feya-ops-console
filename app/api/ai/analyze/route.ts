import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: { question?: string; context?: string; filters?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { question, context } = body
  if (!question) {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }

  // Stub: compose a simple heuristic answer from the context
  const answer = composeAnswer(String(question), String(context ?? ''))

  return Response.json({ answer, stub: true })
}

function composeAnswer(question: string, context: string): string {
  const q = question.toLowerCase()

  if (q.includes('сколько') || q.includes('how many') || q.includes('total') || q.includes('всего')) {
    const match = context.match(/(\d[\d\s]*) лидов/)
    if (match) return `По текущим данным: ${match[1].trim()} лидов за выбранный период.`
  }

  if (q.includes('score') || q.includes('оценк') || q.includes('скор')) {
    const match = context.match(/средний score ([\d.]+)/)
    if (match) return `Средний score в текущей выборке составляет ${match[1]}.`
  }

  if (q.includes('фильтр') || q.includes('filter')) {
    if (context.includes('Фильтры не активны')) return 'Фильтры не активны. Кликните на элемент графика для детализации.'
    const active = context.match(/Активные фильтры: (.+?)\./)?.[1] ?? '—'
    return `Активны следующие фильтры: ${active}. Нажмите «Сбросить всё» в строке фильтров для очистки.`
  }

  if (q.includes('источник') || q.includes('source')) {
    const match = context.match(/Топ-источники: (.+?)\./)
    if (match) return `Топ-источники в текущей выборке: ${match[1]}.`
  }

  if (q.includes('событи') || q.includes('event')) {
    const match = context.match(/Топ-события: (.+?)\./)
    if (match) return `Топ-события: ${match[1]}.`
  }

  if (q.includes('интент') || q.includes('warmth') || q.includes('горяч')) {
    const match = context.match(/Интент: (.+?)\./)
    if (match) return `Распределение интента: ${match[1]}.`
  }

  if (q.includes('рекоменд') || q.includes('совет') || q.includes('что делать')) {
    const scoreMatcher = context.match(/средний score ([\d.]+)/)
    const score = scoreMatcher ? Number(scoreMatcher[1]) : 0
    if (score < 40) return 'Средний score низкий. Рекомендую проверить качество источников данных и уточнить фильтры поиска.'
    if (score >= 70) return 'Высокий средний score — лиды качественные. Приоритизируйте обработку «горячих» лидов из топовых источников.'
    return 'Средний score умеренный. Рекомендую отфильтровать по горячему интенту и сосредоточиться на топ-источниках.'
  }

  // Fallback with full context
  return `На основе текущих данных:\n${context}\n\n⚠️ Это stub-ответ. Для полноценного AI-анализа подключите LLM-провайдера в /api/ai/analyze.`
}
