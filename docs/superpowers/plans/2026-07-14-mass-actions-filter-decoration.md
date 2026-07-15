# Mass-action FABs, missing-cover filter, decoration style — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mass Favorite/Completed FABs to multi-edit mode, a "missing covers" filter, and a per-profile decoration-style preference (wiggly/dotted/stitched/scribble) for underline treatments app-wide.

**Architecture:** All three features slot into existing patterns already in the codebase: bulk actions extend `useBooks.ts`'s existing bulk-update shape (used by `deleteBooks`/`moveBooks`), the filter extends `FilterPanel.tsx`'s existing `FilterMode` union, and decoration style mirrors `useThemeColor.ts`/`userPrefs.ts`'s existing theme-color persistence pattern exactly, but drives a `data-decoration` attribute on `<html>` instead of a CSS custom property.

**Tech Stack:** Next.js (App Router), Bun, Supabase (Postgres + Auth), vanilla CSS, framer-motion. No test runner is configured in this repo (`bun run lint` and `bunx tsc --noEmit` are the only automated checks) — verification for UI-facing steps is manual, in the running dev server.

## Global Constraints

- No Tailwind — vanilla CSS / inline `style` objects only, matching every file touched below.
- No new dependencies. Use only what's already imported in the touched files.
- Every mutation to Supabase must also update the `isGuest` (localStorage) path — every existing function in `useBooks.ts` and `userPrefs.ts` branches on `isGuest` first; new functions must follow the same branch order (guest branch returns early, then the Supabase branch).
- This repo has no test framework. Each task's verification step is: `bun run lint`, `bunx tsc --noEmit`, and a manual check in the dev server (`bun dev`) described concretely in the task. **Before starting any coding task, confirm the dev server is running (`bun dev`) so each step can be checked live in the browser as you go — don't batch verification to the end.**
- Match existing code style: no comments unless explaining non-obvious "why," inline `style` objects in a trailing `const styles: Record<string, React.CSSProperties> = {...}` block per component, `useCallback` for hook-exposed mutators.

---

## Task 1: Mass Favorite / Mass Completed bulk handlers + FABs

**Files:**
- Modify: `src/lib/hooks/useBooks.ts:129-150` (add two new bulk functions near `toggleBookFavorite`/`updateBookStatus`), `:290-302` (return object)
- Modify: `src/components/Dashboard.tsx:233-241` (add two new handlers near `handleBulkDelete`), `:855-900` (add two new FAB buttons)

**Interfaces:**
- Produces: `bulkSetFavorite(ids: string[], favorite: boolean): Promise<void>` and `bulkSetStatus(ids: string[], status: Book['status']): Promise<void>`, both returned from `useBooks()` alongside the existing `deleteBooks`/`moveBooks`.
- Consumes: existing `selectedBookIds: Set<string>`, `exitEditMode()`, `showToast(message: string)` from `Dashboard.tsx` (all already defined).

- [ ] **Step 1: Add `bulkSetFavorite` and `bulkSetStatus` to `useBooks.ts`**

In `src/lib/hooks/useBooks.ts`, immediately after the `toggleBookFavorite` callback (ends at line 150, right before `// Update book title and authors details`), insert:

```ts
  // Bulk-set favorite status (multi-edit mode)
  const bulkSetFavorite = useCallback(async (ids: string[], favorite: boolean) => {
    const isMultiple = ids.length > 1;
    if (isGuest) {
      setBooks((prev) => {
        const updated = prev.map((b) => (ids.includes(b.id) ? { ...b, favorite } : b));
        localStorage.setItem('guest_books', JSON.stringify(updated));
        return updated;
      });
      return;
    }

    const query = supabase.from('books').update({ favorite });
    const { error: updateErr } = isMultiple ? await query.in('id', ids) : await query.eq('id', ids[0]);

    if (updateErr) {
      console.error('Failed to bulk favorite book(s):', updateErr);
      throw new Error(updateErr.message);
    }

    setBooks((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, favorite } : b)));
  }, [isGuest, supabase]);

  // Bulk-set reading status (multi-edit mode)
  const bulkSetStatus = useCallback(async (ids: string[], status: Book['status']) => {
    const isMultiple = ids.length > 1;
    if (isGuest) {
      setBooks((prev) => {
        const updated = prev.map((b) => (ids.includes(b.id) ? { ...b, status } : b));
        localStorage.setItem('guest_books', JSON.stringify(updated));
        return updated;
      });
      return;
    }

    const query = supabase.from('books').update({ status });
    const { error: updateErr } = isMultiple ? await query.in('id', ids) : await query.eq('id', ids[0]);

    if (updateErr) {
      console.error('Failed to bulk update status for book(s):', updateErr);
      throw new Error(updateErr.message);
    }

    setBooks((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, status } : b)));
  }, [isGuest, supabase]);
```

Then update the `return` statement (currently lines 290-302) to include both:

```ts
  return {
    books,
    loading,
    error,
    updateBookStatus,
    toggleBookFavorite,
    updateBookDetails,
    deleteBooks,
    moveBooks,
    bulkSetFavorite,
    bulkSetStatus,
    addBook,
    setBooks,
    refetchBooks,
  };
```

- [ ] **Step 2: Verify types**

Run: `bunx tsc --noEmit`
Expected: no new errors. `bulkSetStatus`'s `status` param must resolve to `Book['status']` (`'Completed' | 'Reading' | 'To Read' | undefined`) — matches `updateBookStatus`'s existing signature style.

