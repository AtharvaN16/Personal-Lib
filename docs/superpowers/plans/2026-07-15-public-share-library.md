# Public Share Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner share a read-only, searchable view of their library via a link and a printable, artistic QR code, without exposing any edit/scan/filter capability.

**Architecture:** A `share_token`/`share_enabled` pair added to the existing `profiles` table gates a new public route (`/share/[token]`). That route is a server component using a service-role Supabase client (server-only, bypasses RLS deliberately and narrowly) to fetch one user's books/shelves, then hands plain data to a new client component (`PublicLibrary`) that reuses the app's visual language but has no edit/scan/filter affordances. An `AccountMenu`/`MobileMenu` entry opens `ShareLibraryModal`, which manages the toggle, an artistic QR code, and the copyable/shareable link, via a small owner-authenticated API route.

**Tech Stack:** Next.js App Router (server components + API routes), Supabase (Postgres + `@supabase/supabase-js` service-role client), `qr-code-styling` (new dependency) for the QR code, existing `framer-motion`/`TextAnimate`/`SearchPill` machinery for the public page's search UI.

## Global Constraints

- No automated test suite exists anywhere in this codebase (verified: no `*.test.tsx`/`*.test.ts` files). Every existing spec in `docs/superpowers/specs/` verifies manually via `bun dev`. This plan follows that convention — no new test framework is introduced.
- Visual conventions throughout: `0px` border-radius on all modals/inputs, `--accent-primary`/`--bg-sheet`/`--bg-primary`/`--text-primary`/`--text-secondary`/`--error` CSS custom properties, `var(--font-instrument-sans), sans-serif` for UI text and `var(--font-newsreader), Georgia, serif` italic for hero/search text, existing classes `.field-white`, `.modal-close-btn`, `.hover-wavy-underline`, `.nav-link`, `.mobile-menu-row`, `.books-grid`, `.book-card-container`, `.book-card-cover`.
- Deviation from the committed spec (`docs/superpowers/specs/2026-07-15-public-share-library-design.md`): the spec proposed a new `user_settings` table. Discovered during planning that `public.profiles` already is exactly this — a one-row-per-user, upsert-on-first-write preferences table (`theme_color`, `default_location_id`), RLS'd identically to what the spec wanted. This plan extends `profiles` with `share_token`/`share_enabled` instead of creating a duplicate table. Every other part of the spec (token lifecycle, admin-client-only public access, modal contents, public page contents) is unchanged.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never referenced with a `NEXT_PUBLIC_` prefix, never imported by any file under `'use client'`.
- Guests (`isGuest = true`, no real Supabase account) never see the "Share Library" row — there is no `profiles` row to attach a token to.

---

### Task 1: Database — add sharing columns to `profiles`

**Files:**
- Modify: `supabase/schema.sql` (append after the existing `profiles` table/policies block, which ends at line 200)

**Interfaces:**
- Produces: `public.profiles.share_token text unique` (nullable), `public.profiles.share_enabled boolean not null default false`. All later tasks that read/write sharing state go through these two columns.

- [ ] **Step 1: Add the migration statements**

Append to the end of `supabase/schema.sql`:

```sql
-- Public sharing: an opt-in read-only link + QR code for the owner's library.
-- share_token is generated on first enable and preserved across disable/re-enable
-- (see /api/share) so a printed QR code doesn't go stale from toggling sharing off.
alter table public.profiles
  add column if not exists share_token text unique,
  add column if not exists share_enabled boolean not null default false;
```

- [ ] **Step 2: Apply the migration**

Run this SQL against the project's Supabase instance (via the Supabase SQL editor, or `psql` if the project has a direct connection string configured — check `.env.local` for `DATABASE_URL`; if absent, use the Supabase dashboard SQL editor and paste the block from Step 1).

- [ ] **Step 3: Verify the columns exist**

In the Supabase SQL editor, run:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'profiles' and column_name in ('share_token', 'share_enabled');
```

Expected: two rows, `share_token` (`text`, nullable), `share_enabled` (`boolean`, not nullable, default `false`).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add share_token/share_enabled columns to profiles"
```

---

### Task 2: Service-role Supabase admin client

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `createAdminClient(): SupabaseClient` — a service-role client that bypasses RLS. Consumed only by `src/app/share/[token]/page.tsx` (Task 12). Never imported from a `'use client'` file.

- [ ] **Step 1: Add the env var to the example file**

In `.env.local.example`, after the existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` line, add:

```
# Server-only Supabase service-role key (Project Settings -> API -> service_role).
# Bypasses RLS entirely — used only by the public /share/[token] route to read one
# user's books past their normal RLS policies. Never expose as NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- [ ] **Step 2: Add the actual key to local `.env.local`**

Copy the `service_role` key from the Supabase dashboard (Project Settings → API) into the project's real `.env.local` file (not committed) as `SUPABASE_SERVICE_ROLE_KEY=...`.

- [ ] **Step 3: Create the admin client**

Create `src/lib/supabase/admin.ts`:

```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client that bypasses RLS. Server-only — must never be imported from a
 * 'use client' file or a route that isn't explicitly gating access itself (the public
 * /share/[token] page validates the token before using this).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

- [ ] **Step 4: Verify it builds**

Run: `bun run build`
Expected: build succeeds (this file isn't imported anywhere yet, so it just needs to type-check — no runtime behavior to observe).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/admin.ts .env.local.example
git commit -m "feat: add service-role Supabase admin client for public share route"
```

---

### Task 3: Extract shared book-search helper

**Files:**
- Create: `src/lib/bookSearch.ts`
- Modify: `src/components/Dashboard.tsx:44-52` (remove local definitions, import from new file)

**Interfaces:**
- Produces: `normalizeQuery(query: string): string`, `bookMatchesQuery(book: Book, normalizedQuery: string): boolean`. Consumed by `Dashboard.tsx` (existing usage, unchanged behavior) and `PublicLibrary.tsx` (Task 10).

- [ ] **Step 1: Create the shared helper**

Create `src/lib/bookSearch.ts`:

```ts
import { Book } from '@/components/BookModal';

export const normalizeQuery = (query: string) => query.toLowerCase().trim().replace(/\s+/g, ' ');

export const bookMatchesQuery = (book: Book, normalizedQuery: string) => {
  if (!normalizedQuery) return true;
  return (
    book.title.toLowerCase().includes(normalizedQuery) ||
    book.authors.some(a => a.toLowerCase().includes(normalizedQuery))
  );
};
```

- [ ] **Step 2: Remove the local definitions from Dashboard.tsx and import instead**

