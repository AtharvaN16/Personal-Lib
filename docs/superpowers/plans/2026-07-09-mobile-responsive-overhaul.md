# Mobile Responsive Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the mobile (≤640px) experience of the Personal Library dashboard — header/nav becomes a hamburger menu, search becomes an icon-triggered full-width overlay, the hero animation and typography shrink, and modal close buttons/touch targets stop being clipped or too small — without changing any desktop (>640px) rendering or behavior.

**Architecture:** All new markup is additive — new mobile-only components are always mounted in the JSX tree but hidden above 640px via CSS (`display: none`), and the existing desktop header row is hidden below 640px via CSS. The one behavioral (non-visual) difference — routing the hero's "Search" tap to the new mobile overlay instead of the desktop inline-pill flow — is gated by a `useIsMobile()` hook reading `window.matchMedia('(max-width: 640px)')`, so above 640px the code path is identical to what ships today. Modal close-button repositioning and icon-button touch-target sizing reuse the codebase's existing pattern of pairing a `className` with an inline `style` object, adding a `@media (max-width: 640px)` CSS override (with `!important`, since inline `style` otherwise always wins over external CSS) for just the properties that must differ on mobile.

**Tech Stack:** Next.js (App Router) + Bun, React function components, `framer-motion` for animation, vanilla CSS in `src/app/globals.css` (no Tailwind), Supabase client already wired in `Dashboard.tsx`.

## Global Constraints

- Breakpoint: `max-width: 640px` (matches the existing `.book-modal-panel` mobile rule already in `globals.css`).
- Desktop (`>640px`) rendering and behavior must remain identical to `main`/`dev` before this work — verify with a visual side-by-side at the end.
- No new dependencies; use `framer-motion` (already installed) for all new animation.
- No test runner exists in this repo (`package.json` has no test script) — verification is manual, in-browser, at each task, plus `bun run build` / `bun run lint` passing.
- Follow the repo's existing modal pattern: `backdrop` = `rgba(17, 22, 37, 0.25)` + `blur(8px)`, `zIndex: 10000`, Escape-to-close + body scroll lock + focus trap + backdrop-click-to-close (see `src/components/FilterPanel.tsx:16-56` as the reference implementation).

---

### Task 1: `useIsMobile` hook

**Files:**
- Create: `src/hooks/useIsMobile.ts`

**Interfaces:**
- Produces: `useIsMobile(): boolean` — `true` when the viewport matches `(max-width: 640px)`, else `false`. Defaults to `false` on the server/initial render (no SSR mismatch risk since it only gates a click-handler branch, not visible markup).

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 640px)';

/** Tracks whether the viewport currently matches the app's mobile breakpoint (≤640px). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);

    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run lint`
Expected: no new errors referencing `useIsMobile.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useIsMobile.ts
git commit -m "feat: add useIsMobile hook for mobile-only behavior gating"
```

---

### Task 2: Extract `useLogout` hook, refactor `LogoutLink`

**Files:**
- Create: `src/hooks/useLogout.ts`
- Modify: `src/components/LogoutLink.tsx` (whole file — currently 36 lines)

**Interfaces:**
- Produces: `useLogout(): () => Promise<void>` — returns a `logout` callback that signs out of Supabase and navigates to `/login`. Consumed by both `LogoutLink` (Task 2) and `MobileMenu` (Task 3).

- [ ] **Step 1: Write the hook**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Signs out of Supabase and navigates back to /login. Shared by desktop LogoutLink and the mobile menu. */
export function useLogout() {
  const router = useRouter();
  const supabase = createClient();

  return async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };
}
```

- [ ] **Step 2: Refactor `LogoutLink.tsx` to use it (desktop output unchanged)**

```typescript
'use client';

import { useLogout } from '@/hooks/useLogout';

export default function LogoutLink() {
  const logout = useLogout();

  return (
    <button
      onClick={logout}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        fontFamily: 'var(--font-instrument-sans), sans-serif',
        fontSize: '1rem',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        transition: 'color 0.2s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
    >
      Logout
    </button>
  );
}
```

- [ ] **Step 3: Manually verify desktop logout still works**

Run: `bun dev`, open the app at a desktop width, click "Logout" in the header, confirm it signs out and redirects to `/login` exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLogout.ts src/components/LogoutLink.tsx
git commit -m "refactor: extract useLogout hook from LogoutLink for reuse in mobile menu"
```

