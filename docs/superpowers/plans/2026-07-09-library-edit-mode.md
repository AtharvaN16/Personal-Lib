# Library Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-select Edit Mode to the Books screen (`Dashboard.tsx`) so the user can bulk-move or bulk-delete books, reusing the existing cozy-journal design system end-to-end.

**Architecture:** All new state (`isEditMode`, `selectedBookIds`, confirm/modal flags) lives in `Dashboard.tsx`, the existing single source of truth for book/UI state. A derived `headerCompact = isScrolled || isEditMode` boolean is threaded through the header's existing `isScrolled`-driven conditionals so the header visually locks into its compact state while editing. `BookCard` becomes selection-aware via new props. The Scan FAB's existing `AnimatePresence` block gains two siblings (Delete/Move) driven by selection count. A new `BulkMoveModal` component clones `AddLocationModal`'s shell with `BookModal`'s cascading room/shelf select. No schema changes — bulk Supabase calls use `.in('id', ids)` against the existing RLS-scoped tables.

**Tech Stack:** Next.js (App Router) + React 19, framer-motion, Supabase JS client, vanilla CSS. No test framework in this repo — verification is `bun run lint`, `npx tsc --noEmit`, and manual browser checks via `bun dev`, per this project's own AGENTS.md guidance for UI work.

## Global Constraints

- Do not redesign the Library screen, grid, or typography — reuse existing components/styles wherever the spec calls for it.
- No new icon library — FAB icons stay hand-rolled inline SVG matching the existing Scan FAB's stroke style (`stroke="var(--accent-primary)"`, `strokeWidth={1.75}`, `strokeLinecap="round"`, `strokeLinejoin="round"`).
- No schema/migration changes.
- Reuse `styles.scanFab`, `BookModal`'s `confirmDeleteRow` pattern, and `AddLocationModal`'s modal shell exactly as documented in the spec — don't introduce new visual patterns for the same purpose.
- Every new interactive element needs the same focus/`Escape`/backdrop-click/body-scroll-lock handling already present in `BookModal`/`AddLocationModal` where applicable (i.e. `BulkMoveModal`).

---

## File Structure

- **Modify `src/components/Dashboard.tsx`**: new state (`isEditMode`, `selectedBookIds`, `isDeleteConfirming`, `isBulkMoveOpen`), `headerCompact` derived value, header right-nav swap (Logout ↔ Edit ↔ Done), mobile hamburger-slot swap (hamburger ↔ pencil ↔ checkmark), FAB block (Scan ↔ Delete+Move), inline delete-confirm card, `BulkMoveModal` wiring, `handleBulkDelete`/`handleBulkMove` handlers, `BookCard` prop wiring, new style entries.
- **Modify `src/components/Dashboard.tsx`'s `BookCard` function**: `editMode`/`selected`/`onToggleSelect` props, click behavior, selection ring + checkmark badge.
- **Create `src/components/BulkMoveModal.tsx`**: standalone modal for picking a destination room/shelf and applying it to N books, visually cloned from `AddLocationModal`.
- **No changes to `MobileMenu.tsx`** — confirmed out of scope per the latest spec revision (edit trigger lives in the header icon row, not the hamburger menu).

---

### Task 1: Edit Mode state, `headerCompact`, and desktop right-nav swap

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Produces: `isEditMode: boolean`, `setIsEditMode`, `selectedBookIds: Set<string>`, `setSelectedBookIds`, `headerCompact: boolean`, `enterEditMode(): void`, `exitEditMode(): void` — all consumed by later tasks.

- [ ] **Step 1: Add Edit Mode state and helpers**

In `src/components/Dashboard.tsx`, find this block (around line 159-162):

```tsx
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const isMobile = useIsMobile();
```

Replace it with:

