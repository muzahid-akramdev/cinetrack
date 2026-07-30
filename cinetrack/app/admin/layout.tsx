import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  return (
    <div>
      <div className="mb-6 border-b border-line pb-3 dark:border-lineDark">
        <h1 className="mb-2 font-display text-2xl font-semibold">Admin</h1>
        <nav className="flex gap-4 text-sm text-muted dark:text-mutedDark">
          <Link href="/admin" className="hover:text-ink dark:hover:text-paper">Overview</Link>
          <Link href="/admin/missing-titles" className="hover:text-ink dark:hover:text-paper">Missing titles</Link>
          <Link href="/admin/reviews" className="hover:text-ink dark:hover:text-paper">Reviews</Link>
        </nav>
      </div>
      {children}
    </div>
  )
}
