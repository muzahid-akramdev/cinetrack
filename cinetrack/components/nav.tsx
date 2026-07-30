import Link from 'next/link'
import { Clapperboard, Search, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ThemeToggle, SignOutButton } from './nav-controls'

export async function Nav() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let username: string | null = null
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('username, is_admin').eq('id', user.id).single()
    username = profile?.username ?? null
    isAdmin = profile?.is_admin ?? false
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur dark:border-lineDark dark:bg-ink/90">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-1.5 font-display text-lg font-semibold tracking-tight">
          <Clapperboard className="h-5 w-5 text-marquee" /> CineTrack
        </Link>

        <nav className="hidden items-center gap-4 text-sm text-ink/70 dark:text-paper/70 sm:flex">
          <Link href="/movies" className="hover:text-ink dark:hover:text-paper">Movies</Link>
          <Link href="/tv" className="hover:text-ink dark:hover:text-paper">TV</Link>
          <Link href="/browse/country/BD" className="hover:text-ink dark:hover:text-paper">Bangladesh</Link>
          <Link href="/browse/country/KR" className="hover:text-ink dark:hover:text-paper">Korea</Link>
          <Link href="/browse/country/TR" className="hover:text-ink dark:hover:text-paper">Turkey</Link>
        </nav>

        <form action="/search" method="get" className="ml-auto flex max-w-xs flex-1 items-center gap-2 rounded-md border border-line px-2.5 py-1.5 dark:border-lineDark">
          <Search className="h-4 w-4 shrink-0 text-muted dark:text-mutedDark" />
          <input name="q" placeholder="Search movies & TV…" className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted dark:placeholder:text-mutedDark" />
        </form>

        <ThemeToggle />

        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/feed" className="hidden text-ink/70 hover:text-ink dark:text-paper/70 dark:hover:text-paper lg:inline">Feed</Link>
            <Link href="/me/watchlist" className="hidden text-ink/70 hover:text-ink dark:text-paper/70 dark:hover:text-paper lg:inline">Watchlist</Link>
            <Link href="/me/watched" className="hidden text-ink/70 hover:text-ink dark:text-paper/70 dark:hover:text-paper lg:inline">Watched</Link>
            <Link href="/me/lists" className="hidden text-ink/70 hover:text-ink dark:text-paper/70 dark:hover:text-paper lg:inline">Lists</Link>
            {isAdmin && (
              <Link href="/admin" className="hidden font-medium text-marquee hover:underline lg:inline">Admin</Link>
            )}
            <Link href="/me/settings" aria-label="Settings" className="text-ink/70 hover:text-ink dark:text-paper/70 dark:hover:text-paper">
              <Settings className="h-4 w-4" />
            </Link>
            <Link href={`/profile/${username}`} className="font-medium hover:underline">
              {username}
            </Link>
            <SignOutButton />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Link href="/login" className="btn-ghost">Log in</Link>
            <Link href="/signup" className="btn-primary">Sign up</Link>
          </div>
        )}
      </div>
    </header>
  )
}