In `src/components/Dashboard.tsx`, delete lines 44-52 (the `normalizeQuery` and `bookMatchesQuery` const declarations), and add to the import block (after the `useBooks` import on line 19):

```ts
import { normalizeQuery, bookMatchesQuery } from '@/lib/bookSearch';
```

- [ ] **Step 3: Verify Dashboard still builds and search still works**

Run: `bun run build`
Expected: build succeeds, no unresolved references to `normalizeQuery`/`bookMatchesQuery`.

Run: `bun dev`, open the app, log in (or use guest mode), click "Search" in the hero, type part of a book title, press Enter. Expected: grid filters to matching books exactly as before this change.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bookSearch.ts src/components/Dashboard.tsx
git commit -m "refactor: extract bookSearch helper for reuse by public library page"
```

---

### Task 4: Extract shared room/bookshelf grouping helper

**Files:**
- Create: `src/lib/bookGrouping.ts`
- Modify: `src/components/Dashboard.tsx:338-353` (replace inline grouping with the shared helper)

**Interfaces:**
- Produces: `groupBooksByRoom(books: Book[], room: string): { bookshelves: string[]; booksByShelf: Record<string, Book[]>; unassignedBooks: Book[] }`. Consumed by `Dashboard.tsx` (existing location-filter view, unchanged behavior) and `PublicLibrary.tsx`'s Locations view (Task 11).

- [ ] **Step 1: Read the current inline logic to preserve exact behavior**

Current code (`src/components/Dashboard.tsx:338-353`):

```ts
  // Grouping logic for room filters with multiple bookshelves
  const allBooksInRoom = filterRoom
    ? books.filter(b => b.location?.room === filterRoom)
    : [];
  const bookshelvesInRoom = Array.from(
    new Set(allBooksInRoom.map(b => b.location?.bookshelf).filter((s): s is string => Boolean(s)))
  );
  const hasUnassignedInRoom = allBooksInRoom.some(b => !b.location?.bookshelf);
  ...
  const unassignedBooks = displayedBooks.filter(b => !b.location?.bookshelf);
```

- [ ] **Step 2: Create the shared helper**

Create `src/lib/bookGrouping.ts`:

```ts
import { Book } from '@/components/BookModal';

export interface RoomGrouping {
  /** Distinct bookshelf names within the room, in first-seen order. */
  bookshelves: string[];
  /** Books in the room, keyed by bookshelf name (only shelves with >=1 book are present). */
  booksByShelf: Record<string, Book[]>;
  /** Books in the room with no bookshelf assigned. */
  unassignedBooks: Book[];
}

/** Groups a room's books by bookshelf, matching the room-filter view's existing behavior. */
export function groupBooksByRoom(books: Book[], room: string): RoomGrouping {
  const allBooksInRoom = books.filter(b => b.location?.room === room);

  const bookshelves = Array.from(
    new Set(allBooksInRoom.map(b => b.location?.bookshelf).filter((s): s is string => Boolean(s)))
  );

  const booksByShelf: Record<string, Book[]> = {};
  for (const shelf of bookshelves) {
    booksByShelf[shelf] = allBooksInRoom.filter(b => b.location?.bookshelf === shelf);
  }

  const unassignedBooks = allBooksInRoom.filter(b => !b.location?.bookshelf);

  return { bookshelves, booksByShelf, unassignedBooks };
}
```

- [ ] **Step 3: Wire it into Dashboard.tsx**

In `src/components/Dashboard.tsx`, add to the imports:

```ts
import { groupBooksByRoom } from '@/lib/bookGrouping';
```

Replace lines 338-353 (the block shown in Step 1) with:

```ts
  const roomGrouping = filterRoom ? groupBooksByRoom(books, filterRoom) : null;
  const bookshelvesInRoom = roomGrouping?.bookshelves ?? [];
  const hasUnassignedInRoom = (roomGrouping?.unassignedBooks.length ?? 0) > 0;
```

Then find the JSX block that iterates `bookshelvesInRoom` to render each shelf's `shelfBooks` (around where `styles.shelfSection` is rendered, currently computing `shelfBooks` inline per shelf — search for `bookshelvesInRoom.map`). Update the per-shelf book list to read from `roomGrouping.booksByShelf[shelf]` instead of whatever inline filter currently derives `shelfBooks`, and update the final `unassignedBooks` block (previously `displayedBooks.filter(b => !b.location?.bookshelf)`) to use `roomGrouping?.unassignedBooks.filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery))) ?? []` so search filtering within the room view is preserved.

- [ ] **Step 4: Verify the location filter view still works**

Run: `bun dev`, open the app, click into a location filter with multiple bookshelves (via the filter panel → Location). Expected: books still grouped under "Books on {shelf}" headings exactly as before, unassigned books still appear under "Other books in {room}".

- [ ] **Step 5: Commit**

```bash
git add src/lib/bookGrouping.ts src/components/Dashboard.tsx
git commit -m "refactor: extract bookGrouping helper for reuse by public library page"
```

---

### Task 5: `/api/share` route (status + enable/disable/regenerate)

**Files:**
- Create: `src/app/api/share/route.ts`

**Interfaces:**
- Produces: `GET /api/share` → `{ shareToken: string | null; shareEnabled: boolean; shareUrl: string | null }`. `POST /api/share` with body `{ action: 'enable' | 'disable' | 'regenerate' }` → same shape. Both require an authenticated (non-guest) session; consumed by `ShareLibraryModal.tsx` (Task 6).

- [ ] **Step 1: Create the route**

Create `src/app/api/share/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';

function buildShareUrl(req: NextRequest, token: string | null): string | null {
  if (!token) return null;
  return `${req.nextUrl.origin}/share/${token}`;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data } = await supabase
    .from('profiles')
    .select('share_token, share_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  const shareToken = data?.share_token ?? null;
  const shareEnabled = data?.share_enabled ?? false;

  return NextResponse.json({
    shareToken,
    shareEnabled,
    shareUrl: buildShareUrl(req, shareToken),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { action?: string } | null;
  const action = body?.action;
  if (action !== 'enable' && action !== 'disable' && action !== 'regenerate') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('share_token')
    .eq('user_id', user.id)
    .maybeSingle();

  let shareToken = existing?.share_token ?? null;
  let shareEnabled: boolean;

  if (action === 'disable') {
    shareEnabled = false;
  } else if (action === 'regenerate') {
    shareToken = randomBytes(24).toString('base64url');
    shareEnabled = true;
  } else {
    // enable
    if (!shareToken) {
      shareToken = randomBytes(24).toString('base64url');
    }
    shareEnabled = true;
  }

  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, share_token: shareToken, share_enabled: shareEnabled }, { onConflict: 'user_id' });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    shareToken,
    shareEnabled,
    shareUrl: buildShareUrl(req, shareToken),
  });
}
```

- [ ] **Step 2: Verify GET with no session is rejected**

Run: `bun dev`, then in a separate terminal:

```bash
curl -i http://localhost:3000/api/share
```

Expected: `HTTP/1.1 401` with `{"error":"Not authenticated"}`.

- [ ] **Step 3: Verify enable/disable/regenerate while logged in**

Log into the app in a browser (so cookies are set), open devtools → Application → Cookies, copy the `sb-*` cookie values, or simpler: from the browser devtools console while logged in, run:

```js
fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enable' }) })
  .then(r => r.json()).then(console.log);
