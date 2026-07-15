# Public Share Library — Design

## Problem

The library is entirely private today: every table is RLS-scoped to `auth.uid() = user_id`, and the only entry points are login and a guest demo mode. The owner wants to share a read-only view of the real library with friends — via a link, and via a printed QR code stuck on the actual bookshelf at home — without giving them any ability to edit, scan, or filter the collection.

## Goals

- A "Share Library" entry in the account menu (desktop `AccountMenu` and `MobileMenu`, next to "About") that opens a modal to enable/manage public sharing.
- The modal shows an artistic, rounded, accent-colored QR code (printable) and the plain share URL (copyable, shareable via Web Share API).
- A public route that renders a read-only version of the library: browsable by catalogue (grid) or by physical location, searchable, but with no scanning, filtering, editing, or bulk actions.
- Works as-is on Vercel — no special hosting requirements.

## Non-goals

- No per-friend accounts, comments, or reactions on the public page.
- No analytics/view tracking on the public page.
- No public write access of any kind (no requests, no "wishlist" claiming, etc.).
- No reuse of `Dashboard.tsx` — it's an edit/scan-oriented 1550-line component; the public page is a new, smaller, purpose-built component.

## Data model

New table, RLS-protected exactly like every other table (owner-only reads/writes via the app; the public route never queries it with the anon client):

```sql
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_token text unique,       -- null until sharing is enabled the first time
  share_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can view their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- **Enabling sharing** (first time): generate a random URL-safe token (`crypto.randomBytes(24).toString('base64url')`), upsert the row with `share_token` set and `share_enabled = true`.
- **Enabling sharing again** (already had a token): just flip `share_enabled = true`. The old token/link/QR code keeps working — printed QR codes shouldn't go stale just because sharing was toggled off and back on.
- **Disabling sharing**: flip `share_enabled = false`. Token is preserved.
- **Regenerate link**: explicit, separate action (behind a confirm step, since it invalidates the previously printed QR code) — replaces `share_token` with a new random value.

## Public data access

The public page must read past RLS for exactly one user's rows, gated only by a valid, enabled `share_token` — never via a client-side Supabase call.

- New `src/lib/supabase/admin.ts`: a service-role Supabase client (`SUPABASE_SERVICE_ROLE_KEY`, server-only env var, never `NEXT_PUBLIC_`), used exclusively by the public route's server component. This mirrors the existing server-only `GOOGLE_BOOKS_API_KEY` pattern in `.env.local.example`.
- `src/app/share/[token]/page.tsx` (async server component):
  1. Look up `token` in `user_settings` via the admin client.
  2. If no row, or `share_enabled = false` → `notFound()`.
  3. Fetch that `user_id`'s `books` (joined `location:location_id(room, bookshelf)`) and `shelves` via the admin client.
  4. Pass the plain data (already-serializable, no Supabase client) as props into `PublicLibrary`, a new client component.
- No new public RLS policies on `books`/`shelves` — they stay owner-only. The admin client is the only thing that ever reads across users, and it only runs inside this one server route.

## Share Library modal (`ShareLibraryModal.tsx`)

Opened from a new "Share Library" row in `AccountMenu` and `MobileMenu`. Visual language matches existing modals (`AddLocationModal`/`ManageLocationsModal`: `0px` border-radius, `--accent-primary` tokens, existing toast pattern for copy confirmation).

- **Header** — "Share Library" + close button.
- **Enable toggle** — off by default (reflects `share_enabled`). Turning it on calls a server action that ensures a token exists and sets the flag; turning it off just clears the flag. Below the toggle, when on, a short line of muted text: *"Anyone with this link can browse your library. They can't scan, edit, or move anything."*
- **QR code** — rendered only once enabled, via `qr-code-styling` (new dependency): rounded/dot module style, colored with the owner's current `themeColor` (already threaded through as a prop from `Dashboard` → `AccountMenu`/`MobileMenu`), centered.
- **Print** — a "Print QR Code" button. The modal has a `@media print` stylesheet that hides everything except the QR code and a caption ("Scan to see our library"), sized for a small printed card; the button calls `window.print()` directly — no separate route or image export needed.
- **Link row** — read-only text field showing `https://<host>/share/<token>`, with:
  - **Copy** button — clipboard API + existing toast pattern ("Link copied").
  - **Share** button — `navigator.share()` where available, falling back to the same copy behavior (with a toast noting it was copied instead) on unsupported browsers.
