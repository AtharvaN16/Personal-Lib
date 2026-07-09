# Mobile Viewport Units: Behavior, Inconsistencies, and Fixes

This document details web research into viewport width (`vw`) and viewport height (`vh`) inconsistencies on mobile browsers and WebViews, evaluates how they impact the **Personal Library Database** codebase, and provides specific recommendations.

---

## 1. Viewport Height (`vh`) Inconsistencies

On mobile devices, dynamic UI elements (address bars, navigation bars, tab bars) expand and retract as the user scrolls. Historically, this created major layout issues.

### The Problem
Traditional viewport height (`100vh`) is calculated based on the **maximum height** of the viewport as if the browser's dynamic toolbars are completely hidden (the "large viewport"). 
- **Initial Load:** When the user lands on a page and toolbars are fully visible, an element with `height: 100vh` will be taller than the actual visible screen. Content at the bottom will bleed underneath the navigation bar.
- **Scroll Resizing:** When the user scrolls, the address bar retracts, changing the visible height. Sizing with `vh` can cause jarring layout recalculations and jumpy content shifts.

### The W3C CSS Spec Solution
The [CSS Values and Units Module Level 4 Specification](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths) introduced three viewports to target these states:

1. **Small Viewport (`svh` / `svw`)**: The viewport size assuming all dynamic browser UI elements are **fully expanded** (visible). This is the safest, most stable height for ensuring elements remain visible and never bleed off-screen.
2. **Large Viewport (`lvh` / `lvw`)**: The viewport size assuming all dynamic browser UI elements are **fully retracted** (hidden). This behaves identically to legacy `vh` on most mobile browsers.
3. **Dynamic Viewport (`dvh` / `dvw`)**: The viewport size that **dynamically updates** as browser UI elements collapse or expand. While precise, it can cause layout reflows and stuttering as the browser recalculates the height during scrolling.

---

## 2. Viewport Width (`vw`) Inconsistencies

While viewport height gets the most attention, viewport width (`vw`) has its own set of problems.

### The Scrollbar Problem
Per W3C specification, `100vw` represents the width of the viewport **including the width of any scrollbar**.
- On platforms or browsers that use persistent classic scrollbars, an element sized to `100vw` will exceed the available layout width by the width of the vertical scrollbar. This triggers a horizontal scrollbar (`overflow-x`).
- **Fix:** In almost all structural layout scenarios, `width: 100%` is superior to `width: 100vw` because percentages are relative to the parent container and exclude scrollbars.

### Pinch-Zoom and Layout vs. Visual Viewport
On mobile browsers, there are two viewports:
- **Layout Viewport:** The virtual window where the browser renders the page. This doesn't change when zooming.
- **Visual Viewport:** The portion of the page currently visible. This shrinks when the user pinch-zooms.
- `vw` and `vh` are calculated against the **Layout Viewport**. If an element uses `width: 100vw`, zooming in will not resize it relative to what the user sees, which can cause elements to scale unpredictably.

---

## 3. Keyboard Interactions & `interactive-widget`