- [ ] **Step 3: Destructure the new functions and add Dashboard handlers**

In `src/components/Dashboard.tsx`, find the `useBooks` destructure (near the top of the component, where `moveBooks`, `addBook`, `refetchBooks` are pulled out) and add `bulkSetFavorite` and `bulkSetStatus` to it.

Then, immediately after `handleBulkDelete` (currently lines 233-241), insert:

```ts
  // Bulk-favorite every currently selected book, then exit Edit Mode
  const handleBulkFavorite = async () => {
    const ids = Array.from(selectedBookIds);
    const count = ids.length;
    try {
      await bulkSetFavorite(ids, true);
      exitEditMode();
      showToast(`Favorited ${count} book${count === 1 ? '' : 's'}`);
    } catch {
      console.warn('Failed to bulk favorite books');
    }
  };

  // Bulk-mark every currently selected book Completed, then exit Edit Mode
  const handleBulkComplete = async () => {
    const ids = Array.from(selectedBookIds);
    const count = ids.length;
    try {
      await bulkSetStatus(ids, 'Completed');
      exitEditMode();
      showToast(`Marked ${count} book${count === 1 ? '' : 's'} completed`);
    } catch {
      console.warn('Failed to bulk update book status');
    }
  };
```

- [ ] **Step 4: Add the two new FAB buttons**

In `src/components/Dashboard.tsx`, find the existing Move FAB block (the `motion.button` with `key="move-fab"`, `onClick={() => setIsBulkMoveOpen(true)}`, `style={{ ...styles.scanFab, bottom: '104px' }}`). Immediately after its closing `</motion.button>`, insert two more FABs, following the exact same pattern:

```tsx
        {isEditMode && selectedBookIds.size > 0 && (
          <motion.button
            key="favorite-fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={handleBulkFavorite}
            aria-label="Favorite selected books"
            style={{ ...styles.scanFab, bottom: '160px' }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '24px',
                color: 'var(--accent-primary)',
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              favorite
            </span>
          </motion.button>
        )}

        {isEditMode && selectedBookIds.size > 0 && (
          <motion.button
            key="complete-fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={handleBulkComplete}
            aria-label="Mark selected books completed"
            style={{ ...styles.scanFab, bottom: '216px' }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '24px',
                color: 'var(--accent-primary)',
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              task_alt
            </span>
          </motion.button>
        )}
```

- [ ] **Step 5: Manual verification in dev server**

