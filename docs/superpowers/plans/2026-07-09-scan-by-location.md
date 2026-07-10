# Scan by Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "Scan by Location" mode to `ScanBookModal` that lets the user pick a default Room/Shelf once, then scan multiple books straight into an in-modal queue that auto-inherits that location, with cheap per-book overrides and individual/batch saving.

**Architecture:** `ScanBookModal.tsx` gains a `mode: 'single' | 'location'` state. `mode === 'location'` is handled by an early return that renders a self-contained queue UI (default-location strip, always-on scanner input, scrollable queue list, Save All), reusing the existing `runLookup`/`useHardwareScanner` machinery. The existing `mode === 'single'` flow (idle → loading → error → `BookModal`) is untouched except for one added entry-point link. A new presentational file, `ScanQueueRow.tsx`, renders one queue row.

**Tech Stack:** Next.js App Router, React (client components), Supabase JS client, framer-motion, Material Symbols icon font. No test runner is configured in this repo (`package.json` has no `test` script, no jest/vitest) — verification is `bun run lint`, `bun run build` (full TypeScript check across the app), and manual exercise via `bun dev`.

## Global Constraints

- Do not modify `src/components/BookModal.tsx` or `src/components/BulkMoveModal.tsx` — the existing single-scan and bulk-move flows must be byte-for-byte unaffected.
- No new colors, radii, fonts, or shadow values — every new style object copies exact values already used in `BookModal.tsx`, `BulkMoveModal.tsx`, or `ManageLocationsModal.tsx` (all `border-radius: 0px`, `--font-instrument-sans` family, `var(--accent-primary)` / `var(--text-secondary)` / `var(--bg-sheet)` tokens, existing `boxShadow` values).
- No persistence beyond the mounted lifetime of `ScanBookModal` — no localStorage, no context, no server-side session. Unmounting clears all queue/default state implicitly via React state teardown.
- Do not extract a shared `LocationPicker` component. Duplicate the room/shelf `<select>` markup inline, matching how `BulkMoveModal` already duplicates it from `BookModal`.
- No automated test framework exists in this repo and none should be added as part of this feature. Every task's verification step is `bun run lint` + `bun run build` (type-checks the whole app) + a concrete manual walkthrough in the browser.

---

## File Structure

- **Modify:** `src/components/ScanBookModal.tsx` — all state, the `mode === 'location'` branch, `runLookup` branching, save/remove/override handlers. This is the owner of `Shelf` and `QueuedBook` types (exported for `ScanQueueRow` to consume, matching how `BookModal.tsx` exports `Book` for `ScanBookModal` to consume today).
- **Create:** `src/components/ScanQueueRow.tsx` — presentational row (thumbnail, title, author, location text, Save/Change/Remove), plus its inline location-override editing UI. Imports `Shelf`/`QueuedBook` types from `ScanBookModal.tsx`.
- **Modify:** `src/app/globals.css` — one small `@keyframes spin` + `.spin-icon` utility for the in-progress lookup icon (Task 3).

---

### Task 1: Mode scaffolding, setup screen, and static queue shell

**Files:**
- Modify: `src/components/ScanBookModal.tsx`

**Interfaces:**
- Produces: `export interface Shelf { id: string; room: string; bookshelf: string }`, `export interface QueuedBook { id: string; title: string; authors: string[]; isbn?: string | null; publisher?: string | null; published_date?: string | null; description?: string | null; cover_url?: string | null; locationId: string; location: { room: string; bookshelf: string } | null; overridden: boolean; rowState: 'idle' | 'saving'; editingLocation: boolean }`, `resolveLocationSelection(room: string, shelfId: string): Promise<{ id: string; room: string; bookshelf: string } | null>` (module-internal, used again in Tasks 2 and 5).

- [ ] **Step 1: Add types, state, shelves fetch, and the `resolveLocationSelection` helper**

In `src/components/ScanBookModal.tsx`, add these two exported interfaces directly above the `ScanState` type (currently line 10):

```ts
export interface Shelf {
  id: string;
  room: string;
  bookshelf: string;
}

export interface QueuedBook {
  id: string;
  title: string;
  authors: string[];
  isbn?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  description?: string | null;
  cover_url?: string | null;
  locationId: string;
  location: { room: string; bookshelf: string } | null;
  overridden: boolean;
  rowState: 'idle' | 'saving';
  editingLocation: boolean;
}

type ScanMode = 'single' | 'location';
```

Inside the component, right after the existing state declarations (currently lines 21-26, ending with `const [isSaving, setIsSaving] = useState(false);`), add:

```ts
  const [mode, setMode] = useState<ScanMode>('single');
  const [locationSetupOpen, setLocationSetupOpen] = useState(false);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [setupRoom, setSetupRoom] = useState('');
  const [setupShelfId, setSetupShelfId] = useState('');
  const [defaultLocationId, setDefaultLocationId] = useState('');
  const [defaultLocationObj, setDefaultLocationObj] = useState<{ room: string; bookshelf: string } | null>(null);
  const [editingDefault, setEditingDefault] = useState(false);
  const [queue, setQueue] = useState<QueuedBook[]>([]);
```

