'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchPillProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onEscape: () => void;
  /** Clicking the × button — distinct from onChange('') so a caller can also reset any applied/committed search state, not just the typed text. */
  onClear: () => void;
  fontSize?: number;
  autoFocus?: boolean;
  /**
   * When true, the × button is absolutely positioned to the left of the pill instead of living
   * in normal flex flow. Use this in the hero where the pill must stay pinned over the static
   * "Search" word — the button floats freely without pushing the pill rightward.
   */
  floatClearButton?: boolean;
  /** Whether the search pill is actively shown and should receive focus. */
  active?: boolean;
}

/** Italic serif pill input that hugs its own content width, matching the hero's search styling. */
export default function SearchPill({
  id,
  value,
  onChange,
  onEnter,
  onEscape,
  onClear,
  fontSize = 32,
  autoFocus = false,
  floatClearButton = false,
  active,
}: SearchPillProps) {
  const s = fontSize / 32;
  const displayText = value || 'Search';
  const pillWidth = Math.max(120 * s, displayText.length * 16 * s + 40 * s);
  const pillLeft = -20 * s;

  const inputRef = useRef<HTMLInputElement>(null);

  // Staged entrance: the pill settles into its new width first, then the clear button scales in,
  // then the "press enter" hint fades in last — instead of all three firing at once. Exits skip
  // the staging (fast, no delay) so clearing feels immediate rather than sluggish.
  const PILL_DURATION = 0.5;
  const CLEAR_DURATION = 0.25;
  
  // Floating clear button (hero): scales in place
  const clearButtonVariants = {
    hidden: { opacity: 0, scale: 0.5, transition: { duration: 0.15, ease: 'easeOut' as const } },
    visible: { opacity: 1, scale: 1, transition: { duration: CLEAR_DURATION, ease: 'easeOut' as const, delay: PILL_DURATION } },
  };

  // Flow clear button (header): expands its width and margin gently to slide the pill over
  const clearButtonFlowVariants = {
    hidden: {
      opacity: 0,
      scale: 0.5,
      width: 0,
      marginRight: 0,
      transition: { duration: 0.25, ease: 'easeInOut' as const }
    },
    visible: {
      opacity: 1,
      scale: 1,
      width: 44 * s,
      marginRight: 28 * s,
      transition: {
        duration: 0.65, // Longer/gentler duration as requested
        ease: [0.25, 1, 0.5, 1] as const, // Gentle cubic-bezier easing
      }
    }
  };

  const hintVariants = {
    hidden: { opacity: 0, transition: { duration: 0.15, ease: 'easeOut' as const } },
    visible: { opacity: 0.8, transition: { duration: 0.3, ease: 'easeOut' as const, delay: PILL_DURATION + CLEAR_DURATION } },
  };

  // Focus explicitly when active becomes true, or on initial mount if autoFocus is true
  useEffect(() => {
    if (active || (active === undefined && autoFocus)) {
      inputRef.current?.focus();
    }
  }, [active, autoFocus]);

  // When floatClearButton=false (header), the × sits in flex-flow to the left so the pill can
  // shift rightward to make room — the header has space for that. When floatClearButton=true
  // (hero), the × is absolutely positioned to the left of the pill so the pill stays pinned
  // exactly over the static "Search" word; the blurred text behind it never moves.
  const clearButtonStyle: React.CSSProperties = floatClearButton
    ? {
        // Float left of the pill's left edge (pillLeft = -20*s). The button is 44*s wide with an
        // 8*s gap, so its right edge lands at pillLeft, keeping it just clear of the pill.
        // Vertical extent mirrors the pill (top: -6*s, height: 100%+12*s) so centering is
        // accurate without relying on `top: 50%` — which is unreliable on auto-height inline-block
        // containing blocks (browsers may resolve the percentage to 0).
        position: 'absolute',
        right: `calc(100% + ${-pillLeft + 8 * s}px)`,
        top: `${-6 * s}px`,
        height: `calc(100% + ${12 * s}px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${44 * s}px`,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'var(--accent-primary)',
        fontSize: `${38 * s}px`,
        fontWeight: 'bold',
        lineHeight: 1,
      }
    : {
        // Normal in-flow position (header): takes up space so the pill shifts right.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        height: `${44 * s}px`,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'var(--accent-primary)',
        fontSize: `${38 * s}px`,
        fontWeight: 'bold',
        lineHeight: 1,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      };

  return (
    <span id={id} style={{
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'baseline',
    }}>
      {/* In-flow clear button (header mode only) */}
      {!floatClearButton && (
        <AnimatePresence>
          {value && (
            <motion.button
              key="clear-flow"
              type="button"
              onClick={onClear}
              aria-label="Clear search"
              variants={clearButtonFlowVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={clearButtonStyle}
            >
              ×
            </motion.button>
          )}
        </AnimatePresence>
      )}


      <span style={{
        position: 'relative',
        display: 'inline-block',
      }}>
        {/* Floating clear button (hero mode) — absolutely positioned left of the pill so the pill never shifts */}
        {floatClearButton && (
          <AnimatePresence>
            {value && (
              <motion.button
                key="clear-float"
                type="button"
                onClick={onClear}
                aria-label="Clear search"
                variants={clearButtonVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                style={clearButtonStyle}
              >
                ×
              </motion.button>
            )}
          </AnimatePresence>
        )}
        {/* Static hidden placeholder of "Search" so surrounding content is placed correctly */}
        <span style={{
          visibility: 'hidden',
          fontStyle: 'italic',
          fontFamily: 'var(--font-newsreader), Georgia, serif',
          fontSize: `${fontSize}px`,
          fontWeight: 'normal',
          lineHeight: '1.4',
          opacity: 0.4,
          filter: 'blur(5px)',
        }}>
          Search
        </span>

        <motion.input
          ref={inputRef}
          autoFocus={autoFocus}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
              onEnter();
            } else if (e.key === 'Escape') {
              (e.target as HTMLInputElement).blur();
              onEscape();
            }
          }}
          placeholder="Search"
          initial={{ width: pillWidth }}
          animate={{ width: pillWidth }}
          transition={{ duration: PILL_DURATION, ease: [0.25, 1, 0.5, 1] }}
          style={{
            position: 'absolute',
            left: `${pillLeft}px`, // Offset slightly to overlap the text naturally
            top: `${-6 * s}px`,
            fontFamily: 'var(--font-newsreader), Georgia, serif',
            fontWeight: 'normal',
            fontSize: `${fontSize}px`,
            fontStyle: 'italic',
            color: 'var(--accent-primary)',
            backgroundColor: 'rgba(0, 44, 188, 0.06)', // Light blue container background
            borderRadius: `${8 * s}px`, // Clean capsule border radius
            padding: `${6 * s}px ${20 * s}px`, // More padding to the search pill
            border: 'none',
            outline: 'none',
            lineHeight: '1.4',
            height: `calc(100% + ${12 * s}px)`,
            margin: 0,
            boxSizing: 'border-box',
            zIndex: 10,
          }}
        />

        <AnimatePresence>
          {value && (
            <motion.span
              key="hint"
              variants={hintVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={{
                position: 'absolute',
                left: `${pillWidth + 12 * s}px`, // Clear gap after the pill, rather than overlapping it
                top: '50%',
                transform: 'translateY(-55%)',
                fontSize: `${15 * s}px`,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-instrument-sans), sans-serif',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                fontWeight: 'bold',
                zIndex: 20,
              }}
            >
              press ⏎
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </span>
  );
}
