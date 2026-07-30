import { createClient } from '@/lib/supabase/server'
import { MediaCard } from '@/components/media-card'
import { FilterBar, Pagination } from '@/components/browse-controls'
import { TV_GENRE_MAP, TV_ORIGIN_COUNTRIES } from '@/lib/tmdb'

export const revalidate = 3600
const PAGE_SIZE = 24

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', ko: 'Korean', tr: 'Turkish', hi: 'Hindi', bn: 'Bengali',
  ur: 'Urdu', ja: 'Japanese', es: 'Spanish',
}

const COUNTRY_LABELS: Record<string, string> = {
  KR: 'South Korea', TR: 'Turkey', IN: 'India', PK: 'Pakistan', BD: 'Bangladesh',
  US: 'United States', GB: 'United Kingdom', JP: 'Japan',
}

export default async function TVPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1'))
  const supabase = await createClient()

  let query = supabase.from('tv_shows').select('*', { count: 'exact' })

  if (sp.genre) query = query.contains('genres', [sp.genre])
  if (sp.language) query = query.eq('original_language', sp.language)
  if (sp.country) query = query.contains('origin_country', [sp.country])
  if (sp.year) query = query.gte('first_air_date', `${sp.year}-01-01`).lte('first_air_date', `${sp.year}-12-31`)
  if (sp.min_rating) query = query.gte('tmdb_rating', Number(sp.min_rating))

  switch (sp.sort) {
    case 'rating':
      query = query.order('tmdb_rating', { ascending: false, nullsFirst: false })
      break
    case 'date':
      query = query.order('first_air_date', { ascending: false, nullsFirst: false })
      break
    case 'az':
      query = query.order('name', { ascending: true })
      break
    default:
      query = query.order('popularity', { ascending: false })
  }

  const from = (page - 1) * PAGE_SIZE
  const { data: shows, count } = await query.range(from, from + PAGE_SIZE - 1)
  const hasMore = count ? from + PAGE_SIZE < count : false

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold">TV Series</h1>
      <FilterBar
        searchParams={sp}
        genres={Object.values(TV_GENRE_MAP)}
        languages={Object.entries(LANGUAGE_LABELS).map(([code, label]) => ({ code, label }))}
        countries={[...TV_ORIGIN_COUNTRIES, 'US', 'GB', 'JP'].map((code) => ({ code, label: COUNTRY_LABELS[code] ?? code }))}
      />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {(shows ?? []).map((s) => (
          <MediaCard key={s.id} title={s.name} year={s.first_air_date?.slice(0, 4)} posterPath={s.poster_path} rating={s.tmdb_rating} href={`/tv/${s.id}`} />
        ))}
      </div>
      {!shows?.length && <p className="py-12 text-center text-muted dark:text-mutedDark">No series match those filters yet.</p>}
      <Pagination
  basePath="/movies"
  searchParams={sp}
  page={page}
  totalPages={count ? Math.ceil(count / PAGE_SIZE) : 1}
/>
    </div>
  )
}
