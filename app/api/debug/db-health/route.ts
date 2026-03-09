/**
 * GET /api/debug/db-health
 *
 * Checks that the DB schema matches the contract in docs/feya/06_SCHEMA_CONTRACT.md.
 * No auth required — returns structural info only, no row data.
 *
 * Response: { ok: boolean, missing: string[], details: Record<string, unknown> }
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Columns that MUST exist in lead_outcomes
const REQUIRED_COLUMNS = ['id', 'lead_id', 'stage', 'created_at'] as const

// Views that MUST exist
const REQUIRED_VIEWS = ['v_source_funnel_daily'] as const

export async function GET() {
  const sb = createAdminClient()
  const missing: string[] = []
  const details: Record<string, unknown> = {}

  try {
    // 1. Check lead_outcomes columns via information_schema
    const { data: cols, error: colErr } = await sb
      .from('information_schema.columns' as never)
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'lead_outcomes')

    if (colErr) {
      details.columns_error = colErr.message
    } else {
      const found = new Set((cols as { column_name: string }[]).map((c) => c.column_name))
      details.lead_outcomes_columns = Array.from(found)
      for (const col of REQUIRED_COLUMNS) {
        if (!found.has(col)) missing.push(`lead_outcomes.${col}`)
      }
    }

    // 2. Check required views via information_schema
    const { data: views, error: viewErr } = await sb
      .from('information_schema.views' as never)
      .select('table_name')
      .eq('table_schema', 'public')

    if (viewErr) {
      details.views_error = viewErr.message
    } else {
      const foundViews = new Set((views as { table_name: string }[]).map((v) => v.table_name))
      details.views_found = Array.from(foundViews)
      for (const view of REQUIRED_VIEWS) {
        if (!foundViews.has(view)) missing.push(`view:${view}`)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, missing: ['unknown — query failed'], details: { error: msg } }, { status: 500 })
  }

  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    details,
  })
}
