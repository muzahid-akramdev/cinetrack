import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { posterUrl } from '@/lib/tmdb'
import { MediaCard } from '@/components/media-card'
import type { Movie, TVShow } from '@/types/database'

interface CreditWithMedia {
  role: 'cast' | 'crew'
  movies: Movie | null
  tv_shows: TVShow | null
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: person } = await supabase.from('people').select('*').eq('id', id).single()
  if (!person) notFound()

  const { data: creditsRaw } = await supabase.from('credits').select('role, movies(*), tv_shows(*)').eq('person_id', id)
  const credits = (creditsRaw ?? []) as unknown as CreditWithMedia[]

  const movieCredits = credits.map((c) => c.movies).filter((m): m is Movie => !!m)
  const tvCredits = credits.map((c) => c.tv_shows).filter((t): t is TVShow => !!t)

  const photo = posterUrl(person.profile_path, 'w342')

  return (
    <div className="grid gap-8 sm:grid-cols-[200px_1fr]">
      <div>
        {photo ? (
          <Image src={photo} alt={person.name} width={342} height={513} className="rounded-xl" />
        ) : (
          <div className="flex aspect-[2/3] items-center justify-center rounded-xl bg-surface p-4 text-center font-display dark:bg-surfaceDark">{person.name}</div>
        )}
      </div>
      <div>
        <h1 className="font-display text-3xl font-semibold">{person.name}</h1>
        {person.known_for_department && <p className="text-muted dark:text-mutedDark">{person.known_for_department}</p>}

        {movieCredits.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Movies</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {movieCredits.map((m) => (
                <MediaCard key={m.id} title={m.title} year={m.release_date?.slice(0, 4)} posterPath={m.poster_path} rating={m.tmdb_rating} href={`/movie/${m.id}`} />
              ))}
            </div>
          </section>
        )}

        {tvCredits.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">TV Shows</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {tvCredits.map((t) => (
                <MediaCard key={t.id} title={t.name} year={t.first_air_date?.slice(0, 4)} posterPath={t.poster_path} rating={t.tmdb_rating} href={`/tv/${t.id}`} />
              ))}
            </div>
          </section>
        )}

        {movieCredits.length === 0 && tvCredits.length === 0 && <p className="mt-8 text-sm text-muted dark:text-mutedDark">No credits synced yet.</p>}
      </div>
    </div>
  )
}