---

### Task 3: `MobileMenu` component (hamburger dropdown)

**Files:**
- Create: `src/components/MobileMenu.tsx`

**Interfaces:**
- Consumes: `useLogout()` from Task 2.
- Produces: `<MobileMenu onClose={() => void} onManageLocations={() => void} />` — a default export, mounted by `Dashboard.tsx` (Task 6) as `{isMobileMenuOpen && <MobileMenu ... />}` inside the existing `<AnimatePresence>` block.

- [ ] **Step 1: Write the component**

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLogout } from '@/hooks/useLogout';

interface MobileMenuProps {
  onClose: () => void;
  onManageLocations: () => void;
}

/** Hamburger dropdown menu (mobile only): dimmed+blurred backdrop, links slide down underneath the header. */
export default function MobileMenu({ onClose, onManageLocations }: MobileMenuProps) {
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
        <button
          className="mobile-menu-row"
          onClick={() => {
            onManageLocations();
            onClose();
          }}
        >
          Manage Locations
        </button>
        <button
          className="mobile-menu-row"
          onClick={() => {
            logout();
            onClose();
          }}
        >
          Logout
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Add its CSS to `globals.css`** (append near the other mobile rules — see Task 5, which lands these together; if Task 5 hasn't run yet, add this block under the existing `@media (max-width: 640px)` section at the end of the file):

```css
.mobile-overlay-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(17, 22, 37, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  justify-content: center;
}

.mobile-menu-panel {
  width: 100%;
  max-width: 100%;
  margin-top: 110px; /* clears the fixed header */
  background: var(--bg-sheet);
  box-shadow: 0 12px 30px rgba(17, 22, 37, 0.15);
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.mobile-menu-row {
  display: flex;
  align-items: center;
  min-height: 56px;
  padding: 0 24px;
  background: none;
  border: none;
  text-align: left;
  font-family: var(--font-instrument-sans), sans-serif;
  font-size: 1.05rem;
  color: var(--text-primary);
  cursor: pointer;
}

.mobile-menu-row:active {
  background-color: var(--tag-bg);
}
```

- [ ] **Step 3: Manually verify in isolation**

This component isn't wired into `Dashboard.tsx` until Task 6 — defer functional verification to Task 6's manual check. For now just confirm: `bun run lint` passes with no errors in `MobileMenu.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/MobileMenu.tsx src/app/globals.css
git commit -m "feat: add MobileMenu hamburger dropdown component"
```

---

### Task 4: `MobileSearchOverlay` component

**Files:**
- Create: `src/components/MobileSearchOverlay.tsx`

**Interfaces:**
- Produces: `<MobileSearchOverlay value={string} onChange={(v: string) => void} onEnter={() => void} onClear={() => void} onClose={() => void} />` — default export, mounted by `Dashboard.tsx` (Task 6) as `{isMobileSearchOpen && <MobileSearchOverlay ... />}`.

- [ ] **Step 1: Write the component**

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface MobileSearchOverlayProps {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onClear: () => void;
  onClose: () => void;
}

/** Full-width search bar overlay (mobile only): dimmed+blurred backdrop, input on top, replaces the desktop inline search pill. */
export default function MobileSearchOverlay({ value, onChange, onEnter, onClear, onClose }: MobileSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="mobile-search-panel"
        initial={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
              onEnter();
            }
          }}
          placeholder="Search your library"
          className="mobile-search-input"
        />
        {value && (
          <button className="mobile-search-clear" onClick={onClear} aria-label="Clear search">
            ×
          </button>
        )}
        <button className="mobile-search-close" onClick={onClose} aria-label="Close search">
          Cancel
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Add its CSS to `globals.css`**

```css
.mobile-search-panel {
  width: 100%;
  margin-top: 90px; /* clears the fixed header */
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-sheet);
  box-shadow: 0 12px 30px rgba(17, 22, 37, 0.15);
}

.mobile-search-input {
  flex: 1;
  min-height: 44px;
  padding: 8px 14px;
  border: none;
  outline: none;
  border-radius: 8px;
  background: rgba(0, 44, 188, 0.06);
  font-family: var(--font-instrument-sans), sans-serif;
  font-size: 1rem;
  color: var(--accent-primary);
}

.mobile-search-clear {
  min-width: 44px;
  min-height: 44px;
  background: none;
  border: none;
  color: var(--accent-primary);
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
}

.mobile-search-close {
  min-height: 44px;
  padding: 0 4px;
  background: none;
  border: none;
  font-family: var(--font-instrument-sans), sans-serif;
  font-size: 0.95rem;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `bun run lint`
Expected: no new errors in `MobileSearchOverlay.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/MobileSearchOverlay.tsx src/app/globals.css
git commit -m "feat: add MobileSearchOverlay full-width search component"
```

---

### Task 5: Mobile CSS — header layout, hero sizing, typography, modal close buttons, touch targets

**Files:**
- Modify: `src/app/globals.css` (append a new block; the file currently ends at line ~293 with the `prefers-reduced-motion` rule from the existing `@media (max-width: 640px)` section — add these as new rules, reusing that same media query block or a new one further down)

**Interfaces:**
- Produces CSS classes consumed by Task 6 (`Dashboard.tsx`) and Task 7 (`HeroAnimation.tsx`) and Task 8 (modal components): `.desktop-header-row`, `.mobile-header-row`, `.mobile-logo`, `.mobile-header-actions`, `.mobile-icon-btn`, `.hero-animation-svg`, `.hero-title-mobile`, `.main-layout-mobile`, `.hero-container-mobile`, `.books-section-mobile`, `.modal-close-btn`.

- [ ] **Step 1: Append the following to `src/app/globals.css`**

```css
/* ---------------------------------------------------------------------- */
/* Mobile header: hamburger + MPL wordmark + search icon (≤640px only)    */
/* ---------------------------------------------------------------------- */

.mobile-header-row {
  display: none;
}

@media (max-width: 640px) {
  .desktop-header-row {
    display: none !important;
  }

  .mobile-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
}

.mobile-logo {
  font-size: 1.1rem;
  letter-spacing: -0.03em;
  font-weight: 600;
  color: var(--accent-primary);
  margin: 0;
}

.mobile-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mobile-icon-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  padding: 0;
}

