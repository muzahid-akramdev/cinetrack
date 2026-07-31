/**
 * One-time (or occasional, manually-triggered) deep catalog backfill.
 *
 * Why this exists: the daily Vercel cron (lib/sync.ts -> buildSyncSteps) only
 * pulls ~5 pages (~100 items) per country/language per day, on purpose — that's
 * what fits inside Vercel Hobby's 10-second function timeout. A genuine
 * backfill of "everything TMDb has" for our tracked regions needs far more
 * than that, and needs to run somewhere with no such timeout.
 *
 * This script runs the same sync functions as lib/sync.ts (so row shapes,
 * upsert logic, and de-dup all stay identical to the daily job), but using
 * their *Deep variants, which walk TMDb's discover results one release year
 * at a time instead of a flat page count — see pagedYearChunked() in
 * lib/sync.ts for why that's necessary (TMDb caps any single discover query
 * at page 500 / 10,000 results, no matter how many pages you ask for).
 *
 * ---------------------------------------------------------------------
 * A full run (11 movie languages + 5 TV countries + English TV + OTT
 * platforms, each walked across ~95 years) is thousands of TMDb requests.
 * That can easily take longer than a single GitHub Actions run allows
 * (.github/workflows/full-sync.yml currently sets timeout-minutes: 300 = 5
 * hours). Two things make that OK to work with instead of a blocker:
 *
 *   1. Every *Deep sync function upserts to Supabase as each year's pages
 *      come back (see pagedYearChunked), not just once at the very end. If
 *      the job gets killed by the timeout partway through, everything
 *      fetched up to that point is already saved — nothing is lost, and
 *      simply re-running the workflow continues adding more.
 *
 *   2. You can split the work across multiple manually-triggered runs
 *      instead of needing it to finish in one sitting, using the
 *      workflow's `sources` and year-range inputs (see
 *      .github/workflows/full-sync.yml). For example:
 *        - Run 1: sources=movies, from_year=2015, to_year=2027
 *        - Run 2: sources=movies, from_year=1930, to_year=2014
 *        - Run 3: sources=tv,tv_lang,wikidata,ott
 *      Re-running with an overlapping or repeated range is always safe —
 *      every upsert is keyed on tmdb_id, so re-fetching a year you already
 *      did just re-writes the same rows rather than duplicating them.
 *
 * Run locally with:
 *   TMDB_API_ACCESS_TOKEN=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *   npx tsx scripts/full-sync.ts
 *
 * Optional env vars (also settable as GitHub Actions workflow_dispatch
 * inputs — see the workflow file):
 *   FULL_SYNC_SOURCES   comma list from: trending,tv,tv_lang,wikidata,ott,movies
 *                       (default: all of them)
 *   FULL_SYNC_FROM_YEAR first release/air year to include (default: 1930)
 *   FULL_SYNC_TO_YEAR   last release/air year to include (default: next year)
 */

import { createAdminClient } from '../lib/supabase/admin'
import * as tmdb from '../lib/tmdb'
import {
  syncTrendingAndPopular,
  syncRegionalTVDeep,
  syncRegionalTVByLanguageDeep,
  syncRegionalTVFromWikidata,
  syncRegionalMoviesDeep,
  syncByWatchProvidersDeep,
  type YearRange,
} from '../lib/sync'

// See lib/tmdb.ts: TMDb/JustWatch don't reliably expose `BD` as a discover
// watch region, so these Bengali OTT platforms are looked up under `IN`,
// which does carry them.
const OTT_WATCH_REGION = 'IN'
const OTT_PROVIDER_NAMES = ['hoichoi', 'Chorki', 'Zee5', 'Bongo', 'Addatimes']

const ALL_SOURCES = ['trending', 'tv', 'tv_lang', 'wikidata', 'ott', 'movies'] as const
type Source = (typeof ALL_SOURCES)[number]

function parseSources(): Set<Source> {
  const raw = process.env.FULL_SYNC_SOURCES?.trim()
  if (!raw || raw.toLowerCase() === 'all') return new Set(ALL_SOURCES)
  const requested = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const invalid = requested.filter((s) => !ALL_SOURCES.includes(s as Source))
  if (invalid.length) {
    console.error(`Unknown FULL_SYNC_SOURCES value(s): ${invalid.join(', ')}. Valid: ${ALL_SOURCES.join(', ')}`)
    process.exit(1)
  }
  return new Set(requested as Source[])
}

function parseYearRange(): YearRange {
  const fromYear = process.env.FULL_SYNC_FROM_YEAR ? Number(process.env.FULL_SYNC_FROM_YEAR) : undefined
  const toYear = process.env.FULL_SYNC_TO_YEAR ? Number(process.env.FULL_SYNC_TO_YEAR) : undefined
  if (fromYear !== undefined && Number.isNaN(fromYear)) {
    console.error(`FULL_SYNC_FROM_YEAR is not a number: ${process.env.FULL_SYNC_FROM_YEAR}`)
    process.exit(1)
  }
  if (toYear !== undefined && Number.isNaN(toYear)) {
    console.error(`FULL_SYNC_TO_YEAR is not a number: ${process.env.FULL_SYNC_TO_YEAR}`)
    process.exit(1)
  }
  return { fromYear, toYear }
}

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

  const sources = parseSources()
  const range = parseYearRange()

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

  console.log(
    `[full-sync] starting. sources=${[...sources].join(',')} ` +
      `years=${range.fromYear ?? 1930}-${range.toYear ?? new Date().getFullYear() + 1}`
  )

  if (sources.has('trending')) {
    await step('trending_and_popular', () => syncTrendingAndPopular(supabase))
  }

  // TV, by origin country (Korean, Turkish, Indian, Pakistani, Bangladeshi productions)
  if (sources.has('tv')) {
    for (const country of tmdb.TV_ORIGIN_COUNTRIES) {
      await step(`tv_${country}`, () => syncRegionalTVDeep(supabase, country, range))
    }
  }

  // TV, by original language (currently just English — see lib/tmdb.ts)
  if (sources.has('tv_lang')) {
    for (const lang of tmdb.TV_ORIGINAL_LANGUAGES) {
      await step(`tv_lang_${lang}`, () => syncRegionalTVByLanguageDeep(supabase, lang, range))
    }
  }

  if (sources.has('wikidata')) {
    for (const country of tmdb.TV_ORIGIN_COUNTRIES) {
      await step(`tv_wikidata_${country}`, () => syncRegionalTVFromWikidata(supabase, country))
    }
  }

  // Bengali OTT platforms TMDb's language/country metadata alone misses (see complaint #2)
  if (sources.has('ott')) {
    await step('ott_movies_bd', () => syncByWatchProvidersDeep(supabase, 'movie', OTT_WATCH_REGION, OTT_PROVIDER_NAMES, range))
    await step('ott_tv_bd', () => syncByWatchProvidersDeep(supabase, 'tv', OTT_WATCH_REGION, OTT_PROVIDER_NAMES, range))
  }

  // Movies, by original language (now includes 'en' — see lib/tmdb.ts)
  if (sources.has('movies')) {
    for (const lang of tmdb.MOVIE_ORIGINAL_LANGUAGES) {
      await step(`movies_${lang}`, () => syncRegionalMoviesDeep(supabase, lang, range))
    }
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
