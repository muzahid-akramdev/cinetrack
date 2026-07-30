'use client'

import Link from 'next/link'
import { use, useActionState } from 'react'
import { signIn, type AuthFormState } from '@/lib/auth-actions'

const initialState: AuthFormState = {}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ confirm?: string }> }) {
  const { confirm } = use(searchParams)
  const [state, formAction, isPending] = useActionState(signIn, initialState)

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 font-display text-2xl font-semibold">Log in</h1>
      {confirm === '1' && (
        <p className="mb-4 rounded-lg bg-reel/10 p-3 text-sm text-reel">Check your email to confirm your account, then log in below.</p>
      )}
      <form action={formAction} className="space-y-4">
        <input name="email" type="email" required placeholder="Email" className="input w-full" />
        <input name="password" type="password" required placeholder="Password" className="input w-full" />
        {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
        <button type="submit" disabled={isPending} className="btn-primary w-full">
          {isPending ? 'Signing in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted dark:text-mutedDark">
        No account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </div>
  )
}