/* ---------------------------------------------------------------------- */
/* Mobile hero: shrink the flipbook animation + tighten surrounding space */
/* ---------------------------------------------------------------------- */

@media (max-width: 640px) {
  .hero-animation-svg {
    width: 100px !important;
    height: 122px !important;
  }

  .hero-title-mobile {
    font-size: 20px !important;
    white-space: normal !important;
    padding: 0 12px;
  }

  .main-layout-mobile {
    padding: 110px 20px 0 20px !important;
  }

  .hero-container-mobile {
    height: auto !important;
    min-height: 60vh !important;
    transform: none !important;
    padding: 24px 0;
  }

  .books-section-mobile {
    margin-top: 0 !important;
  }
}

/* ---------------------------------------------------------------------- */
/* Mobile modal fixes: close button clipped off-screen, touch targets     */
/* ---------------------------------------------------------------------- */

@media (max-width: 640px) {
  /* Root cause: BookModal/FilterPanel/ScanBookModal/ManageLocationsModal position their close
     button at top: -36px relative to the panel, inside a backdrop with only 24px padding — that
     clips the button above the visible viewport on narrow screens. Move it inside the panel with
     a real touch target instead. */
  .modal-close-btn {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    width: 44px !important;
    height: 44px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
  }

  .icon-btn {
    width: 44px !important;
    height: 44px !important;
  }
}
```

- [ ] **Step 2: Verify the file is still valid CSS**

Run: `bun run build`
Expected: build succeeds (a malformed CSS block fails the Next.js build).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add mobile-only CSS for header, hero, typography, and modal touch targets"
```

---

