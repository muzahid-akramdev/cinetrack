import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CreateListForm, DeleteListButton } from '@/components/list-controls'

export default async function MyListsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lists } = await supabase.from('lists').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold">Your lists</h1>
      <div className="mb-8">
        <CreateListForm />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(lists ?? []).map((list) => (
          <Link key={list.id} href={`/lists/${list.id}`} className="rounded-xl border border-line p-4 hover:border-marquee dark:border-lineDark">
            <div className="flex items-center justify-between">
              <p className="font-display font-medium">{list.name}</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted dark:text-mutedDark">{list.is_public ? 'Public' : 'Private'}</span>
                <DeleteListButton listId={list.id} />
              </div>
            </div>
            {list.description && <p className="mt-1 text-sm text-muted dark:text-mutedDark">{list.description}</p>}
          </Link>
        ))}
        {!lists?.length && <p className="text-muted dark:text-mutedDark">No lists yet — create one above.</p>}
      </div>
    </div>
  )
}
