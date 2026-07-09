# Library Edit Mode — Design Spec

Date: 2026-07-09

## Goal

Add a multi-select "Edit Mode" to the Books screen (`Dashboard.tsx`) for bulk-moving or bulk-deleting books, without redesigning the existing UI, grid, or design system. Follows the existing cozy-journal visual language and reuses existing components/patterns wherever possible.

## State

`Dashboard` gains two pieces of state:
- `isEditMode: boolean`
- `selectedBookIds: Set<string>`

Everywhere the header currently branches on `isScrolled` to choose compact vs. expanded rendering, it instead branches on `isScrolled || isEditMode`. This is the single mechanism that satisfies "the header stays in its compact/scrolled state while editing, regardless of actual scroll position, until Done is pressed" — no separate lock flag needed.

`exitEditMode()` clears both `isEditMode` and `selectedBookIds` together; there's no way to leave edit mode with a non-empty selection left dangling.

## Header Behavior

### Desktop (`rightNav`, currently a static `<LogoutLink />`)

Becomes a 3-way conditional, matching the existing `leftNav` `AnimatePresence`/blur-crossfade pattern already used for the Manage Locations ↔ Search toggle:

| State | Right nav shows |
|---|---|
| Not scrolled, not editing | `Logout` (unchanged, current behavior) |
| Scrolled, not editing | `Edit` — new, styled identically to the header's `Search`/`Clear search` trigger: blue (`var(--accent-primary)`), same font/weight/size (italic serif, 32px... actually matches the *header* trigger which uses `font-instrument-sans`, not the hero's serif — see implementation note below), same wavy underline (`textDecoration: 'underline wavy var(--accent-primary)'`), same position/spacing as the current Logout slot |
| Editing (any scroll position) | `Done` — same styling as `Edit`, calls `exitEditMode()` |

Clicking `Edit` calls `enterEditMode()` (sets `isEditMode = true`; selection starts empty).

**Implementation note:** the header's existing `Search`/`Clear search` trigger button style (lines ~500-514 in current `Dashboard.tsx`) is the literal style to copy for `Edit`/`Done` — not the hero title's search pill. That's the "existing Search action" referenced in the requirements, since it's the one that lives in the same compact header row as the right-nav slot.

### Mobile

No changes to the mobile header icons (search/hamburger stay as-is). `MobileMenu` gains a new row — `Edit Library` — alongside the existing `Manage Locations` and `Logout` rows, calling `enterEditMode()` and closing the menu.

To exit edit mode on mobile: the mobile header's compact row (`.mobile-header-row`, currently showing `displayLabel` as a plain `<h1>` when scrolled) renders a small `Done` text button in place of that title *only while `isEditMode` is true* — same blue/wavy-underline treatment as desktop's `Edit`/`Done`, positioned where `mobile-header-actions` already sits (to the right of the title). This is the one small addition beyond "no changes to mobile header icons": it's additive (only appears in edit mode) and doesn't alter the search/hamburger icons themselves.

## Selection & Grid

`BookCard` gains two new props: `editMode: boolean`, `selected: boolean`, plus the toggle callback. Grid layout (`styles.booksGrid`, `.books-grid` CSS) is untouched — this is purely a per-card visual/behavioral change.