### Task 6: Wire mobile header, menu, and search into `Dashboard.tsx`

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `useIsMobile()` (Task 1), `<MobileMenu onClose onManageLocations>` (Task 3), `<MobileSearchOverlay value onChange onEnter onClear onClose>` (Task 4), `.desktop-header-row` / `.mobile-header-row` / `.mobile-logo` / `.mobile-header-actions` / `.mobile-icon-btn` / `.hero-animation-svg` / `.hero-title-mobile` / `.main-layout-mobile` / `.hero-container-mobile` / `.books-section-mobile` (Task 5).

- [ ] **Step 1: Add imports**

At the top of `src/components/Dashboard.tsx`, alongside the existing imports (after the `SearchPill` import):

```typescript
import MobileMenu from '@/components/MobileMenu';
import MobileSearchOverlay from '@/components/MobileSearchOverlay';
import { useIsMobile } from '@/hooks/useIsMobile';
```

- [ ] **Step 2: Add mobile-only state and the `isMobile` flag**

Inside `Dashboard()`, next to the existing `useState` declarations (after `const [isScrolled, setIsScrolled] = useState(false);`):

```typescript
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const isMobile = useIsMobile();
```

- [ ] **Step 3: Include the mobile search overlay in the live-preview query check**

Find:

```typescript
  const appliedQuery = (isSearching || isHeaderSearching) ? searchQuery : committedQuery;
```

Replace with:

```typescript
  const appliedQuery = (isSearching || isHeaderSearching || isMobileSearchOpen) ? searchQuery : committedQuery;
```

- [ ] **Step 4: Route the hero's "Search" tap to the mobile overlay when on mobile**

