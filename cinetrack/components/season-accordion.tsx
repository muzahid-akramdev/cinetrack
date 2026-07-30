'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { EpisodeRow } from './actions-ui'

interface SeasonWithEpisodes {
  id: string
  season_number: number
  name: string | null
  episode_count: number | null
  episodes: {
    id: string
    episode_number: number
    name: string | null
    air_date: string | null
    watched?: { rating: number | null } | null
  }[]
}

export function SeasonAccordion({ seasons, path }: { seasons: SeasonWithEpisodes[]; path: string }) {
  const [openId, setOpenId] = useState<string | null>(seasons[0]?.id ?? null)

  return (
    <div className="divide-y divide-line rounded-xl border border-line dark:divide-lineDark dark:border-lineDark">
      {seasons.map((season) => {
        const open = openId === season.id
        return (
          <div key={season.id}>
            <button onClick={() => setOpenId(open ? null : season.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="font-display font-medium">{season.name ?? `Season ${season.season_number}`}</span>
              <span className="flex items-center gap-2 font-mono text-sm text-muted dark:text-mutedDark">
                {season.episode_count ?? season.episodes.length} episodes
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {open && (
              <div className="px-4 pb-3">
                {season.episodes.map((ep) => (
                  <EpisodeRow key={ep.id} episode={ep} initialWatched={!!ep.watched} initialRating={ep.watched?.rating ?? null} path={path} />
                ))}
                {season.episodes.length === 0 && <p className="py-3 text-sm text-muted dark:text-mutedDark">No episode data yet.</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
