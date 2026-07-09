# Known Issues

## Hero scroll-fade threshold doesn't match hero box height

**Where:** `src/components/Dashboard.tsx`

`heroContainer` is a static, always-viewport-tall box (`height: calc(100vh - 130px)`,
`Dashboard.tsx:790`) — it never shrinks or moves with scroll.

But `heroOpacity`, `heroScale`, `heroY` (`Dashboard.tsx:119-121`) and `isScrolled`
(`Dashboard.tsx:137`, drives the header crossfade to "Currently showing X") are all
driven by a hardcoded `[0, 150]` scroll range — a small fraction of the hero box's
real height (~800-900px on most screens).

Result: after ~150px of scroll, the hero content has fully faded and the header has
already announced "scrolled past the hero" state, but the hero's box is still fully
occupying the viewport (unchanged height), so there's another 650-750px of scrolling
before the books grid actually arrives. Reads as unexplained whitespace between the
header and the grid, most visible on short/filtered result sets.

**Fix (not yet implemented):** replace the hardcoded `150` with the hero box's actual
height (`window.innerHeight - 130`, computed on mount + resize, not per-scroll-frame)
so the content fade and header swap complete right as the box is genuinely leaving
view. This does NOT mean animating `heroContainer`'s height itself — do not do that,
it was tried and reverted (see below).

**Do not fix by shrinking `heroContainer`'s height dynamically.** Two attempts at
this caused a scroll-feedback loop: shrinking the box while scrolled past it reduces
total document height, which can make the browser clamp `scrollY` back down, which
un-triggers whatever state drove the shrink, which regrows the box, which lets you
scroll back down again — an oscillating "magnetic" scroll fight. This is especially
visible on short pages (e.g., a filter with only 1-2 results), where the clamped
scroll position sits right at the flip threshold. Any fix here must leave
`heroContainer`'s height and total document flow height untouched during scroll.

**Status:** deferred until after the header/FAB redesign (search moving into the
header, Scan becoming a FAB) lands, since that work will likely retune these same
thresholds — fixing this now risks being redone/thrown away.
