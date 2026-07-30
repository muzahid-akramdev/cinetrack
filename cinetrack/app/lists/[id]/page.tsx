import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MediaCard } from '@/components/media-card'
import { RemoveFromListButton } from '@/components/list-controls'
import type { Movie, TVShow } from '@/types/database'

interface ListItemRow {
  id: string
  movies: Movie | null
  tv_shows: TVShow | null
}

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // RLS (`is_public = true or user_id = auth.uid()`) already makes this
  // query return nothing for a private list that isn't yours, so a null
  // result here correctly covers both "doesn't exist" and "not yours".
  const { data: list } = await supabase.from('lists').select('*, profiles(username)').eq('id', id).single()
  if (!list) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isOwner = user?.id === list.user_id

  const { data: itemsRaw } = await supabase.from('list_items').select('id, movies(*), tv_shows(*)').eq('list_id', id).order('position', { ascending: true })
  const items = (itemsRaw ?? []) as unknown as ListItemRow[]
  const ownerUsername = (list as unknown as { profiles: { username: string } | null }).profiles?.username

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl font-semibold">{list.name}</h1>
      <p className="mb-6 text-sm text-muted dark:text-mutedDark">
        {ownerUsername && (
          <>
            by <Link href={`/profile/${ownerUsername}`} className="font-medium hover:underline">{ownerUsername}</Link>
          </>
        )}
        {list.description && ` · ${list.description}`}
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => {
          const media = item.movies ?? item.tv_shows
          if (!media) return null
          const href = item.movies ? `/movie/${media.id}` : `/tv/${media.id}`
          const title = item.movies ? item.movies.title : (item.tv_shows as TVShow).name
          const year = item.movies ? item.movies.release_date?.slice(0, 4) : item.tv_shows?.first_air_date?.slice(0, 4)
          return (
            <div key={item.id} className="relative">
              <MediaCard title={title} year={year} posterPath={media.poster_path} rating={media.tmdb_rating} href={href} />
              {isOwner && <RemoveFromListButton itemId={item.id} path={`/lists/${id}`} />}
            </div>
          )
        })}
        {items.length === 0 && <p className="col-span-full text-muted dark:text-mutedDark">This list is empty.</p>}
      </div>
    </div>
  )
}