Confirm `bun dev` is running (start it if not: `bun dev`, from the project root, in the background). In the browser:
1. Enter Edit Mode, select 2+ books.
2. Confirm four FABs are stacked (Delete at the base, then Move, Favorite, Completed going up), none overlapping.
3. Tap Favorite — confirm a toast reads "Favorited N books", the books show as favorited (check via Favorites filter or reopening a book), and edit mode exits.
4. Re-enter edit mode, select books, tap Completed — confirm toast "Marked N books completed" and status updates (check via a book's detail view).
5. Repeat as a guest session (no login) — confirm both actions persist across a page refresh (localStorage `guest_books`).

- [ ] **Step 6: Lint and commit**

Run: `bun run lint`
Expected: 0 errors (pre-existing warnings unrelated to these files are fine).

```bash
git add src/lib/hooks/useBooks.ts src/components/Dashboard.tsx
git commit -m "$(cat <<'EOF'
feat: add mass Favorite and Completed FABs to multi-edit mode

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Missing-cover filter

**Files:**
- Modify: `src/components/FilterPanel.tsx:6` (extend `FilterMode`), `:120-130` (add radio option)
- Modify: `src/components/Dashboard.tsx:281-284` (filter predicate), `:288-291` (active label)

**Interfaces:**
- Produces: `FilterMode` now includes `'no-cover'`. `Dashboard.tsx`'s `matchesFilter` and `filterLabel` both handle it.
- Consumes: `Book['cover_url']` (already `string | null | undefined` per `BookModal.tsx`'s `Book` interface) — same falsy check the book grid already uses to decide whether to render the placeholder cover.

- [ ] **Step 1: Extend `FilterMode`**

In `src/components/FilterPanel.tsx` line 6, change:

```ts
export type FilterMode = 'all' | 'favorites' | 'unread' | 'location';
```

to:

```ts
export type FilterMode = 'all' | 'favorites' | 'unread' | 'location' | 'no-cover';
```

- [ ] **Step 2: Add the "Missing covers" radio option**

In `src/components/FilterPanel.tsx`, immediately after the "Show based on Location" `<label style={styles.optionRow}>` block (the one with `checked={draftMode === 'location'}`) and before the `{draftMode === 'location' && (...)}` rooms-list block, insert:

```tsx
          <label style={styles.optionRow}>
            <input
              type="radio"
              name="filterMode"
              checked={draftMode === 'no-cover'}
              onChange={() => selectMode('no-cover')}
              style={styles.radioButton}
            />
            <span style={styles.optionLabel}>Missing covers</span>
          </label>
```

No changes needed to `selectMode`, `handleSave`, or `handleClear` — `selectMode` already resets `draftRoom` to `null` for any non-`'location'` mode, which covers `'no-cover'` correctly.

- [ ] **Step 3: Wire the filter predicate in `Dashboard.tsx`**

In `src/components/Dashboard.tsx`, in `matchesFilter` (currently lines 281-284):

```ts
  const matchesFilter = (b: Book) => {
    if (filterMode === 'favorites') return !!b.favorite;
    if (filterMode === 'unread') return b.status === 'To Read';
    if (filterMode === 'location') return filterRoom ? b.location?.room === filterRoom : true;
    return true;
  };
```

change to:

```ts
  const matchesFilter = (b: Book) => {
    if (filterMode === 'favorites') return !!b.favorite;
    if (filterMode === 'unread') return b.status === 'To Read';
    if (filterMode === 'location') return filterRoom ? b.location?.room === filterRoom : true;
    if (filterMode === 'no-cover') return !b.cover_url;
    return true;
  };
```

- [ ] **Step 4: Wire the active-filter label**

In `src/components/Dashboard.tsx`, in the `filterLabel` computation (currently lines 288-291):

```ts
  const filterLabel =
    filterMode === 'favorites' ? 'Favorites'
    : filterMode === 'unread' ? 'Unread books'
    : filterMode === 'location' && filterRoom ? `Books in ${filterRoom}`
    : 'Entire catalog';
```

change to:

```ts
  const filterLabel =
    filterMode === 'favorites' ? 'Favorites'
    : filterMode === 'unread' ? 'Unread books'
    : filterMode === 'location' && filterRoom ? `Books in ${filterRoom}`
    : filterMode === 'no-cover' ? 'Currently showing books without cover'
    : 'Entire catalog';
```

- [ ] **Step 5: Manual verification in dev server**

With `bun dev` running, open the Filter panel, select "Missing covers," Save. Confirm:
1. Only books currently rendering the placeholder cover (no `cover_url`) appear in the grid.
2. The "Currently showing" text under the header reads "Currently showing books without cover".
3. Clearing the filter (Clear button, or selecting "Show all") restores the full catalog.

- [ ] **Step 6: Lint and commit**

Run: `bun run lint`
Expected: 0 errors.

```bash
git add src/components/FilterPanel.tsx src/components/Dashboard.tsx
git commit -m "$(cat <<'EOF'
feat: add missing-cover filter mode

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Decoration style preference — data layer

**Files:**
- Modify: `supabase/schema.sql` (add column after the `profiles` table definition, ~line 186)
- Modify: `src/lib/userPrefs.ts` (add `decorationStyle` to `UserPrefs`, read/write logic)
- Create: `src/hooks/useDecorationStyle.ts`

**Interfaces:**
- Produces: `DecorationStyle = 'wavy' | 'dotted' | 'stitched' | 'scribble'` type; `UserPrefs.decorationStyle: DecorationStyle`; `setDecorationStyle(isGuest: boolean, style: DecorationStyle): Promise<void>`; `useDecorationStyle(isGuest: boolean): { decorationStyle: DecorationStyle, setDecorationStyle: (style: DecorationStyle) => void }`.
- Consumes: `getPrefs`/`createClient` pattern already in `userPrefs.ts`; `document.documentElement` DOM access pattern already in `useThemeColor.ts`.

- [ ] **Step 1: Add the database column**

In `supabase/schema.sql`, immediately after the `profiles` table definition closes (currently ends at line 186 with `);`, right before `alter table public.profiles enable row level security;`), insert:

```sql
alter table public.profiles add column if not exists decoration_style text not null default 'wavy';
```

This is idempotent (`if not exists`) so it's safe to run against both a fresh database (where the `create table` above hasn't run yet — this line still works once that runs) and an existing one that already has the `profiles` table without this column.

- [ ] **Step 2: Run the migration against Supabase**

This step requires the user to run the SQL against their actual Supabase project (this repo has no migration runner). Tell the user: "Run the updated `supabase/schema.sql` (specifically the new `alter table public.profiles add column if not exists decoration_style ...` line) against your Supabase project's SQL editor before testing the decoration feature end-to-end." Do not attempt to run this automatically — it requires credentials this plan does not have.

- [ ] **Step 3: Extend `UserPrefs` and add persistence functions**

In `src/lib/userPrefs.ts`, after the `LocationPref` interface (line 3-7), add:

```ts
export type DecorationStyle = 'wavy' | 'dotted' | 'stitched' | 'scribble';
```

Change the `UserPrefs` interface (currently lines 9-12):

```ts
export interface UserPrefs {
  themeColor: string;
  defaultLocation: LocationPref | null;
}
```

to:

```ts
export interface UserPrefs {
  themeColor: string;
  defaultLocation: LocationPref | null;
  decorationStyle: DecorationStyle;
}
```

Add a default constant next to `DEFAULT_THEME_COLOR` (line 14):

```ts
export const DEFAULT_DECORATION_STYLE: DecorationStyle = 'wavy';
```

In `getPrefs`, the guest branch currently reads:

```ts
  if (isGuest) {
    let themeColor = DEFAULT_THEME_COLOR;
    try {
      themeColor = localStorage.getItem('guest_theme_color') || DEFAULT_THEME_COLOR;
    } catch {
      // localStorage unavailable — fall back to default
    }
    return { themeColor, defaultLocation: readGuestDefaultLocation() };
  }
```

change to:

```ts
  if (isGuest) {
    let themeColor = DEFAULT_THEME_COLOR;
    let decorationStyle: DecorationStyle = DEFAULT_DECORATION_STYLE;
    try {
      themeColor = localStorage.getItem('guest_theme_color') || DEFAULT_THEME_COLOR;
      decorationStyle = (localStorage.getItem('guest_decoration_style') as DecorationStyle) || DEFAULT_DECORATION_STYLE;
    } catch {
      // localStorage unavailable — fall back to defaults
    }
    return { themeColor, defaultLocation: readGuestDefaultLocation(), decorationStyle };
  }
```

