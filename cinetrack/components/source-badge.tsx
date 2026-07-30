export function SourceBadge({ source }: { source: string }) {
  if (source === 'tmdb') return null

  const label = source === 'wikidata' ? 'via Wikipedia' : 'Community-added'
  return (
    <span className="rounded-full border border-dashed border-reel px-2.5 py-0.5 font-mono text-xs text-reel" title="This entry didn't come from TMDb, so cast, episode-level data, and TMDb's rating aren't available for it.">
      {label}
    </span>
  )
}