- **Regenerate link** — small text link at the bottom, behind a confirm step (same confirm pattern as existing destructive actions like delete), replaces the token and re-renders the QR/link with the new value.

## Public page (`/share/[token]`)

`PublicLibrary.tsx` — new client component, not a reuse of `Dashboard.tsx`. Receives `books`, `shelves`, and `accentColor` as props from the server page.

**Hero / header**, mirroring `Dashboard.tsx`'s existing `TextAnimate` + `SearchPill` + scroll-compact mechanism exactly (`headerCompact` pattern, `hover-wavy-underline` styling, blur-crossfade transitions):

- **Hero (top):** *"Welcome to my library. Search to find books.\nCurrently showing {label}."* — "Search" is a clickable blue/accent italic word (`highlights` prop) that opens the same `SearchPill` interaction used today. `{label}` reflects the active view: `"{N} books"` in Catalogue, or `"Books in {Room}"` once a location is drilled into.
- **Header (compact, on scroll):** collapses to just the clickable italic trigger — *"Search to find books"* (idle) / *"Clear search"* (active). No "Manage Locations" slot (nothing to manage) and no account/menu trigger at all.

**View toggle** — replaces the scan FAB's position (bottom-right) with a two-way pill toggle: **Catalogue** ↔ **Locations**. Defaults to Catalogue.

- **Catalogue** — the existing book-cover grid, reusing `BookCard`'s rendering but with `editMode`/`selected`/`onToggleSelect` stripped out. Clicking a book opens a new lightweight read-only detail view (cover, title, authors, status, location) rather than the full editable `BookModal`.
- **Locations** — books grouped Room → Bookshelf, read-only. The grouping logic currently inlined in `Dashboard.tsx` (`allBooksInRoom`, bookshelf `Set` derivation, `hasUnassignedInRoom`) is lifted into a shared helper (`src/lib/bookGrouping.ts`) used by both `Dashboard` and `PublicLibrary`, rather than copy-pasted.

**Search** — filters the active view's books by title/author. `bookMatchesQuery` (currently defined inline in `Dashboard.tsx`) moves to a shared `src/lib/bookSearch.ts` used by both components.

**Explicitly absent:** scan FAB, filter panel (favorites/unread/no-cover), edit mode, bulk-move, account menu, login/logout.

## Error handling

- Invalid or unknown token → Next.js `notFound()` → the app's existing 404 page (styled consistently, no separate design needed).
- Token valid but `share_enabled = false` (owner turned sharing off) → same `notFound()` treatment. A friend with an old tab open just sees the same 404 on refresh.
- Web Share API unsupported → silently falls back to copy-to-clipboard with a toast, no error state shown.

## Testing / verification

No automated test suite exists for modals/pages in this codebase (consistent with prior specs). Manual verification via `bun dev`:

1. Open "Share Library" from both `AccountMenu` (desktop) and `MobileMenu` (mobile) — confirm identical behavior.
2. Enable sharing → confirm QR code renders in the owner's current accent color, link row populates.
3. Copy link → confirm clipboard contents and toast. Open the link in a private/incognito window → confirm the public page loads with real data, no login prompt.
4. Confirm no edit affordances anywhere on the public page: no scan FAB, no filter panel, no editable book modal, no account menu.
5. Toggle Catalogue ↔ Locations — confirm grouping and grid both render correctly and search works in both.
6. Use "Search" in the hero and in the compact scrolled header — confirm same crossfade/pill behavior as the authenticated dashboard.
7. Print QR code → confirm print preview shows only the QR + caption.
8. Regenerate link → confirm old link now 404s, new link/QR works.
9. Disable sharing → confirm the link now 404s. Re-enable → confirm the same link/QR works again (token preserved).
10. Deploy to a Vercel preview → confirm `/share/[token]` and the service-role lookup work identically to local dev (validates the "does this work on Vercel" open question).
