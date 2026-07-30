import { createClient } from '@/lib/supabase/server'
import { DeleteReviewButton } from '@/components/admin-controls'

interface AdminReviewRow {
  id: string
  rating: number
  body: string
  profiles: { username: string } | null
  movies: { title: string } | null
  tv_shows: { name: string } | null
}

export default async function AdminReviewsPage() {
  const supabase = await createClient()
  const { data: reviewsRaw } = await supabase
    .from('reviews')
    .select('id, rating, body, profiles(username), movies(title), tv_shows(name)')
    .order('created_at', { ascending: false })
    .limit(50)
  const reviews = (reviewsRaw ?? []) as unknown as AdminReviewRow[]

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-xl border border-line p-4 dark:border-lineDark">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm">
                <span className="font-medium">{r.profiles?.username}</span> on{' '}
                <span className="font-medium">{r.movies?.title ?? r.tv_shows?.name}</span>{' '}
                <span className="font-mono text-xs text-muted dark:text-mutedDark">{r.rating}/10</span>
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-ink/70 dark:text-paper/70">{r.body}</p>
            </div>
            <DeleteReviewButton reviewId={r.id} />
          </div>
        </div>
      ))}
      {!reviews.length && <p className="text-muted dark:text-mutedDark">No reviews yet.</p>}
    </div>
  )
}
