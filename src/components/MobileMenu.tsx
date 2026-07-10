'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLogout } from '@/hooks/useLogout';
import ThemeSwatches from '@/components/ThemeSwatches';

interface MobileMenuProps {
  onClose: () => void;
  onManageLocations: () => void;
  isGuest?: boolean;
  email?: string | null;
  themeColor: string;
  onThemeColorChange: (hex: string) => void;
}

/** Hamburger dropdown menu (mobile only): dimmed+blurred backdrop, links slide down underneath the header. */
export default function MobileMenu({ onClose, onManageLocations, isGuest = false, email = null, themeColor, onThemeColorChange }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const logout = useLogout();
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
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
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          padding: 0,
          zIndex: 10001,
        }}
        aria-label="Close menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </motion.button>

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="mobile-menu-panel"
        initial={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top items */}
        <button
          className="mobile-menu-row"
          onClick={() => setShowPalette(!showPalette)}
          style={{ justifyContent: 'flex-end', gap: '8px', width: '100%' }}
        >
          <span>Theme</span>
          <motion.span
            animate={{ rotate: showPalette ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'inline-flex', alignItems: 'center' }}
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
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '6px 24px 16px 24px',
              }}>
                <ThemeSwatches value={themeColor} onChange={onThemeColorChange} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          className="mobile-menu-row"
          onClick={() => {
            onManageLocations();
            onClose();
          }}
        >
          Manage Locations
        </button>

        <button
          className="mobile-menu-row"
          onClick={() => {
            window.location.href = '/about';
            onClose();
          }}
        >
          About
        </button>

        {/* Bottom items, pushed via margin-top: auto */}
        <div className="mobile-menu-group" style={{ marginTop: 'auto', marginBottom: '24px' }}>
          {isGuest ? (
            <button
              className="mobile-menu-row"
              style={{ fontWeight: '600', color: 'var(--accent-primary)', width: '100%', justifyContent: 'flex-end' }}
              onClick={() => {
                document.cookie = 'guest_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
                window.location.href = '/login';
                onClose();
              }}
            >
              Sign in to save your books
            </button>
          ) : (
            <>
              <div className="mobile-menu-row" style={{ cursor: 'default', color: 'var(--text-secondary)', fontSize: '0.9rem', width: '100%', justifyContent: 'flex-end' }}>
                {email}
              </div>
              <button
                className="mobile-menu-row"
                style={{ fontWeight: '600', color: 'var(--error)', width: '100%', justifyContent: 'flex-end', textAlign: 'right' }}
                onClick={() => {
                  logout();
                  onClose();
                }}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
