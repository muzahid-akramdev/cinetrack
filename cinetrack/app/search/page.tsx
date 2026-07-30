import { createClient } from '@/lib/supabase/server'
import { fetchOnSearchMiss } from '@/lib/sync'
import { MediaCard } from '@/components/media-card'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = (q ?? '').trim()

  if (!query) {
    return <p className="py-12 text-center text-muted dark:text-mutedDark">Search for a movie or TV show above.</p>
  }

  const supabase = await createClient()
  // Strip characters that would break PostgREST's .or() filter syntax.
  const safeQuery = query.replace(/[,()]/g, ' ').trim()
  const like = `%${safeQuery}%`

  const runQueries = () =>
    Promise.all([
      supabase.from('movies').select('*').or(`title.ilike.${like},original_title.ilike.${like}`).order('popularity', { ascending: false }).limit(20),
      supabase.from('tv_shows').select('*').or(`name.ilike.${like},original_name.ilike.${like}`).order('popularity', { ascending: false }).limit(20),
    ])

  let [{ data: movies }, { data: shows }] = await runQueries()

  // Fetch-on-miss: if the local catalog barely has anything, pull live from
  // TMDb, upsert it, then re-query so the results include the fresh rows.
  if ((movies?.length ?? 0) + (shows?.length ?? 0) < 3) {
    try {
      await fetchOnSearchMiss(safeQuery)
      ;[{ data: movies }, { data: shows }] = await runQueries()
    } catch (e) {
      console.error('[search] fetch-on-miss failed', e)
    }
  }

  const noResults = !movies?.length && !shows?.length

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold">Results for &ldquo;{query}&rdquo;</h1>
      {noResults && <p className="text-muted dark:text-mutedDark">Nothing found — try a different spelling or the original-language title.</p>}

      {!!movies?.length && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Movies</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {movies.map((m) => (
              <MediaCard key={m.id} title={m.title} year={m.release_date?.slice(0, 4)} posterPath={m.poster_path} rating={m.tmdb_rating} href={`/movie/${m.id}`} />
            ))}
          </div>
        </section>
      )}

      {!!shows?.length && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">TV Shows</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shows.map((s) => (
              <MediaCard key={s.id} title={s.name} year={s.first_air_date?.slice(0, 4)} posterPath={s.poster_path} rating={s.tmdb_rating} href={`/tv/${s.id}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
