'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { toggleReviewLike } from '@/lib/actions'

export interface ReviewItem {
  id: string
  rating: number
  body: string
  has_spoilers: boolean
  created_at: string
  username: string
  likeCount: number
  likedByMe: boolean
}

export function ReviewList({ reviews, path }: { reviews: ReviewItem[]; path: string }) {
  const [sort, setSort] = useState<'newest' | 'helpful'>('newest')

  const sorted = [...reviews].sort((a, b) =>
    sort === 'newest' ? +new Date(b.created_at) - +new Date(a.created_at) : b.likeCount - a.likeCount
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Reviews ({reviews.length})</h2>
        {reviews.length > 1 && (
          <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'helpful')} className="select">
            <option value="newest">Newest</option>
            <option value="helpful">Most helpful</option>
          </select>
        )}
      </div>
      <div className="space-y-4">
        {sorted.map((review) => (
          <ReviewCard key={review.id} review={review} path={path} />
        ))}
        {reviews.length === 0 && <p className="text-sm text-muted dark:text-mutedDark">No other reviews yet.</p>}
      </div>
    </div>
  )
}

function ReviewCard({ review, path }: { review: ReviewItem; path: string }) {
  const [revealed, setRevealed] = useState(!review.has_spoilers)
  const [liked, setLiked] = useState(review.likedByMe)
  const [count, setCount] = useState(review.likeCount)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="rounded-xl border border-line p-4 dark:border-lineDark">
      <div className="mb-2 flex items-center justify-between">
        <Link href={`/profile/${review.username}`} className="text-sm font-medium hover:underline">
          {review.username}
        </Link>
        <span className="font-mono text-xs text-muted dark:text-mutedDark">{review.rating}/10</span>
      </div>
      {revealed ? (
        <p className="whitespace-pre-wrap text-sm text-ink/80 dark:text-paper/80">{review.body}</p>
      ) : (
        <button onClick={() => setRevealed(true)} className="text-sm text-muted underline dark:text-mutedDark">
          Contains spoilers — tap to reveal
        </button>
      )}
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleReviewLike({ reviewId: review.id, path })
            setLiked(result.liked)
            setCount((c) => c + (result.liked ? 1 : -1))
          })
        }
        className={`mt-3 flex items-center gap-1 text-sm ${liked ? 'text-velvet' : 'text-muted dark:text-mutedDark'}`}
      >
        <Heart className={`h-4 w-4 ${liked ? 'fill-velvet' : ''}`} /> {count}
      </button>
    </div>
  )
}
