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

export async function syncTrendingAndPopular(supabase: AdminClient) {
  let count = 0
  const [trendMovies, trendTV, popMovies, popTV] = await Promise.all([
    tmdb.getTrendingMovies('week'),
    tmdb.getTrendingTV('week'),
    paged((p) => tmdb.getPopularMovies(p), 3),
    paged((p) => tmdb.getPopularTV(p), 3),
  ])

  for (const m of trendMovies.results) { await upsertMovieFromListItem(supabase, m); count++ }
  for (const t of trendTV.results) { await upsertTVFromListItem(supabase, t); count++ }
  for (const m of popMovies) { await upsertMovieFromListItem(supabase, m); count++ }
  for (const t of popTV) { await upsertTVFromListItem(supabase, t); count++ }

  return count
}

export async function syncRegionalTV(supabase: AdminClient, countryCode: string) {
  const items = await paged((p) => tmdb.discoverTVByOriginCountry(countryCode, p), 5)
  for (const t of items) await upsertTVFromListItem(supabase, t)
  return items.length
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

export async function syncRegionalMovies(supabase: AdminClient, languageCode: string) {
  const items = await paged((p) => tmdb.discoverMoviesByLanguage(languageCode, p), 5)
  for (const m of items) await upsertMovieFromListItem(supabase, m)
  return items.length
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

export async function runDailySync() {
  const supabase = createAdminClient()
  const startedAt = new Date().toISOString()
  let rowsProcessed = 0
  const errors: string[] = []

  const steps: [string, () => Promise<number>][] = [
    ['trending_and_popular', () => syncTrendingAndPopular(supabase)],
    ...tmdb.TV_ORIGIN_COUNTRIES.map((c): [string, () => Promise<number>] => [`tv_${c}`, () => syncRegionalTV(supabase, c)]),
    ...tmdb.TV_ORIGIN_COUNTRIES.map((c): [string, () => Promise<number>] => [`tv_wikidata_${c}`, () => syncRegionalTVFromWikidata(supabase, c)]),
    ...tmdb.MOVIE_ORIGINAL_LANGUAGES.map((l): [string, () => Promise<number>] => [`movies_${l}`, () => syncRegionalMovies(supabase, l)]),
    ['refresh_stale', () => refreshStale(supabase)],
  ]

  for (const [name, fn] of steps) {
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
