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

  if (q.includes('сколько') || q.includes('how many') || q.includes('total')) {
    const match = context.match(/(\d+) лидов/)
    if (match) return `По текущим данным: ${match[1]} лидов за выбранный период.`
  }

  if (q.includes('score') || q.includes('оценк')) {
    const match = context.match(/средний score ([\d.]+)/)
    if (match) return `Средний score в текущей выборке составляет ${match[1]}.`
  }

  if (q.includes('фильтр') || q.includes('filter')) {
    if (context.includes('Фильтры не активны')) return 'Фильтры не активны. Нажмите на элемент графика для детализации.'
    return `Активны следующие фильтры: ${context.match(/Активные фильтры: (.+?)\./)?.[1] ?? '—'}.`
  }

  return `[FEYA Copilot — stub] Контекст: ${context}\n\nВопрос принят. Для полноценного анализа подключите LLM-провайдера в /api/ai/analyze.`
}