Right after the focus-trap `useEffect` (currently ends at line 67), add a shelves-loading effect (mirrors `BulkMoveModal.tsx:58-69`):

```ts
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

  const resolveLocationSelection = useCallback(async (
    room: string,
    shelfId: string
  ): Promise<{ id: string; room: string; bookshelf: string } | null> => {
    const selectedShelf = shelves.find(s => s.id === shelfId);
    if (selectedShelf) return selectedShelf;
    if (!room) return null;

    const roomOnlyShelf = shelves.find(s => s.room === room && s.bookshelf === '');
    if (roomOnlyShelf) return roomOnlyShelf;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('shelves')
        .insert([{ room, bookshelf: '', user_id: user?.id }])
        .select();
      if (error) throw error;
      if (data && data[0]) {
        setShelves(prev => [...prev, data[0]]);
        return data[0];
      }
    } catch {
      console.warn('Failed to save room-only location');
    }
    return { id: '', room, bookshelf: '' };
  }, [shelves, supabase]);

  const handleStartScanning = async () => {
    if (!setupRoom) return;
    const resolved = await resolveLocationSelection(setupRoom, setupShelfId);
    if (!resolved) return;
    setDefaultLocationId(resolved.id);
    setDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });
    setMode('location');
    setLocationSetupOpen(false);
  };

  const handleCancelSetup = () => {
    setLocationSetupOpen(false);
    setSetupRoom('');
    setSetupShelfId('');
  };

  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room)));
  const setupShelvesInRoom = shelves.filter(s => s.room === setupRoom && s.bookshelf !== '');
```

- [ ] **Step 2: Gate hardware scanning off while the setup screen is open**

Change the existing hook call (currently lines 100-102):

```ts
  useHardwareScanner(state === 'idle', (code) => {
    runLookup(code);
  });
```

to:

```ts
  useHardwareScanner(state === 'idle' && !locationSetupOpen, (code) => {
    runLookup(code);
  });
```

- [ ] **Step 3: Add the "Scan by Location" entry link and setup sub-view to the idle screen**

Replace the idle-state `promptContent` block (currently lines 283-304, inside the `state === 'idle'` branch of the `AnimatePresence`) with:

```tsx
              <div style={styles.promptContent}>
                {locationSetupOpen ? (
                  <>
                    <span className="material-symbols-outlined" style={styles.promptIcon}>
                      location_on
                    </span>
                    <h2 style={styles.promptTitle}>Choose a default location</h2>
                    <p style={styles.promptText}>
                      Every book you scan will be assigned here until you change it.
                    </p>
                    <div style={styles.setupForm}>
                      <select
                        aria-label="Select room"
                        value={setupRoom}
                        onChange={(e) => { setSetupRoom(e.target.value); setSetupShelfId(''); }}
                        style={styles.selectField}
                        className="book-modal-select"
                      >
                        <option value="">-- Select Room --</option>
                        {uniqueRooms.map((r, i) => (
                          <option key={i} value={r}>{r}</option>
                        ))}
                      </select>
                      {setupRoom && (
                        <select
                          aria-label="Select shelf"
                          value={setupShelfId}
                          onChange={(e) => setSetupShelfId(e.target.value)}
                          style={styles.selectField}
                          className="book-modal-select"
                        >
                          <option value="">Unassigned</option>
                          {setupShelvesInRoom.map((s) => (
                            <option key={s.id} value={s.id}>{s.bookshelf}</option>
                          ))}
                        </select>
                      )}
                      <div style={styles.setupActions}>
                        <button type="button" onClick={handleCancelSetup} style={styles.formCancelBtn}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleStartScanning}
                          disabled={!setupRoom}
                          style={{ ...styles.formSaveBtn, opacity: setupRoom ? 1 : 0.5 }}
                        >
                          Start Scanning
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={styles.promptIcon}>
                      qr_code_scanner
                    </span>
                    <h2 style={styles.promptTitle}>Scan the book</h2>
                    <p style={styles.promptText}>
                      Scan the barcode to add it to your library.
                    </p>
                    <form onSubmit={handleManualSubmit} style={styles.manualForm}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="field-white"
                        placeholder="Or type an ISBN"
                        value={manualIsbn}
                        onChange={(e) => setManualIsbn(e.target.value)}
                        aria-label="Manually enter ISBN"
                        style={styles.manualInput}
                      />
                    </form>
                    {manualIsbn && <span style={styles.enterHint}>press ⏎ to search</span>}
                    <button
                      type="button"
                      onClick={() => setLocationSetupOpen(true)}
                      style={styles.scanByLocationLink}
                    >
                      Scan by Location →
                    </button>
                  </>
                )}
              </div>
```

- [ ] **Step 4: Add the `mode === 'location'` early-return shell**

Immediately above the existing `if (state === 'loaded' && draftBook) {` block (currently line 194), add:

