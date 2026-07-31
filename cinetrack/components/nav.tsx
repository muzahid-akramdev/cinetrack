import Link from 'next/link'
import {
  Clapperboard,
  Search,
  Settings,
  Bookmark,
  CheckCircle2,
  List,
  Rss,
  Shield,
  User,
} from 'lucide-react'
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, is_admin')
      .eq('id', user.id)
      .single()
    username = profile?.username ?? null
    isAdmin = profile?.is_admin ?? false
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur dark:border-lineDark dark:bg-ink/90">
      {/* Top row */}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 font-display text-lg font-semibold tracking-tight"
        >
          <Clapperboard className="h-5 w-5 text-marquee" /> CineTrack
        </Link>

        <nav className="hidden items-center gap-1 text-sm sm:flex">
          <NavLink href="/movies">Movies</NavLink>
          <NavLink href="/tv">TV</NavLink>
          <NavLink href="/browse/country/BD">BD</NavLink>
          <NavLink href="/browse/country/KR">Korea</NavLink>
          <NavLink href="/browse/country/TR">Turkey</NavLink>
        </nav>

        <form
          action="/search"
          method="get"
          className="ml-auto flex max-w-xs flex-1 items-center gap-2 rounded-md border border-line px-2.5 py-1.5 dark:border-lineDark"
        >
          <Search className="h-4 w-4 shrink-0 text-muted dark:text-mutedDark" />
          <input
            name="q"
            placeholder="Search…"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted dark:placeholder:text-mutedDark"
          />
        </form>

        <ThemeToggle />

        {user ? (
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/profile/${username}`}
              className="hidden font-medium hover:underline sm:inline"
            >
              {username}
            </Link>
            <SignOutButton />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Link href="/login" className="btn-ghost">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary">
              Sign up
            </Link>
          </div>
        )}
      </div>

      {/* User action buttons — always visible when logged in */}
      {user && (
        <div className="border-t border-line dark:border-lineDark">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2">
            <TabButton href="/me/watchlist" icon={<Bookmark className="h-3.5 w-3.5" />}>
              Watchlist
            </TabButton>
            <TabButton href="/me/watched" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
              Watched
            </TabButton>
            <TabButton href="/me/lists" icon={<List className="h-3.5 w-3.5" />}>
              Lists
            </TabButton>
            <TabButton href="/feed" icon={<Rss className="h-3.5 w-3.5" />}>
              Feed
            </TabButton>
            <TabButton href={`/profile/${username}`} icon={<User className="h-3.5 w-3.5" />}>
              Profile
            </TabButton>
            <TabButton href="/me/settings" icon={<Settings className="h-3.5 w-3.5" />}>
              Settings
            </TabButton>
            {isAdmin && (
              <TabButton href="/admin" icon={<Shield className="h-3.5 w-3.5" />} highlight>
                Admin
              </TabButton>
            )}
          </div>
        </div>
      )}

      {/* Mobile catalog links */}
      <div className="border-t border-line dark:border-lineDark sm:hidden">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2">
          <TabButton href="/movies">Movies</TabButton>
          <TabButton href="/tv">TV</TabButton>
          <TabButton href="/browse/country/BD">BD</TabButton>
          <TabButton href="/browse/country/IN">India</TabButton>
          <TabButton href="/browse/country/KR">Korea</TabButton>
          <TabButton href="/browse/country/TR">Turkey</TabButton>
          <TabButton href="/browse/country/PK">Pakistan</TabButton>
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2.5 py-1.5 text-ink/70 hover:bg-ink/5 hover:text-ink dark:text-paper/70 dark:hover:bg-paper/10 dark:hover:text-paper"
    >
      {children}
    </Link>
  )
}

function TabButton({
  href,
  children,
  icon,
  highlight,
}: {
  href: string
  children: React.ReactNode
  icon?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        highlight
          ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-marquee bg-marquee/10 px-3 py-1.5 text-xs font-medium text-marquee hover:bg-marquee/20'
          : 'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink/80 hover:border-marquee hover:text-ink dark:border-lineDark dark:text-paper/80 dark:hover:text-paper'
      }
    >
      {icon}
      {children}
    </Link>
  )
}
