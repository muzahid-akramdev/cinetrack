import { createClient } from '@/lib/supabase/server'
import { MediaRow } from '@/components/media-row'

export const revalidate = 3600

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: popularMovies }, { data: popularTV }, { data: newMovies }, { data: bd }, { data: kr }] = await Promise.all([
    supabase.from('movies').select('*').order('popularity', { ascending: false }).limit(12),
    supabase.from('tv_shows').select('*').order('popularity', { ascending: false }).limit(12),
    supabase
      .from('movies')
      .select('*')
      .not('release_date', 'is', null)
      .lte('release_date', new Date().toISOString().slice(0, 10))
      .order('release_date', { ascending: false })
      .limit(12),
    supabase.from('tv_shows').select('*').contains('origin_country', ['BD']).order('popularity', { ascending: false }).limit(12),
    supabase.from('tv_shows').select('*').contains('origin_country', ['KR']).order('popularity', { ascending: false }).limit(12),
  ])

  const empty = !popularMovies?.length && !popularTV?.length

  return (
    <div>
      <div className="mb-10">
        <p className="eyebrow mb-3">A catalog for every screen</p>
        <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">Track everything you watch.</h1>
        <p className="mt-3 max-w-xl text-ink/70 dark:text-paper/70">
          Movies and TV from every country — with dedicated coverage for Bangladeshi, Indian, Pakistani, Turkish and Korean dramas alongside global hits.
        </p>
      </div>

      {empty && (
        <div className="mb-10 rounded-xl border border-dashed border-line p-6 text-sm text-muted dark:border-lineDark dark:text-mutedDark">
          The catalog is empty — run the sync job (<code className="rounded bg-ink/5 px-1 font-mono dark:bg-paper/10">/api/cron/sync</code>) once to pull in
          popular titles, or search for something specific to fetch it on demand.
        </div>
      )}

      <MediaRow title="Popular movies" href="/movies" items={popularMovies ?? []} kind="movie" />
      <MediaRow title="Popular TV" href="/tv" items={popularTV ?? []} kind="tv" />
      <MediaRow title="New releases" href="/movies" items={newMovies ?? []} kind="movie" />
      <MediaRow title="Bangladeshi TV" href="/browse/country/BD" items={bd ?? []} kind="tv" />
      <MediaRow title="Korean dramas" href="/browse/country/KR" items={kr ?? []} kind="tv" />
    </div>
  )
}