```tsx
  if (mode === 'location') {
    return (
      <div style={styles.backdrop} onClick={onClose}>
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Scan by location"
          tabIndex={-1}
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
          transition={{ duration: 0.3 }}
          style={{ ...styles.queueModal, outline: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
            CLOSE
          </button>

          <div style={styles.queueHeader}>
            <div style={styles.defaultLocationRow}>
              <span style={styles.defaultLocationText}>
                Scanning into: <strong>
                  {defaultLocationObj?.room}
                  {defaultLocationObj?.bookshelf ? ` • ${defaultLocationObj.bookshelf}` : ''}
                </strong>
              </span>
            </div>
          </div>

          <div style={styles.queueScannerRow}>
            <span className="material-symbols-outlined" style={styles.scannerIcon}>
              qr_code_scanner
            </span>
            <form onSubmit={handleManualSubmit} style={styles.queueManualForm}>
              <input
                type="text"
                inputMode="numeric"
                className="field-white"
                placeholder="Or type an ISBN"
                value={manualIsbn}
                onChange={(e) => setManualIsbn(e.target.value)}
                aria-label="Manually enter ISBN"
                style={styles.manualInput}
              />
            </form>
          </div>

          <div style={styles.queueList}>
            {queue.length === 0 ? (
              <p style={styles.emptyQueueText}>No books scanned yet — scan or type an ISBN above.</p>
            ) : (
              <p style={styles.emptyQueueText}>
                {queue.length} book{queue.length === 1 ? '' : 's'} queued.
              </p>
            )}
          </div>

          <div style={styles.saveAllRow}>
            <button type="button" disabled style={{ ...styles.saveAllBtn, opacity: 0.5 }}>
              Save All
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

```

- [ ] **Step 5: Add the new styles**

Add these entries to the `styles` object at the bottom of the file (anywhere inside the existing `Record<string, React.CSSProperties>` literal, e.g. right after `enterHint`):

```ts
  scanByLocationLink: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: 0,
    marginTop: '14px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  setupForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
    maxWidth: '260px',
  },
  setupActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '4px',
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
  formCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  formSaveBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  queueModal: {
    width: '100%',
    maxWidth: '680px',
    maxHeight: 'min(720px, 85svh)',
    backgroundColor: 'var(--bg-sheet)',
    padding: '40px 36px 36px 36px',
    position: 'relative',
    borderRadius: '0px',
    border: 'none',
    boxShadow: '0 12px 35px rgba(17, 22, 37, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  queueHeader: {
    flexShrink: 0,
    marginBottom: '16px',
  },
  defaultLocationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  defaultLocationText: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  queueScannerRow: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    paddingBottom: '20px',
    marginBottom: '16px',
    borderBottom: '1px solid rgba(17, 22, 37, 0.08)',
  },
  scannerIcon: {
    fontSize: '32px',
    color: 'var(--accent-primary)',
    flexShrink: 0,
  },
  queueManualForm: {
    flex: 1,
    maxWidth: '220px',
  },
  queueList: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingRight: '4px',
  },
  emptyQueueText: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  saveAllRow: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '16px',
  },
  saveAllBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '8px 18px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
```

- [ ] **Step 6: Verify**

Run:
```bash
bun run lint
bun run build
```
Expected: both succeed with no errors (the `queue`, `editingDefault`, `overridden`, `rowState`, `editingLocation` fields are currently unused outside their own state hooks, which is fine — TypeScript won't flag unused struct fields, only unused local variables/imports; if `bun run lint` flags unused state setters, verify you're calling every setter added in this step at least once in the code above).

Manual check via `bun dev`: open the Scan modal, confirm the idle screen shows a "Scan by Location →" link below the manual ISBN field. Click it, confirm the setup view replaces the prompt (Room/Shelf selects + Cancel/Start Scanning). Pick a room, confirm the shelf select appears and "Start Scanning" becomes enabled. Click "Start Scanning", confirm the modal swaps to the queue shell showing "Scanning into: <room>" and "No books scanned yet". Close and reopen the modal, confirm it resets to the normal idle screen.

- [ ] **Step 7: Commit**

```bash
git add src/components/ScanBookModal.tsx
git commit -m "feat: add Scan by Location mode scaffolding and setup screen"
```

---

### Task 2: Default-location "Change" interaction

**Files:**
- Modify: `src/components/ScanBookModal.tsx`

**Interfaces:**
- Consumes: `resolveLocationSelection` from Task 1.
- Produces: `handleStartEditDefault()`, `handleConfirmDefaultChange()`, `handleCancelEditDefault()`.

- [ ] **Step 1: Add the default-change handlers**

Add these functions next to `handleStartScanning` (added in Task 1):

```ts
  const handleStartEditDefault = () => {
    setSetupRoom(defaultLocationObj?.room ?? '');
    setSetupShelfId(defaultLocationId);
    setEditingDefault(true);
  };

  const handleCancelEditDefault = () => {
    setEditingDefault(false);
  };

  const handleConfirmDefaultChange = async () => {
    if (!setupRoom) return;
    const resolved = await resolveLocationSelection(setupRoom, setupShelfId);
    if (!resolved) return;
    setDefaultLocationId(resolved.id);
    setDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });
    setEditingDefault(false);
  };
```

