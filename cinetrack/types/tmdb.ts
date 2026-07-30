// Shapes for the subset of the TMDb v3 API this app uses.
// Not exhaustive — TMDb returns more fields than we store.

export interface TmdbPaged<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export interface TmdbMovieListItem {
  id: number
  title: string
  original_title: string
  original_language: string
  overview: string
  release_date: string | null
  genre_ids: number[]
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  vote_count: number
  popularity: number
}

export interface TmdbTVListItem {
  id: number
  name: string
  original_name: string
  original_language: string
  overview: string
  first_air_date: string | null
  genre_ids: number[]
  origin_country: string[]
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  vote_count: number
  popularity: number
}

export interface TmdbCreditsCastMember {
  id: number
  name: string
  character: string
  order: number
  profile_path: string | null
  known_for_department: string
}

export interface TmdbCreditsCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
  known_for_department: string
}

export interface TmdbMovieDetails extends Omit<TmdbMovieListItem, 'genre_ids'> {
  genres: { id: number; name: string }[]
  runtime: number | null
  imdb_id: string | null
  production_countries: { iso_3166_1: string; name: string }[]
  credits?: { cast: TmdbCreditsCastMember[]; crew: TmdbCreditsCrewMember[] }
  external_ids?: { imdb_id: string | null }
}

export interface TmdbTVDetails extends Omit<TmdbTVListItem, 'genre_ids'> {
  genres: { id: number; name: string }[]
  number_of_seasons: number
  number_of_episodes: number
  status: string
  seasons: {
    id: number
    season_number: number
    name: string
    air_date: string | null
    episode_count: number
    poster_path: string | null
  }[]
  credits?: { cast: TmdbCreditsCastMember[]; crew: TmdbCreditsCrewMember[] }
  external_ids?: { imdb_id: string | null }
}

export interface TmdbSeasonDetails {
  id: number
  season_number: number
  name: string
  air_date: string | null
  episodes: {
    id: number
    episode_number: number
    name: string
    air_date: string | null
    overview: string
    runtime: number | null
    vote_average: number
    vote_count: number
  }[]
}

export interface TmdbCombinedCreditItem {
  id: number
  media_type: 'movie' | 'tv'
  title?: string
  name?: string
  poster_path: string | null
  character?: string
  job?: string
  release_date?: string
  first_air_date?: string
  vote_average: number
}

export interface TmdbPersonDetails {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string | null
  biography?: string
  combined_credits?: {
    cast: TmdbCombinedCreditItem[]
    crew: TmdbCombinedCreditItem[]
  }
}