The logged-in branch currently is:

```ts
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { themeColor: DEFAULT_THEME_COLOR, defaultLocation: null };
  }

  const { data } = await supabase
    .from('profiles')
    .select('theme_color, default_location_id, shelf:default_location_id(id, room, bookshelf)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) {
    return { themeColor: DEFAULT_THEME_COLOR, defaultLocation: null };
  }

  const shelf = (data.shelf as unknown) as { id: string; room: string; bookshelf: string } | null;

  return {
    themeColor: data.theme_color || DEFAULT_THEME_COLOR,
    defaultLocation: shelf ? { id: shelf.id, room: shelf.room, bookshelf: shelf.bookshelf } : null,
  };
```

change to:

```ts
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { themeColor: DEFAULT_THEME_COLOR, defaultLocation: null, decorationStyle: DEFAULT_DECORATION_STYLE };
  }

  const { data } = await supabase
    .from('profiles')
    .select('theme_color, default_location_id, decoration_style, shelf:default_location_id(id, room, bookshelf)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) {
    return { themeColor: DEFAULT_THEME_COLOR, defaultLocation: null, decorationStyle: DEFAULT_DECORATION_STYLE };
  }

  const shelf = (data.shelf as unknown) as { id: string; room: string; bookshelf: string } | null;

  return {
    themeColor: data.theme_color || DEFAULT_THEME_COLOR,
    defaultLocation: shelf ? { id: shelf.id, room: shelf.room, bookshelf: shelf.bookshelf } : null,
    decorationStyle: (data.decoration_style as DecorationStyle) || DEFAULT_DECORATION_STYLE,
  };
```

Finally, after `setThemeColor` (currently ends at line 82), add a new exported function:

```ts
/** Persists the decoration style only — never touches `theme_color` or `default_location_id`. */
export async function setDecorationStyle(isGuest: boolean, style: DecorationStyle): Promise<void> {
  if (isGuest) {
    try {
      localStorage.setItem('guest_decoration_style', style);
    } catch {
      // localStorage unavailable — nothing to persist
    }
    return;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .upsert({ user_id: user.id, decoration_style: style }, { onConflict: 'user_id' });
}
```

- [ ] **Step 4: Create `useDecorationStyle.ts`**

Create `src/hooks/useDecorationStyle.ts`:

```ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getPrefs,
  setDecorationStyle as persistDecorationStyle,
  DEFAULT_DECORATION_STYLE,
  type DecorationStyle,
} from '@/lib/userPrefs';

function applyDecorationStyle(style: DecorationStyle) {
  document.documentElement.dataset.decoration = style;
}

/** Loads the persisted decoration style (Supabase profile for logged-in users, localStorage for guests), applies it as a `data-decoration` attribute on `<html>` that `globals.css` keys its underline rules off of, and exposes a setter that updates the DOM, local state, and persistence together. Mirrors useThemeColor.ts. */
export function useDecorationStyle(isGuest: boolean) {
  const [decorationStyle, setDecorationStyleState] = useState<DecorationStyle>(DEFAULT_DECORATION_STYLE);

  useEffect(() => {
    let cancelled = false;

    getPrefs(isGuest).then((prefs) => {
      if (cancelled) return;
      setDecorationStyleState(prefs.decorationStyle);
      applyDecorationStyle(prefs.decorationStyle);
    });

    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const setDecorationStyle = useCallback((style: DecorationStyle) => {
    setDecorationStyleState(style);
    applyDecorationStyle(style);
    persistDecorationStyle(isGuest, style);
  }, [isGuest]);

  return { decorationStyle, setDecorationStyle };
}
```

Note: unlike `useThemeColor`, this does not need the `no-transitions` class dance — that exists specifically to prevent a visible color-swatch flash on page load, which doesn't apply to underline decoration.

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification in dev server**

With `bun dev` running, open browser devtools console on the app:
1. As a guest session, run `localStorage.getItem('guest_decoration_style')` — expect `null` initially (not yet wired to any UI).
2. This hook isn't wired into any component yet — this task only proves the data layer compiles and the guest/logged-in branches are structurally correct. Full behavioral verification happens in Task 5 once the hook is wired to real UI.

- [ ] **Step 7: Lint and commit**

Run: `bun run lint`
Expected: 0 errors.

```bash
git add supabase/schema.sql src/lib/userPrefs.ts src/hooks/useDecorationStyle.ts
git commit -m "$(cat <<'EOF'
feat: add decoration style persistence (data layer)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Decoration style CSS + convert existing underline sites

**Files:**
- Modify: `src/app/globals.css` (add `.decorated-underline` rules)
- Modify: `src/components/Dashboard.tsx` (3 underline sites: ~line 354, ~line 482, `styles.editModeTrigger` ~line 1239)
- Modify: `src/components/ScanBookModal.tsx` (2 underline sites: `styles.scanByLocationLink`, `styles.scanMultipleTopRight`)

**Interfaces:**
- Consumes: `document.documentElement.dataset.decoration` set by `useDecorationStyle` (Task 3) — this task can be built and verified independently by manually setting `document.documentElement.setAttribute('data-decoration', 'stitched')` in the browser console, since Task 5 (the UI switcher) doesn't exist yet.
- Produces: `.decorated-underline` CSS class, keyed off `[data-decoration="wavy|dotted|stitched|scribble"]` on `<html>`.

- [ ] **Step 1: Add the CSS rules**

In `src/app/globals.css`, after the existing `.vibrate-attention` rule (the block ending around line 645, right before the trailing blank lines at the end of the file), add:

```css
/* Decoration style: underline treatment, driven by [data-decoration] on <html>.
   wavy/dotted use native text-decoration-style; stitched/scribble use a masked
   ::after pseudo-element since CSS has no native dashed/scribble underline. */
