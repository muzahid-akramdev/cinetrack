-- =========================================================
-- CineTrack — initial schema
-- Run once via the Supabase SQL editor, or `supabase db push`
-- if you're using the Supabase CLI with migrations.
-- =========================================================

create extension if not exists pgcrypto;   -- gen_random_uuid() (builtin on PG13+, kept for safety)
create extension if not exists pg_trgm;    -- fast ILIKE / fuzzy title search

-- ---------------------------------------------------------
-- profiles (extends auth.users)
-- Supabase convention: never add app columns directly to
-- auth.users — link a public table by id instead.
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- Catalog: movies
-- ---------------------------------------------------------
create table public.movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null unique,
  imdb_id text,
  title text not null,
  original_title text,
  original_language text,
  overview text,
  release_date date,
  runtime integer,
  genres text[] not null default '{}',
  countries text[] not null default '{}',
  poster_path text,
  backdrop_path text,
  tmdb_rating numeric(3,1),
  tmdb_vote_count integer default 0,
  popularity numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index movies_original_language_idx on public.movies (original_language);
create index movies_countries_gin on public.movies using gin (countries);
create index movies_genres_gin on public.movies using gin (genres);
create index movies_release_date_idx on public.movies (release_date desc);
create index movies_popularity_idx on public.movies (popularity desc);
create index movies_title_trgm on public.movies using gin (title gin_trgm_ops);
create index movies_updated_at_idx on public.movies (updated_at);

-- ---------------------------------------------------------
-- Catalog: tv_shows
-- ---------------------------------------------------------
create table public.tv_shows (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null unique,
  imdb_id text,
  name text not null,
  original_name text,
  original_language text,
  overview text,
  first_air_date date,
  genres text[] not null default '{}',
  origin_country text[] not null default '{}',
  poster_path text,
  backdrop_path text,
  number_of_seasons integer default 0,
  number_of_episodes integer default 0,
  status text,
  tmdb_rating numeric(3,1),
  tmdb_vote_count integer default 0,
  popularity numeric not null default 0,
  -- Tracks when seasons/episodes were last fully fetched. Kept separate from
  -- updated_at (which the bulk sync bumps for show-level metadata only) — see
  -- README "Season/episode fetch strategy" for why this is lazy per-show.
  seasons_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tv_shows_original_language_idx on public.tv_shows (original_language);
create index tv_shows_origin_country_gin on public.tv_shows using gin (origin_country);
create index tv_shows_genres_gin on public.tv_shows using gin (genres);
create index tv_shows_popularity_idx on public.tv_shows (popularity desc);
create index tv_shows_name_trgm on public.tv_shows using gin (name gin_trgm_ops);
create index tv_shows_updated_at_idx on public.tv_shows (updated_at);

-- ---------------------------------------------------------
-- seasons / episodes
-- ---------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  tv_show_id uuid not null references public.tv_shows(id) on delete cascade,
  tmdb_id integer,
  season_number integer not null,
  name text,
  air_date date,
  episode_count integer default 0,
  poster_path text,
  unique (tv_show_id, season_number)
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  tmdb_id integer,
  episode_number integer not null,
  name text,
  air_date date,
  overview text,
  runtime integer,
  tmdb_rating numeric(3,1),
  tmdb_vote_count integer default 0,
  unique (season_id, episode_number)
);

create index episodes_season_id_idx on public.episodes (season_id);

-- ---------------------------------------------------------
-- people / credits
-- ---------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null unique,
  name text not null,
  profile_path text,
  known_for_department text
);

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  movie_id uuid references public.movies(id) on delete cascade,
  tv_show_id uuid references public.tv_shows(id) on delete cascade,
  role text not null check (role in ('cast','crew')),
  character_name text,
  job text,
  sort_order integer default 0,
  constraint credits_exactly_one_parent check (num_nonnulls(movie_id, tv_show_id) = 1)
);

create index credits_movie_id_idx on public.credits (movie_id);
create index credits_tv_show_id_idx on public.credits (tv_show_id);
create index credits_person_id_idx on public.credits (person_id);

-- ---------------------------------------------------------
-- User activity: watchlist / watched / show_progress / episode_watched
-- ---------------------------------------------------------
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid references public.movies(id) on delete cascade,
  tv_show_id uuid references public.tv_shows(id) on delete cascade,
  added_at timestamptz not null default now(),
  constraint watchlist_exactly_one_parent check (num_nonnulls(movie_id, tv_show_id) = 1)
);

create unique index watchlist_user_movie_uidx on public.watchlist (user_id, movie_id) where movie_id is not null;
create unique index watchlist_user_tv_uidx on public.watchlist (user_id, tv_show_id) where tv_show_id is not null;

create table public.watched (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  watched_at timestamptz not null default now(),
  rating smallint check (rating between 1 and 10),
  rewatch_count integer not null default 0,
  primary key (user_id, movie_id)
);

create table public.show_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  tv_show_id uuid not null references public.tv_shows(id) on delete cascade,
  rating smallint check (rating between 1 and 10),
  status text not null default 'watching' check (status in ('watching','completed','dropped','plan_to_watch')),
  updated_at timestamptz not null default now(),
  primary key (user_id, tv_show_id)
);

