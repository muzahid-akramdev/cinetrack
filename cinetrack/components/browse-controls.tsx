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
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-4 dark:border-lineDark"
    >
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
          <option value="az">A-Z</option>
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
}: {
  basePath: string
  searchParams: Record<string, string | undefined>
  page: number
  totalPages: number
}) {
  var safeTotal = 1
  if (typeof totalPages === 'number' && isFinite(totalPages) && totalPages > 1) {
    safeTotal = Math.floor(totalPages)
  }

  var safePage = page
  if (safePage < 1) safePage = 1
  if (safePage > safeTotal) safePage = safeTotal

  if (safeTotal <= 1) {
    return null
  }

  function makeHref(p: number) {
    var params = new URLSearchParams()
    var keys = Object.keys(searchParams)
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      if (key === 'page') continue
      var value = searchParams[key]
      if (value == null || value === '') continue
      params.set(key, String(value))
    }
    params.set('page', String(p))
    var qs = params.toString()
    if (qs.length > 0) {
      return basePath + '?' + qs
    }
    return basePath
  }

  var windowSize = 2
  var start = Math.max(1, safePage - windowSize)
  var end = Math.min(safeTotal, safePage + windowSize)
  var nums = []
  for (var n = start; n <= end; n++) {
    nums.push(n)
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-8">
      {safePage > 1 ? (
        <Link
          href={makeHref(safePage - 1)}
          className="btn-ghost flex items-center gap-1 border border-line dark:border-lineDark"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Link>
      ) : (
        <span className="w-16" />
      )}

      {start > 1 ? (
        <>
          <PageNum href={makeHref(1)} active={safePage === 1}>
            1
          </PageNum>
          {start > 2 ? <span className="px-1 text-muted dark:text-mutedDark">...</span> : null}
        </>
      ) : null}

      {nums.map(function (n) {
        return (
          <PageNum key={n} href={makeHref(n)} active={n === safePage}>
            {n}
          </PageNum>
        )
      })}

      {end < safeTotal ? (
        <>
          {end < safeTotal - 1 ? <span className="px-1 text-muted dark:text-mutedDark">...</span> : null}
          <PageNum href={makeHref(safeTotal)} active={safePage === safeTotal}>
            {safeTotal}
          </PageNum>
        </>
      ) : null}

      {safePage < safeTotal ? (
        <Link
          href={makeHref(safePage + 1)}
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

function PageNum({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  var className = active
    ? 'flex h-9 min-w-9 items-center justify-center rounded-lg bg-marquee px-2 font-mono text-sm font-semibold text-ink'
    : 'flex h-9 min-w-9 items-center justify-center rounded-lg border border-line px-2 font-mono text-sm hover:border-marquee dark:border-lineDark'

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
