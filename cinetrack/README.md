# CineTrack

An IMDb-style catalog with Letterboxd-style tracking, for movies **and** TV
series, with deliberate first-class coverage of Bangladeshi, Indian,
Pakistani, Turkish, and Korean content alongside the global catalog. Built
from the spec in `movie-tracker-build-prompt.md`.

Stack: Next.js 15 (App Router) + TypeScript + Tailwind, Supabase (Postgres +
Auth + RLS), TMDb as the primary data source, with Wikidata/Wikipedia and
manual admin entry as fallbacks for the regional gaps TMDb leaves. No ads,
no payments.

## What's in this build

Everything in the original spec's four phases, plus the alternative-source
layer described below:

- **Catalog & sync**: full schema with RLS, TMDb sync (trending/popular +
  five regional discover sweeps), fetch-on-search-miss, stale-record
  refresh, rate-limit backoff, `sync_logs`.
- **Accounts & tracking**: auth, watchlist, mark-watched with rewatch count,
  the dual-level TV rating the spec calls out (series rating vs. per-episode
  rating), `/me/watchlist` and `/me/watched`.
- **Browse & discovery**: filtered/sorted/paginated browse pages, regional
  country pages, search, person filmography pages, basic same-genre
  recommendations ("More like this" on every detail page).
- **Reviews**: write/edit/delete, spoiler tags, like counts, sort by
  newest/most-helpful, one review per user per title.
- **Profiles**: public `/profile/[username]` with yearly watched count, all-time
  totals, top genres, average rating given, recent reviews, public lists.
- **Social**: follow/unfollow, a simple `/feed` of recent reviews from people
  you follow.
- **Lists**: create/delete, public or private, add/remove titles from any
  detail page, view a list at `/lists/[id]`.
- **Admin dashboard** (`/admin`, gated by an `is_admin` flag): catalog stats,
  manual sync trigger, missing-title moderation, review moderation, and a
  manual title-entry form for anything no automated source catches.
- **OMDb**: optional secondary source showing the literal IMDb rating next
  to TMDb's, wherever an `OMDB_API_KEY` is configured.
- **"Suggest a missing title"** form, open to anonymous submission, feeding
  the admin queue above.

## The regional coverage gap — and what this build does about it