create table public.episode_watched (
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  watched_at timestamptz not null default now(),
  rating smallint check (rating between 1 and 10),
  rewatch_count integer not null default 0,
  primary key (user_id, episode_id)
);

-- ---------------------------------------------------------
-- Reviews (one per user per title — mirrors edit/delete UX; see README)
-- ---------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid references public.movies(id) on delete cascade,
  tv_show_id uuid references public.tv_shows(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  body text not null,
  has_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_exactly_one_parent check (num_nonnulls(movie_id, tv_show_id) = 1)
);

create unique index reviews_user_movie_uidx on public.reviews (user_id, movie_id) where movie_id is not null;
create unique index reviews_user_tv_uidx on public.reviews (user_id, tv_show_id) where tv_show_id is not null;

create table public.review_likes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

-- ---------------------------------------------------------
-- Lists
-- ---------------------------------------------------------
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  movie_id uuid references public.movies(id) on delete cascade,
  tv_show_id uuid references public.tv_shows(id) on delete cascade,
  position integer not null default 0,
  constraint list_items_exactly_one_parent check (num_nonnulls(movie_id, tv_show_id) = 1)
);

-- ---------------------------------------------------------
-- Follows
-- ---------------------------------------------------------
create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

-- ---------------------------------------------------------
-- Ops tables
-- ---------------------------------------------------------
create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  rows_processed integer default 0,
  status text not null check (status in ('running','success','error')),
  error_message text
);

create table public.missing_title_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  note text,
  status text not null default 'pending' check (status in ('pending','added','rejected')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- Row Level Security
-- =========================================================

-- Catalog tables: public read, writes only via the service-role
-- key (used server-side by the sync job) — never by end users.
alter table public.movies enable row level security;
alter table public.tv_shows enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;
alter table public.people enable row level security;
alter table public.credits enable row level security;

create policy "movies are publicly readable" on public.movies for select using (true);
create policy "tv_shows are publicly readable" on public.tv_shows for select using (true);
create policy "seasons are publicly readable" on public.seasons for select using (true);
create policy "episodes are publicly readable" on public.episodes for select using (true);
create policy "people are publicly readable" on public.people for select using (true);
create policy "credits are publicly readable" on public.credits for select using (true);

-- profiles: public read, owner-only write
alter table public.profiles enable row level security;
create policy "profiles are publicly readable" on public.profiles for select using (true);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);

-- watchlist / watched / show_progress / episode_watched:
-- public read (this is what powers public profile stats later),
-- owner-only write. The spec's RLS requirement is about locking down
-- edits, not reads — a public tracking site needs the reads open.
alter table public.watchlist enable row level security;
alter table public.watched enable row level security;
alter table public.show_progress enable row level security;
alter table public.episode_watched enable row level security;

create policy "watchlist publicly readable" on public.watchlist for select using (true);
create policy "watchlist owner write" on public.watchlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "watched publicly readable" on public.watched for select using (true);
create policy "watched owner write" on public.watched for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "show_progress publicly readable" on public.show_progress for select using (true);
create policy "show_progress owner write" on public.show_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "episode_watched publicly readable" on public.episode_watched for select using (true);
create policy "episode_watched owner write" on public.episode_watched for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reviews: public read, owner-only write
alter table public.reviews enable row level security;
create policy "reviews publicly readable" on public.reviews for select using (true);
create policy "reviews owner write" on public.reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.review_likes enable row level security;
create policy "review_likes publicly readable" on public.review_likes for select using (true);
create policy "review_likes owner write" on public.review_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- lists: readable if public or own; writable only by owner
alter table public.lists enable row level security;
create policy "lists readable if public or own" on public.lists for select using (is_public = true or auth.uid() = user_id);
create policy "lists owner write" on public.lists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.list_items enable row level security;
create policy "list_items readable if parent list visible" on public.list_items for select using (
  exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
    and (l.is_public = true or l.user_id = auth.uid())
  )
);
create policy "list_items owner write" on public.list_items for all using (
  exists (select 1 from public.lists l where l.id = list_items.list_id and l.user_id = auth.uid())
) with check (
  exists (select 1 from public.lists l where l.id = list_items.list_id and l.user_id = auth.uid())
);

-- follows: public read, the follower controls their own edges
alter table public.follows enable row level security;
create policy "follows publicly readable" on public.follows for select using (true);
create policy "follows owner write" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- missing_title_requests: open to anonymous submission (low friction is the
-- point), but only the submitter (if logged in) can see their own requests.
alter table public.missing_title_requests enable row level security;
create policy "missing_title_requests own read" on public.missing_title_requests for select using (auth.uid() = user_id);
create policy "missing_title_requests insert" on public.missing_title_requests for insert with check (user_id is null or auth.uid() = user_id);

-- sync_logs: fully locked down — no policies means only the service-role
-- key (used server-side, bypasses RLS) can read or write these.
alter table public.sync_logs enable row level security;
