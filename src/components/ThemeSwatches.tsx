'use client';

import { motion } from 'framer-motion';

export const THEME_COLORS: { name: string; hex: string }[] = [
  { name: 'Vivid Blue', hex: '#002CBC' },
  { name: 'Vivid Violet', hex: '#6B1FD1' },
  { name: 'Vivid Crimson', hex: '#C4123C' },
  { name: 'Vivid Teal', hex: '#037A7A' },
  { name: 'Vivid Forest Green', hex: '#0A7A3D' },
  { name: 'Vivid Burnt Orange', hex: '#A84406' },
];

interface ThemeSwatchesProps {
  value: string;
  onChange: (hex: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const swatchVariants = {
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

/** Row of clickable accent-color dots, shared by the desktop AccountMenu and the mobile hamburger panel. */
export default function ThemeSwatches({ value, onChange }: ThemeSwatchesProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={styles.row}
      role="group"
      aria-label="Theme color"
    >
      {THEME_COLORS.map((c) => {
        const selected = value.toLowerCase() === c.hex.toLowerCase();
        return (
          <motion.button
            key={c.hex}
            variants={swatchVariants}
            type="button"
            onClick={() => onChange(c.hex)}
            aria-label={c.name}
            aria-pressed={selected}
            whileTap={{ scale: 0.85 }}
            style={{
              ...styles.swatch,
              backgroundColor: c.hex,
              boxShadow: selected
                ? `0 0 0 2px var(--bg-sheet), 0 0 0 4px ${c.hex}`
                : '0 1px 3px rgba(17, 22, 37, 0.15)',
            }}
          />
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
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
};
