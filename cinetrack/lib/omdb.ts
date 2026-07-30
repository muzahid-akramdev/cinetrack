const OMDB_BASE = 'https://www.omdbapi.com/'

export interface OmdbRating {
  imdbRating: number | null
  imdbVoteCount: number | null
}

// OMDb repackages IMDb's own rating/id — the spec marks this optional.
// Always resolves (never throws) so a missing key, a flaky response, or a
// title OMDb doesn't have never breaks the primary TMDb sync that calls this.
export async function getOmdbRatingByImdbId(imdbId: string | null | undefined): Promise<OmdbRating> {
  const apiKey = process.env.OMDB_API_KEY
  if (!apiKey || !imdbId) return { imdbRating: null, imdbVoteCount: null }

  try {
    const url = new URL(OMDB_BASE)
    url.searchParams.set('apikey', apiKey)
    url.searchParams.set('i', imdbId)

    const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 * 7 } })
    if (!res.ok) return { imdbRating: null, imdbVoteCount: null }

    const data = await res.json()
    if (data.Response === 'False') return { imdbRating: null, imdbVoteCount: null }

    const rating = parseFloat(data.imdbRating)
    const votes = parseInt(String(data.imdbVotes ?? '').replace(/,/g, ''), 10)

    return {
      imdbRating: Number.isFinite(rating) ? rating : null,
      imdbVoteCount: Number.isFinite(votes) ? votes : null,
    }
  } catch (e) {
    console.error('[omdb] lookup failed for', imdbId, e)
    return { imdbRating: null, imdbVoteCount: null }
  }
}
