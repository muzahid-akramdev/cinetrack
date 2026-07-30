'use client'

import { useState } from 'react'
import { suggestMissingTitle } from '@/lib/actions'

export default function SuggestTitlePage() {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="max-w-lg">
      <h1 className="mb-2 font-display text-2xl font-semibold">Suggest a missing title</h1>
      <p className="mb-6 text-sm text-muted dark:text-mutedDark">
        Can&rsquo;t find a movie or show — especially something Bangladeshi? Let us know and we&rsquo;ll add it.
      </p>
      {done ? (
        <p className="rounded-lg bg-reel/10 p-4 text-reel">Thanks — we&rsquo;ll take a look.</p>
      ) : (
        <form
          action={async (formData) => {
            setError(null)
            try {
              await suggestMissingTitle(formData)
              setDone(true)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Something went wrong.')
            }
          }}
          className="space-y-4"
        >
          <input name="title" required placeholder="Title" className="input w-full" />
          <textarea name="note" placeholder="Any details — year, country, where you'd expect to find it…" className="input w-full" rows={3} />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" className="btn-primary">Submit</button>
        </form>
      )}
    </div>
  )
}
