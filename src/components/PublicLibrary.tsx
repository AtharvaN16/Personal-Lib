'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book } from '@/components/BookModal';
import { Shelf } from '@/lib/hooks/useLocations';
import { normalizeQuery, bookMatchesQuery } from '@/lib/bookSearch';
import { groupBooksByRoom } from '@/lib/bookGrouping';
import PublicBookCard from '@/components/PublicBookCard';
import PublicBookDetail from '@/components/PublicBookDetail';
import SearchPill from '@/components/SearchPill';
import { TextAnimate } from '@/registry/magicui/text-animate';
import { useIsMobile } from '@/hooks/useIsMobile';

/** Mirrors Dashboard.tsx's identically-named helper: closes a search pill on outside click. */
function useCloseOnOutsideClick(active: boolean, wrapperId: string, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const wrapper = document.getElementById(wrapperId);
      if (wrapper && !wrapper.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [active, wrapperId, onClose]);
}

interface PublicLibraryProps {
  books: Book[];
  shelves: Shelf[];
  accentColor: string;
}

export default function PublicLibrary({ books, shelves, accentColor }: PublicLibraryProps) {
  const isMobile = useIsMobile();
  const [isSearching, setIsSearching] = useState(false);
  const [isHeaderSearching, setIsHeaderSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [view, setView] = useState<'catalogue' | 'locations'>('catalogue');
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-primary', accentColor);
  }, [accentColor]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(prev => {
        if (!prev && window.scrollY >= 150) return true;
        if (prev && window.scrollY <= 30) return false;
        return prev;
      });
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useCloseOnOutsideClick(isSearching, 'public-hero-search-wrapper', () => setIsSearching(false));
  useCloseOnOutsideClick(isHeaderSearching, 'public-header-search-wrapper', () => setIsHeaderSearching(false));

  const commitSearch = () => {
    setCommittedQuery(searchQuery);
    setHasSearched(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCommittedQuery('');
  };

  const appliedQuery = (isSearching || isHeaderSearching) ? searchQuery : committedQuery;
  const displayedBooks = books.filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery)));
  const rooms = Array.from(new Set([
    ...books.map(b => b.location?.room).filter((r): r is string => Boolean(r)),
    ...shelves.map(s => s.room),
  ]));
  const roomGrouping = activeRoom ? groupBooksByRoom(books, activeRoom) : null;
  const displayLabel = activeRoom
    ? `Books in ${activeRoom}`
    : `${displayedBooks.length} book${displayedBooks.length === 1 ? '' : 's'}`;
  const headerCompact = isScrolled;

  const searchContent = (
    <h1 className="display-serif hero-title-mobile" style={{ ...styles.heroTitle, whiteSpace: 'normal' }}>
      <span id="public-hero-search-wrapper" style={{ display: 'inline' }}>
        <SearchPill
          id="public-hero-search-pill"
          value={searchQuery}
          onChange={setSearchQuery}
          onEnter={() => { commitSearch(); setIsSearching(false); }}
          onEscape={() => setIsSearching(false)}
          onClear={clearSearch}
          floatClearButton
          active={isSearching}
        />
      </span>
      <span style={{ filter: 'blur(5px)', opacity: 0.4, transition: 'all 0.5s ease', display: 'inline', marginLeft: '12px' }}>
        for the books in this library.
        <br />
        Currently showing{' '}
        <span className="hover-wavy-underline" style={{ color: 'var(--accent-primary)', textUnderlineOffset: '6px', fontStyle: 'italic' }}>
          {displayLabel}
        </span>.
      </span>
    </h1>
  );

  const staticContent = (
    <TextAnimate
      animation="blurIn"
      by="word"
      as="h1"
      className="display-serif hero-title-mobile"
      style={{ ...styles.heroTitle, whiteSpace: 'normal' }}
      highlights={[
        {
          match: 'Search',
          onClick: () => { setIsSearching(true); setHasSearched(true); },
          badge: !!committedQuery,
        },
      ]}
      disableAnimation={hasSearched}
    >
      {`Welcome to my library. Search to find books.\nCurrently showing ${displayLabel}.`}
    </TextAnimate>
  );

  return (
    <div className="page-container" style={styles.frame}>
      <header style={styles.header} className="app-header">
        <motion.div
          className="desktop-header-row"
          style={styles.headerContent}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
        >
          <div style={styles.logoSlot}>
            <AnimatePresence mode="wait">
              {isHeaderSearching ? (
                <motion.div
                  key="public-header-search-pill"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                >
                  <SearchPill
                    id="public-header-search-wrapper"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onEnter={() => { commitSearch(); setIsHeaderSearching(false); }}
                    onEscape={() => setIsHeaderSearching(false)}
                    onClear={clearSearch}
                    fontSize={32}
                    autoFocus
                  />
                </motion.div>
              ) : headerCompact ? (
                <motion.button
                  key="public-header-search-trigger"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  onClick={() => committedQuery ? clearSearch() : setIsHeaderSearching(true)}
                  className="hover-wavy-underline"
                  style={styles.headerSearchTrigger}
                >
                  {committedQuery ? 'Clear search' : 'Search to find books'}
                </motion.button>
              ) : (
                <motion.h1
                  key="public-header-title"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  className="display-serif"
                  style={styles.logo}
                >
                  Welcome to my library
                </motion.h1>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </header>

      <main style={styles.main}>
        <section style={styles.heroSection}>
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%',
              opacity: isSearching ? 1 : 0,
              filter: isSearching ? 'blur(0px)' : 'blur(10px)',
              pointerEvents: isSearching ? 'auto' : 'none',
              transition: 'opacity 0.6s ease, filter 0.6s ease',
            }}>
              {searchContent}
            </div>
            <div style={{
              opacity: isSearching ? 0 : 1,
              filter: isSearching ? 'blur(10px)' : 'blur(0px)',
              pointerEvents: isSearching ? 'none' : 'auto',
              transition: 'opacity 0.6s ease, filter 0.6s ease',
            }}>
              {staticContent}
            </div>
          </div>
        </section>

        <motion.div style={styles.booksSection}>
          {view === 'catalogue' ? (
            <div style={styles.booksGrid} className="books-grid">
              <AnimatePresence>
                {displayedBooks.map((book) => (
                  <motion.div
                    key={book.id}
                    layout
                    initial={{ opacity: 0, y: 35, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: 35, filter: 'blur(0px)' }}
                    transition={{ duration: 0.3 }}
                  >
                    <PublicBookCard book={book} onClick={setSelectedBook} isMobile={isMobile} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : activeRoom === null ? (
            <div style={styles.roomList}>
              {rooms.map((room) => (
                <button key={room} onClick={() => setActiveRoom(room)} style={styles.roomRow}>
                  {room}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button onClick={() => setActiveRoom(null)} style={styles.backLink}>← All rooms</button>
              {roomGrouping!.bookshelves.map((shelf) => {
                const shelfBooks = roomGrouping!.booksByShelf[shelf].filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery)));
                if (shelfBooks.length === 0) return null;
                return (
                  <div key={shelf} style={styles.shelfSection}>
                    <div style={styles.shelfHeaderWrapper}>
                      <div style={styles.shelfHeaderLine} />
                      <h2 style={styles.shelfHeading}>Books on {shelf}</h2>
                      <div style={styles.shelfHeaderLine} />
                    </div>
                    <div style={styles.booksGrid} className="books-grid">
                      {shelfBooks.map((book) => (
                        <PublicBookCard key={book.id} book={book} onClick={setSelectedBook} isMobile={isMobile} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {roomGrouping!.unassignedBooks.filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery))).length > 0 && (
                <div style={styles.shelfSection}>
                  <div style={styles.shelfHeaderWrapper}>
                    <div style={styles.shelfHeaderLine} />
                    <h2 style={styles.shelfHeading}>Other books in {activeRoom}</h2>
                    <div style={styles.shelfHeaderLine} />
                  </div>
                  <div style={styles.booksGrid} className="books-grid">
                    {roomGrouping!.unassignedBooks.filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery))).map((book) => (
                      <PublicBookCard key={book.id} book={book} onClick={setSelectedBook} isMobile={isMobile} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>

      <AnimatePresence>
        {headerCompact && (
          <motion.div
            key="view-toggle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={styles.viewToggle}
          >
            <button
              onClick={() => { setView('catalogue'); setActiveRoom(null); }}
              style={{ ...styles.viewToggleBtn, ...(view === 'catalogue' ? styles.viewToggleBtnActive : {}) }}
            >
              Catalogue
            </button>
            <button
              onClick={() => setView('locations')}
              style={{ ...styles.viewToggleBtn, ...(view === 'locations' ? styles.viewToggleBtnActive : {}) }}
            >
              Locations
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedBook && (
          <PublicBookDetail book={selectedBook} onClose={() => setSelectedBook(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    width: '100%',
    background: 'linear-gradient(to bottom, var(--bg-primary) 65%, rgba(244, 242, 228, 0.9) 80%, rgba(244, 242, 228, 0.6) 90%, rgba(244, 242, 228, 0.2) 97%, rgba(244, 242, 228, 0) 100%)',
    padding: '36px 40px 40px 40px',
  },
  headerContent: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: '8px',
    marginBottom: '12px',
  },
  logoSlot: {
    textAlign: 'center',
  },
  logo: {
    display: 'inline-block',
    fontSize: '2.5rem',
    color: 'var(--accent-primary)',
    fontWeight: 'normal',
    textAlign: 'center',
    margin: 0,
  },
  headerSearchTrigger: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-newsreader), Georgia, serif',
    fontStyle: 'italic',
    fontSize: '32px',
    color: 'var(--accent-primary)',
    textUnderlineOffset: '6px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  heroSection: {
    width: '100%',
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    transform: 'translateY(-134px)',
  },
  heroTitle: {
    fontSize: '32px',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
    fontWeight: 'normal',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  booksSection: {
    width: '95%',
    maxWidth: '1400px',
    marginTop: '-190px',
    paddingTop: '40px',
  },
  booksGrid: {
    display: 'grid',
    width: '100%',
    paddingBottom: '24px',
  },
  viewToggle: {
    position: 'fixed',
    right: '32px',
    bottom: '32px',
    display: 'flex',
    backgroundColor: 'var(--bg-sheet)',
    borderRadius: '9999px',
    boxShadow: '0 4px 16px rgba(17, 22, 37, 0.18)',
    padding: '4px',
    zIndex: 1000,
  },
  viewToggleBtn: {
    background: 'none',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '9999px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  viewToggleBtnActive: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--bg-sheet)',
  },
  roomList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxWidth: '480px',
    margin: '0 auto',
  },
  roomRow: {
    background: 'none',
    border: 'none',
    borderBottom: '1px dashed rgba(17, 22, 37, 0.15)',
    padding: '16px 8px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '1.1rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    marginBottom: '24px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  shelfSection: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    marginBottom: '16px',
  },
  shelfHeaderWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '48px',
    marginBottom: '32px',
    width: '100%',
  },
  shelfHeaderLine: {
    flexGrow: 1,
    height: '1px',
    borderBottom: '1px dashed rgba(17, 22, 37, 0.15)',
  },
  shelfHeading: {
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    paddingLeft: '16px',
    paddingRight: '16px',
    whiteSpace: 'nowrap',
    opacity: 0.85,
  },
};
