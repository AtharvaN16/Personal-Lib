# Header Menu, About Page & Theme Palette

**Date:** 2026-07-10
**Status:** Approved for planning

## Summary

Replace the header's plain "Logout" link with a "Menu" trigger that opens a sheet containing account info, logout, an about link, and a live accent-color theme picker. Add a new `/about` page. Migrate the existing "default scan location" preference off `localStorage` and, together with the new theme color, persist both to a new Supabase `profiles` table for logged-in users (guests keep using `localStorage`, matching how guest data already works everywhere else in the app).

## Out of scope

- Redesigning the mobile hamburger panel's visual style — it keeps its current full-screen cinematic look; we only add rows to it.
- Any preference beyond theme color and default scan location.
- Multi-device real-time sync of theme (a page reload/re-fetch is sufficient).

## 1. Database: `profiles` table

Appended to `supabase/schema.sql` (this repo manages schema as one hand-applied file, no migrations directory):

```sql
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
```

- One row per user, created on first write (upsert), not on signup — no trigger needed.
- `default_location_id` sets `on delete set null` so deleting a shelf that happens to be someone's saved default doesn't fail or orphan the profile row.
- `database.types.ts` gets a matching `profiles` entry (Row/Insert/Update/Relationships), following the existing pattern for `shelves`/`books`.

## 2. Preference persistence

A single small client helper, `src/lib/userPrefs.ts`, exposes:

```ts
getPrefs(isGuest): Promise<{ themeColor: string; defaultLocationId: string | null; defaultLocationObj: {room,bookshelf} | null }>
setThemeColor(isGuest, color: string): Promise<void>
setDefaultLocation(isGuest, id: string | null, obj: {room,bookshelf} | null): Promise<void>
```

- **Logged-in:** reads/writes `public.profiles` via upsert (`supabase.from('profiles').upsert({ user_id, theme_color })`). `default_location_id` needs its denormalized `{room, bookshelf}` for display without an extra join — same trick `books` already uses (`location:location_id(room, bookshelf)`), so profile reads join `shelves` the same way.
- **Guest:** reads/writes `localStorage` keys `guest_theme_color`, `defaultLocationId`, `defaultLocationObj` — the last two are the exact keys `ScanBookModal.tsx` already uses, so guest behavior is unchanged.
- `ScanBookModal.tsx`'s existing `persistentDefaultLocationId/Obj` load (currently direct `localStorage.getItem`) and `handleSaveDefaultLocation` (currently direct `localStorage.setItem`) are swapped to call this helper instead. No other logic in that file changes.

## 3. Theme palette

Six vivid, ink-saturated swatches — same register as the existing accent, not muted pastels. All checked ≥4.5:1 contrast against both `--bg-primary` (#F4F2E4) and `--bg-sheet` (#FFFDFB):

| Name | Hex | Contrast vs parchment |
|---|---|---|
| Vivid Blue (default) | `#002CBC` | 8.95 |
| Vivid Violet | `#6B1FD1` | 6.81 |
| Vivid Crimson | `#C4123C` | 5.34 |
| Vivid Magenta | `#B0128C` | 5.64 |
| Vivid Teal | `#037A7A` | 4.59 |
| Vivid Forest Green | `#0A7A3D` | 4.83 |
| Vivid Burnt Orange | `#A84406` | 4.73 |

(Seven listed — final pick of 6 vs 7 made during implementation if one reads too close to another; magenta/crimson are the most likely pair to drop one of.)

### Applying the color site-wide

`--accent-primary` is already a CSS custom property consumed by ~60 call sites via `var(--accent-primary)`, so changing the property on `:root` at runtime repaints all of those automatically. The only holdouts are **hardcoded** `rgba(0, 44, 188, …)` glow/shadow values that don't derive from the variable:

- `globals.css` — `body::after` radial-gradient glow (2 places: base + mobile media query)
- `Dashboard.tsx` — toast `boxShadow: rgba(0, 44, 188, 0.15)`
- `SearchPill.tsx` — active-state `backgroundColor: rgba(0, 44, 188, 0.06)`

Fix: add a second CSS custom property, `--accent-primary-rgb: "0, 44, 188"` (channel triplet, no `rgba()` wrapper), set alongside `--accent-primary` whenever the theme changes. Replace each hardcoded `rgba(0, 44, 188, X)` with `rgba(var(--accent-primary-rgb), X)`. This is a standard CSS pattern and needs no JS-side color math beyond a hex→rgb split when applying a new theme.

### Theme provider

`src/hooks/useThemeColor.ts`:
- On mount, resolves the initial color from `getPrefs()` and applies it via `setProperty` on `document.documentElement`.
- Exposes `themeColor` + `setThemeColor(hex)` that updates the DOM properties, persists via `setThemeColor()` from `userPrefs.ts`, and updates local state so swatch selection re-renders instantly.
- To avoid a flash of the default blue before the async pref loads, an inline `<script>` in `layout.tsx`'s `<head>` reads `localStorage.getItem('guest_theme_color')` (best-effort, guest/last-known-value only — logged-in users' true value still loads async post-hydration, same tradeoff every "avoid FOUC for a DB-backed preference" solution makes) and sets the CSS vars before paint.

