import Link from 'next/link'
import { MediaCard } from './media-card'
import type { Movie, TVShow } from '@/types/database'

export function MediaRow({
  title,
  href,
  items,
  kind,
  compact,
}: {
  title: string
  href?: string
  items: (Movie | TVShow)[]
  kind: 'movie' | 'tv'
  compact?: boolean
}) {
  if (!items.length) return null
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between">
        <h2 className={compact ? 'font-display text-xl font-semibold' : 'font-display text-2xl font-semibold'}>{title}</h2>
        {href && (
          <Link href={href} className="text-sm text-muted hover:text-ink dark:text-mutedDark dark:hover:text-paper">
            See all →
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((item) =>
          kind === 'movie' ? (
            <MediaCard
              key={item.id}
              title={(item as Movie).title}
              year={(item as Movie).release_date?.slice(0, 4)}
              posterPath={item.poster_path}
              rating={item.tmdb_rating}
              href={`/movie/${item.id}`}
            />
          ) : (
            <MediaCard
              key={item.id}
              title={(item as TVShow).name}
              year={(item as TVShow).first_air_date?.slice(0, 4)}
              posterPath={item.poster_path}
              rating={item.tmdb_rating}
              href={`/tv/${item.id}`}
            />
          )
        )}
      </div>
    </section>
  )
}
