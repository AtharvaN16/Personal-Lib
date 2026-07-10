# Scan by Location — Design

## Problem

Cataloguing many books from the same physical shelf currently requires selecting Room + Shelf individually for every scanned book, inside the `BookModal` that `ScanBookModal` swaps into after each lookup. This is the dominant real-world workflow (someone stands at one shelf and scans a stack of books) and today it costs one full location-selection interaction per book.

## Goal

Add an optional **Scan by Location** mode to the existing `ScanBookModal`: pick a default Room/Shelf once, then scan repeatedly with each book auto-assigned that location and appended to an in-modal queue, with cheap per-book overrides and a batch save. The existing single-scan flow (scan → `BookModal` → assign location → save) is unchanged and remains the default when this mode isn't enabled.

## Non-goals

- No changes to `BookModal`'s or `BulkMoveModal`'s existing behavior or markup.
- No persistence of the scanning session (default location, queue) beyond the mounted lifetime of the modal — closing/cancelling clears everything.
- No redesign of visual language: colors, radii (`0px` throughout, per existing modals), typography, shadows, and animation curves are all reused as-is.

## Approach

Extend `ScanBookModal` in place with a `mode: 'single' | 'location'` state, defaulting to `'single'`. The Room/Shelf `<select>` pair is duplicated locally within `ScanBookModal` rather than extracted into a shared component — this matches the codebase's existing convention (`BookModal` and `BulkMoveModal` already each carry their own independent copy of this exact form) and keeps the change fully additive: zero lines touched in `BookModal.tsx` or `BulkMoveModal.tsx`.

Rejected alternative: extract a shared `<LocationPicker>` component used by all three modals. More DRY, but touches two working, unrelated modals to support an optional new feature, for no functional gain — contradicts the "don't redesign, stay additive" constraint on this feature.

## Entry point

On the existing idle "Scan the book" screen, add a small text link below the manual-ISBN input: **"Scan by Location →"**. Clicking it swaps the idle prompt (not the whole modal) for a compact setup view:

- The same Room/Shelf `<select>` pair styled like `BulkMoveModal`'s form (room select → progressively-disclosed shelf select)
- "Start Scanning" (primary button, `--accent-primary` style, matches `styles.retryBtn`/`formSaveBtn` conventions), enabled once a Room is chosen (Shelf optional)
- "Cancel" (text link) returns to the normal idle screen, `mode` stays `'single'`

Choosing "Start Scanning" sets `mode = 'location'`, stores `defaultLocationId`/`defaultLocationObj`, and transitions into the active queue view.

## Active queue view

Single flex-column modal, top to bottom:

1. **Header** — CLOSE button, unchanged.
2. **Default location strip** — "Scanning into: *Living Room • Shelf 1*" (muted secondary text, same tokens as `BookModal`'s `locationText`) with a small "Change" link. Clicking it swaps the strip for the same Room/Shelf selects used in setup, scoped to updating just `defaultLocationId`/`defaultLocationObj`. This does **not** retroactively touch already-queued rows (see State model below).
3. **Scanner controls** — the existing scan icon + "Scan the book" prompt + manual-ISBN field/form, always mounted and listening while in the queue view (`useHardwareScanner` active condition extended to include this state).
4. **Scanned queue list** — see Queue row below. Scrollable once the modal reaches max height.
5. **Save All** — primary button, fixed at the bottom, disabled when the queue is empty or while a save is in flight.

### Height behavior

Today, `ScanBookModal`'s non-`'loaded'` states apply the `book-modal-panel` CSS class, which hard-pins `height: 480px` (so the swap into the real `BookModal` on lookup success doesn't visually jump). The active queue view must **not** use that class. Instead:

