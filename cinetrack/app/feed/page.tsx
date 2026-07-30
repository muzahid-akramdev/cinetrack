import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface FeedReviewRow {
  id: string
  rating: number
  body: string
  has_spoilers: boolean
  movie_id: string | null
  tv_show_id: string | null
  profiles: { username: string } | null
  movies: { id: string; title: string } | null
  tv_shows: { id: string; name: string } | null
}

export default async function FeedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: follows } = await supabase.from('follows').select('followee_id').eq('follower_id', user.id)
  const followeeIds = (follows ?? []).map((f) => f.followee_id)

  if (followeeIds.length === 0) {
    return (
      <div>
        <h1 className="mb-4 font-display text-2xl font-semibold">Your feed</h1>
        <p className="text-muted dark:text-mutedDark">You&rsquo;re not following anyone yet. Visit a profile and hit Follow to see their reviews here.</p>
      </div>
    )
  }

  const { data: reviewsRaw } = await supabase
    .from('reviews')
    .select('id, rating, body, has_spoilers, movie_id, tv_show_id, profiles(username), movies(id, title), tv_shows(id, name)')
    .in('user_id', followeeIds)
    .order('created_at', { ascending: false })
    .limit(30)

  const reviews = (reviewsRaw ?? []) as unknown as FeedReviewRow[]

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold">Your feed</h1>
      <div className="space-y-4">
        {reviews.map((r) => {
          const media = r.movies ?? r.tv_shows
          const title = r.movies ? r.movies.title : r.tv_shows?.name
          const href = r.movie_id ? `/movie/${media?.id}` : `/tv/${media?.id}`
          return (
            <div key={r.id} className="rounded-xl border border-line p-4 dark:border-lineDark">
              <p className="text-sm">
                <Link href={`/profile/${r.profiles?.username}`} className="font-medium hover:underline">
                  {r.profiles?.username}
                </Link>{' '}
                rated{' '}
                <Link href={href} className="font-medium hover:underline">
                  {title}
                </Link>{' '}
                <span className="font-mono text-xs text-muted dark:text-mutedDark">{r.rating}/10</span>
              </p>
              {!r.has_spoilers && <p className="mt-2 line-clamp-3 text-sm text-ink/80 dark:text-paper/80">{r.body}</p>}
            </div>
          )
        })}
        {reviews.length === 0 && <p className="text-muted dark:text-mutedDark">No reviews from people you follow yet.</p>}
      </div>
    </div>
  )
}
