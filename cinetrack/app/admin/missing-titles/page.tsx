import { createClient } from '@/lib/supabase/server'
import { MissingTitleActions, ManualTitleForm } from '@/components/admin-controls'

interface RequestRow {
  id: string
  title: string
  note: string | null
  status: string
  created_at: string
  profiles: { username: string } | null
}

export default async function AdminMissingTitlesPage() {
  const supabase = await createClient()
  const { data: requestsRaw } = await supabase.from('missing_title_requests').select('*, profiles(username)').order('created_at', { ascending: false })
  const requests = (requestsRaw ?? []) as unknown as RequestRow[]

  return (
    <div className="space-y-3">
      <p className="mb-2 text-sm text-muted dark:text-mutedDark">
        If a title isn&rsquo;t on TMDb and the Wikidata sweep didn&rsquo;t catch it either, use &ldquo;Add manually&rdquo; to enter it by hand — it'll be
        flagged as community-added rather than TMDb-sourced.
      </p>
      {requests.map((req) => (
        <div key={req.id} className="rounded-xl border border-line p-4 dark:border-lineDark">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-medium">{req.title}</p>
              {req.note && <p className="text-sm text-muted dark:text-mutedDark">{req.note}</p>}
              <p className="mt-1 font-mono text-xs text-muted dark:text-mutedDark">
                {req.profiles?.username ?? 'Anonymous'} · {new Date(req.created_at).toLocaleDateString()} · {req.status}
              </p>
            </div>
            {req.status === 'pending' && <MissingTitleActions id={req.id} />}
          </div>
          {req.status === 'pending' && <ManualTitleForm initialTitle={req.title} />}
        </div>
      ))}
      {!requests.length && <p className="text-muted dark:text-mutedDark">No requests yet.</p>}
    </div>
  )
}
