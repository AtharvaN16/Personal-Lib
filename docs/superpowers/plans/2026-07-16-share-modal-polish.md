# Share Library Modal Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the existing Share Library modal (collapse-by-default toggle UX, a structurally-correct switch, a smaller customizable-color QR with an editable message, compact icon toolbars, and multi-up printable QR cards) without changing its visual language, layout, or the underlying `/api/share` contract.

**Architecture:** All changes live in one file, `src/components/ShareLibraryModal.tsx` (currently 415 lines, single component + inline `styles` object — the codebase's established pattern for modals, see `AddLocationModal`-style components referenced in that file's own comments). New CSS-only additions (print grid, grain pseudo-element) go into `src/app/globals.css` next to the existing `.share-print-area` print rules. No new files, no DB/API changes, no new npm dependencies (`qr-code-styling` and `framer-motion` are already installed; `ThemeSwatches` already exists and is imported as-is).

**Tech Stack:** Next.js (App Router) + React + TypeScript, Framer Motion for animation, `qr-code-styling` for QR rendering, vanilla CSS (inline `style` objects + `globals.css` for print/pseudo-element rules that can't be expressed inline), Bun as package manager/runner.

## Global Constraints

- No test framework exists in this codebase (verified: no `*.test.tsx`/`*.test.ts` files, no `jest`/`vitest`/`playwright` in `package.json`). Every existing plan in `docs/superpowers/plans/` verifies manually via `bun dev` plus `bun run build`/`bun run lint`. This plan follows that convention.
- Do not touch `/api/share/route.ts`, `src/app/share/[token]/page.tsx`, or any DB table/migration — message and QR color are localStorage-only per the approved spec.
- Preserve the modal's existing visual language: `var(--bg-sheet)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--accent-primary)`, `var(--font-instrument-sans)`, sharp `border-radius: 0px` panel, `0 12px 30px rgba(17, 22, 37, 0.12)` shadow. Do not introduce new fonts, new border-radius conventions, or a new color palette.
- All new icons follow the existing inline-SVG convention used in `Dashboard.tsx`/`AccountMenu.tsx`: `viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"`. No icon library is added.
- Reuse `ThemeSwatches` (`src/components/ThemeSwatches.tsx`) unmodified for the QR color picker.
- Default message text is exactly `Scan to see my library`.
- `localStorage` keys: `share-qr-color` (hex string) and `share-qr-message` (string).

---

## File Structure

- **Modify:** `src/components/ShareLibraryModal.tsx` — all behavior/markup/style changes.
- **Modify:** `src/app/globals.css` — extend the existing `@media print` block (around line 662-689) with the multi-card grid rules and a card-level grain pseudo-element; no other file touches print CSS, so this stays colocated with the rules it replaces/extends.

No file split is needed: the component is ~415 lines today and this plan adds well-scoped state/markup, not a new subsystem — staying in one file matches the codebase's existing per-modal-component pattern (`AddLocationModal`, etc., referenced in this file's own comments, are each a single file).

---

### Task 1: Fix the toggle switch (structural containment + iOS-like motion)

**Files:**
- Modify: `src/components/ShareLibraryModal.tsx:294-312` (the `switchTrack`/`switchThumb` style entries and their usage at `:171-187`)

**Interfaces:**
- Consumes: existing `state.shareEnabled` (boolean), `toggling` (boolean), `handleToggle` (existing function) — no signature changes.
- Produces: no new exports; the track/thumb JSX and `styles.switchTrack`/`styles.switchThumb` keys are reused unchanged in name by later tasks (Task 2 wraps this same toggle row, unchanged).

