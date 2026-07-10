# Mobile Layout & Icon Fixes — Design Spec

Date: 2026-07-10

## Goal

Resolve three mobile-specific bugs/optimizations:
1. Restore all broken icons across mobile and desktop.
2. Reduce the gap between the wavy underline and its text only on mobile for the "Currently showing...", "Search", and "Edit" links.
3. Fix the "Start Scanning" button overlapping with the location dropdowns in the mobile scan modal.

---

## Proposed Changes

### 1. Fix Broken Icons (`layout.tsx`)

#### [MODIFY] [layout.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/app/layout.tsx)

- **Change:** Remove the redundant and conflicting second Google Fonts link (`&icon_names=newsstand`) on lines 39-40.
- **Why:** The first stylesheet link requests the complete variable version of `Material Symbols Outlined` containing all icons. The second stylesheet link specifies a subset of the font containing *only* the `newsstand` glyph. Due to font-face overrides, this subset font takes precedence, causing other icons to fail to render and display as fallback text (which is text-transformed to uppercase). Removing the second link restores all icons.

---

### 2. Reduce Wavy Underline Gap on Mobile (`Dashboard.tsx`, `text-animate.tsx`)

#### [MODIFY] [Dashboard.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/Dashboard.tsx)

- **Change:** Update the `textUnderlineOffset` inline style property for the following links based on the `isMobile` flag (which is already provided by the `useIsMobile()` hook in `Dashboard`):
  - **"Currently showing..."** span (around line 450):
    ```tsx
    textUnderlineOffset: isMobile ? '2px' : '6px',
    ```
  - **"Search" / "Clear Search"** trigger button (around line 582):
    ```tsx
    textUnderlineOffset: isMobile ? '2px' : '6px',
    ```
  - **"Edit" / "Done"** trigger button inline overrides (around lines 647, 659):
    ```tsx
    style={{ ...styles.editModeTrigger, textUnderlineOffset: isMobile ? '2px' : '6px' }}
    ```

#### [MODIFY] [text-animate.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/registry/magicui/text-animate.tsx)

- **Change:** 
  - Import `useIsMobile` from `@/hooks/useIsMobile`.
  - Fetch the viewport state inside the `TextAnimate` component: `const isMobile = useIsMobile();`.
  - Update the dynamic styling of the highlights container span (around line 232):
    ```tsx
    textUnderlineOffset: isMobile ? '2px' : '6px',
    ```
- **Why:** The "Currently showing..." and "Search" links are highlighted within the hero title by wrapping them in the client-side `TextAnimate` component, which applies a custom wavy underline. Overriding the offset here ensures the gap is reduced on mobile for those highlights.

---

### 3. Prevent "Start Scanning" Button Overlap in Scan Modal (`ScanBookModal.tsx`)

#### [MODIFY] [ScanBookModal.tsx](file:///Users/atharvanayak/Developer/Personal%20Library/src/components/ScanBookModal.tsx)

- **Change:** 
  - Import `useIsMobile` from `@/hooks/useIsMobile` and check the state: `const isMobile = useIsMobile();`.
  - Condition the placement of the "Start Scanning" button based on `isMobile`:
    - **On Desktop (`!isMobile`):** Keep rendering the absolutely positioned button at the bottom of the modal wrapper:
      ```tsx
      {!isMobile && locationSetupOpen && setupRoom && mode === 'single' && (
        <button type="button" onClick={handleStartScanning} style={styles.formSaveBtn}>
          Start Scanning
        </button>
      )}
      ```
    - **On Mobile (`isMobile`):** Render the button inside the scrollable/statically-flowing `setupForm` container below the shelf select dropdown, styled to span full width:
      ```tsx
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
      ```
- **Why:** Absolute positioning places the button over the select form fields when the modal wraps to mobile viewports. Placing the button statically below the selects inside the dynamic flex form container on mobile allows it to flow naturally and avoid any overlaps, while preserving the original layout on desktop.

---

## Verification Plan

### Automated Verification
- Run `bun run build` to verify Next.js builds successfully without typescript or compiling errors.
- Run `bun run lint` to ensure no linting warnings or errors are introduced.

### Manual Verification
- **Icon Loading:** Verify that icons (favorite, delete, edit, back chevron, scanning icons) display correctly on desktop and mobile viewports.
- **Wavy Underline Gap:** Resize the viewport to ≤640px (or load on a mobile device) and check that the wavy underlines on "Currently showing...", "Search", and "Edit" are closer to the text (2px offset), and that they reset to 6px on desktop sizes.
- **Location Setup Button:** Open the location setup screen in Single Scan mode on mobile, select a room, and verify the "Start Scanning" button renders below the shelf dropdown spanning the full width without overlapping the select borders.
