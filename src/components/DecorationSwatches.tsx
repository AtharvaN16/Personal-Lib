'use client';

import { motion, type Variants } from 'framer-motion';
import type { DecorationStyle } from '@/lib/userPrefs';

const DECORATION_OPTIONS: { style: DecorationStyle; label: string }[] = [
  { style: 'wavy', label: 'Style 1' },
  { style: 'dotted', label: 'Style 2' },
  { style: 'stitched', label: 'Style 3' },
];

interface DecorationSwatchesProps {
  value: DecorationStyle;
  onChange: (style: DecorationStyle) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const swatchVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 24,
    },
  },
};

/** Row of clickable decoration-style previews, shared by the desktop AccountMenu and the mobile hamburger panel. Mirrors ThemeSwatches.tsx. */
export default function DecorationSwatches({ value, onChange }: DecorationSwatchesProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={styles.row}
      role="group"
      aria-label="Decoration style"
    >
      {DECORATION_OPTIONS.map((opt) => {
        const selected = value === opt.style;
        return (
          <motion.button
            key={opt.style}
            variants={swatchVariants}
            type="button"
            onClick={() => onChange(opt.style)}
            aria-label={opt.label}
            aria-pressed={selected}
            whileTap={{ scale: 0.9 }}
            style={styles.swatch}
          >
            <span
              className="decorated-underline"
              data-decoration-preview={opt.style}
              style={{ color: selected ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}
            >
              {opt.label}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  swatch: {
    background: 'none',
    border: 'none',
    padding: '4px 6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