```tsx
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const isMobile = useIsMobile();

  // The header visually locks into its compact/scrolled appearance while editing — regardless of
  // actual scroll position — so Edit Mode's "Done" trigger and the compact title/nav stay put
  // until the user explicitly exits, instead of flickering back to the expanded header on scroll.
  const headerCompact = isScrolled || isEditMode;

  const enterEditMode = () => setIsEditMode(true);

  const exitEditMode = () => {
    setIsEditMode(false);
    setSelectedBookIds(new Set());
    setIsDeleteConfirming(false);
  };

  const toggleBookSelected = (id: string) => {
    setSelectedBookIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
```

- [ ] **Step 2: Replace every JSX use of bare `isScrolled` in the header with `headerCompact`**

Three spots need `isScrolled` → `headerCompact` (do **not** touch `isScrolled` in `useScroll`/`useTransform`/the scroll-listener `useEffect` — those must keep tracking real scroll position):

**2a.** Around line 479, the `leftNav` `AnimatePresence` branch:

```tsx
              ) : !isScrolled ? (
                <motion.button
                  key="manage-locations"
```

becomes:

```tsx
              ) : !headerCompact ? (
                <motion.button
                  key="manage-locations"
```

**2b.** Around line 522, the `logoSlot` `AnimatePresence` branch:

```tsx
            <AnimatePresence mode="wait">
              {isScrolled || isHeaderSearching ? (
                <motion.div
                  key="header-actions"
```

becomes:

```tsx
            <AnimatePresence mode="wait">
              {headerCompact || isHeaderSearching ? (
                <motion.div
                  key="header-actions"
```

**2c.** Around line 572, the `mobile-header-row` `AnimatePresence` branch:

```tsx
          <AnimatePresence mode="wait">
            {isScrolled || isHeaderSearching || isMobileSearchOpen ? (
              <motion.h1
                key="mobile-logo-status"
```

becomes:

```tsx
          <AnimatePresence mode="wait">
            {headerCompact || isHeaderSearching || isMobileSearchOpen ? (
              <motion.h1
                key="mobile-logo-status"
```

- [ ] **Step 3: Add the `editModeTrigger` style**

In the `styles` object at the bottom of the file, find `rightNav` (around line 938-941):

```tsx
  rightNav: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
```

Add a new style entry immediately after it:

```tsx
  rightNav: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
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
  },
```

This is the exact style used by the header's existing `Search`/`Clear search` trigger (compare to the `header-search-trigger` button around line 493-514) — copied verbatim so `Edit`/`Done` are visually indistinguishable from it apart from label.

- [ ] **Step 4: Wire the right-nav swap (Logout ↔ Edit ↔ Done)**

Find (around line 565-567):

```tsx
          <div style={styles.rightNav}>
            <LogoutLink />
          </div>
```

Replace with:

```tsx
          <div style={styles.rightNav}>
            <AnimatePresence mode="wait">
              {isEditMode ? (
                <motion.button
                  key="edit-done"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  onClick={exitEditMode}
                  style={styles.editModeTrigger}
                >
                  Done
                </motion.button>
              ) : isScrolled ? (
                <motion.button
                  key="edit-trigger"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  onClick={enterEditMode}
                  style={styles.editModeTrigger}
                >
                  Edit
                </motion.button>
              ) : (
                <motion.div
                  key="logout-link"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                >
                  <LogoutLink />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
```

Note: this branch intentionally checks raw `isScrolled` (not `headerCompact`) for the `Edit` trigger — `Edit` should only appear once the user has actually scrolled, matching the spec table. Once `isEditMode` is true, the first branch wins regardless of scroll, so `Done` stays visible per `headerCompact`'s lock behavior.

- [ ] **Step 5: Verify — typecheck and lint**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && npx tsc --noEmit`
Expected: no errors.

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bun run lint`
Expected: no errors.