- Outer panel: `maxHeight: min(720px, 85svh)`, `overflow: hidden`, `display: flex; flexDirection: column` (mirrors `ManageLocationsModal`'s `.modal` pattern).
- Header, default-location strip, scanner controls, and the Save All button: `flexShrink: 0`.
- Queue list container: `flex: 1; minHeight: 0; overflowY: auto`.

This makes the panel grow naturally with queue content (no fixed height, no explicit resize logic) until it hits the cap, at which point only the queue list scrolls — everything else stays put. This is the same structural pattern already used by `ManageLocationsModal`'s room list.

## Per-scan flow (mode === 'location')

`runLookup` branches on `mode`:

- **`'single'`** — unchanged: sets `draftBook`, transitions `state` to `'loaded'`, renders `BookModal`.
- **`'location'`** — on successful lookup:
  1. Duplicate check against `books` prop **and** the current `queue` (same ISBN-or-title+author logic as today's `handleSaveNew`). On a hit: `showToast('"Title" already exists in library')`, discard the result, stay on the queue view. No queue entry added.
  2. Otherwise, append a new row to `queue`: `{ id: crypto.randomUUID(), title, authors, isbn, cover_url, publisher, published_date, description, locationId: defaultLocationId, location: defaultLocationObj, overridden: false, rowState: 'idle' }`.
  - On lookup failure (`fetchBookByIsbn` returns null/throws): `showToast('Couldn't find that book — ISBN "…"')`. Stay on the queue view, ready for the next scan — no full-screen error state (that screen remains exclusive to `'single'` mode).

During the lookup itself, the scan icon/prompt area shows a small inline "Looking up…" swap (icon dims / spinner replaces the `qr_code_scanner` glyph) rather than the full skeleton layout used in `'single'` mode — avoids layout jank between consecutive scans since there's no cover-preview step in this mode.

`useHardwareScanner`'s `active` condition becomes `(mode === 'single' && state === 'idle') || (mode === 'location' && queueViewReady)`, where `queueViewReady` is true whenever the queue view is mounted and not mid-lookup.

## Queue row

Each row: thumbnail (~40×56, reusing `BookModal`'s `getPlaceholderColor`/`getSpineColor` fallback for missing `cover_url`), title, author below the title, then `Room • Shelf` (or just `Room` if no shelf) as muted secondary text, then three actions: **Save**, **Change**, **Remove**. Styling follows the existing list-row conventions from `ManageLocationsModal` (`displayRow`, `iconBtn`, gap/padding scale) rather than inventing new patterns.

- **Change** — swaps the row's location text for the same compact Room/Shelf selects (mirrors the default-location "Change" interaction), scoped to that row only. Saving it sets `overridden: true` on the row and updates its `locationId`/`location`. Cancelling reverts to the row's prior location text.
- **Save** — inserts that single row via the same Supabase insert path as today's `handleSaveNew` (using the row's current `locationId`). Row's `rowState` becomes `'saving'` (Save button disabled, shows "Saving…"); on success the row is removed from `queue` and `onBookAdded` is called so it lands in the dashboard grid immediately; on failure, `rowState` reverts to `'idle'` and a toast reports the failure, row stays queued.
- **Remove** — filters the row out of `queue` immediately, no confirmation. (Unlike `BookModal`'s delete-confirm, this is an unsaved draft row — low stakes, and the "fast, lightweight" goal argues against an extra confirmation click here.)

## State model

```
mode: 'single' | 'location'
locationSetupOpen: boolean          // true while choosing the initial default, before "Start Scanning"
defaultLocationId: string
defaultLocationObj: { room: string; bookshelf: string } | null
editingDefault: boolean             // default-strip "Change" is open
queue: QueuedBook[]
  QueuedBook = {
    id: string
    title, authors, isbn, cover_url, publisher, published_date, description
    locationId: string
    location: { room: string; bookshelf: string } | null
    overridden: boolean
    rowState: 'idle' | 'saving'
    editingLocation: boolean        // this row's "Change" is open
  }
```

Changing `defaultLocationId`/`defaultLocationObj` via the strip's "Change" only affects **future** appends to `queue` — existing rows keep whatever location they were assigned at scan time, regardless of `overridden`. This avoids retroactively moving books the user already glanced at and accepted.

Unmounting `ScanBookModal` (close/cancel) discards all of the above — no persistence layer, no localStorage, nothing written until a row is explicitly saved.

## Error handling

- Lookup failure → toast, stay on queue view (no full error screen in this mode).
- Duplicate on scan → toast, discard, stay on queue view.
- Row save failure → toast, row stays queued with `rowState` reset to `'idle'` so it's retryable.
- Save All partial failure → rows that succeeded are removed; rows that failed stay queued; one summary toast reports the failure count. (Matches existing single-scan fallback behavior of not silently losing data.)

## Testing / verification

No automated test suite exists for these modals today (verified by grep — no `*.test.tsx` under `src/components`), consistent with the rest of the codebase. Verification is manual via `bun dev`:

1. Open Scan modal → "Scan by Location" → pick Room/Shelf → Start Scanning.
2. Scan/manually enter several ISBNs; confirm each lands in the queue with the default location and no interrupting popup.
3. Trigger a duplicate (re-scan an ISBN already in the library or already queued) → confirm toast + no queue entry.
4. Trigger a failed lookup (bogus ISBN) → confirm toast + queue view stays scan-ready.
5. Use "Change" on one row, confirm only that row's location updates and it's marked overridden.
6. Change the default Room/Shelf via the strip after some rows are queued → confirm existing rows are unaffected, only new scans use the new default.
7. Scan enough books to exceed the max height → confirm only the queue list scrolls, header/default-strip/scanner/Save All stay fixed.
8. Save one row individually → confirm it disappears from the queue and appears in the dashboard grid with correct location.
9. Save All → confirm all remaining rows save, queue empties, modal stays open and ready for more scans.
10. Close the modal, reopen, choose Scan by Location again → confirm no leftover queue/default from the prior session.
11. Confirm the existing single-scan flow (no "Scan by Location") is completely unaffected.
