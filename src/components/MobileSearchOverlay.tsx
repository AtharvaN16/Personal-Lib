'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileSearchOverlayProps {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onClear: () => void;
  onClose: () => void;
}

/** Full-width search bar overlay (mobile only): dimmed+blurred backdrop, input on top, replaces the desktop inline search pill. */
export default function MobileSearchOverlay({ value, onChange, onEnter, onClear, onClose }: MobileSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="mobile-overlay-backdrop" onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="mobile-search-panel"
        initial={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence>
          {value && (
            <motion.button
              className="mobile-search-clear"
              onClick={onClear}
              aria-label="Clear search"
              initial={{ opacity: 0, width: 0, marginRight: 0, scale: 0.5 }}
              animate={{ opacity: 1, width: '44px', marginRight: '8px', scale: 1 }}
              exit={{ opacity: 0, width: 0, marginRight: 0, scale: 0.5 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </motion.button>
          )}
        </AnimatePresence>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
              onEnter();
            }
          }}
          placeholder="Search your library"
          className="mobile-search-input"
        />
        <button className="mobile-search-close" onClick={onClose} aria-label="Close search">
          Close
        </button>
      </motion.div>
    </div>
  );
}