```

Expected: `{ shareToken: "<some base64url string>", shareEnabled: true, shareUrl: "http://localhost:3000/share/<token>" }`.

Run the same with `{ action: 'disable' }` → expected `shareEnabled: false`, same `shareToken`. Run with `{ action: 'regenerate' }` → expected a **different** `shareToken`, `shareEnabled: true`.

Run `fetch('/api/share').then(r => r.json()).then(console.log)` (GET) → expected it reflects the last POST's state.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/share/route.ts
git commit -m "feat: add /api/share route for enabling/disabling public library sharing"
```

---

### Task 6: `ShareLibraryModal.tsx`

**Files:**
- Create: `src/components/ShareLibraryModal.tsx`
- Modify: `package.json` (add `qr-code-styling`)
- Modify: `src/app/globals.css` (add print isolation rule)

**Interfaces:**
- Consumes: `GET /api/share`, `POST /api/share` (Task 5); `THEME_COLORS`-style hex string via `accentColor` prop (from `useThemeColor`, already threaded through `Dashboard.tsx`).
- Produces: `<ShareLibraryModal accentColor={string} onClose={() => void} />` default export. Consumed by `Dashboard.tsx` (Task 7).

- [ ] **Step 1: Add the QR styling dependency**

```bash
bun add qr-code-styling
```

- [ ] **Step 2: Verify the install**

Run: `grep qr-code-styling package.json`
Expected: a line like `"qr-code-styling": "^1.x.x"` under `dependencies`.

- [ ] **Step 3: Add the print-isolation CSS rule**

In `src/app/globals.css`, append:

```css
/* Used by ShareLibraryModal's "Print QR Code" button: isolates the QR code + caption as the
   only visible content when the browser print dialog renders the page. */
@media print {
  body * {
    visibility: hidden;
  }
  .share-print-area,
  .share-print-area * {
    visibility: visible;
  }
  .share-print-area {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 40px;
  }
}
```

- [ ] **Step 4: Create the modal**

Create `src/components/ShareLibraryModal.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

interface ShareLibraryModalProps {
  accentColor: string;
  onClose: () => void;
}

interface ShareState {
  shareToken: string | null;
  shareEnabled: boolean;
  shareUrl: string | null;
}

export default function ShareLibraryModal({ accentColor, onClose }: ShareLibraryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<InstanceType<typeof import('qr-code-styling').default> | null>(null);

  const [state, setState] = useState<ShareState>({ shareToken: null, shareEnabled: false, shareUrl: null });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [isConfirmingRegen, setIsConfirmingRegen] = useState(false);

  // Focus trap / escape / body-scroll-lock, matching AddLocationModal's pattern
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
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
      previouslyFocused?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/share')
      .then((r) => r.json())
      .then((data: ShareState) => {
        if (!cancelled) setState(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Render/update the QR code whenever the share URL or accent color changes.
  useEffect(() => {
    if (!state.shareEnabled || !state.shareUrl || !qrContainerRef.current) return;

    let cancelled = false;
    import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (cancelled || !qrContainerRef.current) return;
      qrContainerRef.current.innerHTML = '';
      const qr = new QRCodeStyling({
        width: 220,
        height: 220,
        data: state.shareUrl!,
        margin: 8,
        dotsOptions: { color: accentColor, type: 'rounded' },
        cornersSquareOptions: { color: accentColor, type: 'extra-rounded' },
        cornersDotOptions: { color: accentColor, type: 'dot' },
        backgroundOptions: { color: '#FFFDFB' },
      });
      qr.append(qrContainerRef.current);
      qrCodeRef.current = qr;
    });

    return () => { cancelled = true; };
  }, [state.shareEnabled, state.shareUrl, accentColor]);

  const postAction = useCallback(async (action: 'enable' | 'disable' | 'regenerate') => {
    setToggling(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data: ShareState = await res.json();
      setState(data);
    } finally {
      setToggling(false);
    }
  }, []);

  const handleToggle = () => {
    postAction(state.shareEnabled ? 'disable' : 'enable');
  };

  const handleCopy = async () => {
    if (!state.shareUrl) return;
    await navigator.clipboard.writeText(state.shareUrl);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy'), 2000);
  };

  const handleShare = async () => {
    if (!state.shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Library', url: state.shareUrl });
      } catch {
        // User cancelled the share sheet — no-op.
      }
    } else {
      await handleCopy();
    }
  };

  const handleRegenerate = async () => {
    await postAction('regenerate');
    setIsConfirmingRegen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={styles.backdrop}
      onClick={onClose}
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share Library"
        tabIndex={-1}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        style={{ ...styles.modal, outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn no-print" aria-label="Close">
          CLOSE
        </button>

        <h2 style={styles.title}>Share Library</h2>
        <p style={styles.subtitle}>
          Let friends browse your library. They can search for books, but can&apos;t scan, edit, or move anything.
        </p>

        {!loading && (
          <>
            <div style={styles.toggleRow} className="no-print">
              <span style={styles.toggleLabel}>{state.shareEnabled ? 'Sharing is on' : 'Sharing is off'}</span>
              <button
                onClick={handleToggle}
                disabled={toggling}
                role="switch"
                aria-checked={state.shareEnabled}
                style={{
                  ...styles.switchTrack,
                  backgroundColor: state.shareEnabled ? accentColor : 'rgba(17, 22, 37, 0.15)',
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                <motion.span
                  animate={{ x: state.shareEnabled ? 20 : 2 }}
                  transition={{ duration: 0.2 }}
                  style={styles.switchThumb}
                />
              </button>
            </div>

            {state.shareEnabled && state.shareUrl && (
              <>
                <div className="share-print-area">
                  <div ref={qrContainerRef} style={styles.qrWrapper} />
                  <p style={styles.printCaption}>Scan to see our library</p>
                </div>

                <div style={styles.actionsRow} className="no-print">
                  <button onClick={handlePrint} style={styles.secondaryBtn}>Print QR Code</button>
                </div>

                <div style={styles.linkRow} className="no-print">
                  <input readOnly value={state.shareUrl} className="field-white" style={styles.linkInput} />
                  <button onClick={handleCopy} style={styles.secondaryBtn}>{copyLabel}</button>
                  <button onClick={handleShare} style={styles.primaryBtn}>Share</button>
                </div>

                <div className="no-print" style={styles.regenRow}>
                  {isConfirmingRegen ? (
                    <span style={styles.confirmRow}>
                      <span style={styles.confirmText}>This invalidates the old link/QR code.</span>
                      <button onClick={handleRegenerate} style={styles.confirmBtn}>Regenerate</button>
                      <button onClick={() => setIsConfirmingRegen(false)} style={styles.cancelBtn}>Cancel</button>
                    </span>
                  ) : (
                    <button onClick={() => setIsConfirmingRegen(true)} style={styles.regenLink}>
                      Regenerate link
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 22, 37, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'var(--bg-sheet)',
    padding: '28px 24px 24px 24px',
    position: 'relative',
    maxHeight: '90svh',
    overflowY: 'auto',
    borderRadius: '0px',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.12)',
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    padding: 0,
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    marginBottom: '6px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
    lineHeight: '1.4',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  toggleLabel: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  switchTrack: {
    width: '44px',
    height: '24px',
    borderRadius: '9999px',
    border: 'none',
    position: 'relative',
    cursor: 'pointer',
    padding: 0,
    transition: 'background-color 0.2s ease',
  },
  switchThumb: {
    position: 'absolute',
    top: '2px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#FFFDFB',
    boxShadow: '0 1px 3px rgba(17, 22, 37, 0.3)',
  },
  qrWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  printCaption: {
    textAlign: 'center',
    fontFamily: 'var(--font-newsreader), Georgia, serif',
    fontStyle: 'italic',
    fontSize: '1rem',
    color: 'var(--text-primary)',
    marginBottom: '20px',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  linkRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '16px',
  },
  linkInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '0.8rem',
    borderRadius: '0px',
    minWidth: 0,
  },
  regenRow: {
    borderTop: '1px solid rgba(17, 22, 37, 0.12)',
    paddingTop: '16px',
  },
  regenLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    textDecoration: 'underline',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  confirmText: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  confirmBtn: {
    background: 'none',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    backgroundColor: 'var(--bg-sheet)',
    color: 'var(--error)',
    fontWeight: 'bold',
    fontSize: '0.85rem',
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  secondaryBtn: {
    background: 'none',
    border: '1px solid rgba(17, 22, 37, 0.15)',
    color: 'var(--text-primary)',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    borderRadius: '0px',
    whiteSpace: 'nowrap',
  },
  primaryBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    whiteSpace: 'nowrap',
  },
};
```

