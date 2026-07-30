import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MediaCard } from '@/components/media-card'
import type { Movie, TVShow, ShowStatus } from '@/types/database'

interface WatchedMovieRow {
  rating: number | null
  movies: Movie
}
interface ShowProgressRow {
  rating: number | null
  status: ShowStatus
  tv_shows: TVShow
}

export default async function MyWatchedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: watchedRaw }, { data: progressRaw }] = await Promise.all([
    supabase.from('watched').select('rating, watched_at, movies(*)').eq('user_id', user.id).order('watched_at', { ascending: false }),
    supabase.from('show_progress').select('rating, status, updated_at, tv_shows(*)').eq('user_id', user.id).order('updated_at', { ascending: false }),
  ])

  const watchedMovies = (watchedRaw ?? []) as unknown as WatchedMovieRow[]
  const showsInProgress = (progressRaw ?? []) as unknown as ShowProgressRow[]

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold">What you&rsquo;ve watched</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Movies</h2>
        {watchedMovies.length === 0 && <p className="text-sm text-muted dark:text-mutedDark">No movies marked as watched yet.</p>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {watchedMovies.map((row) => (
            <MediaCard
              key={row.movies.id}
              title={row.movies.title}
              year={row.movies.release_date?.slice(0, 4)}
              posterPath={row.movies.poster_path}
              rating={row.rating ?? row.movies.tmdb_rating}
              href={`/movie/${row.movies.id}`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">TV series</h2>
        {showsInProgress.length === 0 && <p className="text-sm text-muted dark:text-mutedDark">No series tracked yet.</p>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {showsInProgress.map((row) => (
            <div key={row.tv_shows.id}>
              <MediaCard
                title={row.tv_shows.name}
                year={row.tv_shows.first_air_date?.slice(0, 4)}
                posterPath={row.tv_shows.poster_path}
                rating={row.rating ?? row.tv_shows.tmdb_rating}
                href={`/tv/${row.tv_shows.id}`}
              />
              <p className="mt-1 text-center font-mono text-xs capitalize text-muted dark:text-mutedDark">{row.status.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
