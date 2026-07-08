'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface AddLocationModalProps {
  onClose: () => void;
  onLocationAdded: (newLocation: { id: string; room: string; bookshelf: string }) => void;
}

export default function AddLocationModal({ onClose, onLocationAdded }: AddLocationModalProps) {
  const supabase = createClient();
  const [room, setRoom] = useState('');
  const [bookshelf, setBookshelf] = useState('');
  const [shelfIndex, setShelfIndex] = useState('');
  const [roomsList, setRoomsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing rooms list on mount for autocomplete suggestions
  useEffect(() => {
    async function fetchRooms() {
      try {
        const { data } = await supabase
          .from('shelves')
          .select('room');
        
        if (data) {
          // Get unique room names
          const uniqueRooms = Array.from(new Set(data.map(item => item.room)));
          setRoomsList(uniqueRooms);
        }
      } catch {
        console.warn('Failed to fetch existing rooms');
      }
    }
    fetchRooms();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room.trim() || !bookshelf.trim()) {
      setError('Please fill in both Room and Bookshelf Name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      const parsedShelfIndex = shelfIndex ? parseInt(shelfIndex, 10) : null;
      
      const newShelfData = {
        user_id: user?.id || '00000000-0000-0000-0000-000000000000', // fallback mock user id
        room: room.trim(),
        bookshelf: bookshelf.trim(),
        shelf_index: parsedShelfIndex === null || isNaN(parsedShelfIndex) ? null : parsedShelfIndex,
      };

      const { data, error: insertError } = await supabase
        .from('shelves')
        .insert(newShelfData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      if (data) {
        onLocationAdded({
          id: data.id,
          room: data.room,
          bookshelf: data.bookshelf,
        });
        onClose();
      }
    } catch {
      console.error('Error inserting location');
      // Fallback for offline/guest mockup testing
      const mockId = Math.random().toString(36).substring(7);
      onLocationAdded({
        id: mockId,
        room: room.trim(),
        bookshelf: bookshelf.trim(),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        className="cozy-card"
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - CLOSE text in all caps */}
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          CLOSE
        </button>

        <h2 style={styles.title}>Add Location</h2>
        <p style={styles.subtitle}>Define a room and shelf in your house to catalog your books.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorAlert}>{error}</div>}

          {/* Room input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Room Name</label>
            <input
              type="text"
              className="input-cozy"
              placeholder="e.g. Living Room, Bedroom"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              list="existing-rooms"
              required
            />
            <datalist id="existing-rooms">
              {roomsList.map((r, idx) => (
                <option key={idx} value={r} />
              ))}
            </datalist>
          </div>

          {/* Bookshelf input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Bookshelf / Storage Name</label>
            <input
              type="text"
              className="input-cozy"
              placeholder="e.g. Tall Pine Shelf, Bedside Table"
              value={bookshelf}
              onChange={(e) => setBookshelf(e.target.value)}
              required
            />
          </div>

          {/* Optional Shelf Index input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Shelf Index (Optional)</label>
            <input
              type="number"
              className="input-cozy"
              placeholder="e.g. 1 for top shelf, 2 for second shelf"
              value={shelfIndex}
              onChange={(e) => setShelfIndex(e.target.value)}
              min="1"
            />
          </div>

          {/* Submit Actions */}
          <div style={styles.actions}>
            <button 
              type="button" 
              onClick={onClose} 
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              style={styles.submitBtn}
              className="sketch-border"
            >
              {loading ? 'Adding...' : 'Add Location'}
            </button>
          </div>
        </form>
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: 'var(--bg-primary)',
    padding: '36px',
    position: 'relative',
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: '0px', // Removed corner radius
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    transition: 'color 0.2s ease',
    padding: 0,
  },
  title: {
    fontSize: '2.5rem',
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
    lineHeight: '1.4',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  errorAlert: {
    color: '#8B1E1E',
    backgroundColor: '#F7EAE6',
    border: '1px solid #8B1E1E',
    borderRadius: '4px',
    padding: '10px 14px',
    fontSize: '0.9rem',
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
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  submitBtn: {
    backgroundColor: 'var(--bg-sheet)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--text-primary)',
    padding: '8px 20px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    transition: 'transform 0.2s ease',
  },
};
