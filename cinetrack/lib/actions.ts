'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from './supabase/server'
import type { ShowStatus } from '@/types/database'

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You need to be signed in to do that.')
  return { supabase, user }
}

export async function toggleWatchlist(input: { movieId?: string; tvShowId?: string; path: string }) {
  const { supabase, user } = await requireUser()
  const column = input.movieId ? 'movie_id' : 'tv_show_id'
  const value = input.movieId ?? input.tvShowId

  const { data: existing } = await supabase.from('watchlist').select('id').eq('user_id', user.id).eq(column, value!).maybeSingle()

  if (existing) {
    await supabase.from('watchlist').delete().eq('id', existing.id)
    revalidatePath(input.path)
    return { inWatchlist: false }
  }

  await supabase.from('watchlist').insert({ user_id: user.id, [column]: value })
  revalidatePath(input.path)
  return { inWatchlist: true }
}

export async function markMovieWatched(input: { movieId: string; rating?: number; path: string }) {
  const { supabase, user } = await requireUser()

  const { data: existing } = await supabase.from('watched').select('rewatch_count').eq('user_id', user.id).eq('movie_id', input.movieId).maybeSingle()

  await supabase.from('watched').upsert({
    user_id: user.id,
    movie_id: input.movieId,
    watched_at: new Date().toISOString(),
    rating: input.rating ?? null,
    rewatch_count: existing ? existing.rewatch_count + 1 : 0,
  })

  revalidatePath(input.path)
}

export async function unmarkMovieWatched(input: { movieId: string; path: string }) {
  const { supabase, user } = await requireUser()
  await supabase.from('watched').delete().eq('user_id', user.id).eq('movie_id', input.movieId)
  revalidatePath(input.path)
}

export async function rateMovie(input: { movieId: string; rating: number; path: string }) {
  if (input.rating < 1 || input.rating > 10) throw new Error('Rating must be between 1 and 10.')
  const { supabase, user } = await requireUser()
  await supabase
    .from('watched')
    .upsert({ user_id: user.id, movie_id: input.movieId, rating: input.rating }, { onConflict: 'user_id,movie_id' })
  revalidatePath(input.path)
}

export async function setShowStatus(input: { tvShowId: string; status: ShowStatus; path: string }) {
  const { supabase, user } = await requireUser()
  await supabase
    .from('show_progress')
    .upsert({ user_id: user.id, tv_show_id: input.tvShowId, status: input.status, updated_at: new Date().toISOString() }, { onConflict: 'user_id,tv_show_id' })
  revalidatePath(input.path)
}

