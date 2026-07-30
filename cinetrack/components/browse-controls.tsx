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
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Language">
        <select name="language" defaultValue={searchParams.language ?? ''} className="select">
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Country">
        <select name="country" defaultValue={searchParams.country ?? ''} className="select">
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Year">
        <input
          type="number"
          name="year"
          placeholder="Any"
          defaultValue={searchParams.year ?? ''}
          className="input w-24"
        />
      </Field>
      <Field label="Min rating">
        <input
          type="number"
          step="0.1"
          min="0"
          max="10"
          name="min_rating"
          placeholder="Any"
          defaultValue={searchParams.min_rating ?? ''}
          className="input w-24"
        />
      </Field>
      <Field label="Sort by">
        <select name="sort" defaultValue={searchParams.sort ?? 'popularity'} className="select">
          <option value="popularity">Popularity</option>
          <option value="rating">Rating</option>
          <option value="date">Release date</option>
          <option value="az">A–Z</option>
        </select>
      </Field>
      <button type="submit" className="btn-primary">
        Apply
      </button>
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
  totalPages,
  hasMore,
}: {
  basePath: string
  searchParams: Record<string, string | undefined>
  page: number
  totalPages?: number
  /** @deprecated use totalPages instead */
  hasMore?: boolean
}) {
  const pages = totalPages ?? (hasMore ? page + 1 : page)
  if (pages <= 1) return null

  const makeHref = (p: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (v != null && k !== 'page') sp.set(k, v)
    }
    sp.set('page', String(p))
    return `\( {basePath}? \){sp.toString()}`
  }

  // Show a window of page numbers around current page
  const windowSize = 2
  const start = Math.max(1, page - windowSize)
  const end = Math.min(pages, page + windowSize)
  const nums: number[] = []
  for (let i = start; i <= end; i++) nums.push(i)

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-8">
      {page > 1 ? (
        <Link
          href={makeHref(page - 1)}
          className="btn-ghost flex items-center gap-1 border border-line dark:border-lineDark"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Link>
      ) : (
        <span className="w-16" />
      )}

      {start > 1 && (
        <>
          <PageLink href={makeHref(1)} active={page === 1}>
            1
          </PageLink>
          {start > 2 && <span className="px-1 text-muted dark:text-mutedDark">…</span>}
        </>
      )}

      {nums.map((n) => (
        <PageLink key={n} href={makeHref(n)} active={n === page}>
          {n}
        </PageLink>
      ))}

      {end < pages && (
        <>
          {end < pages - 1 && <span className="px-1 text-muted dark:text-mutedDark">…</span>}
          <PageLink href={makeHref(pages)} active={page === pages}>
            {pages}
          </PageLink>
        </>
      )}

      {page < pages ? (
        <Link
          href={makeHref(page + 1)}
          className="btn-ghost flex items-center gap-1 border border-line dark:border-lineDark"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="w-16" />
      )}
    </div>
  )
}

function PageLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'flex h-9 min-w-9 items-center justify-center rounded-lg bg-marquee px-2 font-mono text-sm font-semibold text-ink'
          : 'flex h-9 min-w-9 items-center justify-center rounded-lg border border-line px-2 font-mono text-sm hover:border-marquee dark:border-lineDark'
      }
    >
      {children}
    </Link>
  )
}