.decorated-underline {
  text-decoration: none;
  position: relative;
}

:root[data-decoration="wavy"] .decorated-underline,
html:not([data-decoration]) .decorated-underline {
  text-decoration: underline wavy currentColor;
  text-decoration-thickness: 1.5px;
}

:root[data-decoration="dotted"] .decorated-underline {
  text-decoration: underline dotted currentColor;
  text-decoration-thickness: 1.5px;
}

:root[data-decoration="stitched"] .decorated-underline::after,
:root[data-decoration="scribble"] .decorated-underline::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  height: 4px;
  background-color: currentColor;
  -webkit-mask-repeat: repeat-x;
  mask-repeat: repeat-x;
  -webkit-mask-position: 0 0;
  mask-position: 0 0;
}

:root[data-decoration="stitched"] .decorated-underline::after {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='4' viewBox='0 0 12 4'%3E%3Crect x='0' y='1' width='6' height='2' fill='black'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='4' viewBox='0 0 12 4'%3E%3Crect x='0' y='1' width='6' height='2' fill='black'/%3E%3C/svg%3E");
  -webkit-mask-size: 12px 4px;
  mask-size: 12px 4px;
}

:root[data-decoration="scribble"] .decorated-underline::after {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='6' viewBox='0 0 24 6'%3E%3Cpath d='M0 3 Q2 0 4 3 T8 3 Q10 6 12 3 T16 1 Q18 4 20 2 T24 3' stroke='black' stroke-width='1.4' fill='none'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='6' viewBox='0 0 24 6'%3E%3Cpath d='M0 3 Q2 0 4 3 T8 3 Q10 6 12 3 T16 1 Q18 4 20 2 T24 3' stroke='black' stroke-width='1.4' fill='none'/%3E%3C/svg%3E");
  -webkit-mask-size: 24px 6px;
  mask-size: 24px 6px;
}
```

Note: `document.documentElement` is the `<html>` element, which `:root` also selects — using `:root[data-decoration="..."]` is the correct way to key off an attribute set via `document.documentElement.dataset.decoration`.

- [ ] **Step 2: Convert the 3 Dashboard.tsx underline sites**

Site A — the "Currently showing" label (currently around line 354-363):

```tsx
        Currently showing{' '}
        <span
          style={{
            color: 'var(--accent-primary)',
            textDecoration: 'underline wavy var(--accent-primary)',
            textDecorationThickness: '1.5px',
            textUnderlineOffset: isMobile ? '2px' : '6px',
            fontStyle: 'italic',
          }}
        >
          {displayLabel}
        </span>
        .
```

change to:

```tsx
        Currently showing{' '}
        <span
          className="decorated-underline"
          style={{
            color: 'var(--accent-primary)',
            textUnderlineOffset: isMobile ? '2px' : '6px',
            fontStyle: 'italic',
          }}
        >
          {displayLabel}
        </span>
        .
```

Site B — the header search trigger button (currently around line 480-495):

```tsx
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-newsreader), Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: '32px',
                    color: 'var(--accent-primary)',
                    textDecoration: 'underline wavy var(--accent-primary)',
                    textDecorationThickness: '1.5px',
                    textUnderlineOffset: isMobile ? '2px' : '6px',
                  }}
                >
```

change to:

```tsx
                  className="decorated-underline"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-newsreader), Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: '32px',
                    color: 'var(--accent-primary)',
                    textUnderlineOffset: isMobile ? '2px' : '6px',
                  }}
                >
```

Site C — the `styles.editModeTrigger` object (currently lines 1230-1241):

```ts
  editModeTrigger: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-newsreader), Georgia, serif',
    fontStyle: 'italic',
    fontSize: '32px',
    color: 'var(--accent-primary)',
    textDecoration: 'underline wavy var(--accent-primary)',
    textDecorationThickness: '1.5px',
    textUnderlineOffset: '6px',
  },
```

change to:

```ts
  editModeTrigger: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-newsreader), Georgia, serif',
    fontStyle: 'italic',
    fontSize: '32px',
    color: 'var(--accent-primary)',
    textUnderlineOffset: '6px',
  },
```

This style object is spread at two JSX call sites (currently lines 556 and 568: `style={{ ...styles.editModeTrigger, textUnderlineOffset: isMobile ? '2px' : '6px' }}`). Both need `className="decorated-underline"` added alongside the existing `style` prop — find both and add the className:

```tsx
                  className="decorated-underline"
                  style={{ ...styles.editModeTrigger, textUnderlineOffset: isMobile ? '2px' : '6px' }}
```

- [ ] **Step 3: Convert the 2 ScanBookModal.tsx underline sites**

`styles.scanByLocationLink` (currently):

```ts
  scanByLocationLink: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline wavy var(--accent-primary)',
    textUnderlineOffset: '4px',
    marginTop: '4px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
