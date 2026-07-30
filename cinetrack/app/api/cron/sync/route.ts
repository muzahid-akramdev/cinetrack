import { NextRequest, NextResponse } from 'next/server'
import { runDailySync, runSyncStep } from '@/lib/sync'

// On Vercel Pro (raised maxDuration) hitting this with no ?step just runs
// everything in one go. On Hobby — capped at 60s no matter what maxDuration
// says — pass ?step=N (see vercel.json) to run exactly one job per
// invocation instead, spread across several cron entries through the day.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stepParam = request.nextUrl.searchParams.get('step')
  if (stepParam !== null) {
    const stepIndex = Number(stepParam)
    if (!Number.isInteger(stepIndex) || stepIndex < 0) {
      return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
    }
    const result = await runSyncStep(stepIndex)
    if (!result) return NextResponse.json({ error: `No step at index ${stepIndex}` }, { status: 404 })
    return NextResponse.json(result)
  }

  const result = await runDailySync()
  return NextResponse.json(result)
}
