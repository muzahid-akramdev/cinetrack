// Hand-written types matching supabase/migrations/0001_init.sql.
// Once you have a live Supabase project you can run:
//   npx supabase gen types typescript --project-id <ref> > types/database-generated.ts
// and swap these for the generated ones for perfect accuracy — these are a
// close-by-hand approximation good enough to build against.

export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  is_admin: boolean
  created_at: string
}

export type CatalogSource = 'tmdb' | 'wikidata' | 'manual'

export interface Movie {
  id: string
  tmdb_id: number | null
  imdb_id: string | null
  wikidata_id: string | null
  source: CatalogSource
  title: string
  original_title: string | null
  original_language: string | null
  overview: string | null
  release_date: string | null
  runtime: number | null
  genres: string[]
  countries: string[]
  poster_path: string | null
  backdrop_path: string | null
  tmdb_rating: number | null
  tmdb_vote_count: number | null
  imdb_rating: number | null
  imdb_vote_count: number | null
  popularity: number
  created_at: string
  updated_at: string
}

export interface TVShow {
  id: string
  tmdb_id: number | null
  imdb_id: string | null
  wikidata_id: string | null
  source: CatalogSource
  name: string
  original_name: string | null
  original_language: string | null
  overview: string | null
  first_air_date: string | null
  genres: string[]
  origin_country: string[]
  poster_path: string | null
  backdrop_path: string | null
  number_of_seasons: number
  number_of_episodes: number
  status: string | null
  tmdb_rating: number | null
  tmdb_vote_count: number | null
  imdb_rating: number | null
  imdb_vote_count: number | null
  popularity: number
  seasons_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface Season {
  id: string
  tv_show_id: string
  tmdb_id: number | null
  season_number: number
  name: string | null
  air_date: string | null
  episode_count: number | null
  poster_path: string | null
}

export interface Episode {
  id: string
  season_id: string
  tmdb_id: number | null
  episode_number: number
  name: string | null
  air_date: string | null
  overview: string | null
  runtime: number | null
  tmdb_rating: number | null
  tmdb_vote_count: number | null
}

export interface Person {
  id: string
  tmdb_id: number
  name: string
  profile_path: string | null
  known_for_department: string | null
}

export interface Credit {
  id: string
  person_id: string
  movie_id: string | null
  tv_show_id: string | null
  role: 'cast' | 'crew'
  character_name: string | null
  job: string | null
  sort_order: number
}

export interface WatchlistItem {
  id: string
  user_id: string
  movie_id: string | null
  tv_show_id: string | null
  added_at: string
}

export interface Watched {
  user_id: string
  movie_id: string
  watched_at: string
  rating: number | null
  rewatch_count: number
}

export type ShowStatus = 'watching' | 'completed' | 'dropped' | 'plan_to_watch'

export interface ShowProgress {
  user_id: string
  tv_show_id: string
  rating: number | null
  status: ShowStatus
  updated_at: string
}

export interface EpisodeWatched {
  user_id: string
  episode_id: string
  watched_at: string
  rating: number | null
  rewatch_count: number
}

export interface Review {
  id: string
  user_id: string
  movie_id: string | null
  tv_show_id: string | null
  rating: number
  body: string
  has_spoilers: boolean
  created_at: string
  updated_at: string
}

export interface ReviewLike {
  review_id: string
  user_id: string
  created_at: string
}

export interface List {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string
}

export interface ListItem {
  id: string
  list_id: string
  movie_id: string | null
  tv_show_id: string | null
  position: number
}

export interface Follow {
  follower_id: string
  followee_id: string
  created_at: string
}

export interface SyncLog {
  id: string
  source: string
  started_at: string
  finished_at: string | null
  rows_processed: number
  status: 'running' | 'success' | 'error'
  error_message: string | null
}

export interface MissingTitleRequest {
  id: string
  user_id: string | null
  title: string
  note: string | null
  status: 'pending' | 'added' | 'rejected'
  created_at: string
}
