import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { posterUrl, backdropUrl } from '@/lib/tmdb'
import { getSimilarMovies } from '@/lib/recommendations'
import { WatchlistButton, MovieWatchedControl } from '@/components/actions-ui'
import { AddToListButton } from '@/components/list-controls'
import { ReviewForm } from '@/components/review-form'
import { ReviewList, type ReviewItem } from '@/components/review-list'
import { MediaRow } from '@/components/media-row'
import { SourceBadge } from '@/components/source-badge'
import { SmartImage } from '@/components/smart-image'

export const revalidate = 3600

interface CreditRow {
  role: 'cast' | 'crew'
  character_name: string | null
  job: string | null
  sort_order: number
  people: { id: string; name: string; profile_path: string | null }
}

interface ReviewRow {
  id: string
  user_id: string
  rating: number
  body: string
  has_spoilers: boolean
  created_at: string
  profiles: { username: string } | null
}

export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: movie } = await supabase
    .from('movies')
    .select('*, credits ( role, character_name, job, sort_order, people ( id, name, profile_path ) )')
    .eq('id', id)
    .single()

  if (!movie) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let inWatchlist = false
  let watched: { rating: number | null } | null = null
  let myLists: { id: string; name: string }[] = []

  if (user) {
    const [{ data: wl }, { data: w }, { data: lists }] = await Promise.all([
      supabase.from('watchlist').select('id').eq('user_id', user.id).eq('movie_id', movie.id).maybeSingle(),
      supabase.from('watched').select('rating').eq('user_id', user.id).eq('movie_id', movie.id).maybeSingle(),
      supabase.from('lists').select('id, name').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    inWatchlist = !!wl
    watched = w
    myLists = lists ?? []
  }

  // Reviews: fetch likes separately rather than a nested count-embed, since
  // that's a query shape I'm confident about without needing to test it live.
  const { data: reviewsRaw } = await supabase
    .from('reviews')
    .select('id, user_id, rating, body, has_spoilers, created_at, profiles(username)')
    .eq('movie_id', movie.id)
    .order('created_at', { ascending: false })
  const allReviews = (reviewsRaw ?? []) as unknown as ReviewRow[]

  const reviewIds = allReviews.map((r) => r.id)
  const { data: likesRaw } = reviewIds.length
    ? await supabase.from('review_likes').select('review_id, user_id').in('review_id', reviewIds)
    : { data: [] as { review_id: string; user_id: string }[] }

  const likeCountByReview = new Map<string, number>()
  const likedByMeSet = new Set<string>()
  for (const like of likesRaw ?? []) {
    likeCountByReview.set(like.review_id, (likeCountByReview.get(like.review_id) ?? 0) + 1)
    if (user && like.user_id === user.id) likedByMeSet.add(like.review_id)
  }

  const myReview = user ? allReviews.find((r) => r.user_id === user.id) : undefined
  const otherReviews: ReviewItem[] = allReviews
    .filter((r) => r.user_id !== user?.id)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      has_spoilers: r.has_spoilers,
      created_at: r.created_at,
      username: r.profiles?.username ?? 'Unknown',
      likeCount: likeCountByReview.get(r.id) ?? 0,
      likedByMe: likedByMeSet.has(r.id),
    }))

  const similarMovies = await getSimilarMovies(supabase, { id: movie.id, genres: movie.genres ?? [] })

  const credits = (movie.credits ?? []) as unknown as CreditRow[]
  const cast = credits.filter((c) => c.role === 'cast').sort((a, b) => a.sort_order - b.sort_order).slice(0, 12)
  const director = credits.find((c) => c.role === 'crew' && c.job === 'Director')

  const path = `/movie/${movie.id}`
  const backdrop = backdropUrl(movie.backdrop_path)
  const poster = posterUrl(movie.poster_path, 'w500')

  return (
    <div>
      {backdrop && (
        <div className="relative -mx-4 mb-6 h-64 overflow-hidden rounded-xl sm:h-80">
          <SmartImage src={backdrop} alt="" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-paper dark:from-ink" />
        </div>
      )}
      <div className="grid gap-8 sm:grid-cols-[220px_1fr]">
        <div>
          {poster ? (
            <SmartImage src={poster} alt={movie.title} width={500} height={750} className="rounded-xl" />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center rounded-xl bg-surface p-4 text-center font-display dark:bg-surfaceDark">{movie.title}</div>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold">{movie.title}</h1>
            <SourceBadge source={movie.source} />
          </div>
          <p className="mt-1 font-mono text-sm text-muted dark:text-mutedDark">
            {movie.release_date?.slice(0, 4)}
            {movie.runtime ? ` · ${movie.runtime} min` : ''}
            {movie.original_language ? ` · ${movie.original_language.toUpperCase()}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(movie.genres ?? []).map((g: string) => (
              <span key={g} className="rounded-full bg-ink/5 px-2.5 py-0.5 text-xs dark:bg-paper/10">{g}</span>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-ink/80 dark:text-paper/80">{movie.overview}</p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            {movie.tmdb_rating != null && (
              <div className="text-sm">
                <span className="font-mono font-semibold">{movie.tmdb_rating}</span>
                <span className="text-muted dark:text-mutedDark">/10 TMDb ({movie.tmdb_vote_count ?? 0} votes)</span>
              </div>
            )}
            {movie.imdb_rating != null && (
              <div className="text-sm">
                <span className="font-mono font-semibold">{movie.imdb_rating}</span>
                <span className="text-muted dark:text-mutedDark">/10 IMDb ({(movie.imdb_vote_count ?? 0).toLocaleString()} votes)</span>
              </div>
            )}
            {movie.imdb_id && (
              <a href={`https://www.imdb.com/title/${movie.imdb_id}/`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-muted hover:text-ink dark:text-mutedDark dark:hover:text-paper">
                IMDb <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-start gap-6">
            {user ? (
              <>
                <WatchlistButton movieId={movie.id} initialInWatchlist={inWatchlist} path={path} />
                <MovieWatchedControl movieId={movie.id} initialRating={watched?.rating ?? null} initialWatched={!!watched} path={path} />
                <AddToListButton movieId={movie.id} lists={myLists} path={path} />
              </>
            ) : (
              <p className="text-sm text-muted dark:text-mutedDark">
                <Link href="/login" className="underline">Log in</Link> to track, rate, or list this movie.
              </p>
            )}
          </div>

          {director && <p className="mt-6 text-sm"><span className="text-muted dark:text-mutedDark">Director:</span> {director.people.name}</p>}

          {cast.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Cast</h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {cast.map((c) => {
                  const photo = posterUrl(c.people.profile_path, 'w185')
                  return (
                    <Link key={c.people.id} href={`/person/${c.people.id}`} className="w-24 shrink-0 text-center">
                      <div className="relative aspect-square overflow-hidden rounded-full bg-surface dark:bg-surfaceDark">
                        {photo && <SmartImage src={photo} alt={c.people.name} fill className="object-cover" />}
                      </div>
                      <p className="mt-1.5 truncate text-xs font-medium">{c.people.name}</p>
                      <p className="truncate font-mono text-xs text-muted dark:text-mutedDark">{c.character_name}</p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl font-semibold">Reviews</h2>
        {user ? (
          <div className="mb-6">
            <ReviewForm movieId={movie.id} path={path} existing={myReview ? { id: myReview.id, rating: myReview.rating, body: myReview.body, has_spoilers: myReview.has_spoilers } : null} />
          </div>
        ) : (
          <p className="mb-6 text-sm text-muted dark:text-mutedDark">
            <Link href="/login" className="underline">Log in</Link> to write a review.
          </p>
        )}
        <ReviewList reviews={otherReviews} path={path} />
      </section>

      <MediaRow title="More like this" items={similarMovies} kind="movie" compact />
    </div>
  )
}
