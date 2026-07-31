import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MediaCard } from '@/components/media-card'
import type { Movie, TVShow, ShowStatus } from '@/types/database'

interface WatchedMovieRow {
  rating: number | null
  watched_at: string
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
    supabase
      .from('watched')
      .select('rating, watched_at, movies(*)')
      .eq('user_id', user.id)
      .order('watched_at', { ascending: false }),
    supabase
      .from('show_progress')
      .select('rating, status, updated_at, tv_shows(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
  ])

  const watchedMovies = (watchedRaw ?? []) as unknown as WatchedMovieRow[]
  const shows = (progressRaw ?? []) as unknown as ShowProgressRow[]

  const completedShows = shows.filter((s) => s.status === 'completed')
  const watchingShows = shows.filter((s) => s.status === 'watching')
  const otherShows = shows.filter((s) => s.status !== 'completed' && s.status !== 'watching')

  const ratedMovies = watchedMovies.filter((m) => m.rating != null).length
  const ratedShows = shows.filter((s) => s.rating != null).length

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold">What you&rsquo;ve watched</h1>

      {/* Separate counts */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Movies watched" value={watchedMovies.length} />
        <Stat label="Movies rated" value={ratedMovies} />
        <Stat label="Series tracked" value={shows.length} />
        <Stat label="Series completed" value={completedShows.length} />
      </div>

      {/* Movies section */}
      <section className="mb-12">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">Movies</h2>
          <span className="font-mono text-sm text-muted dark:text-mutedDark">
            {watchedMovies.length} total
            {ratedMovies > 0 ? ` · ${ratedMovies} rated` : ''}
          </span>
        </div>
        {watchedMovies.length === 0 ? (
          <p className="text-sm text-muted dark:text-mutedDark">No movies marked as watched yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {watchedMovies.map((row) =>
              row.movies ? (
                <MediaCard
                  key={row.movies.id}
                  title={row.movies.title}
                  year={row.movies.release_date?.slice(0, 4)}
                  posterPath={row.movies.poster_path}
                  rating={row.rating ?? row.movies.tmdb_rating}
                  href={`/movie/${row.movies.id}`}
                />
              ) : null
            )}
          </div>
        )}
      </section>

      {/* TV series section */}
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">TV Series</h2>
          <span className="font-mono text-sm text-muted dark:text-mutedDark">
            {shows.length} total
            {completedShows.length > 0 ? ` · ${completedShows.length} completed` : ''}
            {ratedShows > 0 ? ` · ${ratedShows} rated` : ''}
          </span>
        </div>

        {shows.length === 0 ? (
          <p className="text-sm text-muted dark:text-mutedDark">No series tracked yet.</p>
        ) : (
          <>
            {completedShows.length > 0 && (
              <ShowGroup title="Completed" rows={completedShows} />
            )}
            {watchingShows.length > 0 && (
              <ShowGroup title="Watching" rows={watchingShows} />
            )}
            {otherShows.length > 0 && (
              <ShowGroup title="Other" rows={otherShows} />
            )}
          </>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line p-4 dark:border-lineDark">
      <p className="font-mono text-2xl font-semibold text-marquee">{value}</p>
      <p className="text-xs text-muted dark:text-mutedDark">{label}</p>
    </div>
  )
}

function ShowGroup({ title, rows }: { title: string; rows: ShowProgressRow[] }) {
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">
        {title} ({rows.length})
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {rows.map((row) =>
          row.tv_shows ? (
            <div key={row.tv_shows.id}>
              <MediaCard
                title={row.tv_shows.name}
                year={row.tv_shows.first_air_date?.slice(0, 4)}
                posterPath={row.tv_shows.poster_path}
                rating={row.rating ?? row.tv_shows.tmdb_rating}
                href={`/tv/${row.tv_shows.id}`}
              />
              <p className="mt-1 text-center font-mono text-xs capitalize text-muted dark:text-mutedDark">
                {row.status.replace('_', ' ')}
              </p>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
