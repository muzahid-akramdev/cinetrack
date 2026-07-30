import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ensureSeasonsLoaded } from '@/lib/sync'
import { posterUrl, backdropUrl } from '@/lib/tmdb'
import { getSimilarTV } from '@/lib/recommendations'
import { ShowStatusControl } from '@/components/actions-ui'
import { AddToListButton } from '@/components/list-controls'
import { ReviewForm } from '@/components/review-form'
import { ReviewList, type ReviewItem } from '@/components/review-list'
import { MediaRow } from '@/components/media-row'
import { SourceBadge } from '@/components/source-badge'
import { SmartImage } from '@/components/smart-image'
import { SeasonAccordion } from '@/components/season-accordion'
import type { ShowStatus } from '@/types/database'

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

export default async function TVDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: show } = await supabase
    .from('tv_shows')
    .select('*, credits ( role, character_name, job, sort_order, people ( id, name, profile_path ) )')
    .eq('id', id)
    .single()

  if (!show) notFound()

  // Wikidata/manual-sourced shows have no tmdb_id, so there's nothing to
  // fetch season/episode data from — this only runs for TMDb-sourced shows.
  if (show.tmdb_id) {
    await ensureSeasonsLoaded(show.id, show.tmdb_id, show.seasons_synced_at, show.number_of_seasons)
  }

  const { data: seasonsRaw } = await supabase
    .from('seasons')
    .select('id, season_number, name, episode_count, episodes ( id, episode_number, name, air_date )')
    .eq('tv_show_id', show.id)
    .order('season_number', { ascending: true })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let showProgress: { rating: number | null; status: ShowStatus } | null = null
  let episodeWatchedById = new Map<string, { rating: number | null }>()
  let myLists: { id: string; name: string }[] = []

  if (user) {
    const [{ data: sp }, { data: ew }, { data: lists }] = await Promise.all([
      supabase.from('show_progress').select('rating, status').eq('user_id', user.id).eq('tv_show_id', show.id).maybeSingle(),
      supabase.from('episode_watched').select('episode_id, rating').eq('user_id', user.id),
      supabase.from('lists').select('id, name').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    showProgress = sp
    episodeWatchedById = new Map((ew ?? []).map((row) => [row.episode_id, { rating: row.rating }]))
    myLists = lists ?? []
  }

  const seasons = (seasonsRaw ?? []).map((s) => ({
    ...s,
    episodes: (s.episodes ?? [])
      .map((e) => ({ ...e, watched: episodeWatchedById.get(e.id) ?? null }))
      .sort((a, b) => a.episode_number - b.episode_number),
  }))

  const { data: reviewsRaw } = await supabase
    .from('reviews')
    .select('id, user_id, rating, body, has_spoilers, created_at, profiles(username)')
    .eq('tv_show_id', show.id)
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

  const similarShows = await getSimilarTV(supabase, { id: show.id, genres: show.genres ?? [] })

  const credits = (show.credits ?? []) as unknown as CreditRow[]
  const cast = credits.filter((c) => c.role === 'cast').sort((a, b) => a.sort_order - b.sort_order).slice(0, 12)
  const creator = credits.find((c) => c.role === 'crew' && c.job === 'Creator')

  const path = `/tv/${show.id}`
  const backdrop = backdropUrl(show.backdrop_path)
  const poster = posterUrl(show.poster_path, 'w500')

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
            <SmartImage src={poster} alt={show.name} width={500} height={750} className="rounded-xl" />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center rounded-xl bg-surface p-4 text-center font-display dark:bg-surfaceDark">{show.name}</div>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold">{show.name}</h1>
            <SourceBadge source={show.source} />
          </div>
          <p className="mt-1 font-mono text-sm text-muted dark:text-mutedDark">
            {show.first_air_date?.slice(0, 4)}
            {show.number_of_seasons ? ` · ${show.number_of_seasons} season${show.number_of_seasons === 1 ? '' : 's'}` : ''}
            {show.original_language ? ` · ${show.original_language.toUpperCase()}` : ''}
            {show.status ? ` · ${show.status}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(show.genres ?? []).map((g: string) => (
              <span key={g} className="rounded-full bg-ink/5 px-2.5 py-0.5 text-xs dark:bg-paper/10">{g}</span>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-ink/80 dark:text-paper/80">{show.overview}</p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            {show.tmdb_rating != null && (
              <div className="text-sm">
                <span className="font-mono font-semibold">{show.tmdb_rating}</span>
                <span className="text-muted dark:text-mutedDark">/10 TMDb ({show.tmdb_vote_count ?? 0} votes)</span>
              </div>
            )}
            {show.imdb_rating != null && (
              <div className="text-sm">
                <span className="font-mono font-semibold">{show.imdb_rating}</span>
                <span className="text-muted dark:text-mutedDark">/10 IMDb ({(show.imdb_vote_count ?? 0).toLocaleString()} votes)</span>
              </div>
            )}
            {show.imdb_id && (
              <a href={`https://www.imdb.com/title/${show.imdb_id}/`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-muted hover:text-ink dark:text-mutedDark dark:hover:text-paper">
                IMDb <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="mt-6">
            {user ? (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Series rating &amp; status</p>
                <ShowStatusControl tvShowId={show.id} initialStatus={showProgress?.status ?? null} initialRating={showProgress?.rating ?? null} path={path} />
                <div className="mt-3">
                  <AddToListButton tvShowId={show.id} lists={myLists} path={path} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted dark:text-mutedDark">
                <Link href="/login" className="underline">Log in</Link> to track or rate this series — and each episode as you watch it.
              </p>
            )}
          </div>

          {creator && <p className="mt-6 text-sm"><span className="text-muted dark:text-mutedDark">Creator:</span> {creator.people.name}</p>}

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

      <div className="mt-10">
        <h2 className="mb-3 font-display text-xl font-semibold">Seasons &amp; episodes</h2>
        {seasons.length ? (
          <SeasonAccordion seasons={seasons} path={path} />
        ) : (
          <p className="text-sm text-muted dark:text-mutedDark">
            {show.source === 'tmdb' ? 'No season data yet — this show may not have aired, or the fetch is still pending.' : 'No episode-level data for this entry — it came from ' + (show.source === 'wikidata' ? 'Wikipedia, which' : 'a manual entry, which') + " doesn't include season/episode breakdowns."}
          </p>
        )}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl font-semibold">Reviews</h2>
        {user ? (
          <div className="mb-6">
            <ReviewForm tvShowId={show.id} path={path} existing={myReview ? { id: myReview.id, rating: myReview.rating, body: myReview.body, has_spoilers: myReview.has_spoilers } : null} />
          </div>
        ) : (
          <p className="mb-6 text-sm text-muted dark:text-mutedDark">
            <Link href="/login" className="underline">Log in</Link> to write a review.
          </p>
        )}
        <ReviewList reviews={otherReviews} path={path} />
      </section>

      <MediaRow title="More like this" items={similarShows} kind="tv" compact />
    </div>
  )
}
