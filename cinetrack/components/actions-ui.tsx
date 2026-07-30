'use client'

import { useState, useTransition } from 'react'
import { Star, Bookmark, BookmarkCheck, Check } from 'lucide-react'
import {
  toggleWatchlist,
  markMovieWatched,
  unmarkMovieWatched,
  rateMovie,
  setShowStatus,
  rateShow,
  markEpisodeWatched,
  unmarkEpisodeWatched,
} from '@/lib/actions'
import type { ShowStatus } from '@/types/database'

export function WatchlistButton({
  movieId,
  tvShowId,
  initialInWatchlist,
  path,
}: {
  movieId?: string
  tvShowId?: string
  initialInWatchlist: boolean
  path: string
}) {
  const [inList, setInList] = useState(initialInWatchlist)
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleWatchlist({ movieId, tvShowId, path })
          setInList(result.inWatchlist)
        })
      }
      className="btn-ghost flex items-center gap-2 border border-line dark:border-lineDark"
    >
      {inList ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {inList ? 'On watchlist' : 'Add to watchlist'}
    </button>
  )
}

export function StarRating({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value
  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} out of 10`}
          className="p-0.5"
        >
          <Star className={`h-5 w-5 ${n <= shown ? 'fill-marquee text-marquee' : 'text-line dark:text-lineDark'}`} />
        </button>
      ))}
    </div>
  )
}

export function MovieWatchedControl({
  movieId,
  initialRating,
  initialWatched,
  path,
}: {
  movieId: string
  initialRating: number | null
  initialWatched: boolean
  path: string
}) {
  const [rating, setRating] = useState(initialRating ?? 0)
  const [watched, setWatched] = useState(initialWatched)
  const [isPending, startTransition] = useTransition()

  function handleRate(n: number) {
    setRating(n)
    setWatched(true)
    startTransition(async () => {
      await rateMovie({ movieId, rating: n, path })
    })
  }

  function toggleWatched() {
    const next = !watched
    setWatched(next)
    if (!next) setRating(0)
    startTransition(async () => {
      if (next) await markMovieWatched({ movieId, path })
      else await unmarkMovieWatched({ movieId, path })
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={toggleWatched} disabled={isPending} className="btn-ghost flex items-center gap-2 border border-line dark:border-lineDark">
        <Check className="h-4 w-4" /> {watched ? 'Watched' : 'Mark as watched'}
      </button>
      <div className="flex items-center gap-2">
        <StarRating value={rating} onChange={handleRate} disabled={isPending} />
        {rating > 0 && <span className="font-mono text-sm text-muted dark:text-mutedDark">{rating}/10</span>}
      </div>
    </div>
  )
}

export function ShowStatusControl({
  tvShowId,
  initialStatus,
  initialRating,
  path,
}: {
  tvShowId: string
  initialStatus: ShowStatus | null
  initialRating: number | null
  path: string
}) {
  const [status, setStatus] = useState<ShowStatus | ''>(initialStatus ?? '')
  const [rating, setRating] = useState(initialRating ?? 0)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-3">
      <select
        value={status}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value as ShowStatus
          setStatus(value)
          startTransition(async () => {
            await setShowStatus({ tvShowId, status: value, path })
          })
        }}
        className="select"
      >
        <option value="">Not tracking</option>
        <option value="plan_to_watch">Plan to watch</option>
        <option value="watching">Watching</option>
        <option value="completed">Completed</option>
        <option value="dropped">Dropped</option>
      </select>
      <div className="flex items-center gap-2">
        <StarRating
          value={rating}
          onChange={(n) => {
            setRating(n)
            startTransition(async () => {
              await rateShow({ tvShowId, rating: n, path })
            })
          }}
          disabled={isPending}
        />
        {rating > 0 && <span className="font-mono text-sm text-muted dark:text-mutedDark">{rating}/10 series</span>}
      </div>
    </div>
  )
}

export function EpisodeRow({
  episode,
  initialWatched,
  initialRating,
  path,
}: {
  episode: { id: string; episode_number: number; name: string | null; air_date: string | null }
  initialWatched: boolean
  initialRating: number | null
  path: string
}) {
  const [watched, setWatched] = useState(initialWatched)
  const [rating, setRating] = useState(initialRating ?? 0)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !watched
    setWatched(next)
    if (!next) setRating(0)
    startTransition(async () => {
      if (next) await markEpisodeWatched({ episodeId: episode.id, path })
      else await unmarkEpisodeWatched({ episodeId: episode.id, path })
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0 dark:border-lineDark">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          <span className="font-mono text-muted dark:text-mutedDark">{episode.episode_number}.</span> {episode.name ?? 'Untitled'}
        </p>
        {episode.air_date && <p className="font-mono text-xs text-muted dark:text-mutedDark">{episode.air_date}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {watched && (
          <StarRating
            value={rating}
            onChange={(n) => {
              setRating(n)
              startTransition(async () => {
                await markEpisodeWatched({ episodeId: episode.id, rating: n, path })
              })
            }}
            disabled={isPending}
          />
        )}
        <button
          onClick={toggle}
          disabled={isPending}
          aria-label={watched ? 'Mark episode unwatched' : 'Mark episode watched'}
          className={`rounded-full p-1.5 ${watched ? 'bg-reel text-white' : 'border border-line text-muted dark:border-lineDark dark:text-mutedDark'}`}
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
