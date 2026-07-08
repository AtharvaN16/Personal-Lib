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
    } else if (selectedShelfId === 'unassigned' || !selectedShelfId) {
      onLocationChange?.(book.id, '', null);
    }
    setIsEditingLocation(false);
  };

  // Toggle favorite trigger (directly modifies parent)
  const handleFavoriteClick = () => {
    onFavoriteToggle?.(book.id, !book.favorite);
  };

  // Toggle completed status trigger (Trophy)
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
        {/* Floating Top-Right Square Actions - Google Icons */}
        <div style={styles.modalActions}>
          {/* Favorite Toggle Button (Heart) */}
          <button 
            onClick={handleFavoriteClick} 
            style={{
              ...styles.squareBtn,
              color: book.favorite ? '#C77966' : 'var(--text-primary)'
            }}
            title="Favorites"
          >
            <span 
              className="material-symbols-outlined" 
              style={{ 
                fontSize: '18px', 
                fontVariationSettings: book.favorite ? "'FILL' 1" : "'FILL' 0" 
              }}
            >
              favorite
            </span>
          </button>

          {/* Completed Toggle Button (Trophy) */}
          <button 
            onClick={handleCompletedClick} 
            style={{
              ...styles.squareBtn,
              color: book.status === 'Completed' ? '#D4A373' : 'var(--text-primary)'
            }}
            title="Completed status"
          >
            <span 
              className="material-symbols-outlined" 
              style={{ 
                fontSize: '18px', 
                fontVariationSettings: book.status === 'Completed' ? "'FILL' 1" : "'FILL' 0" 
              }}
            >
              trophy
            </span>
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
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              delete
            </span>
          </button>
        </div>

        {/* Close Button - Outside the Box */}
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
            close
          </span>
        </button>

        <div style={styles.content}>
          {/* Left Column - Cover */}
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
          </div>

          {/* Right Column - Scrollable Information */}
          <div style={styles.rightCol}>
            <div style={styles.headerInfo}>
              <h2 style={styles.title}>
                {book.title}
              </h2>
              <p style={styles.author}>
                {book.authors.join(', ')}
              </p>
            </div>

            {/* Location Section ("Where is it?") with synchronized transitions */}
            <AnimatePresence mode="wait">
              {isEditingLocation ? (
                <motion.div
                  key="edit-form"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.2 }}
                  style={styles.section}
                >
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Where is it?</h3>
                  </div>
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

                    {/* Select Shelf (Progressively Disclosed with Blur & Slide) */}
                    <AnimatePresence>
                      {selectedRoom && (
                        <motion.div
                          key="shelf-select-wrapper"
                          initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                          transition={{ duration: 0.15 }}
                        >
                          <select
                            value={selectedShelfId}
                            onChange={(e) => setSelectedShelfId(e.target.value)}
                            style={styles.selectFieldWidth}
                          >
                            <option value="">-- Select Shelf/Bookshelf --</option>
                            <option value="unassigned">Unassigned / None</option>
                            {shelvesInRoom.map((s) => (
                              <option key={s.id} value={s.id}>{s.bookshelf}</option>
                            ))}
                          </select>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div style={styles.inlineActions}>
                      <button 
                        type="button"
                        onClick={() => setIsAddLocationOpen(true)} 
                        style={styles.createLocationLink}
                      >
                        + Create New Location
                      </button>
                      <div style={styles.formButtons}>
                        <button 
                          type="button"
                          onClick={() => setIsEditingLocation(false)} 
                          style={styles.formCancelBtn}
                        >
                          Cancel
                        </button>
                        <button 
                          type="button"
                          onClick={handleSaveLocation} 
                          style={styles.formSaveBtn}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="display-view"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.2 }}
                  style={styles.section}
                >
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Where is it?</h3>
                    <button onClick={handleEditClick} style={styles.editLink}>Edit</button>
                  </div>
                  <p style={styles.sectionContent}>
                    {book.location 
                      ? `${book.location.room}, ${book.location.bookshelf}` 
                      : 'Unassigned shelf'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Genre Section - Hidden with animation when editing location */}
            <AnimatePresence>
              {!isEditingLocation && (
                <motion.div 
                  key="genre-section"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.2 }}
                  style={styles.section}
                >
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
                </motion.div>
              )}
            </AnimatePresence>
            
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
    maxWidth: '680px',
    height: '480px', // Constant Height
    backgroundColor: 'var(--bg-primary)',
    padding: '40px 36px 36px 36px',
    position: 'relative',
    borderRadius: '0px',
    border: 'none',
    boxShadow: '0 12px 35px rgba(17, 22, 37, 0.15)',
    display: 'flex',
    flexDirection: 'column',
  },
  closeBtn: {
    position: 'absolute',
    top: '0px',
    right: '-48px', // Float outside the box
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#FFFDFB',
    transition: 'opacity 0.2s ease',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    display: 'flex',
    gap: '8px',
  },
  squareBtn: {
    width: '32px',
    height: '32px',
    border: 'none',
    backgroundColor: 'var(--bg-sheet)',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
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
    height: '100%',
    overflow: 'hidden',
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
    boxShadow: '0 16px 30px rgba(17, 22, 37, 0.22)',
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
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    flex: 1,
    overflowY: 'auto', // Scrollable column content
    paddingRight: '8px',
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
    backgroundColor: '#EAE7D8',
    color: 'var(--text-secondary)',
    borderRadius: '20px',
    fontSize: '0.85rem',
    border: 'none',
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
    width: '100%',
    maxWidth: '340px',
  },
  selectField: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: 'var(--bg-sheet)',
    color: 'var(--text-primary)',
    boxShadow: 'inset 0 1px 3px rgba(17, 22, 37, 0.08)',
    outline: 'none',
    width: '100%',
  },
  selectFieldWidth: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: 'var(--bg-sheet)',
    color: 'var(--text-primary)',
    boxShadow: 'inset 0 1px 3px rgba(17, 22, 37, 0.08)',
    outline: 'none',
    width: '100%',
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
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--text-primary)',
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
