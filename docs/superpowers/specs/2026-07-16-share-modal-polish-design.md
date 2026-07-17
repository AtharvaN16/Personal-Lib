# Share Library Modal Polish — Design

## Problem

`ShareLibraryModal.tsx` (built in [[2026-07-15-public-share-library-design]]) works, but has rough edges: it always shows every control regardless of whether sharing is on, the toggle thumb's containment math is fragile (position: absolute with no `left` anchor, relying on accidental static-position placement), the QR code is sized for a screen rather than a shelf label, the caption is static, and the actions are full-width buttons rather than a lightweight toolbar. Printing produces one full-page QR code instead of small, cuttable cards.

This is a polish pass, not a redesign: same modal shell, same typography/spacing/color tokens, same animation language (Framer Motion, blur/slide entrance). No new screens, no new routes.

## Goals

- Modal opens with sharing visually collapsed (title, subtitle, toggle only) regardless of the toggle's current DB-backed state on repeat opens — content reveals with a smooth height/fade animation when the toggle is ON, and collapses in reverse when turned OFF.
- Fix the toggle so the thumb is structurally guaranteed to stay within the track in both states, with iOS-like proportions/easing.
- Smaller QR code, with generous surrounding whitespace, using a color the user can pick from a small swatch row (reusing `ThemeSwatches`).
- Editable message beneath the QR, shown as prominent styled text by default; an "Edit Message" toolbar icon flips it into an inline input.
- Replace the large action buttons (Print / Copy / Share) with compact icon toolbars: one row under the QR (Edit Message, Print, Download PNG), one inline with the link field (Copy, Share, Regenerate).
- Printing produces small, multi-up "shelf label" cards (1/2/4/6/8 per page) styled with the app's warm background + grain texture, rather than one full-page QR code.

## Non-goals

- No server-side persistence of the message or QR color (localStorage only, per-browser).
- No "library name" / owner-attribution line on printed cards.
- No changes to the public `/share/[token]` page itself, the share API routes, or the DB schema.
- No in-app print preview screen — printing still goes through the OS print dialog, as it does today.

## Component structure

Everything stays inside `ShareLibraryModal.tsx` (no new files), reusing:
- `ThemeSwatches` (`src/components/ThemeSwatches.tsx`) for the QR color row — controlled `value`/`onChange`, no changes needed to that component.
- The app's existing inline stroke-icon convention (`viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"`, as used in `Dashboard.tsx`/`AccountMenu.tsx`) for all new toolbar icons — small inline `<svg>`s, no icon library added.
- The existing `.share-print-area` / `.no-print` / `@media print` CSS hooks in `globals.css`, extended rather than replaced.
- The existing grain-texture data-URI (`globals.css` `body::before`) — duplicated as a card-level `::before` in print CSS, since `body *` print rules don't reliably reach `body`'s own pseudo-elements.

## State additions

```
qrColor: string        // hex, default '#002CBC', persisted localStorage['share-qr-color']
message: string         // default 'Scan to see my library', persisted localStorage['share-qr-message']
editingMessage: boolean // toggles styled text ⇄ input
printMenuOpen: boolean  // inline cards-per-page control expanded/collapsed
printCount: 1|2|4|6|8   // default 4
qrPngDataUrl: string | null // captured once from the qr-code-styling instance, reused by print cards + Download PNG
```

`qrColor` and `message` are read from `localStorage` on mount (client-only `useEffect`, guarding for SSR) and written back on change.

## 1. Collapse / expand

