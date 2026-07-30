import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return (
    <div className="max-w-md">
      <h1 className="mb-1 font-display text-2xl font-semibold">Settings</h1>
      <p className="mb-6 text-sm text-muted dark:text-mutedDark">
        Signed in as <span className="font-medium">{profile?.username}</span>. Usernames can&rsquo;t be changed here to keep profile links stable.
      </p>
      <SettingsForm initialBio={profile?.bio ?? ''} initialAvatarUrl={profile?.avatar_url ?? ''} />
    </div>
  )
}
