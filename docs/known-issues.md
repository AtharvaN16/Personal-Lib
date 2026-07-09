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

**Status:** still open. The header/FAB redesign (search moving into the header, Scan
becoming a FAB) has landed, so this can be picked up now — replace the hardcoded `150`
with the hero's real height as described above.

## Grid reflow could clamp `scrollY` and falsely flip `isScrolled` (fixed)

**Where:** `src/components/Dashboard.tsx`, the `isScrolled` scroll listener.

Same root cause as the issue above (a single no-hysteresis scroll threshold), but
triggered by the *grid* shrinking instead of the hero: typing into either search pill
live-filters the books grid on every keystroke. On a heavily filtered/short result
set, that shrink could reduce total document height enough for the browser to clamp
`scrollY` back below `150`, flipping `isScrolled` to `false` mid-interaction — even
though the user never scrolled up. Two symptoms this produced:

- The header search pill appeared to "randomly close" while typing.
- After committing a search (Enter), the header would snap back to the unscrolled
  "Manage Locations"/logo state — the `isScrolled` corruption happened silently
  during typing and only became visible once `isHeaderSearching` stopped masking it.

**Fix (implemented):** `isScrolled` now uses hysteresis instead of one threshold —
collapses at `scrollY >= 150`, but only re-expands at `scrollY <= 30`. A clamp-induced
dip from grid reflow lands in the dead zone between 30 and 150 and no longer flips
the state. This is the same technique flagged as the fix for the hero-height issue
above; worth applying there too when that one is picked up.

## Hero text visibly jumps when entering/leaving search (not fixed)

**Where:** `src/components/Dashboard.tsx:330-407` (`searchContent`, `staticContent`,
`heroContent`), and `src/registry/magicui/text-animate.tsx`.

`staticContent` and `searchContent` look like two states of the same sentence
crossfading, but they're actually two **structurally different** DOM trees, overlaid
and toggled via `opacity`/`filter: blur()` (`heroContent`, `Dashboard.tsx:384-407`):

- `staticContent` renders via `TextAnimate` with `by="word"`, which splits the whole
  sentence into individual `motion.span` elements (one per word, `display:inline-block`).
- `searchContent` renders the trailing text ("for the books in your library...") as one
  continuous `<span>` with `opacity:0.4, filter:blur(5px)` — not word-split at all, and
  styled differently (always-dimmed vs `TextAnimate`'s per-word stagger-in).

Per-word `inline-block` spans and one continuous text run don't lay out pixel-identically
— kerning, wrap points, and word positions drift slightly between the two trees. So the
"crossfade" isn't smoothly morphing one sentence into another; it's fading out one layout
and fading in a *different* one that happens to occupy roughly the same space. The visible
jump when clicking "Search"/closing search is that structural mismatch, not a missing
CSS transition — no amount of easing/duration tuning on the existing crossfade fixes it.

**Real fix (not yet implemented):** extend `TextAnimate`'s `highlights` API with an
optional custom-render override (e.g. `{ match: 'Search', render: () => <SearchPill .../> }`)
so the "Search" word can swap to the pill *within the same tree* `TextAnimate` already
builds, and move the "rest of sentence" dimming into `TextAnimate` itself (a per-word
opacity/blur applied to every span except the active one) rather than a separately
structured `<span>`. End state: one `TextAnimate` instance rendered the whole time in the
hero — only the first word's content changes between "clickable text" and "pill" — instead
of two independently-built trees crossfading. This is real scope: it changes the shared
`TextAnimate` component's public API, not just `Dashboard.tsx`.

**Lighter mitigation (not yet tried):** without touching `TextAnimate`, get
`searchContent`'s trailing `<span>` to match `staticContent`'s per-word `inline-block`
span structure as closely as possible (same word-splitting, same stagger styling, just
permanently dimmed). Lower risk, but doesn't eliminate the two-tree crossfade or
guarantee pixel parity — treat as a stopgap, not the real fix.

**Status:** open, not started. User chose to log this rather than implement either
option yet.
