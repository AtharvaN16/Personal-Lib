'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useLogout } from '@/hooks/useLogout';
import ThemeSwatches from '@/components/ThemeSwatches';

interface AccountMenuProps {
  email: string | null;
  themeColor: string;
  onThemeColorChange: (hex: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isGuest?: boolean;
}

/** Desktop-only dropdown sheet, anchored under the "Menu" trigger, replacing the old bare Logout link. */
export default function AccountMenu({ email, themeColor, onThemeColorChange, isOpen, onOpenChange, isGuest = false }: AccountMenuProps) {
  const logout = useLogout();
  const [showPalette, setShowPalette] = useState(false);

  // Escape closes the sheet — outside-click close is handled by Dashboard.tsx's
  // shared useCloseOnOutsideClick, which only listens for clicks, not keys.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpenChange]);

  return (
    <div id="account-menu-wrapper" style={{ position: 'relative' }}>
      <button
        onClick={() => onOpenChange(!isOpen)}
        style={styles.trigger}
      >
        Menu
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="Account menu"
            initial={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            style={styles.panel}
          >
            {isGuest ? (
              <button
                onClick={() => {
                  document.cookie = 'guest_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
                  window.location.href = '/login';
                }}
                style={styles.signInRow}
              >
                Sign in to save your books
              </button>
            ) : (
              <div style={styles.topGroup}>
                <span style={styles.email}>{email}</span>
                <button onClick={logout} style={styles.logoutBtn}>
                  Logout
                </button>
              </div>
            )}

            <div style={styles.row}>
              <button
                onClick={() => setShowPalette(!showPalette)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={styles.rowLabel}>Theme</span>
                <motion.span
                  animate={{ rotate: showPalette ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {showPalette && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ marginTop: '-10px', paddingTop: '10px', paddingBottom: '10px' }}>
                      <ThemeSwatches value={themeColor} onChange={onThemeColorChange} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link href="/about" style={styles.row} onClick={() => onOpenChange(false)}>
              <span style={styles.rowLabel}>About</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  trigger: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-newsreader), Georgia, serif',
    fontStyle: 'italic',
    fontSize: '32px',
    color: 'var(--accent-primary)',
    textDecoration: 'underline wavy var(--accent-primary)',
    textDecorationThickness: '1.5px',
    textUnderlineOffset: '6px',
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 16px)',
    right: 0,
    minWidth: '260px',
    backgroundColor: 'var(--bg-sheet)',
    borderRadius: '12px 15px 12px 15px/15px 12px 15px 12px',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.15)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
    zIndex: 1100,
  },
  topGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  email: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    wordBreak: 'break-all',
  },
  logoutBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--error)',
  },
  signInRow: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--accent-primary)',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  rowLabel: {
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
