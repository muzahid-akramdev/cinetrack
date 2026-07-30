'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from './supabase/server'

export interface AuthFormState {
  error?: string
}

export async function signIn(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signUp(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const username = String(formData.get('username') ?? '').trim()

  if (username.length < 3) return { error: 'Username must be at least 3 characters.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })
  if (error) return { error: error.message }

  redirect('/login?confirm=1')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
