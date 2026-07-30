import { createClient } from './supabase/server'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export async function getSimilarMovies(supabase: ServerSupabase, movie: { id: string; genres: string[] }, limit = 12) {
  if (!movie.genres.length) return []
  const { data } = await supabase
    .from('movies')
    .select('*')
    .neq('id', movie.id)
    .overlaps('genres', movie.genres)
    .order('popularity', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getSimilarTV(supabase: ServerSupabase, show: { id: string; genres: string[] }, limit = 12) {
  if (!show.genres.length) return []
  const { data } = await supabase
    .from('tv_shows')
    .select('*')
    .neq('id', show.id)
    .overlaps('genres', show.genres)
    .order('popularity', { ascending: false })
    .limit(limit)
  return data ?? []
}
