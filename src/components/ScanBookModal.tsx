'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import BookModal, { Book } from '@/components/BookModal';
import ScanQueueRow from '@/components/ScanQueueRow';
import { fetchBookByIsbn } from '@/lib/openLibrary';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';
import { useIsMobile } from '@/hooks/useIsMobile';

export interface Shelf {
  id: string;
  room: string;
  bookshelf: string;
}

export interface QueuedBook {
  id: string;
  title: string;
  authors: string[];
  isbn?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  description?: string | null;
  cover_url?: string | null;
  locationId: string;
  location: { room: string; bookshelf: string } | null;
  overridden: boolean;
  rowState: 'idle' | 'saving';
  editingLocation: boolean;
}

type ScanMode = 'single' | 'location';

type ScanState = 'idle' | 'loading' | 'error' | 'loaded';

interface ScanBookModalProps {
  onClose: () => void;
  onBookAdded: (book: Book) => void;
  books: Book[];
  showToast: (message: string) => void;
}

export default function ScanBookModal({ onClose, onBookAdded, books, showToast }: ScanBookModalProps) {
  const supabase = createClient();
  const [state, setState] = useState<ScanState>('idle');
  const [manualIsbn, setManualIsbn] = useState('');
  const [failedIsbn, setFailedIsbn] = useState('');
  const [draftBook, setDraftBook] = useState<Book | null>(null);
  const [draftLocationId, setDraftLocationId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<ScanMode>('single');
  const [locationSetupOpen, setLocationSetupOpen] = useState(false);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [setupRoom, setSetupRoom] = useState('');
  const [setupShelfId, setSetupShelfId] = useState('');
  const [defaultLocationId, setDefaultLocationId] = useState('');
  const [defaultLocationObj, setDefaultLocationObj] = useState<{ room: string; bookshelf: string } | null>(null);
  const [persistentDefaultLocationId, setPersistentDefaultLocationId] = useState('');
  const [persistentDefaultLocationObj, setPersistentDefaultLocationObj] = useState<{ room: string; bookshelf: string } | null>(null);
  const [currentRoom, setCurrentRoom] = useState('');
  const [currentShelfId, setCurrentShelfId] = useState('');
  const [editingDefault, setEditingDefault] = useState(false);
  const [queue, setQueue] = useState<QueuedBook[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Focus trap / Escape / body scroll lock for the idle/loading/error chrome.
  // The 'loaded' state renders the real BookModal, which manages all of this itself.
  useEffect(() => {
    if (state === 'loaded') return;

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
  }, [onClose, state]);

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

  useEffect(() => {
    try {
      const savedId = localStorage.getItem('defaultLocationId') || '';
      const savedObjStr = localStorage.getItem('defaultLocationObj');
      const savedObj = savedObjStr ? JSON.parse(savedObjStr) : null;
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPersistentDefaultLocationId(savedId);
      setPersistentDefaultLocationObj(savedObj);
      
      // Initialize active scanning session location
      setCurrentRoom(savedObj?.room || '');
      setCurrentShelfId(savedId);
    } catch (e) {
      console.warn('Failed to load default location settings:', e);
    }
  }, []);

  const resolveLocationSelection = useCallback(async (
    room: string,
    shelfId: string
  ): Promise<{ id: string; room: string; bookshelf: string } | null> => {
    const selectedShelf = shelves.find(s => s.id === shelfId);
    if (selectedShelf) return selectedShelf;
    if (!room) return null;

    const roomOnlyShelf = shelves.find(s => s.room === room && s.bookshelf === '');
    if (roomOnlyShelf) return roomOnlyShelf;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('shelves')
        .insert([{ room, bookshelf: '', user_id: user?.id }])
        .select();
      if (error) throw error;
      if (data && data[0]) {
        setShelves(prev => [...prev, data[0]]);
        return data[0];
      }
    } catch {
      console.warn('Failed to save room-only location');
    }
    return { id: '', room, bookshelf: '' };
  }, [shelves, supabase]);

  const handleStartMultiScan = async () => {
    const resolved = await resolveLocationSelection(currentRoom, currentShelfId);
    if (resolved) {
      setDefaultLocationId(resolved.id);
      setDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });
    } else {
      setDefaultLocationId('');
      setDefaultLocationObj(null);
    }
    setMode('location');
  };

  const handleCancelSetup = () => {
    setLocationSetupOpen(false);
    setSetupRoom('');
    setSetupShelfId('');
  };

  const handleStartEditDefault = () => {
    setSetupRoom(defaultLocationObj?.room ?? '');
    setSetupShelfId(defaultLocationId);
    setEditingDefault(true);
  };

  const handleCancelEditDefault = () => {
    setEditingDefault(false);
  };

  const handleConfirmDefaultChange = async () => {
    if (!setupRoom) return;
    const resolved = await resolveLocationSelection(setupRoom, setupShelfId);
    if (!resolved) return;
    setDefaultLocationId(resolved.id);
    setDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });
    setEditingDefault(false);
  };

  const handleSaveDefaultLocation = async () => {
    if (!setupRoom) return;
    const resolved = await resolveLocationSelection(setupRoom, setupShelfId);
    if (!resolved) return;

    setPersistentDefaultLocationId(resolved.id);
    setPersistentDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });
    
    localStorage.setItem('defaultLocationId', resolved.id);
    localStorage.setItem('defaultLocationObj', JSON.stringify({ room: resolved.room, bookshelf: resolved.bookshelf }));

    // Sync current session scan location
    setCurrentRoom(resolved.room);
    setCurrentShelfId(resolved.id);

    // Sync multi-scan queue location
    setDefaultLocationId(resolved.id);
    setDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });

    setLocationSetupOpen(false);
  };

  const persistQueuedBook = useCallback(async (row: QueuedBook) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user session');

      const { data, error } = await supabase
        .from('books')
        .insert([{
          user_id: user.id,
          title: row.title,
          authors: row.authors,
          isbn: row.isbn || null,
          publisher: row.publisher || null,
          published_date: row.published_date || null,
          description: row.description || null,
          cover_url: row.cover_url || null,
          location_id: row.locationId || null,
          status: 'To Read',
        }])
        .select();

      if (error) throw error;

      onBookAdded({
        id: data && data[0] ? data[0].id : row.id,
        title: row.title,
        authors: row.authors,
        isbn: row.isbn,
        publisher: row.publisher,
        published_date: row.published_date,
        description: row.description,
        cover_url: row.cover_url,
        location: row.location,
        status: 'To Read',
        favorite: false,
      });
    } catch {
      console.warn('Failed to save queued book to Supabase, adding locally instead');
      const mockId = Math.random().toString(36).substring(7);
      onBookAdded({
        id: mockId,
        title: row.title,
        authors: row.authors,
        isbn: row.isbn,
        publisher: row.publisher,
        published_date: row.published_date,
        description: row.description,
        cover_url: row.cover_url,
        location: row.location,
        status: 'To Read',
        favorite: false,
      });
    }
  }, [supabase, onBookAdded]);

  const handleSaveQueueRow = async (id: string) => {
    const row = queue.find(q => q.id === id);
    if (!row) return;
    setQueue(prev => prev.map(q => (q.id === id ? { ...q, rowState: 'saving' } : q)));
    await persistQueuedBook(row);
    setQueue(prev => prev.filter(q => q.id !== id));
    showToast(`Added "${row.title}" to your library`);
  };

  const handleSaveAll = async () => {
    if (queue.length === 0) return;
    const rows = queue;
    setQueue(prev => prev.map(q => ({ ...q, rowState: 'saving' })));
    await Promise.all(rows.map(row => persistQueuedBook(row)));
    setQueue([]);
    showToast(`Added ${rows.length} book${rows.length === 1 ? '' : 's'} to your library`);
  };

  const handleRemoveFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const handleStartEditQueueLocation = (id: string) => {
    setQueue(prev => prev.map(q => (q.id === id ? { ...q, editingLocation: true } : q)));
  };

  const handleCancelEditQueueLocation = (id: string) => {
    setQueue(prev => prev.map(q => (q.id === id ? { ...q, editingLocation: false } : q)));
  };

  const handleConfirmQueueLocation = async (id: string, room: string, shelfId: string) => {
    if (!room) return;
    const resolved = await resolveLocationSelection(room, shelfId);
    if (!resolved) return;
    setQueue(prev => prev.map(q => (
      q.id === id
        ? {
            ...q,
            locationId: resolved.id,
            location: { room: resolved.room, bookshelf: resolved.bookshelf },
            overridden: true,
            editingLocation: false,
          }
        : q
    )));
  };

  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room)));
  const setupShelvesInRoom = shelves.filter(s => s.room === setupRoom && s.bookshelf !== '');

  const runLookup = useCallback(async (isbn: string) => {
    setState('loading');
    try {
      const result = await fetchBookByIsbn(isbn);
      if (!result) {
        if (mode === 'location') {
          showToast(`Couldn't find that book — ISBN "${isbn}"`);
          setState('idle');
          return;
        }
        setFailedIsbn(isbn);
        setState('error');
        return;
      }

      if (mode === 'location') {
        const isDuplicate = books.some(b =>
          (b.isbn && result.isbn && b.isbn.replace(/[\s-]/g, '') === result.isbn.replace(/[\s-]/g, '')) ||
          (b.title.toLowerCase().trim() === result.title.toLowerCase().trim() &&
           b.authors.map(a => a.toLowerCase().trim()).join(',') === result.authors.map(a => a.toLowerCase().trim()).join(','))
        ) || queue.some(q =>
          (q.isbn && result.isbn && q.isbn.replace(/[\s-]/g, '') === result.isbn.replace(/[\s-]/g, '')) ||
          (q.title.toLowerCase().trim() === result.title.toLowerCase().trim() &&
           q.authors.map(a => a.toLowerCase().trim()).join(',') === result.authors.map(a => a.toLowerCase().trim()).join(','))
        );

        if (isDuplicate) {
          showToast(`"${result.title}" already exists in library`);
          setState('idle');
          return;
        }

        setQueue(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            title: result.title,
            authors: result.authors,
            isbn: result.isbn,
            publisher: result.publisher,
            published_date: result.published_date,
            description: result.description,
            cover_url: result.cover_url,
            locationId: defaultLocationId,
            location: defaultLocationObj,
            overridden: false,
            rowState: 'idle',
            editingLocation: false,
          },
        ]);
        setManualIsbn('');
        setState('idle');
        return;
      }

      const resolved = await resolveLocationSelection(currentRoom, currentShelfId);
      setDraftBook({
        id: 'draft',
        title: result.title,
        authors: result.authors,
        isbn: result.isbn,
        publisher: result.publisher,
        published_date: result.published_date,
        description: result.description,
        cover_url: result.cover_url,
        location: resolved ? { room: resolved.room, bookshelf: resolved.bookshelf } : null,
        status: 'To Read',
        favorite: false,
      });
      setDraftLocationId(resolved ? resolved.id : '');
      setState('loaded');
    } catch {
      if (mode === 'location') {
        showToast(`Couldn't find that book — ISBN "${isbn}"`);
        setState('idle');
        return;
      }
      setFailedIsbn(isbn);
      setState('error');
    }
  }, [mode, books, queue, defaultLocationId, defaultLocationObj, showToast, currentRoom, currentShelfId, resolveLocationSelection]);

  // Hardware scanner only listens while waiting for a scan — not mid-lookup or once loaded
  useHardwareScanner(state === 'idle' && !locationSetupOpen && !editingDefault, (code) => {
    runLookup(code);
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualIsbn.trim().replace(/[\s-]/g, '');
    if (!trimmed) return;
    runLookup(trimmed);
  };

  const handleRetry = () => {
    setManualIsbn('');
    setState('idle');
  };

  const handleDraftFavoriteToggle = (_id: string, favorite: boolean) => {
    setDraftBook(prev => (prev ? { ...prev, favorite } : prev));
  };

  const handleDraftStatusChange = (_id: string, status: 'Completed' | 'Reading' | 'To Read') => {
    setDraftBook(prev => (prev ? { ...prev, status } : prev));
  };

  const handleDraftLocationChange = (
    _id: string,
    locationId: string,
    locationObj: { room: string; bookshelf: string } | null
  ) => {
    setDraftLocationId(locationId);
    setDraftBook(prev => (prev ? { ...prev, location: locationObj } : prev));
  };

  const handleDraftAuthorChange = (_id: string, authors: string[]) => {
    setDraftBook(prev => (prev ? { ...prev, authors } : prev));
  };

  const handleDraftTitleAuthorChange = (_id: string, title: string, authors: string[]) => {
    setDraftBook(prev => (prev ? { ...prev, title, authors } : prev));
  };

  const handleSaveNew = async () => {
    if (!draftBook) return;

    // Check duplicate
    const isDuplicate = books.some(b => 
      (b.isbn && draftBook.isbn && b.isbn.replace(/[\s-]/g, '') === draftBook.isbn.replace(/[\s-]/g, '')) ||
      (b.title.toLowerCase().trim() === draftBook.title.toLowerCase().trim() &&
       b.authors.map(a => a.toLowerCase().trim()).join(',') === draftBook.authors.map(a => a.toLowerCase().trim()).join(','))
    );

    if (isDuplicate) {
      showToast(`"${draftBook.title}" already exists in library`);
      onClose();
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user session');

      const { data, error } = await supabase
        .from('books')
        .insert([{
          user_id: user.id,
          title: draftBook.title,
          authors: draftBook.authors,
          isbn: draftBook.isbn || null,
          publisher: draftBook.publisher || null,
          published_date: draftBook.published_date || null,
          description: draftBook.description || null,
          cover_url: draftBook.cover_url || null,
          location_id: draftLocationId || null,
          status: draftBook.status || 'To Read',
        }])
        .select();

      if (error) throw error;

      onBookAdded({
        ...draftBook,
        id: data && data[0] ? data[0].id : draftBook.id,
      });
      onClose();
    } catch {
      // No authenticated Supabase session (or the insert failed) — fall back to a local-only
      // id so the book still lands in the grid, matching AddLocationModal's offline fallback.
      console.warn('Failed to save scanned book to Supabase, adding locally instead');
      const mockId = Math.random().toString(36).substring(7);
      onBookAdded({ ...draftBook, id: mockId });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === 'location') {
    return (
      <div style={styles.backdrop} onClick={onClose}>
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Scan by location"
          tabIndex={-1}
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
          transition={{ duration: 0.3 }}
          style={{ ...styles.queueModal, outline: 'none' }}
          className="scan-queue-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
            CLOSE
          </button>

          <button
            onClick={() => { setMode('single'); setLocationSetupOpen(true); }}
            style={styles.backBtn}
            aria-label="Go back to location setup"
          >
            <span className="material-symbols-outlined" style={styles.backIcon}>chevron_left</span>
            <span style={styles.backText}>Back</span>
          </button>

          <div style={styles.actionRowSpacer} />

          <div style={styles.queueHeader}>
            <p style={styles.scanningLabel}>Scanning into:</p>
            <AnimatePresence mode="wait">
              {editingDefault ? (
                <motion.div
                  key="edit-default"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.15 }}
                  style={styles.defaultLocationRowEdit}
                >
                  <div style={styles.defaultLocationLeft}>
                    <span
                      className={`material-symbols-outlined${state === 'loading' ? ' spin-icon' : ''}`}
                      style={styles.bigScannerIcon}
                    >
                      {state === 'loading' ? 'progress_activity' : 'qr_code_scanner'}
                    </span>
                    <div style={styles.horizontalSelects}>
                      <select
                        aria-label="Select room"
                        value={setupRoom}
                        onChange={(e) => { setSetupRoom(e.target.value); setSetupShelfId(''); }}
                        style={styles.selectFieldHorizontal}
                        className="book-modal-select"
                      >
                        <option value="">-- Select Room --</option>
                        {uniqueRooms.map((r, i) => (
                          <option key={i} value={r}>{r}</option>
                        ))}
                      </select>
                      {setupRoom && (
                        <select
                          aria-label="Select shelf"
                          value={setupShelfId}
                          onChange={(e) => setSetupShelfId(e.target.value)}
                          style={styles.selectFieldHorizontal}
                          className="book-modal-select"
                        >
                          <option value="">Unassigned</option>
                          {shelves.filter(s => s.room === setupRoom && s.bookshelf !== '').map((s) => (
                            <option key={s.id} value={s.id}>{s.bookshelf}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <div style={styles.setupActionsHorizontal}>
                    <button
                      type="button"
                      onClick={handleConfirmDefaultChange}
                      disabled={!setupRoom}
                      className="icon-btn"
                      style={{ ...styles.iconBtnAction, opacity: setupRoom ? 1 : 0.5, color: 'var(--accent-primary)' }}
                      title="Save default location"
                      aria-label="Save default location"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                        check
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditDefault}
                      className="icon-btn"
                      style={{ ...styles.iconBtnAction, color: 'var(--text-secondary)' }}
                      title="Cancel"
                      aria-label="Cancel"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                        close
                      </span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="display-default"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.15 }}
                  style={styles.defaultLocationRow}
                >
                  <div style={styles.defaultLocationLeft}>
                    <span
                      className={`material-symbols-outlined${state === 'loading' ? ' spin-icon' : ''}`}
                      style={styles.bigScannerIcon}
                    >
                      {state === 'loading' ? 'progress_activity' : 'qr_code_scanner'}
                    </span>
                    <span style={styles.bigLocationText}>
                      {defaultLocationObj?.room}
                      {defaultLocationObj?.bookshelf ? ` • ${defaultLocationObj.bookshelf}` : ''}
                    </span>
                  </div>
                  <button type="button" onClick={handleStartEditDefault} style={styles.editLink}>
                    Change
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div style={styles.queueList}>
            {queue.length === 0 ? (
              <p style={styles.emptyQueueText}>No books scanned yet</p>
            ) : (
              queue.map((book) => (
                <ScanQueueRow
                  key={book.id}
                  book={book}
                  shelves={shelves}
                  onSave={handleSaveQueueRow}
                  onRemove={handleRemoveFromQueue}
                  onStartEditLocation={handleStartEditQueueLocation}
                  onCancelEditLocation={handleCancelEditQueueLocation}
                  onConfirmLocation={handleConfirmQueueLocation}
                />
              ))
            )}
          </div>

          <div style={styles.saveAllRow}>
            <form onSubmit={handleManualSubmit} style={styles.bottomManualForm}>
              <input
                type="text"
                inputMode="numeric"
                className="field-white"
                placeholder="OR enter ISBN number"
                value={manualIsbn}
                onChange={(e) => setManualIsbn(e.target.value)}
                aria-label="Manually enter ISBN"
                style={styles.bottomManualInput}
              />
            </form>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={queue.length === 0}
              style={{ ...styles.saveAllBtn, opacity: queue.length === 0 ? 0.5 : 1 }}
            >
              Save All
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (state === 'loaded' && draftBook) {
    return (
      <BookModal
        book={draftBook}
        onClose={onClose}
        isNew
        isSaving={isSaving}
        onSaveNew={handleSaveNew}
        onFavoriteToggle={handleDraftFavoriteToggle}
        onStatusChange={handleDraftStatusChange}
        onLocationChange={handleDraftLocationChange}
        onAuthorChange={handleDraftAuthorChange}
        onTitleAuthorChange={handleDraftTitleAuthorChange}
      />
    );
  }

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Scan a book"
        tabIndex={-1}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        style={{ ...styles.modal, outline: 'none' }}
        className="book-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
          CLOSE
        </button>

        {locationSetupOpen && (
          <button onClick={handleCancelSetup} style={styles.backBtn} aria-label="Go back">
            <span className="material-symbols-outlined" style={styles.backIcon}>chevron_left</span>
            <span style={styles.backText}>Back</span>
          </button>
        )}

        {/* Reserves the same vertical space BookModal's action-icon row occupies, so the
            cover/content below lines up exactly once this swaps into the real BookModal. */}
        <div style={styles.actionRowSpacer} />

        <AnimatePresence mode="wait">
          {state === 'loading' ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.2 }}
              style={styles.skeletonContent}
            >
              <div className="skeleton-shimmer" style={styles.skeletonCover} />
              <div style={styles.skeletonTextCol}>
                <div className="skeleton-shimmer" style={styles.skeletonTitleBar} />
                <div className="skeleton-shimmer" style={styles.skeletonAuthorBar} />
                <div className="skeleton-shimmer" style={styles.skeletonLineBar} />
                <div className="skeleton-shimmer" style={{ ...styles.skeletonLineBar, width: '60%' }} />
              </div>
            </motion.div>
          ) : state === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.2 }}
              style={styles.promptWrapper}
            >
              <div style={styles.promptContent}>
                <span className="material-symbols-outlined" style={styles.promptIcon}>
                  search_off
                </span>
                <h2 style={styles.promptTitle}>Couldn&apos;t find that book</h2>
                <p style={styles.promptText}>
                  No match for ISBN &quot;{failedIsbn}&quot; — try scanning again.
                </p>
                <button onClick={handleRetry} style={styles.retryBtn}>
                  Try Again
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.2 }}
              style={styles.promptWrapper}
            >
              <div style={styles.promptContent}>
                {locationSetupOpen ? (
                  <>
                    <span className="material-symbols-outlined" style={styles.promptIcon}>
                      newsstand
                    </span>
                    <h2 style={styles.promptTitle}>Choose a default location</h2>
                    <p style={styles.promptText}>
                      Every book you scan will be assigned here until you change it.
                    </p>
                    <div style={styles.setupForm}>
                      <select
                        aria-label="Select room"
                        value={setupRoom}
                        onChange={(e) => { setSetupRoom(e.target.value); setSetupShelfId(''); }}
                        style={styles.selectField}
                        className="book-modal-select"
                      >
                        <option value="">-- Select Room --</option>
                        {uniqueRooms.map((r, i) => (
                          <option key={i} value={r}>{r}</option>
                        ))}
                      </select>
                      {setupRoom && (
                        <select
                          aria-label="Select shelf"
                          value={setupShelfId}
                          onChange={(e) => setSetupShelfId(e.target.value)}
                          style={styles.selectField}
                          className="book-modal-select"
                        >
                          <option value="">Unassigned</option>
                          {setupShelvesInRoom.map((s) => (
                            <option key={s.id} value={s.id}>{s.bookshelf}</option>
                          ))}
                        </select>
                      )}
                      {isMobile && setupRoom && mode === 'single' && (
                        <button
                          type="button"
                          onClick={handleSaveDefaultLocation}
                          style={{
                            ...styles.formSaveBtn,
                            position: 'static',
                            marginTop: '16px',
                            width: '100%',
                            textAlign: 'center',
                          }}
                        >
                          Save Default Location
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={styles.promptIcon}>
                      qr_code_scanner
                    </span>
                    <h2 style={styles.promptTitle}>Scan the book</h2>
                    <p style={styles.promptText}>
                      Scan the barcode to add it to your library.
                    </p>

                    {/* Session location selectors */}
                    <div style={styles.setupForm}>
                      <select
                        aria-label="Select Room"
                        value={currentRoom}
                        onChange={(e) => {
                          const room = e.target.value;
                          setCurrentRoom(room);
                          if (room === persistentDefaultLocationObj?.room) {
                            setCurrentShelfId(persistentDefaultLocationId);
                          } else {
                            setCurrentShelfId('');
                          }
                        }}
                        style={styles.selectField}
                        className="book-modal-select"
                      >
                        <option value="">-- Select Room (Unassigned) --</option>
                        {uniqueRooms.map((r, i) => (
                          <option key={i} value={r}>{r}</option>
                        ))}
                      </select>
                      
                      {currentRoom && (
                        <select
                          aria-label="Select Shelf"
                          value={currentShelfId}
                          onChange={(e) => setCurrentShelfId(e.target.value)}
                          style={styles.selectField}
                          className="book-modal-select"
                        >
                          <option value="">Unassigned</option>
                          {shelves.filter(s => s.room === currentRoom && s.bookshelf !== '').map((s) => (
                            <option key={s.id} value={s.id}>{s.bookshelf}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSetupRoom(persistentDefaultLocationObj?.room || '');
                        setSetupShelfId(persistentDefaultLocationId);
                        setLocationSetupOpen(true);
                      }}
                      style={styles.defaultLocationLink}
                    >
                      Default Scan Location →
                    </button>

                    <button
                      type="button"
                      onClick={handleStartMultiScan}
                      style={styles.scanByLocationLink}
                    >
                      Scan Multiple Books
                    </button>
                    <form onSubmit={handleManualSubmit} style={styles.manualForm}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="field-white"
                        placeholder="Or type an ISBN"
                        value={manualIsbn}
                        onChange={(e) => setManualIsbn(e.target.value)}
                        aria-label="Manually enter ISBN"
                        style={styles.manualInput}
                      />
                    </form>
                    {manualIsbn && <span style={styles.enterHint}>press ⏎ to search</span>}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isMobile && locationSetupOpen && setupRoom && mode === 'single' && (
          <button
            type="button"
            onClick={handleSaveDefaultLocation}
            style={styles.formSaveBtn}
          >
            Save Default Location
          </button>
        )}
      </motion.div>
    </div>
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
    maxWidth: '680px', // Same footprint as BookModal, so the swap-in doesn't jump size
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
  backBtn: {
    position: 'absolute',
    top: '24px',
    left: '32px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
    transition: 'opacity 0.2s ease',
    zIndex: 10,
  },
  backIcon: {
    fontSize: '26px',
    fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
  },
  backText: {
    fontSize: '1.05rem',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    color: 'var(--text-secondary)',
    marginLeft: '2px',
    fontWeight: '500',
  },
  actionRowSpacer: {
    height: '40px', // Matches BookModal's iconBtn height
    marginBottom: '20px', // Matches BookModal's actionButtonsRow marginBottom
    flexShrink: 0,
  },
  promptWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  promptContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '8px',
  },
  promptIcon: {
    fontSize: '40px',
    color: 'var(--accent-primary)',
    marginBottom: '8px',
    fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
  },
  promptTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    margin: 0,
  },
  promptText: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    marginBottom: '12px',
  },
  manualForm: {
    width: '100%',
    maxWidth: '260px',
    marginTop: '70px',
  },
  manualInput: {
    padding: '8px 12px',
    fontSize: '0.9rem',
    borderRadius: '0px',
    width: '100%',
    textAlign: 'center',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    color: 'var(--text-primary)',
  },
  enterHint: {
    fontSize: '0.8rem',
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    marginTop: '4px',
  },
  scanByLocationLink: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline wavy var(--accent-primary)',
    textUnderlineOffset: '4px',
    marginTop: '4px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  setupForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
    maxWidth: '260px',
    marginTop: '20px',
  },
  setupActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '4px',
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
  formCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  formSaveBtn: {
    position: 'absolute',
    bottom: '24px',
    right: '36px',
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
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
    flexShrink: 0,
  },
  queueModal: {
    width: '100%',
    maxWidth: '680px',
    maxHeight: 'min(720px, 85svh)',
    backgroundColor: 'var(--bg-sheet)',
    padding: '40px 36px 36px 36px',
    position: 'relative',
    borderRadius: '0px',
    border: 'none',
    boxShadow: '0 12px 35px rgba(17, 22, 37, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  scanningLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  queueHeader: {
    flexShrink: 0,
    marginBottom: '20px',
  },
  defaultLocationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: '12px',
  },
  defaultLocationRowEdit: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: '12px',
    flexWrap: 'wrap',
  },
  defaultLocationLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flex: 1,
    minWidth: 0,
  },
  bigScannerIcon: {
    fontSize: '44px',
    color: 'var(--accent-primary)',
    flexShrink: 0,
  },
  bigLocationText: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  horizontalSelects: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  selectFieldHorizontal: {
    padding: '6px 10px',
    border: '1px solid rgba(17, 22, 37, 0.12)',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: '#FFFFFF',
    color: 'var(--text-primary)',
    boxShadow: 'none',
    outline: 'none',
    fontSize: '0.9rem',
    flex: 1,
    minWidth: '120px',
  },
  setupActionsHorizontal: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconBtnAction: {
    background: 'none',
    border: 'none',
    padding: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  queueList: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingRight: '4px',
    borderTop: '1px solid rgba(17, 22, 37, 0.08)',
    paddingTop: '12px',
  },
  emptyQueueText: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  saveAllRow: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    borderTop: '1px solid rgba(17, 22, 37, 0.08)',
    paddingTop: '16px',
  },
  bottomManualForm: {
    flex: 1,
    maxWidth: '180px',
  },
  bottomManualInput: {
    padding: '8px 12px',
    border: '1px solid rgba(17, 22, 37, 0.12)',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: '#FFFFFF',
    color: 'var(--text-primary)',
    boxShadow: 'none',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontSize: '0.9rem',
  },
  saveAllBtn: {
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
  retryBtn: {
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
  defaultLocationLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    marginTop: '6px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  skeletonContent: {
    display: 'flex',
    gap: '48px', // Matches BookModal's content gap
    alignItems: 'flex-start',
    width: '100%',
  },
  skeletonCover: {
    width: '150px', // Matches BookModal's cover dimensions
    height: '210px',
    flexShrink: 0,
  },
  skeletonTextCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
    paddingTop: '8px',
  },
  skeletonTitleBar: {
    height: '22px',
    width: '80%',
  },
  skeletonAuthorBar: {
    height: '16px',
    width: '55%',
  },
  skeletonLineBar: {
    height: '12px',
    width: '90%',
  },
};