This task only touches the switch markup/styles — it does not change the collapse/expand behavior (that's Task 2).

- [ ] **Step 1: Replace the switch styles with flex-based, containment-guaranteed values**

In `src/components/ShareLibraryModal.tsx`, find the `switchTrack` and `switchThumb` entries in the `styles` object (around line 294-312):

```tsx
  switchTrack: {
    width: '44px',
    height: '24px',
    borderRadius: '9999px',
    border: 'none',
    position: 'relative',
    cursor: 'pointer',
    padding: 0,
    transition: 'background-color 0.2s ease',
  },
  switchThumb: {
    position: 'absolute',
    top: '2px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#FFFDFB',
    boxShadow: '0 1px 3px rgba(17, 22, 37, 0.3)',
  },
```

Replace with:

```tsx
  switchTrack: {
    width: '44px',
    height: '26px',
    borderRadius: '9999px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    padding: '2px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  switchThumb: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: '#FFFDFB',
    boxShadow: '0 1px 3px rgba(17, 22, 37, 0.3)',
    flexShrink: 0,
  },
```

- [ ] **Step 2: Update the switch JSX to toggle `justifyContent` and use Framer Motion's `layout` prop instead of hand-computed `x`**

Find (around line 171-187):

```tsx
              <button
                onClick={handleToggle}
                disabled={toggling}
                role="switch"
                aria-checked={state.shareEnabled}
                style={{
                  ...styles.switchTrack,
                  backgroundColor: state.shareEnabled ? accentColor : 'rgba(17, 22, 37, 0.15)',
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                <motion.span
                  animate={{ x: state.shareEnabled ? 20 : 2 }}
                  transition={{ duration: 0.2 }}
                  style={styles.switchThumb}
                />
              </button>
```

Replace with:

```tsx
              <button
                onClick={handleToggle}
                disabled={toggling}
                role="switch"
                aria-checked={state.shareEnabled}
                style={{
                  ...styles.switchTrack,
                  justifyContent: state.shareEnabled ? 'flex-end' : 'flex-start',
                  backgroundColor: state.shareEnabled ? accentColor : 'rgba(17, 22, 37, 0.15)',
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                <motion.span
                  layout
                  transition={{ type: 'spring', stiffness: 700, damping: 35 }}
                  style={styles.switchThumb}
                />
              </button>
```

- [ ] **Step 3: Verify visually via dev server**

Run: `bun dev`

Expected: open the app, log in (or guest mode), open Share Library from the account menu. Toggle sharing on/off several times. The thumb must stay fully inside the pill-shaped track at all times, moving smoothly left↔right with a snappy (non-bouncy) spring — no frame where it clips outside the track edge or overlaps the track's rounded caps.

- [ ] **Step 4: Type-check**

Run: `bun run build`
Expected: build succeeds with no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShareLibraryModal.tsx
git commit -m "fix: contain share modal toggle thumb within track via flexbox"
```

---

### Task 2: Collapse-by-default with animated expand/collapse

**Files:**
- Modify: `src/components/ShareLibraryModal.tsx` (imports at top; JSX around line 167-223)

**Interfaces:**
- Consumes: `state.shareEnabled`, `state.shareUrl`, `loading` (all existing).
- Produces: no new state. Wraps the existing conditional content block (`{state.shareEnabled && state.shareUrl && (...)}`) in an animated container. Later tasks (3-6) insert/modify markup **inside** this same wrapped block — they should treat the block introduced here as the container all QR/link/toolbar markup lives inside.

- [ ] **Step 1: Import `AnimatePresence`**

In `src/components/ShareLibraryModal.tsx`, change:

```tsx
import { motion } from 'framer-motion';
```

to:

```tsx
import { motion, AnimatePresence } from 'framer-motion';
```

- [ ] **Step 2: Wrap the sharing-content block in an animated collapse container**

Find the existing block (around line 190-221):

```tsx
            {state.shareEnabled && state.shareUrl && (
              <>
                <div className="share-print-area">
                  <div ref={qrContainerRef} style={styles.qrWrapper} />
                  <p style={styles.printCaption}>Scan to see our library</p>
                </div>

                <div style={styles.actionsRow} className="no-print">
                  <button onClick={handlePrint} style={styles.secondaryBtn}>Print QR Code</button>
                </div>

                <div style={styles.linkRow} className="no-print">
                  <input readOnly value={state.shareUrl} className="field-white" style={styles.linkInput} />
                  <button onClick={handleCopy} style={styles.secondaryBtn}>{copyLabel}</button>
                  <button onClick={handleShare} style={styles.primaryBtn}>Share</button>
                </div>

                <div className="no-print" style={styles.regenRow}>
                  {isConfirmingRegen ? (
                    <span style={styles.confirmRow}>
                      <span style={styles.confirmText}>This invalidates the old link/QR code.</span>
                      <button onClick={handleRegenerate} style={styles.confirmBtn}>Regenerate</button>
                      <button onClick={() => setIsConfirmingRegen(false)} style={styles.cancelBtn}>Cancel</button>
                    </span>
                  ) : (
                    <button onClick={() => setIsConfirmingRegen(true)} style={styles.regenLink}>
                      Regenerate link
                    </button>
                  )}
                </div>
              </>
            )}
```

Replace with (content preserved as-is for now — later tasks edit inside this):

```tsx
            <AnimatePresence initial={false}>
              {state.shareEnabled && state.shareUrl && (
                <motion.div
                  key="share-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <motion.div
                    initial={{ y: 8 }}
                    animate={{ y: 0 }}
                    exit={{ y: 8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="share-print-area">
                      <div ref={qrContainerRef} style={styles.qrWrapper} />
                      <p style={styles.printCaption}>Scan to see our library</p>
                    </div>

                    <div style={styles.actionsRow} className="no-print">
                      <button onClick={handlePrint} style={styles.secondaryBtn}>Print QR Code</button>
                    </div>

                    <div style={styles.linkRow} className="no-print">
                      <input readOnly value={state.shareUrl} className="field-white" style={styles.linkInput} />
                      <button onClick={handleCopy} style={styles.secondaryBtn}>{copyLabel}</button>
                      <button onClick={handleShare} style={styles.primaryBtn}>Share</button>
                    </div>

                    <div className="no-print" style={styles.regenRow}>
                      {isConfirmingRegen ? (
                        <span style={styles.confirmRow}>
                          <span style={styles.confirmText}>This invalidates the old link/QR code.</span>
                          <button onClick={handleRegenerate} style={styles.confirmBtn}>Regenerate</button>
                          <button onClick={() => setIsConfirmingRegen(false)} style={styles.cancelBtn}>Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setIsConfirmingRegen(true)} style={styles.regenLink}>
                          Regenerate link
                        </button>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
```

- [ ] **Step 3: Verify visually via dev server**

Run: `bun dev`

Expected: open Share Library with sharing currently OFF — only title, subtitle, and toggle show. Turn sharing ON: content (QR, actions, link, regenerate) smoothly expands into view (height animates open, content fades/slides up into place) rather than popping in. Turn OFF: content smoothly collapses and disappears, no layout jump.

- [ ] **Step 4: Type-check**

Run: `bun run build`
Expected: build succeeds with no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShareLibraryModal.tsx
git commit -m "feat: animate share modal content expand/collapse with sharing toggle"
```

---

### Task 3: QR color picker + smaller QR + editable message

**Files:**
- Modify: `src/components/ShareLibraryModal.tsx`

**Interfaces:**
- Consumes: `ThemeSwatches` component — `import ThemeSwatches from '@/components/ThemeSwatches'`, props `{ value: string; onChange: (hex: string) => void }` (exact signature from `src/components/ThemeSwatches.tsx:14-17`).
- Produces: new state `qrColor: string`, `message: string`, `editingMessage: boolean`, `draftMessage: string`. These are consumed by Task 4 (toolbar's Edit Message button flips `editingMessage`) and Task 5 (print cards read `qrColor`/`message`).

- [ ] **Step 1: Add imports and new state**

At the top of `src/components/ShareLibraryModal.tsx`, add the `ThemeSwatches` import:

```tsx
import ThemeSwatches from '@/components/ThemeSwatches';
```

In the component body, after the existing `useState` declarations (after `isConfirmingRegen`), add:

```tsx
  const [qrColor, setQrColor] = useState(accentColor);
  const [message, setMessage] = useState('Scan to see my library');
  const [editingMessage, setEditingMessage] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
```

- [ ] **Step 2: Load persisted color/message on mount**

Add a new `useEffect`, after the existing `/api/share` fetch effect:

```tsx
  useEffect(() => {
    const storedColor = localStorage.getItem('share-qr-color');
    const storedMessage = localStorage.getItem('share-qr-message');
    if (storedColor) setQrColor(storedColor);
    if (storedMessage) setMessage(storedMessage);
  }, []);
```

- [ ] **Step 3: Persist color/message on change**

Add two more `useEffect`s right after the one from Step 2:

```tsx
  useEffect(() => {
    localStorage.setItem('share-qr-color', qrColor);
  }, [qrColor]);

  useEffect(() => {
    localStorage.setItem('share-qr-message', message);
  }, [message]);
```

- [ ] **Step 4: Add a Title Case helper and message commit/cancel handlers**

Add near the other handlers (after `handlePrint`):

```tsx
  const toTitleCase = (s: string) =>
    s.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const startEditingMessage = () => {
    setDraftMessage(message);
    setEditingMessage(true);
  };

  const commitMessage = () => {
    const next = toTitleCase(draftMessage);
    if (next) setMessage(next);
    setEditingMessage(false);
  };

  const cancelEditingMessage = () => {
    setEditingMessage(false);
  };
```

- [ ] **Step 5: Update the QR render effect to use `qrColor` and reduce size**

Find the QR-rendering `useEffect` (around line 61-82):

```tsx
  useEffect(() => {
    if (!state.shareEnabled || !state.shareUrl || !qrContainerRef.current) return;

    let cancelled = false;
    import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (cancelled || !qrContainerRef.current) return;
      qrContainerRef.current.innerHTML = '';
      const qr = new QRCodeStyling({
        width: 220,
        height: 220,
        data: state.shareUrl!,
        margin: 8,
        dotsOptions: { color: accentColor, type: 'rounded' },
        cornersSquareOptions: { color: accentColor, type: 'extra-rounded' },
        cornersDotOptions: { color: accentColor, type: 'dot' },
        backgroundOptions: { color: '#FFFDFB' },
      });
      qr.append(qrContainerRef.current);
    });

    return () => { cancelled = true; };
  }, [state.shareEnabled, state.shareUrl, accentColor]);
```

Replace with (size reduced 220→176, margin 8→6, color driven by `qrColor` instead of `accentColor`; `qr` instance stashed on a ref for Task 4's PNG export):

```tsx
  useEffect(() => {
    if (!state.shareEnabled || !state.shareUrl || !qrContainerRef.current) return;

    let cancelled = false;
    import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (cancelled || !qrContainerRef.current) return;
      qrContainerRef.current.innerHTML = '';
      const qr = new QRCodeStyling({
        width: 176,
        height: 176,
        data: state.shareUrl!,
        margin: 6,
        dotsOptions: { color: qrColor, type: 'rounded' },
        cornersSquareOptions: { color: qrColor, type: 'extra-rounded' },
        cornersDotOptions: { color: qrColor, type: 'dot' },
        backgroundOptions: { color: '#FFFDFB' },
      });
      qr.append(qrContainerRef.current);
      qrInstanceRef.current = qr;
    });

    return () => { cancelled = true; };
  }, [state.shareEnabled, state.shareUrl, qrColor]);
```

Add the new ref alongside the other `useRef`s near the top of the component:

```tsx
  const qrInstanceRef = useRef<InstanceType<typeof import('qr-code-styling').default> | null>(null);
```

- [ ] **Step 6: Replace the QR wrapper + static caption with color swatches + message (editable)**

Inside the block from Task 2, find:

```tsx
                    <div className="share-print-area">
                      <div ref={qrContainerRef} style={styles.qrWrapper} />
                      <p style={styles.printCaption}>Scan to see our library</p>
                    </div>
```

Replace with:

```tsx
                    <div className="share-print-area">
                      <div ref={qrContainerRef} style={styles.qrWrapper} />
                    </div>

                    <div style={styles.swatchRow} className="no-print">
                      <ThemeSwatches value={qrColor} onChange={setQrColor} />
                    </div>

                    <div style={styles.messageRow} className="no-print">
                      {editingMessage ? (
                        <input
                          autoFocus
                          value={draftMessage}
                          onChange={(e) => setDraftMessage(e.target.value)}
                          onBlur={commitMessage}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitMessage();
                            if (e.key === 'Escape') cancelEditingMessage();
                          }}
                          className="field-white"
                          style={styles.messageInput}
                        />
                      ) : (
                        <p style={{ ...styles.messageText, color: qrColor }}>{message}</p>
                      )}
                    </div>
                    <p className="share-print-area" style={{ ...styles.printCaption, color: qrColor }}>{message}</p>
```

(The `no-print` on-screen message and the always-rendered `.share-print-area` printed caption are intentionally separate elements: the printed caption is superseded by Task 5's dedicated print cards, but is kept temporarily here so `bun run build` never sees a moment of dead/missing markup between tasks. Task 5 removes this line when the print card grid replaces it.)

- [ ] **Step 7: Add new styles**

In the `styles` object, add these entries (near `qrWrapper`/`printCaption`):

```tsx
  swatchRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '14px',
  },
  messageRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  messageText: {
    textAlign: 'center',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontWeight: 600,
    fontSize: '1.05rem',
    margin: 0,
    cursor: 'default',
  },
  messageInput: {
    width: '100%',
    maxWidth: '320px',
    padding: '8px 12px',
    fontSize: '0.95rem',
    borderRadius: '0px',
    textAlign: 'center',
  },
```

- [ ] **Step 8: Verify visually via dev server**

Run: `bun dev`

Expected: with sharing ON, QR code is visibly smaller than before with a row of color swatches beneath it (identical dot style to the account menu's theme picker). Clicking a swatch recolors the QR code live. Below the swatches, the message shows as bold blue-ish text (`Scan to see my library` by default). Reload the page — swatch selection and message persist (localStorage).

- [ ] **Step 9: Type-check**

Run: `bun run build`
Expected: build succeeds with no new TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/ShareLibraryModal.tsx
git commit -m "feat: add QR color picker and editable share message"
```

---

### Task 4: Icon toolbars (QR actions + link actions)

**Files:**
- Modify: `src/components/ShareLibraryModal.tsx`

**Interfaces:**
- Consumes: `startEditingMessage` (Task 3), `handlePrint`, `handleCopy`, `handleShare`, `qrInstanceRef` (Task 3), `state.shareUrl`.
- Produces: new state `pngReady: boolean` (tracks whether `qrInstanceRef` has rendered at least once, gating Download PNG); new handler `handleDownloadPng`. Task 5 reuses `qrInstanceRef` for the print cards' PNG source, and extends the Print button here into a segmented control.

- [ ] **Step 1: Add `pngReady` state and set it once the QR renders**

In the QR-rendering `useEffect` from Task 3 Step 5, after `qrInstanceRef.current = qr;`, add:

```tsx
      setPngReady(true);
```

Add the state declaration alongside the others from Task 3:

```tsx
  const [pngReady, setPngReady] = useState(false);
```

Also reset it to `false` at the top of the effect (before the `import(...)` call) so a color/URL change doesn't leave a stale "ready" PNG usable mid-transition:

```tsx
  useEffect(() => {
    if (!state.shareEnabled || !state.shareUrl || !qrContainerRef.current) return;
    setPngReady(false);

    let cancelled = false;
    import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      ...
```

- [ ] **Step 2: Add `handleDownloadPng`**

Add near `handlePrint`:

```tsx
  const handleDownloadPng = async () => {
    if (!qrInstanceRef.current) return;
    await qrInstanceRef.current.download({ name: 'library-qr', extension: 'png' });
  };
```

- [ ] **Step 3: Replace the single "Print QR Code" button with a compact icon toolbar**

Find (from Task 3's edits, the block is now):

```tsx
                    <div style={styles.actionsRow} className="no-print">
                      <button onClick={handlePrint} style={styles.secondaryBtn}>Print QR Code</button>
                    </div>
```

Replace with:

```tsx
                    <div style={styles.iconToolbar} className="no-print">
                      <button
                        onClick={startEditingMessage}
                        style={styles.iconBtn}
                        title="Edit message"
                        aria-label="Edit message"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                      <button
                        onClick={handlePrint}
                        style={styles.iconBtn}
                        title="Print"
                        aria-label="Print QR cards"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9" />
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                          <rect x="6" y="14" width="12" height="8" />
                        </svg>
                      </button>
                      <button
                        onClick={handleDownloadPng}
                        disabled={!pngReady}
                        style={{ ...styles.iconBtn, opacity: pngReady ? 1 : 0.4, cursor: pngReady ? 'pointer' : 'default' }}
                        title="Download PNG"
                        aria-label="Download QR as PNG"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    </div>
```

- [ ] **Step 4: Replace the link row's text buttons with icon buttons**

Find:

```tsx
                    <div style={styles.linkRow} className="no-print">
                      <input readOnly value={state.shareUrl} className="field-white" style={styles.linkInput} />
                      <button onClick={handleCopy} style={styles.secondaryBtn}>{copyLabel}</button>
                      <button onClick={handleShare} style={styles.primaryBtn}>Share</button>
                    </div>
```

Replace with:

```tsx
                    <div style={styles.linkRow} className="no-print">
                      <input readOnly value={state.shareUrl} className="field-white" style={styles.linkInput} />
                      <button onClick={handleCopy} style={styles.iconBtn} title={copyLabel} aria-label={copyLabel}>
                        {copyLabel === 'Copied!' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                      <button onClick={handleShare} style={styles.iconBtn} title="Share" aria-label="Share link">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                      </button>
                    </div>
```

- [ ] **Step 5: Replace the "Regenerate link" text link with an icon trigger**

Find:

```tsx
                      ) : (
                        <button onClick={() => setIsConfirmingRegen(true)} style={styles.regenLink}>
                          Regenerate link
                        </button>
                      )}
```

Replace with:

```tsx
                      ) : (
                        <button onClick={() => setIsConfirmingRegen(true)} style={styles.iconBtn} title="Regenerate link" aria-label="Regenerate link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                          </svg>
                        </button>
                      )}
```

- [ ] **Step 6: Add `iconToolbar`/`iconBtn` styles, remove now-unused `actionsRow`/`primaryBtn`/`secondaryBtn`/`regenLink` if nothing else references them**

Run: `grep -n "styles.actionsRow\|styles.primaryBtn\|styles.secondaryBtn\|styles.regenLink" "src/components/ShareLibraryModal.tsx"`

Expected: no remaining matches (all four were only used in the blocks just replaced). Remove those four now-dead entries from the `styles` object, and add:

```tsx
  iconToolbar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '20px',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'color 0.15s ease, background-color 0.15s ease',
  },
```

- [ ] **Step 7: Verify visually via dev server**

Run: `bun dev`

Expected: the pencil/print/download icons appear in a row under the QR+message; clicking the pencil flips the message into an editable input (Enter or blur commits Title-Cased text, Escape reverts), download icon is dimmed until the QR has rendered then enables and downloads a `library-qr.png`. The link row shows the URL field with copy/share icons to its right (copy icon becomes a checkmark for ~2s after clicking), and the "Regenerate link" trigger is now an icon that still opens the same inline confirm/cancel row as before.

- [ ] **Step 8: Type-check and lint**

Run: `bun run build`
Expected: build succeeds, no new TypeScript errors.

Run: `bun run lint`
Expected: no new lint errors in `ShareLibraryModal.tsx`.

- [ ] **Step 9: Commit**

```bash
git add src/components/ShareLibraryModal.tsx
git commit -m "feat: replace share modal buttons with compact icon toolbars"
```

---

### Task 5: Multi-up printable QR cards

**Files:**
- Modify: `src/components/ShareLibraryModal.tsx`
- Modify: `src/app/globals.css:662-689` (existing `@media print` block)

**Interfaces:**
- Consumes: `qrInstanceRef` (Task 3/4), `message`, `qrColor` (Task 3), `styles.iconBtn` (Task 4).
- Produces: new state `printCount: 1 | 2 | 4 | 6 | 8`, `printMenuOpen: boolean`, `qrPngDataUrl: string | null`; new handler `handlePrintCount(count)`. Nothing later depends on these (this is the last task).

- [ ] **Step 1: Add print-card state**

Add alongside the state from earlier tasks:

```tsx
  const [printCount, setPrintCount] = useState<1 | 2 | 4 | 6 | 8>(4);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string | null>(null);
```

- [ ] **Step 2: Capture a PNG data URL whenever the QR (re)renders**

In the QR-rendering `useEffect` (Task 3 Step 5 / Task 4 Step 1), after `setPngReady(true);`, add:

```tsx
      const blob = await qr.getRawData('png');
      if (cancelled || !blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (!cancelled) setQrPngDataUrl(reader.result as string);
      };
      reader.readAsDataURL(blob as Blob);
```

Since this now uses `await`, change the `.then((...) => { ... })` callback to an `async` function:

```tsx
    import('qr-code-styling').then(async ({ default: QRCodeStyling }) => {
```

(Full effect after this change — for reference, no separate edit needed beyond what's described: the callback body gains the `blob`/`reader` lines at the end, and the callback signature gains `async`.)

- [ ] **Step 3: Replace `handlePrint` with a count-driven version**

Find:

```tsx
  const handlePrint = () => {
    window.print();
  };
```

Replace with:

```tsx
  const handlePrintCount = (count: 1 | 2 | 4 | 6 | 8) => {
    setPrintCount(count);
    setPrintMenuOpen(false);
    requestAnimationFrame(() => window.print());
  };
```

Update Task 4's print icon button's `onClick` from `handlePrint` to toggle the inline menu instead:

```tsx
                      <button
                        onClick={() => setPrintMenuOpen((v) => !v)}
                        disabled={!qrPngDataUrl}
                        style={{ ...styles.iconBtn, opacity: qrPngDataUrl ? 1 : 0.4, cursor: qrPngDataUrl ? 'pointer' : 'default' }}
                        title="Print"
                        aria-label="Print QR cards"
                      >
```

(keep the same printer `<svg>` inside, unchanged)

- [ ] **Step 4: Add the animated inline cards-per-page control right after the icon toolbar**

Immediately after the closing `</div>` of `styles.iconToolbar` (Task 4 Step 3's block), add:

```tsx
                    <AnimatePresence>
                      {printMenuOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                          className="no-print"
                        >
                          <div style={styles.printMenu}>
                            {([1, 2, 4, 6, 8] as const).map((count) => (
                              <button
                                key={count}
                                onClick={() => handlePrintCount(count)}
                                style={{
                                  ...styles.printMenuOption,
                                  ...(printCount === count ? styles.printMenuOptionActive : {}),
                                }}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
```

- [ ] **Step 5: Add print menu styles**

```tsx
  printMenu: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '16px',
  },
  printMenuOption: {
    background: 'none',
    border: '1px solid rgba(17, 22, 37, 0.15)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    padding: '4px 10px',
    cursor: 'pointer',
    borderRadius: '0px',
  },
  printMenuOptionActive: {
    borderColor: 'var(--accent-primary)',
    color: 'var(--accent-primary)',
  },
```

- [ ] **Step 6: Replace the leftover single printed caption from Task 3 with the multi-card print grid**

Find (this is the temporary line called out in Task 3 Step 6):

```tsx
                    <p className="share-print-area" style={{ ...styles.printCaption, color: qrColor }}>{message}</p>
```

Replace with:

```tsx
                    <div className="share-print-area" data-print-count={printCount}>
                      {Array.from({ length: printCount }).map((_, i) => (
                        <div key={i} className="qr-print-card">
                          {qrPngDataUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={qrPngDataUrl} alt="Library QR code" className="qr-print-card-image" />
                          )}
                          <p className="qr-print-card-message" style={{ color: qrColor }}>{message}</p>
                        </div>
                      ))}
                    </div>
```

- [ ] **Step 7: Remove the now-unused `printCaption` style if nothing else references it**

Run: `grep -n "styles.printCaption" "src/components/ShareLibraryModal.tsx"`

Expected: no remaining matches. Remove the `printCaption` entry from the `styles` object.

Also remove the original always-rendered (non-print) `<div className="share-print-area"><div ref={qrContainerRef} ... /></div>` wrapper's `share-print-area` class — the on-screen QR should no longer be part of the print flow (the new dedicated cards are). Find (from Task 3 Step 6):

```tsx
                    <div className="share-print-area">
                      <div ref={qrContainerRef} style={styles.qrWrapper} />
                    </div>
```

Replace with:

```tsx
                    <div ref={qrContainerRef} style={styles.qrWrapper} />
```

- [ ] **Step 8: Extend the print CSS in `globals.css`**

In `src/app/globals.css`, find the existing print block (lines 662-689):

```css
/* Used by ShareLibraryModal's "Print QR Code" button: isolates the QR code + caption as the
   only visible content when the browser print dialog renders the page. */
@media print {
  body * {
    visibility: hidden;
  }
  .share-print-area,
  .share-print-area * {
    visibility: visible;
  }
  .share-print-area {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 40px;
  }
}

@media print {
  .no-print {
    display: none !important;
  }
}
```

Replace with:

```css
/* Used by ShareLibraryModal's print toolbar: isolates a grid of small QR "shelf label"
   cards (count chosen via the inline cards-per-page control) as the only visible content
   when the browser print dialog renders the page. */
@media print {
  body * {
    visibility: hidden;
  }
  .share-print-area,
  .share-print-area * {
    visibility: visible;
  }
  .share-print-area {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: grid;
    gap: 0.25in;
    padding: 0.5in;
    box-sizing: border-box;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 1fr;
  }
  .share-print-area[data-print-count="1"] {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    place-items: center;
  }
  .share-print-area[data-print-count="1"] .qr-print-card {
    width: 4in;
    height: 5in;
  }
  .share-print-area[data-print-count="2"] {
    grid-template-rows: 1fr;
  }
  .share-print-area[data-print-count="4"] {
    grid-template-rows: repeat(2, 1fr);
  }
  .share-print-area[data-print-count="6"] {
    grid-template-rows: repeat(3, 1fr);
  }
  .share-print-area[data-print-count="8"] {
    grid-template-rows: repeat(4, 1fr);
  }

  .qr-print-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15in;
    background-color: var(--bg-sheet);
    border: 1px dashed rgba(17, 22, 37, 0.25);
    padding: 0.2in;
    box-sizing: border-box;
    overflow: hidden;
  }
  .qr-print-card::before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0.115;
    pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  }
  .qr-print-card-image {
    max-width: 70%;
    max-height: 65%;
    object-fit: contain;
    position: relative;
  }
  .qr-print-card-message {
    text-align: center;
    font-family: var(--font-instrument-sans), sans-serif;
    font-weight: 600;
    font-size: 0.8rem;
    margin: 0;
    position: relative;
  }
}

@media print {
  .no-print {
    display: none !important;
  }
}
```

- [ ] **Step 9: Verify visually via dev server (browser print preview)**

Run: `bun dev`

Expected: open Share Library, sharing ON. Click the Print icon — an inline row of `1 2 4 6 8` appears (animated open). Click each option in turn and use the browser's print preview (Cmd+P, then cancel without printing paper) to confirm: `1` shows a single large centered card; `2` shows two cards side by side; `4` shows a 2×2 grid; `6` shows 2×3; `8` shows 2×4 — all within the page bounds, each with a dashed border, the grain texture faintly visible, the QR image, and the message text in the selected swatch color. No card overflows the page or gets clipped.

- [ ] **Step 10: Type-check and lint**

Run: `bun run build`
Expected: build succeeds, no new TypeScript errors.

Run: `bun run lint`
Expected: no new lint errors.

- [ ] **Step 11: Commit**

```bash
git add src/components/ShareLibraryModal.tsx src/app/globals.css
git commit -m "feat: print multi-up QR shelf-label cards with selectable count per page"
```

---

### Task 6: Full end-to-end walkthrough against the spec

**Files:** none (verification only)

**Interfaces:** none — this task exercises the finished feature as a whole.

- [ ] **Step 1: Run the full manual walkthrough**

Run: `bun dev`, log in as a real (non-guest) user, open Share Library from both the desktop `AccountMenu` and the `MobileMenu` (mobile-width browser window via device toolbar).

Walk through, for each entry point:
1. Modal opens with sharing OFF (or in whatever state it was left) — collapsed state shows only title, subtitle, toggle.
2. Turn sharing ON — content expands smoothly; QR (176px), color swatches, message, icon toolbar, link field + icons, regenerate all appear.
3. Toggle on/off a few times rapidly — thumb never exits the track, expand/collapse never jumps or flickers.
4. Click a different color swatch — QR recolors live, message text recolors live.
5. Click the pencil — message becomes an editable field; type a new value, press Enter — commits, Title-Cased, reflected immediately in both the on-screen message and (verify via print preview) the print cards.
6. Reload the page — swatch color and message are unchanged (localStorage persistence).
7. Click Download PNG — a `library-qr.png` downloads and opens as a valid, scannable QR image.
8. Click Copy — icon briefly shows a checkmark, clipboard contains the share URL.
9. Click Share — native share sheet opens (or falls back to copy) with the correct URL.
10. Click Regenerate — confirm row appears, confirm — URL changes, QR updates to match, previous URL (open in another tab first) now 404s/fails on `/share/[token]`.
11. Click Print, select each of 1/2/4/6/8 — browser print preview shows the correct grid each time (per Task 5 Step 9).
12. Turn sharing OFF — content collapses smoothly, back to collapsed state.

Expected: all 12 checks pass with no visual glitches, console errors, or layout shifts.

- [ ] **Step 2: Final build/lint pass**

Run: `bun run build && bun run lint`
Expected: both succeed cleanly.

- [ ] **Step 3: Commit (if Step 1/2 surfaced any fixes)**

If any fixes were needed during the walkthrough, stage and commit them:

```bash
git add -A
git commit -m "fix: address issues found in share modal polish walkthrough"
```

If no fixes were needed, skip this step — there is nothing to commit.