- [ ] **Step 2: Wire the edit UI into the queue header**

Replace the `queueHeader` block added in Task 1 Step 4 with:

```tsx
          <div style={styles.queueHeader}>
            <AnimatePresence mode="wait">
              {editingDefault ? (
                <motion.div
                  key="edit-default"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.15 }}
                  style={styles.setupForm}
                >
                  <select
                    aria-label="Select room"
                    value={setupRoom}
                    onChange={(e) => { setSetupRoom(e.target.value); setSetupShelfId(''); }}
                    style={styles.selectField}
                    className="book-modal-select"
                  >
                    <option value="">-- Select Room --</option>
                    {uniqueRooms.map((r, i) => (
                      <option key={i} value={r}>{r}</option>
                    ))}
                  </select>
                  {setupRoom && (
                    <select
                      aria-label="Select shelf"
                      value={setupShelfId}
                      onChange={(e) => setSetupShelfId(e.target.value)}
                      style={styles.selectField}
                      className="book-modal-select"
                    >
                      <option value="">Unassigned</option>
                      {shelves.filter(s => s.room === setupRoom && s.bookshelf !== '').map((s) => (
                        <option key={s.id} value={s.id}>{s.bookshelf}</option>
                      ))}
                    </select>
                  )}
                  <div style={styles.setupActions}>
                    <button type="button" onClick={handleCancelEditDefault} style={styles.formCancelBtn}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDefaultChange}
                      disabled={!setupRoom}
                      style={{ ...styles.formSaveBtn, opacity: setupRoom ? 1 : 0.5 }}
                    >
                      Save
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="display-default"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.15 }}
                  style={styles.defaultLocationRow}
                >
                  <span style={styles.defaultLocationText}>
                    Scanning into: <strong>
                      {defaultLocationObj?.room}
                      {defaultLocationObj?.bookshelf ? ` • ${defaultLocationObj.bookshelf}` : ''}
                    </strong>
                  </span>
                  <button type="button" onClick={handleStartEditDefault} style={styles.editLink}>
                    Change
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
```

- [ ] **Step 3: Add the `editLink` style**

Add to `styles` (matches `BookModal.tsx`'s `editLink` exactly):

```ts
  editLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    textDecoration: 'underline',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
```

- [ ] **Step 4: Verify**

Run:
```bash
bun run lint
bun run build
```
Expected: both succeed.

Manual check via `bun dev`: enter Scan by Location, confirm the default strip now shows a "Change" link. Click it, confirm the same room/shelf selects appear inline (pre-filled with the current default), change the room, click Save, confirm the strip updates to the new default. Click Change again, click Cancel, confirm the strip reverts to showing the (unchanged) default without applying anything.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScanBookModal.tsx
git commit -m "feat: allow changing the default scan location mid-session"
```

---

### Task 3: Scan-to-queue lookup logic

**Files:**
- Modify: `src/components/ScanBookModal.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `QueuedBook`, `mode`, `defaultLocationId`, `defaultLocationObj`, `queue`, `showToast` (existing prop), `books` (existing prop).
- Produces: updated `runLookup` that appends to `queue` when `mode === 'location'`.

- [ ] **Step 1: Branch `runLookup` on `mode`**

Replace the existing `runLookup` function (currently lines 69-97) with:

```ts
  const runLookup = useCallback(async (isbn: string) => {
    setState('loading');
    try {
      const result = await fetchBookByIsbn(isbn);
      if (!result) {
        if (mode === 'location') {
          showToast(`Couldn't find that book — ISBN "${isbn}"`);
          setState('idle');
          return;
        }
        setFailedIsbn(isbn);
        setState('error');
        return;
      }

      if (mode === 'location') {
        const isDuplicate = books.some(b =>
          (b.isbn && result.isbn && b.isbn.replace(/[\s-]/g, '') === result.isbn.replace(/[\s-]/g, '')) ||
          (b.title.toLowerCase().trim() === result.title.toLowerCase().trim() &&
           b.authors.map(a => a.toLowerCase().trim()).join(',') === result.authors.map(a => a.toLowerCase().trim()).join(','))
        ) || queue.some(q =>
          (q.isbn && result.isbn && q.isbn.replace(/[\s-]/g, '') === result.isbn.replace(/[\s-]/g, '')) ||
          (q.title.toLowerCase().trim() === result.title.toLowerCase().trim() &&
           q.authors.map(a => a.toLowerCase().trim()).join(',') === result.authors.map(a => a.toLowerCase().trim()).join(','))
        );

        if (isDuplicate) {
          showToast(`"${result.title}" already exists in library`);
          setState('idle');
          return;
        }

        setQueue(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            title: result.title,
            authors: result.authors,
            isbn: result.isbn,
            publisher: result.publisher,
            published_date: result.published_date,
            description: result.description,
            cover_url: result.cover_url,
            locationId: defaultLocationId,
            location: defaultLocationObj,
            overridden: false,
            rowState: 'idle',
            editingLocation: false,
          },
        ]);
        setState('idle');
        return;
      }

      setDraftBook({
        id: 'draft',
        title: result.title,
        authors: result.authors,
        isbn: result.isbn,
        publisher: result.publisher,
        published_date: result.published_date,
        description: result.description,
        cover_url: result.cover_url,
        location: null,
        status: 'To Read',
        favorite: false,
      });
      setDraftLocationId('');
      setState('loaded');
    } catch {
      if (mode === 'location') {
        showToast(`Couldn't find that book — ISBN "${isbn}"`);
        setState('idle');
        return;
      }
      setFailedIsbn(isbn);
      setState('error');
    }
  }, [mode, books, queue, defaultLocationId, defaultLocationObj, showToast]);
