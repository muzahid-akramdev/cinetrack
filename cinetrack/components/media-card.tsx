import Link from 'next/link'
import { posterUrl } from '@/lib/tmdb'
import { cn } from '@/lib/utils'
import { SmartImage } from './smart-image'

export function RatingStamp({ value, size = 'sm' }: { value: number | null | undefined; size?: 'sm' | 'lg' }) {
  if (!value) return null
  const dims = size === 'lg' ? 'h-14 w-14 text-sm' : 'h-9 w-9 text-xs'
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-dashed border-marquee bg-ink/80 font-mono font-semibold text-marquee backdrop-blur-sm',
        dims
      )}
      style={{ transform: 'rotate(-8deg)' }}
      aria-label={`Rated ${value.toFixed(1)} out of 10`}
    >
      {value.toFixed(1)}
    </div>
  )
}

interface CardProps {
  title: string
  year?: string | null
  posterPath?: string | null
  rating?: number | null
  href: string
  className?: string
}

export function MediaCard({ title, year, posterPath, rating, href, className }: CardProps) {
  const src = posterUrl(posterPath, 'w342')
  return (
    <Link href={href} className={cn('group block w-40 shrink-0 sm:w-44', className)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface ring-1 ring-line dark:bg-surfaceDark dark:ring-lineDark">
        {src ? (
          <SmartImage src={src} alt={title} fill sizes="(max-width: 640px) 40vw, 176px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center font-display text-sm text-muted dark:text-mutedDark">{title}</div>
        )}
        {typeof rating === 'number' && rating > 0 && (
          <div className="absolute bottom-1.5 right-1.5">
            <RatingStamp value={rating} />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 font-display text-sm font-medium leading-snug text-ink dark:text-paper">{title}</p>
      {year && <p className="font-mono text-xs text-muted dark:text-mutedDark">{year}</p>}
    </Link>
  )
}
