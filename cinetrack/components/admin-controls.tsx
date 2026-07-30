'use client'

import { useState, useTransition } from 'react'
import { triggerManualSync, updateMissingTitleStatus, adminDeleteReview, adminCreateManualTitle } from '@/lib/admin-actions'

export function SyncTriggerButton() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null)
            try {
              const result = await triggerManualSync()
              setMessage(`Processed ${result.rowsProcessed} rows${result.errors.length ? `, ${result.errors.length} errors` : ''}.`)
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Sync failed.')
            }
          })
        }
        className="btn-primary"
      >
        {isPending ? 'Syncing…' : 'Run sync now'}
      </button>
      {message && <p className="mt-2 font-mono text-xs text-muted dark:text-mutedDark">{message}</p>}
    </div>
  )
}

export function MissingTitleActions({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <div className="flex shrink-0 gap-2">
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => { await updateMissingTitleStatus({ id, status: 'added' }) })}
        className="btn-ghost border border-line text-reel dark:border-lineDark"
      >
        Mark added
      </button>
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => { await updateMissingTitleStatus({ id, status: 'rejected' }) })}
        className="btn-ghost border border-line dark:border-lineDark"
      >
        Reject
      </button>
    </div>
  )
}

export function DeleteReviewButton({ reviewId }: { reviewId: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(async () => { await adminDeleteReview({ reviewId }) })}
      className="btn-ghost shrink-0 border border-line text-red-600 dark:border-lineDark dark:text-red-400"
    >
      Remove
    </button>
  )
}

export function ManualTitleForm({ initialTitle }: { initialTitle?: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (done) return <p className="text-sm text-reel">Added to the catalog.</p>

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost border border-line dark:border-lineDark">
        Add manually
      </button>
    )
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null)
          try {
            await adminCreateManualTitle(formData)
            setDone(true)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong.')
          }
        })
      }
      className="mt-3 space-y-3 rounded-lg border border-line p-3 dark:border-lineDark"
    >
      <div className="flex gap-3">
        <select name="media_type" className="select" defaultValue="tv">
          <option value="tv">TV series</option>
          <option value="movie">Movie</option>
        </select>
        <input name="title" required defaultValue={initialTitle} placeholder="Title" className="input flex-1" />
      </div>
      <textarea name="overview" placeholder="Overview" rows={2} className="input w-full" />
      <div className="flex flex-wrap gap-3">
        <input name="poster_url" placeholder="Poster image URL (optional)" className="input flex-1" />
        <input name="country" placeholder="Country code, e.g. BD" className="input w-32" />
        <input name="language" placeholder="Language code, e.g. bn" className="input w-32" />
        <input name="date" type="date" className="input" />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? 'Adding…' : 'Add to catalog'}
      </button>
    </form>
  )
}
