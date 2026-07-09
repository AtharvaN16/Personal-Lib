'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLogout } from '@/hooks/useLogout';

interface MobileMenuProps {
  onClose: () => void;
  onManageLocations: () => void;
}

/** Hamburger dropdown menu (mobile only): dimmed+blurred backdrop, links slide down underneath the header. */
export default function MobileMenu({ onClose, onManageLocations }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const logout = useLogout();

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
            logout();
            onClose();
          }}
        >
          Logout
        </button>
      </motion.div>
    </div>
  );
}
