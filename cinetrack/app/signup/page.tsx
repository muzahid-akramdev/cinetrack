'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { signUp, type AuthFormState } from '@/lib/auth-actions'

const initialState: AuthFormState = {}

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signUp, initialState)

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 font-display text-2xl font-semibold">Sign up</h1>
      <form action={formAction} className="space-y-4">
        <input name="username" required minLength={3} placeholder="Username" className="input w-full" />
        <input name="email" type="email" required placeholder="Email" className="input w-full" />
        <input name="password" type="password" required minLength={6} placeholder="Password (min 6 characters)" className="input w-full" />
        {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
        <button type="submit" disabled={isPending} className="btn-primary w-full">
          {isPending ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted dark:text-mutedDark">
        Already have an account? <Link href="/login" className="underline">Log in</Link>
      </p>
    </div>
  )
}