- [ ] **Step 6: Verify — manual browser check**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && bun dev` (leave running)

In the browser: scroll the Books page down past the hero. Confirm the right-nav shows `Edit` styled like the `Search` trigger (blue, italic serif, wavy underline). Click it — confirm it becomes `Done` and stays visible even when scrolling back to the top. Click `Done` — confirm it reverts to `Logout` once back at the top (or immediately, since `Done` already restored `isScrolled`'s natural read).

- [ ] **Step 7: Commit**

```bash
cd "/Users/atharvanayak/Developer/Personal Library"
git add src/components/Dashboard.tsx
git commit -m "feat: add Edit Mode state and desktop header Logout/Edit/Done swap"
```

---

### Task 2: Mobile header icon swap (hamburger ↔ edit ↔ done)

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `headerCompact`, `isEditMode`, `enterEditMode`, `exitEditMode` from Task 1.

- [ ] **Step 1: Replace the mobile hamburger button with a state-driven icon**

Find the mobile header actions block (around line 597-619):

```tsx
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
```

Replace with:

```tsx
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
            {isEditMode ? (
              <button
                className="mobile-icon-btn"
                onClick={exitEditMode}
                aria-label="Done editing"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            ) : headerCompact ? (
              <button
                className="mobile-icon-btn"
                onClick={enterEditMode}
                aria-label="Edit library"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            ) : (
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
            )}
          </div>
```

- [ ] **Step 2: Verify — typecheck and lint**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && npx tsc --noEmit && bun run lint`
Expected: no errors.

- [ ] **Step 3: Verify — manual browser check**

With `bun dev` running, resize the browser to a mobile width (≤640px). Confirm: at the top of the page, the second icon is the hamburger (opens the existing menu). Scroll down — confirm the hamburger swaps to a pencil icon; tapping it enters Edit Mode. While editing, confirm the same slot shows a checkmark; tapping it exits Edit Mode. Confirm the search icon is unaffected throughout.

- [ ] **Step 4: Commit**

```bash
cd "/Users/atharvanayak/Developer/Personal Library"
git add src/components/Dashboard.tsx
git commit -m "feat: swap mobile hamburger icon for edit/done in compact header state"
```

---

### Task 3: `BookCard` selection support

