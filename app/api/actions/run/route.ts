import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import { callEdgeFunction, isAllowedFunction, ALLOWED_EDGE_FUNCTIONS } from '@/lib/api/actions'

export async function POST(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { function_name, payload = {} } = body as {
    function_name?: string
    payload?: Record<string, unknown>
  }

  if (!function_name) {
    return Response.json({ error: 'function_name is required' }, { status: 400 })
  }

  if (!isAllowedFunction(function_name)) {
    return Response.json(
      {
        error: `Function "${function_name}" not whitelisted. Allowed: ${ALLOWED_EDGE_FUNCTIONS.join(', ')}`,
      },
      { status: 403 }
    )
  }

  const result = await callEdgeFunction(function_name, payload as Record<string, unknown>)

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 })
  }

  return Response.json({ ok: true, data: result.data })
}
