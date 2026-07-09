'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import AddLocationModal from '@/components/AddLocationModal';

interface Shelf {
  id: string;
  room: string;
  bookshelf: string;
}

interface ManageLocationsModalProps {
  onClose: () => void;
}

export default function ManageLocationsModal({ onClose }: ManageLocationsModalProps) {
  const supabase = createClient();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [roomDrafts, setRoomDrafts] = useState<Record<string, string>>({});
  const [shelfDrafts, setShelfDrafts] = useState<Record<string, string>>({});
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingDeleteRoom, setConfirmingDeleteRoom] = useState<string | null>(null);
  const [newShelves, setNewShelves] = useState<{ tempId: string; room: string; bookshelf: string }[]>([]);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [collapsedRooms, setCollapsedRooms] = useState<Record<string, boolean>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  const toggleRoomCollapsed = (room: string) => {
    setCollapsedRooms(prev => ({ ...prev, [room]: !prev[room] }));
  };

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

  const loadShelves = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('shelves').select('id, room, bookshelf').order('room');
      setShelves(data || []);
    } catch {
      console.warn('Failed to load shelves list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShelves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rooms = Array.from(new Set(shelves.map(s => s.room)));

  // Single Edit toggle: entering edit mode seeds draft values; toggling back to Done saves every change at once
  const handleToggleEditMode = async () => {
    if (!isEditMode) {
      const nextRoomDrafts: Record<string, string> = {};
      rooms.forEach(r => { nextRoomDrafts[r] = r; });
      const nextShelfDrafts: Record<string, string> = {};
      shelves.forEach(s => { nextShelfDrafts[s.id] = s.bookshelf; });
      setRoomDrafts(nextRoomDrafts);
      setShelfDrafts(nextShelfDrafts);
      setNewShelves([]);
      setConfirmingDeleteId(null);
      setConfirmingDeleteRoom(null);
      setIsEditMode(true);
      return;
    }

    // Saving: apply room renames first (bulk per room), then individual shelf renames, then new shelves
    const updatedShelves = shelves.map(s => ({
      ...s,
      room: (roomDrafts[s.room] ?? s.room).trim() || s.room,
      bookshelf: (shelfDrafts[s.id] ?? s.bookshelf).trim(),
    }));
    setShelves(updatedShelves);
    setIsEditMode(false);

    try {
      const roomRenames = rooms.filter(r => roomDrafts[r] && roomDrafts[r].trim() && roomDrafts[r].trim() !== r);
      await Promise.all(
        roomRenames.map(oldRoom =>
          supabase.from('shelves').update({ room: roomDrafts[oldRoom].trim() }).eq('room', oldRoom)
        )
      );

      const shelfRenames = shelves.filter(s => {
        const draft = shelfDrafts[s.id];
        return draft !== undefined && draft.trim() !== s.bookshelf;
      });
      await Promise.all(
        shelfRenames.map(s => supabase.from('shelves').update({ bookshelf: shelfDrafts[s.id].trim() }).eq('id', s.id))
      );

      const pendingInserts = newShelves.filter(n => n.bookshelf.trim());
      if (pendingInserts.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const rows = pendingInserts.map(n => ({
          room: (roomDrafts[n.room] ?? n.room).trim() || n.room,
          bookshelf: n.bookshelf.trim(),
          user_id: user?.id,
        }));
        const { data } = await supabase.from('shelves').insert(rows).select();
        if (data) {
          setShelves(prev => [...prev, ...data]);
        }
      }
      setNewShelves([]);
    } catch {
      console.warn('Failed to save location changes');
    }
  };

  const handleDeleteClick = (id: string) => {
    setConfirmingDeleteId(id);
  };

  const handleCancelDelete = () => {
    setConfirmingDeleteId(null);
  };

  const handleConfirmDelete = async (id: string) => {
    setConfirmingDeleteId(null);
    setShelves(prev => prev.filter(s => s.id !== id));
    try {
      await supabase.from('shelves').delete().eq('id', id);
    } catch {
      console.warn('Failed to delete location');
    }
  };

  const handleDeleteRoomClick = (room: string) => {
    setConfirmingDeleteRoom(room);
  };

  const handleCancelDeleteRoom = () => {
    setConfirmingDeleteRoom(null);
  };

  const handleConfirmDeleteRoom = async (room: string) => {
    setConfirmingDeleteRoom(null);
    setShelves(prev => prev.filter(s => s.room !== room));
    try {
      await supabase.from('shelves').delete().eq('room', room);
    } catch {
      console.warn('Failed to delete room');
    }
  };

  // Pending "add shelf" rows, scoped to a room, only persisted once Done is pressed
  const handleAddShelfDraft = (room: string) => {
    setNewShelves(prev => [...prev, { tempId: `new-${Date.now()}-${Math.random()}`, room, bookshelf: '' }]);
    setCollapsedRooms(prev => ({ ...prev, [room]: false }));
  };

  const handleNewShelfChange = (tempId: string, value: string) => {
    setNewShelves(prev => prev.map(n => (n.tempId === tempId ? { ...n, bookshelf: value } : n)));
  };

  const handleRemoveNewShelfDraft = (tempId: string) => {
    setNewShelves(prev => prev.filter(n => n.tempId !== tempId));
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
        aria-label="Manage Locations"
        tabIndex={-1}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        style={{ ...styles.modal, outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - Positioned above the card on the top right, matching BookModal */}
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          CLOSE
        </button>

        {/* Single Edit/Done toggle - sits where Close used to be, makes every field editable at once */}
        <button
          onClick={handleToggleEditMode}
          className="icon-btn"
          style={styles.editToggleBtn}
          title={isEditMode ? 'Done' : 'Edit'}
          aria-label={isEditMode ? 'Done editing' : 'Edit locations'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
            {isEditMode ? 'check' : 'edit'}
          </span>
        </button>

        <h2 style={styles.title}>Manage Locations</h2>
        <p style={styles.subtitle}>All the rooms and shelves you&apos;ve catalogued.</p>

        <div style={styles.list}>
          {loading ? (
            <p style={styles.emptyText}>Loading...</p>
          ) : rooms.length === 0 ? (
            <p style={styles.emptyText}>No locations yet. Add one below.</p>
          ) : (
            rooms.map(room => {
              const roomShelves = shelves.filter(s => s.room === room && s.bookshelf !== '');
              const roomNewShelves = newShelves.filter(n => n.room === room);
              const roomShelvesCount = roomShelves.length;
              const isCollapsed = !!collapsedRooms[room];
              const hasShelves = roomShelves.length > 0 || (isEditMode && roomNewShelves.length > 0);

              return (
                <div key={room} style={styles.roomGroup}>
                  <div style={styles.roomHeaderRow}>
                    <AnimatePresence mode="wait">
                      {confirmingDeleteRoom === room ? (
                        <motion.div
                          key="confirm-room"
                          initial={{ opacity: 0, filter: 'blur(4px)' }}
                          animate={{ opacity: 1, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, filter: 'blur(4px)' }}
                          transition={{ duration: 0.15 }}
                          style={styles.confirmRow}
                        >
                          <span style={styles.confirmText}>
                            Delete this room and all its shelves?
                          </span>
                          <button
                            onClick={() => handleConfirmDeleteRoom(room)}
                            style={styles.confirmDeleteBtn}
                          >
                            Delete
                          </button>
                          <button onClick={handleCancelDeleteRoom} style={styles.confirmCancelBtn}>
                            Cancel
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="display-room"
                          initial={{ opacity: 0, filter: 'blur(4px)' }}
                          animate={{ opacity: 1, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, filter: 'blur(4px)' }}
                          transition={{ duration: 0.15 }}
                          style={{
                            ...styles.displayRow,
                            cursor: isEditMode ? 'default' : 'pointer',
                          }}
                          onClick={isEditMode ? undefined : () => toggleRoomCollapsed(room)}
                        >
                          <div style={styles.roomTitleContainer}>
                            <span 
                              className="material-symbols-outlined" 
                              style={{ 
                                fontSize: '20px', 
                                color: 'var(--text-secondary)',
                                transition: 'transform 0.2s ease', 
                                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                marginRight: '4px',
                                opacity: isEditMode ? 0.3 : 0.8,
                                userSelect: 'none'
                              }}
                            >
                              expand_more
                            </span>
                            <span 
                              className="material-symbols-outlined" 
                              style={{ 
                                fontSize: '20px', 
                                color: 'var(--text-secondary)',
                                opacity: 0.5,
                                marginRight: '8px',
                                userSelect: 'none'
                              }}
                            >
                              folder
                            </span>
                            {isEditMode ? (
                              <input
                                className="field-white"
                                value={roomDrafts[room] ?? room}
                                onChange={(e) =>
                                  setRoomDrafts(prev => ({ ...prev, [room]: e.target.value }))
                                }
                                onClick={(e) => e.stopPropagation()} // Prevent collapse click
                                aria-label="Room name"
                                style={styles.editInput}
                              />
                            ) : (
                              <h3 style={styles.roomTitle}>{room}</h3>
                            )}
                            {!isEditMode && (
                              <span style={styles.roomMetadata}>({roomShelvesCount})</span>
                            )}
                          </div>
                          <div style={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                            {isEditMode && (
                              <button
                                onClick={() => handleAddShelfDraft(room)}
                                className="icon-btn"
                                style={styles.iconBtn}
                                title="Add shelf to this room"
                                aria-label="Add shelf to this room"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                  add
                                </span>
                              </button>
                            )}
                            {isEditMode && (
                              <button
                                onClick={() => handleDeleteRoomClick(room)}
                                className="icon-btn"
                                style={{ ...styles.iconBtn, color: 'var(--error)' }}
                                title="Delete room"
                                aria-label="Delete room"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                  delete
                                </span>
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence initial={false}>
                    {!isCollapsed && hasShelves && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                        animate={{ height: 'auto', opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } }}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
                        style={styles.shelvesContainer}
                      >
                        <div style={styles.shelvesList}>
                          {roomShelves.map(shelf => (
                            <div key={shelf.id} style={styles.shelfRow}>
                              <AnimatePresence mode="wait">
                                {confirmingDeleteId === shelf.id ? (
                                  <motion.div
                                    key="confirm"
                                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                                    transition={{ duration: 0.15 }}
                                    style={styles.confirmRow}
                                  >
                                    <span style={styles.confirmText}>Delete this location?</span>
                                    <button
                                      onClick={() => handleConfirmDelete(shelf.id)}
                                      style={styles.confirmDeleteBtn}
                                    >
                                      Delete
                                    </button>
                                    <button onClick={handleCancelDelete} style={styles.confirmCancelBtn}>
                                      Cancel
                                    </button>
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="display"
                                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                                    transition={{ duration: 0.15 }}
                                    style={styles.displayRow}
                                  >
                                    {isEditMode ? (
                                      <input
                                        className="field-white"
                                        value={shelfDrafts[shelf.id] ?? shelf.bookshelf}
                                        onChange={(e) =>
                                          setShelfDrafts(prev => ({ ...prev, [shelf.id]: e.target.value }))
                                        }
                                        placeholder="Shelf (optional)"
                                        aria-label="Shelf name"
                                        style={styles.editInput}
                                      />
                                    ) : (
                                      <span style={styles.shelfName}>{shelf.bookshelf}</span>
                                    )}
                                    {isEditMode && (
                                      <button
                                        onClick={() => handleDeleteClick(shelf.id)}
                                        className="icon-btn"
                                        style={{ ...styles.iconBtn, color: 'var(--error)' }}
                                        title="Delete location"
                                        aria-label="Delete location"
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                          delete
                                        </span>
                                      </button>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                          {isEditMode &&
                            roomNewShelves.map(n => (
                              <div key={n.tempId} style={styles.shelfRow}>
                                <div style={styles.displayRow}>
                                  <input
                                    className="field-white"
                                    value={n.bookshelf}
                                    onChange={(e) => handleNewShelfChange(n.tempId, e.target.value)}
                                    placeholder="New shelf name"
                                    aria-label="New shelf name"
                                    autoFocus
                                    style={styles.editInput}
                                  />
                                  <button
                                    onClick={() => handleRemoveNewShelfDraft(n.tempId)}
                                    className="icon-btn"
                                    style={{ ...styles.iconBtn, color: 'var(--error)' }}
                                    title="Remove"
                                    aria-label="Remove new shelf"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                      close
                                    </span>
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        <button onClick={() => setIsAddLocationOpen(true)} style={styles.addNewBtn}>
          + Add New Location
        </button>
      </motion.div>

      <AnimatePresence>
        {isAddLocationOpen && (
          <AddLocationModal
            onClose={() => setIsAddLocationOpen(false)}
            onLocationAdded={() => {
              loadShelves();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
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
    maxWidth: '460px',
    backgroundColor: 'var(--bg-sheet)',
    padding: '28px 24px 24px 24px',
    position: 'relative',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '0px',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.12)',
  },
  closeBtn: {
    position: 'absolute',
    top: '-36px', // Positioned above the card, matching BookModal
    right: '0px',
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
  editToggleBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '32px',
    height: '32px',
    background: 'none',
    border: 'none',
    boxShadow: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-primary)',
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
    marginBottom: '40px', // Larger than the gap between rooms, so the first room reads as a new section
    lineHeight: '1.4',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px', // Largest gap: between separate rooms
    overflowY: 'auto',
    marginBottom: '36px',
    paddingRight: '4px',
  },
  emptyText: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  roomGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px', // Reduced gap: room header to its shelves container
  },
  roomHeaderRow: {
    minHeight: '32px',
    display: 'flex',
    alignItems: 'center',
  },
  roomTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  },
  roomTitle: {
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  roomMetadata: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginLeft: '6px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  shelvesContainer: {
    backgroundColor: 'rgba(244, 242, 228, 0.35)', // subtle warm tonal difference
    borderRadius: '4px',
    padding: '8px 12px',
    marginLeft: '12px',
  },
  shelvesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px', // slightly reduced spacing between shelves
    borderLeft: '1.5px solid rgba(139, 90, 43, 0.12)', // subtle guideline
  },
  shelfRow: {
    minHeight: '34px', // slightly reduced height for cohesiveness
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '14px', // indented next to the guideline
  },
  displayRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: '12px',
  },
  rowActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  shelfName: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  iconBtn: {
    width: '32px',
    height: '32px',
    border: 'none',
    boxShadow: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    color: 'var(--text-primary)',
    transition: 'transform 0.15s ease',
    flexShrink: 0,
  },
  editInput: {
    padding: '6px 10px',
    fontSize: '0.85rem',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    color: 'var(--text-primary)',
    flex: 1,
    minWidth: '100px',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    width: '100%',
  },
  confirmText: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    marginRight: 'auto',
  },
  confirmDeleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--error)',
    fontWeight: 'bold',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  confirmCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  addNewBtn: {
    alignSelf: 'flex-end',
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: 0,
    textAlign: 'right',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
