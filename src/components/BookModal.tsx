'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import AddLocationModal from '@/components/AddLocationModal';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';

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
  /** True while this book hasn't been saved to the library yet (fresh scan result). */
  isNew?: boolean;
  /** Called when the user confirms saving a new (unsaved) book. Ignored unless isNew. */
  onSaveNew?: () => void;
  /** True while onSaveNew's save is in flight, to disable the button and show progress. */
  isSaving?: boolean;
  /** Called when the user manually fills in an author the lookup couldn't find. Ignored unless isNew. */
  onAuthorChange?: (id: string, authors: string[]) => void;
}

const DESCRIPTION_EXPAND_THRESHOLD = 220; // Roughly where text starts exceeding 4 lines at this width

export default function BookModal({
  book,
  onClose,
  onDelete,
  onStatusChange,
  onLocationChange,
  onFavoriteToggle,
  isNew = false,
  onSaveNew,
  isSaving = false,
  onAuthorChange,
}: BookModalProps) {
  const supabase = createClient();
  const [shelves, setShelves] = useState<{ id: string; room: string; bookshelf: string }[]>([]);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedShelfId, setSelectedShelfId] = useState('');
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isEditingAuthor, setIsEditingAuthor] = useState(false);
  const [authorDraft, setAuthorDraft] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
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

  const handleSaveLocation = async () => {
    const selectedShelf = shelves.find(s => s.id === selectedShelfId);
    if (selectedShelf) {
      onLocationChange?.(book.id, selectedShelf.id, {
        room: selectedShelf.room,
        bookshelf: selectedShelf.bookshelf
      });
      setIsEditingLocation(false);
      return;
    }

    if (!selectedRoom) {
      // No room chosen at all — clear the location entirely
      onLocationChange?.(book.id, '', null);
      setIsEditingLocation(false);
      return;
    }

    // Room chosen without a specific shelf — find or create a "room only" entry (bookshelf: '')
    const roomOnlyShelf = shelves.find(s => s.room === selectedRoom && s.bookshelf === '');
    if (roomOnlyShelf) {
      onLocationChange?.(book.id, roomOnlyShelf.id, { room: selectedRoom, bookshelf: '' });
      setIsEditingLocation(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('shelves')
        .insert([{ room: selectedRoom, bookshelf: '', user_id: user?.id }])
        .select();
      if (error) throw error;
      if (data && data[0]) {
        setShelves(prev => [...prev, data[0]]);
        onLocationChange?.(book.id, data[0].id, { room: selectedRoom, bookshelf: '' });
      }
    } catch {
      console.warn('Failed to save room-only location');
      onLocationChange?.(book.id, '', { room: selectedRoom, bookshelf: '' });
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

  // Delete book trigger — swaps the action row into an inline confirm instead of a native dialog
  const handleDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = () => {
    setIsConfirmingDelete(false);
    if (isNew) {
      onClose();
    } else {
      onDelete?.(book.id);
    }
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  // Fill in an author the lookup couldn't find (scan preview only)
  const handleAddAuthorClick = () => {
    setAuthorDraft('');
    setIsEditingAuthor(true);
  };

  const handleSaveAuthor = () => {
    const name = authorDraft.trim();
    if (!name) return;
    onAuthorChange?.(book.id, [name]);
    setIsEditingAuthor(false);
  };

  const handleCancelAuthor = () => {
    setIsEditingAuthor(false);
  };

  // Pull just the year out of a published_date string (e.g. "January 28, 1813" -> "1813")
  const publishedYear = book.published_date?.match(/\d{4}/)?.[0] || null;

  // Get unique room lists from existing shelves
  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room)));
  const shelvesInRoom = shelves.filter(s => s.room === selectedRoom && s.bookshelf !== '');

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${book.title} details`}
        tabIndex={-1}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        style={{ ...styles.modal, outline: 'none' }}
        className="book-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - Positioned above the card on the top right */}
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          CLOSE
        </button>

        {/* Action Buttons Row - Sits above both columns so cover and content stay top-aligned */}
        <AnimatePresence mode="wait">
          {isConfirmingDelete ? (
            <motion.div
              key="confirm-delete"
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.15 }}
              style={styles.confirmDeleteRow}
            >
              <span style={styles.confirmDeleteText}>
                {isNew ? 'Discard this book?' : 'Delete this book?'}
              </span>
              <button onClick={handleConfirmDelete} style={styles.confirmDeleteBtn}>
                {isNew ? 'Discard' : 'Delete'}
              </button>
              <button onClick={handleCancelDelete} style={styles.confirmCancelBtn}>
                Cancel
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="action-buttons"
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.15 }}
              style={styles.actionButtonsRow}
            >
              {/* Favorite Toggle Button (Heart) */}
              <button
                onClick={handleFavoriteClick}
                className="icon-btn"
                style={{
                  ...styles.iconBtn,
                  color: book.favorite ? 'var(--accent-terracotta)' : 'var(--text-primary)'
                }}
                title="Favorites"
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '26px',
                    fontVariationSettings: book.favorite ? "'FILL' 1" : "'FILL' 0"
                  }}
                >
                  favorite
                </span>
              </button>

              {/* Completed Toggle Button (Trophy) */}
              <button
                onClick={handleCompletedClick}
                className="icon-btn"
                style={{
                  ...styles.iconBtn,
                  color: book.status === 'Completed' ? 'var(--status-amber)' : 'var(--text-primary)'
                }}
                title="Completed status"
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '26px',
                    fontVariationSettings: book.status === 'Completed' ? "'FILL' 1" : "'FILL' 0"
                  }}
                >
                  trophy
                </span>
              </button>

              {/* Delete Button (Trash) - not shown for an unsaved scan preview; CLOSE already discards it */}
              {!isNew && (
                <button
                  onClick={handleDeleteClick}
                  className="icon-btn"
                  style={{
                    ...styles.iconBtn,
                    color: 'var(--error)'
                  }}
                  title="Delete book"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                    delete
                  </span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={styles.content} className="book-modal-content">
          {/* Left Column - Cover */}
          <div style={styles.leftCol} className="book-modal-left-col">
            <div style={styles.coverWrapper} className="book-modal-cover">
              {book.cover_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={book.cover_url} alt={book.title} style={styles.coverImg} />
              ) : (
                <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
                  <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
                  <span style={styles.placeholderText}>{book.title}</span>
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
              {book.authors.length > 0 ? (
                <p style={styles.author}>
                  {book.authors.join(', ')}
                  {publishedYear && <span style={styles.authorYear}> · {publishedYear}</span>}
                </p>
              ) : isEditingAuthor ? (
                <div style={styles.authorEditRow}>
                  <input
                    className="field-white"
                    value={authorDraft}
                    onChange={(e) => setAuthorDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveAuthor();
                      if (e.key === 'Escape') handleCancelAuthor();
                    }}
                    placeholder="Author name"
                    aria-label="Author name"
                    autoFocus
                    style={styles.authorEditInput}
                  />
                  <button onClick={handleSaveAuthor} style={styles.authorSaveBtn}>Save</button>
                  <button onClick={handleCancelAuthor} style={styles.confirmCancelBtn}>Cancel</button>
                </div>
              ) : (
                <p style={styles.author}>
                  Unknown Author
                  {publishedYear && <span style={styles.authorYear}> · {publishedYear}</span>}
                  {isNew && (
                    <button onClick={handleAddAuthorClick} style={styles.addAuthorLink}>
                      + Add author
                    </button>
                  )}
                </p>
              )}
            </div>

            {/* Combined transitions for Location and Genre block to ensure perfect sync on save */}
            <AnimatePresence mode="wait">
              {isEditingLocation ? (
                <motion.div
                  key="edit-mode"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}
                >
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <h3 style={styles.sectionTitle}>Location</h3>
                    </div>
                    <div style={styles.editLocationForm}>
                      {/* Select Room */}
                      <select
                        aria-label="Select room"
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
                              aria-label="Select shelf"
                              value={selectedShelfId}
                              onChange={(e) => setSelectedShelfId(e.target.value)}
                              style={styles.selectFieldWidth}
                            >
                              <option value="">Unassigned</option>
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
                          + Add New Location
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
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="display-mode"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}
                >
                  {/* Location display section */}
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <h3 style={styles.sectionTitle}>Location</h3>
                      <button onClick={handleEditClick} style={styles.editLink}>Edit</button>
                    </div>
                    {book.location ? (
                      <div style={styles.locationRow}>
                        <span style={styles.locationText}>{book.location.room}</span>
                        {book.location.bookshelf && (
                          <>
                            <span style={styles.locationArrow}>→</span>
                            <span style={styles.locationText}>{book.location.bookshelf}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <p style={styles.sectionContent}>Unassigned shelf</p>
                    )}
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

            {/* Description (If available), with an inline "Show more" at the end of long text */}
            {book.description && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Description</h3>
                <p style={styles.descriptionText}>
                  {book.description.length > DESCRIPTION_EXPAND_THRESHOLD && !isDescriptionExpanded
                    ? book.description.slice(0, DESCRIPTION_EXPAND_THRESHOLD).trimEnd() + '…'
                    : book.description}
                  {book.description.length > DESCRIPTION_EXPAND_THRESHOLD && (
                    <button
                      onClick={() => setIsDescriptionExpanded(v => !v)}
                      style={styles.expandDescriptionBtn}
                    >
                      {isDescriptionExpanded ? ' Show less' : ' Show more'}
                    </button>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save footer - only for an unsaved (scanned) book, anchored bottom-right */}
        {isNew && (
          <div style={styles.saveFooter}>
            <button
              onClick={onSaveNew}
              disabled={isSaving}
              style={{ ...styles.saveNewBtn, opacity: isSaving ? 0.6 : 1 }}
            >
              {isSaving ? 'Saving...' : 'Save to Library'}
            </button>
          </div>
        )}
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
    backgroundColor: 'var(--bg-sheet)',
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
    top: '-36px', // Positioned above the card
    right: '0px', // Aligned to the right boundary
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--bg-sheet)', // Crisp white on dark backdrop
    fontSize: '0.85rem',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    transition: 'opacity 0.2s ease',
    padding: 0,
  },
  actionButtonsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginBottom: '20px',
  },
  confirmDeleteRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    marginBottom: '20px',
    height: '32px',
  },
  confirmDeleteText: {
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  confirmDeleteBtn: {
    background: 'none',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    backgroundColor: 'var(--bg-sheet)',
    color: 'var(--error)',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  confirmCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  saveFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '20px',
    flexShrink: 0,
  },
  saveNewBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '8px 18px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  iconBtn: {
    width: '40px', // Touch-friendly hit area without a visible frame
    height: '40px',
    border: 'none',
    boxShadow: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'transform 0.15s ease',
  },
  content: {
    display: 'flex',
    gap: '48px',
    flex: 1,
    minHeight: 0, // Lets rightCol's overflowY:auto work correctly inside the fixed-height modal
    overflow: 'visible', // Remove overflow hidden to prevent shadow clipping
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
    flexShrink: 0,
  },
  coverWrapper: {
    borderRadius: '0px',
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(17, 22, 37, 0.12)', // Softened drop shadow
    border: 'none',
    backgroundColor: 'var(--bg-sheet)',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholderCover: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 16px 16px 26px', // Extra left padding so text clears the spine strip
    textAlign: 'center',
    backgroundColor: 'var(--bg-sheet)',
  },
  placeholderSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '10px',
    boxShadow: 'inset -2px 0 3px rgba(17, 22, 37, 0.2)',
  },
  placeholderText: {
    color: '#FFFDFB',
    fontSize: '1rem',
    lineHeight: '1.3',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    flex: 1,
    overflowY: 'auto',
    paddingRight: '8px',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    fontSize: '26px',
    fontWeight: '600', // Semibold
    color: 'var(--accent-primary)', // Accent primary blue
    lineHeight: '1.2',
    maxWidth: '420px', // Clean maximum width
  },
  author: {
    fontSize: '18px',
    fontWeight: '500', // Medium
    color: 'var(--text-secondary)',
    marginTop: '2px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  authorYear: {
    color: 'var(--text-tertiary)',
    fontWeight: '400',
    marginLeft: '8px',
  },
  addAuthorLink: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    textDecoration: 'underline',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    padding: 0,
    marginLeft: '10px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  authorEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '4px',
  },
  authorEditInput: {
    padding: '6px 10px',
    fontSize: '0.95rem',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    color: 'var(--text-primary)',
    flex: 1,
    maxWidth: '220px',
  },
  authorSaveBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    color: 'var(--bg-sheet)',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 'bold',
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
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  editLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    textDecoration: 'underline',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  locationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  locationText: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  locationArrow: {
    fontSize: '15px',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  sectionContent: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  descriptionText: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  expandDescriptionBtn: {
    display: 'inline',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    textDecoration: 'underline',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
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
    border: '1px solid rgba(17, 22, 37, 0.12)',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: '#FFFFFF',
    color: 'var(--text-primary)',
    boxShadow: 'none',
    outline: 'none',
    width: '100%',
  },
  selectFieldWidth: {
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
    color: 'var(--text-secondary)',
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
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