```

- [ ] **Step 2: Show an in-progress state on the scanner icon during lookup**

Add a spin animation to `src/app/globals.css`, right after the existing `skeleton-shimmer` block (currently ends around line 333):

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spin-icon {
    animation: none;
  }
}
```

In `ScanBookModal.tsx`, update the scanner icon in the `mode === 'location'` shell (added in Task 1 Step 4) to react to `state`:

```tsx
            <span
              className={`material-symbols-outlined${state === 'loading' ? ' spin-icon' : ''}`}
              style={styles.scannerIcon}
            >
              {state === 'loading' ? 'progress_activity' : 'qr_code_scanner'}
            </span>
```

This replaces the static `<span className="material-symbols-outlined" style={styles.scannerIcon}>qr_code_scanner</span>` from Task 1 Step 4.

- [ ] **Step 3: Verify**

Run:
```bash
bun run lint
bun run build
```
Expected: both succeed.

Manual check via `bun dev`: enter Scan by Location with a default set, use the manual ISBN field to submit a real ISBN (e.g. `9780141439518` for Pride and Prejudice). Confirm the scanner icon briefly spins, then the queue count text updates (e.g. "1 book queued."). Submit the same ISBN again, confirm a toast reports it's already in the queue and the count does not increase. Submit an obviously invalid ISBN (e.g. `0000000000`), confirm a toast reports it couldn't be found and the queue count is unaffected. Confirm the modal never leaves the queue view during any of this (no full error screen).

- [ ] **Step 4: Commit**

```bash
git add src/components/ScanBookModal.tsx src/app/globals.css
git commit -m "feat: append scanned books to the location queue"
```

---

### Task 4: `ScanQueueRow` component and queue rendering

**Files:**
- Create: `src/components/ScanQueueRow.tsx`
- Modify: `src/components/ScanBookModal.tsx`

**Interfaces:**
- Consumes: `Shelf`, `QueuedBook` (exported from `ScanBookModal.tsx` in Task 1).
- Produces: `export default function ScanQueueRow(props: ScanQueueRowProps)` with `ScanQueueRowProps = { book: QueuedBook; onSave: (id: string) => void; onRemove: (id: string) => void }`. (Location-override editing UI is added in Task 5 — this task renders the row and wires Save/Remove only.)

- [ ] **Step 1: Create `ScanQueueRow.tsx`**

```tsx
'use client';

import Image from 'next/image';
import { useState } from 'react';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';
import type { QueuedBook } from '@/components/ScanBookModal';

interface ScanQueueRowProps {
  book: QueuedBook;
  onSave: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function ScanQueueRow({ book, onSave, onRemove }: ScanQueueRowProps) {
  const [imgError, setImgError] = useState(false);
  const isSaving = book.rowState === 'saving';

  return (
    <div style={styles.row}>
      <div style={styles.coverWrapper}>
        {book.cover_url && !imgError ? (
          <Image
            src={book.cover_url}
            alt={book.title}
            fill
            sizes="40px"
            style={{ objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
            <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
          </div>
        )}
      </div>

      <div style={styles.textCol}>
        <span style={styles.title}>{book.title}</span>
        <span style={styles.author}>{book.authors.join(', ') || 'Unknown Author'}</span>
        <span style={styles.location}>
          {book.location?.room}
          {book.location?.bookshelf ? ` • ${book.location.bookshelf}` : ''}
        </span>
      </div>

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => onSave(book.id)}
          disabled={isSaving}
          style={{ ...styles.saveBtn, opacity: isSaving ? 0.6 : 1 }}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => onRemove(book.id)} style={styles.removeBtn}>
          Remove
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(17, 22, 37, 0.06)',
  },
  coverWrapper: {
    width: '40px',
    height: '56px',
    flexShrink: 0,
    position: 'relative',
    borderRadius: '0px',
    overflow: 'hidden',
    boxShadow: '0 4px 10px rgba(17, 22, 37, 0.1)',
  },
  placeholderCover: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  placeholderSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px',
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    gap: '2px',
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  author: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  location: {
    fontSize: '0.8rem',
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  saveBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--error)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
```

- [ ] **Step 2: Add `persistQueuedBook`, `handleSaveQueueRow`, `handleRemoveFromQueue` to `ScanBookModal.tsx`**

