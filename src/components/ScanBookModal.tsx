'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import BookModal, { Book } from '@/components/BookModal';
import { fetchBookByIsbn } from '@/lib/openLibrary';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';

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
  const modalRef = useRef<HTMLDivElement>(null);

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

  const runLookup = useCallback(async (isbn: string) => {
    setState('loading');
    try {
      const result = await fetchBookByIsbn(isbn);
      if (!result) {
        setFailedIsbn(isbn);
        setState('error');
        return;
      }
      setDraftBook({
        id: 'draft',
        title: result.title,
        authors: result.authors,
        isbn: result.isbn,
        publisher: result.publisher,
        published_date: result.published_date,
        description: result.description,
        cover_url: result.cover_url,
        location: null,
        status: 'To Read',
        favorite: false,
      });
      setDraftLocationId('');
      setState('loaded');
    } catch {
      setFailedIsbn(isbn);
      setState('error');
    }
  }, []);

  // Hardware scanner only listens while waiting for a scan — not mid-lookup or once loaded
  useHardwareScanner(state === 'idle', (code) => {
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
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          CLOSE
        </button>

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
                <span className="material-symbols-outlined" style={styles.promptIcon}>
                  qr_code_scanner
                </span>
                <h2 style={styles.promptTitle}>Scan the book</h2>
                <p style={styles.promptText}>
                  Scan the barcode to add it to your library.
                </p>
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
  actionRowSpacer: {
    height: '40px', // Matches BookModal's iconBtn height
    marginBottom: '20px', // Matches BookModal's actionButtonsRow marginBottom
    flexShrink: 0,
  },
  promptWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
