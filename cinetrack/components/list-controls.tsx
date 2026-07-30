'use client'

import { useState, useTransition } from 'react'
import { ListPlus, Trash2, X } from 'lucide-react'
import { createList, addToList, deleteList, removeFromList } from '@/lib/actions'

export function AddToListButton({
  movieId,
  tvShowId,
  lists,
  path,
}: {
  movieId?: string
  tvShowId?: string
  lists: { id: string; name: string }[]
  path: string
}) {
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost flex items-center gap-2 border border-line dark:border-lineDark">
        <ListPlus className="h-4 w-4" /> Add to list
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-52 rounded-lg border border-line bg-surface p-1 shadow-lg dark:border-lineDark dark:bg-surfaceDark">
          {lists.length === 0 && <p className="p-2 text-xs text-muted dark:text-mutedDark">No lists yet — create one from Your lists.</p>}
          {lists.map((list) => (
            <button
              key={list.id}
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await addToList({ listId: list.id, movieId, tvShowId, path })
                  setAdded(true)
                  setOpen(false)
                  setTimeout(() => setAdded(false), 2000)
                })
              }
              className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-ink/5 dark:hover:bg-paper/10"
            >
              {list.name}
            </button>
          ))}
        </div>
      )}
      {added && <p className="mt-1 text-xs text-reel">Added.</p>}
    </div>
  )
}

export function CreateListForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null)
          try {
            await createList(formData)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong.')
          }
        })
      }
      className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-4 dark:border-lineDark"
    >
      <input name="name" required placeholder="List name" className="input" />
      <input name="description" placeholder="Description (optional)" className="input flex-1" />
      <label className="flex items-center gap-1.5 text-sm text-muted dark:text-mutedDark">
        <input type="checkbox" name="is_public" /> Public
      </label>
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? 'Creating…' : 'Create'}
      </button>
      {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  )
}

/** Stops the parent <Link> navigation so the click only deletes, doesn't also open the list. */
export function DeleteListButton({ listId }: { listId: string }) {
  const [isPending, startTransition] = useTransition()
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return (
    <button
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        startTransition(async () => {
          await deleteList({ listId })
          setHidden(true)
        })
      }}
      aria-label="Delete list"
      className="rounded-md p-1 text-muted hover:text-red-600 dark:text-mutedDark"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}

export function RemoveFromListButton({ itemId, path }: { itemId: string; path: string }) {
  const [isPending, startTransition] = useTransition()
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await removeFromList({ itemId, path })
          setHidden(true)
        })
      }
      aria-label="Remove from list"
      className="absolute right-1.5 top-1.5 rounded-full bg-ink/70 p-1 text-white hover:bg-red-600"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}