export async function rateShow(input: { tvShowId: string; rating: number; path: string }) {
  if (input.rating < 1 || input.rating > 10) throw new Error('Rating must be between 1 and 10.')
  const { supabase, user } = await requireUser()
  await supabase
    .from('show_progress')
    .upsert(
      { user_id: user.id, tv_show_id: input.tvShowId, rating: input.rating, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,tv_show_id' }
    )
  revalidatePath(input.path)
}

export async function markEpisodeWatched(input: { episodeId: string; rating?: number; path: string }) {
  const { supabase, user } = await requireUser()
  const { data: existing } = await supabase
    .from('episode_watched')
    .select('rewatch_count')
    .eq('user_id', user.id)
    .eq('episode_id', input.episodeId)
    .maybeSingle()

  await supabase.from('episode_watched').upsert({
    user_id: user.id,
    episode_id: input.episodeId,
    watched_at: new Date().toISOString(),
    rating: input.rating ?? null,
    rewatch_count: existing ? existing.rewatch_count + 1 : 0,
  })
  revalidatePath(input.path)
}

export async function unmarkEpisodeWatched(input: { episodeId: string; path: string }) {
  const { supabase, user } = await requireUser()
  await supabase.from('episode_watched').delete().eq('user_id', user.id).eq('episode_id', input.episodeId)
  revalidatePath(input.path)
}

export async function suggestMissingTitle(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim() || null
  if (!title) throw new Error('Please enter a title.')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('missing_title_requests').insert({ user_id: user?.id ?? null, title, note })
  if (error) throw error
}

// ---------------------------------------------------------
// Reviews
// ---------------------------------------------------------

export async function upsertReview(input: {
  movieId?: string
  tvShowId?: string
  rating: number
  body: string
  hasSpoilers: boolean
  path: string
}) {
  if (input.rating < 1 || input.rating > 10) throw new Error('Rating must be between 1 and 10.')
  if (!input.body.trim()) throw new Error("Review can't be empty.")

  const { supabase, user } = await requireUser()
  const column = input.movieId ? 'movie_id' : 'tv_show_id'
  const value = input.movieId ?? input.tvShowId
  const onConflict = input.movieId ? 'user_id,movie_id' : 'user_id,tv_show_id'

  const { error } = await supabase.from('reviews').upsert(
    {
      user_id: user.id,
      [column]: value,
      rating: input.rating,
      body: input.body.trim(),
      has_spoilers: input.hasSpoilers,
      updated_at: new Date().toISOString(),
    },
    { onConflict }
  )
  if (error) throw error
  revalidatePath(input.path)
}

export async function deleteReview(input: { reviewId: string; path: string }) {
  const { supabase, user } = await requireUser()
  await supabase.from('reviews').delete().eq('id', input.reviewId).eq('user_id', user.id)
  revalidatePath(input.path)
}

export async function toggleReviewLike(input: { reviewId: string; path: string }) {
  const { supabase, user } = await requireUser()
  const { data: existing } = await supabase.from('review_likes').select('*').eq('review_id', input.reviewId).eq('user_id', user.id).maybeSingle()

  if (existing) {
    await supabase.from('review_likes').delete().eq('review_id', input.reviewId).eq('user_id', user.id)
    revalidatePath(input.path)
    return { liked: false }
  }
  await supabase.from('review_likes').insert({ review_id: input.reviewId, user_id: user.id })
  revalidatePath(input.path)
  return { liked: true }
}

// ---------------------------------------------------------
// Lists
// ---------------------------------------------------------

export async function createList(formData: FormData) {
  const { supabase, user } = await requireUser()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const isPublic = formData.get('is_public') === 'on'
  if (!name) throw new Error('Please name your list.')

  const { error } = await supabase.from('lists').insert({ user_id: user.id, name, description, is_public: isPublic })
  if (error) throw error
  revalidatePath('/me/lists')
}

export async function deleteList(input: { listId: string }) {
  const { supabase, user } = await requireUser()
  await supabase.from('lists').delete().eq('id', input.listId).eq('user_id', user.id)
  revalidatePath('/me/lists')
}

export async function addToList(input: { listId: string; movieId?: string; tvShowId?: string; path: string }) {
  const { supabase, user } = await requireUser()
  // RLS would block a cross-user insert anyway, but checking here first
  // gives a clear error message instead of a silent/opaque failure.
  const { data: list } = await supabase.from('lists').select('id').eq('id', input.listId).eq('user_id', user.id).maybeSingle()
  if (!list) throw new Error('List not found.')

  await supabase.from('list_items').insert({ list_id: input.listId, movie_id: input.movieId ?? null, tv_show_id: input.tvShowId ?? null })
  revalidatePath(input.path)
}

export async function removeFromList(input: { itemId: string; path: string }) {
  const { supabase } = await requireUser()
  await supabase.from('list_items').delete().eq('id', input.itemId)
  revalidatePath(input.path)
}

// ---------------------------------------------------------
// Follows
// ---------------------------------------------------------

export async function toggleFollow(input: { profileId: string; path: string }) {
  const { supabase, user } = await requireUser()
  if (user.id === input.profileId) throw new Error("You can't follow yourself.")

  const { data: existing } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('followee_id', input.profileId).maybeSingle()

  if (existing) {
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('followee_id', input.profileId)
    revalidatePath(input.path)
    return { following: false }
  }
  await supabase.from('follows').insert({ follower_id: user.id, followee_id: input.profileId })
  revalidatePath(input.path)
  return { following: true }
}

// ---------------------------------------------------------
// Profile
// ---------------------------------------------------------

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser()
  const bio = String(formData.get('bio') ?? '').trim() || null
  const avatarUrl = String(formData.get('avatar_url') ?? '').trim() || null

  const { error } = await supabase.from('profiles').update({ bio, avatar_url: avatarUrl }).eq('id', user.id)
  if (error) throw error
  revalidatePath('/me/settings')
  revalidatePath('/', 'layout')
}
