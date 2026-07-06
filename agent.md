# Agent Instructions (`agent.md`)

Welcome! This is the operating manual for any AI coding agent working on the **Personal Library Database** project.

---

## ⚠️ Critical Warning

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Project Overview

A personal fullstack web application for cataloging books via barcode scanning. The primary goal is tracking where books are stored in the house (which room, bookshelf, shelf index).
- **Owner:** The user's sister.
- **Aesthetic Vibe:** Cozy, ASMR, chill, hand-drawn, journal/sketchbook style.
- **Key Flow:** Scan book barcode -> Look up book details (via open API) -> Prompt user for shelf/location selection -> Save to database.

---

## Technical Stack & Configuration

- **Runtime & Package Manager:** Bun (`bun`)
- **Frontend/Backend Framework:** Next.js (App Router, `src/` directory)
- **Database & Auth:** Supabase (Postgres Database, Supabase Auth)
- **Styling:** Vanilla CSS (no Tailwind CSS). Focus on rich custom styling (soft warm pastel palettes, warm cream/paper backgrounds, organic border-radiuses, hand-drawn SVGs, and relaxing transitions).
- **Barcode Input Handling:**
  - **Bluetooth Scanner (Primary):** Acts as a physical keyboard input that emits characters rapidly, ending with an `Enter` key. Implement a global keypress listener that detects rapid numeric input to trigger the book lookup.
  - **Camera Scanner (Secondary):** Camera-based scanning via `html5-qrcode` library for mobile devices.

---

## Command Reference

Use Bun commands for project development:
- Run dev server: `bun dev`
- Build production bundle: `bun run build`
- Run linting: `bun run lint`
- Install dependencies: `bun add <package>` or `bun add -d <package>` (devDependencies)

---

## Design System & Style Guide (Cozy Journal)

- **Colors:** Warm ivory/parchment backgrounds, soft coffee brown texts, sage green and muted terracottas for accents. Avoid cold/high-contrast tech grays.
- **Fonts:** Cozy/hand-written style fonts (e.g., `Playfair Display`, `Architects Daughter`, `Caveat`, or simple serif/sans-serif combination from Google Fonts).
- **Elements:**
  - Organic, sketchy border-radiuses (e.g., `border-radius: 255px 15px 225px 15px/15px 225px 15px 255px;` to simulate hand-drawn borders).
  - Soft ink-like text-shadows and page box-shadows.
  - Handdrawn-style SVGs or icons.
- **Interactions:** Subtle, smooth hover/focus transitions. No harsh flashing animations.

---

## Agent Customizations & Composed Skills

This workspace uses the `.agents/` directory for agent capabilities.
The following skills are installed and should be read/obeyed by any agent:
1. **`mattpocock/skills`**: Workflow discipline and AI helper skills.
2. **`obra/superpowers`**: Detailed software engineering discipline (TDD, brainstorming, plan execution, and code review).
3. **`pbakaus/impeccable`**: Design vocabulary, visual audits, and polished CSS rules to avoid standard web lookups.

Please review files in `./.agents/skills/` before starting any coding tasks.
