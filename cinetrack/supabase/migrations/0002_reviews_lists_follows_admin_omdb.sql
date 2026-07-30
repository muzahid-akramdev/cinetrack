-- =========================================================
-- CineTrack — migration 0002
-- Run this after 0001_init.sql (Supabase SQL editor, or
-- `supabase db push` if you're on the CLI).
--
-- Adds what's needed for: reviews-with-username display, public
-- profile pages, lists, follows/activity feed, an admin flag +
-- RLS, and OMDb as a secondary rating source.
-- =========================================================

-- ---------------------------------------------------------
-- Redirect user-referencing FKs from auth.users to public.profiles.
--
-- profiles.id IS auth.users.id — enforced by profiles' own FK plus the
-- signup trigger from 0001 — so this changes no data and no integrity
-- guarantee. What it does change: PostgREST can only auto-embed a
-- relationship when there's a real FK between the two tables being
-- joined, and reviews/lists/follows/etc. were pointing at auth.users,
-- a table PostgREST doesn't expose. Pointing at public.profiles instead
-- is what makes `.select('*, profiles(username)')` work anywhere below.
--
-- Constraint names are Postgres's auto-generated `<table>_<column>_fkey`
-- default, which is what an inline `references` clause produces. If any
-- DROP CONSTRAINT below errors with "constraint does not exist", open
-- Database → Tables → the table → Constraints in the Supabase dashboard
-- to find the real name and adjust the statement.
-- ---------------------------------------------------------
alter table public.watchlist drop constraint watchlist_user_id_fkey;
alter table public.watchlist add constraint watchlist_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.watched drop constraint watched_user_id_fkey;
alter table public.watched add constraint watched_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.show_progress drop constraint show_progress_user_id_fkey;
alter table public.show_progress add constraint show_progress_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.episode_watched drop constraint episode_watched_user_id_fkey;
alter table public.episode_watched add constraint episode_watched_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.reviews drop constraint reviews_user_id_fkey;
alter table public.reviews add constraint reviews_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.review_likes drop constraint review_likes_user_id_fkey;
alter table public.review_likes add constraint review_likes_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.lists drop constraint lists_user_id_fkey;
alter table public.lists add constraint lists_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.follows drop constraint follows_follower_id_fkey;
alter table public.follows add constraint follows_follower_id_fkey foreign key (follower_id) references public.profiles(id) on delete cascade;
alter table public.follows drop constraint follows_followee_id_fkey;
alter table public.follows add constraint follows_followee_id_fkey foreign key (followee_id) references public.profiles(id) on delete cascade;

alter table public.missing_title_requests drop constraint missing_title_requests_user_id_fkey;
alter table public.missing_title_requests add constraint missing_title_requests_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;

-- ---------------------------------------------------------
-- Admin flag + helper function
-- ---------------------------------------------------------
alter table public.profiles add column is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- After signing up, promote yourself from the Supabase SQL editor:
--   update public.profiles set is_admin = true where username = 'you';

create policy "admins can read sync_logs" on public.sync_logs for select using (public.is_admin());
create policy "admins can read all missing_title_requests" on public.missing_title_requests for select using (public.is_admin());
create policy "admins can update missing_title_requests" on public.missing_title_requests for update using (public.is_admin());
create policy "admins can delete any review" on public.reviews for delete using (public.is_admin());

-- ---------------------------------------------------------
-- OMDb — optional secondary source for the literal IMDb rating
-- ---------------------------------------------------------
alter table public.movies add column imdb_rating numeric(3,1);
alter table public.movies add column imdb_vote_count integer;
alter table public.tv_shows add column imdb_rating numeric(3,1);
alter table public.tv_shows add column imdb_vote_count integer;
