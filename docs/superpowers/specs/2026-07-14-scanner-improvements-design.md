# Design Spec: Personal Library Scanner & System Improvements

Date: 2026-07-14  
Topic: Scanner UI/UX, LocalStorage persistence, row-level editing, API limits, animations, and toast z-index fixes.

---

## 1. Page Scroll Prevention & Auto-scroll

### Page Scroll Lock
To prevent page-level scroll when modals are open on both desktop and mobile/Safari browsers, we will lock the overflow of both `document.body` and `document.documentElement` during the lifecycle of the active modals.
* **Target Components:** `ScanBookModal.tsx`, `BookModal.tsx`, `ManageLocationsModal.tsx`.
* **Behavior:** When the modal mounts or enters a visible state, set:
  ```javascript
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  ```
  On unmount, clean up by resetting:
  ```javascript
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  ```

### Auto-scroll in Multi-Scan Mode
In the multi-scan queue view, new books are appended to the end of the queue. If the list is longer than the viewport, it should autoscroll to the bottom.
* **Target Component:** `ScanBookModal.tsx` (`mode === 'location'`).
* **Behavior:** Add a `useRef` to the `.queueList` container. Watch `queue.length` using a `useEffect`. If a new item is added (`queue.length` increases), call:
  ```javascript
  queueListRef.current?.scrollTo({
    top: queueListRef.current.scrollHeight,
    behavior: 'smooth'
  });
  ```

---

## 2. Row Level Editing for Title, Author, and Location
In multi-scan queue rows, users need the ability to edit the book's details (Title, Author, Location) directly inside the row rather than just changing the location.
* **Target Component:** `ScanQueueRow.tsx` and `ScanBookModal.tsx`.
* **State Updates:**
  * Track temporary states for `editTitle` and `editAuthor` in addition to location parameters.
  * Authors input is formatted as a comma-separated string, which gets parsed back into a `string[]` upon confirmation.
* **State Propagation:**
  * Rename/update `onConfirmLocation` to `onConfirmChanges` in `ScanQueueRowProps`:
    ```typescript
    onConfirmChanges: (id: string, title: string, authors: string[], room: string, shelfId: string) => void;
    ```
  * Update the queue element in `ScanBookModal.tsx`:
    ```typescript
    const handleConfirmQueueChanges = (id: string, title: string, authors: string[], room: string, shelfId: string) => { ... };
    ```

---

## 3. Increased API Limit for "Sharvari Nayak"
The owner of the library, Sharvari Nayak, requires a higher query limit.
* **Target File:** `src/app/api/book-lookup/route.ts`.
* **Behavior:** Inside the `GET` route, fetch the active user using `supabase.auth.getUser()`. Inspect:
  * `user.email` (checks if contains `sharvari` and `nayak` case-insensitively).
  * `user.user_metadata?.full_name` or `user.user_metadata?.name` (checks if contains `sharvari` and `nayak` case-insensitively).
* If matched, set `p_max_lookups` passed to the `consume_book_lookup_quota` RPC to `500` instead of the default `USER_DAILY_LOOKUP_LIMIT = 200`.

---

## 4. Shake and Jiggle Location Alert
When a book is scanned without a location (e.g. no default shelf is set), it is immediately placed in Edit Mode. The check (tick) and close (cross) buttons of that row must shake rapidly to indicate a location is needed, followed by a periodic gentle jiggle if left untouched.
* **Target File:** `src/app/globals.css`, `ScanQueueRow.tsx`.
* **Animations:**
  * Define `@keyframes shakeError` (rapid horizontal translation, running once for 0.5s).
  * Define `@keyframes jigglePeriodic` (small tilt, running every 3 seconds infinitely).
* **Application:**
  * Apply `shake-error` class immediately on mount if `needsLocationSaving`.
  * Apply `jiggle-periodic` after the initial shake finishes, or run a composite animation.
  * To simplify and perform beautifully, we will define CSS keyframes that combine a rapid start with a periodic rest-and-tilt cycle:
    ```css
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

---

## 5. Toast Z-Index
Toast notifications must appear above the blurry modal background overlay.
* **Target File:** `src/components/Dashboard.tsx`.
* **Change:** Set `zIndex` of the Toast Notification Container to `99999`.

---

## 6. Scanner State Persistence
To prevent scanned books from being lost when the modal is closed accidentally, we will save the scanner session state to `localStorage`.
* **Target File:** `ScanBookModal.tsx`.
* **Persisted Keys:**
  * `scan_modal_mode` (`ScanMode`): persists whether the scanner is in single scan or multi-scan/location mode.
  * `multi_scan_queue` (`QueuedBook[]`): persists the list of scanned books.
  * `single_scan_draft` (`Book`): persists the unsaved book draft in single scan mode.
  * `single_scan_draft_location` (`string`): persists the selected location ID for the single scan draft.
* **State Restoration:** Initialize state variables in `ScanBookModal` using synchronous initializer functions that read from `localStorage`.
* **State Clearing:**
  * When a book is successfully saved in single scan or multi-scan mode, clear the corresponding keys.
  * When a draft is explicitly discarded, clear the keys.
