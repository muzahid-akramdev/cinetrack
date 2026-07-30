// Tertiary catalog source for the gap the spec itself predicted: TMDb (and
// OMDb, which just repackages IMDb) are community-driven and skew toward
// whatever has the biggest international fandom, so Bangladeshi and
// Pakistani drama coverage is thin even when Korean/Turkish/Indian content
// is fine. Wikidata + Wikipedia fill part of that gap because local
// Wikipedia communities document local TV independently of TMDb's
// contributor base — e.g. Bangladeshi web series like "Mohanagar" or
// "Karagar" have their own dedicated English Wikipedia articles with
// structured infoboxes even though TMDb's coverage of them is patchy.
//
// No API key needed for either endpoint, but Wikimedia's usage policy
// requires a descriptive User-Agent identifying the app + a contact —
// see https://meta.wikimedia.org/wiki/User-Agent_policy. Replace the
// placeholder contact below with a real one before deploying.

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const WIKIPEDIA_SUMMARY_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary'
const USER_AGENT = 'CineTrack/0.1 (personal project; contact: you@example.com)'

export const WIKIDATA_COUNTRY_QIDS: Record<string, string> = {
  BD: 'Q902', // Bangladesh
  PK: 'Q843', // Pakistan
  IN: 'Q668', // India
  TR: 'Q43', // Turkey
  KR: 'Q884', // South Korea
}

export interface WikidataTVResult {
  wikidataId: string // e.g. "Q12345678"
  label: string
  wikipediaTitle: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Finds TV series whose Wikidata "country of origin" (P495) matches the
 * given country, restricted to items that have an English Wikipedia
 * article (so there's an extract/image to actually show). Uses the
 * `wdt:P31/wdt:P279*` transitive-subclass pattern rather than a plain
 * `wdt:P31 wd:Q5398426` match, since plenty of series are tagged with a
 * more specific subclass (soap opera, drama series, anime, etc.) rather
 * than the bare "television series" item — see this query's comments for
 * exactly that gotcha, which a naive query would silently miss.
 *
 * This is the least testable part of this codebase — I don't have a way
 * to run this against the live endpoint from where I'm building. SPARQL
 * syntax mistakes fail "soft" (empty results, not a crash), so if this
 * comes back empty, paste the query into https://query.wikidata.org/ and
 * iterate there before assuming the whole approach doesn't work.
 */
export async function searchTVSeriesByCountry(countryCode: string, limit = 40): Promise<WikidataTVResult[]> {
  const qid = WIKIDATA_COUNTRY_QIDS[countryCode]
  if (!qid) return []

  const query = `
    SELECT DISTINCT ?item ?itemLabel ?article WHERE {
      ?item wdt:P31/wdt:P279* wd:Q5398426 .
      ?item wdt:P495 wd:${qid} .
      ?article schema:about ?item ;
               schema:isPartOf <https://en.wikipedia.org/> ;
               schema:name ?itemLabel .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT ${limit}
  `.trim()

  const url = new URL(SPARQL_ENDPOINT)
  url.searchParams.set('query', query)
  url.searchParams.set('format', 'json')

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!res.ok) {
      console.error(`[wikidata] query failed for ${countryCode}: ${res.status}`)
      return []
    }

    const data = await res.json()
    const bindings: { item: { value: string }; itemLabel: { value: string }; article: { value: string } }[] = data?.results?.bindings ?? []

    return bindings
      .map((b) => {
        const wikidataId = b.item.value.split('/').pop() ?? ''
        const wikipediaTitle = decodeURIComponent(b.article.value.split('/wiki/')[1] ?? '').replace(/_/g, ' ')
        return { wikidataId, label: b.itemLabel.value, wikipediaTitle }
      })
      .filter((r) => r.wikidataId && r.wikipediaTitle)
  } catch (e) {
    console.error(`[wikidata] query threw for ${countryCode}`, e)
    return []
  }
}

export interface WikipediaSummary {
  extract: string | null
  thumbnailUrl: string | null
}

/** Fetches a plain-text extract + thumbnail for one Wikipedia article. Never throws. */
export async function getWikipediaSummary(title: string): Promise<WikipediaSummary> {
  try {
    const url = `${WIKIPEDIA_SUMMARY_BASE}/${encodeURIComponent(title.replace(/ /g, '_'))}`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!res.ok) return { extract: null, thumbnailUrl: null }

    const data = await res.json()
    return {
      extract: data.extract ?? null,
      thumbnailUrl: data.thumbnail?.source ?? null,
    }
  } catch {
    return { extract: null, thumbnailUrl: null }
  }
}

export { sleep as wikidataSleep }
