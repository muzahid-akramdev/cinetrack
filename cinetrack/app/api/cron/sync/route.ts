import { NextRequest, NextResponse } from 'next/server'
import { runDailySync } from '@/lib/sync'

// Bulk-syncs trending/popular plus five regional discover sweeps — can run
// long. Extend on Vercel Pro if needed; see README for splitting this into
// smaller per-region routes if you're stuck on the Hobby plan's timeout.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runDailySync()
  return NextResponse.json(result)
}
