import { createAdminClient } from './supabase/admin'
import * as tmdb from './tmdb'
import { getOmdbRatingByImdbId } from './omdb'
import { searchTVSeriesByCountry, getWikipediaSummary, wikidataSleep } from './wikidata'
import type {
  TmdbMovieDetails,
  TmdbTVDetails,
  TmdbMovieListItem,
  TmdbTVListItem,
  TmdbCreditsCastMember,
  TmdbCreditsCrewMember,
} from '@/types/tmdb'

type AdminClient = ReturnType<typeof createAdminClient>

// ---------------------------------------------------------
// Row mapping — TMDb response shapes -> our table columns
// ---------------------------------------------------------

function movieRowFromDetails(m: TmdbMovieDetails) {
  return {
    tmdb_id: m.id,
    imdb_id: m.imdb_id ?? m.external_ids?.imdb_id ?? null,
    title: m.title,
    original_title: m.original_title,
    original_language: m.original_language,
    overview: m.overview,
    release_date: m.release_date || null,
    runtime: m.runtime,
    genres: (m.genres ?? []).map((g) => g.name),
    countries: (m.production_countries ?? []).map((c) => c.iso_3166_1),
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    tmdb_rating: m.vote_average,
    tmdb_vote_count: m.vote_count,
    popularity: m.popularity ?? 0,
    updated_at: new Date().toISOString(),
  }
}

function movieRowFromListItem(m: TmdbMovieListItem) {
  return {
    tmdb_id: m.id,
    title: m.title,
    original_title: m.original_title,
    original_language: m.original_language,
    overview: m.overview,
    release_date: m.release_date || null,
    genres: m.genre_ids.map((id) => tmdb.MOVIE_GENRE_MAP[id]).filter((g): g is string => Boolean(g)),
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    tmdb_rating: m.vote_average,
    tmdb_vote_count: m.vote_count,
    popularity: m.popularity ?? 0,
    updated_at: new Date().toISOString(),
  }
}

function tvRowFromDetails(t: TmdbTVDetails) {
  return {
    tmdb_id: t.id,
    imdb_id: t.external_ids?.imdb_id ?? null,
    name: t.name,
    original_name: t.original_name,
    original_language: t.original_language,
    overview: t.overview,
    first_air_date: t.first_air_date || null,
    genres: (t.genres ?? []).map((g) => g.name),
    origin_country: t.origin_country ?? [],
    poster_path: t.poster_path,
    backdrop_path: t.backdrop_path,
    number_of_seasons: t.number_of_seasons,
    number_of_episodes: t.number_of_episodes,
    status: t.status,
    tmdb_rating: t.vote_average,
    tmdb_vote_count: t.vote_count,
    popularity: t.popularity ?? 0,
    updated_at: new Date().toISOString(),
  }
}