Also add the `.no-print` helper to `src/app/globals.css` (in the same `@media print` block added in Step 3, append):

```css
@media print {
  .no-print {
    display: none !important;
  }
}
```

- [ ] **Step 5: Verify it builds**

Run: `bun run build`
Expected: build succeeds. (This component isn't mounted anywhere yet — Task 7 wires it in.)

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/components/ShareLibraryModal.tsx src/app/globals.css
git commit -m "feat: add ShareLibraryModal with rounded accent-colored QR code and print support"
```

---

### Task 7: Wire "Share Library" into the menus and Dashboard

**Files:**
- Modify: `src/components/AccountMenu.tsx`
- Modify: `src/components/MobileMenu.tsx`
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `ShareLibraryModal` (Task 6, `{ accentColor, onClose }`).
- Produces: `AccountMenuProps.onShareLibrary?: () => void`, `MobileMenuProps.onShareLibrary?: () => void` — new optional props, omitted/undefined for guests so the row doesn't render.

- [ ] **Step 1: Add the row + prop to AccountMenu**

In `src/components/AccountMenu.tsx`, add `onShareLibrary?: () => void` to `AccountMenuProps` (after `isGuest?: boolean;`), and destructure it in the function signature. Insert a new row directly after the existing `<Link href="/about" ...>` block (after line 109, before `<div style={styles.bottomGroup}>`):

```tsx
            {!isGuest && onShareLibrary && (
              <button
                onClick={() => { onShareLibrary(); onOpenChange(false); }}
                style={styles.row}
              >
                <span style={styles.rowLabel}>Share Library</span>
              </button>
            )}
```

Note `styles.row` is currently typed as a `<div>` style object reused on a `<button>` here — that's fine since `React.CSSProperties` doesn't care about the element, matching how `styles.signInRow` (also a button) already reuses plain style objects in this file. Add `background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%'` inline alongside `styles.row` on this button since `styles.row` alone (a flex column) doesn't reset button defaults:

```tsx
                style={{ ...styles.row, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
```

- [ ] **Step 2: Add the row + prop to MobileMenu**

In `src/components/MobileMenu.tsx`, add `onShareLibrary?: () => void` to `MobileMenuProps`, destructure it. Insert directly after the existing "About" button (after the block ending `About\n        </button>`, before the `{/* Bottom items... */}` comment):

```tsx
        {!isGuest && onShareLibrary && (
          <button
            className="mobile-menu-row"
            onClick={() => {
              onShareLibrary();
              onClose();
            }}
          >
            Share Library
          </button>
        )}
```

- [ ] **Step 3: Wire both menus + the modal into Dashboard**

In `src/components/Dashboard.tsx`:
1. Add import: `import ShareLibraryModal from '@/components/ShareLibraryModal';`
2. Add state near the other modal-open flags (next to `isManageLocationsOpen`): `const [isShareModalOpen, setIsShareModalOpen] = useState(false);`
3. On the `<AccountMenu ... />` usage (around line 610), add prop: `onShareLibrary={isGuest ? undefined : () => setIsShareModalOpen(true)}`
4. On the `<MobileMenu ... />` usage (around line 1066), add prop: `onShareLibrary={isGuest ? undefined : () => setIsShareModalOpen(true)}`
5. Near the other conditionally-rendered modals (next to where `isManageLocationsOpen && <ManageLocationsModal ... />` is rendered, around line 1020), add:

```tsx
        {isShareModalOpen && (
          <ShareLibraryModal
            accentColor={themeColor}
            onClose={() => setIsShareModalOpen(false)}
          />
        )}
```

- [ ] **Step 4: Verify manually**

Run: `bun dev`, log in as a real (non-guest) user.
- Desktop: click "Menu" → confirm "Share Library" row appears between "About" and the bottom email/logout group → click it → modal opens, toggle works, QR renders once enabled.
- Resize to mobile width (or use device toolbar): open hamburger menu → confirm "Share Library" row appears between "About" and the bottom group → click it → same modal opens.
- Log out and use guest mode (`/login` → guest entry point): confirm neither menu shows "Share Library" at all.

- [ ] **Step 5: Commit**

```bash
git add src/components/AccountMenu.tsx src/components/MobileMenu.tsx src/components/Dashboard.tsx
git commit -m "feat: wire Share Library entry into desktop and mobile menus"
```

---

### Task 8: `PublicBookCard.tsx` (read-only book cover card)

**Files:**
- Create: `src/components/PublicBookCard.tsx`

**Interfaces:**
- Consumes: `Book` type (`@/components/BookModal`), `getPlaceholderColor`/`getSpineColor` (`@/lib/placeholderCover`).
- Produces: `<PublicBookCard book={Book} onClick={(book: Book) => void} isMobile={boolean} />` default export. Consumed by `PublicLibrary.tsx` (Tasks 10-11).

- [ ] **Step 1: Create the component**

This is `Dashboard.tsx`'s inline `BookCard` (lines 1135-1225) with `editMode`/`selected`/`onToggleSelect` removed — no selection outline, no wiggle class, no aria-pressed:

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book } from '@/components/BookModal';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';

