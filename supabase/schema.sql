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
  notes text,
  created_at timestamp with time zone not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.shelves enable row level security;
alter table public.books enable row level security;

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

create policy "Users can insert their own books"
  on public.books for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own books"
  on public.books for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own books"
  on public.books for delete
  using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists shelves_user_id_idx on public.shelves(user_id);
create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_isbn_idx on public.books(isbn);
create index if not exists books_location_id_idx on public.books(location_id);
