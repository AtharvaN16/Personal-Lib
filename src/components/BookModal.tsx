'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import AddLocationModal from '@/components/AddLocationModal';

export interface Book {
  id: string;
  title: string;
  authors: string[];
  isbn?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  description?: string | null;
  cover_url?: string | null;
  location?: {
    room: string;
    bookshelf: string;
  } | null;
  genres?: string[];
  status?: 'Completed' | 'Reading' | 'To Read';
  notes?: string | null;
  x?: number;
  y?: number;
  favorite?: boolean;
}

interface BookModalProps {
  book: Book;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: 'Completed' | 'Reading' | 'To Read') => void;
  onLocationChange?: (id: string, locationId: string, locationObj: { room: string; bookshelf: string } | null) => void;
  onFavoriteToggle?: (id: string, favorite: boolean) => void;
}

export default function BookModal({ 
  book, 
  onClose, 
  onDelete, 
  onStatusChange,
  onLocationChange,
  onFavoriteToggle
}: BookModalProps) {
  const supabase = createClient();
  const [shelves, setShelves] = useState<{ id: string; room: string; bookshelf: string }[]>([]);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedShelfId, setSelectedShelfId] = useState('');
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  
  // Local state for favorite toggle
  const [favorite, setFavorite] = useState(book.favorite || false);

  // Fetch all shelves on mount for selection dropdowns
  useEffect(() => {
    async function loadShelves() {
      try {
        const { data } = await supabase.from('shelves').select('id, room, bookshelf');
        if (data) {
          setShelves(data);
        }
      } catch {
        console.warn('Failed to load shelves list');
      }
    }
    loadShelves();
  }, [supabase]);

  // Set up initial selection values on Edit trigger
  const handleEditClick = () => {
    setIsEditingLocation(true);
    if (book.location) {
      const match = shelves.find(
        s => s.room === book.location?.room && s.bookshelf === book.location?.bookshelf
      );
      if (match) {
        setSelectedRoom(match.room);
        setSelectedShelfId(match.id);
      } else {
        setSelectedRoom('');
        setSelectedShelfId('');
      }
    } else {
      setSelectedRoom('');
      setSelectedShelfId('');
    }
  };

  const handleSaveLocation = () => {
    const selectedShelf = shelves.find(s => s.id === selectedShelfId);
    if (selectedShelf) {
      onLocationChange?.(book.id, selectedShelf.id, {
        room: selectedShelf.room,
        bookshelf: selectedShelf.bookshelf
      });
    } else if (selectedShelfId === 'unassigned') {
      onLocationChange?.(book.id, '', null);
    }
    setIsEditingLocation(false);
  };

  // Toggle favorite trigger
  const handleFavoriteClick = () => {
    const nextFavorite = !favorite;
    setFavorite(nextFavorite);
    onFavoriteToggle?.(book.id, nextFavorite);
  };

  // Toggle completed status trigger (Star)
  const handleCompletedClick = () => {
    const nextStatus = book.status === 'Completed' ? 'To Read' : 'Completed';
    onStatusChange?.(book.id, nextStatus);
  };

  // Delete book trigger
  const handleDeleteClick = () => {
    if (confirm('Are you sure you want to delete this book?')) {
      onDelete?.(book.id);
    }
  };

  // Get unique room lists from existing shelves
  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room)));
  const shelvesInRoom = shelves.filter(s => s.room === selectedRoom);

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Top-Right Square Actions */}
        <div style={styles.modalActions}>
          {/* Favorite Toggle Button (Heart) */}
          <button 
            onClick={handleFavoriteClick} 
            style={{
              ...styles.squareBtn,
              color: favorite ? '#C77966' : 'var(--text-primary)'
            }}
            title="Favorites"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {/* Completed Toggle Button (Star) */}
          <button 
            onClick={handleCompletedClick} 
            style={{
              ...styles.squareBtn,
              color: book.status === 'Completed' ? '#D4A373' : 'var(--text-primary)'
            }}
            title="Completed status"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={book.status === 'Completed' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>

          {/* Delete Button (Trash) */}
          <button 
            onClick={handleDeleteClick} 
            style={{
              ...styles.squareBtn,
              color: '#8B1E1E'
            }}
            title="Delete book"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>

        {/* Close Button */}
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div style={styles.content}>
          {/* Left Column - Cover and Actions */}
          <div style={styles.leftCol}>
            <div style={styles.coverWrapper}>
              {book.cover_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={book.cover_url} alt={book.title} style={styles.coverImg} />
              ) : (
                <div style={styles.placeholderCover}>
                  <span className="handwritten">{book.title}</span>
                </div>
              )}
            </div>

            {/* Read Status Selector */}
            <div style={styles.statusWrapper}>
              <select
                value={book.status || 'To Read'}
                onChange={(e) => onStatusChange?.(book.id, e.target.value as 'Completed' | 'Reading' | 'To Read')}
                style={styles.statusSelect}
                className="handwritten"
              >
                <option value="Completed">Completed v</option>
                <option value="Reading">Reading v</option>
                <option value="To Read">To Read v</option>
              </select>
            </div>
          </div>

          {/* Right Column - Information */}
          <div style={styles.rightCol}>
            <div style={styles.headerInfo}>
              <h2 style={styles.title}>
                {book.title}
              </h2>
              <p style={styles.author}>
                {book.authors.join(', ')}
              </p>
            </div>

            {/* Location Section ("where is it?") */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>where is it?</h3>
                {!isEditingLocation && (
                  <button onClick={handleEditClick} style={styles.editLink}>Edit</button>
                )}
              </div>

              {isEditingLocation ? (
                <div style={styles.editLocationForm}>
                  {/* Select Room */}
                  <select 
                    value={selectedRoom} 
                    onChange={(e) => {
                      setSelectedRoom(e.target.value);
                      setSelectedShelfId('');
                    }}
                    style={styles.selectField}
                  >
                    <option value="">-- Select Room --</option>
                    {uniqueRooms.map((r, i) => (
                      <option key={i} value={r}>{r}</option>
                    ))}
                  </select>

                  {/* Select Shelf */}
                  <select
                    value={selectedShelfId}
                    onChange={(e) => setSelectedShelfId(e.target.value)}
                    disabled={!selectedRoom}
                    style={styles.selectField}
                  >
                    <option value="">-- Select Shelf/Bookshelf --</option>
                    <option value="unassigned">Unassigned / None</option>
                    {shelvesInRoom.map((s) => (
                      <option key={s.id} value={s.id}>{s.bookshelf}</option>
                    ))}
                  </select>

                  <div style={styles.inlineActions}>
                    <button 
                      onClick={() => setIsAddLocationOpen(true)} 
                      style={styles.createLocationLink}
                    >
                      + Create New Location
                    </button>
                    <div style={styles.formButtons}>
                      <button 
                        onClick={() => setIsEditingLocation(false)} 
                        style={styles.formCancelBtn}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveLocation} 
                        style={styles.formSaveBtn}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={styles.sectionContent}>
                  {book.location 
                    ? `${book.location.room}, ${book.location.bookshelf}` 
                    : 'Unassigned shelf'}
                </p>
              )}
            </div>

            {/* Genre Section with Rounded Pills */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Genre</h3>
              <div style={styles.genreContainer}>
                {book.genres && book.genres.length > 0 ? (
                  book.genres.map((genre, idx) => (
                    <span key={idx} style={styles.genrePill}>
                      {genre}
                    </span>
                  ))
                ) : (
                  <span style={styles.noGenres}>No genres assigned</span>
                )}
              </div>
            </div>
            
            {/* Description (If available) */}
            {book.description && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Description</h3>
                <p style={styles.descriptionText}>{book.description}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Nested AddLocationModal Trigger */}
      <AnimatePresence>
        {isAddLocationOpen && (
          <AddLocationModal
            onClose={() => setIsAddLocationOpen(false)}
            onLocationAdded={(newLoc) => {
              setShelves(prev => [...prev, newLoc]);
              setSelectedRoom(newLoc.room);
              setSelectedShelfId(newLoc.id);
            }}
          />
        )}
      </AnimatePresence>
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
    maxWidth: '680px',
    backgroundColor: 'var(--bg-primary)',
    padding: '40px 36px 36px 36px',
    position: 'relative',
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: '0px',
    border: 'none',
    boxShadow: '0 12px 35px rgba(17, 22, 37, 0.15)',
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'color 0.2s ease',
  },
  modalActions: {
    position: 'absolute',
    top: '18px',
    right: '55px',
    display: 'flex',
    gap: '6px',
  },
  squareBtn: {
    width: '24px',
    height: '24px',
    border: '2px solid var(--border-sketch)',
    borderRadius: '0px',
    backgroundColor: 'var(--bg-sheet)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  content: {
    display: 'flex',
    gap: '36px',
    flexDirection: 'row',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
    width: '150px',
    flexShrink: 0,
  },
  coverWrapper: {
    width: '150px',
    height: '210px',
    borderRadius: '0px',
    overflow: 'hidden',
    boxShadow: '0 8px 20px rgba(17, 22, 37, 0.12)',
    border: 'none',
    backgroundColor: 'var(--bg-sheet)',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    textAlign: 'center',
    backgroundColor: 'var(--bg-sheet)',
  },
  statusSelect: {
    background: 'none',
    border: 'none',
    color: '#0D7F54',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'var(--font-caveat), cursive',
  },
  statusWrapper: {
    marginTop: '8px',
  },
  deleteBtn: {
    // Hide default text button from left column as we now use top right trash icon
    display: 'none',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
    flex: 1,
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    lineHeight: '1.1',
  },
  author: {
    fontSize: '1.25rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  editLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    textDecoration: 'underline',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  sectionContent: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
  },
  genreContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  genrePill: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: 'var(--bg-sheet)',
    color: 'var(--text-secondary)',
    borderRadius: '20px',
    fontSize: '0.85rem',
    border: '2px solid var(--border-sketch)',
  },
  noGenres: {
    fontSize: '1.1rem',
    color: 'var(--text-tertiary)',
  },
  descriptionText: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  editLocationForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '340px',
  },
  selectField: {
    padding: '8px 12px',
    border: '2px solid var(--border-sketch)',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: 'var(--bg-sheet)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  inlineActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  createLocationLink: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  formButtons: {
    display: 'flex',
    gap: '12px',
  },
  formCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  formSaveBtn: {
    backgroundColor: 'var(--bg-sheet)',
    border: '2px solid var(--border-sketch)',
    color: 'var(--text-primary)',
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
