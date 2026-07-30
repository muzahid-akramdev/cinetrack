import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MediaCard } from '@/components/media-card'

const COUNTRY_NAMES: Record<string, string> = {
  BD: 'Bangladesh', IN: 'India', PK: 'Pakistan', TR: 'Turkey', KR: 'South Korea',
  US: 'United States', GB: 'United Kingdom', JP: 'Japan', FR: 'France', ES: 'Spain',
}

// TV shows use TMDb's origin_country directly (reliable). Movies are more
// often tagged by original_language than by production country, so for the
// languages the spec calls out we filter movies by language here instead —
// this is also where the bn/West-Bengal overlap the spec flags shows up.
const COUNTRY_TO_MOVIE_LANGUAGES: Record<string, string[]> = {
  BD: ['bn'],
  IN: ['hi', 'ta', 'te', 'ml', 'kn', 'pa', 'bn'],
  PK: ['ur'],
  TR: ['tr'],
  KR: ['ko'],
}

export default async function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const countryCode = code.toUpperCase()
  const name = COUNTRY_NAMES[countryCode]
  if (!name) notFound()

  const supabase = await createClient()
  const languages = COUNTRY_TO_MOVIE_LANGUAGES[countryCode] ?? []

  const [{ data: tvShows }, { data: movies }] = await Promise.all([
    supabase.from('tv_shows').select('*').contains('origin_country', [countryCode]).order('popularity', { ascending: false }).limit(24),
    languages.length
      ? supabase
          .from('movies')
          .select('*')
          .or(languages.map((l) => `original_language.eq.${l}`).join(','))
          .order('popularity', { ascending: false })
          .limit(24)
      : supabase.from('movies').select('*').contains('countries', [countryCode]).order('popularity', { ascending: false }).limit(24),
  ])

  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-semibold">{name}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted dark:text-mutedDark">
        Movies and TV series from {name}.
        {countryCode === 'BD' && (
          <>
            {' '}
            Bengali-language titles from West Bengal, India can sometimes surface here too, since TMDb tags by language rather than country.{' '}
            <Link href="/suggest-title" className="underline">
              Suggest a missing title →
            </Link>
          </>
        )}
      </p>

      {!!tvShows?.length && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">TV Series</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {tvShows.map((s) => (
              <MediaCard key={s.id} title={s.name} year={s.first_air_date?.slice(0, 4)} posterPath={s.poster_path} rating={s.tmdb_rating} href={`/tv/${s.id}`} />
            ))}
          </div>
        </section>
      )}

      {!!movies?.length && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Movies</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {movies.map((m) => (
              <MediaCard key={m.id} title={m.title} year={m.release_date?.slice(0, 4)} posterPath={m.poster_path} rating={m.tmdb_rating} href={`/movie/${m.id}`} />
            ))}
          </div>
        </section>
      )}

      {!tvShows?.length && !movies?.length && (
        <p className="py-12 text-center text-muted dark:text-mutedDark">Nothing synced for {name} yet — run the sync job or check back soon.</p>
      )}
    </div>
  )
}
