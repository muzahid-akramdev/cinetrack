import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MediaCard } from '@/components/media-card'
import type { Movie, TVShow } from '@/types/database'

interface WatchlistRow {
  id: string
  movies: Movie | null
  tv_shows: TVShow | null
}

export default async function MyWatchlistPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('watchlist')
    .select('id, added_at, movies(*), tv_shows(*)')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  const rows = (data ?? []) as unknown as WatchlistRow[]

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold">Your watchlist</h1>
      {rows.length === 0 && <p className="text-muted dark:text-mutedDark">Nothing here yet — add movies or shows from their pages.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {rows.map((row) => {
          if (row.movies) {
            const m = row.movies
            return <MediaCard key={row.id} title={m.title} year={m.release_date?.slice(0, 4)} posterPath={m.poster_path} rating={m.tmdb_rating} href={`/movie/${m.id}`} />
          }
          if (row.tv_shows) {
            const t = row.tv_shows
            return <MediaCard key={row.id} title={t.name} year={t.first_air_date?.slice(0, 4)} posterPath={t.poster_path} rating={t.tmdb_rating} href={`/tv/${t.id}`} />
          }
          return null
        })}
      </div>
    </div>
  )
}