```

change to:

```ts
  scanByLocationLink: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    textUnderlineOffset: '4px',
    marginTop: '4px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
```

`styles.scanMultipleTopRight` (currently):

```ts
  scanMultipleTopRight: {
    position: 'absolute',
    top: '24px',
    right: '36px',
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline wavy var(--accent-primary)',
    textUnderlineOffset: '4px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    zIndex: 10,
  },
```

change to:

```ts
  scanMultipleTopRight: {
    position: 'absolute',
    top: '24px',
    right: '36px',
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    textUnderlineOffset: '4px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    zIndex: 10,
  },
```

Find the two JSX elements using `style={styles.scanByLocationLink}` and `style={styles.scanMultipleTopRight}` and add `className="decorated-underline"` to each (alongside the existing `style` prop, same as Dashboard.tsx Step 2).

- [ ] **Step 4: Manual verification in dev server**

With `bun dev` running:
1. Load the dashboard. All 5 underline sites should look identical to before (default `data-decoration` is unset, and the CSS rule `html:not([data-decoration]) .decorated-underline` falls back to the wavy look).
2. In the browser devtools console, run `document.documentElement.setAttribute('data-decoration', 'dotted')` — confirm all 5 sites switch to a dotted underline live.
3. Run `document.documentElement.setAttribute('data-decoration', 'stitched')` — confirm a dashed/stitched-looking line appears under each site, in the correct accent color.
4. Run `document.documentElement.setAttribute('data-decoration', 'scribble')` — confirm a loose scrawled line appears, correct color.
5. Check the Scan modal (open the scan flow) for the two ScanBookModal.tsx sites specifically, same 4 checks.

- [ ] **Step 5: Lint and commit**

Run: `bun run lint`
Expected: 0 errors.

```bash
git add src/app/globals.css src/components/Dashboard.tsx src/components/ScanBookModal.tsx
git commit -m "$(cat <<'EOF'
feat: add decoration-style CSS and convert underline sites to use it

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Decoration style menu UI

**Files:**
- Create: `src/components/DecorationSwatches.tsx`
- Modify: `src/components/AccountMenu.tsx` (add decoration row below Theme row)
- Modify: `src/components/MobileMenu.tsx` (add decoration row below Theme row)
- Modify: `src/components/Dashboard.tsx` (wire `useDecorationStyle`, pass props to both menus)

**Interfaces:**
- Consumes: `useDecorationStyle` from Task 3 (`src/hooks/useDecorationStyle.ts`), `.decorated-underline` CSS from Task 4, `DecorationStyle` type from `src/lib/userPrefs.ts`.
- Produces: `DecorationSwatches({ value: DecorationStyle, onChange: (style: DecorationStyle) => void })`, matching `ThemeSwatches`'s prop shape.

- [ ] **Step 1: Create `DecorationSwatches.tsx`**

Create `src/components/DecorationSwatches.tsx`, structurally mirroring `src/components/ThemeSwatches.tsx`:

```tsx
'use client';

import { motion, type Variants } from 'framer-motion';
import type { DecorationStyle } from '@/lib/userPrefs';

const DECORATION_OPTIONS: { style: DecorationStyle; label: string }[] = [
  { style: 'wavy', label: 'Wiggly' },
  { style: 'dotted', label: 'Dotted' },
  { style: 'stitched', label: 'Stitched' },
  { style: 'scribble', label: 'Scribble' },
];

interface DecorationSwatchesProps {
  value: DecorationStyle;
  onChange: (style: DecorationStyle) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const swatchVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 24,
    },
  },
};

/** Row of clickable decoration-style previews, shared by the desktop AccountMenu and the mobile hamburger panel. Mirrors ThemeSwatches.tsx. */
export default function DecorationSwatches({ value, onChange }: DecorationSwatchesProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={styles.row}
      role="group"
      aria-label="Decoration style"
    >
      {DECORATION_OPTIONS.map((opt) => {
        const selected = value === opt.style;
        return (
          <motion.button
            key={opt.style}
            variants={swatchVariants}
            type="button"
            onClick={() => onChange(opt.style)}
            aria-label={opt.label}
            aria-pressed={selected}
            whileTap={{ scale: 0.9 }}
            style={{
              ...styles.swatch,
              boxShadow: selected
                ? '0 0 0 2px var(--bg-sheet), 0 0 0 4px var(--accent-primary)'
                : '0 1px 3px rgba(17, 22, 37, 0.15)',
            }}
          >
            <span
              className="decorated-underline"
              data-decoration-preview={opt.style}
              style={{ color: 'var(--accent-primary)' }}
            >
              {opt.label}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  swatch: {
    background: 'none',
    border: 'none',
    padding: '4px 6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    borderRadius: '6px',
    transition: 'box-shadow 0.15s ease',
  },
};
```

