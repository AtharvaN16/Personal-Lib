-- Enable UUID generation extension
create extension if not exists "uuid-ossp";

-- Create Shelves Table
create table if not exists public.shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room text not null,
  bookshelf text not null,
  shelf_index integer, -- Optional shelf placement
  name text,           -- Optional custom name
  created_at timestamp with time zone not null default now()
);

-- Create Books Table
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  isbn text,
  title text not null,
  authors text[] not null default '{}',
  publisher text,
  published_date text,
  description text,
  cover_url text,
  location_id uuid references public.shelves(id) on delete set null,
  status text not null default 'To Read',
  favorite boolean not null default false,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- Shared ISBN lookup cache, used by the server-side scan lookup route before calling
-- external book APIs. Results are not user-specific.
create table if not exists public.book_lookup_cache (
  isbn text primary key,
  title text not null,
  authors text[] not null default '{}',
  publisher text,
  published_date text,
  description text,
  cover_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Per-user counter for cache-miss lookups that may spend external API quota.
create table if not exists public.book_lookup_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  lookup_date date not null,
  lookup_count integer not null default 0,
  updated_at timestamp with time zone not null default now(),
  primary key (user_id, lookup_date)
);

-- Enable Row Level Security (RLS)
alter table public.shelves enable row level security;
alter table public.books enable row level security;
alter table public.book_lookup_cache enable row level security;
alter table public.book_lookup_daily_usage enable row level security;

-- Shelves Policies
create policy "Users can view their own shelves"
  on public.shelves for select
  using (auth.uid() = user_id);

create policy "Users can insert their own shelves"
  on public.shelves for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own shelves"
  on public.shelves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own shelves"
  on public.shelves for delete
  using (auth.uid() = user_id);

-- Books Policies
create policy "Users can view their own books"
  on public.books for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own books" on public.books;
create policy "Users can insert their own books"
  on public.books for insert
  with check (
    auth.uid() = user_id
    and (location_id is null or location_id in (select id from public.shelves where user_id = auth.uid()))
  );

drop policy if exists "Users can update their own books" on public.books;
create policy "Users can update their own books"
  on public.books for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (location_id is null or location_id in (select id from public.shelves where user_id = auth.uid()))
  );

create policy "Users can delete their own books"
  on public.books for delete
  using (auth.uid() = user_id);

-- Book lookup cache policies
create policy "Authenticated users can read cached book lookups"
  on public.book_lookup_cache for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can add cached book lookups"
  on public.book_lookup_cache for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update cached book lookups"
  on public.book_lookup_cache for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Daily usage policies
create policy "Users can view their own lookup usage"
  on public.book_lookup_daily_usage for select
  using (auth.uid() = user_id);

-- Atomically consume one cache-miss lookup from the current user's daily budget.
create or replace function public.consume_book_lookup_quota(
  p_lookup_date date,
  p_max_lookups integer
)
returns table(allowed boolean, lookup_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_count integer;
  was_consumed boolean := false;
begin
  if current_user_id is null then
    allowed := false;
    lookup_count := 0;
    return next;
    return;
  end if;

  insert into public.book_lookup_daily_usage (user_id, lookup_date, lookup_count)
  values (current_user_id, p_lookup_date, 1)
  on conflict (user_id, lookup_date)
  do update
    set lookup_count = public.book_lookup_daily_usage.lookup_count + 1,
        updated_at = now()
    where public.book_lookup_daily_usage.lookup_count < p_max_lookups
  returning public.book_lookup_daily_usage.lookup_count into current_count;

  was_consumed := current_count is not null;

  if current_count is null then
    select public.book_lookup_daily_usage.lookup_count
      into current_count
      from public.book_lookup_daily_usage
      where user_id = current_user_id
        and public.book_lookup_daily_usage.lookup_date = p_lookup_date;
  end if;

  allowed := was_consumed;
  lookup_count := current_count;
  return next;
end;
$$;

-- Indexes for performance
create index if not exists shelves_user_id_idx on public.shelves(user_id);
create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_isbn_idx on public.books(isbn);
create index if not exists books_location_id_idx on public.books(location_id);
create index if not exists book_lookup_daily_usage_date_idx on public.book_lookup_daily_usage(lookup_date);

-- Per-user preferences: theme color and default scan location. One row per user,
-- created via upsert on first write rather than a signup trigger.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_color text not null default '#002CBC',
  default_location_id uuid references public.shelves(id) on delete set null,
  updated_at timestamp with time zone not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public sharing: an opt-in read-only link + QR code for the owner's library.
-- share_token is generated on first enable and preserved across disable/re-enable
-- (see /api/share) so a printed QR code doesn't go stale from toggling sharing off.
alter table public.profiles
  add column if not exists share_token text unique,
  add column if not exists share_enabled boolean not null default false;