- The existing `state.shareEnabled` boolean already gates rendering of the sharing content block (`{state.shareEnabled && state.shareUrl && (...)}`). Today the wrapping toggle+content is inside one `{!loading && (...)}` block with no exit animation.
- Wrap the sharing-content block in `AnimatePresence` and animate:
  - Outer wrapper: `height: 'auto'` ⇄ `0`, `overflow: 'hidden'`, using a measured-height approach (motion's `layout` on the wrapper is sufficient since content is the only thing changing size — no manual height measurement needed).
  - Inner content: `opacity: 0→1`, `y: 8→0` on enter (reverse on exit), `duration: 0.25`, easing to match the modal's existing `transition={{ duration: 0.3 }}` entrance so it reads as part of the same animation language.
- Toggle row (title/subtitle/switch) is unaffected and always visible — it's outside the `AnimatePresence` block.

## 2. Toggle fix

Root cause: `switchThumb` is `position: absolute` with only `top` set, no `left`; its resting position depends on the static-position fallback rather than an explicit anchor, and `x` is animated by pixel value (`2` / `20`) that was hand-tuned against that fallback rather than derived from track/thumb/inset math — fragile by construction.

Fix: make containment structural instead of coincidental.

- Track (`button`, `role="switch"`): `display: flex`, `alignItems: center`, `padding: 2px`, `boxSizing: border-box`, `width: 44px`, `height: 26px`, `borderRadius: 9999px`. `justifyContent` toggles between `'flex-start'` (off) and `'flex-end'` (on).
- Thumb (`motion.div`, flex child, no `position: absolute`): `width: 22px`, `height: 22px`, `borderRadius: '50%'`, given Framer Motion's `layout` prop so that when the parent's `justifyContent` flips, the thumb animates smoothly between its two flex positions (FLIP-based, not a hand-computed `x`).
- Transition: `{ type: 'spring', stiffness: 700, damping: 35 }` — snappy, no overshoot, close to native `UISwitch` feel.
- Because the thumb is a normal flex child sized smaller than the track's content box (44 − 2×2 padding = 40px available, 22px thumb), it is geometrically impossible for it to render outside the track, in either state, regardless of box-sizing/UA quirks.

## 3. QR section

- Size: `width`/`height` 220 → 176 in the `qr-code-styling` config; `margin` 8 → 6.
- Colors: `dotsOptions.color`, `cornersSquareOptions.color`, `cornersDotOptions.color` all use `qrColor` state instead of the `accentColor` prop. `backgroundOptions.color` stays `'#FFFDFB'`.
- After each QR (re)render, also capture a PNG data URL from the same `QRCodeStyling` instance (`qr.getRawData('png')` → `URL.createObjectURL` / blob-to-dataURL, or `qr._canvas`/`qr.download` internals — concretely: call `qr.getRawData('png')`, which resolves a `Blob`, convert via `FileReader` to a data URL) into `qrPngDataUrl` state. This backs both the "Download PNG" toolbar action and the print cards, so the QR is only ever rendered once per URL/color change, not once per printed card.
- Swatch row: `<ThemeSwatches value={qrColor} onChange={setQrColor} />` placed directly below the QR, above the message. No label needed — matches how `AccountMenu` uses it today (bare row).
- Message, default state (not editing): a `<p>` styled `textTransform: 'capitalize'`-equivalent Title Case (computed in JS when saving, so it's stored/display consistent — simplest is to title-case on input blur, not via CSS, so the stored/localStorage value and the visual value never diverge), `color: qrColor`, `fontSize: '1.05rem'`, `fontWeight: 600`, replacing the current italic serif caption. Font family stays `var(--font-instrument-sans)` (the app's UI sans, not the serif used for the old italic caption — this text is now a UI element, not a page-caption).
- Message, editing state: replaces the `<p>` with a `field-white`-styled `<input>` (same class as the link input), autofocus, `onBlur`/`Enter` commits and title-cases the value, `Escape` reverts to the last committed value.

## 4. QR actions toolbar

Single compact row of icon buttons directly under the message (inside `.no-print`, so it never shows up on the printed card):

- **Edit Message** (pencil icon) — toggles `editingMessage`. Hidden while already editing (the input's own blur/Enter handles committing).
- **Print** (printer icon) — see §6.
- **Download PNG** (download icon) — creates a temporary `<a download>` from `qrPngDataUrl` and clicks it. Disabled (dimmed, non-interactive) until `qrPngDataUrl` is populated.

Icons are `28×28px` tap targets (Apple HIG minimum touch target guidance), `20×20px` visible glyphs, `var(--text-secondary)` default / `var(--text-primary)` on hover, no borders — a plain icon row, visually secondary to the QR itself. A `title` attribute on each button provides a native tooltip and accessible name.

## 5. Link section

- `linkRow` keeps the read-only `field-white` input as the dominant element (`flex: 1`).
- The three text buttons (Copy / Share / Regenerate confirm-or-link) become three icon buttons in the same visual language as the QR toolbar, right-aligned after the input: copy icon, share icon (native share-arrow glyph), regenerate icon (circular-arrows).
- Copy: same `handleCopy` logic; icon swaps to a checkmark for 2s instead of the label swapping to "Copied!" (icon-only, so no text state to swap) — a native `title="Copy link"` / `title="Copied!"` swap covers accessibility.
- Share: same `handleShare` logic (Web Share API / clipboard fallback), unchanged.
- Regenerate: icon click reveals the existing inline confirm row (`"This invalidates the old link/QR code." [Regenerate] [Cancel]`) below the link row, unchanged in behavior — only the trigger becomes an icon instead of an underlined text link.

## 6. Print flow

Clicking the **Print** toolbar icon toggles `printMenuOpen`, animating open (Framer Motion, height/opacity, same easing family as §1) an inline segmented control of five options: `1 · 2 · 4 · 6 · 8`. Selecting a count:

1. Sets `printCount`.
2. Closes the inline control.
3. Calls `window.print()` on the next tick (after the print-only DOM below has re-rendered with the new count).

### Card grid math

Target page: US Letter, 0.5in margins → 7.5in × 10in usable area. Card target size ≈ 3.5in × 2.5in (a generous shelf-label size, matching the user's "small, for tables" instruction) with a 0.25in gap for cutting.

| printCount | columns | rows | card size (approx) |
|---|---|---|---|
| 1 | 1 | 1 | 4in × 5in, centered |
| 2 | 2 | 1 | 3.5in × 4in |
| 4 | 2 | 2 | 3.5in × 4.5in |
| 6 | 2 | 3 | 3.5in × 3in |
| 8 | 2 | 4 | 3.5in × 2.2in |

Implemented as a CSS grid on `.share-print-area` with `grid-template-columns`/`grid-template-rows` selected via a `data-print-count` attribute on the container and matching `@media print` rules in `globals.css` (kept alongside the existing print rules there, not inline styles, since print CSS needs `@media print` scoping).

### Card contents

Each of `printCount` cards renders:
- `<img src={qrPngDataUrl}>` at a fixed size appropriate to the row above (no live `qr-code-styling` re-instantiation per card — cheap `<img>` repeats).
- The message text, styled consistently with the on-screen version (Title Case, `qrColor`).
- A dashed `border` (`1px dashed rgba(17,22,37,0.25)`) as a cut guide.
- Background: `var(--bg-sheet)` plus a `::before` pseudo-element carrying the same grain SVG data-URI used by `body::before` in `globals.css` (`opacity: 0.115`, `position: absolute`, `inset: 0`, `pointer-events: none`) — declared per-card since `body`'s own pseudo-elements aren't reliably included by the existing `body * { visibility: hidden }` print rule, and we want the grain to survive printing regardless of that rule's exact reach.

`qrPngDataUrl` must exist before printing is possible — if a user clicks Print before the first QR render resolves, the toolbar's Print icon is disabled (mirrors Download PNG's disabled-until-ready state).

## Data flow summary

No new API calls. `qrColor` and `message` are pure client state mirrored to `localStorage`. Everything else (`shareToken`, `shareEnabled`, `shareUrl`, enable/disable/regenerate) is unchanged from the existing `/api/share` GET/POST flow.

## Testing

- Manual verification via the `verify` skill / dev server: toggle on/off (check collapse/expand animation and that the thumb never visually exits the track at either state), edit the message (commit via blur and via Enter, revert via Escape), change QR color and confirm the QR + message + print cards all reflect it, download PNG and confirm the file opens as a valid QR image, copy/share/regenerate the link, and print at each of the five card counts (verified via the browser's print preview, not actual paper) to confirm the grid fits the page without overflow.