TMDb (and OMDb, which just repackages IMDb's own data) are community
maintained, so coverage tracks international fandom size. Korean, Turkish,
and Indian content generally has enough of a global fanbase to be
well-covered; **Bangladeshi and Pakistani drama coverage is genuinely
thin** — this isn't a bug in the sync job, it's a real gap in TMDb's
underlying data. Three things address it, in order of how automatic they are:

1. **The regional discover sweeps** (already in Phase 1) pull TMDb's
   Bangladesh/Pakistan/India/Turkey/Korea content specifically, rather than
   relying on "trending," which skews Western.
2. **A Wikidata + Wikipedia sweep** (`lib/wikidata.ts`, wired into the daily
   sync as `tv_wikidata_BD`/`_PK`/etc.) fills in TV series that have a
   Wikidata item tagged with the right country of origin and an English
   Wikipedia article, but that TMDb's contributor base hasn't added. This is
   a real, independent source, not a TMDb mirror — local Wikipedia
   communities document local TV directly (e.g. Bangladeshi web series like
   "Mohanagar" or "Karagar" have their own dedicated articles). No API key
   needed, but see the caveat below. Rows from this source are tagged
   `source = 'wikidata'`, shown with a "via Wikipedia" badge, and won't have
   season/episode data, cast, or a TMDb rating — only what Wikipedia's
   summary API returns (an overview and a thumbnail).
3. **Manual admin entry** (`/admin/missing-titles` → "Add manually") is the
   fallback of last resort: whatever neither TMDb nor Wikidata has, an admin
   can type in directly. This is the only tier that's guaranteed to work
   regardless of any external API's limitations, at the cost of manual
   effort. Rows are tagged `source = 'manual'`.

**Honest caveat on the Wikidata piece**: it's the one part of this codebase
I genuinely could not test, even indirectly — it depends on a SPARQL query
against a live public endpoint. I checked the specific facts it depends on
(Wikidata's country QIDs, the `P495` "country of origin" property, and that
Wikipedia does have real independent Bangladeshi-drama coverage) via web
search rather than from memory, so I'm fairly confident in the *approach*,
but SPARQL syntax mistakes fail silently (empty results, not an error). If
`tv_wikidata_BD` in the sync logs consistently processes 0 rows, paste the
query from `searchTVSeriesByCountry()` into
[query.wikidata.org](https://query.wikidata.org/) and iterate there — that's
a much faster feedback loop than redeploying.

If you want a deeper (but higher-friction) fourth source later: **TheTVDB**
is a real, TV-specific structured database — closer in kind to TMDb than
Wikidata is — but its free tier requires applying for a project API key and
describing your use case, and its licensing has a subscriber-PIN model for
some usage tiers, so I didn't wire it up sight-unseen. Worth a look if
Wikidata's coverage turns out to be thinner than hoped.

## Important: this was built without a live network

I wrote this in a sandboxed environment with no outbound network access, so
I could not run `npm install`, hit TMDb/OMDb/Wikidata, or connect to a real
Supabase project to verify any of this end to end. Run `npm run build`
locally before trusting it. Places I'd look first if something breaks:

- **Nested Supabase queries** (`credits(...)`, `profiles(username)`,
  `movies(*), tv_shows(*)` embeds throughout) — correct as far as I know,
  but untested against a live PostgREST schema cache.
- **The Wikidata SPARQL query** — see above.
- **Exact dependency versions** in `package.json` — conservative, caret-ranged,
  but not resolved against the live npm registry.
- **Migration constraint names** in 0002/0003 — Postgres's default naming,
  but double-check against the dashboard if a DROP CONSTRAINT errors.

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `0001_init.sql`, then `0002_reviews_lists_follows_admin_omdb.sql`,
   then `0003_alternative_sources.sql`, in that order.
3. Project Settings → API: copy the **Project URL**, **anon public** key, and
   **service_role** key.
4. After you sign up in the app once, promote yourself to admin from the SQL
   editor: `update public.profiles set is_admin = true where username = 'you';`

### 2. TMDb (required) and OMDb (optional)
- TMDb: free account at [themoviedb.org](https://www.themoviedb.org/) →
  Settings → API → copy the **API Read Access Token**.
- OMDb (optional, adds the literal IMDb rating): free key at
  [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx), 1,000
  requests/day. Leave `OMDB_API_KEY` blank to skip it — nothing else depends
  on it.
- Wikidata/Wikipedia need no key or signup at all, but do open
  `lib/wikidata.ts` and replace the placeholder contact in `USER_AGENT` with
  a real one — Wikimedia's API etiquette requires a descriptive User-Agent
  identifying the app and a way to reach you.

### 3. Environment
```bash
cp .env.example .env.local
# fill in the Supabase and TMDb values at minimum
```

### 4. Install and run
```bash
npm install
npm run dev
```

### 5. Seed the catalog
Search for a specific title to fetch it on demand, or trigger a full sync:
```bash
curl "http://localhost:3000/api/cron/sync" -H "Authorization: Bearer YOUR_CRON_SECRET"
```
This runs trending/popular, all five TMDb regional sweeps, and all five
Wikidata sweeps — expect it to take a few minutes locally.

## Deploying

1. Push to git, import into Vercel, add all env vars.
2. `vercel.json` schedules `/api/cron/sync` daily at 03:00 UTC.
3. A full sync (TMDb + Wikidata across five regions) can run long. Vercel's
   Hobby plan caps functions at 60s unless you raise it under Settings →
   Functions. If you're stuck on Hobby, split `runDailySync()` in
   `lib/sync.ts` into a few smaller routes on their own schedules — e.g. one
   for TMDb regions, one for the Wikidata sweep, one for refresh_stale.

## Design notes / where I made a judgment call

- **`users` → `profiles`**: standard Supabase pattern — never add columns
  directly to `auth.users`.
- **FKs redirected to `profiles` instead of `auth.users`** (migration 0002):
  needed so PostgREST can embed usernames (`.select('*, profiles(username)')`)
  anywhere a review, list, or follow needs to show who did it.
- **`tmdb_id` made nullable** (migration 0003): required for Wikidata- and
  manually-sourced rows, which have no TMDb id. A `..._has_a_source` check
  constraint ensures every row is still identifiable by *something*.
- **Season/episode fetch is lazy per-show**, not part of the bulk sync — see
  the comment above `ensureSeasonsLoaded()` in `lib/sync.ts`. It's also
  simply skipped for non-TMDb rows, which have no season/episode data by
  definition.
- **Own review shown via the form, not in the list below it** — avoids
  showing your own review twice; the edit/delete affordance lives on the form.
- **One review per user per title**, enforced by a partial unique index.
- **`popularity` column added** to `movies`/`tv_shows` — needed for
  "sort by popularity" and the home page's rows to mean something real.
- **Non-TMDb images use a plain `<img>`, not `next/image`** (`components/smart-image.tsx`):
  Wikidata thumbnails and admin-pasted poster URLs can be from any domain,
  which can't be allowlisted the way TMDb's single CDN host can.
- **TMDb logo**: the footer has the required attribution text but not the
  required logo image — grab it from
  [themoviedb.org/about/logos-attribution](https://www.themoviedb.org/about/logos-attribution)
  and drop it into `components/footer.tsx`; this environment can't fetch
  external image assets.
- **Usernames aren't editable** in Settings, to keep profile URLs stable.

## Design system

A film-society/marquee sensibility instead of a generic SaaS look: Fraunces
(display serif) for titles, Work Sans for UI text, IBM Plex Mono for
runtime/year/rating numerals, a warm paper/ink base with a marquee-gold
accent used sparingly. The repeated signature element is the rating "ticket
stamp" (`RatingStamp` in `components/media-card.tsx`). Non-TMDb entries get
a dashed "via Wikipedia" / "Community-added" badge in the same restrained
style. Tokens live in `tailwind.config.ts`.

## Project structure

```
app/
  movie/[id], tv/[id]       Detail pages: ratings, reviews, cast, recommendations
  movies, tv                Browse with filters
  browse/country/[code]     Regional pages
  profile/[username]        Public profile + yearly stats
  lists/[id]                A list's contents
  feed                      Recent reviews from people you follow
  me/watchlist, me/watched, me/lists, me/settings
  admin/*                   Dashboard, missing-titles, reviews (is_admin-gated)
  api/cron/sync             Daily sync endpoint (Vercel Cron)
components/
  review-form.tsx, review-list.tsx, follow-button.tsx, list-controls.tsx
  admin-controls.tsx, settings-form.tsx, media-row.tsx, source-badge.tsx
  smart-image.tsx           next/image for TMDb, plain <img> for everything else
lib/
  tmdb.ts                   TMDb client + genre maps + region lists
  omdb.ts                   Optional IMDb-rating lookup, fails gracefully
  wikidata.ts               Tertiary regional-drama source (SPARQL + REST)
  sync.ts                   Upserts, lazy season loading, the daily sync pipeline
  actions.ts, auth-actions.ts, admin-actions.ts   Server Actions
  recommendations.ts        Same-genre "more like this"
  supabase/                 Browser / server / admin (service-role) clients
supabase/migrations/        0001 init, 0002 social+admin+omdb, 0003 alt-sources
types/                      Hand-written DB and TMDb types
```