**Files:**
- Modify: `src/components/Dashboard.tsx` (`BookCard` function and its styles/props, plus the grid's `.map()` call)

**Interfaces:**
- Consumes: `isEditMode`, `selectedBookIds`, `toggleBookSelected` from Task 1.
- Produces: `BookCardProps` gains `editMode: boolean`, `selected: boolean`, `onToggleSelect: (id: string) => void`.

- [ ] **Step 1: Extend `BookCardProps` and the click/keydown handlers**

Find (around line 807-834):

```tsx
interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
}

function BookCard({ book, onClick }: BookCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isMobile = useIsMobile();

  const showMeta = isMobile || hovered;

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
```

Replace with:

```tsx
interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
  editMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

function BookCard({ book, onClick, editMode, selected, onToggleSelect }: BookCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isMobile = useIsMobile();

  const showMeta = isMobile || hovered;

  const handleActivate = () => {
    if (editMode) {
      onToggleSelect(book.id);
    } else {
      onClick(book);
    }
  };

  return (
    <div
      style={styles.cardContainer}
      className="book-card-container"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={editMode ? `${selected ? 'Deselect' : 'Select'} ${book.title}` : `Open ${book.title}`}
      aria-pressed={editMode ? selected : undefined}
    >
```

- [ ] **Step 2: Add the selection ring and checkmark badge to the cover wrapper**

Find the cover wrapper's `motion.div` (around line 837-864):

```tsx
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
```

Replace with:

```tsx
      <motion.div
        animate={{
          scale: hovered ? 1.04 : 1,
          boxShadow: hovered 
            ? '0 20px 30px rgba(17, 22, 37, 0.18)' 
            : '0 4px 12px rgba(17, 22, 37, 0.06)',
          outline: selected ? '3px solid var(--accent-primary)' : '3px solid transparent',
        }}
        transition={{ duration: 0.2 }}
        style={{ ...styles.coverWrapper, outlineOffset: '2px' }}
        className="book-card-cover"
      >
        {selected && (
          <div style={styles.selectionBadge}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFDFB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        {book.cover_url && !imgError ? (
```

- [ ] **Step 3: Add the `selectionBadge` style**

In the `styles` object, find `coverWrapper` (around line 1014-1020):

```tsx
  coverWrapper: {
    borderRadius: '0px',
    border: 'none',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-sheet)',
    position: 'relative',
  },
```

Add immediately after it:

```tsx
  coverWrapper: {
    borderRadius: '0px',
    border: 'none',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-sheet)',
    position: 'relative',
  },
  selectionBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.25)',
    zIndex: 2,
  },
```

- [ ] **Step 4: Wire the new props at the call site**

Find the grid's `.map()` (around line 674-677):

```tsx
                    <BookCard 
                      book={book} 
                      onClick={setSelectedBook} 
                    />
```

Replace with:

```tsx
                    <BookCard 
                      book={book} 
                      onClick={setSelectedBook} 
                      editMode={isEditMode}
                      selected={selectedBookIds.has(book.id)}
                      onToggleSelect={toggleBookSelected}
                    />
```

- [ ] **Step 5: Verify — typecheck and lint**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && npx tsc --noEmit && bun run lint`
Expected: no errors.

- [ ] **Step 6: Verify — manual browser check**

With Edit Mode active (from Task 1/2), click several book covers. Confirm: each tap toggles a blue ring + checkmark badge instead of opening the book detail modal, selection persists while scrolling, and clicking an already-selected card deselects it (ring/badge disappear). Confirm normal (non-edit) clicking still opens `BookModal` as before.

- [ ] **Step 7: Commit**

```bash
cd "/Users/atharvanayak/Developer/Personal Library"
git add src/components/Dashboard.tsx
git commit -m "feat: add multi-select toggling and selected-state visuals to BookCard"
```

---

### Task 4: FAB stack (Scan ↔ Delete + Move) and inline delete confirmation

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `isEditMode`, `selectedBookIds`, `isDeleteConfirming`, `setIsDeleteConfirming`, `isBulkMoveOpen`, `setIsBulkMoveOpen`, `exitEditMode` from Task 1; `books`, `setBooks`, `showToast`, `supabase` (already in scope).
- Produces: `handleBulkDelete(): Promise<void>` — used only within this task.

- [ ] **Step 1: Add the `handleBulkDelete` handler**

Find `handleDelete` (around line 283-292):

```tsx
  // Handle book deletion
  const handleDelete = async (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    setSelectedBook(null);

    try {
      await supabase.from('books').delete().eq('id', id);
    } catch {
      console.warn('Failed to delete book from Supabase');
    }
  };
```

Add immediately after it:

```tsx
  // Bulk-delete every currently selected book, then exit Edit Mode
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedBookIds);
    const count = ids.length;
    setBooks(prev => prev.filter(b => !selectedBookIds.has(b.id)));
    exitEditMode();
    showToast(`Deleted ${count} book${count === 1 ? '' : 's'}`);

    try {
      await supabase.from('books').delete().in('id', ids);
    } catch {
      console.warn('Failed to bulk delete books from Supabase');
    }
  };
