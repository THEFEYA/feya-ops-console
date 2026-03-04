import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client — ONLY for server-side use.
 * Uses service role key — NEVER expose to browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Validate dashboard access token.
 * Tries gen.validate_dashboard_token RPC first; falls back to env var comparison.
 */
export async function validateDashboardToken(token: string): Promise<boolean> {
  if (!token) return false

  // Fast path: compare directly with env var (no RPC call needed)
  const envToken = process.env.FEYA_DASH_TOKEN
  if (envToken && token === envToken) return true

  // Skip RPC if token required=false
  if (process.env.FEYA_DASH_TOKEN_REQUIRED === 'false') return true

  // Try Supabase RPC fallback
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('validate_dashboard_token', {
      token,
    })
    if (!error && data === true) return true
  } catch {
    // RPC may not exist — fall through
  }

  return false
}