When the virtual keyboard is toggled on mobile browsers:
- By default, iOS Safari and Android Chrome treat the keyboard as an overlay over the **Visual Viewport**, leaving the **Layout Viewport** unchanged. This means `position: fixed; bottom: 0;` elements (like action bars) end up hidden under the keyboard.
- **Modern Solution:** You can control this behavior using the `interactive-widget` parameter in the HTML `<meta name="viewport">` tag:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">
  ```
  This forces the browser to shrink the **Layout Viewport** when the keyboard opens, causing elements styled with `100dvh` or `position: fixed` to automatically slide up above the virtual keyboard.

---

## 4. Local Codebase Analysis

Below is an audit of current viewport unit usages in the **Personal Library** project:

### Modal Backdrops
* **Location:** Affected modals include:
  - [ScanBookModal.tsx:318-319](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanBookModal.tsx#L318-L319)
  - [BookModal.tsx:600-601](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/BookModal.tsx#L600-L601)
  - [AddLocationModal.tsx:235-236](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/AddLocationModal.tsx#L235-L236)
  - [BulkMoveModal.tsx:203-204](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/BulkMoveModal.tsx#L203-L204)
  - [ManageLocationsModal.tsx:540-541](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ManageLocationsModal.tsx#L540-L541)
  - [FilterPanel.tsx:184-185](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/FilterPanel.tsx#L184-L185)
* **Code:**
  ```javascript
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    ...
  }
  ```
* **Impact:** 
  1. `width: '100vw'` can trigger unnecessary horizontal scroll shifts if a scrollbar is active behind the modal.
  2. `height: '100vh'` will make the backdrop extend below the screen on initial load when dynamic address bars are visible, and centering the modal box inside it can push modal actions (like the Close or Save buttons) below the visible viewport fold.

### Main Layout and Hero Container
* **Location:** [Dashboard.tsx:1293](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/Dashboard.tsx#L1293) and [Dashboard.tsx:1301](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/Dashboard.tsx#L1301)
* **Code:**
  ```javascript
  mainLayout: {
    minHeight: '100vh',
    ...
  },
  heroContainer: {
    height: 'calc(100vh - 130px)',
    ...
  }
  ```
* **Impact:** On mobile browsers, `calc(100vh - 130px)` makes the hero box taller than the initially available space, forcing the user to scroll to see the full content and causing the scroll indicator or layout bounds to feel inconsistent.

### Global Styles
* **Location:** [globals.css](file:///Users/atharvanayak/Developer/Personal%20Library/src/app/globals.css)
* **Code:**
  - Line 62: `body::before` (grain texture overlay) uses `width: 100vw; height: 100vh;`
  - Line 75-76: `body::after` (glow layer) uses `width: 140vw; height: 140vh;`
  - Line 101: `.page-container` uses `min-height: 100vh;`
  - Line 276: `.book-modal-panel` uses `max-height: 90vh;` on mobile.
  - Line 514: `.hero-container-mobile` uses `min-height: 60vh !important;`

---

## 5. Actionable Recommendations

### Recommendation A: Fix Modal Backdrops (Easiest & Most Robust)
Instead of using viewport dimensions for fixed overlays, rely on coordinate boundaries. This avoids all scrollbar, layout, and visual viewport inconsistencies.

```diff
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
-   width: '100vw',
-   height: '100vh',
+   right: 0,
+   bottom: 0,
```

### Recommendation B: Update Modal Limits & Panels to `dvh` or `svh`
For panels like `.book-modal-panel` which has a max height of `90vh`, update it to use `dvh` or `svh` to guarantee it never expands beyond the active screen boundaries.

```diff
  .book-modal-panel {
    height: auto;
-   max-height: 90vh;
+   max-height: 90svh; /* Keeps it within the visible viewport under dynamic bars */
+   max-height: 90dvh; /* Fallback/alternative */
  }
```

### Recommendation C: Switch Dashboard Hero to use dynamic heights or flex layouts
For the `heroContainer` height, we can replace `100vh` with `100dvh` (or `100svh` to avoid reflow shifts):
```javascript
  heroContainer: {
    height: 'calc(100svh - 130px)', // Stable small viewport height minus header
  }
```

---

## 6. Sources & References
- **W3C Working Draft CSS Values and Units Module Level 4:** [https://www.w3.org/TR/css-values-4/#viewport-relative-lengths](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths)
- **MDN Web Docs on Viewport Units:** [https://developer.mozilla.org/en-US/docs/Web/CSS/Viewport_concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/Viewport_concepts)
- **Chrome Developers - Resizing behaviors:** [https://developer.chrome.com/blog/viewport-resize-behavior/](https://developer.chrome.com/blog/viewport-resize-behavior/)
