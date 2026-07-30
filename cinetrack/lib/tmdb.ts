import type {
  TmdbPaged,
  TmdbMovieListItem,
  TmdbTVListItem,
  TmdbMovieDetails,
  TmdbTVDetails,
  TmdbSeasonDetails,
  TmdbPersonDetails,
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
export const MOVIE_ORIGINAL_LANGUAGES = ['ko', 'tr', 'hi', 'bn', 'ta', 'te', 'ml', 'kn', 'pa', 'ur'] as const

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
export function discoverTVByOriginCountry(countryCode: string, page = 1) {
  return tmdbFetch<TmdbPaged<TmdbTVListItem>>('/discover/tv', {
    with_origin_country: countryCode,
    page,
    sort_by: 'popularity.desc',
  })
}
export function discoverMoviesByLanguage(languageCode: string, page = 1) {
  return tmdbFetch<TmdbPaged<TmdbMovieListItem>>('/discover/movie', {
    with_original_language: languageCode,
    page,
    sort_by: 'popularity.desc',
  })
}
