-- =========================================================
-- CineTrack — migration 0003
-- Run after 0001_init.sql and 0002_reviews_lists_follows_admin_omdb.sql
--
-- TMDb (and OMDb, which just repackages IMDb) are community-maintained,
-- so coverage tracks international fandom size — exactly as the original
-- spec predicted, Bangladeshi and Pakistani drama coverage is genuinely
-- thin. This migration makes room for two fallbacks: an automated
-- Wikidata/Wikipedia sweep (lib/wikidata.ts), and admin-entered manual
-- rows for whatever even that doesn't catch (lib/admin-actions.ts).
-- =========================================================

-- tmdb_id was `not null unique` — a Wikidata- or manually-sourced row has
-- no TMDb id at all. A unique constraint still works correctly with a
-- nullable column: Postgres never treats two NULLs as equal, so any number
-- of non-TMDb rows can coexist without tripping the uniqueness check.
alter table public.movies alter column tmdb_id drop not null;
alter table public.tv_shows alter column tmdb_id drop not null;

alter table public.movies add column wikidata_id text unique;
alter table public.tv_shows add column wikidata_id text unique;

alter table public.movies add column source text not null default 'tmdb' check (source in ('tmdb', 'wikidata', 'manual'));
alter table public.tv_shows add column source text not null default 'tmdb' check (source in ('tmdb', 'wikidata', 'manual'));

-- Every row needs to be identifiable by at least one of its sources —
-- guards against ever inserting a completely untraceable record.
alter table public.movies add constraint movies_has_a_source check (tmdb_id is not null or wikidata_id is not null or source = 'manual');
alter table public.tv_shows add constraint tv_shows_has_a_source check (tmdb_id is not null or wikidata_id is not null or source = 'manual');