function tvRowFromListItem(t: TmdbTVListItem) {
  return {
    tmdb_id: t.id,
    name: t.name,
    original_name: t.original_name,
    original_language: t.original_language,
    overview: t.overview,
    first_air_date: t.first_air_date || null,
    genres: t.genre_ids.map((id) => tmdb.TV_GENRE_MAP[id]).filter((g): g is string => Boolean(g)),
    origin_country: t.origin_country ?? [],
    poster_path: t.poster_path,
    backdrop_path: t.backdrop_path,
    popularity: t.popularity ?? 0,
    tmdb_rating: t.vote_average,
    tmdb_vote_count: t.vote_count,
    updated_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------
// Upserts
// ---------------------------------------------------------

export async function upsertMovieFromDetails(supabase: AdminClient, tmdbId: number) {
  const details = await tmdb.getMovieDetails(tmdbId)
  const row = movieRowFromDetails(details)

  // Optional secondary source: only runs if OMDB_API_KEY is set, and never
  // throws if it isn't or if the lookup fails — see lib/omdb.ts.
  const imdbId = row.imdb_id
  if (imdbId) {
    const omdb = await getOmdbRatingByImdbId(imdbId)
    Object.assign(row, { imdb_rating: omdb.imdbRating, imdb_vote_count: omdb.imdbVoteCount })
  }

  const { data, error } = await supabase.from('movies').upsert(row, { onConflict: 'tmdb_id' }).select('id').single()
  if (error) throw error
  await upsertCredits(supabase, { movieId: data.id, credits: details.credits })
  return data.id as string
}

export async function upsertMovieFromListItem(supabase: AdminClient, item: TmdbMovieListItem) {
  const { error } = await supabase.from('movies').upsert(movieRowFromListItem(item), { onConflict: 'tmdb_id' })
  if (error) throw error
}

export async function upsertTVFromDetails(supabase: AdminClient, tmdbId: number) {
  const details = await tmdb.getTVDetails(tmdbId)
  const row = tvRowFromDetails(details)

  const imdbId = row.imdb_id
  if (imdbId) {
    const omdb = await getOmdbRatingByImdbId(imdbId)
    Object.assign(row, { imdb_rating: omdb.imdbRating, imdb_vote_count: omdb.imdbVoteCount })
  }

  const { data, error } = await supabase.from('tv_shows').upsert(row, { onConflict: 'tmdb_id' }).select('id').single()
  if (error) throw error
  await upsertCredits(supabase, { tvShowId: data.id, credits: details.credits })
  return data.id as string
}

export async function upsertTVFromListItem(supabase: AdminClient, item: TmdbTVListItem) {
  const { error } = await supabase.from('tv_shows').upsert(tvRowFromListItem(item), { onConflict: 'tmdb_id' })
  if (error) throw error
}

async function upsertCredits(
  supabase: AdminClient,
  opts: { movieId?: string; tvShowId?: string; credits?: { cast: TmdbCreditsCastMember[]; crew: TmdbCreditsCrewMember[] } }
) {
  if (!opts.credits) return
  const parentColumn = opts.movieId ? 'movie_id' : 'tv_show_id'
  const parentId = opts.movieId ?? opts.tvShowId

  // Replace credits wholesale on refresh — simplest correct approach, since
  // credits carry no user data and cast lists rarely change after release.
  await supabase.from('credits').delete().eq(parentColumn, parentId!)

  const rows: Record<string, unknown>[] = []
  for (const c of (opts.credits.cast ?? []).slice(0, 20)) {
    const personId = await ensurePerson(supabase, c)
    rows.push({ person_id: personId, [parentColumn]: parentId, role: 'cast', character_name: c.character, sort_order: c.order })
  }
  const keyCrewJobs = new Set(['Director', 'Creator', 'Writer'])
  for (const c of (opts.credits.crew ?? []).filter((c) => keyCrewJobs.has(c.job)).slice(0, 10)) {
    const personId = await ensurePerson(supabase, c)
    rows.push({ person_id: personId, [parentColumn]: parentId, role: 'crew', job: c.job, sort_order: 0 })
  }
  if (rows.length) {
    const { error } = await supabase.from('credits').insert(rows)
    if (error) throw error
  }
}

async function ensurePerson(
  supabase: AdminClient,
  person: { id: number; name: string; profile_path?: string | null; known_for_department?: string }
) {
  const { data, error } = await supabase
    .from('people')
    .upsert(
      { tmdb_id: person.id, name: person.name, profile_path: person.profile_path ?? null, known_for_department: person.known_for_department ?? null },
      { onConflict: 'tmdb_id' }
    )
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

// ---------------------------------------------------------
// Lazy season/episode loading
//
// The bulk sync below only upserts show-level metadata for the regional
// discover sweeps — fetching every season/episode for every show across five
// regions during one daily job would multiply the TMDb call count far past
// what's needed. Instead, full season/episode depth is fetched the moment
// someone actually opens a show's detail page (same "fetch what's actually
// being looked at" idea as the search fallback below, just applied one
// level deeper). ensureSeasonsLoaded() is called from app/tv/[id]/page.tsx.
// ---------------------------------------------------------

export async function ensureSeasonsLoaded(showId: string, showTmdbId: number, seasonsSyncedAt: string | null, numberOfSeasons: number) {
  const staleMs = 30 * 24 * 60 * 60 * 1000
  const isFresh = seasonsSyncedAt && Date.now() - new Date(seasonsSyncedAt).getTime() < staleMs
  if (isFresh) return

  const supabase = createAdminClient()
  for (let n = 1; n <= Math.max(numberOfSeasons, 1); n++) {
    try {
      const season = await tmdb.getSeasonDetails(showTmdbId, n)
      const { data: seasonRow, error: seasonError } = await supabase
        .from('seasons')
        .upsert(
          {
            tv_show_id: showId,
            tmdb_id: season.id,
            season_number: season.season_number,
            name: season.name,
            air_date: season.air_date || null,
            episode_count: season.episodes.length,
          },
          { onConflict: 'tv_show_id,season_number' }
        )
        .select('id')
        .single()
      if (seasonError) throw seasonError

      const episodeRows = season.episodes.map((e) => ({
        season_id: seasonRow.id,
        tmdb_id: e.id,
        episode_number: e.episode_number,
        name: e.name,
        air_date: e.air_date || null,
        overview: e.overview,
        runtime: e.runtime,
        tmdb_rating: e.vote_average,
        tmdb_vote_count: e.vote_count,
      }))
      if (episodeRows.length) {
        await supabase.from('episodes').upsert(episodeRows, { onConflict: 'season_id,episode_number' })
      }
    } catch (e) {
      // A single bad season shouldn't block the rest of the show.
      console.error(`[sync] failed to load season ${n} of show tmdb:${showTmdbId}`, e)
    }
    await tmdb.sleep(250)
  }

  await supabase.from('tv_shows').update({ seasons_synced_at: new Date().toISOString() }).eq('id', showId)
}

// ---------------------------------------------------------
// Fetch-on-search-miss
// ---------------------------------------------------------

export async function fetchOnSearchMiss(query: string) {
  const supabase = createAdminClient()
  const [movieResults, tvResults] = await Promise.all([tmdb.searchMovies(query), tmdb.searchTV(query)])

  const movieOutcomes = await Promise.allSettled(movieResults.results.slice(0, 5).map((m) => upsertMovieFromDetails(supabase, m.id)))
  const tvOutcomes = await Promise.allSettled(tvResults.results.slice(0, 5).map((t) => upsertTVFromDetails(supabase, t.id)))

  return {
    movieIds: movieOutcomes.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map((r) => r.value),
    tvIds: tvOutcomes.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map((r) => r.value),
  }
}
// ---------------------------------------------------------
// Bulk sync (daily cron)
// ---------------------------------------------------------

async function paged<T>(fetchPage: (page: number) => Promise<{ results: T[]; total_pages: number }>, maxPages: number) {
  const items: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchPage(page)
    items.push(...res.results)
    if (page >= res.total_pages) break
    await tmdb.sleep(300)
  }
  return items
}

/**
 * Exhaustive alternative to paged(): walks one release year at a time
 * instead of trusting a single maxPages ceiling.
 *
 * The real reason the old deep backfill topped out at ~800 titles per
 * language/country wasn't just that DEEP_MAX_PAGES was 40 — even raising
 * that number only helps up to a point, because TMDb's /discover endpoints
 * never return past page 500 (10,000 results) for a single query,
 * regardless of how many pages you ask for. A broad bucket like "all Hindi
 * movies" or "all English TV shows" has far more than 10,000 titles, so a
 * flat maxPages — even a generous one — silently drops everything TMDb
 * would have returned past that cap.
 *
 * Splitting the same query by release year keeps each individual request's
 * total_pages well under 500, so nothing gets dropped. Used only by the
 * GitHub Actions deep backfill (scripts/full-sync.ts), never by the daily
 * Vercel cron step — a full year-by-year walk per language/country is far
 * too slow for a 10s/60s function budget, but is exactly what full-sync's
 * uncapped GitHub Actions runtime is for.
 *
 * IMPORTANT: unlike paged(), this does NOT return one big array for the
 * caller to upsert at the end. `onBatch` is awaited after every single
 * page, writing straight to Supabase as results come in. A full run across
 * ~11 languages x ~95 years is easily multiple hours — if it ran fully
 * in-memory and only upserted once at the very end of each language, a job
 * that gets killed by GitHub Actions' timeout-minutes partway through would
 * lose that entire language's progress. Upserting per page means whatever
 * has been fetched by the time the job stops is already saved — safe to
 * just re-run the workflow later (see scripts/full-sync.ts for
 * from-year/to-year inputs that let you split the work across runs).
 */
async function pagedYearChunked<T>(
  fetchPage: (page: number, year: number) => Promise<{ results: T[]; total_pages: number }>,
  onBatch: (items: T[]) => Promise<void>,
  opts: { fromYear?: number; toYear?: number } = {}
) {
  const fromYear = opts.fromYear ?? 1930
  const toYear = opts.toYear ?? new Date().getFullYear() + 1
  let total = 0

  for (let year = toYear; year >= fromYear; year--) {
    let page = 1
    while (true) {
      const res = await fetchPage(page, year)
      if (res.results.length) {
        await onBatch(res.results)
        total += res.results.length
      }
      if (page >= res.total_pages || res.total_pages === 0) break
      page++
      await tmdb.sleep(300)
    }
    await tmdb.sleep(300)
  }
  return total
}

// Batched versions of the single-item upserts above. One round-trip per
// call instead of one per row. This is the actual fix for the step=19
// timeouts: TMDb latency was never the bottleneck — awaiting
// upsertMovieFromListItem in a per-item loop across ~100 rows meant ~100
// separate Supabase round-trips inside a single 10s Vercel Hobby invocation.
async function upsertMoviesFromListItems(supabase: AdminClient, items: TmdbMovieListItem[]) {
  if (!items.length) return
  const { error } = await supabase.from('movies').upsert(items.map(movieRowFromListItem), { onConflict: 'tmdb_id' })
  if (error) throw error
}
async function upsertTVListFromItems(supabase: AdminClient, items: TmdbTVListItem[]) {
  if (!items.length) return
  const { error } = await supabase.from('tv_shows').upsert(items.map(tvRowFromListItem), { onConflict: 'tmdb_id' })
  if (error) throw error
}

export async function syncTrendingAndPopular(supabase: AdminClient) {
  const [trendMovies, trendTV, popMovies, popTV] = await Promise.all([
    tmdb.getTrendingMovies('week'),
    tmdb.getTrendingTV('week'),
    paged((p) => tmdb.getPopularMovies(p), 3),
    paged((p) => tmdb.getPopularTV(p), 3),
  ])

  await upsertMoviesFromListItems(supabase, trendMovies.results)
  await upsertTVListFromItems(supabase, trendTV.results)
  await upsertMoviesFromListItems(supabase, popMovies)
  await upsertTVListFromItems(supabase, popTV)

  return trendMovies.results.length + trendTV.results.length + popMovies.length + popTV.length
}

/** maxPages defaults small so a single call fits Vercel's 10s Hobby cap for
 * the daily cron step. scripts/full-sync.ts (run via GitHub Actions, no
 * time limit) calls this with a much larger maxPages for the one-time deep
 * backfill, reusing the same batched-upsert logic. */
export async function syncRegionalTV(supabase: AdminClient, countryCode: string, maxPages = 5) {
  const items = await paged((p) => tmdb.discoverTVByOriginCountry(countryCode, p), maxPages)
  await upsertTVListFromItems(supabase, items)
  return items.length
}

/** Optional sub-range for the *Deep sync functions — lets scripts/full-sync.ts
 * split an otherwise multi-hour run across several manually-triggered
 * GitHub Actions runs (e.g. one run for 2015-2027, another for 1930-2014)
 * instead of needing it to finish start-to-end in a single invocation. */
export type YearRange = { fromYear?: number; toYear?: number }

/** Year-chunked, uncapped version of syncRegionalTV — used only by
 * scripts/full-sync.ts. See pagedYearChunked() for why this replaces a flat
 * maxPages for the deep backfill. Upserts as each year's page comes back
 * (see pagedYearChunked) rather than only at the end. */
export async function syncRegionalTVDeep(supabase: AdminClient, countryCode: string, range: YearRange = {}) {
  return pagedYearChunked(
    (page, year) => tmdb.discoverTVByOriginCountry(countryCode, page, { first_air_date_year: year }),
    (items) => upsertTVListFromItems(supabase, items),
    range
  )
}

/**
 * Tertiary source for the gap TMDb/OMDb leave: fills in TV series that
 * have a Wikipedia article and a Wikidata "country of origin" match, but
 * that TMDb's contributor base hasn't added — the exact case the spec
 * flagged for Bangladesh in particular. See lib/wikidata.ts for the
 * caveats (this is the one part of the sync I couldn't test live).
 */
export async function syncRegionalTVFromWikidata(supabase: AdminClient, countryCode: string) {
  const results = await searchTVSeriesByCountry(countryCode, 40)
  let count = 0

  for (const result of results) {
    try {
      // Cheap de-dup: skip if a show with this exact name is already in the
      // catalog (from TMDb or an earlier Wikidata pass). Won't catch
      // near-duplicates with different romanization, but avoids the most
      // obvious case of listing the same drama twice.
      const { data: existingByName } = await supabase.from('tv_shows').select('id').ilike('name', result.label).maybeSingle()
      const { data: existingByWikidata } = await supabase.from('tv_shows').select('id').eq('wikidata_id', result.wikidataId).maybeSingle()
      if (existingByName || existingByWikidata) continue

      const summary = await getWikipediaSummary(result.wikipediaTitle)

      const { error } = await supabase.from('tv_shows').upsert(
        {
          wikidata_id: result.wikidataId,
          source: 'wikidata',
          name: result.label,
          original_name: result.label,
          overview: summary.extract,
          origin_country: [countryCode],
          poster_path: summary.thumbnailUrl, // full URL, not a TMDb-style path — handled in the UI
          popularity: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'wikidata_id' }
      )
      if (error) throw error
      count++
    } catch (e) {
      console.error(`[sync] wikidata upsert failed for ${result.label}`, e)
    }
    await wikidataSleep(200)
  }

  return count
}

export async function syncRegionalMovies(supabase: AdminClient, languageCode: string, maxPages = 5) {
  const items = await paged((p) => tmdb.discoverMoviesByLanguage(languageCode, p), maxPages)
  await upsertMoviesFromListItems(supabase, items)
  return items.length
}

/** Same source as syncRegionalMovies, but walks every release year so the
 * result isn't capped at TMDb's 10,000-result-per-query ceiling. See
 * pagedYearChunked() for why. Used only by scripts/full-sync.ts. */
export async function syncRegionalMoviesDeep(supabase: AdminClient, languageCode: string, range: YearRange = {}) {
  return pagedYearChunked(
    (page, year) => tmdb.discoverMoviesByLanguage(languageCode, page, { primary_release_year: year }),
    (items) => upsertMoviesFromListItems(supabase, items),
    range
  )
}

/** English-original TV shows, swept by language (not origin country) since
 * English TV comes out of the US, UK, Canada, Australia, Ireland, etc. —
 * see the note on TV_ORIGINAL_LANGUAGES in lib/tmdb.ts. */
export async function syncRegionalTVByLanguage(supabase: AdminClient, languageCode: string, maxPages = 5) {
  const items = await paged((p) => tmdb.discoverTVByLanguage(languageCode, p), maxPages)
  await upsertTVListFromItems(supabase, items)
  return items.length
}

/** Year-chunked, uncapped version of syncRegionalTVByLanguage — used only by
 * scripts/full-sync.ts. */
export async function syncRegionalTVByLanguageDeep(supabase: AdminClient, languageCode: string, range: YearRange = {}) {
  return pagedYearChunked(
    (page, year) => tmdb.discoverTVByLanguage(languageCode, page, { first_air_date_year: year }),
    (items) => upsertTVListFromItems(supabase, items),
    range
  )
}

/**
 * Fills the gap behind complaint #2: plenty of popular Bengali OTT titles
 * (hoichoi, Chorki, Zee5, Bongo, Addatimes originals) never surface from the
 * language/country sweeps above because TMDb's `original_language`/
 * `origin_country` metadata for them is inconsistent — but TMDb *does* know
 * which watch provider they're on. Discovering directly by watch provider
 * catches those. `watchRegion` should be a region TMDb/JustWatch actually
 * covers for these platforms — currently that's `IN`, not `BD` (see
 * lib/tmdb.ts). Returns 0 (and logs a warning) if none of `providerNames`
 * resolve to a real provider id for that region, rather than throwing —
 * provider coverage shifts over time and shouldn't fail the whole sync run.
 */
export async function syncByWatchProviders(
  supabase: AdminClient,
  mediaType: 'movie' | 'tv',
  watchRegion: string,
  providerNames: string[],
  maxPages = 10
) {
  const ids = await tmdb.resolveWatchProviderIds(mediaType, watchRegion, providerNames)
  if (!ids.length) {
    console.warn(`[sync] no TMDb watch providers matched region=${watchRegion} names=${providerNames.join(', ')}`)
    return 0
  }
  if (mediaType === 'movie') {
    const items = await paged((p) => tmdb.discoverMoviesByWatchProviders(watchRegion, ids, p), maxPages)
    await upsertMoviesFromListItems(supabase, items)
    return items.length
  }
  const items = await paged((p) => tmdb.discoverTVByWatchProviders(watchRegion, ids, p), maxPages)
  await upsertTVListFromItems(supabase, items)
  return items.length
}

/** Year-chunked, uncapped version of syncByWatchProviders — used only by
 * scripts/full-sync.ts. */
export async function syncByWatchProvidersDeep(
  supabase: AdminClient,
  mediaType: 'movie' | 'tv',
  watchRegion: string,
  providerNames: string[],
  range: YearRange = {}
) {
  const ids = await tmdb.resolveWatchProviderIds(mediaType, watchRegion, providerNames)
  if (!ids.length) {
    console.warn(`[sync] no TMDb watch providers matched region=${watchRegion} names=${providerNames.join(', ')}`)
    return 0
  }
  if (mediaType === 'movie') {
    return pagedYearChunked(
      (page, year) => tmdb.discoverMoviesByWatchProviders(watchRegion, ids, page, { primary_release_year: year }),
      (items) => upsertMoviesFromListItems(supabase, items),
      range
    )
  }
  return pagedYearChunked(
    (page, year) => tmdb.discoverTVByWatchProviders(watchRegion, ids, page, { first_air_date_year: year }),
    (items) => upsertTVListFromItems(supabase, items),
    range
  )
}

export async function refreshStale(supabase: AdminClient) {
  const staleCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  let count = 0

  // Only TMDb-sourced rows can be refreshed this way — Wikidata/manual rows
  // have no tmdb_id to look up (`.not('tmdb_id', 'is', null)` excludes them).
  const { data: staleMovies } = await supabase.from('movies').select('id, tmdb_id').not('tmdb_id', 'is', null).lt('updated_at', staleCutoff).limit(50)
  for (const m of staleMovies ?? []) {
    try {
      await upsertMovieFromDetails(supabase, m.tmdb_id!)
      count++
    } catch (e) {
      console.error('[sync] refresh movie failed', m.tmdb_id, e)
    }
    await tmdb.sleep(300)
  }

  const { data: staleTV } = await supabase.from('tv_shows').select('id, tmdb_id').not('tmdb_id', 'is', null).lt('updated_at', staleCutoff).limit(50)
  for (const t of staleTV ?? []) {
    try {
      await upsertTVFromDetails(supabase, t.tmdb_id!)
      count++
    } catch (e) {
      console.error('[sync] refresh tv failed', t.tmdb_id, e)
    }
    await tmdb.sleep(300)
  }

  return count
}

/**
 * Incremental refresh via TMDb's /movie/changes and /tv/changes. These
 * endpoints return ids that changed in a date window, with no
 * language/region attached — so instead of re-running the full regional
 * discover sweep, we only re-fetch full details for ids that are ALREADY in
 * our catalog (an existing row means it once matched one of our tracked
 * languages/countries; a changed row is worth refreshing). New titles that
 * haven't been discovered yet still come in through the regional steps
 * above — this step is purely about keeping already-known rows fresh
 * without re-walking the discover sweeps every day.
 */
export async function syncIncrementalChanges(supabase: AdminClient) {
  const end = new Date()
  const start = new Date(end.getTime() - 2 * 24 * 60 * 60 * 1000) // 2-day window, overlaps the previous run on purpose
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const [movieChanges, tvChanges] = await Promise.all([
    tmdb.getMovieChangeIds(fmt(start), fmt(end)),
    tmdb.getTVChangeIds(fmt(start), fmt(end)),
  ])
  const changedMovieIds = movieChanges.results.map((r) => r.id)
  const changedTVIds = tvChanges.results.map((r) => r.id)

  const [{ data: knownMovies }, { data: knownTV }] = await Promise.all([
    changedMovieIds.length
      ? supabase.from('movies').select('tmdb_id').in('tmdb_id', changedMovieIds)
      : Promise.resolve({ data: [] as { tmdb_id: number }[] }),
    changedTVIds.length
      ? supabase.from('tv_shows').select('tmdb_id').in('tmdb_id', changedTVIds)
      : Promise.resolve({ data: [] as { tmdb_id: number }[] }),
  ])

  // Cap per run so this comfortably fits Vercel Hobby's 10s window even on
  // a busy change window; anything left over gets picked up by refresh_stale.
  const movieIdsToRefresh = (knownMovies ?? []).map((r) => r.tmdb_id).slice(0, 15)
  const tvIdsToRefresh = (knownTV ?? []).map((r) => r.tmdb_id).slice(0, 15)

  let count = 0
  for (const id of movieIdsToRefresh) {
    try { await upsertMovieFromDetails(supabase, id); count++ } catch (e) { console.error('[sync] incremental movie refresh failed', id, e) }
  }
  for (const id of tvIdsToRefresh) {
    try { await upsertTVFromDetails(supabase, id); count++ } catch (e) { console.error('[sync] incremental tv refresh failed', id, e) }
  }
  return count
}

// Ordered list of every sync job. Shared by runDailySync() (one big run —
// fine on Pro, or locally) and runSyncStep() (one job per invocation — needed
// on the Hobby plan's 60s function cap). Index in this array is what
// ?step=N in the cron route refers to. This particular edit added new
// sources in the middle of the list (English TV, Bengali OTT platforms),
// which does shift every later index — vercel.json was regenerated in the
// same change to match the new count/order below. If you add more sources
// later without also touching vercel.json, append them at the end instead.
function buildSyncSteps(supabase: AdminClient): [string, () => Promise<number>][] {
  // See lib/tmdb.ts: TMDb/JustWatch don't reliably expose `BD` as a discover
  // watch region, so these Bengali OTT platforms are looked up under `IN`.
  const OTT_WATCH_REGION = 'IN'
  const OTT_PROVIDER_NAMES = ['hoichoi', 'Chorki', 'Zee5', 'Bongo', 'Addatimes']

  return [
    ['trending_and_popular', () => syncTrendingAndPopular(supabase)],
    ...tmdb.TV_ORIGIN_COUNTRIES.map((c): [string, () => Promise<number>] => [`tv_${c}`, () => syncRegionalTV(supabase, c)]),
    ...tmdb.TV_ORIGINAL_LANGUAGES.map((l): [string, () => Promise<number>] => [`tv_lang_${l}`, () => syncRegionalTVByLanguage(supabase, l)]),
    ...tmdb.TV_ORIGIN_COUNTRIES.map((c): [string, () => Promise<number>] => [`tv_wikidata_${c}`, () => syncRegionalTVFromWikidata(supabase, c)]),
    ['ott_movies_bd', () => syncByWatchProviders(supabase, 'movie', OTT_WATCH_REGION, OTT_PROVIDER_NAMES)],
    ['ott_tv_bd', () => syncByWatchProviders(supabase, 'tv', OTT_WATCH_REGION, OTT_PROVIDER_NAMES)],
    ...tmdb.MOVIE_ORIGINAL_LANGUAGES.map((l): [string, () => Promise<number>] => [`movies_${l}`, () => syncRegionalMovies(supabase, l)]),
    ['refresh_stale', () => refreshStale(supabase)],
    ['incremental_changes', () => syncIncrementalChanges(supabase)],
  ]
}

export function syncStepCount() {
  return buildSyncSteps(createAdminClient()).length
}

/** Full run — every step, one after another, in a single invocation. Only
 * safe within a function that can actually run this long (Vercel Pro/
 * Enterprise with a raised maxDuration, or locally via a script/cli route).
 * On Hobby, use runSyncStep() instead, one per cron invocation. */
export async function runDailySync() {
  const supabase = createAdminClient()
  const startedAt = new Date().toISOString()
  let rowsProcessed = 0
  const errors: string[] = []

  for (const [name, fn] of buildSyncSteps(supabase)) {
    try {
      rowsProcessed += await fn()
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  await supabase.from('sync_logs').insert({
    source: 'daily_sync',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    rows_processed: rowsProcessed,
    status: errors.length ? 'error' : 'success',
    error_message: errors.length ? errors.join(' | ') : null,
  })

  return { rowsProcessed, errors }
}

/** Runs exactly one step by index and logs it under that step's own name, so
 * each cron invocation stays well inside the Hobby plan's 60s function cap.
 * Wire one vercel.json cron entry per index, spread across the day (see
 * README). Returns null for an out-of-range index so the route can 404. */
export async function runSyncStep(stepIndex: number) {
  const supabase = createAdminClient()
  const steps = buildSyncSteps(supabase)
  const step = steps[stepIndex]
  if (!step) return null

  const [name, fn] = step
  const startedAt = new Date().toISOString()
  let rowsProcessed = 0
  let error: string | null = null

  try {
    rowsProcessed = await fn()
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  await supabase.from('sync_logs').insert({
    source: `daily_sync:${name}`,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    rows_processed: rowsProcessed,
    status: error ? 'error' : 'success',
    error_message: error,
  })

  return { step: name, stepIndex, rowsProcessed, error }
}
