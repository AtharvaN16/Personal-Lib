'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BookModal, { Book } from '@/components/BookModal';
import ScanQueueRow from '@/components/ScanQueueRow';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { getPrefs, setDefaultLocation } from '@/lib/userPrefs';
import { useScanQueue, QueuedBook as HookQueuedBook } from '@/lib/hooks/useScanQueue';
import { useLocations } from '@/lib/hooks/useLocations';

export type QueuedBook = HookQueuedBook;

type ScanMode = 'single' | 'location';

type ScanState = 'idle' | 'loading' | 'error' | 'loaded';

interface BookLookupResult {
  title: string;
  authors: string[];
  isbn: string;
  publisher: string | null;
  published_date: string | null;
  description: string | null;
  cover_url: string | null;
}

class BookLookupLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookLookupLimitError';
  }
}

async function fetchBookByIsbn(isbn: string): Promise<BookLookupResult | null> {
  const res = await fetch(`/api/book-lookup?isbn=${encodeURIComponent(isbn)}`);

  if (res.status === 404) return null;

  if (res.status === 429) {
    const data = await res.json().catch(() => null) as { error?: string } | null;
    throw new BookLookupLimitError(data?.error || 'Daily scan lookup limit reached.');
  }

  if (!res.ok) {
    throw new Error('Book lookup failed');
  }

  const data = await res.json() as { book?: BookLookupResult | null };
  return data.book || null;
}

interface ScanBookModalProps {
  onClose: () => void;
  onBookAdded: (book: Omit<Book, 'id'>, locationId?: string) => Promise<void> | void;
  books: Book[];
  showToast: (message: string) => void;
  isGuest?: boolean;
}