Add next to the other handlers (e.g. after `handleConfirmDefaultChange`):

```ts
  const persistQueuedBook = useCallback(async (row: QueuedBook) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user session');

      const { data, error } = await supabase
        .from('books')
        .insert([{
          user_id: user.id,
          title: row.title,
          authors: row.authors,
          isbn: row.isbn || null,
          publisher: row.publisher || null,
          published_date: row.published_date || null,
          description: row.description || null,
          cover_url: row.cover_url || null,
          location_id: row.locationId || null,
          status: 'To Read',
        }])
        .select();

      if (error) throw error;

      onBookAdded({
        id: data && data[0] ? data[0].id : row.id,
        title: row.title,
        authors: row.authors,
        isbn: row.isbn,
        publisher: row.publisher,
        published_date: row.published_date,
        description: row.description,
        cover_url: row.cover_url,
        location: row.location,
        status: 'To Read',
        favorite: false,
      });
    } catch {
      console.warn('Failed to save queued book to Supabase, adding locally instead');
      const mockId = Math.random().toString(36).substring(7);
      onBookAdded({
        id: mockId,
        title: row.title,
        authors: row.authors,
        isbn: row.isbn,
        publisher: row.publisher,
        published_date: row.published_date,
        description: row.description,
        cover_url: row.cover_url,
        location: row.location,
        status: 'To Read',
        favorite: false,
      });
    }
  }, [supabase, onBookAdded]);

  const handleSaveQueueRow = async (id: string) => {
    const row = queue.find(q => q.id === id);
    if (!row) return;
    setQueue(prev => prev.map(q => (q.id === id ? { ...q, rowState: 'saving' } : q)));
    await persistQueuedBook(row);
    setQueue(prev => prev.filter(q => q.id !== id));
    showToast(`Added "${row.title}" to your library`);
  };

  const handleRemoveFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };
```

- [ ] **Step 3: Render real rows in the queue list**

Add the import at the top of `ScanBookModal.tsx` (with the other component imports):

```ts
import ScanQueueRow from '@/components/ScanQueueRow';
```

Replace the `queueList` block from Task 1 Step 4:

```tsx
          <div style={styles.queueList}>
            {queue.length === 0 ? (
              <p style={styles.emptyQueueText}>No books scanned yet — scan or type an ISBN above.</p>
            ) : (
              <p style={styles.emptyQueueText}>
                {queue.length} book{queue.length === 1 ? '' : 's'} queued.
              </p>
            )}
          </div>
```

with:

```tsx
          <div style={styles.queueList}>
            {queue.length === 0 ? (
              <p style={styles.emptyQueueText}>No books scanned yet — scan or type an ISBN above.</p>
            ) : (
              queue.map((book) => (
                <ScanQueueRow
                  key={book.id}
                  book={book}
                  onSave={handleSaveQueueRow}
                  onRemove={handleRemoveFromQueue}
                />
              ))
            )}
          </div>
```

- [ ] **Step 4: Verify**

Run:
```bash
bun run lint
bun run build
```
Expected: both succeed.

Manual check via `bun dev`: enter Scan by Location, scan/manually enter 2-3 real ISBNs, confirm each appears as a row with cover thumbnail (or placeholder), title, author, and "Room • Shelf" text. Click "Remove" on one row, confirm it disappears immediately. Click "Save" on another row, confirm the button shows "Saving…" briefly, the row disappears from the queue, a toast confirms the addition, and the book appears in the dashboard grid behind the modal with the correct location once you close the modal.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScanQueueRow.tsx src/components/ScanBookModal.tsx
git commit -m "feat: render scanned-book queue rows with save and remove"
```

---

### Task 5: Per-row location override ("Change")

**Files:**
- Modify: `src/components/ScanQueueRow.tsx`
- Modify: `src/components/ScanBookModal.tsx`

**Interfaces:**
- Consumes: `Shelf[]`, `resolveLocationSelection` (Task 1).
- Produces: `ScanQueueRowProps` gains `shelves: Shelf[]`, `onLocationChange: (id: string, room: string, shelfId: string) => void`.

- [ ] **Step 1: Add editing UI to `ScanQueueRow.tsx`**

Update the props interface and imports at the top of `src/components/ScanQueueRow.tsx`:

```tsx
import type { QueuedBook, Shelf } from '@/components/ScanBookModal';

