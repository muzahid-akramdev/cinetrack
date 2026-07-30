/**
 * One-time (or occasional, manually-triggered) deep catalog backfill.
 *
 * Why this exists: the daily Vercel cron (lib/sync.ts -> buildSyncSteps) only
 * pulls ~5 pages (~100 items) per country/language per day, on purpose — that's
 * what fits inside Vercel Hobby's 10-second function timeout. A genuine
 * backfill of "everything TMDb has" for our tracked regions needs far more
 * pages than that, and needs to run somewhere with no such timeout.
 *
 * This script runs the SAME sync functions from lib/sync.ts (so row shapes,
 * upsert logic, and de-dup all stay identical to the daily job) but with a
 * much larger maxPages, from GitHub Actions instead of Vercel. GitHub Actions
 * free tier gives each job up to 6 hours, which is more than enough.
 *
 * Run locally with:
 *   TMDB_API_ACCESS_TOKEN=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *   npx tsx scripts/full-sync.ts
 *
 * In CI, these come from GitHub Actions secrets — see
 * .github/workflows/full-sync.yml.
 */

import { createAdminClient } from '../lib/supabase/admin'
import * as tmdb from '../lib/tmdb'
import {
  syncTrendingAndPopular,
  syncRegionalTV,
  syncRegionalTVFromWikidata,
  syncRegionalMovies,
} from '../lib/sync'

// How many discover pages to pull per region/language during the deep
// backfill. TMDb pages are 20 items each, so 40 pages ~= 800 titles per
// language/country — comfortably more than the daily job's 5-page skim.
// Raise this if you want to go even deeper; TMDb discover maxes out around
// page 500 for very broad queries.
const DEEP_MAX_PAGES = 40

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

async function main() {
  requireEnv('TMDB_API_ACCESS_TOKEN')
  requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createAdminClient()
  const startedAt = new Date().toISOString()
  let rowsProcessed = 0
  const errors: string[] = []

  const step = async (name: string, fn: () => Promise<number>) => {
    const t0 = Date.now()
    try {
      const n = await fn()
      rowsProcessed += n
      console.log(`[full-sync] ${name}: ${n} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${name}: ${msg}`)
      console.error(`[full-sync] ${name} FAILED:`, msg)
    }
  }

  console.log(`[full-sync] starting deep backfill, maxPages=${DEEP_MAX_PAGES}`)

  await step('trending_and_popular', () => syncTrendingAndPopular(supabase))

  for (const country of tmdb.TV_ORIGIN_COUNTRIES) {
    await step(`tv_${country}`, () => syncRegionalTV(supabase, country, DEEP_MAX_PAGES))
  }
  for (const country of tmdb.TV_ORIGIN_COUNTRIES) {
    await step(`tv_wikidata_${country}`, () => syncRegionalTVFromWikidata(supabase, country))
  }
  for (const lang of tmdb.MOVIE_ORIGINAL_LANGUAGES) {
    await step(`movies_${lang}`, () => syncRegionalMovies(supabase, lang, DEEP_MAX_PAGES))
  }

  await supabase.from('sync_logs').insert({
    source: 'full_sync_github_actions',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    rows_processed: rowsProcessed,
    status: errors.length ? 'error' : 'success',
    error_message: errors.length ? errors.join(' | ') : null,
  })

  console.log(`[full-sync] done. rowsProcessed=${rowsProcessed} errors=${errors.length}`)
  if (errors.length) {
    console.error('[full-sync] errors:', errors)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('[full-sync] fatal error:', e)
  process.exit(1)
})