```

- [ ] **Step 2: Replace the Scan FAB block with the 3-way FAB branch**

Find (around line 686-709):

```tsx
      {/* Scan FAB, only surfaces once the hero has scrolled out of view */}
      <AnimatePresence>
        {(isScrolled || isHeaderSearching) && (
          <motion.button
            key="scan-fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => setIsScanModalOpen(true)}
            aria-label="Scan a book"
            style={styles.scanFab}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <line x1="14" y1="14" x2="14" y2="21" />
              <line x1="21" y1="14" x2="21" y2="21" />
              <line x1="17.5" y1="14" x2="17.5" y2="21" />
              <line x1="14" y1="17.5" x2="21" y2="17.5" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
```

Replace with:

```tsx
      {/* Scan FAB (unchanged) until a selection exists in Edit Mode, then it swaps for Delete + Move */}
      <AnimatePresence>
        {(headerCompact || isHeaderSearching) && selectedBookIds.size === 0 && (
          <motion.button
            key="scan-fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => setIsScanModalOpen(true)}
            aria-label="Scan a book"
            style={styles.scanFab}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <line x1="14" y1="14" x2="14" y2="21" />
              <line x1="21" y1="14" x2="21" y2="21" />
              <line x1="17.5" y1="14" x2="17.5" y2="21" />
              <line x1="14" y1="17.5" x2="21" y2="17.5" />
            </svg>
          </motion.button>
        )}

        {isEditMode && selectedBookIds.size > 0 && (
          <motion.button
            key="delete-fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => setIsDeleteConfirming(true)}
            aria-label="Delete selected books"
            style={styles.scanFab}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </motion.button>
        )}

        {isEditMode && selectedBookIds.size > 0 && (
          <motion.button
            key="move-fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => setIsBulkMoveOpen(true)}
            aria-label="Move selected books"
            style={{ ...styles.scanFab, bottom: '104px' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="12" height="10" rx="1" />
              <path d="M17 7h4v4" />
              <path d="M21 7l-7 7" />
            </svg>
          </motion.button>
        )}

        {isDeleteConfirming && (
          <motion.div
            key="delete-confirm-card"
            initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            transition={{ duration: 0.2 }}
            style={styles.deleteConfirmCard}
          >
            <span style={styles.deleteConfirmText}>
              Delete {selectedBookIds.size} book{selectedBookIds.size === 1 ? '' : 's'}?
            </span>
            <div style={styles.deleteConfirmActions}>
              <button onClick={() => setIsDeleteConfirming(false)} style={styles.deleteConfirmCancelBtn}>
                Cancel
              </button>
              <button onClick={handleBulkDelete} style={styles.deleteConfirmDeleteBtn}>
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
```

Note: `bottom: '32px'` is already `styles.scanFab`'s default, so Delete (reusing `styles.scanFab` unmodified) lands in the original Scan slot, and Move overrides only `bottom` to stack 72px above it (56px button + 16px gap).

- [ ] **Step 3: Add the new FAB/confirm-card styles**

In the `styles` object, find `scanFab` (around line 942-957) and add these three entries immediately after its closing brace:

```tsx
  deleteConfirmCard: {
    position: 'fixed',
    right: '32px',
    bottom: '172px',
    backgroundColor: 'var(--bg-sheet)',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.18)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '220px',
    zIndex: 950,
  },
  deleteConfirmText: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  deleteConfirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  deleteConfirmCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  deleteConfirmDeleteBtn: {
    background: 'none',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    backgroundColor: 'var(--bg-sheet)',
    color: 'var(--error)',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
```

These are copied from `BookModal`'s `confirmDeleteText`/`confirmDeleteBtn`/`confirmCancelBtn` styles (`src/components/BookModal.tsx` lines ~652-677), per the spec's requirement to follow the existing per-book delete confirmation pattern.

- [ ] **Step 4: Verify — typecheck and lint**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && npx tsc --noEmit && bun run lint`
Expected: no errors.

- [ ] **Step 5: Verify — manual browser check**

With Edit Mode active, select one book. Confirm the Scan FAB smoothly disappears and Delete (bottom slot) + Move (stacked above) FABs fade/scale in. Deselect all books — confirm they fade out and Scan FAB returns. Re-select, click the Delete FAB — confirm the confirm card appears above the stack with correct count text. Click Cancel — card dismisses, selection untouched. Click Delete again, then confirm — books disappear from the grid, a toast shows "Deleted N books", and Edit Mode exits (right-nav/mobile icon revert, FABs revert to Scan-only state).

Reload the page afterward and confirm the deleted books are actually gone from Supabase (not just the local grid) — if using the mock-book fallback (no real Supabase connection), confirm at minimum that no console errors appear from the `.delete().in(...)` call.

- [ ] **Step 6: Commit**

```bash
cd "/Users/atharvanayak/Developer/Personal Library"
git add src/components/Dashboard.tsx
git commit -m "feat: add stacked Delete/Move FABs and bulk delete with inline confirmation"
```

---

### Task 5: `BulkMoveModal` component

**Files:**
- Create: `src/components/BulkMoveModal.tsx`

**Interfaces:**
- Produces: `export default function BulkMoveModal({ count, onClose, onApply }: BulkMoveModalProps)` where `BulkMoveModalProps = { count: number; onClose: () => void; onApply: (locationId: string, locationObj: { room: string; bookshelf: string } | null) => void }`. Consumed by Task 6.

- [ ] **Step 1: Create the component**

Create `src/components/BulkMoveModal.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface BulkMoveModalProps {
  count: number;
  onClose: () => void;
  onApply: (locationId: string, locationObj: { room: string; bookshelf: string } | null) => void;
}

export default function BulkMoveModal({ count, onClose, onApply }: BulkMoveModalProps) {
  const supabase = createClient();
  const [shelves, setShelves] = useState<{ id: string; room: string; bookshelf: string }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedShelfId, setSelectedShelfId] = useState('');
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus the panel on open, restore focus on close, trap Tab, close on Escape, prevent body scroll
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [onClose]);

  // Fetch all shelves on mount for the room/shelf dropdowns
  useEffect(() => {
    async function loadShelves() {
      try {
        const { data } = await supabase.from('shelves').select('id, room, bookshelf');
        if (data) setShelves(data);
      } catch {
        console.warn('Failed to load shelves list');
      }
    }
    loadShelves();
  }, [supabase]);

  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room)));
  const shelvesInRoom = shelves.filter(s => s.room === selectedRoom && s.bookshelf !== '');

  const handleApply = async () => {
    const selectedShelf = shelves.find(s => s.id === selectedShelfId);
    if (selectedShelf) {
      onApply(selectedShelf.id, { room: selectedShelf.room, bookshelf: selectedShelf.bookshelf });
      return;
    }

    if (!selectedRoom) return;

    // Room chosen without a specific shelf — find or create a "room only" entry (bookshelf: '')
    const roomOnlyShelf = shelves.find(s => s.room === selectedRoom && s.bookshelf === '');
    if (roomOnlyShelf) {
      onApply(roomOnlyShelf.id, { room: selectedRoom, bookshelf: '' });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('shelves')
        .insert([{ room: selectedRoom, bookshelf: '', user_id: user?.id }])
        .select();
      if (error) throw error;
      if (data && data[0]) {
        onApply(data[0].id, { room: selectedRoom, bookshelf: '' });
        return;
      }
    } catch {
      console.warn('Failed to save room-only location');
      onApply('', { room: selectedRoom, bookshelf: '' });
    } finally {
      setLoading(false);
    }
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
        aria-label="Move books"
        tabIndex={-1}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        style={{ ...styles.modal, outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
          CLOSE
        </button>

        <h2 style={styles.title}>Move {count} book{count === 1 ? '' : 's'}</h2>
        <p style={styles.subtitle}>Choose a destination room and shelf.</p>

        <div style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="bulk-move-room" style={styles.label}>Room</label>
            <select
              id="bulk-move-room"
              aria-label="Select room"
              value={selectedRoom}
              onChange={(e) => {
                setSelectedRoom(e.target.value);
                setSelectedShelfId('');
              }}
              style={styles.selectField}
              className="book-modal-select"
            >
              <option value="">-- Select Room --</option>
              {uniqueRooms.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {selectedRoom && (
            <div style={styles.inputGroup}>
              <label htmlFor="bulk-move-shelf" style={styles.label}>Shelf</label>
              <select
                id="bulk-move-shelf"
                aria-label="Select shelf"
                value={selectedShelfId}
                onChange={(e) => setSelectedShelfId(e.target.value)}
                style={styles.selectField}
                className="book-modal-select"
              >
                <option value="">Unassigned</option>
                {shelvesInRoom.map((s) => (
                  <option key={s.id} value={s.id}>{s.bookshelf}</option>
                ))}
              </select>
            </div>
          )}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={loading || !selectedRoom}
              style={{ ...styles.submitBtn, opacity: (loading || !selectedRoom) ? 0.6 : 1 }}
            >
              {loading ? 'Moving...' : 'Move'}
            </button>
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
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(17, 22, 37, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    width: '100%',
    maxWidth: '380px',
    backgroundColor: 'var(--bg-sheet)',
    padding: '28px 24px 24px 24px',
    position: 'relative',
    maxHeight: '90vh',
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
    transition: 'color 0.2s ease',
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  selectField: {
    padding: '8px 12px',
    border: '1px solid rgba(17, 22, 37, 0.12)',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: '#FFFFFF',
    color: 'var(--text-primary)',
    boxShadow: 'none',
    outline: 'none',
    width: '100%',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '16px',
    marginTop: '10px',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    transition: 'transform 0.2s ease',
  },
};
```

- [ ] **Step 2: Verify — typecheck and lint**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && npx tsc --noEmit && bun run lint`
Expected: no errors. (The component isn't imported anywhere yet, so this only validates the file's own correctness — Task 6 wires it in.)

- [ ] **Step 3: Commit**

```bash
cd "/Users/atharvanayak/Developer/Personal Library"
git add src/components/BulkMoveModal.tsx
git commit -m "feat: add BulkMoveModal component for bulk location changes"
```

---

### Task 6: Wire `BulkMoveModal` into `Dashboard`

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `BulkMoveModal` from Task 5; `isBulkMoveOpen`, `setIsBulkMoveOpen`, `selectedBookIds`, `exitEditMode`, `books`, `setBooks`, `showToast`, `supabase` (all already in scope from earlier tasks).

- [ ] **Step 1: Import `BulkMoveModal`**

Find the import block at the top of `src/components/Dashboard.tsx` (around line 6-9):

```tsx
import LogoutLink from '@/components/LogoutLink';
import BookCardModal, { Book } from '@/components/BookModal';
import ManageLocationsModal from '@/components/ManageLocationsModal';
import ScanBookModal from '@/components/ScanBookModal';
```

Add `BulkMoveModal` to the import list:

```tsx
import LogoutLink from '@/components/LogoutLink';
import BookCardModal, { Book } from '@/components/BookModal';
import ManageLocationsModal from '@/components/ManageLocationsModal';
import ScanBookModal from '@/components/ScanBookModal';
import BulkMoveModal from '@/components/BulkMoveModal';
```

- [ ] **Step 2: Add the `handleBulkMove` handler**

Find `handleLocationChange` (around line 294-311, the exact line numbers will have shifted slightly after Task 4's additions — search for the function by name):

```tsx
  // Handle location picker update inside BookModal
  const handleLocationChange = async (
    bookId: string, 
    locationId: string, 
    locationObj: { room: string; bookshelf: string } | null
  ) => {
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, location: locationObj } : b));
    if (selectedBook && selectedBook.id === bookId) {
      setSelectedBook(prev => prev ? { ...prev, location: locationObj } : null);
    }

    try {
      const locationIdVal = locationId === '' || locationId === 'unassigned' ? null : locationId;
      await supabase.from('books').update({ location_id: locationIdVal }).eq('id', bookId);
    } catch {
      console.warn('Failed to update book location in database');
    }
  };
```

Add immediately after it:

```tsx
  // Bulk-apply a destination location to every currently selected book, then exit Edit Mode
  const handleBulkMove = async (locationId: string, locationObj: { room: string; bookshelf: string } | null) => {
    const ids = Array.from(selectedBookIds);
    const count = ids.length;
    setBooks(prev => prev.map(b => selectedBookIds.has(b.id) ? { ...b, location: locationObj } : b));
    setIsBulkMoveOpen(false);
    exitEditMode();
    showToast(`Moved ${count} book${count === 1 ? '' : 's'} to ${locationObj?.room ?? 'Unassigned'}`);

    try {
      const locationIdVal = locationId === '' ? null : locationId;
      await supabase.from('books').update({ location_id: locationIdVal }).in('id', ids);
    } catch {
      console.warn('Failed to bulk update book locations in database');
    }
  };
```

- [ ] **Step 3: Render `BulkMoveModal` in the modal `AnimatePresence` block**

Find the `isScanModalOpen` block inside the main modal `AnimatePresence` (search for `isScanModalOpen &&` — it renders `ScanBookModal`). Add the `BulkMoveModal` render immediately after that block closes, still inside the same `AnimatePresence`:

```tsx
        {isScanModalOpen && (
          <ScanBookModal
            onClose={() => setIsScanModalOpen(false)}
            books={books}
            showToast={showToast}
            onBookAdded={(newBook) => {
              setBooks(prev => [newBook, ...prev]);
              setIsScanModalOpen(false);
              showToast(`Added "${newBook.title}" to your library`);
            }}
          />
        )}
        {isBulkMoveOpen && (
          <BulkMoveModal
            count={selectedBookIds.size}
            onClose={() => setIsBulkMoveOpen(false)}
            onApply={handleBulkMove}
          />
        )}
```

- [ ] **Step 4: Verify — typecheck and lint**

Run: `cd "/Users/atharvanayak/Developer/Personal Library" && npx tsc --noEmit && bun run lint`
Expected: no errors.

- [ ] **Step 5: Verify — manual browser check**

With Edit Mode active, select 2-3 books, click the Move FAB. Confirm `BulkMoveModal` opens styled like `AddLocationModal` (same backdrop, sheet width, `CLOSE` button placement, animation). Pick a room, then a shelf, click `Move`. Confirm: the modal closes, a toast shows "Moved N books to <room>", the selected books' location updates in the grid/detail view, and Edit Mode exits (FABs revert to Scan-only, selection clears). Test the room-only case too (pick a room, leave shelf as "Unassigned", click Move) — confirm it doesn't error and applies a room-only location.

- [ ] **Step 6: Commit**

```bash
cd "/Users/atharvanayak/Developer/Personal Library"
git add src/components/Dashboard.tsx
git commit -m "feat: wire BulkMoveModal into Dashboard for bulk location moves"
```

---

## Post-Implementation Self-Review Notes (for the implementer)

- **Spec coverage:** Task 1 covers desktop header Logout/Edit/Done + `headerCompact` lock. Task 2 covers the mobile hamburger/edit/done icon swap. Task 3 covers multi-select + selected-state visuals + scroll persistence (persistence is automatic — it's just component state, no extra work needed). Task 4 covers the FAB stack animation and bulk delete + confirmation. Tasks 5-6 cover the Move modal and bulk move. Data-layer requirements (no schema changes, `.in()` bulk calls respecting RLS) are satisfied by Tasks 4 and 6's Supabase calls directly — no separate task needed since there's nothing to build.
- **No placeholders:** every step above contains complete, runnable code — no `TODO`/"handle appropriately" left for the implementer to invent.
- **Type consistency check:** `toggleBookSelected(id: string)` (Task 1) matches `onToggleSelect: (id: string) => void` (Task 3) and the call site `onToggleSelect(book.id)`. `handleBulkMove(locationId: string, locationObj: {...} | null)` (Task 6) matches `BulkMoveModalProps.onApply` (Task 5) and the call site `onApply(selectedShelf.id, {...})` / `onApply(roomOnlyShelf.id, {...})` / `onApply('', {...})`, all passing a `string` first arg and an object-or-null second arg.
