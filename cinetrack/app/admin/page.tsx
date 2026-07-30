import { createClient } from '@/lib/supabase/server'
import { SyncTriggerButton } from '@/components/admin-controls'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const [{ data: logs }, { count: movieCount }, { count: tvCount }, { count: userCount }, { count: pendingCount }] = await Promise.all([
    supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(10),
    supabase.from('movies').select('*', { count: 'exact', head: true }),
    supabase.from('tv_shows').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('missing_title_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return (
    <div>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Movies" value={movieCount ?? 0} />
        <Stat label="TV shows" value={tvCount ?? 0} />
        <Stat label="Users" value={userCount ?? 0} />
        <Stat label="Pending requests" value={pendingCount ?? 0} />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-mutedDark">Recent sync runs</h2>
        <SyncTriggerButton />
      </div>
      <div className="space-y-2">
        {(logs ?? []).map((log) => (
          <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-4 py-2 text-sm dark:border-lineDark">
            <span className="font-mono text-xs text-muted dark:text-mutedDark">{new Date(log.started_at).toLocaleString()}</span>
            <span>{log.source}</span>
            <span className="font-mono">{log.rows_processed} rows</span>
            <span className={log.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-reel'}>{log.status}</span>
          </div>
        ))}
        {!logs?.length && <p className="text-sm text-muted dark:text-mutedDark">No sync runs yet.</p>}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line p-4 dark:border-lineDark">
      <p className="font-mono text-2xl font-semibold text-marquee">{value}</p>
      <p className="text-xs text-muted dark:text-mutedDark">{label}</p>
    </div>
  )
}
