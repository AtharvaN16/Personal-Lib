---
name: Personal Library Database
description: A cozy, sketchbook-styled catalog for tracking where every physical book lives in the house.
colors:
  paper-bg: "#F4F2E4"
  sheet-white: "#FFFDFB"
  ink-primary: "#111625"
  ink-secondary: "#4E5564"
  ink-tertiary: "#868C9B"
  ink-blue: "#002CBC"
  sage-light: "#E8ECE9"
  terracotta: "#C77966"
  terracotta-light: "#F7EAE6"
  tag-parchment: "#EAE7D8"
  amber-status: "#D4A373"
  error-red: "#8B1E1E"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Instrument Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  handwritten:
    fontFamily: "Caveat, cursive"
    fontSize: "1.25rem"
    fontWeight: 400
rounded:
  none: "0px"
  sm: "8px 10px 8px 10px/10px 8px 10px 8px"
  md: "12px 15px 12px 15px/15px 12px 15px 12px"
  pill: "20px"
  fab: "30px"
  sketch: "255px 15px 225px 15px/15px 225px 15px 255px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  book-card:
    backgroundColor: "{colors.sheet-white}"
    rounded: "{rounded.none}"
    padding: "16px"
  modal-panel:
    backgroundColor: "{colors.paper-bg}"
    rounded: "{rounded.none}"
    padding: "40px 36px 36px 36px"
  tag-pill:
    backgroundColor: "{colors.tag-parchment}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
---

# Design System: Personal Library Database

## 1. Overview

**Creative North Star: "The Reading Nook"**

This is a household inventory, not a SaaS product, and it should never look or feel like one. The system reads as a personal reading nook: warm paper backgrounds, ink-blue underlines standing in for handwriting, and soft diffuse "paper" shadows instead of hard elevation. Density is low and unhurried — this app is opened a few times a week by one person, so nothing needs to compress information or perform productivity.

