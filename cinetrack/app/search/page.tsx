import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchOnSearchMiss } from '@/lib/sync'
import { MediaCard } from '@/components/media-card'
import { Pagination } from '@/components/browse-controls'

const PAGE_SIZE = 24

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const sp = await searchParams
  const query = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? '1'))

  if (!query) {
    return (
      <p className="py-12 text-center text-muted dark:text-mutedDark">
        Search for a movie or TV show above.
      </p>
    )
  }

  const supabase = await createClient()
  const safeQuery = query.replace(/[,()]/g, ' ').trim()
  const like = `%${safeQuery}%`
  const from = (page - 1) * PAGE_SIZE

  const runQueries = () =>
    Promise.all([
      supabase
        .from('movies')
        .select('*', { count: 'exact' })
        .or(`title.ilike.\( {like},original_title.ilike. \){like}`)
        .order('popularity', { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
      supabase
        .from('tv_shows')
        .select('*', { count: 'exact' })
        .or(`name.ilike.\( {like},original_name.ilike. \){like}`)
        .order('popularity', { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
    ])

  let [{ data: movies, count: movieCount }, { data: shows, count: showCount }] = await runQueries()

  // Fetch-on-miss only on first page when almost nothing found
  if (page === 1 && (movies?.length ?? 0) + (shows?.length ?? 0) < 3) {
    try {
      await fetchOnSearchMiss(safeQuery)
      ;[{ data: movies, count: movieCount }, { data: shows, count: showCount }] = await runQueries()
    } catch (e) {
      console.error('[search] fetch-on-miss failed', e)
    }
  }

  const totalMovies = movieCount ?? 0
  const totalShows = showCount ?? 0
  const total = totalMovies + totalShows
  const noResults = total === 0
  // Use the larger of the two lists for page count (simple combined feel)
  const maxCount = Math.max(totalMovies, totalShows)
  const totalPages = Math.max(1, Math.ceil(maxCount / PAGE_SIZE))

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold">
        Results for &ldquo;{query}&rdquo;
      </h1>
      <p className="mb-6 font-mono text-xs text-muted dark:text-mutedDark">
        {totalMovies} movies · {totalShows} TV shows
      </p>

      {noResults && (
        <p className="text-muted dark:text-mutedDark">
          Nothing found — try a different spelling or the original-language title.
        </p>
      )}

      {!!movies?.length && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">
            Movies
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {movies.map((m) => (
              <MediaCard
                key={m.id}
                title={m.title}
                year={m.release_date?.slice(0, 4)}
                posterPath={m.poster_path}
                rating={m.tmdb_rating}
                href={`/movie/${m.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {!!shows?.length && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">
            TV Shows
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shows.map((s) => (
              <MediaCard
                key={s.id}
                title={s.name}
                year={s.first_air_date?.slice(0, 4)}
                posterPath={s.poster_path}
                rating={s.tmdb_rating}
                href={`/tv/${s.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {total > 0 && (
        <Pagination
          basePath="/search"
          searchParams={{ q: query, page: String(page) }}
          page={page}
          totalPages={totalPages}
        />
      )}
    </div>
  )
}
