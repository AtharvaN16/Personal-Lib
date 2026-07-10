# Header Menu, Theme Palette & About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the header's "Logout" link with a "Menu" sheet (account email/logout, live theme picker, About link), add a public `/about` page, and move both the theme color and the existing "default scan location" preference off `localStorage` onto a new Supabase `profiles` table for logged-in users (guests keep `localStorage`).

**Architecture:** A new `profiles` table + `userPrefs.ts` helper is the single read/write path for both preferences. A `useThemeColor` hook applies the color to two CSS custom properties (`--accent-primary`, `--accent-primary-rgb`) at runtime, which every existing `var(--accent-primary)` call site already repaints automatically; the handful of hardcoded `rgba(0, 44, 188, …)` values get converted to `rgba(var(--accent-primary-rgb), …)` so they repaint too. A shared `ThemeSwatches` component is reused by both the new desktop `AccountMenu` dropdown and the existing mobile hamburger panel.

**Tech Stack:** Next.js App Router, Bun, Supabase (Postgres + Auth), framer-motion, vanilla CSS custom properties. No test runner exists in this repo — verification is `bun run lint`, `bunx tsc --noEmit`, and manual checks against `bun dev`.

## Global Constraints

- No Tailwind — inline `style` objects / existing CSS classes only, matching every file in `src/components/`.
- Colors/spacing follow the existing warm-parchment cozy palette in `src/app/globals.css` (`--bg-primary`, `--bg-sheet`, `--text-primary`, `--paper-shadow-hover`, etc.) — no new hardcoded hex values outside the theme palette itself.
- Theme palette (final 6, from the design spec, all ≥4.5:1 contrast against `--bg-primary` #F4F2E4 and `--bg-sheet` #FFFDFB): Vivid Blue `#002CBC` (default), Vivid Violet `#6B1FD1`, Vivid Crimson `#C4123C`, Vivid Teal `#037A7A`, Vivid Forest Green `#0A7A3D`, Vivid Burnt Orange `#A84406`.
- About page copy, verbatim: "Made by Atharva. See more of my work at atharvanayak.design, or say hello at atharvanayak16@gmail.com." Both links use the hero-text treatment: italic serif, `color: var(--accent-primary)`, `textDecoration: 'underline wavy var(--accent-primary)'`, `textDecorationThickness: '1.5px'`.
- Mobile hamburger panel (`MobileMenu.tsx` / `.mobile-menu-row` styles in `globals.css`) keeps its exact current visual style — only new rows are added, grouped with spacing, no divider lines.
- Guests (no Supabase account) always use `localStorage` for both preferences — this mirrors how the rest of guest mode already works (`src/lib/guestData.ts`, `guest_books`, `guest_shelves`).
- `supabase/schema.sql` is the single hand-applied schema file for this project (no migrations directory) — new tables are appended to it.

---

### Task 1: `profiles` table + generated types

**Files:**
- Modify: `supabase/schema.sql` (append at end)
- Modify: `src/types/database.types.ts:9-198` (add `profiles` entry inside `Tables`)

**Interfaces:**
- Produces: Postgres table `public.profiles(user_id uuid PK, theme_color text, default_location_id uuid nullable, updated_at timestamptz)`, and the matching `Database['public']['Tables']['profiles']` TypeScript type consumed by Task 2's `userPrefs.ts`.

- [ ] **Step 1: Append the table, RLS, and policies to `supabase/schema.sql`**

Add this to the end of the file (after the existing indexes block):

```sql
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
```

- [ ] **Step 2: Add the `profiles` entry to `database.types.ts`**

In `src/types/database.types.ts`, insert a new table entry inside `Database['public']['Tables']`, right after the closing `}` of `book_lookup_daily_usage` (currently ending at line 174, before `}` that closes `Tables` at line 175):

```typescript
      profiles: {
        Row: {
          user_id: string
          theme_color: string
          default_location_id: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          theme_color?: string
          default_location_id?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          theme_color?: string
          default_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "shelves"
            referencedColumns: ["id"]
          }
        ]
      }
```

- [ ] **Step 3: Apply the schema change to the live Supabase project**

Run the new SQL block from Step 1 in the Supabase SQL editor (or via `psql` against the project's connection string) since this repo has no migration runner — schema changes are applied by hand.

- [ ] **Step 4: Verify types compile**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bunx tsc --noEmit`
Expected: no new errors (the `profiles` type isn't consumed yet, so this just confirms the JSON-ish type block is syntactically valid).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/types/database.types.ts
git commit -m "feat: add profiles table for theme color and default location prefs"
```

---

### Task 2: `userPrefs.ts` preference helper

**Files:**
- Create: `src/lib/userPrefs.ts`

**Interfaces:**
- Consumes: `Database['public']['Tables']['profiles']` from Task 1; `createClient` from `@/lib/supabase/client`.
- Produces (consumed by Task 3's `useThemeColor` and Task 8's `ScanBookModal` migration):
  - `export interface LocationPref { id: string; room: string; bookshelf: string }`
  - `export interface UserPrefs { themeColor: string; defaultLocation: LocationPref | null }`
  - `export const DEFAULT_THEME_COLOR: string` (`'#002CBC'`)
  - `export async function getPrefs(isGuest: boolean): Promise<UserPrefs>`
  - `export async function setThemeColor(isGuest: boolean, color: string): Promise<void>`
  - `export async function setDefaultLocation(isGuest: boolean, location: LocationPref | null): Promise<void>`

- [ ] **Step 1: Write `src/lib/userPrefs.ts`**

```typescript
import { createClient } from '@/lib/supabase/client';

export interface LocationPref {
  id: string;
  room: string;
  bookshelf: string;
}

export interface UserPrefs {
  themeColor: string;
  defaultLocation: LocationPref | null;
}

export const DEFAULT_THEME_COLOR = '#002CBC';

function readGuestDefaultLocation(): LocationPref | null {
  try {
    const id = localStorage.getItem('defaultLocationId');
    const objStr = localStorage.getItem('defaultLocationObj');
    if (!id || !objStr) return null;
    const obj = JSON.parse(objStr) as { room: string; bookshelf: string };
    return { id, room: obj.room, bookshelf: obj.bookshelf };
  } catch {
    return null;
  }
}

/** Reads both preferences. Guests read from localStorage; logged-in users read their `profiles` row (joined to `shelves` for the default location's display fields). */
export async function getPrefs(isGuest: boolean): Promise<UserPrefs> {
  if (isGuest) {
    let themeColor = DEFAULT_THEME_COLOR;
    try {
      themeColor = localStorage.getItem('guest_theme_color') || DEFAULT_THEME_COLOR;
    } catch {
      // localStorage unavailable — fall back to default
    }
    return { themeColor, defaultLocation: readGuestDefaultLocation() };
  }

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

  const shelf = data.shelf as { id: string; room: string; bookshelf: string } | null;

  return {
    themeColor: data.theme_color || DEFAULT_THEME_COLOR,
    defaultLocation: shelf ? { id: shelf.id, room: shelf.room, bookshelf: shelf.bookshelf } : null,
  };
}

/** Persists the theme color only — never touches `default_location_id`, since Supabase upsert only updates the columns present in the payload. */
export async function setThemeColor(isGuest: boolean, color: string): Promise<void> {
  if (isGuest) {
    try {
      localStorage.setItem('guest_theme_color', color);
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
    .upsert({ user_id: user.id, theme_color: color }, { onConflict: 'user_id' });
}

/** Persists the default scan location only — never touches `theme_color`. Pass `null` to clear it. */
export async function setDefaultLocation(isGuest: boolean, location: LocationPref | null): Promise<void> {
  if (isGuest) {
    try {
      if (location) {
        localStorage.setItem('defaultLocationId', location.id);
        localStorage.setItem('defaultLocationObj', JSON.stringify({ room: location.room, bookshelf: location.bookshelf }));
      } else {
        localStorage.removeItem('defaultLocationId');
        localStorage.removeItem('defaultLocationObj');
      }
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
    .upsert({ user_id: user.id, default_location_id: location?.id || null }, { onConflict: 'user_id' });
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bunx tsc --noEmit && bun run lint`
Expected: no errors from `src/lib/userPrefs.ts`.

- [ ] **Step 3: Manual smoke test**

Run: `bun dev`, then in the browser console on `http://localhost:3000` (while logged in) run:
```js
const m = await import('/src/lib/userPrefs.ts'); // adjust if Next serves a compiled path instead
```
This import-in-console trick is unreliable under Next's bundler, so instead verify indirectly: proceed to Task 3, which calls `getPrefs`/`setThemeColor` from real UI, and confirm there.

- [ ] **Step 4: Commit**

```bash
git add src/lib/userPrefs.ts
git commit -m "feat: add userPrefs helper for theme color and default location persistence"
```

---

### Task 3: Theme CSS infrastructure + `useThemeColor` hook

**Files:**
- Modify: `src/app/globals.css:1-21` (add `--accent-primary-rgb`), `src/app/globals.css:77` and `:227` (convert hardcoded glow `rgba(0, 44, 188, …)`)
- Modify: `src/components/Dashboard.tsx:1187` (convert toast shadow)
- Modify: `src/components/SearchPill.tsx:232` (convert pill background)
- Modify: `src/app/layout.tsx` (add no-FOUC inline script)
- Create: `src/hooks/useThemeColor.ts`

**Interfaces:**
- Consumes: `getPrefs`, `setThemeColor as persistThemeColor` from `@/lib/userPrefs` (Task 2).
- Produces (consumed by Task 4 swatches, Task 6 `AccountMenu`, Task 7 `MobileMenu`): `export function useThemeColor(isGuest: boolean): { themeColor: string; setThemeColor: (hex: string) => void }`.

- [ ] **Step 1: Add `--accent-primary-rgb` to `globals.css`**

In `src/app/globals.css`, in the `:root` block (line 10), add the new property directly after `--accent-primary`:

```css
  --accent-primary: #002CBC;   /* Vibrant ink blue */
  --accent-primary-rgb: 0, 44, 188; /* Same color as R, G, B channels for rgba() composition */
```

- [ ] **Step 2: Convert the two hardcoded glow gradients**

Line 77 (base `body::after`), change:
```css
  background: radial-gradient(circle 45vw at 50% 85.7%, rgba(0, 44, 188, 0.22) 0%, rgba(0, 44, 188, 0.06) 60%, transparent 100%);
```
to:
```css
  background: radial-gradient(circle 45vw at 50% 85.7%, rgba(var(--accent-primary-rgb), 0.22) 0%, rgba(var(--accent-primary-rgb), 0.06) 60%, transparent 100%);
```

Line 227 (mobile media query), change:
```css
    background: radial-gradient(ellipse 65vw 65vh at 50% 74%, rgba(0, 44, 188, 0.24) 0%, rgba(0, 44, 188, 0.06) 60%, transparent 100%) !important;
```
to:
```css
    background: radial-gradient(ellipse 65vw 65vh at 50% 74%, rgba(var(--accent-primary-rgb), 0.24) 0%, rgba(var(--accent-primary-rgb), 0.06) 60%, transparent 100%) !important;
```

- [ ] **Step 3: Convert the toast shadow in `Dashboard.tsx`**

At `src/components/Dashboard.tsx:1187`, change:
```typescript
                boxShadow: '0 4px 16px rgba(0, 44, 188, 0.15)',
```
to:
```typescript
                boxShadow: '0 4px 16px rgba(var(--accent-primary-rgb), 0.15)',
```

- [ ] **Step 4: Convert the search pill background in `SearchPill.tsx`**

At `src/components/SearchPill.tsx:232`, change:
```typescript
            backgroundColor: 'rgba(0, 44, 188, 0.06)', // Light blue container background
```
to:
```typescript
            backgroundColor: 'rgba(var(--accent-primary-rgb), 0.06)', // Accent-tinted container background
```

- [ ] **Step 5: Write `src/hooks/useThemeColor.ts`**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPrefs, setThemeColor as persistThemeColor, DEFAULT_THEME_COLOR } from '@/lib/userPrefs';

function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function applyThemeColor(color: string) {
  document.documentElement.style.setProperty('--accent-primary', color);
  document.documentElement.style.setProperty('--accent-primary-rgb', hexToRgbTriplet(color));
}

/** Loads the persisted theme color (Supabase profile for logged-in users, localStorage for guests), applies it to the CSS custom properties every accent-colored element reads from, and exposes a setter that updates the DOM, local state, and persistence together. */
export function useThemeColor(isGuest: boolean) {
  const [themeColor, setThemeColorState] = useState(DEFAULT_THEME_COLOR);

  useEffect(() => {
    let cancelled = false;
    getPrefs(isGuest).then((prefs) => {
      if (cancelled) return;
      setThemeColorState(prefs.themeColor);
      applyThemeColor(prefs.themeColor);
    });
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const setThemeColor = useCallback((color: string) => {
    setThemeColorState(color);
    applyThemeColor(color);
    persistThemeColor(isGuest, color);
  }, [isGuest]);

  return { themeColor, setThemeColor };
}
```

- [ ] **Step 6: Add the no-FOUC inline script to `layout.tsx`**

In `src/app/layout.tsx`, inside `<head>` (after the existing `<link>` tags, before `</head>`), add:

```tsx
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem('guest_theme_color');if(c){var h=c.replace('#','');var r=parseInt(h.slice(0,2),16);var g=parseInt(h.slice(2,4),16);var b=parseInt(h.slice(4,6),16);document.documentElement.style.setProperty('--accent-primary',c);document.documentElement.style.setProperty('--accent-primary-rgb',r+', '+g+', '+b);}}catch(e){}})();`,
          }}
        />
```

