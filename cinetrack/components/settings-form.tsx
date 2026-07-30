'use client'

import { useState, useTransition } from 'react'
import { updateProfile } from '@/lib/actions'

export function SettingsForm({ initialBio, initialAvatarUrl }: { initialBio: string; initialAvatarUrl: string }) {
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null)
          try {
            await updateProfile(formData)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong.')
          }
        })
      }
      className="space-y-4"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muted dark:text-mutedDark">Bio</span>
        <textarea name="bio" defaultValue={initialBio} rows={3} className="input w-full" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted dark:text-mutedDark">Avatar URL</span>
        <input name="avatar_url" defaultValue={initialAvatarUrl} placeholder="https://…" className="input w-full" />
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-reel">Saved.</span>}
      </div>
    </form>
  )
}
