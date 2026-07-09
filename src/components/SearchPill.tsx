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
}: SearchPillProps) {
  const s = fontSize / 32;
  const displayText = value || 'Search';
  const pillWidth = Math.max(120 * s, displayText.length * 16 * s + 40 * s);
  const pillLeft = -20 * s;

  const inputRef = useRef<HTMLInputElement>(null);

  // Staged entrance: the pill settles into its new width first, then the clear button scales in,
  // then the "press enter" hint fades in last — instead of all three firing at once. Exits skip
  // the staging (fast, no delay) so clearing feels immediate rather than sluggish.
  const PILL_DURATION = 0.3;
  const CLEAR_DURATION = 0.25;
  const clearButtonVariants = {
    hidden: { opacity: 0, scale: 0.5, transition: { duration: 0.15, ease: 'easeOut' as const } },
    visible: { opacity: 1, scale: 1, transition: { duration: CLEAR_DURATION, ease: 'easeOut' as const, delay: PILL_DURATION } },
  };
  const hintVariants = {
    hidden: { opacity: 0, transition: { duration: 0.15, ease: 'easeOut' as const } },
    visible: { opacity: 0.8, transition: { duration: 0.3, ease: 'easeOut' as const, delay: PILL_DURATION + CLEAR_DURATION } },
  };

  // Focus explicitly on mount rather than relying solely on the autoFocus attribute — the pill is
  // often mounted inside an AnimatePresence crossfade, and an explicit focus() guarantees the
  // cursor is live the instant it appears rather than being at the mercy of that timing.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    // The clear button lives in normal flex flow (not absolutely positioned) so it only takes up
    // space once it actually renders — no pre-reserved gap before you've typed anything, and no
    // per-context offset tuning needed to keep it clear of a tight edge like the header's.
    <span id={id} style={{
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'baseline',
    }}>
      <AnimatePresence>
        {value && (
          <motion.button
            key="clear"
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            variants={clearButtonVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: `${44 * s}px`,
              height: `${44 * s}px`,
              marginRight: `${28 * s}px`,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--accent-primary)',
              fontSize: `${38 * s}px`,
              fontWeight: 'bold',
              lineHeight: 1,
            }}
          >
            ×
          </motion.button>
        )}
      </AnimatePresence>

      <span style={{
        position: 'relative',
        display: 'inline-block',
      }}>
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
          animate={{ width: pillWidth }}
          transition={{ duration: PILL_DURATION, ease: 'easeOut' }}
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
            textDecoration: 'underline wavy var(--accent-primary)',
            textDecorationThickness: '1.5px',
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