This only reads the guest/last-known localStorage value before paint — it is a best-effort flash guard, not the source of truth. Logged-in users' real value still loads asynchronously via `useThemeColor` after hydration (same tradeoff any DB-backed "avoid FOUC" solution makes, since the DB can't be read synchronously before paint).

- [ ] **Step 7: Wire the hook into `Dashboard.tsx` (temporary, no UI yet)**

In `src/components/Dashboard.tsx`, add the import near the other hook imports (after line 17 `import { useIsMobile } from '@/hooks/useIsMobile';`):

```typescript
import { useThemeColor } from '@/hooks/useThemeColor';
```

Inside `export default function Dashboard(...)`, right after `const isMobile = useIsMobile();` (line 174), add:

```typescript
  const { themeColor, setThemeColor } = useThemeColor(isGuest);
```

`themeColor`/`setThemeColor` are unused until Task 6/7 wire up the UI — add a one-line eslint-disable so lint doesn't fail in the meantime:

```typescript
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { themeColor, setThemeColor } = useThemeColor(isGuest);
```

- [ ] **Step 8: Verify build and manual color check**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bunx tsc --noEmit && bun run lint`
Expected: no errors.

Run: `bun dev`, open `http://localhost:3000` as a guest (skip login), open browser devtools console, run:
```js
document.documentElement.style.setProperty('--accent-primary', '#C4123C');
document.documentElement.style.setProperty('--accent-primary-rgb', '196, 18, 60');
```
Expected: the header title, hero "Search"/"Scan" links, book author text, and the background glow all turn crimson red immediately — confirming every existing `var(--accent-primary)` site and both converted glow gradients repaint correctly.

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css src/components/Dashboard.tsx src/components/SearchPill.tsx src/app/layout.tsx src/hooks/useThemeColor.ts
git commit -m "feat: add runtime-swappable accent color CSS infrastructure and useThemeColor hook"
```

---

### Task 4: `ThemeSwatches` shared component

**Files:**
- Create: `src/components/ThemeSwatches.tsx`

**Interfaces:**
- Consumes: nothing beyond React.
- Produces (consumed by Task 6 `AccountMenu` and Task 7 `MobileMenu`): `export const THEME_COLORS: { name: string; hex: string }[]`, `export default function ThemeSwatches({ value, onChange }: { value: string; onChange: (hex: string) => void })`.

- [ ] **Step 1: Write `src/components/ThemeSwatches.tsx`**

```tsx
'use client';

