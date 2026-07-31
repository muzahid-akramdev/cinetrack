import type {
  TmdbPaged,
  TmdbMovieListItem,
  TmdbTVListItem,
  TmdbMovieDetails,
  TmdbTVDetails,
  TmdbSeasonDetails,
  TmdbPersonDetails,
  TmdbChangesResponse,
} from '@/types/tmdb'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | undefined> = {}, retry = 0): Promise<T> {
  const token = process.env.TMDB_API_ACCESS_TOKEN
  if (!token) throw new Error('TMDB_API_ACCESS_TOKEN is not set')

  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('language', 'en-US')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    // Catalog data changes slowly; ISR + the daily cron keep this fresh enough.
    next: { revalidate: 60 * 60 * 6 },
  })

  if (res.status === 429 && retry < 3) {
    const retryAfter = Number(res.headers.get('retry-after') ?? '1')
    await sleep((retryAfter || 1) * 1000)
    return tmdbFetch<T>(path, params, retry + 1)
  }

  if (!res.ok) {
    throw new Error(`TMDb ${path} failed: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export function posterUrl(path: string | null | undefined, size: 'w185' | 'w342' | 'w500' | 'original' = 'w342') {
  if (!path) return null
  // Wikidata-sourced and manually-entered titles store a full external URL
  // here instead of a TMDb-relative path (there's no TMDb CDN path for
  // them) — pass those through untouched rather than double-prefixing.
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export function backdropUrl(path: string | null | undefined, size: 'w780' | 'w1280' | 'original' = 'w1280') {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export const MOVIE_GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
}

export const TV_GENRE_MAP: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery',
  10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
}

// Regions called out explicitly in the spec. See README for the note on `bn`
// (Bengali) picking up West Bengal, India productions alongside Bangladeshi ones.
export const TV_ORIGIN_COUNTRIES = ['KR', 'TR', 'IN', 'PK', 'BD'] as const
// English-original movies were missing from every preference bucket because
// nothing ever discovered by `en` — added here so the regular movie sweep
// (and the deep backfill in scripts/full-sync.ts) picks it up like any other
// tracked language.
export const MOVIE_ORIGINAL_LANGUAGES = ['ko', 'tr', 'hi', 'bn', 'ta', 'te', 'ml', 'kn', 'pa', 'ur', 'en'] as const
// English-language TV shows come out of many different countries (US, GB,
// CA, AU, IE...), so — unlike the Korean/Turkish/Indian/Pakistani/Bangladeshi
// sweep above, which is keyed by a single origin country — English TV is
// swept by original_language instead, the same way movies are.
export const TV_ORIGINAL_LANGUAGES = ['en'] as const

// ---- search ----
export function searchMovies(query: string, page = 1) {
  return tmdbFetch<TmdbPaged<TmdbMovieListItem>>('/search/movie', { query, page, include_adult: 'false' })
}
export function searchTV(query: string, page = 1) {
  return tmdbFetch<TmdbPaged<TmdbTVListItem>>('/search/tv', { query, page, include_adult: 'false' })
}

// ---- details ----
export function getMovieDetails(tmdbId: number) {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, { append_to_response: 'credits,external_ids' })
}
export function getTVDetails(tmdbId: number) {
  return tmdbFetch<TmdbTVDetails>(`/tv/${tmdbId}`, { append_to_response: 'credits,external_ids' })
}
export function getSeasonDetails(tvTmdbId: number, seasonNumber: number) {
  return tmdbFetch<TmdbSeasonDetails>(`/tv/${tvTmdbId}/season/${seasonNumber}`)
}
export function getPersonDetails(tmdbId: number) {
  return tmdbFetch<TmdbPersonDetails>(`/person/${tmdbId}`, { append_to_response: 'combined_credits' })
}

// ---- discovery ----
export function getTrendingMovies(window: 'day' | 'week' = 'week') {
  return tmdbFetch<TmdbPaged<TmdbMovieListItem>>(`/trending/movie/${window}`)
}
export function getTrendingTV(window: 'day' | 'week' = 'week') {
  return tmdbFetch<TmdbPaged<TmdbTVListItem>>(`/trending/tv/${window}`)
}
export function getPopularMovies(page = 1) {
  return tmdbFetch<TmdbPaged<TmdbMovieListItem>>('/movie/popular', { page })
}
export function getPopularTV(page = 1) {
  return tmdbFetch<TmdbPaged<TmdbTVListItem>>('/tv/popular', { page })
}
// `extra` lets callers add filters like `first_air_date_year` /
// `primary_release_year` without a new function per filter — used by
// pagedYearChunked() in lib/sync.ts to split a broad query into per-year
// slices, since TMDb discover only ever returns up to page 500
// (10,000 results) for a single query no matter how high `page` goes.
export function discoverTVByOriginCountry(
  countryCode: string,
  page = 1,
  extra: Record<string, string | number | undefined> = {}
) {
  return tmdbFetch<TmdbPaged<TmdbTVListItem>>('/discover/tv', {
    with_origin_country: countryCode,
    page,
    sort_by: 'popularity.desc',
    include_adult: 'false',
    ...extra,
  })
}
export function discoverTVByLanguage(
  languageCode: string,
  page = 1,
  extra: Record<string, string | number | undefined> = {}
) {
  return tmdbFetch<TmdbPaged<TmdbTVListItem>>('/discover/tv', {
    with_original_language: languageCode,
    page,
    sort_by: 'popularity.desc',
    include_adult: 'false',
    ...extra,
  })
}
export function discoverMoviesByLanguage(
  languageCode: string,
  page = 1,
  extra: Record<string, string | number | undefined> = {}
) {
  return tmdbFetch<TmdbPaged<TmdbMovieListItem>>('/discover/movie', {
    with_original_language: languageCode,
    page,
    sort_by: 'popularity.desc',
    include_adult: 'false',
    ...extra,
  })
}

// ---- watch providers (OTT platforms) ----
// TMDb (via JustWatch) doesn't reliably expose `BD` as a discover watch
// region, so Bangladeshi OTT platforms — hoichoi, Chorki, Zee5, Bongo,
// Addatimes — are looked up under `IN`, which does carry them. Provider ids
// are resolved by name against the live list instead of being hardcoded,
// since TMDb can renumber them.
interface TmdbWatchProvider {
  provider_id: number
  provider_name: string
}

const watchProviderListCache = new Map<string, TmdbWatchProvider[]>()

async function getWatchProviderList(mediaType: 'movie' | 'tv', watchRegion: string) {
  const cacheKey = `${mediaType}:${watchRegion}`
  const cached = watchProviderListCache.get(cacheKey)
  if (cached) return cached
  const res = await tmdbFetch<{ results: TmdbWatchProvider[] }>(`/watch/providers/${mediaType}`, {
    watch_region: watchRegion,
  })
  watchProviderListCache.set(cacheKey, res.results)
  return res.results
}

/** Resolves human platform names (case-insensitive substring match, e.g.
 * "Zee5" also matches "ZEE5") to TMDb's numeric provider ids for a region.
 * Names with no match are silently skipped — callers should treat an empty
 * return as "nothing to sync" rather than an error, since provider
 * availability varies by region and TMDb's catalog changes over time. */
export async function resolveWatchProviderIds(mediaType: 'movie' | 'tv', watchRegion: string, names: string[]) {
  const list = await getWatchProviderList(mediaType, watchRegion)
  const ids: number[] = []
  for (const name of names) {
    const match = list.find((p) => p.provider_name.toLowerCase().includes(name.toLowerCase()))
    if (match) ids.push(match.provider_id)
  }
  return ids
}

export function discoverMoviesByWatchProviders(
  watchRegion: string,
  providerIds: number[],
  page = 1,
  extra: Record<string, string | number | undefined> = {}
) {
  return tmdbFetch<TmdbPaged<TmdbMovieListItem>>('/discover/movie', {
    watch_region: watchRegion,
    with_watch_providers: providerIds.join('|'),
    page,
    sort_by: 'popularity.desc',
    include_adult: 'false',
    ...extra,
  })
}
export function discoverTVByWatchProviders(
  watchRegion: string,
  providerIds: number[],
  page = 1,
  extra: Record<string, string | number | undefined> = {}
) {
  return tmdbFetch<TmdbPaged<TmdbTVListItem>>('/discover/tv', {
    watch_region: watchRegion,
    with_watch_providers: providerIds.join('|'),
    page,
    sort_by: 'popularity.desc',
    include_adult: 'false',
    ...extra,
  })
}

// ---- changes (for incremental/daily refresh — see syncIncrementalChanges) ----
// TMDb only accepts a <=14-day window per call, hence the small default in
// lib/sync.ts. Results carry no language/region — caller must cross-check
// ids against what's already in the catalog.
export function getMovieChangeIds(startDate: string, endDate: string, page = 1) {
  return tmdbFetch<TmdbChangesResponse>('/movie/changes', { start_date: startDate, end_date: endDate, page })
}
export function getTVChangeIds(startDate: string, endDate: string, page = 1) {
  return tmdbFetch<TmdbChangesResponse>('/tv/changes', { start_date: startDate, end_date: endDate, page })
}
