import Link from 'next/link'

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line py-8 text-sm text-muted dark:border-lineDark dark:text-mutedDark">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p>This product uses the TMDb API but is not endorsed or certified by TMDb.</p>
          <p className="mt-1">
            {/* TMDb also requires their logo alongside this notice — grab it from
               themoviedb.org/about/logos-attribution and drop it here; this
               environment can't fetch external image assets. */}
            <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="underline hover:text-ink dark:hover:text-paper">
              themoviedb.org
            </a>{' '}
            · No ads. No payments.
          </p>
        </div>
        <Link href="/suggest-title" className="underline hover:text-ink dark:hover:text-paper">
          Suggest a missing title
        </Link>
      </div>
    </footer>
  )
}
