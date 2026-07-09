# Mobile Responsive Overhaul — Design

**Date:** 2026-07-09
**Scope:** `≤640px` viewports only. Desktop (`>640px`) rendering, styling, and behavior must remain byte-for-byte unchanged.

## Problem

The app's layout, header nav, search, hero animation, and modals were all designed and hand-tuned for desktop. On phones:

- The header's "My Personal Library" title + "Manage Locations" + "Search" + "Logout" nav links overlap/cramp at narrow widths.
- The hero flipbook animation (180×220px) and its surrounding fixed vertical spacing dominate the first screen on a phone.
- The hero "Search" control is an italicized word embedded mid-sentence that expands into an inline pill — a layout concept that only works with generous horizontal space.
- Several fixed pixel font sizes (32px hero title, 2.5rem logo) don't scale down.
- `BookModal`, `FilterPanel`, `ScanBookModal`, and `ManageLocationsModal` all position their close button at `top: -36px` relative to the panel, inside a backdrop with only `24px` padding. On mobile this clips the button off the visible screen — it's present in the DOM but untappable.
- Various small interactive elements (nav links, icon buttons) don't meet a 44×44px minimum touch target.

## Approach

All changes are gated behind `@media (max-width: 640px)` (matching the existing breakpoint already used for `.book-modal-panel` in `globals.css`). New mobile-only markup renders unconditionally in JSX but is `display: none` above 640px via CSS; existing desktop nav elements get a mobile-hide class. No desktop CSS rule's *default* (non-media-query) values change, and no desktop-only code path's logic changes.

This means editing shared files (`Dashboard.tsx`, `globals.css`, the modal components) is in scope, but every visual/behavioral delta must live inside a `max-width: 640px` media query or a class only applied/shown at that width.

## Design

### 1. Header (mobile)

- **Wordmark**: replace the centered "My Personal Library" `display-serif` title with a compact **"MPL"** mark, small font-size, tight/negative letter-spacing, anchored top-left (not centered). It keeps the existing fade-into-"Currently showing X" crossfade behavior on scroll — only its size/position/copy differ from desktop.
- **Hamburger button** (☰), top-right. Replaces the "Manage Locations" text link and the "Search"/header-search-trigger button on mobile — those, plus the desktop `LogoutLink`, are hidden via CSS at this breakpoint.
- **Search icon button**, mobile-only, in the same top-right cluster as the hamburger (e.g. immediately to its left), opens the mobile search overlay (see §3).
- Scan FAB stays bottom-right, unchanged (already an adequately-sized circular tap target).

### 2. Hamburger menu

- New mobile-only component (e.g. `MobileMenu`), opened/closed via a new `isMobileMenuOpen` state in `Dashboard.tsx` (net-new state, does not interact with existing `isScrolled`/`isSearching`/`isHeaderSearching` state).
- **Backdrop**: full-screen dim + blur overlay (same `backgroundColor: rgba(...); backdropFilter: blur(...)` pattern already used by `BookModal`/`FilterPanel`/etc.), rendered behind the menu content.
- **Content**: panel slides down from under the header (framer-motion height/opacity or y-translate transition), containing two links — "Manage Locations" and "Logout" — each a full-width tappable row (≥44px height). A staggered fade/slide-in for the links, consistent with the app's existing motion language (blur+opacity transitions used elsewhere).
- Closes on: tapping a link (after firing its action), tapping the backdrop, or Escape — same dismissal pattern as the existing modals.
- Each link's action reuses existing handlers: "Manage Locations" → `setIsManageLocationsOpen(true)`; "Logout" → reuse `LogoutLink`'s sign-out logic (extract if needed so both the desktop link and the mobile menu row share one implementation).

### 3. Search (mobile)

- Tapping the mobile search icon opens a **full-width search bar overlay** near the top of the screen — not the desktop's inline "pill embedded in a sentence" pattern.
- **Same overlay treatment as the hamburger menu**: full-screen dim + blur backdrop behind, search bar + results context on top.
- Contains: a text input (autofocus), a visible close (×) control, and reuses the existing `commitSearch()` / `clearSearch()` logic and `searchQuery`/`committedQuery` state already in `Dashboard.tsx` — no new search-matching logic.
- On mobile, the hero's inline "Search"-as-interactive-word sentence is not rendered as interactive; the hero text becomes static/descriptive only. The real search entry point is the icon → overlay.

### 4. Hero animation & spacing

- `HeroAnimation`'s SVG shrinks from 180×220 to roughly 90×110 at this breakpoint (viewBox/preserveAspectRatio unchanged, just the rendered `width`/`height`).
- Surrounding vertical spacing (`heroContainer` height/transform, `mainLayout` padding-top, `booksSection`'s negative top margin) gets mobile-only overrides so the hero + descriptive text + shelf-grid peek all fit more compactly on a phone screen, without changing the desktop `calc(100vh - 130px)` / fixed px values.

### 5. Typography

- `heroTitle` (32px, `whiteSpace: nowrap`) gets a mobile override: smaller font-size (~20–22px) and wrapping allowed instead of forced single-line.
- Header/logo and nav text sized down appropriately to fit within a phone width without overlap.

### 6. Modal close buttons & touch targets

- Root-cause fix: on mobile, override `closeBtn` position for `BookModal`, `FilterPanel`, `ScanBookModal`, and `ManageLocationsModal` from `top: -36px` (floats above the panel, clipped by the backdrop's 24px padding) to sit **inside** the panel's top-right corner, with a ≥44×44px hit area (padding added around the existing glyph/label, not a visual redesign).
- `AddLocationModal`'s close button (already `top: 20px; right: 20px`, inside the panel) is checked for touch-target size only.
- Sweep other small interactive controls (nav links, icon buttons, genre/tag pills used as controls) for a ≥44×44px tappable area at this breakpoint, via padding/hit-area, not visual resizing.

### Out of scope

- No desktop visual or behavioral changes.
- No changes to Supabase calls, data model, or non-mobile component logic.
- No changes to breakpoints/behavior above 640px.

## Testing

- Manual verification in a phone-width viewport (e.g. browser devtools at 375×667 and 414×896): header layout, hamburger open/close + blur, search overlay open/close + functioning search, hero sizing, each modal's close button reachability, and tap-target spot checks.
- Verify desktop (e.g. 1440px) is visually identical to current `main` before/after via a quick side-by-side.