## 4. Header "Menu" sheet (desktop)

Replaces the `LogoutLink` slot in `Dashboard.tsx`'s `rightNav` (the `!isEditMode && !isScrolled` branch — same slot logic, guest branch keeps its separate "Sign in to save your books" button untouched).

- New component `src/components/AccountMenu.tsx`.
- Trigger: text button "Menu", same `editModeTrigger` style (italic serif, underline-wavy, `--accent-primary`) as "Edit"/"Search" for visual consistency.
- Panel: white (`--bg-sheet`) rounded card, anchored top-right below the trigger, `box-shadow: var(--paper-shadow-hover)`. Opens with a spring/blur entrance consistent with the app's existing `AnimatePresence` transitions elsewhere (opacity + y + filter:blur, ~0.25s).
- Closes on outside click / Escape, via the same `useCloseOnOutsideClick` helper already defined in `Dashboard.tsx` (hoisted or duplicated locally — implementation detail for the plan).
- Content, top to bottom, groups separated by spacing only (no divider rule):
  1. Email (`user.email`, read-only text) + "Logout" (red, `--error`) directly beneath it, tightly grouped.
  2. "Theme" label + row of swatch dots (18–20px circles, selected one gets a ring in its own color).
  3. "About" (link to `/about`, closes the sheet on click).
- Guest mode: the trigger still opens the Menu sheet (guests need a UI home for Theme too), but the top row swaps from email+Logout to the existing "Sign in to save your books" button/style. Theme and About rows are identical for guests and logged-in users.

## 5. Mobile menu

`MobileMenu.tsx` keeps its exact current visual style (`.mobile-menu-row`, cinematic backdrop, slide/blur transition). Rows become, top to bottom, with spacing separating the first group from the rest:

1. Email + Logout (logged-in) — grouped, tight spacing between them, extra margin below the group. Guest: existing "Sign in to save your books" row in this slot instead.
2. Manage Locations (unchanged, existing row)
3. Theme: label + swatch dots (same swatch sub-component reused from `AccountMenu.tsx`)
4. About

`MobileMenu` and `AccountMenu` (desktop) share the swatch-row UI as one extracted component, `src/components/ThemeSwatches.tsx`, so the palette only exists in one place.

## 6. About page

`src/app/about/page.tsx` — plain server component, no auth requirement (publicly reachable), styled consistent with the cozy palette:

```
Made by Atharva.
See more of my work at atharvanayak.design, or say hello at atharvanayak16@gmail.com.
```

- `atharvanayak.design` → `<a href="https://atharvanayak.design" target="_blank" rel="noopener noreferrer">`
- email → `<a href="mailto:atharvanayak16@gmail.com">`
- Both links use the same hero-text link treatment as the "Search"/"Currently showing X" highlights elsewhere (italic serif, `color: var(--accent-primary)`, `text-decoration: underline wavy var(--accent-primary)`, matching thickness/offset) — not a generic browser-blue underline.
- A simple "back" link/button to return to the dashboard (`/`).

## Testing

- Manual verification (this app has no existing test suite): open Menu on desktop and mobile as both guest and logged-in user; switch every theme color and confirm the glow, header logo, links, FAB icons, toast shadow, and search-pill highlight all update; refresh and confirm the color persists (guest via localStorage, logged-in via Supabase after re-login); set/clear default scan location as a logged-in user, confirm it survives a fresh login session; visit `/about` and click both links.