interface PublicBookCardProps {
  book: Book;
  onClick: (book: Book) => void;
  isMobile?: boolean;
}

export default function PublicBookCard({ book, onClick, isMobile = false }: PublicBookCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const showMeta = isMobile || hovered;

  const mobileMeta: React.CSSProperties = isMobile ? {
    width: '100%',
    maxWidth: '100%',
    height: 'auto',
    marginTop: '8px',
    overflow: 'hidden',
    boxSizing: 'border-box',
  } : {};

  const mobileTitleStyle: React.CSSProperties = isMobile ? {
    fontSize: '0.82rem',
    lineHeight: '1.25',
    marginBottom: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    display: 'block',
  } : {};

  const mobileAuthorStyle: React.CSSProperties = isMobile ? {
    fontSize: '0.75rem',
    lineHeight: '1.2',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    display: 'block',
  } : {};

  return (
    <div
      style={styles.cardContainer}
      className="book-card-container"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(book)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(book);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${book.title}`}
    >
      <motion.div
        animate={{
          scale: hovered ? 1.04 : 1,
          boxShadow: hovered
            ? '0 20px 30px rgba(17, 22, 37, 0.18)'
            : '0 4px 12px rgba(17, 22, 37, 0.06)',
        }}
        transition={{ duration: 0.2 }}
        style={styles.coverWrapper}
        className="book-card-cover"
      >
        {book.cover_url && !imgError ? (
          <img
            src={book.cover_url}
            alt={book.title}
            style={{ position: 'absolute', height: '100%', width: '100%', left: 0, top: 0, right: 0, bottom: 0, objectFit: 'cover' }}
            draggable={false}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
            <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
            <span className="display-serif" style={styles.placeholderText}>{book.title}</span>
          </div>
        )}
      </motion.div>

      <div style={{ ...styles.metaContainer, ...mobileMeta }} className="book-card-meta">
        <AnimatePresence>
          {showMeta && (
            <motion.div
              initial={isMobile ? undefined : { opacity: 0, y: 6, filter: 'blur(2px)' }}
              animate={isMobile ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={isMobile ? undefined : { opacity: 0, y: 6, filter: 'blur(2px)' }}
              transition={isMobile ? { duration: 0 } : { duration: 0.15 }}
              style={{ pointerEvents: 'none', width: '100%', overflow: 'hidden' }}
            >
              <h4 style={{ ...styles.bookTitle, ...mobileTitleStyle }}>{book.title}</h4>
              <p className="handwritten" style={{ ...styles.bookAuthor, ...mobileAuthorStyle }}>
                {book.authors.join(', ')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cardContainer: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
  },
  coverWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '4px',
  },
  placeholderCover: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    left: 0,
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box',
  },
  placeholderSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '10px',
  },
  placeholderText: {
    color: '#FFFDFB',
    fontSize: '0.85rem',
    textAlign: 'center',
    lineHeight: '1.3',
  },
  metaContainer: {
    marginTop: '10px',
    minHeight: '38px',
  },
  bookTitle: {
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  bookAuthor: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
};
```

- [ ] **Step 2: Verify it builds**

Run: `bun run build`
Expected: build succeeds. (Not mounted anywhere yet — Task 10 uses it.)

- [ ] **Step 3: Commit**

```bash
git add src/components/PublicBookCard.tsx
git commit -m "feat: add read-only PublicBookCard for the public library page"
```

---

### Task 9: `PublicBookDetail.tsx` (read-only detail overlay)

**Files:**
- Create: `src/components/PublicBookDetail.tsx`

**Interfaces:**
- Consumes: `Book` type.
- Produces: `<PublicBookDetail book={Book} onClose={() => void} />` default export. Consumed by `PublicLibrary.tsx` (Task 10).

- [ ] **Step 1: Create the component**

A small, purpose-built read-only card — not a stripped `BookModal` (which has ~800 lines of edit/save/delete machinery this view must never expose):

```tsx
'use client';

import { motion } from 'framer-motion';
import { Book } from '@/components/BookModal';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';

interface PublicBookDetailProps {
  book: Book;
  onClose: () => void;
}

export default function PublicBookDetail({ book, onClose }: PublicBookDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={styles.backdrop}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
          CLOSE
        </button>

        <div style={styles.body}>
          <div style={styles.coverWrapper}>
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} style={styles.coverImg} />
            ) : (
              <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
                <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
              </div>
            )}
          </div>
          <div style={styles.info}>
            <h2 style={styles.title}>{book.title}</h2>
            <p style={styles.authors}>{book.authors.join(', ')}</p>
            {book.status && <p style={styles.meta}>Status: {book.status}</p>}
            {book.location && (
              <p style={styles.meta}>
                Location: {book.location.room}{book.location.bookshelf ? ` · ${book.location.bookshelf}` : ''}
              </p>
            )}
            {book.description && <p style={styles.description}>{book.description}</p>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 22, 37, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    width: '100%',
    maxWidth: '520px',
    backgroundColor: 'var(--bg-sheet)',
    padding: '28px 24px 24px 24px',
    position: 'relative',
    maxHeight: '90svh',
    overflowY: 'auto',
    borderRadius: '0px',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.12)',
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    padding: 0,
  },
  body: {
    display: 'flex',
    gap: '20px',
    marginTop: '20px',
  },
  coverWrapper: {
    width: '120px',
    height: '168px',
    flexShrink: 0,
    position: 'relative',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  placeholderSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '10px',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    margin: 0,
  },
  authors: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  meta: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  description: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
    marginTop: '8px',
  },
};
```

- [ ] **Step 2: Verify it builds**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/PublicBookDetail.tsx
git commit -m "feat: add read-only PublicBookDetail overlay for the public library page"
```

---

### Task 10: `PublicLibrary.tsx` — hero/header + Catalogue view

**Files:**
- Create: `src/components/PublicLibrary.tsx`

**Interfaces:**
- Consumes: `Book` type, `Shelf` type (`@/lib/hooks/useLocations`), `normalizeQuery`/`bookMatchesQuery` (`@/lib/bookSearch`), `PublicBookCard` (Task 8), `PublicBookDetail` (Task 9), `SearchPill` (`@/components/SearchPill`), `TextAnimate`/`Highlight` (`@/registry/magicui/text-animate`), `useIsMobile` (`@/hooks/useIsMobile`).
- Produces: `<PublicLibrary books={Book[]} shelves={Shelf[]} accentColor={string} />` default export. Consumed by `src/app/share/[token]/page.tsx` (Task 12). This task builds Catalogue view only; Task 11 adds the Locations toggle on top of this file.

- [ ] **Step 1: Create the component (Catalogue view + hero/header search)**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book } from '@/components/BookModal';
import { Shelf } from '@/lib/hooks/useLocations';
import { normalizeQuery, bookMatchesQuery } from '@/lib/bookSearch';
import PublicBookCard from '@/components/PublicBookCard';
import PublicBookDetail from '@/components/PublicBookDetail';
import SearchPill from '@/components/SearchPill';
import { TextAnimate } from '@/registry/magicui/text-animate';
import { useIsMobile } from '@/hooks/useIsMobile';

/** Mirrors Dashboard.tsx's identically-named helper: closes a search pill on outside click. */
function useCloseOnOutsideClick(active: boolean, wrapperId: string, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const wrapper = document.getElementById(wrapperId);
      if (wrapper && !wrapper.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [active, wrapperId, onClose]);
}

interface PublicLibraryProps {
  books: Book[];
  shelves: Shelf[];
  accentColor: string;
}

export default function PublicLibrary({ books, accentColor }: PublicLibraryProps) {
  const isMobile = useIsMobile();
  const [isSearching, setIsSearching] = useState(false);
  const [isHeaderSearching, setIsHeaderSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-primary', accentColor);
  }, [accentColor]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(prev => {
        if (!prev && window.scrollY >= 150) return true;
        if (prev && window.scrollY <= 30) return false;
        return prev;
      });
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useCloseOnOutsideClick(isSearching, 'public-hero-search-wrapper', () => setIsSearching(false));
  useCloseOnOutsideClick(isHeaderSearching, 'public-header-search-wrapper', () => setIsHeaderSearching(false));

  const commitSearch = () => {
    setCommittedQuery(searchQuery);
    setHasSearched(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCommittedQuery('');
  };

  const appliedQuery = (isSearching || isHeaderSearching) ? searchQuery : committedQuery;
  const displayedBooks = books.filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery)));
  const displayLabel = `${displayedBooks.length} book${displayedBooks.length === 1 ? '' : 's'}`;
  const headerCompact = isScrolled;

  const searchContent = (
    <h1 className="display-serif hero-title-mobile" style={{ ...styles.heroTitle, whiteSpace: 'normal' }}>
      <span id="public-hero-search-wrapper" style={{ display: 'inline' }}>
        <SearchPill
          id="public-hero-search-pill"
          value={searchQuery}
          onChange={setSearchQuery}
          onEnter={() => { commitSearch(); setIsSearching(false); }}
          onEscape={() => setIsSearching(false)}
          onClear={clearSearch}
          floatClearButton
          active={isSearching}
        />
      </span>
      <span style={{ filter: 'blur(5px)', opacity: 0.4, transition: 'all 0.5s ease', display: 'inline', marginLeft: '12px' }}>
        for the books in this library.
        <br />
        Currently showing{' '}
        <span className="hover-wavy-underline" style={{ color: 'var(--accent-primary)', textUnderlineOffset: '6px', fontStyle: 'italic' }}>
          {displayLabel}
        </span>.
      </span>
    </h1>
  );

  const staticContent = (
    <TextAnimate
      animation="blurIn"
      by="word"
      as="h1"
      className="display-serif hero-title-mobile"
      style={{ ...styles.heroTitle, whiteSpace: 'normal' }}
      highlights={[
        {
          match: 'Search',
          onClick: () => { setIsSearching(true); setHasSearched(true); },
          badge: !!committedQuery,
        },
      ]}
      disableAnimation={hasSearched}
    >
      {`Welcome to my library. Search to find books.\nCurrently showing ${displayLabel}.`}
    </TextAnimate>
  );

  return (
    <div className="page-container" style={styles.frame}>
      <header style={styles.header} className="app-header">
        <motion.div
          className="desktop-header-row"
          style={styles.headerContent}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
        >
          <div style={styles.logoSlot}>
            <AnimatePresence mode="wait">
              {isHeaderSearching ? (
                <motion.div
                  key="public-header-search-pill"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                >
                  <SearchPill
                    id="public-header-search-wrapper"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onEnter={() => { commitSearch(); setIsHeaderSearching(false); }}
                    onEscape={() => setIsHeaderSearching(false)}
                    onClear={clearSearch}
                    fontSize={32}
                    autoFocus
                  />
                </motion.div>
              ) : headerCompact ? (
                <motion.button
                  key="public-header-search-trigger"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  onClick={() => committedQuery ? clearSearch() : setIsHeaderSearching(true)}
                  className="hover-wavy-underline"
                  style={styles.headerSearchTrigger}
                >
                  {committedQuery ? 'Clear search' : 'Search to find books'}
                </motion.button>
              ) : (
                <motion.h1
                  key="public-header-title"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  className="display-serif"
                  style={styles.logo}
                >
                  Welcome to my library
                </motion.h1>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </header>

      <main style={styles.main}>
        <section style={styles.heroSection}>
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%',
              opacity: isSearching ? 1 : 0,
              filter: isSearching ? 'blur(0px)' : 'blur(10px)',
              pointerEvents: isSearching ? 'auto' : 'none',
              transition: 'opacity 0.6s ease, filter 0.6s ease',
            }}>
              {searchContent}
            </div>
            <div style={{
              opacity: isSearching ? 0 : 1,
              filter: isSearching ? 'blur(10px)' : 'blur(0px)',
              pointerEvents: isSearching ? 'none' : 'auto',
              transition: 'opacity 0.6s ease, filter 0.6s ease',
            }}>
              {staticContent}
            </div>
          </div>
        </section>

        <motion.div style={styles.booksSection}>
          <div style={styles.booksGrid} className="books-grid">
            <AnimatePresence>
              {displayedBooks.map((book) => (
                <motion.div
                  key={book.id}
                  layout
                  initial={{ opacity: 0, y: 35, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: 35, filter: 'blur(0px)' }}
                  transition={{ duration: 0.3 }}
                >
                  <PublicBookCard book={book} onClick={setSelectedBook} isMobile={isMobile} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>

      <AnimatePresence>
        {selectedBook && (
          <PublicBookDetail book={selectedBook} onClose={() => setSelectedBook(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    width: '100%',
    background: 'linear-gradient(to bottom, var(--bg-primary) 65%, rgba(244, 242, 228, 0.9) 80%, rgba(244, 242, 228, 0.6) 90%, rgba(244, 242, 228, 0.2) 97%, rgba(244, 242, 228, 0) 100%)',
    padding: '36px 40px 40px 40px',
  },
  headerContent: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: '8px',
    marginBottom: '12px',
  },
  logoSlot: {
    textAlign: 'center',
  },
  logo: {
    display: 'inline-block',
    fontSize: '2.5rem',
    color: 'var(--accent-primary)',
    fontWeight: 'normal',
    textAlign: 'center',
    margin: 0,
  },
  headerSearchTrigger: {
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
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  heroSection: {
    width: '100%',
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    transform: 'translateY(-134px)',
  },
  heroTitle: {
    fontSize: '32px',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
    fontWeight: 'normal',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  booksSection: {
    width: '95%',
    maxWidth: '1400px',
    marginTop: '-190px',
    paddingTop: '40px',
  },
  booksGrid: {
    display: 'grid',
    width: '100%',
    paddingBottom: '24px',
  },
};
```

- [ ] **Step 2: Verify it builds**

Run: `bun run build`
Expected: build succeeds. (Not mounted anywhere yet — Task 12 renders it.)

- [ ] **Step 3: Commit**

```bash
git add src/components/PublicLibrary.tsx
git commit -m "feat: add PublicLibrary Catalogue view with hero search"
```

---

### Task 11: `PublicLibrary.tsx` — Locations view + toggle

**Files:**
- Modify: `src/components/PublicLibrary.tsx`

**Interfaces:**
- Consumes: `groupBooksByRoom` (`@/lib/bookGrouping`, Task 4).
- Produces: extends `PublicLibrary` with a Catalogue/Locations pill toggle in the position the scan FAB occupies in `Dashboard.tsx` (bottom-right, visible once `headerCompact`).

- [ ] **Step 1: Add view state and the grouped-by-room render path**

Add to the imports: `import { groupBooksByRoom } from '@/lib/bookGrouping';`

Add state (near the other `useState` calls): `const [view, setView] = useState<'catalogue' | 'locations'>('catalogue');` and `const [activeRoom, setActiveRoom] = useState<string | null>(null);`

Compute the distinct rooms — from both `books` (so rooms with catalogued books show up) and `shelves` (so a room with shelves but zero catalogued books still appears in the Locations list) — and, when `activeRoom` is set, the grouping:

```ts
  const rooms = Array.from(new Set([
    ...books.map(b => b.location?.room).filter((r): r is string => Boolean(r)),
    ...shelves.map(s => s.room),
  ]));
  const roomGrouping = activeRoom ? groupBooksByRoom(books, activeRoom) : null;
```

This uses the `shelves` prop (received but otherwise unused by `PublicLibrary` — Task 10 destructured only `books, accentColor`), so also change the destructure at the top of the component from `{ books, accentColor }` to `{ books, shelves, accentColor }`.

Update `displayLabel` to reflect the active room when one is selected:

```ts
  const displayLabel = activeRoom
    ? `Books in ${activeRoom}`
    : `${displayedBooks.length} book${displayedBooks.length === 1 ? '' : 's'}`;
```

Replace the single `<div style={styles.booksGrid}>` block (from Task 10, Step 1) with a conditional: Catalogue view keeps rendering `displayedBooks` as before; Locations view with no `activeRoom` selected renders a list of room names to drill into; Locations view with `activeRoom` set renders the room's books grouped by shelf (reusing `roomGrouping`), filtered by `appliedQuery`.

```tsx
        <motion.div style={styles.booksSection}>
          {view === 'catalogue' ? (
            <div style={styles.booksGrid} className="books-grid">
              <AnimatePresence>
                {displayedBooks.map((book) => (
                  <motion.div
                    key={book.id}
                    layout
                    initial={{ opacity: 0, y: 35, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: 35, filter: 'blur(0px)' }}
                    transition={{ duration: 0.3 }}
                  >
                    <PublicBookCard book={book} onClick={setSelectedBook} isMobile={isMobile} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : activeRoom === null ? (
            <div style={styles.roomList}>
              {rooms.map((room) => (
                <button key={room} onClick={() => setActiveRoom(room)} style={styles.roomRow}>
                  {room}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button onClick={() => setActiveRoom(null)} style={styles.backLink}>← All rooms</button>
              {roomGrouping!.bookshelves.map((shelf) => {
                const shelfBooks = roomGrouping!.booksByShelf[shelf].filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery)));
                if (shelfBooks.length === 0) return null;
                return (
                  <div key={shelf} style={styles.shelfSection}>
                    <div style={styles.shelfHeaderWrapper}>
                      <div style={styles.shelfHeaderLine} />
                      <h2 style={styles.shelfHeading}>Books on {shelf}</h2>
                      <div style={styles.shelfHeaderLine} />
                    </div>
                    <div style={styles.booksGrid} className="books-grid">
                      {shelfBooks.map((book) => (
                        <PublicBookCard key={book.id} book={book} onClick={setSelectedBook} isMobile={isMobile} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {roomGrouping!.unassignedBooks.filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery))).length > 0 && (
                <div style={styles.shelfSection}>
                  <div style={styles.shelfHeaderWrapper}>
                    <div style={styles.shelfHeaderLine} />
                    <h2 style={styles.shelfHeading}>Other books in {activeRoom}</h2>
                    <div style={styles.shelfHeaderLine} />
                  </div>
                  <div style={styles.booksGrid} className="books-grid">
                    {roomGrouping!.unassignedBooks.filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery))).map((book) => (
                      <PublicBookCard key={book.id} book={book} onClick={setSelectedBook} isMobile={isMobile} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
```

- [ ] **Step 2: Add the Catalogue/Locations toggle pill**

Add this JSX right before the closing `<AnimatePresence>{selectedBook && ...}</AnimatePresence>` block, replacing where a scan FAB would sit in `Dashboard.tsx`:

```tsx
      <AnimatePresence>
        {headerCompact && (
          <motion.div
            key="view-toggle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={styles.viewToggle}
          >
            <button
              onClick={() => { setView('catalogue'); setActiveRoom(null); }}
              style={{ ...styles.viewToggleBtn, ...(view === 'catalogue' ? styles.viewToggleBtnActive : {}) }}
            >
              Catalogue
            </button>
            <button
              onClick={() => setView('locations')}
              style={{ ...styles.viewToggleBtn, ...(view === 'locations' ? styles.viewToggleBtnActive : {}) }}
            >
              Locations
            </button>
          </motion.div>
        )}
      </AnimatePresence>
```

- [ ] **Step 3: Add the new styles**

Append to the `styles` object at the bottom of the file:

```ts
  viewToggle: {
    position: 'fixed',
    right: '32px',
    bottom: '32px',
    display: 'flex',
    backgroundColor: 'var(--bg-sheet)',
    borderRadius: '9999px',
    boxShadow: '0 4px 16px rgba(17, 22, 37, 0.18)',
    padding: '4px',
    zIndex: 1000,
  },
  viewToggleBtn: {
    background: 'none',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '9999px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  viewToggleBtnActive: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--bg-sheet)',
  },
  roomList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxWidth: '480px',
    margin: '0 auto',
  },
  roomRow: {
    background: 'none',
    border: 'none',
    borderBottom: '1px dashed rgba(17, 22, 37, 0.15)',
    padding: '16px 8px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '1.1rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    marginBottom: '24px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  shelfSection: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    marginBottom: '16px',
  },
  shelfHeaderWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '48px',
    marginBottom: '32px',
    width: '100%',
  },
  shelfHeaderLine: {
    flexGrow: 1,
    height: '1px',
    borderBottom: '1px dashed rgba(17, 22, 37, 0.15)',
  },
  shelfHeading: {
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    paddingLeft: '16px',
    paddingRight: '16px',
    whiteSpace: 'nowrap',
    opacity: 0.85,
  },
```

- [ ] **Step 4: Verify it builds**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/PublicLibrary.tsx
git commit -m "feat: add Catalogue/Locations toggle to PublicLibrary"
```

---

### Task 12: `/share/[token]` public page

**Files:**
- Create: `src/app/share/[token]/page.tsx`

**Interfaces:**
- Consumes: `createAdminClient` (`@/lib/supabase/admin`, Task 2), `PublicLibrary` (`@/components/PublicLibrary`, Tasks 10-11).
- Produces: the public route itself — the final integration point of this feature.

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import PublicLibrary from '@/components/PublicLibrary';
import { Book } from '@/components/BookModal';
import { Shelf } from '@/lib/hooks/useLocations';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, theme_color, share_enabled')
    .eq('share_token', token)
    .maybeSingle();

  if (!profile || !profile.share_enabled) {
    notFound();
  }

  const { data: booksData } = await supabase
    .from('books')
    .select('*, location:location_id(room, bookshelf)')
    .eq('user_id', profile.user_id);

  const { data: shelvesData } = await supabase
    .from('shelves')
    .select('id, room, bookshelf')
    .eq('user_id', profile.user_id)
    .order('room');

  const books: Book[] = (booksData || []).map((b) => ({
    id: b.id,
    title: b.title,
    authors: b.authors || [],
    isbn: b.isbn,
    publisher: b.publisher,
    published_date: b.published_date,
    description: b.description,
    cover_url: b.cover_url,
    location: b.location ? { room: b.location.room, bookshelf: b.location.bookshelf } : null,
    status: b.status,
    favorite: b.favorite,
    notes: b.notes,
    genres: b.genres || [],
  }));

  const shelves: Shelf[] = shelvesData || [];

  return (
    <PublicLibrary
      books={books}
      shelves={shelves}
      accentColor={profile.theme_color || '#002CBC'}
    />
  );
}
```

- [ ] **Step 2: Verify end-to-end**

Run: `bun dev`, log in as a real user with at least a few books across two rooms.
1. Open "Share Library" → toggle sharing on → copy the link.
2. Open the link in a private/incognito window. Expected: the public page loads, no login prompt, header reads "Welcome to my library", grid shows the same books as the dashboard.
3. Click "Search" in the hero → type part of a title → Enter. Expected: grid filters, "Currently showing N books" updates.
4. Scroll down. Expected: header collapses to the italic "Search to find books" trigger, and the Catalogue/Locations pill toggle appears bottom-right.
5. Click "Locations" → click into a room → confirm books grouped by shelf, with an "← All rooms" link back.
6. Click a book cover → confirm `PublicBookDetail` opens (cover, title, authors, status, location) with no edit/delete/favorite controls anywhere.
7. Confirm there is no scan FAB, no filter panel, no account menu, no "Manage Locations" anywhere on this page.
8. Back in the owner's session, disable sharing → refresh the incognito tab → expected 404.
9. Re-enable sharing (without regenerating) → refresh the same incognito tab (same old URL) → expected the page loads again (token preserved across disable/enable, per Task 5's `enable` branch keeping the existing token).
10. Regenerate the link → refresh the incognito tab on the *old* URL → expected 404. Open the *new* URL from the modal → expected it loads.

- [ ] **Step 3: Commit**

```bash
git add src/app/share/[token]/page.tsx
git commit -m "feat: add public /share/[token] page rendering PublicLibrary"
```

---

### Task 13: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `bun run build`
Expected: succeeds with no type errors across all new/modified files.

- [ ] **Step 2: Lint**

Run: `bun run lint`
Expected: no new lint errors introduced by this feature's files.

- [ ] **Step 3: Re-run the full spec verification checklist**

Walk through all 10 items in the "Testing / verification" section of `docs/superpowers/specs/2026-07-15-public-share-library-design.md` end to end via `bun dev`, using both a desktop-width and mobile-width (device toolbar) browser window, and both the `AccountMenu` and `MobileMenu` entry points.

- [ ] **Step 4: Vercel preview deploy check**

If the project has a Vercel integration connected to this branch/PR, confirm `SUPABASE_SERVICE_ROLE_KEY` is set in the Vercel project's environment variables (Project Settings → Environment Variables), then push and confirm the `/share/[token]` route works identically on the preview deployment as it does locally.