interface ScanQueueRowProps {
  book: QueuedBook;
  shelves: Shelf[];
  onSave: (id: string) => void;
  onRemove: (id: string) => void;
  onStartEditLocation: (id: string) => void;
  onCancelEditLocation: (id: string) => void;
  onConfirmLocation: (id: string, room: string, shelfId: string) => void;
}
```

Replace the component body (`export default function ScanQueueRow(...) { ... }`) with:

```tsx
export default function ScanQueueRow({
  book,
  shelves,
  onSave,
  onRemove,
  onStartEditLocation,
  onCancelEditLocation,
  onConfirmLocation,
}: ScanQueueRowProps) {
  const [imgError, setImgError] = useState(false);
  const [editRoom, setEditRoom] = useState('');
  const [editShelfId, setEditShelfId] = useState('');
  const isSaving = book.rowState === 'saving';

  const startEdit = () => {
    setEditRoom(book.location?.room ?? '');
    setEditShelfId(book.locationId);
    onStartEditLocation(book.id);
  };

  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room)));
  const shelvesInRoom = shelves.filter(s => s.room === editRoom && s.bookshelf !== '');

  return (
    <div style={styles.row}>
      <div style={styles.coverWrapper}>
        {book.cover_url && !imgError ? (
          <Image
            src={book.cover_url}
            alt={book.title}
            fill
            sizes="40px"
            style={{ objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
            <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
          </div>
        )}
      </div>

      <div style={styles.textCol}>
        <span style={styles.title}>{book.title}</span>
        <span style={styles.author}>{book.authors.join(', ') || 'Unknown Author'}</span>
        {book.editingLocation ? (
          <div style={styles.editLocationRow}>
            <select
              aria-label="Select room"
              value={editRoom}
              onChange={(e) => { setEditRoom(e.target.value); setEditShelfId(''); }}
              style={styles.miniSelect}
              className="book-modal-select"
            >
              <option value="">-- Select Room --</option>
              {uniqueRooms.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>
            {editRoom && (
              <select
                aria-label="Select shelf"
                value={editShelfId}
                onChange={(e) => setEditShelfId(e.target.value)}
                style={styles.miniSelect}
                className="book-modal-select"
              >
                <option value="">Unassigned</option>
                {shelvesInRoom.map((s) => (
                  <option key={s.id} value={s.id}>{s.bookshelf}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => onConfirmLocation(book.id, editRoom, editShelfId)}
              disabled={!editRoom}
              style={{ ...styles.miniSaveBtn, opacity: editRoom ? 1 : 0.5 }}
            >
              Save
            </button>
            <button type="button" onClick={() => onCancelEditLocation(book.id)} style={styles.miniCancelBtn}>
              Cancel
            </button>
          </div>
        ) : (
          <span style={styles.location}>
            {book.location?.room}
            {book.location?.bookshelf ? ` • ${book.location.bookshelf}` : ''}
          </span>
        )}
      </div>

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => onSave(book.id)}
          disabled={isSaving}
          style={{ ...styles.saveBtn, opacity: isSaving ? 0.6 : 1 }}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={startEdit} style={styles.changeBtn}>
          Change
        </button>
        <button type="button" onClick={() => onRemove(book.id)} style={styles.removeBtn}>
          Remove
        </button>
      </div>
    </div>
  );
}
```

Add these entries to the `styles` object in the same file:

```ts
  editLocationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '2px',
  },
  miniSelect: {
    padding: '3px 6px',
    border: '1px solid rgba(17, 22, 37, 0.12)',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: '#FFFFFF',
    color: 'var(--text-primary)',
    boxShadow: 'none',
    outline: 'none',
    fontSize: '0.8rem',
  },
  miniSaveBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    color: 'var(--bg-sheet)',
    padding: '3px 10px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  miniCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  changeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    textDecoration: 'underline',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
```

- [ ] **Step 2: Add the queue-row-location handlers to `ScanBookModal.tsx`**

Add next to `handleRemoveFromQueue`:

```ts
  const handleStartEditQueueLocation = (id: string) => {
    setQueue(prev => prev.map(q => (q.id === id ? { ...q, editingLocation: true } : q)));
  };

  const handleCancelEditQueueLocation = (id: string) => {
    setQueue(prev => prev.map(q => (q.id === id ? { ...q, editingLocation: false } : q)));
  };

  const handleConfirmQueueLocation = async (id: string, room: string, shelfId: string) => {
    if (!room) return;
    const resolved = await resolveLocationSelection(room, shelfId);
    if (!resolved) return;
    setQueue(prev => prev.map(q => (
      q.id === id
        ? {
            ...q,
            locationId: resolved.id,
            location: { room: resolved.room, bookshelf: resolved.bookshelf },
            overridden: true,
            editingLocation: false,
          }
        : q
    )));
  };
```

Update the `ScanQueueRow` usage (from Task 4 Step 3) to pass the new props:

```tsx
              queue.map((book) => (
                <ScanQueueRow
                  key={book.id}
                  book={book}
                  shelves={shelves}
                  onSave={handleSaveQueueRow}
                  onRemove={handleRemoveFromQueue}
                  onStartEditLocation={handleStartEditQueueLocation}
                  onCancelEditLocation={handleCancelEditQueueLocation}
                  onConfirmLocation={handleConfirmQueueLocation}
                />
              ))
```

- [ ] **Step 3: Verify**

Run:
```bash
bun run lint
bun run build
```
Expected: both succeed.

Manual check via `bun dev`: with 2+ books queued under one default location, click "Change" on one row, confirm inline room/shelf selects appear in that row only. Pick a different room/shelf, click Save, confirm only that row's location text updates and the other rows are untouched. Change the top default location afterward, confirm neither the overridden row nor the other already-queued rows change — only a newly scanned book after that point uses the new default.

- [ ] **Step 4: Commit**

```bash
git add src/components/ScanQueueRow.tsx src/components/ScanBookModal.tsx
git commit -m "feat: allow overriding an individual queued book's location"
```

---

### Task 6: Save All

**Files:**
- Modify: `src/components/ScanBookModal.tsx`

**Interfaces:**
- Consumes: `persistQueuedBook` (Task 4).
- Produces: `handleSaveAll()`.

- [ ] **Step 1: Add `handleSaveAll`**

Add next to `handleSaveQueueRow`:

```ts
  const handleSaveAll = async () => {
    if (queue.length === 0) return;
    const rows = queue;
    setQueue(prev => prev.map(q => ({ ...q, rowState: 'saving' })));
    await Promise.all(rows.map(row => persistQueuedBook(row)));
    setQueue([]);
    showToast(`Added ${rows.length} book${rows.length === 1 ? '' : 's'} to your library`);
  };
```

- [ ] **Step 2: Wire the Save All button**

Replace the `saveAllRow` block (currently in Task 1 Step 4):

```tsx
          <div style={styles.saveAllRow}>
            <button type="button" disabled style={{ ...styles.saveAllBtn, opacity: 0.5 }}>
              Save All
            </button>
          </div>
```

with:

```tsx
          <div style={styles.saveAllRow}>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={queue.length === 0}
              style={{ ...styles.saveAllBtn, opacity: queue.length === 0 ? 0.5 : 1 }}
            >
              Save All
            </button>
          </div>
```

- [ ] **Step 3: Verify**

Run:
```bash
bun run lint
bun run build
```
Expected: both succeed.

Manual check via `bun dev`: with an empty queue, confirm "Save All" is disabled. Scan 3 books (mix of default and one overridden location), click "Save All", confirm all three rows clear from the queue, a single summary toast appears (e.g. "Added 3 books to your library"), and the dashboard grid shows all three books with their correct respective locations once the modal is closed. Confirm the modal stays open and ready to scan more immediately after Save All (it does not auto-close).

- [ ] **Step 4: Commit**

```bash
git add src/components/ScanBookModal.tsx
git commit -m "feat: add Save All for the scan-by-location queue"
```

---

### Task 7: Final polish and full walkthrough

**Files:**
- Modify: `src/components/ScanBookModal.tsx`

- [ ] **Step 1: Reduce the queue-list row gap now that rows carry their own bottom border**

`ScanQueueRow`'s `row` style already includes `borderBottom`, so the `queueList` gap from Task 1 (`gap: '4px'`) is fine as-is — skip if already `4px`. If it was left at a larger value in Task 1, update the `queueList` entry in `ScanBookModal.tsx`'s `styles` to `gap: '0px'` so rows read as one continuous list (matching `ManageLocationsModal`'s gapless `shelvesList` convention).

- [ ] **Step 2: Full manual walkthrough**

Run `bun dev` and work through every item below in order, in one continuous session, confirming each before moving to the next:

1. Open the Scan modal → click "Scan by Location" → pick a Room and Shelf → "Start Scanning". Confirm the queue view opens showing the chosen default and an empty-queue message.
2. Scan or manually enter 3 distinct real ISBNs. Confirm each lands in the queue with the default location, cover thumbnail (or placeholder), title, and author — with no popup interrupting between scans.
3. Re-enter an ISBN already in the queue. Confirm a toast reports the duplicate and no new row is added.
4. Enter an invalid/unknown ISBN. Confirm a toast reports the lookup failure and the queue view stays scan-ready (no full-screen error state).
5. Click "Change" on one row, pick a different Room/Shelf, Save. Confirm only that row's location text updates.
6. Click "Change" on the top default strip, pick a different Room, Save. Confirm existing rows (including the un-overridden ones) keep their prior locations; scan one more book and confirm it uses the new default.
7. Scan enough additional books (5+) to exceed the modal's max height. Confirm the header, default strip, scanner controls, and Save All button stay fixed in place while only the queue list scrolls.
8. Click "Save" on one row individually. Confirm it disappears from the queue, a toast confirms the addition, and — after closing the modal — it appears in the dashboard grid with the correct location.
9. Click "Save All" on the remaining rows. Confirm they all clear from the queue, a summary toast appears, and the modal stays open afterward.
10. Close the modal (CLOSE button). Reopen the Scan modal and choose "Scan by Location" again. Confirm the queue is empty and no location is pre-selected — nothing carried over from the prior session.
11. With the modal in its normal (non-location) idle state, verify the existing single-scan flow is completely unaffected: scan a book, confirm it opens the full `BookModal` preview exactly as before, assign a location there, and save.

If any step fails, fix the underlying code in the relevant earlier task's file before proceeding — do not patch around it here.

- [ ] **Step 3: Final verification**

Run:
```bash
bun run lint
bun run build
```
Expected: both succeed with zero errors and zero warnings introduced by this feature.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "polish: finish Scan by Location queue styling and verify full flow"
```