- In edit mode, clicking a card toggles membership in `selectedBookIds` instead of calling `onClick(book)` (which opens `BookModal`).
- Not in edit mode: behavior is unchanged.
- Selected visual: a thin `--accent-primary` ring around the cover (inset/outset `boxShadow`, reusing the existing hover shadow mechanism rather than introducing a new visual system) plus a small circular checkmark badge in the cover's top-right corner.
- Selection persists across scroll (it's just component state keyed by book id, unaffected by scroll position).

## FABs

The existing single `AnimatePresence`-wrapped Scan FAB block becomes a 3-way branch:

1. `(isScrolled || isHeaderSearching) && !isEditMode` → Scan FAB only (unchanged from today)
2. `isEditMode && selectedBookIds.size > 0` → Delete + Move FABs, stacked
3. Otherwise → no FAB

All three reuse `styles.scanFab` as their base style (56px circle, `var(--bg-sheet)` background, same shadow), just repositioned/re-keyed, and the same `{ opacity: 0, scale: 0.8 } → { opacity: 1, scale: 1 }` transition already used for Scan — so the Scan⇄stack swap reads as one continuous motion language, not a new animation.

Stack order: **Delete** takes the original Scan slot (`bottom: 32px`, `right: 32px`) — closest/most reachable. **Move** sits above it (`bottom: 104px`, `right: 32px`) — 56px button height + 16px gap above Delete.

Icons: simple line-art SVGs matching the Scan FAB's existing inline-SVG style (`stroke="var(--accent-primary)"`, `strokeWidth={1.75}`, `strokeLinecap="round"`) — a box-with-arrow glyph for Move, a trash glyph for Delete. No new icon library introduced (Scan FAB doesn't use `material-symbols-outlined`, so these don't either, for visual consistency within the FAB family specifically).

## Delete Flow

Clicking the Delete FAB opens a small inline confirm card anchored just above the FAB stack — visually cloned from `BookModal`'s existing `confirmDeleteRow`/`confirmDeleteBtn`/`confirmCancelBtn` pattern (text + destructive red confirm button + plain-text cancel), not a full modal. This matches the existing per-book delete confirmation pattern rather than introducing a new confirmation UI.

On confirm:
```
await supabase.from('books').delete().in('id', Array.from(selectedBookIds))
```
Then: optimistically remove the deleted books from `books` state, clear `selectedBookIds`, call `exitEditMode()`, show a toast via the existing `showToast` mechanism ("Deleted N books").

On cancel: closes the confirm card, selection and edit mode remain untouched.

## Move Flow

New `BulkMoveModal` component (`src/components/BulkMoveModal.tsx`), visually cloned from `AddLocationModal`'s shell:
- Same backdrop (`rgba(17, 22, 37, 0.25)`, centered flex)
- Same sheet sizing (`maxWidth: 380px`, `padding: 28px 24px 24px 24px`, `boxShadow: 0 12px 30px rgba(17, 22, 37, 0.12)`)
- Same `CLOSE` button (top-right, same position/typography)
- Same title/subtitle typography treatment
- Same entrance/exit animation (`opacity/y/blur`, 0.3s)
- Same cancel/submit button pair styling (`cancelBtn`/`submitBtn`)

Its form body is the room → shelf cascading `<select>` pair lifted from `BookModal`'s existing edit-location form (`selectField`/`selectFieldWidth` styles, progressive disclosure of the shelf dropdown once a room is picked via the same blur/slide `AnimatePresence`) — reusing that logic because this is picking an *existing* location for N books, not authoring a new one (which is what `AddLocationModal`'s text-input form is for).

On submit:
```
await supabase.from('books').update({ location_id }).in('id', Array.from(selectedBookIds))
```
Then: update `location` on all selected books in local `books` state, clear `selectedBookIds`, call `exitEditMode()`, close the modal, toast confirmation ("Moved N books to <room>").

If the user picks a room with no specific shelf (same "room-only" case `BookModal.handleSaveLocation` already handles), reuse that same find-or-create-room-only-shelf logic rather than duplicating it — likely by extracting that helper out of `BookModal` into a shared location so both components call it. (Implementation plan should confirm whether it's worth extracting vs. small acceptable duplication, given it's ~15 lines.)

## Data Layer

**No schema changes required.** `shelves` and `books` RLS policies already scope every operation by `auth.uid() = user_id` per row (see `supabase/schema.sql`). Supabase's `.in('id', [...])` bulk `update`/`delete` evaluates the same row-level policies as single-row `.eq('id', ...)` calls — bulk move and bulk delete work against the existing schema and policies unmodified.

## Animations

No new animation primitives. Everything reuses transitions already present in `Dashboard.tsx`:
- FAB swap: existing `{ opacity: 0, scale: 0.8 } ↔ { opacity: 1, scale: 1 }`, `duration: 0.3, ease: 'easeOut'`
- Header slot swap (Logout ↔ Edit ↔ Done): existing blur-crossfade `AnimatePresence mode="wait"` pattern already used for Manage Locations ↔ Search
- Selection badge appearance: reuse the existing card-hover shadow/scale transition timing (`duration: 0.2`)
- Modal (`BulkMoveModal`) and confirm card: reuse `BookModal`/`AddLocationModal`'s existing entrance/exit timing

## Out of Scope

- Redesigning the Library screen, grid, or typography
- New bulk actions beyond Move/Delete (architecture should make adding more straightforward later, but none are built now)
- Changing how single-book edit/delete/location-change works