export const THEME_COLORS: { name: string; hex: string }[] = [
  { name: 'Vivid Blue', hex: '#002CBC' },
  { name: 'Vivid Violet', hex: '#6B1FD1' },
  { name: 'Vivid Crimson', hex: '#C4123C' },
  { name: 'Vivid Teal', hex: '#037A7A' },
  { name: 'Vivid Forest Green', hex: '#0A7A3D' },
  { name: 'Vivid Burnt Orange', hex: '#A84406' },
];

interface ThemeSwatchesProps {
  value: string;
  onChange: (hex: string) => void;
}

/** Row of clickable accent-color dots, shared by the desktop AccountMenu and the mobile hamburger panel. */
export default function ThemeSwatches({ value, onChange }: ThemeSwatchesProps) {
  return (
    <div style={styles.row} role="group" aria-label="Theme color">
      {THEME_COLORS.map((c) => {
        const selected = value.toLowerCase() === c.hex.toLowerCase();
        return (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            aria-label={c.name}
            aria-pressed={selected}
            style={{
              ...styles.swatch,
              backgroundColor: c.hex,
              boxShadow: selected
                ? `0 0 0 2px var(--bg-sheet), 0 0 0 4px ${c.hex}`
                : '0 1px 3px rgba(17, 22, 37, 0.15)',
            }}
          />
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  swatch: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bunx tsc --noEmit && bun run lint`
Expected: no errors (component isn't imported anywhere yet, so this only checks syntax/types).

- [ ] **Step 3: Commit**

```bash
git add src/components/ThemeSwatches.tsx
git commit -m "feat: add shared ThemeSwatches color picker component"
```

---

### Task 5: About page

**Files:**
- Create: `src/app/about/page.tsx`

**Interfaces:**
- Consumes: nothing (static server component).
- Produces: route `/about`, linked from Task 6/7's menus.

- [ ] **Step 1: Write `src/app/about/page.tsx`**

```tsx
import Link from 'next/link';

const linkStyle: React.CSSProperties = {
  fontStyle: 'italic',
  fontFamily: 'var(--font-newsreader), Georgia, serif',
  color: 'var(--accent-primary)',
  textDecoration: 'underline wavy var(--accent-primary)',
  textDecorationThickness: '1.5px',
  textUnderlineOffset: '4px',
};

export default function AboutPage() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p className="display-serif" style={styles.text}>
          Made by Atharva. See more of my work at{' '}
          <a href="https://atharvanayak.design" target="_blank" rel="noopener noreferrer" style={linkStyle}>
            atharvanayak.design
          </a>
          , or say hello at{' '}
          <a href="mailto:atharvanayak16@gmail.com" style={linkStyle}>
            atharvanayak16@gmail.com
          </a>
          .
        </p>
        <Link href="/" className="nav-link" style={styles.backLink}>
          ← Back to library
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    maxWidth: '560px',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    textAlign: 'center',
  },
  text: {
    fontSize: '22px',
    lineHeight: '1.6',
    color: 'var(--text-primary)',
    fontWeight: 'normal',
  },
  backLink: {
    fontSize: '0.95rem',
  },
};
```

- [ ] **Step 2: Verify the route renders**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bun dev`, visit `http://localhost:3000/about`.
Expected: centered text "Made by Atharva. See more of my work at atharvanayak.design, or say hello at atharvanayak16@gmail.com." with both links in italic serif accent-colored wavy-underline style (visually matching the hero's "Search"/"Scan" text), and a working "← Back to library" link to `/`. Click `atharvanayak.design` — opens in a new tab. Click the email — opens the system mail client (or shows `mailto:` in the browser depending on OS config).

- [ ] **Step 3: Commit**

```bash
git add src/app/about/page.tsx
git commit -m "feat: add /about page with hero-styled links"
```

---

### Task 6: Desktop `AccountMenu` sheet

**Files:**
- Create: `src/components/AccountMenu.tsx`
- Modify: `src/app/page.tsx:224` (pass `userEmail` to `Dashboard`)
- Modify: `src/components/Dashboard.tsx:144-150` (accept `userEmail` prop), `:790-818` (swap `LogoutLink` branch for `AccountMenu`), `:231-233` (register outside-click close for the menu wrapper)
- Modify: `src/hooks/useLogout.ts:6` (update stale doc comment referencing the deleted `LogoutLink`)
- Delete: `src/components/LogoutLink.tsx`

**Interfaces:**
- Consumes: `useThemeColor` return value from Task 3 (already wired into `Dashboard.tsx`); `THEME_COLORS`/`ThemeSwatches` from Task 4; `useCloseOnOutsideClick` (already defined at the top of `Dashboard.tsx:22-42`, generic over any wrapper id).
- Produces: `export default function AccountMenu({ email, themeColor, onThemeColorChange, isOpen, onOpenChange, isGuest }: AccountMenuProps)`.

- [ ] **Step 1: Write `src/components/AccountMenu.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useLogout } from '@/hooks/useLogout';
import ThemeSwatches from '@/components/ThemeSwatches';

interface AccountMenuProps {
  email: string | null;
  themeColor: string;
  onThemeColorChange: (hex: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isGuest?: boolean;
}

/** Desktop-only dropdown sheet, anchored under the "Menu" trigger, replacing the old bare Logout link. */
export default function AccountMenu({ email, themeColor, onThemeColorChange, isOpen, onOpenChange, isGuest = false }: AccountMenuProps) {
  const logout = useLogout();

  // Escape closes the sheet — outside-click close is handled by Dashboard.tsx's
  // shared useCloseOnOutsideClick, which only listens for clicks, not keys.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpenChange]);

  return (
    <div id="account-menu-wrapper" style={{ position: 'relative' }}>
      <button
        onClick={() => onOpenChange(!isOpen)}
        style={styles.trigger}
      >
        Menu
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="Account menu"
            initial={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            style={styles.panel}
          >
            {isGuest ? (
              <button
                onClick={() => {
                  document.cookie = 'guest_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
                  window.location.href = '/login';
                }}
                style={styles.signInRow}
              >
                Sign in to save your books
              </button>
            ) : (
              <div style={styles.topGroup}>
                <span style={styles.email}>{email}</span>
                <button onClick={logout} style={styles.logoutBtn}>
                  Logout
                </button>
              </div>
            )}

            <div style={styles.row}>
              <span style={styles.rowLabel}>Theme</span>
              <ThemeSwatches value={themeColor} onChange={onThemeColorChange} />
            </div>

            <Link href="/about" style={styles.row} onClick={() => onOpenChange(false)}>
              <span style={styles.rowLabel}>About</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  trigger: {
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
  panel: {
    position: 'absolute',
    top: 'calc(100% + 16px)',
    right: 0,
    minWidth: '260px',
    backgroundColor: 'var(--bg-sheet)',
    borderRadius: '12px 15px 12px 15px/15px 12px 15px 12px',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.15)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
    zIndex: 1100,
  },
  topGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  email: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    wordBreak: 'break-all',
  },
  logoutBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--error)',
  },
  signInRow: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--accent-primary)',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  rowLabel: {
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
```

- [ ] **Step 2: Pass `userEmail` from `page.tsx` to `Dashboard`**

In `src/app/page.tsx`, the logged-in return at line 224 currently reads:
```tsx
  return <Dashboard />;
```
Change to:
```tsx
  return <Dashboard userEmail={user.email ?? null} />;
```

- [ ] **Step 3: Accept `userEmail` in `Dashboard.tsx`**

At `src/components/Dashboard.tsx:144-149`, change:
```typescript
interface DashboardProps {
  isGuest?: boolean;
  initialGuestBooks?: Book[];
}

export default function Dashboard({ isGuest = false, initialGuestBooks = EMPTY_GUEST_BOOKS }: DashboardProps = {}) {
```
to:
```typescript
interface DashboardProps {
  isGuest?: boolean;
  initialGuestBooks?: Book[];
  userEmail?: string | null;
}

export default function Dashboard({ isGuest = false, initialGuestBooks = EMPTY_GUEST_BOOKS, userEmail = null }: DashboardProps = {}) {
```

- [ ] **Step 4: Add `isAccountMenuOpen` state and outside-click close**

In `Dashboard.tsx`, alongside the other `useState` declarations (near line 168 `const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);`), add:
```typescript
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
```

Alongside the existing `useCloseOnOutsideClick` calls (line 232-233), add a third:
```typescript
  useCloseOnOutsideClick(isAccountMenuOpen, 'account-menu-wrapper', () => setIsAccountMenuOpen(false));
```

- [ ] **Step 5: Import `AccountMenu` and remove the now-unused `LogoutLink` import**

At the top of `Dashboard.tsx`, replace:
```typescript
import LogoutLink from '@/components/LogoutLink';
```
with:
```typescript
import AccountMenu from '@/components/AccountMenu';
```

- [ ] **Step 6: Swap the `rightNav` logout branch for `AccountMenu`**

At `src/components/Dashboard.tsx:790-818`, the current `logout-link` branch reads:
```tsx
                <motion.div
                  key="logout-link"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                >
                  {isGuest ? (
                    <button
                      onClick={() => {
                        document.cookie = 'guest_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
                        window.location.href = '/login';
                      }}
                      className="nav-link"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      Sign in to save your books
                    </button>
                  ) : (
                    <LogoutLink />
                  )}
                </motion.div>
```
Replace it with:
```tsx
                <motion.div
                  key="account-menu"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                >
                  <AccountMenu
                    email={userEmail}
                    themeColor={themeColor}
                    onThemeColorChange={setThemeColor}
                    isOpen={isAccountMenuOpen}
                    onOpenChange={setIsAccountMenuOpen}
                    isGuest={isGuest}
                  />
                </motion.div>
```

- [ ] **Step 7: Remove the temporary eslint-disable from Task 3 Step 7**

`themeColor`/`setThemeColor` are now used — remove the `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment added above the `useThemeColor` call in Task 3 Step 7, leaving just:
```typescript
  const { themeColor, setThemeColor } = useThemeColor(isGuest);
```

- [ ] **Step 8: Delete the now-unused `LogoutLink.tsx`**

`LogoutLink` was only used in the branch just replaced. Confirm no other references, then delete:
```bash
cd "/Users/atharvanayak/Developer/Personal Library" && grep -rn "LogoutLink" src
```
Expected: no matches. Then:
```bash
rm src/components/LogoutLink.tsx
```
(`useLogout.ts` stays — it's still used by `AccountMenu.tsx` and `MobileMenu.tsx`. `LogoutButton.tsx` also stays if referenced elsewhere — check with `grep -rn "LogoutButton" src` first; if unreferenced, leave it as-is since it's out of scope for this plan to hunt down unrelated dead code.)

- [ ] **Step 9: Update the now-stale doc comment in `useLogout.ts`**

`src/hooks/useLogout.ts:6` currently reads `/** Signs out of Supabase and navigates back to /login. Shared by desktop LogoutLink and the mobile menu. */` — `LogoutLink` no longer exists. Change it to:
```typescript
/** Signs out of Supabase and navigates back to /login. Shared by the desktop AccountMenu and the mobile menu. */
```

- [ ] **Step 10: Verify build and manual check**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bunx tsc --noEmit && bun run lint`
Expected: no errors.

Run: `bun dev`, log in as a real user (or sign up a throwaway test account), on desktop width (>640px):
1. Confirm "Menu" appears where "Logout" used to be (top-right, italic underline-wavy style).
2. Click it — panel opens with a blur/slide-in animation showing your email, a red "Logout" button beneath it, a "Theme" row with 6 swatches, and an "About" row.
3. Click a swatch (e.g. Vivid Crimson) — confirm the header logo, glow, and swatch selection ring all update immediately to red; the previously-selected swatch's ring disappears.
4. Reload the page — confirm the header stays red (persisted via the `profiles` table; check Supabase Studio's `profiles` table row directly if in doubt).
5. Click outside the panel — it closes. Reopen, press Escape — click "About" — navigates to `/about` and the panel closes.
6. Click "Logout" — signs out and redirects to `/login`.
7. As a guest (skip login), confirm the top row now reads "Sign in to save your books" and Theme/About still work, persisting via `localStorage`'s `guest_theme_color` key (check devtools Application tab).

- [ ] **Step 11: Commit**

```bash
git add src/components/AccountMenu.tsx src/app/page.tsx src/components/Dashboard.tsx src/hooks/useLogout.ts
git rm src/components/LogoutLink.tsx
git commit -m "feat: replace header Logout link with Menu sheet (account, theme, about)"
```

---

### Task 7: Mobile menu — email/logout, theme, about

**Files:**
- Modify: `src/components/MobileMenu.tsx`
- Modify: `src/components/Dashboard.tsx` (pass new props to `MobileMenu`)
- Modify: `src/app/globals.css:382-399` (add a spacing-only group style, no new visual treatment)

**Interfaces:**
- Consumes: `THEME_COLORS`/`ThemeSwatches` from Task 4; `themeColor`/`setThemeColor` from `Dashboard.tsx`'s existing `useThemeColor` call (Task 3); `userEmail` prop already threaded through `Dashboard.tsx` (Task 6).
- Produces: `MobileMenu` gains `email: string | null`, `themeColor: string`, `onThemeColorChange: (hex: string) => void` props.

- [ ] **Step 1: Add a spacing-only "menu group" class to `globals.css`**

In `src/app/globals.css`, inside the existing `@media (max-width: 640px)` block that defines `.mobile-menu-row` (around line 382-399), add a new class right after `.mobile-menu-row:active { ... }` (ends at line 399):

```css
  .mobile-menu-group {
    margin-bottom: 12px;
  }
```

This is spacing only — no border, no background — matching "use space to separate the rows, no dividers."

- [ ] **Step 2: Rewrite `src/components/MobileMenu.tsx`**

Replace the full file with:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLogout } from '@/hooks/useLogout';
import ThemeSwatches from '@/components/ThemeSwatches';

interface MobileMenuProps {
  onClose: () => void;
  onManageLocations: () => void;
  isGuest?: boolean;
  email?: string | null;
  themeColor: string;
  onThemeColorChange: (hex: string) => void;
}

/** Hamburger dropdown menu (mobile only): dimmed+blurred backdrop, links slide down underneath the header. */
export default function MobileMenu({ onClose, onManageLocations, isGuest = false, email = null, themeColor, onThemeColorChange }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const logout = useLogout();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="mobile-overlay-backdrop" onClick={onClose}>
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          padding: 0,
          zIndex: 10001,
        }}
        aria-label="Close menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </motion.button>

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="mobile-menu-panel"
        initial={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-menu-group">
          {isGuest ? (
            <button
              className="mobile-menu-row"
              style={{ fontWeight: '600', color: 'var(--accent-primary)' }}
              onClick={() => {
                document.cookie = 'guest_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
                window.location.href = '/login';
                onClose();
              }}
            >
              Sign in to save your books
            </button>
          ) : (
            <>
              <div className="mobile-menu-row" style={{ cursor: 'default', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {email}
              </div>
              <button
                className="mobile-menu-row"
                style={{ fontWeight: '600', color: 'var(--error)' }}
                onClick={() => {
                  logout();
                  onClose();
                }}
              >
                Logout
              </button>
            </>
          )}
        </div>

        <button
          className="mobile-menu-row"
          onClick={() => {
            onManageLocations();
            onClose();
          }}
        >
          Manage Locations
        </button>

        <div className="mobile-menu-row" style={{ justifyContent: 'flex-end', gap: '12px' }}>
          <span>Theme</span>
          <ThemeSwatches value={themeColor} onChange={onThemeColorChange} />
        </div>

        <button
          className="mobile-menu-row"
          onClick={() => {
            window.location.href = '/about';
            onClose();
          }}
        >
          About
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3: Pass the new props from `Dashboard.tsx`**

At `src/components/Dashboard.tsx`, find the `MobileMenu` usage (around line 1146-1152):
```tsx
        {isMobileMenuOpen && (
          <MobileMenu
            onClose={() => setIsMobileMenuOpen(false)}
            onManageLocations={() => setIsManageLocationsOpen(true)}
            isGuest={isGuest}
          />
        )}
```
Change to:
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

- [ ] **Step 4: Verify build**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bunx tsc --noEmit && bun run lint`
Expected: no errors.

- [ ] **Step 5: Manual check on a narrow viewport**

Run: `bun dev`, open devtools responsive mode at ≤640px width, log in as a real user:
1. Tap the hamburger icon — panel slides down, unchanged cinematic blurred backdrop.
2. Confirm rows top-to-bottom: email (plain text, not clickable) directly above a red "Logout" row, then a visible gap, then "Manage Locations", "Theme" (with swatches right-aligned), "About" — no divider lines anywhere, just spacing.
3. Tap a theme swatch — panel stays open, swatch ring updates, and (after closing) the header/glow reflect the new color.
4. Tap "About" — navigates to `/about`.
5. Tap "Logout" — signs out.
6. As a guest, confirm the top row reverts to "Sign in to save your books" and the rest is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/MobileMenu.tsx src/components/Dashboard.tsx src/app/globals.css
git commit -m "feat: add email/logout, theme swatches, and about link to mobile menu"
```

---

### Task 8: Migrate `ScanBookModal` default-location persistence to `userPrefs`

**Files:**
- Modify: `src/components/ScanBookModal.tsx:173-189` (load), `:296-332` (save/clear)

**Interfaces:**
- Consumes: `getPrefs`, `setDefaultLocation`, `LocationPref` from `@/lib/userPrefs` (Task 2).

- [ ] **Step 1: Import the helper**

At the top of `src/components/ScanBookModal.tsx`, after the existing `import { GUEST_SHELVES } from '@/lib/guestData';` (line 10), add:
```typescript
import { getPrefs, setDefaultLocation } from '@/lib/userPrefs';
```

- [ ] **Step 2: Replace the load effect**

At `src/components/ScanBookModal.tsx:173-189`, replace:
```typescript
  useEffect(() => {
    try {
      const savedId = localStorage.getItem('defaultLocationId') || '';
      const savedObjStr = localStorage.getItem('defaultLocationObj');
      const savedObj = savedObjStr ? JSON.parse(savedObjStr) : null;
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPersistentDefaultLocationId(savedId);
      setPersistentDefaultLocationObj(savedObj);
      
      // Initialize active scanning session location
      setCurrentRoom(savedObj?.room || '');
      setCurrentShelfId(savedId);
    } catch (e) {
      console.warn('Failed to load default location settings:', e);
    }
  }, []);
```
with:
```typescript
  useEffect(() => {
    let cancelled = false;
    getPrefs(isGuest).then(({ defaultLocation }) => {
      if (cancelled) return;
      const savedId = defaultLocation?.id || '';
      const savedObj = defaultLocation ? { room: defaultLocation.room, bookshelf: defaultLocation.bookshelf } : null;

      setPersistentDefaultLocationId(savedId);
      setPersistentDefaultLocationObj(savedObj);

      // Initialize active scanning session location
      setCurrentRoom(savedObj?.room || '');
      setCurrentShelfId(savedId);
    }).catch((e) => {
      console.warn('Failed to load default location settings:', e);
    });
    return () => {
      cancelled = true;
    };
  }, [isGuest]);
```

- [ ] **Step 3: Replace the save/clear handler**

At `src/components/ScanBookModal.tsx:296-332`, replace:
```typescript
  const handleSaveDefaultLocation = async () => {
    if (!setupRoom || !uniqueRooms.includes(setupRoom)) {
      setPersistentDefaultLocationId('');
      setPersistentDefaultLocationObj(null);
      localStorage.removeItem('defaultLocationId');
      localStorage.removeItem('defaultLocationObj');

      // Sync current session scan location
      setCurrentRoom('');
      setCurrentShelfId('');

      // Sync multi-scan queue location
      setDefaultLocationId('');
      setDefaultLocationObj(null);

      setLocationSetupOpen(false);
      return;
    }
    const resolved = await resolveLocationSelection(setupRoom, setupShelfId);
    if (!resolved) return;

    setPersistentDefaultLocationId(resolved.id);
    setPersistentDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });
    
    localStorage.setItem('defaultLocationId', resolved.id);
    localStorage.setItem('defaultLocationObj', JSON.stringify({ room: resolved.room, bookshelf: resolved.bookshelf }));

    // Sync current session scan location
    setCurrentRoom(resolved.room);
    setCurrentShelfId(resolved.id);

    // Sync multi-scan queue location
    setDefaultLocationId(resolved.id);
    setDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });

    setLocationSetupOpen(false);
  };
```
with:
```typescript
  const handleSaveDefaultLocation = async () => {
    if (!setupRoom || !uniqueRooms.includes(setupRoom)) {
      setPersistentDefaultLocationId('');
      setPersistentDefaultLocationObj(null);
      await setDefaultLocation(isGuest, null);

      // Sync current session scan location
      setCurrentRoom('');
      setCurrentShelfId('');

      // Sync multi-scan queue location
      setDefaultLocationId('');
      setDefaultLocationObj(null);

      setLocationSetupOpen(false);
      return;
    }
    const resolved = await resolveLocationSelection(setupRoom, setupShelfId);
    if (!resolved) return;

    setPersistentDefaultLocationId(resolved.id);
    setPersistentDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });

    await setDefaultLocation(isGuest, { id: resolved.id, room: resolved.room, bookshelf: resolved.bookshelf });

    // Sync current session scan location
    setCurrentRoom(resolved.room);
    setCurrentShelfId(resolved.id);

    // Sync multi-scan queue location
    setDefaultLocationId(resolved.id);
    setDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });

    setLocationSetupOpen(false);
  };
```

- [ ] **Step 4: Verify build**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bunx tsc --noEmit && bun run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification as a logged-in user**

Run: `bun dev`, log in, open the Scan modal, switch to multi-scan/location mode, set a default location (e.g. "Living room" / "Tall Shelf") and save.
1. Check Supabase Studio's `profiles` table — confirm a row now exists for your `user_id` with `default_location_id` set to that shelf's id.
2. Reload the page, reopen the Scan modal — confirm the saved default location is still shown (now loaded from Supabase, not `localStorage`).
3. Clear the default location (the "no room selected" save path) — confirm `profiles.default_location_id` becomes `null` in Supabase Studio, and it's empty on next reload.
4. As a guest, repeat the same flow — confirm `localStorage`'s `defaultLocationId`/`defaultLocationObj` keys are unaffected (guest path unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/components/ScanBookModal.tsx
git commit -m "feat: persist default scan location via Supabase profile instead of localStorage"
```
