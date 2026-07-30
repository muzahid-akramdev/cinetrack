import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function FilterBar({
  searchParams,
  genres,
  languages,
  countries,
}: {
  searchParams: Record<string, string | undefined>
  genres: string[]
  languages: { code: string; label: string }[]
  countries: { code: string; label: string }[]
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-4 dark:border-lineDark">
      <Field label="Genre">
        <select name="genre" defaultValue={searchParams.genre ?? ''} className="select">
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </Field>
      <Field label="Language">
        <select name="language" defaultValue={searchParams.language ?? ''} className="select">
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Country">
        <select name="country" defaultValue={searchParams.country ?? ''} className="select">
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Year">
        <input type="number" name="year" placeholder="Any" defaultValue={searchParams.year ?? ''} className="input w-24" />
      </Field>
      <Field label="Min rating">
        <input type="number" step="0.1" min="0" max="10" name="min_rating" placeholder="Any" defaultValue={searchParams.min_rating ?? ''} className="input w-24" />
      </Field>
      <Field label="Sort by">
        <select name="sort" defaultValue={searchParams.sort ?? 'popularity'} className="select">
          <option value="popularity">Popularity</option>
          <option value="rating">Rating</option>
          <option value="date">Release date</option>
          <option value="az">A–Z</option>
        </select>
      </Field>
      <button type="submit" className="btn-primary">Apply</button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted dark:text-mutedDark">{label}</span>
      {children}
    </label>
  )
}

export function Pagination({
  basePath,
  searchParams,
  page,
  hasMore,
}: {
  basePath: string
  searchParams: Record<string, string | undefined>
  page: number
  hasMore: boolean
}) {
  const makeHref = (p: number) => {
    const sp = new URLSearchParams(searchParams as Record<string, string>)
    sp.set('page', String(p))
    return `${basePath}?${sp.toString()}`
  }
  return (
    <div className="flex items-center justify-center gap-4 py-8">
      {page > 1 ? (
        <Link href={makeHref(page - 1)} className="btn-ghost flex items-center gap-1 border border-line dark:border-lineDark">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-sm text-muted dark:text-mutedDark">Page {page}</span>
      {hasMore ? (
        <Link href={makeHref(page + 1)} className="btn-ghost flex items-center gap-1 border border-line dark:border-lineDark">
          Next <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  )
}
