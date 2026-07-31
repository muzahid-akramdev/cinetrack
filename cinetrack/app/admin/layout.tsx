import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, AlertCircle, MessageSquare, PlusCircle } from 'lucide-react'
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
      <div className="mb-6">
        <h1 className="mb-4 font-display text-2xl font-semibold">Admin</h1>
        <nav className="flex flex-wrap gap-2">
          <AdminTab href="/admin" icon={<LayoutDashboard className="h-4 w-4" />}>
            Overview
          </AdminTab>
          <AdminTab href="/admin/missing-titles" icon={<AlertCircle className="h-4 w-4" />}>
            Missing titles
          </AdminTab>
          <AdminTab href="/admin/reviews" icon={<MessageSquare className="h-4 w-4" />}>
            Reviews
          </AdminTab>
          <AdminTab href="/suggest-title" icon={<PlusCircle className="h-4 w-4" />}>
            Suggest title
          </AdminTab>
        </nav>
      </div>
      {children}
    </div>
  )
}

function AdminTab({
  href,
  children,
  icon,
}: {
  href: string
  children: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:border-marquee hover:bg-marquee/5 dark:border-lineDark dark:bg-surfaceDark"
    >
      {icon}
      {children}
    </Link>
  )
}
