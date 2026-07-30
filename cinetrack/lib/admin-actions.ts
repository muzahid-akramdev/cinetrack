'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from './supabase/server'
import { runDailySync } from './sync'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Admin access required.')

  return { supabase, user }
}

export async function updateMissingTitleStatus(input: { id: string; status: 'added' | 'rejected' }) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('missing_title_requests').update({ status: input.status }).eq('id', input.id)
  if (error) throw error
  revalidatePath('/admin/missing-titles')
}

export async function adminDeleteReview(input: { reviewId: string }) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('reviews').delete().eq('id', input.reviewId)
  if (error) throw error
  revalidatePath('/admin/reviews')
}

export async function triggerManualSync() {
  await requireAdmin()
  // Runs inline rather than queued — fine locally, but on serverless hosting
  // this can hit the platform's function-timeout before all five regions
  // finish. See README: split into per-region routes if that happens to you.
  const result = await runDailySync()
  revalidatePath('/admin')
  return result
}

/**
 * The true fallback of last resort: when neither TMDb nor the Wikidata sweep
 * has a title, an admin can type it in directly. Stored with source='manual'
 * and no tmdb_id, so it's clearly flagged in the UI as not TMDb-sourced —
 * and, since there's no tmdb_id, it won't get season/episode data, cast
 * credits, or a TMDb rating, only what the admin typed in.
 */
export async function adminCreateManualTitle(formData: FormData) {
  const { supabase } = await requireAdmin()

  const mediaType = String(formData.get('media_type') ?? 'tv')
  const title = String(formData.get('title') ?? '').trim()
  const overview = String(formData.get('overview') ?? '').trim() || null
  const posterPath = String(formData.get('poster_url') ?? '').trim() || null
  const country = String(formData.get('country') ?? '').trim().toUpperCase() || null
  const language = String(formData.get('language') ?? '').trim().toLowerCase() || null
  const dateStr = String(formData.get('date') ?? '').trim() || null

  if (!title) throw new Error('Title is required.')

  if (mediaType === 'movie') {
    const { error } = await supabase.from('movies').insert({
      title,
      original_title: title,
      overview,
      poster_path: posterPath,
      original_language: language,
      countries: country ? [country] : [],
      release_date: dateStr,
      source: 'manual',
    })
    if (error) throw error
  } else {
    const { error } = await supabase.from('tv_shows').insert({
      name: title,
      original_name: title,
      overview,
      poster_path: posterPath,
      original_language: language,
      origin_country: country ? [country] : [],
      first_air_date: dateStr,
      source: 'manual',
    })
    if (error) throw error
  }

  revalidatePath('/admin/missing-titles')
}