Find (inside `staticContent`'s `highlights` array):

```typescript
        { match: 'Search', onClick: () => { setIsSearching(true); setHasSearched(true); }, badge: !!committedQuery },
```

Replace with:

```typescript
        {
          match: 'Search',
          onClick: () => {
            if (isMobile) {
              setIsMobileSearchOpen(true);
            } else {
              setIsSearching(true);
            }
            setHasSearched(true);
          },
          badge: !!committedQuery,
        },
```

- [ ] **Step 5: Mark the hero title elements for mobile font/spacing overrides**

There are three spots using `styles.heroTitle`. Add `hero-title-mobile` to each `className`:

Find (in `searchContent`):
```typescript
    <h1 className="display-serif" style={{ ...styles.heroTitle, whiteSpace: 'normal' }}>
```
Replace with:
```typescript
    <h1 className="display-serif hero-title-mobile" style={{ ...styles.heroTitle, whiteSpace: 'normal' }}>
```

Find (in `staticContent`, the `TextAnimate` for the hero):
```typescript
      className="display-serif"
      style={{ ...styles.heroTitle, whiteSpace: 'normal' }}
      highlights={[
```
Replace with:
```typescript
      className="display-serif hero-title-mobile"
      style={{ ...styles.heroTitle, whiteSpace: 'normal' }}
      highlights={[
```
(This is the second `TextAnimate` block, the one with `by="word"` — not the header's collapsed-state `TextAnimate`, which stays desktop-only inside `.desktop-header-row` and needs no mobile class.)

- [ ] **Step 6: Wrap the existing desktop header content, add the mobile header row**

Find:

```typescript
        <motion.div
          style={styles.headerContent}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.05, duration: 0.8, ease: 'easeOut' }}
        >
          <div style={styles.leftNav}>
```

Replace with:

```typescript
        <motion.div
          className="desktop-header-row"
          style={styles.headerContent}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.05, duration: 0.8, ease: 'easeOut' }}
        >
          <div style={styles.leftNav}>
```

Then find the closing of that same `motion.div` (right after the `rightNav` div and before `</header>`):

```typescript
          <div style={styles.rightNav}>
            <LogoutLink />
          </div>
        </motion.div>
      </header>
```

Replace with:

```typescript
          <div style={styles.rightNav}>
            <LogoutLink />
          </div>
        </motion.div>

        <div className="mobile-header-row">
          <AnimatePresence mode="wait">
            {isScrolled || isHeaderSearching || isMobileSearchOpen ? (
              <motion.h1
                key="mobile-logo-status"
                className="mobile-logo"
                initial={{ opacity: 0, filter: 'blur(6px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(6px)' }}
                transition={{ duration: 0.25 }}
              >
                {displayLabel}
              </motion.h1>
            ) : (
              <motion.h1
                key="mobile-logo-mpl"
                className="mobile-logo"
                initial={{ opacity: 0, filter: 'blur(6px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(6px)' }}
                transition={{ duration: 0.25 }}
              >
                MPL
              </motion.h1>
            )}
          </AnimatePresence>

          <div className="mobile-header-actions">
            <button
              className="mobile-icon-btn"
              onClick={() => setIsMobileSearchOpen(true)}
              aria-label="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            <button
              className="mobile-icon-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>
```

- [ ] **Step 7: Add mobile classNames to the layout containers**

Find:
```typescript
      <main style={styles.mainLayout}>
```
Replace with:
```typescript
      <main style={styles.mainLayout} className="main-layout-mobile">
```

Find:
```typescript
        <motion.div
          id="hero-search-container"
          style={{
            ...styles.heroContainer,
```
Replace with:
```typescript
        <motion.div
          id="hero-search-container"
          className="hero-container-mobile"
          style={{
            ...styles.heroContainer,
```

Find:
```typescript
        <motion.div 
          style={styles.booksSection}
          initial={{ opacity: 0, y: 50 }}
```
Replace with:
```typescript
        <motion.div 
          style={styles.booksSection}
          className="books-section-mobile"
          initial={{ opacity: 0, y: 50 }}
```

- [ ] **Step 8: Render `MobileMenu` and `MobileSearchOverlay` in the existing `AnimatePresence` block**

Find (the block that already renders `ManageLocationsModal`, `ScanBookModal`, `FilterPanel`):

```typescript
        {isFilterOpen && (
          <FilterPanel
            mode={filterMode}
            room={filterRoom}
            rooms={rooms}
            onApply={(mode, room) => {
              setFilterMode(mode);
              setFilterRoom(room);
            }}
            onClose={() => setIsFilterOpen(false)}
          />
        )}
      </AnimatePresence>
```

Replace with:

```typescript
        {isFilterOpen && (
          <FilterPanel
            mode={filterMode}
            room={filterRoom}
            rooms={rooms}
            onApply={(mode, room) => {
              setFilterMode(mode);
              setFilterRoom(room);
            }}
            onClose={() => setIsFilterOpen(false)}
          />
        )}
        {isMobileMenuOpen && (
          <MobileMenu
            onClose={() => setIsMobileMenuOpen(false)}
            onManageLocations={() => setIsManageLocationsOpen(true)}
          />
        )}
        {isMobileSearchOpen && (
          <MobileSearchOverlay
            value={searchQuery}
            onChange={setSearchQuery}
            onEnter={() => { commitSearch(); setIsMobileSearchOpen(false); }}
            onClear={clearSearch}
            onClose={() => setIsMobileSearchOpen(false)}
          />
        )}
      </AnimatePresence>
```

- [ ] **Step 9: Manually verify**

Run: `bun dev`, open in a browser, resize devtools to 375×667:
1. Confirm the desktop header (My Personal Library title, Manage Locations, Logout) is gone, replaced by "MPL" top-left and a search icon + hamburger top-right.
2. Tap the hamburger — confirm the backdrop dims/blurs, the panel slides down with "Manage Locations" and "Logout", each row is easily tappable, and it closes on backdrop tap / Escape / tapping a row (and that tapping "Manage Locations" actually opens that modal).
3. Tap the search icon — confirm the full-width search bar overlay appears with a blurred backdrop, typing + Enter filters the grid, "Cancel"/× close it.
4. Tap the "Search" word inside the hero sentence (before scrolling) — confirm it now opens the same mobile overlay instead of the old inline pill.
5. Resize back to a desktop width (e.g. 1440px) and confirm the header, search, and hero look and behave exactly as they did on `main` before this change.

Expected: all of the above pass with no console errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: wire mobile hamburger menu and search overlay into Dashboard header"
```

---

### Task 7: Shrink the hero animation SVG on mobile

**Files:**
- Modify: `src/components/HeroAnimation.tsx`

**Interfaces:**
- Consumes: `.hero-animation-svg` CSS class (Task 5).

- [ ] **Step 1: Add the className to the root `<svg>`**

Find:
```typescript
      <svg width="180" height="220" viewBox="0 0 415 506" fill="none" xmlns="http://www.w3.org/2000/svg">
```
Replace with:
```typescript
      <svg width="180" height="220" viewBox="0 0 415 506" fill="none" xmlns="http://www.w3.org/2000/svg" className="hero-animation-svg">
```

(The `width`/`height` HTML attributes stay as the desktop default — CSS in an external stylesheet always wins over presentational HTML attributes, so the `@media (max-width: 640px)` rule from Task 5 overrides them below 640px without touching this file's desktop values.)

- [ ] **Step 2: Manually verify**

At 375px viewport width, confirm the flipbook animation renders noticeably smaller (~100×122px) than desktop's 180×220px, and still plays its flip animation. At a desktop width, confirm it's unchanged at 180×220px.

- [ ] **Step 3: Commit**

```bash
git add src/components/HeroAnimation.tsx
git commit -m "feat: shrink hero animation SVG on mobile viewports"
```

---

### Task 8: Fix modal close-button clipping and touch targets

**Files:**
- Modify: `src/components/BookModal.tsx:261`
- Modify: `src/components/FilterPanel.tsx:93`
- Modify: `src/components/ScanBookModal.tsx:226`
- Modify: `src/components/ManageLocationsModal.tsx:219`
- Modify: `src/components/AddLocationModal.tsx:159`

**Interfaces:**
- Consumes: `.modal-close-btn` CSS class (Task 5).

- [ ] **Step 1: `BookModal.tsx` — add the className**

Find:
```typescript
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
```
Replace with:
```typescript
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
```

- [ ] **Step 2: `FilterPanel.tsx` — same edit**

Find:
```typescript
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
```
Replace with:
```typescript
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
```

- [ ] **Step 3: `ScanBookModal.tsx` — same edit**

Find:
```typescript
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
```
Replace with:
```typescript
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
```

- [ ] **Step 4: `ManageLocationsModal.tsx` — same edit**

Find:
```typescript
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
```
Replace with:
```typescript
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
```

- [ ] **Step 5: `AddLocationModal.tsx` — same edit (touch-target only; its close button is already inside the panel, so the mobile `top/right: 8px` override just nudges it slightly rather than fixing a clip)**

Find:
```typescript
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
```
Replace with:
```typescript
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
```

- [ ] **Step 6: Manually verify each modal at 375px width**

Open the app at 375×667, and for each of: a book card (BookModal), the filter panel (tap "Entire catalog"/status text in the hero), Scan (FAB), Manage Locations (via the new hamburger menu), and "+ Add Location" inside Manage Locations (AddLocationModal) — confirm the × / "CLOSE" control is visible on-screen, inside the card, and easily tappable (not clipped above the viewport).

Expected: all five close buttons visible and tappable.

- [ ] **Step 7: Commit**

```bash
git add src/components/BookModal.tsx src/components/FilterPanel.tsx src/components/ScanBookModal.tsx src/components/ManageLocationsModal.tsx src/components/AddLocationModal.tsx
git commit -m "fix: reposition modal close buttons on mobile so they're not clipped off-screen"
```

---

### Task 9: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full mobile walkthrough**

Run: `bun dev`. At 375×667 and 414×896 viewports, walk through: header (MPL + hamburger + search icon), hamburger menu open/close + Manage Locations + Logout, search icon → overlay → search → results → clear, hero animation size, scrolling behavior (header collapse/expand, FAB appearing), every modal's close button, and tapping around the book grid / icon buttons (favorite/complete/delete) for a real 44px+ feel.

- [ ] **Step 2: Full desktop regression pass**

At 1440px (and a mid-size e.g. 1024px, which is still `>640px` and must be untouched), confirm: header (My Personal Library, Manage Locations, Logout, scroll-collapse), hero search-in-sentence flow, hero animation at 180×220, modal close buttons at their original `-36px` position — all pixel-identical to `main` before this branch.

- [ ] **Step 3: Build and lint**

Run: `bun run build && bun run lint`
Expected: both succeed with no new errors or warnings.

- [ ] **Step 4: Commit any final fixups, then hand off**

```bash
git status
```

If clean, this branch is ready for the finishing-a-development-branch flow (merge/PR decision) — do not merge or push without the user's explicit go-ahead.

---
