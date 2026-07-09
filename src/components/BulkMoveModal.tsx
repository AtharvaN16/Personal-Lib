'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface BulkMoveModalProps {
  count: number;
  onClose: () => void;
  onApply: (locationId: string, locationObj: { room: string; bookshelf: string } | null) => void;
}

export default function BulkMoveModal({ count, onClose, onApply }: BulkMoveModalProps) {
  const supabase = createClient();
  const [shelves, setShelves] = useState<{ id: string; room: string; bookshelf: string }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedShelfId, setSelectedShelfId] = useState('');
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus the panel on open, restore focus on close, trap Tab, close on Escape, prevent body scroll
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

  // Fetch all shelves on mount for the room/shelf dropdowns
  useEffect(() => {
    async function loadShelves() {
      try {
        const { data } = await supabase.from('shelves').select('id, room, bookshelf');
        if (data) setShelves(data);
      } catch {
        console.warn('Failed to load shelves list');
      }
    }
    loadShelves();
  }, [supabase]);

  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room)));
  const shelvesInRoom = shelves.filter(s => s.room === selectedRoom && s.bookshelf !== '');

  const handleApply = async () => {
    const selectedShelf = shelves.find(s => s.id === selectedShelfId);
    if (selectedShelf) {
      onApply(selectedShelf.id, { room: selectedShelf.room, bookshelf: selectedShelf.bookshelf });
      return;
    }

    if (!selectedRoom) return;

    // Room chosen without a specific shelf — find or create a "room only" entry (bookshelf: '')
    const roomOnlyShelf = shelves.find(s => s.room === selectedRoom && s.bookshelf === '');
    if (roomOnlyShelf) {
      onApply(roomOnlyShelf.id, { room: selectedRoom, bookshelf: '' });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('shelves')
        .insert([{ room: selectedRoom, bookshelf: '', user_id: user?.id }])
        .select();
      if (error) throw error;
      if (data && data[0]) {
        onApply(data[0].id, { room: selectedRoom, bookshelf: '' });
        return;
      }
    } catch {
      console.warn('Failed to save room-only location');
      onApply('', { room: selectedRoom, bookshelf: '' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={styles.backdrop}
      onClick={onClose}
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Move books"
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

        <h2 style={styles.title}>Move {count} book{count === 1 ? '' : 's'}</h2>
        <p style={styles.subtitle}>Choose a destination room and shelf.</p>

        <div style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="bulk-move-room" style={styles.label}>Room</label>
            <select
              id="bulk-move-room"
              aria-label="Select room"
              value={selectedRoom}
              onChange={(e) => {
                setSelectedRoom(e.target.value);
                setSelectedShelfId('');
              }}
              style={styles.selectField}
              className="book-modal-select"
            >
              <option value="">-- Select Room --</option>
              {uniqueRooms.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {selectedRoom && (
            <div style={styles.inputGroup}>
              <label htmlFor="bulk-move-shelf" style={styles.label}>Shelf</label>
              <select
                id="bulk-move-shelf"
                aria-label="Select shelf"
                value={selectedShelfId}
                onChange={(e) => setSelectedShelfId(e.target.value)}
                style={styles.selectField}
                className="book-modal-select"
              >
                <option value="">Unassigned</option>
                {shelvesInRoom.map((s) => (
                  <option key={s.id} value={s.id}>{s.bookshelf}</option>
                ))}
              </select>
            </div>
          )}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={loading || !selectedRoom}
              style={{ ...styles.submitBtn, opacity: (loading || !selectedRoom) ? 0.6 : 1 }}
            >
              {loading ? 'Moving...' : 'Move'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 22, 37, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    width: '100%',
    maxWidth: '380px',
    backgroundColor: 'var(--bg-sheet)',
    padding: '28px 24px 24px 24px',
    position: 'relative',
    maxHeight: '90svh',
    overflowY: 'auto',
    borderRadius: '0px',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.12)',
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    transition: 'color 0.2s ease',
    padding: 0,
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    marginBottom: '6px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
    lineHeight: '1.4',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  selectField: {
    padding: '8px 12px',
    border: '1px solid rgba(17, 22, 37, 0.12)',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: '#FFFFFF',
    color: 'var(--text-primary)',
    boxShadow: 'none',
    outline: 'none',
    width: '100%',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '16px',
    marginTop: '10px',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    transition: 'transform 0.2s ease',
  },
};
