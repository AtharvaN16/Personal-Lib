# Scanner Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement UI/UX enhancements, API lookup limit increases, local storage persistence, scroll locks, z-index adjustment, and vibration animations for the book scanner.

**Architecture:** 
1. Use browser localStorage to store scanning session states synchronously on initialization.
2. Synchronize both `document.body.style.overflow` and `document.documentElement.style.overflow` for all modals to block parent scroll on all mobile and desktop browsers.
3. Enhance `ScanQueueRow` state to include inputs for Title and Author during row editing, splitting the author string by commas to return a clean list of strings.
4. Modify `src/app/api/book-lookup/route.ts` to perform case-insensitive name/email matching for "Sharvari Nayak" and bump the lookups limit to 500.
5. Create CSS animations in `src/app/globals.css` combining rapid initial shakes with periodic resting tilts.

**Tech Stack:** Next.js (App Router), Supabase (Auth & Database), Framer Motion, Vanilla CSS, LocalStorage API.

## Global Constraints
- Do not use TailwindCSS. Focus on Vanilla CSS variables and inline styles.
- Preserve existing comments and imports unless direct edits are required.
- Maintain consistent interface signatures between files.

---

### Task 1: Toast Notification Z-Index & Page Scroll Locking

**Files:**
- Modify: `src/components/Dashboard.tsx` (Z-Index fix)
- Modify: `src/components/ScanBookModal.tsx` (Scroll Lock)
- Modify: `src/components/BookModal.tsx` (Scroll Lock)
- Modify: `src/components/ManageLocationsModal.tsx` (Scroll Lock)

**Interfaces:**
- Consumes: Existing component styles and hooks.
- Produces: Heightened toast z-index and root element overflow control.

