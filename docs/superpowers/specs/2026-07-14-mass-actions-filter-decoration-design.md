# Mass-action FABs, missing-cover filter, decoration style

Status: approved
Date: 2026-07-14

## Context

Three small, independent additions to the Dashboard and account menu:

1. Mass Favorite / Mass Completed FABs in multi-edit mode.
2. A "missing covers" filter mode, showing books currently rendering the placeholder cover.
3. A per-profile "decoration style" preference (wiggly / dotted / stitched / scribble), applied to underline treatments app-wide, following the same pattern as the existing theme-color preference.

Public shareable library URLs (QR code, print, etc.) is a separate, larger feature and is explicitly out of scope for this spec — it will get its own brainstorm/design cycle.

## 1. Mass Favorite / Mass Completed FABs

**Handlers** (`Dashboard.tsx`, alongside `handleBulkDelete` / `handleBulkMove`):

- `handleBulkFavorite`: batch-update all books in `selectedBookIds` to `favorite: true` in Supabase, update local `books` state, show a toast (`"N books favorited"`).
- `handleBulkComplete`: batch-update all books in `selectedBookIds` to `status: 'Completed'`, update local state, toast (`"N books marked completed"`).
- Both fire immediately on tap — no confirmation step (unlike delete). This matches how Move already behaves (opens a picker with no separate "are you sure").
- Both are only meaningful/visible when `isEditMode && selectedBookIds.size > 0`.

**UI**: two new FAB buttons in the existing `AnimatePresence` stack (`Dashboard.tsx` ~line 855-900), following the exact pattern of the Delete/Move FABs (`motion.button`, `styles.scanFab` base style, same enter/exit animation).

Stacking order, bottom to top (existing two unchanged, two new added above):

| FAB | icon | bottom offset |
|---|---|---|
| Delete | `delete` | `bottom` (base, unchanged) |
| Move | `drive_file_move` | `104px` (unchanged) |
| Favorite | `favorite` | `160px` (new) |
| Completed | `task_alt` | `216px` (new) |

Icon color: `var(--accent-primary)` (matches Move), consistent with existing FABs.

## 2. Missing-cover filter

- Extend `FilterMode` in `FilterPanel.tsx`:
  ```ts
  export type FilterMode = 'all' | 'favorites' | 'unread' | 'location' | 'no-cover';
  ```
- Add a "Missing covers" option to the same radio-style list `FilterPanel` already renders for favorites/unread/location — mutually exclusive with the other modes, no combination logic.
- In `Dashboard.tsx`'s filter predicate (~line 281), add:
  ```ts
  if (filterMode === 'no-cover') return !b.cover_url;
  ```
  This reuses the same `cover_url` falsy check the book grid already uses to decide whether to render `getPlaceholderColor`/`getSpineColor` in place of a real cover image — so "missing cover" here means exactly "currently showing the placeholder," matching the request.
- Update the active-filter label logic (~line 288) to add a `filterMode === 'no-cover' ? 'Missing covers'` branch, consistent with the existing `'Favorites'` / `'Unread books'` labels.

## 3. Decoration style preference

**Data model** — mirrors `theme_color` exactly:

- `supabase/schema.sql`: add `alter table public.profiles add column if not exists decoration_style text not null default 'wavy';` right after the `profiles` table definition. (Idempotent; safe on both fresh and existing databases, matching how the table itself uses `create table if not exists`.)
- `src/lib/userPrefs.ts`:
  - Add `decorationStyle: string` to `UserPrefs`, `DEFAULT_DECORATION_STYLE = 'wavy'`.
  - `getPrefs` reads `decoration_style` from the `profiles` row (logged-in) or `guest_decoration_style` from `localStorage` (guest), same branching as `themeColor`.
  - New `setDecorationStyle(isGuest, style)` mirroring `setThemeColor` — upserts only the `decoration_style` column (never touches `theme_color` or `default_location_id`), or writes to `localStorage` for guests.

**Hook** — `src/hooks/useDecorationStyle.ts`, mirroring `useThemeColor.ts`:

- Loads the persisted style on mount, applies it via `document.documentElement.dataset.decoration = style` (a `data-decoration` attribute on `<html>`, analogous to how theme color sets `--accent-primary` as a CSS custom property).
- Exposes `{ decorationStyle, setDecorationStyle }`; the setter updates DOM + local state + persistence together, same shape as `useThemeColor`.
- Wired into `Dashboard.tsx` next to the existing `useThemeColor(isGuest)` call.

**Rendering the 4 styles** — `src/app/globals.css`:

- Replace the ~4 existing inline `textDecoration: 'underline wavy var(--accent-primary)'` usages (`Dashboard.tsx` lines ~357, ~489, ~1239; `ScanBookModal.tsx` lines ~1136, ~1152) with a shared `className="decorated-underline"` (keeping `color: var(--accent-primary)` as-is, since that's independent of decoration style).
- Base rule: `.decorated-underline { text-decoration: none; }` (styles below override per data-attribute).
- `[data-decoration="wavy"] .decorated-underline` → `text-decoration: underline wavy var(--accent-primary); text-decoration-thickness: ...` (current look, unchanged default).
- `[data-decoration="dotted"] .decorated-underline` → `text-decoration: underline dotted var(--accent-primary);` (native CSS, direct analog to wavy).
- `[data-decoration="stitched"] .decorated-underline` and `[data-decoration="scribble"] .decorated-underline` → not expressible via `text-decoration-style`, so both use a `mask-image` technique: a small inline SVG data-URI pattern (short even dashes for "stitched," a loose irregular scrawl for "scribble") set as `-webkit-mask-image`/`mask-image` with `mask-repeat: repeat-x`, `mask-position: 0 100%`, sized ~1-2px tall, combined with `background-color: var(--accent-primary)` so the pattern is painted in the current accent color and stays in sync with theme-color changes exactly like the native styles do. Implemented as a thin pseudo-element (`::after`) positioned under the text, since `mask-image` on the text element itself would mask the text content too.

**Menu UI**:

- New `src/components/DecorationSwatches.tsx`, structurally mirroring `ThemeSwatches.tsx`: a row of 4 small labeled preview swatches (each rendering a short sample underline in that style, in the current accent color) instead of color dots, `onChange(style)` callback.
- Wired into `AccountMenu.tsx` and `MobileMenu.tsx` directly below the existing `ThemeSwatches` row, same collapsible-section treatment (`showPalette` pattern) or its own always-visible row — placed adjacent since both are "profile appearance" settings.

## Out of scope

- Public shareable library URL / QR code / print feature (separate spec).
- Combining the missing-cover filter with other filter modes (mutually exclusive, matching existing filter UX).
- Bulk "un-favorite" or bulk status-to-Reading/To-Read actions.
