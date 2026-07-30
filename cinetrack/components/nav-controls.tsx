'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun, LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth-actions'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(stored ? stored === 'dark' : prefersDark)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-md p-2 text-ink/70 hover:bg-ink/5 hover:text-ink dark:text-paper/70 dark:hover:bg-paper/10 dark:hover:text-paper"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="flex items-center gap-1.5 text-sm text-ink/70 hover:text-ink dark:text-paper/70 dark:hover:text-paper">
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    </form>
  )
}
