# Mobile Layout and Icon Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore broken icons on mobile/desktop, reduce wavy underline offsets on mobile for dashboard links, and position the Scan modal's "Start Scanning" button dynamically to prevent overlapping form elements on mobile.

**Architecture:** Remove conflicting Google Fonts subset styles so the full Material Symbols library is loaded. Use client-side screen width media queries via `useIsMobile()` to dynamically override inline text decoration and positioning styles between mobile and desktop configurations.

**Tech Stack:** React, Next.js, Framer Motion, Vanilla inline CSS, Google Material Symbols

## Global Constraints

- Avoid Tailwind CSS styles; use inline CSS styles for layout configuration.
- Maintain cozy sketchbook styling (warm backgrounds, soft pastel colors, organic borders).
- Ensure no compilation or linting errors are introduced.

---

### Task 1: Restore Broken Icons

**Files:**
- Modify: [layout.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/app/layout.tsx)

**Interfaces:**
- Produces: Complete Google Fonts `Material Symbols Outlined` icon set loaded without restrictions.

- [ ] **Step 1: Remove conflicting subset link in layout.tsx**

Remove the second `<link>` stylesheet element at line 40 of `src/app/layout.tsx` which restricts the icon loader to just `newsstand`.

```tsx
// src/app/layout.tsx line 38-41
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
```

- [ ] **Step 2: Verify compile status**

Run: `bun run build`
Expected: Next.js build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "style: remove conflicting newsstand-only google font link to restore all icons"
```

---

### Task 2: Reduce Wavy Underline Gap on Mobile

**Files:**
- Modify: [text-animate.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/registry/magicui/text-animate.tsx)
- Modify: [Dashboard.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/Dashboard.tsx)

**Interfaces:**
- Consumes: `useIsMobile` hook in `@/hooks/useIsMobile`.

- [ ] **Step 1: Add `useIsMobile` and dynamic underline offset to `text-animate.tsx`**

Import `useIsMobile` in `src/registry/magicui/text-animate.tsx`:
```tsx
import { useIsMobile } from '@/hooks/useIsMobile';
```
Retrieve the `isMobile` state inside the `TextAnimate` component:
```tsx
  const isMobile = useIsMobile();
```
Modify the inline styles on lines 230-232 of `src/registry/magicui/text-animate.tsx`:
```tsx
                  textDecoration: 'underline wavy var(--accent-primary)',
                  textDecorationThickness: '1.5px',
                  textUnderlineOffset: isMobile ? '2px' : '6px',
```

- [ ] **Step 2: Update underline offsets in `Dashboard.tsx`**

Update the dynamic inline style object for the hero text span (around line 450) in `src/components/Dashboard.tsx`:
```tsx
        <span
          style={{
            color: 'var(--accent-primary)',
            textDecoration: 'underline wavy var(--accent-primary)',
            textDecorationThickness: '1.5px',
            textUnderlineOffset: isMobile ? '2px' : '6px',
            fontStyle: 'italic',
          }}
        >
          {displayLabel}
        </span>
```

Update the dynamic inline style object for the "Search" trigger button (around line 582) in `src/components/Dashboard.tsx`:
```tsx
                    textDecoration: 'underline wavy var(--accent-primary)',
                    textDecorationThickness: '1.5px',
                    textUnderlineOffset: isMobile ? '2px' : '6px',
```

Update the "Edit" and "Done" inline styles on lines 647 & 659 in `src/components/Dashboard.tsx` to include the `textUnderlineOffset` override:
```tsx
                  style={{ ...styles.editModeTrigger, textUnderlineOffset: isMobile ? '2px' : '6px' }}
```

- [ ] **Step 3: Run typescript verification**

Run: `bun run build`
Expected: Success with no typescript errors.

- [ ] **Step 4: Commit**

```bash
git add src/registry/magicui/text-animate.tsx src/components/Dashboard.tsx
git commit -m "style: reduce gap for wavy underlines on mobile dashboard items"
```

---

### Task 3: Prevent "Start Scanning" Button Overlap in Scan Modal

**Files:**
- Modify: [ScanBookModal.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanBookModal.tsx)

**Interfaces:**
- Consumes: `useIsMobile` hook in `@/hooks/useIsMobile`.

- [ ] **Step 1: Integrate `useIsMobile` and dynamically position the "Start Scanning" button**

Import `useIsMobile` in `src/components/ScanBookModal.tsx`:
```tsx
import { useIsMobile } from '@/hooks/useIsMobile';
```
Retrieve the `isMobile` state inside `ScanBookModal`:
```tsx
  const isMobile = useIsMobile();
```

Render the mobile block version of the button inside the `setupForm` container below the shelf select dropdown (around line 779-781) in `src/components/ScanBookModal.tsx`:
```tsx
                    {setupRoom && (
                      <select
                        aria-label="Select shelf"
                        value={setupShelfId}
                        onChange={(e) => setSetupShelfId(e.target.value)}
                        style={styles.selectField}
                        className="book-modal-select"
                      >
                        <option value="">Unassigned</option>
                        {setupShelvesInRoom.map((s) => (
                          <option key={s.id} value={s.id}>{s.bookshelf}</option>
                        ))}
                      </select>
                    )}
                    {isMobile && setupRoom && mode === 'single' && (
                      <button
                        type="button"
                        onClick={handleStartScanning}
                        style={{
                          ...styles.formSaveBtn,
                          position: 'static',
                          marginTop: '16px',
                          width: '100%',
                          textAlign: 'center',
                        }}
                      >
                        Start Scanning
                      </button>
                    )}
                  </div>
```

Ensure the desktop version of the button is only rendered when `!isMobile` (around line 818-825):
```tsx
        {!isMobile && locationSetupOpen && setupRoom && mode === 'single' && (
          <button
            type="button"
            onClick={handleStartScanning}
            style={styles.formSaveBtn}
          >
            Start Scanning
          </button>
        )}
```

- [ ] **Step 2: Run verification and checks**

Run: `bun run lint`
Expected: PASS

Run: `bun run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ScanBookModal.tsx
git commit -m "style: position Start Scanning button statically on mobile to prevent overlapping select boxes"
```
