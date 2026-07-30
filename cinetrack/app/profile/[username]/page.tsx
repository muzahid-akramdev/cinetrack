import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FollowButton } from '@/components/follow-button'
import type { Movie, TVShow, ShowStatus } from '@/types/database'

interface WatchedRow {
  rating: number | null
  watched_at: string
  movies: Movie
}
interface ProgressRow {
  rating: number | null
  status: ShowStatus
  tv_shows: TVShow
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase.from('profiles').select('*').eq('username', username).single()
  if (!profile) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: watchedRaw },
    { data: progressRaw },
    { data: publicLists },
    { data: recentReviews },
    { count: followerCount },
    { count: followingCount },
    { data: iFollowRow },
  ] = await Promise.all([
    supabase.from('watched').select('rating, watched_at, movies(*)').eq('user_id', profile.id),
    supabase.from('show_progress').select('rating, status, tv_shows(*)').eq('user_id', profile.id),
    supabase.from('lists').select('*').eq('user_id', profile.id).eq('is_public', true).order('created_at', { ascending: false }),
    supabase.from('reviews').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    user ? supabase.from('follows').select('*').eq('follower_id', user.id).eq('followee_id', profile.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const watched = (watchedRaw ?? []) as unknown as WatchedRow[]
  const progress = (progressRaw ?? []) as unknown as ProgressRow[]

  const thisYear = new Date().getFullYear()
  const moviesWatchedThisYear = watched.filter((w) => new Date(w.watched_at).getFullYear() === thisYear).length
  const showsCompleted = progress.filter((p) => p.status === 'completed').length

  const genreCounts = new Map<string, number>()
  for (const w of watched) for (const g of w.movies?.genres ?? []) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
  for (const p of progress) for (const g of p.tv_shows?.genres ?? []) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const allRatings = [...watched.map((w) => w.rating), ...progress.map((p) => p.rating)].filter((r): r is number => r != null)
  const avgRating = allRatings.length ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : null

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface font-display text-xl dark:bg-surfaceDark">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied URL, not a known remote pattern
              <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover" />
            ) : (
              profile.username[0]?.toUpperCase()
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">{profile.username}</h1>
            {profile.bio && <p className="max-w-md text-sm text-ink/70 dark:text-paper/70">{profile.bio}</p>}
            <p className="mt-1 font-mono text-xs text-muted dark:text-mutedDark">
              {followerCount ?? 0} followers · {followingCount ?? 0} following
            </p>
          </div>
        </div>
        {user && user.id !== profile.id && <FollowButton profileId={profile.id} initialFollowing={!!iFollowRow} path={`/profile/${username}`} />}
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={`Watched in ${thisYear}`} value={moviesWatchedThisYear} />
        <Stat label="Movies watched" value={watched.length} />
        <Stat label="Shows completed" value={showsCompleted} />
        <Stat label="Average rating" value={avgRating ? avgRating.toFixed(1) : '—'} />
      </div>

      {topGenres.length > 0 && (
        <div className="mb-10 flex flex-wrap gap-2">
          {topGenres.map(([genre, count]) => (
            <span key={genre} className="rounded-full bg-ink/5 px-3 py-1 text-xs dark:bg-paper/10">
              {genre} <span className="font-mono text-muted dark:text-mutedDark">({count})</span>
            </span>
          ))}
        </div>
      )}

      {!!recentReviews?.length && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Recent reviews</h2>
          <div className="space-y-3">
            {recentReviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-line p-4 text-sm dark:border-lineDark">
                <span className="font-mono text-xs text-muted dark:text-mutedDark">{r.rating}/10</span>
                <p className="mt-1 line-clamp-3 text-ink/80 dark:text-paper/80">{r.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!publicLists?.length && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Public lists</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {publicLists.map((list) => (
              <Link key={list.id} href={`/lists/${list.id}`} className="rounded-xl border border-line p-4 hover:border-marquee dark:border-lineDark">
                <p className="font-display font-medium">{list.name}</p>
                {list.description && <p className="text-sm text-muted dark:text-mutedDark">{list.description}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line p-4 dark:border-lineDark">
      <p className="font-mono text-2xl font-semibold text-marquee">{value}</p>
      <p className="text-xs text-muted dark:text-mutedDark">{label}</p>
    </div>
  )
}