Each swatch button previews its own style directly (label text "Wiggly"/"Dotted"/etc. rendered with that style's underline) — but since `.decorated-underline`'s appearance is driven by the single global `[data-decoration]` attribute on `<html>`, all 4 swatches would otherwise render identically (whatever the *currently applied* style is), not each showing its own option. To make each swatch preview its own style regardless of the active global setting, add a per-swatch override to `globals.css` (Step 2 below) keyed off the `data-decoration-preview` attribute set on each swatch's `<span>`.

- [ ] **Step 2: Add swatch-preview override to `globals.css`**

In `src/app/globals.css`, immediately after the decoration rules added in Task 4 Step 1, add:

```css
/* DecorationSwatches previews: each swatch shows its own style regardless of
   the currently-applied global [data-decoration], via a more specific selector. */
[data-decoration-preview="wavy"].decorated-underline {
  text-decoration: underline wavy currentColor !important;
  text-decoration-thickness: 1.5px !important;
}
[data-decoration-preview="wavy"].decorated-underline::after {
  content: none !important;
}

[data-decoration-preview="dotted"].decorated-underline {
  text-decoration: underline dotted currentColor !important;
  text-decoration-thickness: 1.5px !important;
}
[data-decoration-preview="dotted"].decorated-underline::after {
  content: none !important;
}

[data-decoration-preview="stitched"].decorated-underline,
[data-decoration-preview="scribble"].decorated-underline {
  text-decoration: none !important;
}
[data-decoration-preview="stitched"].decorated-underline::after {
  content: '' !important;
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  height: 4px;
  background-color: currentColor;
  -webkit-mask-repeat: repeat-x;
  mask-repeat: repeat-x;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='4' viewBox='0 0 12 4'%3E%3Crect x='0' y='1' width='6' height='2' fill='black'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='4' viewBox='0 0 12 4'%3E%3Crect x='0' y='1' width='6' height='2' fill='black'/%3E%3C/svg%3E");
  -webkit-mask-size: 12px 4px;
  mask-size: 12px 4px;
}
[data-decoration-preview="scribble"].decorated-underline::after {
  content: '' !important;
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  height: 4px;
  background-color: currentColor;
  -webkit-mask-repeat: repeat-x;
  mask-repeat: repeat-x;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='6' viewBox='0 0 24 6'%3E%3Cpath d='M0 3 Q2 0 4 3 T8 3 Q10 6 12 3 T16 1 Q18 4 20 2 T24 3' stroke='black' stroke-width='1.4' fill='none'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='6' viewBox='0 0 24 6'%3E%3Cpath d='M0 3 Q2 0 4 3 T8 3 Q10 6 12 3 T16 1 Q18 4 20 2 T24 3' stroke='black' stroke-width='1.4' fill='none'/%3E%3C/svg%3E");
  -webkit-mask-size: 24px 6px;
  mask-size: 24px 6px;
}
```

- [ ] **Step 3: Wire `useDecorationStyle` into `Dashboard.tsx`**

In `src/components/Dashboard.tsx`, next to the existing `const { themeColor, setThemeColor } = useThemeColor(isGuest);`, add:

```ts
  const { decorationStyle, setDecorationStyle } = useDecorationStyle(isGuest);
```

Add the import near the existing `import { useThemeColor } from '@/hooks/useThemeColor';`:

```ts
import { useDecorationStyle } from '@/hooks/useDecorationStyle';
```

- [ ] **Step 4: Pass props into `AccountMenu`**

In `src/components/Dashboard.tsx`, find the `<AccountMenu ... />` call (currently lines 580-587):

```tsx
                  <AccountMenu
                    email={userEmail}
                    themeColor={themeColor}
                    onThemeColorChange={setThemeColor}
                    isOpen={isAccountMenuOpen}
                    onOpenChange={setIsAccountMenuOpen}
                    isGuest={isGuest}
                  />
```

change to:

```tsx
                  <AccountMenu
                    email={userEmail}
                    themeColor={themeColor}
                    onThemeColorChange={setThemeColor}
                    decorationStyle={decorationStyle}
                    onDecorationStyleChange={setDecorationStyle}
                    isOpen={isAccountMenuOpen}
                    onOpenChange={setIsAccountMenuOpen}
                    isGuest={isGuest}
                  />
```

And the `<MobileMenu ... />` call (currently lines 987-994):

```tsx
        {isMobileMenuOpen && (
          <MobileMenu
            onClose={() => setIsMobileMenuOpen(false)}
            onManageLocations={() => setIsManageLocationsOpen(true)}
            isGuest={isGuest}
            email={userEmail}
            themeColor={themeColor}
            onThemeColorChange={setThemeColor}
          />
        )}
```

change to:

```tsx
        {isMobileMenuOpen && (
          <MobileMenu
            onClose={() => setIsMobileMenuOpen(false)}
            onManageLocations={() => setIsManageLocationsOpen(true)}
            isGuest={isGuest}
            email={userEmail}
            themeColor={themeColor}
            onThemeColorChange={setThemeColor}
            decorationStyle={decorationStyle}
            onDecorationStyleChange={setDecorationStyle}
          />
        )}
```

- [ ] **Step 5: Add the decoration row to `AccountMenu.tsx`**

In `src/components/AccountMenu.tsx`:

Update the import (line 7) to add `DecorationSwatches`:

```ts
import ThemeSwatches from '@/components/ThemeSwatches';
import DecorationSwatches from '@/components/DecorationSwatches';
import type { DecorationStyle } from '@/lib/userPrefs';
```

Update `AccountMenuProps` (currently lines 9-16):

```ts
interface AccountMenuProps {
  email: string | null;
  themeColor: string;
  onThemeColorChange: (hex: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isGuest?: boolean;
}
```

to:

```ts
interface AccountMenuProps {
  email: string | null;
  themeColor: string;
  onThemeColorChange: (hex: string) => void;
  decorationStyle: DecorationStyle;
  onDecorationStyleChange: (style: DecorationStyle) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isGuest?: boolean;
}
```

Update the function signature (line 19):

```ts
export default function AccountMenu({ email, themeColor, onThemeColorChange, isOpen, onOpenChange, isGuest = false }: AccountMenuProps) {
```

to:

```ts
export default function AccountMenu({ email, themeColor, onThemeColorChange, decorationStyle, onDecorationStyleChange, isOpen, onOpenChange, isGuest = false }: AccountMenuProps) {
```

Add a second collapsible-state variable next to `showPalette` (line 21):

```ts
  const [showPalette, setShowPalette] = useState(false);
  const [showDecoration, setShowDecoration] = useState(false);
```

Immediately after the closing `</div>` of the Theme `styles.row` block (right after the Theme `AnimatePresence` closes, currently ending at line 105, before the `<Link href="/about" ...>` block), insert a second row following the identical structure:

```tsx
            <div style={styles.row}>
              <button
                onClick={() => setShowDecoration(!showDecoration)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={styles.rowLabel}>Decoration</span>
                <motion.span
                  animate={{ rotate: showDecoration ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {showDecoration && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    style={{
                      overflow: 'hidden',
                      marginTop: '-10px',
                      marginLeft: '-6px',
                      marginRight: '-6px',
                    }}
                  >
                    <div style={{ padding: '10px 6px' }}>
                      <DecorationSwatches value={decorationStyle} onChange={onDecorationStyleChange} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
```

- [ ] **Step 6: Add the decoration row to `MobileMenu.tsx`**

In `src/components/MobileMenu.tsx`:

Update the import (line 6):

```ts
import ThemeSwatches from '@/components/ThemeSwatches';
import DecorationSwatches from '@/components/DecorationSwatches';
import type { DecorationStyle } from '@/lib/userPrefs';
```

Update `MobileMenuProps` (currently lines 8-15):

```ts
interface MobileMenuProps {
  onClose: () => void;
  onManageLocations: () => void;
  isGuest?: boolean;
  email?: string | null;
  themeColor: string;
  onThemeColorChange: (hex: string) => void;
}
```

to:

```ts
interface MobileMenuProps {
  onClose: () => void;
  onManageLocations: () => void;
  isGuest?: boolean;
  email?: string | null;
  themeColor: string;
  onThemeColorChange: (hex: string) => void;
  decorationStyle: DecorationStyle;
  onDecorationStyleChange: (style: DecorationStyle) => void;
}
```

Update the function signature (line 18):

```ts
export default function MobileMenu({ onClose, onManageLocations, isGuest = false, email = null, themeColor, onThemeColorChange }: MobileMenuProps) {
```

to:

```ts
export default function MobileMenu({ onClose, onManageLocations, isGuest = false, email = null, themeColor, onThemeColorChange, decorationStyle, onDecorationStyleChange }: MobileMenuProps) {
```

Add a second collapsible-state variable next to `showPalette` (line 21):

```ts
  const [showPalette, setShowPalette] = useState(false);
  const [showDecoration, setShowDecoration] = useState(false);
```

Immediately after the Theme `AnimatePresence` block closes (currently ending at line 121) and before the `<button className="mobile-menu-row" onClick={() => { onManageLocations(); ...}}>` block, insert:

```tsx
        <button
          className="mobile-menu-row"
          onClick={() => setShowDecoration(!showDecoration)}
          style={{ justifyContent: 'flex-end', gap: '8px', width: '100%' }}
        >
          <span>Decoration</span>
          <motion.span
            animate={{ rotate: showDecoration ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {showDecoration && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '6px 24px 16px 24px',
              }}>
                <DecorationSwatches value={decorationStyle} onChange={onDecorationStyleChange} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
```

- [ ] **Step 7: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors — this is the step most likely to surface a missed prop-wiring site, since `AccountMenuProps` and `MobileMenuProps` are now required (non-optional) for the two new props.

- [ ] **Step 8: Manual verification in dev server**

With `bun dev` running (and the Task 3 Step 2 SQL already applied to your Supabase project if testing logged-in):
1. Desktop: open the account "Menu" dropdown, click "Decoration" to expand it — confirm 4 labeled swatches appear ("Wiggly", "Dotted", "Stitched", "Scribble"), each already rendering its own distinct underline style in the preview (independent of the currently active global style).
2. Click "Dotted" — confirm the swatch gets a selected ring, and immediately (no refresh) the 5 underline sites from Task 4 (header search/edit-mode link, "Currently showing" label, Scan modal links) switch to dotted.
3. Refresh the page — confirm the dotted style persists (re-applied on load from `useDecorationStyle`).
4. Repeat steps 1-3 on mobile viewport (hamburger menu) — confirm the same behavior in `MobileMenu`.
5. Test as a guest session — confirm persistence via `localStorage.getItem('guest_decoration_style')` and across a refresh.
6. Switch through all 4 styles at least once each, confirming each renders visibly distinctly (wavy vs dotted vs stitched vs scribble) and no console errors appear.

- [ ] **Step 9: Lint and commit**

Run: `bun run lint`
Expected: 0 errors.

```bash
git add src/components/DecorationSwatches.tsx src/components/AccountMenu.tsx src/components/MobileMenu.tsx src/components/Dashboard.tsx src/app/globals.css
git commit -m "$(cat <<'EOF'
feat: add decoration style picker to account and mobile menus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Out of scope (per spec)

- Public shareable library URL / QR code / print feature — separate spec and plan.
- Combining the missing-cover filter with other filter modes.
- Bulk "un-favorite" or bulk status-to-Reading/To-Read actions.
