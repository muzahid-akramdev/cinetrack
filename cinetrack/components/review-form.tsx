'use client'

import { useState, useTransition } from 'react'
import { upsertReview, deleteReview } from '@/lib/actions'
import { StarRating } from './actions-ui'

export function ReviewForm({
  movieId,
  tvShowId,
  path,
  existing,
}: {
  movieId?: string
  tvShowId?: string
  path: string
  existing?: { id: string; rating: number; body: string; has_spoilers: boolean } | null
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [body, setBody] = useState(existing?.body ?? '')
  const [hasSpoilers, setHasSpoilers] = useState(existing?.has_spoilers ?? false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await upsertReview({ movieId, tvShowId, rating, body, hasSpoilers, path })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function handleDelete() {
    if (!existing) return
    startTransition(async () => {
      try {
        await deleteReview({ reviewId: existing.id, path })
        setBody('')
        setRating(0)
        setHasSpoilers(false)
        setDeleted(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  if (deleted) {
    return <p className="rounded-xl border border-line p-4 text-sm text-muted dark:border-lineDark dark:text-mutedDark">Review deleted.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-line p-4 dark:border-lineDark">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">
        {existing ? 'Your review' : 'Write a review'}
      </p>
      <StarRating value={rating} onChange={setRating} disabled={isPending} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you think?" rows={4} className="input w-full" />
      <label className="flex items-center gap-2 text-sm text-muted dark:text-mutedDark">
        <input type="checkbox" checked={hasSpoilers} onChange={(e) => setHasSpoilers(e.target.checked)} />
        Contains spoilers
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending || rating === 0 || !body.trim()} className="btn-primary">
          {isPending ? 'Saving…' : existing ? 'Update review' : 'Post review'}
        </button>
        {existing && (
          <button type="button" disabled={isPending} onClick={handleDelete} className="btn-ghost text-red-600 dark:text-red-400">
            Delete
          </button>
        )}
        {saved && <span className="text-sm text-reel">Saved.</span>}
      </div>
    </form>
  )
}
