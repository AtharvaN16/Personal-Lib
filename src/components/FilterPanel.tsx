'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export type FilterMode = 'all' | 'favorites' | 'unread' | 'location';

interface FilterPanelProps {
  mode: FilterMode;
  room: string | null;
  rooms: string[];
  onApply: (mode: FilterMode, room: string | null) => void;
  onClose: () => void;
}

export default function FilterPanel({ mode, room, rooms, onApply, onClose }: FilterPanelProps) {
  const [draftMode, setDraftMode] = useState<FilterMode>(mode);
  const [draftRoom, setDraftRoom] = useState<string | null>(room);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap / Escape / body scroll lock, matching the app's other modals
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const selectMode = (next: FilterMode) => {
    setDraftMode(next);
    if (next !== 'location') setDraftRoom(null);
  };

  const selectRoom = (r: string) => {
    setDraftMode('location');
    setDraftRoom(r);
  };

  const handleClear = () => {
    setDraftMode('all');
    setDraftRoom(null);
  };

  const handleSave = () => {
    onApply(draftMode, draftMode === 'location' ? draftRoom : null);
    onClose();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filter books"
        tabIndex={-1}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        style={{ ...styles.modal, outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
          CLOSE
        </button>

        <h2 style={styles.title}>Filter By</h2>

        <div style={styles.optionsList}>
          <label style={styles.optionRow}>
            <input
              type="radio"
              name="filterMode"
              checked={draftMode === 'all'}
              onChange={() => selectMode('all')}
              style={styles.radioButton}
            />
            <span style={styles.optionLabel}>Show all</span>
          </label>
 
          <label style={styles.optionRow}>
            <input
              type="radio"
              name="filterMode"
              checked={draftMode === 'favorites'}
              onChange={() => selectMode('favorites')}
              style={styles.radioButton}
            />
            <span style={styles.optionLabel}>Show favorites</span>
          </label>
 
          <label style={styles.optionRow}>
            <input
              type="radio"
              name="filterMode"
              checked={draftMode === 'unread'}
              onChange={() => selectMode('unread')}
              style={styles.radioButton}
            />
            <span style={styles.optionLabel}>Show unread</span>
          </label>
 
          <label style={styles.optionRow}>
            <input
              type="radio"
              name="filterMode"
              checked={draftMode === 'location'}
              onChange={() => selectMode('location')}
              style={styles.radioButton}
            />
            <span style={styles.optionLabel}>Show based on Location</span>
          </label>
 
          {draftMode === 'location' && (
            <div style={styles.roomsList}>
              {rooms.length === 0 ? (
                <span style={styles.emptyRoomsText}>No locations catalogued yet</span>
              ) : (
                rooms.map((r) => (
                  <label key={r} style={styles.roomRow}>
                    <input
                      type="radio"
                      name="filterRoom"
                      checked={draftRoom === r}
                      onChange={() => selectRoom(r)}
                      style={styles.radioButton}
                    />
                    <span style={styles.roomLabel}>{r}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <div style={styles.actions}>
          <button onClick={handleClear} style={styles.clearBtn}>
            Clear
          </button>
          <button onClick={handleSave} style={styles.saveBtn}>
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(17, 22, 37, 0.25)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    width: '100%',
    maxWidth: '360px',
    backgroundColor: 'var(--bg-sheet)',
    padding: '28px 24px 24px 24px',
    position: 'relative',
    borderRadius: '0px',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.12)',
  },
  closeBtn: {
    position: 'absolute',
    top: '-36px',
    right: '0px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--bg-sheet)',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    transition: 'opacity 0.2s ease',
    padding: 0,
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    marginBottom: '20px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    maxHeight: '45vh',
    overflowY: 'auto',
    paddingRight: '6px',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  radioButton: {
    width: '18px',
    height: '18px',
    accentColor: 'var(--accent-primary)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  optionLabel: {
    fontSize: '1rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  roomsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingLeft: '28px',
    marginTop: '-4px',
  },
  roomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  roomLabel: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  emptyRoomsText: {
    fontSize: '0.85rem',
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '28px',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  saveBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '8px 18px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
