import { createClient } from '@/lib/supabase/server'
import { MediaCard } from '@/components/media-card'
import { FilterBar, Pagination } from '@/components/browse-controls'
import { MOVIE_GENRE_MAP, MOVIE_ORIGINAL_LANGUAGES } from '@/lib/tmdb'

export const revalidate = 3600
const PAGE_SIZE = 24

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', ko: 'Korean', tr: 'Turkish', hi: 'Hindi', bn: 'Bengali',
  ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', pa: 'Punjabi',
  ur: 'Urdu', ja: 'Japanese', es: 'Spanish', fr: 'French',
}

const COUNTRY_LABELS: Record<string, string> = {
  BD: 'Bangladesh', IN: 'India', PK: 'Pakistan', TR: 'Turkey', KR: 'South Korea',
  US: 'United States', GB: 'United Kingdom', JP: 'Japan',
}

export default async function MoviesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1'))
  const supabase = await createClient()

  let query = supabase.from('movies').select('*', { count: 'exact' })

  if (sp.genre) query = query.contains('genres', [sp.genre])
  if (sp.language) query = query.eq('original_language', sp.language)
  if (sp.country) query = query.contains('countries', [sp.country])
  if (sp.year) query = query.gte('release_date', `${sp.year}-01-01`).lte('release_date', `${sp.year}-12-31`)
  if (sp.min_rating) query = query.gte('tmdb_rating', Number(sp.min_rating))

  switch (sp.sort) {
    case 'rating':
      query = query.order('tmdb_rating', { ascending: false, nullsFirst: false })
      break
    case 'date':
      query = query.order('release_date', { ascending: false, nullsFirst: false })
      break
    case 'az':
      query = query.order('title', { ascending: true })
      break
    default:
      query = query.order('popularity', { ascending: false })
  }

  const from = (page - 1) * PAGE_SIZE
  const { data: movies, count } = await query.range(from, from + PAGE_SIZE - 1)
  const hasMore = count ? from + PAGE_SIZE < count : false

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold">Movies</h1>
      <FilterBar
        searchParams={sp}
        genres={Object.values(MOVIE_GENRE_MAP)}
        languages={MOVIE_ORIGINAL_LANGUAGES.map((code) => ({ code, label: LANGUAGE_LABELS[code] ?? code }))}
        countries={Object.entries(COUNTRY_LABELS).map(([code, label]) => ({ code, label }))}
      />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {(movies ?? []).map((m) => (
          <MediaCard key={m.id} title={m.title} year={m.release_date?.slice(0, 4)} posterPath={m.poster_path} rating={m.tmdb_rating} href={`/movie/${m.id}`} />
        ))}
      </div>
      {!movies?.length && <p className="py-12 text-center text-muted dark:text-mutedDark">No movies match those filters yet.</p>}
      <Pagination basePath="/movies" searchParams={sp} page={page} hasMore={hasMore} />
    </div>
  )
}