The palette stays close to the page: `--bg-primary` (#F4F2E4) and `--bg-sheet` (#FFFDFB) behave like paper and card stock, `--text-primary` (#111625) reads as ink rather than corporate near-black, and `--accent-primary` (#002CBC) is used sparingly as a wavy underline / accent, the way a fountain-pen doodle would mark up a page. Terracotta and sage are secondary, warm complements — never competing with the ink-blue accent.

This system explicitly rejects: cold gray SaaS dashboards, gradient text, cream-on-cream low-contrast type, generic identical card grids with icon+heading+text, sketchy/doodle SVG illustrations, side-stripe accent borders, and glassmorphism used decoratively.

**Key Characteristics:**
- Paper-and-ink palette: warm cream body, ink-blue accent used only as underline/emphasis
- Flat, square corners (`0px`) almost everywhere — the "sketchbook" feel comes from paper shadows and organic radii in isolated decorative spots, not from rounding every surface
- Soft, diffuse, low-opacity shadows (`rgba(17,22,37,0.03–0.15)`) standing in for "paper lifted off the page," never harsh drop shadows
- One serif display font (Newsreader) for headline/hero moments, one sans (Instrument Sans) for everything functional, one script (Caveat) reserved for a genuinely handwritten accent

## 2. Colors

The palette is a **Committed** strategy around a single ink-blue accent on a warm paper neutral base — not a multi-color system.

### Primary
- **Ink Blue** (`#002CBC` / `--accent-primary`): the one saturated color in the system. Used as the wavy underline beneath the active search input, and at low-opacity tints (`rgba(0,44,188,0.06–0.08)`) as a background wash behind that same search pill. Reserved for "this is active / this is being written."

### Secondary
- **Terracotta** (`#C77966` / `--accent-terracotta`): the favorited/liked-book indicator and one warm highlight (`#F7EAE6` / `--accent-terracotta-light`) used as a soft callout background in AddLocationModal.

### Tertiary
- **Sage** (`#E8ECE9` / `--accent-sage-light`): a quiet secondary neutral wash, used sparingly as an alternate soft background.

### Neutral
- **Paper** (`#F4F2E4` / `--bg-primary`): the base page/modal background — warm, matte, never pure white.
- **Sheet White** (`#FFFDFB` / `--bg-sheet`): card and input surface, one notch brighter than the page, like a card stock sitting on the paper.
- **Ink Primary** (`#111625` / `--text-primary`): body text and the universal shadow-color base (`rgba(17,22,37,…)` for every shadow in the system).
- **Ink Secondary** (`#4E5564` / `--text-secondary`): supporting text.
- **Ink Tertiary** (`#616874` / `--text-tertiary`): the quietest text — hints, the "press ⏎" helper, metadata. Darkened from an earlier `#868C9B` (~3:1 contrast, failed WCAG AA) to meet 4.5:1 against both paper backgrounds.
- **Tag Parchment** (`#EAE7D8`): genre/status tag pill background in the book modal.

### Named Rules
**The One Ink Rule.** `--accent-primary` (#002CBC) is the only saturated color allowed to read as "active state." It appears only as an underline or a low-opacity wash — never as a filled button or a large surface. If ink-blue starts covering more than a thin accent's worth of a surface, that's a violation.

**The Ink-Shadow Rule.** Every shadow in the system is `rgba(17,22,37, α)` — the same ink color as body text, just translucent. Never introduce a cool gray or pure-black shadow; it breaks the paper-and-ink cohesion instantly.

## 3. Typography

**Display Font:** Newsreader (with Georgia, serif fallback)
**Body Font:** Instrument Sans (with system sans-serif fallback)
**Label/Accent Font:** Caveat (cursive fallback) — reserved for genuinely handwritten-feeling accents, not general UI

**Character:** A restrained editorial serif for the one hero moment (the search sentence) paired with a plain, humanist sans for every functional surface — the contrast is deliberate: one line reads like a page from a novel, everything else reads like clean app chrome.

### Hierarchy
- **Display** (500, 32px, 1.4 line-height, italic in the search state): the hero sentence "Search for the books in your library…" — the only place Newsreader appears at size.
- **Body** (400, 16px, 1.5): all card text, modal copy, form labels, buttons.
- **Handwritten accent** (400, 1.25rem, Caveat): reserved for a genuine handwritten-note moment; not for buttons, labels, or body copy.
- **Label / Hint** (bold, 15px, `--text-tertiary`): the "press ⏎" search hint and similar micro-copy — small, quiet, non-competing with body text.

### Named Rules
**The One Serif Rule.** Newsreader appears in exactly one place at a time: the active hero sentence. It is never used for card titles, modal headings, or buttons — those stay in Instrument Sans so the serif keeps its "this is the one special line" weight.

## 4. Elevation

This system does not use a conventional elevation ladder (z-height implying shadow darkness). Instead it uses **paper elevation**: every shadow is a soft, low-opacity ink-tinted blur that reads as "a sheet of paper lifted slightly off the page," not "a UI layer stacked above another." Shadows scale by *softness and spread*, not by darkness — even the modal's shadow (the most "elevated" surface in the app) stays under 0.15 opacity.

### Shadow Vocabulary
- **Paper rest** (`--paper-shadow`: `0 4px 15px rgba(17,22,37,0.03), 0 2px 5px rgba(17,22,37,0.01)`): default resting state for cozy cards and sheets.
- **Paper hover** (`--paper-shadow-hover`: `0 8px 25px rgba(17,22,37,0.06), 0 4px 10px rgba(17,22,37,0.03)`): hover/lift response for the same surfaces.
- **Cover lift** (`0 4px 12px rgba(17,22,37,0.06)` → `0 20px 30px rgba(17,22,37,0.18)` on hover): the book cover image's own shadow, deeper than paper-rest because it's a physical object (a book), not a flat sheet.
- **Modal panel** (`0 12px 35px rgba(17,22,37,0.15)` for BookModal, `0 12px 30px rgba(17,22,37,0.12)` for AddLocationModal): the deepest shadow in the system, reserved for the one surface genuinely floating above an overlay.
- **Inset field** (`inset 0 1px 3px rgba(17,22,37,0.05)` / `inset 0 1px 4px rgba(17,22,37,0.08)`): a faint pressed-in look for text inputs, standing in for a groove on the page rather than a raised chip.
- **Small control** (`0 2px 6px rgba(17,22,37,0.08)`): buttons and icon controls inside modals.

### Named Rules
**The Ink-Tint-Only Rule.** No shadow in this system uses a color other than `rgba(17,22,37, …)`. Depth comes from opacity and blur radius, not from color shift.

## 5. Components

### Buttons
- **Shape:** flat, square corners (`0px`) for standard buttons; full pill (`30px`) reserved for the floating action / primary CTA button only.
- **Primary (FAB):** `0 8px 30px rgba(0,0,0,0.12)` shadow, pill radius — the one rounded, elevated button in the system, signaling "the one thing you do most."
- **Hover / Focus:** soft opacity/shadow shifts (paper-hover pattern), never a color swap on flat buttons.
- **Ghost / icon buttons:** small controls inside modals use the "Small control" shadow only, no fill.

### Chips / Tag Pills
- **Style:** `#EAE7D8` background, `20px` radius, small padding — the only place a soft parchment tone (distinct from the paper/sheet neutrals) appears.
- **State:** static/informational only; no selected/unselected toggle state currently exists.

### Cards / Containers
- **Corner Style:** flat (`0px`) — the book card and modal panels are deliberately square; the "sketchbook" feel lives in shadows and the isolated organic-radius utility classes (`.cozy-card`, `.sketch-border`), not in the primary card/modal shapes.
- **Background:** `--bg-sheet` (#FFFDFB) for the book card (card stock on paper); `--bg-primary` (#F4F2E4) for modal panels (the modal sits on the same paper as the page, just elevated).
- **Shadow Strategy:** book card uses the Cover-Lift ramp on hover (animated via framer-motion scale 1→1.04); modals use the Modal-Panel shadow, static.
- **Border:** none on any card or modal panel — depth comes entirely from shadow, never a stroke.
- **Internal Padding:** book card ~16px; BookModal `40px 36px 36px 36px`; AddLocationModal `28px 24px 24px 24px` — modals get generous, asymmetric-favoring-top padding so the heading has room to breathe.

### Inputs / Fields
- **Style:** `--bg-sheet` background, flat radius, inset ink-tinted shadow (see Elevation) standing in for a groove rather than a raised chip.
- **Focus:** the hero search input uses a wavy ink-blue underline (`text-decoration: underline wavy var(--accent-primary)`) instead of a border-glow — a deliberate handwriting-style focus cue unique to this system.
- **Error / Disabled:** delete/error text uses `#8B1E1E`, a muted brick-red rather than a saturated system red, to stay in the ink-and-paper family.

### Navigation
- Minimal chrome: a header with the page title and a logout link (`styles.rightNav`); no persistent sidebar or tab bar, consistent with a single-user, low-density personal tool.

### Modal Overlay (signature component)
Both modals share `background-color: rgba(17,22,37,0.25)` as the scrim — ink-tinted, not pure black, keeping the overlay in the same color family as everything else, so opening a modal never feels like a jarring context switch out of the paper world.

## 6. Do's and Don'ts

### Do:
- **Do** keep every shadow tinted `rgba(17,22,37, α)` — ink, not gray or black.
- **Do** treat `--accent-primary` (#002CBC) as a rare accent (underline, thin wash) — never a filled surface.
- **Do** keep card and modal corners flat (`0px`); save organic/pill radii for the FAB and tag pills only.
- **Do** use Newsreader only for the one active hero sentence; everything else is Instrument Sans.
- **Do** keep transitions soft and unhurried (opacity/shadow/scale shifts), matching a calm, ambient personal tool rather than a snappy productivity app.

### Don't:
- **Don't** introduce cold gray SaaS-dashboard chrome, harsh box-shadows, or sterile tech surfaces — this is a personal journal, not an admin panel.
- **Don't** use gradient text, cream-on-cream low-contrast body copy, generic identical icon+heading+text card grids, sketchy/doodle SVG illustrations, side-stripe colored borders, or decorative glassmorphism.
- **Don't** fill large surfaces with `--accent-primary`; it must stay a thin accent, not a background.
- **Don't** add a second display serif or a second accent color "for variety" — the One Ink Rule and One Serif Rule both depend on scarcity to read as intentional.
- **Don't** darken shadow opacity above ~0.15 even on the "highest" surface (the modal panel); this system never reaches for a hard drop-shadow.