- [ ] **Step 1: Update toast z-index in Dashboard**
  Change the wrapper zIndex of the Toast Notification Container in [Dashboard.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/Dashboard.tsx#L1170) from `9999` to `99999`.
  ```typescript
  zIndex: 99999,
  ```

- [ ] **Step 2: Add documentElement scroll locking in ScanBookModal**
  Update the focus/scroll lock effect in [ScanBookModal.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanBookModal.tsx#L108-L144):
  ```typescript
  useEffect(() => {
    if (state === 'loaded') return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => { ... };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [onClose, state]);
  ```

- [ ] **Step 3: Add documentElement scroll locking in BookModal**
  Update the focus/scroll lock effect in [BookModal.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/BookModal.tsx#L84-L120):
  ```typescript
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // ... handling keydown ...
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [onClose]);
  ```

- [ ] **Step 4: Add documentElement scroll locking in ManageLocationsModal**
  Update the scroll lock effect in [ManageLocationsModal.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ManageLocationsModal.tsx#L40-L75):
  ```typescript
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // ... keydown ...
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [onClose]);
  ```

- [ ] **Step 5: Run Linting to verify Task 1 changes**
  Run: `bun run lint`
  Expected: No linting/TypeScript errors.

- [ ] **Step 6: Commit Task 1**
  ```bash
  git add src/components/Dashboard.tsx src/components/ScanBookModal.tsx src/components/BookModal.tsx src/components/ManageLocationsModal.tsx
  git commit -m "feat: improve page scroll prevention and toast z-index"
  ```

---

### Task 2: Multi-Scan Queue Auto-Scroll

**Files:**
- Modify: `src/components/ScanBookModal.tsx`

**Interfaces:**
- Consumes: `queue` state.
- Produces: Automated container ref scroll updates.

- [ ] **Step 1: Add queueListRef to ScanBookModal**
  Declare a `useRef` for the list:
  ```typescript
  const queueListRef = useRef<HTMLDivElement>(null);
  const prevQueueLengthRef = useRef(0);
  ```

- [ ] **Step 2: Add useEffect to trigger smooth scroll**
  ```typescript
  useEffect(() => {
    if (queue.length > prevQueueLengthRef.current) {
      queueListRef.current?.scrollTo({
        top: queueListRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
    prevQueueLengthRef.current = queue.length;
  }, [queue.length]);
  ```

- [ ] **Step 3: Connect Ref to queueList container JSX**
  In the JSX return for `mode === 'location'`:
  ```typescript
  <div ref={queueListRef} style={styles.queueList}>
  ```

- [ ] **Step 4: Run Linting**
  Run: `bun run lint`
  Expected: Success.

- [ ] **Step 5: Commit Task 2**
  ```bash
  git add src/components/ScanBookModal.tsx
  git commit -m "feat: autoscroll multi scan list when new book is added"
  ```

---

### Task 3: Row Level Edit for Title, Author, and Location

**Files:**
- Modify: `src/components/ScanQueueRow.tsx`
- Modify: `src/components/ScanBookModal.tsx`

**Interfaces:**
- Updates `ScanQueueRowProps` signature:
  ```typescript
  interface ScanQueueRowProps {
    book: QueuedBook;
    shelves: Shelf[];
    onSave: (id: string) => void;
    onRemove: (id: string) => void;
    onStartEditLocation: (id: string) => void;
    onCancelEditLocation: (id: string) => void;
    onConfirmChanges: (id: string, title: string, authors: string[], room: string, shelfId: string) => void;
  }
  ```

- [ ] **Step 1: Expand local edit states in ScanQueueRow**
  Update state declarations in [ScanQueueRow.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanQueueRow.tsx):
  ```typescript
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  ```

- [ ] **Step 2: Initialize inputs inside startEdit**
  ```typescript
  const startEdit = () => {
    setEditTitle(book.title);
    setEditAuthor(book.authors.join(', '));
    setEditRoom(book.location?.room ?? '');
    setEditShelfId(book.locationId);
    onStartEditLocation(book.id);
  };
  ```

- [ ] **Step 3: Render text inputs for Title and Author in edit mode**
  Inside [ScanQueueRow.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanQueueRow.tsx#L60-L122):
  ```typescript
  <div style={styles.textCol}>
    {book.editingLocation ? (
      <div style={styles.editFieldsWrapper}>
        <input
          type="text"
          aria-label="Edit title"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          style={styles.miniInput}
          placeholder="Title"
        />
        <input
          type="text"
          aria-label="Edit author"
          value={editAuthor}
          onChange={(e) => setEditAuthor(e.target.value)}
          style={styles.miniInput}
          placeholder="Author(s)"
        />
        <div style={styles.editLocationRow}>
          {/* Select dropdowns remain here ... */}
          <button
            type="button"
            onClick={() => onConfirmChanges(
              book.id,
              editTitle,
              editAuthor.split(',').map(a => a.trim()).filter(Boolean),
              editRoom,
              editShelfId
            )}
            className="icon-btn"
            style={{ ...styles.rowIconBtn, color: 'var(--accent-primary)' }}
            title="Save changes"
            aria-label="Save changes"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              check
            </span>
          </button>
          {/* Cancel button ... */}
        </div>
      </div>
    ) : (
      <>
        <span style={styles.title}>{book.title}</span>
        <span style={styles.author}>{book.authors.join(', ') || 'Unknown Author'}</span>
        <span style={styles.location}>
          {book.location?.room}
          {book.location?.bookshelf ? ` • ${book.location.bookshelf}` : ''}
        </span>
      </>
    )}
  </div>
  ```

- [ ] **Step 4: Add new style rules in ScanQueueRow.tsx**
  Add styles:
  ```typescript
  editFieldsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
  },
  miniInput: {
    padding: '4px 8px',
    border: '1px solid rgba(17, 22, 37, 0.12)',
    borderRadius: '0px',
    background: 'var(--bg-sheet)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  ```

- [ ] **Step 5: Update ScanBookModal confirm handler and row props**
  In [ScanBookModal.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanBookModal.tsx), change `handleConfirmQueueLocation` to `handleConfirmQueueChanges`:
  ```typescript
  const handleConfirmQueueChanges = async (
    id: string,
    title: string,
    authors: string[],
    room: string,
    shelfId: string
  ) => {
    const shelf = shelves.find(s => s.id === shelfId);
    setQueue(prev => prev.map(q => {
      if (q.id === id) {
        return {
          ...q,
          title,
          authors,
          locationId: shelfId,
          location: shelf ? { room: shelf.room, bookshelf: shelf.bookshelf } : null,
          overridden: true,
          editingLocation: false,
        };
      }
      return q;
    }));
  };
  ```
  Pass `onConfirmChanges={handleConfirmQueueChanges}` to `<ScanQueueRow>` inside [ScanBookModal.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanBookModal.tsx#L805-L817).

- [ ] **Step 6: Run Linting**
  Run: `bun run lint`
  Expected: Success.

- [ ] **Step 7: Commit Task 3**
  ```bash
  git add src/components/ScanQueueRow.tsx src/components/ScanBookModal.tsx
  git commit -m "feat: support editing title and author inside multi scan queue row"
  ```

---

### Task 4: API Daily Scan Lookup Limit Upgrade

**Files:**
- Modify: `src/app/api/book-lookup/route.ts`

**Interfaces:**
- Consumes: Supabase user object.
- Produces: Increased quota limit parameter `p_max_lookups` to `500` for target user.

- [ ] **Step 1: Implement user identity check**
  In [route.ts](file:///Users/atharvanayak/Developer/Personal%20Library/src/app/api/book-lookup/route.ts#L107-L132), after retrieving the user:
  ```typescript
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to scan books.' }, { status: 401 });
  }

  const isSharvariNayak = 
    user.email?.toLowerCase().includes('sharvari') && user.email?.toLowerCase().includes('nayak') ||
    user.user_metadata?.full_name?.toLowerCase().includes('sharvari') && user.user_metadata?.full_name?.toLowerCase().includes('nayak') ||
    user.user_metadata?.name?.toLowerCase().includes('sharvari') && user.user_metadata?.name?.toLowerCase().includes('nayak');

  const userLimit = isSharvariNayak ? 500 : USER_DAILY_LOOKUP_LIMIT;

  const { data: quotaRows, error: quotaError } = await supabase.rpc('consume_book_lookup_quota', {
    p_lookup_date: todayUtc(),
    p_max_lookups: userLimit,
  });
  ```

- [ ] **Step 2: Update limits returned in route error response**
  ```typescript
  if (!quota?.allowed) {
    return NextResponse.json(
      {
        error: `Daily scan lookup limit reached (${userLimit}/day).`,
        limit: userLimit,
        count: quota?.lookup_count ?? userLimit,
      },
      { status: 429 }
    );
  }
  ```

- [ ] **Step 3: Run Linting**
  Run: `bun run lint`
  Expected: Success.

- [ ] **Step 4: Commit Task 4**
  ```bash
  git add src/app/api/book-lookup/route.ts
  git commit -m "feat: increase daily scan lookup limit to 500 for Sharvari Nayak"
  ```

---

### Task 5: Location Alert Vibration Animations

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ScanQueueRow.tsx`

**Interfaces:**
- Consumes: CSS animation variables.
- Produces: CSS animation classes on the row confirm/cancel buttons.

- [ ] **Step 1: Add alarm keyframes and classes to globals.css**
  Append to [globals.css](file:///Users/atharvanayak/Developer/Personal%20Library/src/app/globals.css):
  ```css
  /* Rapid shake immediately, followed by periodic subtle jiggle */
  @keyframes alert-vibrate {
    /* Initial rapid shake (0s - 0.5s) */
    0% { transform: translateX(0); }
    10% { transform: translateX(-4px); }
    20% { transform: translateX(4px); }
    30% { transform: translateX(-4px); }
    40% { transform: translateX(4px); }
    50% { transform: translateX(0); }
    /* Rest & Periodic jiggles (repeats every 3s loop) */
    80%, 100% { transform: translate(0, 0); }
    82% { transform: translate(-2px, 0) rotate(-1deg); }
    84% { transform: translate(2px, 0) rotate(1deg); }
    86% { transform: translate(-2px, 0) rotate(-1deg); }
    88% { transform: translate(2px, 0) rotate(1deg); }
    90% { transform: translate(-1px, 0) rotate(-0.5deg); }
    92% { transform: translate(1px, 0) rotate(0.5deg); }
    94% { transform: translate(0, 0); }
  }

  .vibrate-attention {
    animation: alert-vibrate 3s ease-in-out infinite;
  }
  ```

- [ ] **Step 2: Apply className dynamically in ScanQueueRow**
  In [ScanQueueRow.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanQueueRow.tsx):
  Determine if the book has no location:
  ```typescript
  const needsLocationSaving = !book.locationId;
  const vibrateClass = needsLocationSaving ? 'vibrate-attention' : '';
  ```
  Add the class to both check and close buttons:
  ```typescript
  className={`icon-btn ${vibrateClass}`}
  ```

- [ ] **Step 3: Run Linting**
  Run: `bun run lint`
  Expected: Success.

- [ ] **Step 4: Commit Task 5**
  ```bash
  git add src/app/globals.css src/components/ScanQueueRow.tsx
  git commit -m "feat: add shake and periodic jiggle alerts for books missing location"
  ```

---

### Task 6: Session State LocalStorage Persistence

**Files:**
- Modify: `src/components/ScanBookModal.tsx`
- Modify: `src/components/BookModal.tsx`

**Interfaces:**
- Consumes: browser localStorage API.
- Produces: scan state recovery on modal mount.

- [ ] **Step 1: Set up initialization initializers in ScanBookModal**
  Initialize `mode`, `queue`, `draftBook`, `draftLocationId` and `state` from localStorage:
  ```typescript
  const [mode, setMode] = useState<ScanMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scan_modal_mode') as ScanMode;
      if (saved === 'single' || saved === 'location') return saved;
    }
    return 'single';
  });

  const [queue, setQueue] = useState<QueuedBook[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('multi_scan_queue');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return [];
  });

  const [draftBook, setDraftBook] = useState<Book | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('single_scan_draft');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return null;
  });

  const [draftLocationId, setDraftLocationId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('single_scan_draft_location') || '';
    }
    return '';
  });

  const [state, setState] = useState<ScanState>(() => {
    if (typeof window !== 'undefined') {
      const hasDraft = localStorage.getItem('single_scan_draft');
      if (hasDraft) return 'loaded';
    }
    return 'idle';
  });
  ```

- [ ] **Step 2: Add useEffects to save states to localStorage**
  Add state-saving logic to `ScanBookModal.tsx`:
  ```typescript
  useEffect(() => {
    localStorage.setItem('scan_modal_mode', mode);
  }, [mode]);

  useEffect(() => {
    if (queue.length > 0) {
      localStorage.setItem('multi_scan_queue', JSON.stringify(queue));
    } else {
      localStorage.removeItem('multi_scan_queue');
    }
  }, [queue]);

  useEffect(() => {
    if (draftBook) {
      localStorage.setItem('single_scan_draft', JSON.stringify(draftBook));
      localStorage.setItem('single_scan_draft_location', draftLocationId);
    } else {
      localStorage.removeItem('single_scan_draft');
      localStorage.removeItem('single_scan_draft_location');
    }
  }, [draftBook, draftLocationId]);
  ```

- [ ] **Step 3: Clear storage when book is added or discarded**
  - In `handleSaveNew` (lines 640-644): clear the draftBook and local storage:
    ```typescript
    localStorage.removeItem('single_scan_draft');
    localStorage.removeItem('single_scan_draft_location');
    ```
  - In `handleSaveAll` (when queue finishes or clears):
    ```typescript
    localStorage.removeItem('multi_scan_queue');
    ```
  - Create a `handleDiscardDraft` callback in `ScanBookModal.tsx`:
    ```typescript
    const handleDiscardDraft = () => {
      setDraftBook(null);
      localStorage.removeItem('single_scan_draft');
      localStorage.removeItem('single_scan_draft_location');
      setState('idle');
      onClose();
    };
    ```
    And pass `onDelete={handleDiscardDraft}` to `<BookModal>` inside [ScanBookModal.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanBookModal.tsx#L849).

- [ ] **Step 4: Update BookModal to invoke onDelete for discard**
  In [BookModal.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/BookModal.tsx):
  Update `handleConfirmDelete` to call `onDelete` if it is a new book:
  ```typescript
  const handleConfirmDelete = () => {
    setIsConfirmingDelete(false);
    if (onDelete) {
      onDelete(book.id);
    } else {
      onClose();
    }
  };
  ```

- [ ] **Step 5: Run Linting & Project Build**
  Run: `bun run lint`
  Run: `bun run build`
  Expected: Success for both commands.

- [ ] **Step 6: Commit Task 6**
  ```bash
  git add src/components/ScanBookModal.tsx src/components/BookModal.tsx
  git commit -m "feat: persist scanner state to localStorage to prevent data loss on accidental modal closes"
  ```