export default function ScanBookModal({ onClose, onBookAdded, books, showToast, isGuest = false }: ScanBookModalProps) {
  const { shelves, addLocation } = useLocations(isGuest);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [state, setState] = useState<ScanState>('idle');
  const [mode, setMode] = useState<ScanMode>('single');
  const [queue, setQueue] = useState<QueuedBook[]>([]);
  const [draftBook, setDraftBook] = useState<Book | null>(null);
  const [draftLocationId, setDraftLocationId] = useState<string>('');

  const [manualIsbn, setManualIsbn] = useState('');
  const [failedIsbn, setFailedIsbn] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [locationSetupOpen, setLocationSetupOpen] = useState(false);
  const [setupRoom, setSetupRoom] = useState('');
  const [setupShelfId, setSetupShelfId] = useState('');
  const [defaultLocationId, setDefaultLocationId] = useState('');
  const [defaultLocationObj, setDefaultLocationObj] = useState<{ room: string; bookshelf: string } | null>(null);
  const [persistentDefaultLocationId, setPersistentDefaultLocationId] = useState('');
  const [persistentDefaultLocationObj, setPersistentDefaultLocationObj] = useState<{ room: string; bookshelf: string } | null>(null);
  const [currentRoom, setCurrentRoom] = useState('');
  const [currentShelfId, setCurrentShelfId] = useState('');
  const [editingDefault, setEditingDefault] = useState(false);
  const [defaultLocationAttention, setDefaultLocationAttention] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Mode
    const savedMode = localStorage.getItem('scan_modal_mode');
    if (savedMode === 'single' || savedMode === 'location') {
      setMode(savedMode);
    }

    // 2. Queue
    const savedQueue = localStorage.getItem('multi_scan_queue');
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map(item => ({
            ...item,
            rowState: 'idle' as const,
            editingLocation: false,
          }));
          setQueue(sanitized);
        }
      } catch (e) {
        console.error('Failed to parse saved multi_scan_queue', e);
      }
    }

    // 3. Draft & state
    const savedDraft = localStorage.getItem('single_scan_draft');
    const savedDraftLocation = localStorage.getItem('single_scan_draft_location') || '';
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setDraftBook(parsed as Book);
          setDraftLocationId(savedDraftLocation);
          setState('loaded');
        }
      } catch (e) {
        console.error('Failed to parse saved single_scan_draft', e);
      }
    }

    setIsStateLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isStateLoaded) return;
    localStorage.setItem('scan_modal_mode', mode);
  }, [mode, isStateLoaded]);

  useEffect(() => {
    if (!isStateLoaded) return;
    if (queue.length > 0) {
      localStorage.setItem('multi_scan_queue', JSON.stringify(queue));
    } else {
      localStorage.removeItem('multi_scan_queue');
    }
  }, [queue, isStateLoaded]);

  useEffect(() => {
    if (!isStateLoaded) return;
    if (draftBook) {
      localStorage.setItem('single_scan_draft', JSON.stringify(draftBook));
      localStorage.setItem('single_scan_draft_location', draftLocationId);
    } else {
      localStorage.removeItem('single_scan_draft');
      localStorage.removeItem('single_scan_draft_location');
    }
  }, [draftBook, draftLocationId, isStateLoaded]);

  const modalRef = useRef<HTMLDivElement>(null);
  const queueListRef = useRef<HTMLDivElement>(null);
  const prevQueueLengthRef = useRef(0);
  const isMobile = useIsMobile();

  // Focus trap / Escape / body scroll lock for the idle/loading/error chrome.
  // The 'loaded' state renders the real BookModal, which manages all of this itself.
  useEffect(() => {
    if (state === 'loaded') return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

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
      document.documentElement.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [onClose, state]);



  useEffect(() => {
    let cancelled = false;
    getPrefs(isGuest).then(({ defaultLocation }) => {
      if (cancelled) return;
      const savedId = defaultLocation?.id || '';
      const savedObj = defaultLocation ? { room: defaultLocation.room, bookshelf: defaultLocation.bookshelf } : null;

      setPersistentDefaultLocationId(savedId);
      setPersistentDefaultLocationObj(savedObj);

      // Initialize active scanning session location
      setCurrentRoom(savedObj?.room || '');
      setCurrentShelfId(savedId);
    }).catch((e) => {
      console.warn('Failed to load default location settings:', e);
    });
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  useEffect(() => {
    if (queue.length > prevQueueLengthRef.current) {
      queueListRef.current?.scrollTo({
        top: queueListRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
    prevQueueLengthRef.current = queue.length;
  }, [queue.length]);

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
      const newShelf = await addLocation(room, '');
      return newShelf;
    } catch {
      console.warn('Failed to save room-only location');
    }
    return { id: '', room, bookshelf: '' };
  }, [shelves, addLocation]);

  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room))).filter(Boolean);
  const setupRoomIsSelected = uniqueRooms.includes(setupRoom);
  const currentRoomIsSelected = uniqueRooms.includes(currentRoom);
  const setupShelvesInRoom = setupRoomIsSelected
    ? shelves.filter(s => s.room === setupRoom && s.bookshelf !== '')
    : [];
  const currentShelvesInRoom = currentRoomIsSelected
    ? shelves.filter(s => s.room === currentRoom && s.bookshelf !== '')
    : [];

  const {
    addResultToQueue,
    removeFromQueue,
    startEditLocation,
    cancelEditLocation,
    confirmLocation: confirmChanges,
    saveQueueRow,
    saveAllQueue,
  } = useScanQueue(
    isGuest,
    books,
    onBookAdded,
    showToast,
    resolveLocationSelection,
    uniqueRooms,
    queue,
    setQueue
  );

  const handleStartMultiScan = async () => {
    if (!currentRoom || !uniqueRooms.includes(currentRoom)) {
      setDefaultLocationId('');
      setDefaultLocationObj(null);
      setMode('location');
      return;
    }

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
    setDefaultLocationAttention(false);
  };

  const handleCancelEditDefault = () => {
    setEditingDefault(false);
    setDefaultLocationAttention(false);
  };

  const handleConfirmDefaultChange = async () => {
    if (!setupRoom || !uniqueRooms.includes(setupRoom)) {
      setDefaultLocationId('');
      setDefaultLocationObj(null);
      setEditingDefault(false);
      return;
    }
    const resolved = await resolveLocationSelection(setupRoom, setupShelfId);
    if (!resolved) return;
    setDefaultLocationId(resolved.id);
    setDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });
    setEditingDefault(false);
    setDefaultLocationAttention(false);
  };

  const handleSaveDefaultLocation = async () => {
    if (!setupRoom || !uniqueRooms.includes(setupRoom)) {
      setPersistentDefaultLocationId('');
      setPersistentDefaultLocationObj(null);
      await setDefaultLocation(isGuest, null);

      // Sync current session scan location
      setCurrentRoom('');
      setCurrentShelfId('');

      // Sync multi-scan queue location
      setDefaultLocationId('');
      setDefaultLocationObj(null);

      setLocationSetupOpen(false);
      return;
    }
    const resolved = await resolveLocationSelection(setupRoom, setupShelfId);
    if (!resolved) return;

    setPersistentDefaultLocationId(resolved.id);
    setPersistentDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });

    await setDefaultLocation(isGuest, { id: resolved.id, room: resolved.room, bookshelf: resolved.bookshelf });

    // Sync current session scan location
    setCurrentRoom(resolved.room);
    setCurrentShelfId(resolved.id);

    // Sync multi-scan queue location
    setDefaultLocationId(resolved.id);
    setDefaultLocationObj({ room: resolved.room, bookshelf: resolved.bookshelf });
    setDefaultLocationAttention(false);

    setLocationSetupOpen(false);
  };


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
        const added = addResultToQueue(result, defaultLocationId, defaultLocationObj);
        if (added) {
          setManualIsbn('');
          if (!defaultLocationId) {
            setDefaultLocationAttention(true);
          }
        }
        setState('idle');
        return;
      }

      const resolved = currentRoomIsSelected
        ? await resolveLocationSelection(currentRoom, currentShelfId)
        : null;
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
    } catch (err) {
      if (err instanceof BookLookupLimitError) {
        showToast(err.message);
        setState('idle');
        return;
      }
      if (mode === 'location') {
        showToast(`Couldn't find that book — ISBN "${isbn}"`);
        setState('idle');
        return;
      }
      setFailedIsbn(isbn);
      setState('error');
    }
  }, [mode, addResultToQueue, defaultLocationId, defaultLocationObj, showToast, currentRoom, currentShelfId, currentRoomIsSelected, resolveLocationSelection]);

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
      setDraftBook(null);
      localStorage.removeItem('single_scan_draft');
      localStorage.removeItem('single_scan_draft_location');
      onClose();
      return;
    }

    setIsSaving(true);

    try {
      await onBookAdded(draftBook, draftLocationId || undefined);
      setDraftBook(null);
      localStorage.removeItem('single_scan_draft');
      localStorage.removeItem('single_scan_draft_location');
      setState('idle');
      onClose();
    } catch {
      console.warn('Failed to save scanned book');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardDraft = () => {
    setDraftBook(null);
    localStorage.removeItem('single_scan_draft');
    localStorage.removeItem('single_scan_draft_location');
    setState('idle');
    onClose();
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
            onClick={() => { setMode('single'); setLocationSetupOpen(false); }}
            style={styles.backBtn}
            aria-label="Go back to single scan"
          >
            <span className="material-symbols-outlined" style={styles.backIcon}>chevron_left</span>
            <span style={styles.backText}>Back</span>
          </button>

          <span
            className={`material-symbols-outlined${state === 'loading' ? ' spin-icon' : ''}`}
            style={styles.topCenterScannerIcon}
          >
            {state === 'loading' ? 'progress_activity' : 'qr_code_scanner'}
          </span>

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
                    <motion.div
                      style={styles.horizontalSelects}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.08, ease: 'easeOut' }}
                    >
                      <select
                        aria-label="Select room"
                        value={setupRoom}
                        onChange={(e) => { setSetupRoom(e.target.value); setSetupShelfId(''); }}
                        style={styles.selectFieldHorizontal}
                        className="book-modal-select"
                      >
                        <option value="">Unassigned</option>
                        {uniqueRooms.map((r, i) => (
                          <option key={i} value={r}>{r}</option>
                        ))}
                      </select>
                      <AnimatePresence>
                        {setupRoomIsSelected && (
                          <motion.select
                            key="shelf-select"
                            aria-label="Select shelf"
                            value={setupShelfId}
                            onChange={(e) => setSetupShelfId(e.target.value)}
                            style={styles.selectFieldHorizontal}
                            className="book-modal-select"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                          >
                            <option value="">Unassigned</option>
                            {setupShelvesInRoom.map((s) => (
                              <option key={s.id} value={s.id}>{s.bookshelf}</option>
                            ))}
                          </motion.select>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                  <div style={styles.setupActionsHorizontal}>
                    <button
                      type="button"
                      onClick={handleConfirmDefaultChange}
                      className={`icon-btn ${defaultLocationAttention ? 'vibrate-attention' : ''}`}
                      style={{ ...styles.iconBtnAction, color: 'var(--accent-primary)' }}
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
                      className={`icon-btn ${defaultLocationAttention ? 'vibrate-attention' : ''}`}
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
                    <span style={styles.bigLocationText}>
                      {defaultLocationObj
                        ? `${defaultLocationObj.room}${defaultLocationObj.bookshelf ? ` • ${defaultLocationObj.bookshelf}` : ''}`
                        : 'Unassigned'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartEditDefault}
                    style={styles.editLink}
                    className={defaultLocationAttention ? 'vibrate-attention' : ''}
                  >
                    Change
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div ref={queueListRef} style={styles.queueList}>
            {queue.length === 0 ? (
              <p style={styles.emptyQueueText}>No books scanned yet</p>
            ) : (
              queue.map((book) => (
                <ScanQueueRow
                  key={book.id}
                  book={book}
                  shelves={shelves}
                  onSave={saveQueueRow}
                  onRemove={removeFromQueue}
                  onStartEditLocation={startEditLocation}
                  onCancelEditLocation={cancelEditLocation}
                  onConfirmChanges={confirmChanges}
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
              onClick={saveAllQueue}
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
        onDelete={handleDiscardDraft}
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

        {mode === 'single' && !locationSetupOpen && (
          <button
            type="button"
            onClick={handleStartMultiScan}
            style={styles.scanMultipleTopRight}
            aria-label="Scan multiple books"
          >
            Scan Multiple Books
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
                    <motion.div
                      style={styles.setupForm}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                    >
                      <select
                        aria-label="Select room"
                        value={setupRoom}
                        onChange={(e) => { setSetupRoom(e.target.value); setSetupShelfId(''); }}
                        style={styles.selectField}
                        className="book-modal-select"
                      >
                        <option value="">Unassigned</option>
                        {uniqueRooms.map((r, i) => (
                          <option key={i} value={r}>{r}</option>
                        ))}
                      </select>
                      <AnimatePresence>
                        {setupRoomIsSelected && (
                          <motion.select
                            key="shelf-select"
                            aria-label="Select shelf"
                            value={setupShelfId}
                            onChange={(e) => setSetupShelfId(e.target.value)}
                            style={styles.selectField}
                            className="book-modal-select"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                          >
                            <option value="">Unassigned</option>
                            {setupShelvesInRoom.map((s) => (
                              <option key={s.id} value={s.id}>{s.bookshelf}</option>
                            ))}
                          </motion.select>
                        )}
                      </AnimatePresence>
                      {isMobile && mode === 'single' && (
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
                    </motion.div>
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
                    <motion.div
                      style={styles.setupForm}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                    >
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
                        <option value="">Unassigned</option>
                        {uniqueRooms.map((r, i) => (
                          <option key={i} value={r}>{r}</option>
                        ))}
                      </select>

                      <AnimatePresence>
                        {currentRoomIsSelected && (
                          <motion.select
                            key="current-shelf-select"
                            aria-label="Select Shelf"
                            value={currentShelfId}
                            onChange={(e) => setCurrentShelfId(e.target.value)}
                            style={styles.selectField}
                            className="book-modal-select"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                          >
                            <option value="">Unassigned</option>
                            {currentShelvesInRoom.map((s) => (
                              <option key={s.id} value={s.id}>{s.bookshelf}</option>
                            ))}
                          </motion.select>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    <button
                      type="button"
                      onClick={() => {
                        setSetupRoom(persistentDefaultLocationObj?.room || '');
                        setSetupShelfId(persistentDefaultLocationId);
                        setLocationSetupOpen(true);
                      }}
                      style={styles.defaultLocationLink}
                    >
                      Change Preferred Scan Location
                    </button>

                    <form onSubmit={handleManualSubmit} style={styles.manualForm}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="field-white"
                        placeholder="OR enter ISBN number"
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

        {!isMobile && locationSetupOpen && mode === 'single' && (
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
    marginTop: '40px',
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
  scanMultipleTopRight: {
    position: 'absolute',
    top: '24px',
    right: '36px',
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline wavy var(--accent-primary)',
    textUnderlineOffset: '4px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    zIndex: 10,
  },
  topCenterScannerIcon: {
    position: 'absolute',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '40px',
    color: 'var(--accent-primary)',
    zIndex: 10,
  },
  setupForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
    maxWidth: '260px',
    marginTop: '8px',
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
    maxHeight: 'calc(100svh - 64px)',
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
