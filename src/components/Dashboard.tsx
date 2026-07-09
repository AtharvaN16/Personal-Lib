'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import LogoutLink from '@/components/LogoutLink';
import BookCardModal, { Book } from '@/components/BookModal';
import ManageLocationsModal from '@/components/ManageLocationsModal';
import ScanBookModal from '@/components/ScanBookModal';
import FilterPanel, { FilterMode } from '@/components/FilterPanel';
import { createClient } from '@/lib/supabase/client';
import { TextAnimate } from '@/registry/magicui/text-animate';
import HeroAnimation from '@/components/HeroAnimation';
import SearchPill from '@/components/SearchPill';
import MobileMenu from '@/components/MobileMenu';
import MobileSearchOverlay from '@/components/MobileSearchOverlay';
import { useIsMobile } from '@/hooks/useIsMobile';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';

/** Closes an open search pill when the user clicks anywhere outside its wrapper element. */
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

const normalizeQuery = (query: string) => query.toLowerCase().trim().replace(/\s+/g, ' ');

const bookMatchesQuery = (book: Book, normalizedQuery: string) => {
  if (!normalizedQuery) return true;
  return (
    book.title.toLowerCase().includes(normalizedQuery) ||
    book.authors.some(a => a.toLowerCase().includes(normalizedQuery))
  );
};

// Pre-loaded mock books matching the styles in the mockup
const defaultMockBooks: Book[] = [
  {
    id: '1',
    title: 'Yellow Face',
    authors: ['RF Kuang'],
    published_date: '2019',
    cover_url: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1674498314i/62047984.jpg',
    location: { room: 'Living room', bookshelf: 'Tall Shelf' },
    genres: ['Fiction', 'History', 'Satire'],
    status: 'Completed',
    favorite: true,
  },
  {
    id: '2',
    title: 'Babel',
    authors: ['RF Kuang'],
    published_date: '2022',
    cover_url: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1674498314i/59487611.jpg',
    location: { room: 'Living room', bookshelf: 'Short Shelf' },
    genres: ['Fantasy', 'Fiction', 'Historical'],
    status: 'Reading',
    favorite: false,
  },
  {
    id: '3',
    title: 'The Hobbit',
    authors: ['J.R.R. Tolkien'],
    published_date: '1937',
    cover_url: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1546071216i/5907.jpg',
    location: { room: 'Bedroom', bookshelf: 'Bedside Table' },
    genres: ['Fantasy', 'Classic'],
    status: 'To Read',
    favorite: false,
  },
  {
    id: '4',
    title: 'Tomorrow, and Tomorrow, and Tomorrow',
    authors: ['Gabrielle Zevin'],
    published_date: '2022',
    cover_url: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1639017684i/58784475.jpg',
    location: { room: 'Living room', bookshelf: 'Tall Shelf' },
    genres: ['Fiction', 'Contemporary', 'Gaming'],
    status: 'Completed',
    favorite: true,
  },
  {
    id: '5',
    title: 'Circe',
    authors: ['Madeline Miller'],
    published_date: '2018',
    location: { room: 'Bedroom', bookshelf: 'Bedside Table' },
    genres: ['Fantasy', 'Mythology'],
    status: 'Completed',
    favorite: true,
  },
  {
    id: '6',
    title: 'Project Hail Mary',
    authors: ['Andy Weir'],
    published_date: '2021',
    location: { room: 'Living room', bookshelf: 'Short Shelf' },
    genres: ['Science Fiction'],
    status: 'Reading',
    favorite: false,
  },
  {
    id: '7',
    title: 'Klara and the Sun',
    authors: ['Kazuo Ishiguro'],
    published_date: '2021',
    location: { room: 'Study', bookshelf: 'Corner Shelf' },
    genres: ['Fiction', 'Science Fiction'],
    status: 'To Read',
    favorite: false,
  },
  {
    id: '8',
    title: 'The Song of Achilles',
    authors: ['Madeline Miller'],
    published_date: '2011',
    location: { room: 'Bedroom', bookshelf: 'Bedside Table' },
    genres: ['Fantasy', 'Mythology', 'Romance'],
    status: 'Completed',
    favorite: false,
  }
];

export default function Dashboard() {
  const supabase = createClient();
  const [isSearching, setIsSearching] = useState(false);
  const [isHeaderSearching, setIsHeaderSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // The query actually applied to the grid/"Currently showing" — only updated on a confirmed
  // (Enter) search, so an unconfirmed/abandoned query never leaves the grid stuck empty. See
  // `appliedQuery` below.
  const [committedQuery, setCommittedQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [books, setBooks] = useState<Book[]>(defaultMockBooks);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isManageLocationsOpen, setIsManageLocationsOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterRoom, setFilterRoom] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const isMobile = useIsMobile();

  // The header visually locks into its compact/scrolled appearance while editing — regardless of
  // actual scroll position — so Edit Mode's "Done" trigger and the compact title/nav stay put
  // until the user explicitly exits, instead of flickering back to the expanded header on scroll.
  const headerCompact = isScrolled || isEditMode;

  const enterEditMode = () => setIsEditMode(true);

  const exitEditMode = () => {
    setIsEditMode(false);
    setSelectedBookIds(new Set());
    setIsDeleteConfirming(false);
  };

  const toggleBookSelected = (id: string) => {
    setSelectedBookIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 150], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 150], [1, 0.95]);
  const heroY = useTransform(scrollY, [0, 150], [-134, -164]);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Fade the header title into the "Currently showing X" status as soon as the page starts scrolling.
  // Uses hysteresis (collapse at 150, only re-expand at 30) rather than a single threshold: live search
  // filtering can shrink the grid enough that the browser clamps scrollY back down momentarily, and
  // without a dead zone that dip would falsely flip isScrolled back to false mid-interaction.
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

  // Close either search pill when clicking anywhere outside of it
  useCloseOnOutsideClick(isSearching, 'hero-search-wrapper', () => setIsSearching(false));
  useCloseOnOutsideClick(isHeaderSearching, 'header-search-wrapper', () => setIsHeaderSearching(false));

  // Shared Enter-to-search logic for both the hero and header search pills
  const commitSearch = () => {
    const query = normalizeQuery(searchQuery);
    const matchedCount = books.filter(b => bookMatchesQuery(b, query)).length;

    if (matchedCount === 0 && query !== '') {
      showToast(`No books match "${searchQuery}"`);
      setSearchQuery('');
      setCommittedQuery('');
    } else {
      setCommittedQuery(searchQuery);
    }
  };

  // Clearing (the pill's × button, or the header's "Clear search") resets both the typed text and
  // whatever's actually applied to the grid — unlike Escape/outside-click, which only abandon an
  // unconfirmed edit and deliberately leave a previously committed search in place.
  const clearSearch = () => {
    setSearchQuery('');
    setCommittedQuery('');
  };

  // Load books from Supabase on mount
  useEffect(() => {
    async function loadBooks() {
      try {
        const { data } = await supabase
          .from('books')
          .select('*, location:location_id(room, bookshelf)');

        if (data && data.length > 0) {
          const formatted = data.map((b: { id: string; title: string; authors?: string[]; isbn?: string | null; publisher?: string | null; published_date?: string | null; description?: string | null; cover_url?: string | null; location?: { room: string; bookshelf: string } | null; status?: 'Completed' | 'Reading' | 'To Read' | null; notes?: string | null }) => ({
            id: b.id,
            title: b.title,
            authors: b.authors || [],
            isbn: b.isbn,
            publisher: b.publisher,
            published_date: b.published_date,
            description: b.description,
            cover_url: b.cover_url,
            location: b.location ? { room: b.location.room, bookshelf: b.location.bookshelf } : null,
            genres: [],
            status: b.status || 'To Read',
            notes: b.notes,
            favorite: false,
          }));
          setBooks(formatted);
        } else {
          setBooks(defaultMockBooks);
        }
      } catch (err) {
        console.warn('Failed to load books from Supabase, loading mock:', err);
        setBooks(defaultMockBooks);
      }
    }
    loadBooks();
  }, [supabase]);

  // Handle status update locally and in Supabase
  const handleStatusChange = async (id: string, status: 'Completed' | 'Reading' | 'To Read') => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    if (selectedBook && selectedBook.id === id) {
      setSelectedBook(prev => prev ? { ...prev, status } : null);
    }
    
    try {
      await supabase.from('books').update({ status }).eq('id', id);
    } catch {
      console.warn('Failed to save status change to Supabase');
    }
  };

  // Toggle favorite locally
  const handleFavoriteToggle = (id: string, favorite: boolean) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, favorite } : b));
    if (selectedBook && selectedBook.id === id) {
      setSelectedBook(prev => prev ? { ...prev, favorite } : null);
    }
  };

  // Handle book deletion
  const handleDelete = async (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    setSelectedBook(null);

    try {
      await supabase.from('books').delete().eq('id', id);
    } catch {
      console.warn('Failed to delete book from Supabase');
    }
  };

  // Handle location picker update inside BookModal
  const handleLocationChange = async (
    bookId: string, 
    locationId: string, 
    locationObj: { room: string; bookshelf: string } | null
  ) => {
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, location: locationObj } : b));
    if (selectedBook && selectedBook.id === bookId) {
      setSelectedBook(prev => prev ? { ...prev, location: locationObj } : null);
    }

    try {
      const locationIdVal = locationId === '' || locationId === 'unassigned' ? null : locationId;
      await supabase.from('books').update({ location_id: locationIdVal }).eq('id', bookId);
    } catch {
      console.warn('Failed to update book location in database');
    }
  };

  // Unique rooms across the catalog, offered as the location sub-filter
  const rooms = Array.from(
    new Set(books.map(b => b.location?.room).filter((r): r is string => Boolean(r)))
  );

  const matchesFilter = (b: Book) => {
    if (filterMode === 'favorites') return !!b.favorite;
    if (filterMode === 'unread') return b.status === 'To Read';
    if (filterMode === 'location') return filterRoom ? b.location?.room === filterRoom : true;
    return true;
  };

  const filterLabel =
    filterMode === 'favorites' ? 'Favorites'
    : filterMode === 'unread' ? 'Unread books'
    : filterMode === 'location' && filterRoom ? `Books in ${filterRoom}`
    : 'Entire catalog';

  // While a search pill is open, the grid/"Currently showing" live-preview whatever is typed.
  // Once closed, they fall back to the last *confirmed* (Enter) query instead of the raw typed
  // text — so abandoning a zero-match search (Escape/outside-click) can't leave the grid stuck
  // empty. The typed text itself (searchQuery) is untouched either way, so reopening the pill
  // shows exactly what was left there.
  const appliedQuery = (isSearching || isHeaderSearching || isMobileSearchOpen) ? searchQuery : committedQuery;

  // Once a search is applied (at least one match found), "Currently showing" reflects the
  // matched book(s) instead of the active filter, until the search is cleared. Must apply
  // matchesFilter too, same as the grid below — otherwise this can name a book that isn't
  // even visible (e.g. it matches the search but not the active "Unread books" filter).
  const activeSearchMatches = appliedQuery
    ? books.filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery)) && matchesFilter(b))
    : [];
  const otherMatchCount = activeSearchMatches.length - 1;
  const displayLabel =
    activeSearchMatches.length === 0 ? filterLabel
    : activeSearchMatches.length === 1 ? activeSearchMatches[0].title
    : `${activeSearchMatches[0].title} and ${otherMatchCount} other${otherMatchCount === 1 ? '' : 's'}`;

  const searchContent = (
    <h1 className="display-serif hero-title-mobile" style={{ ...styles.heroTitle, whiteSpace: 'normal' }}>
      <SearchPill
        id="hero-search-wrapper"
        value={searchQuery}
        onChange={setSearchQuery}
        onEnter={() => { commitSearch(); setIsSearching(false); }}
        onEscape={() => setIsSearching(false)}
        onClear={clearSearch}
        fontSize={32}
        autoFocus
        floatClearButton
        active={isSearching}
      />
      <span style={{
        filter: 'blur(5px)',
        opacity: 0.4,
        transition: 'all 0.5s ease',
        display: 'inline',
        marginLeft: '12px',
      }}>
        for the books in your library. Scan to add new books.
        <br />
        Currently showing{' '}
        <span
          style={{
            color: 'var(--accent-primary)',
            textDecoration: 'underline wavy var(--accent-primary)',
            textDecorationThickness: '1.5px',
            fontStyle: 'italic',
          }}
        >
          {displayLabel}
        </span>
        .
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
          onClick: () => {
            if (isMobile) {
              setIsMobileSearchOpen(true);
            } else {
              setIsSearching(true);
            }
            setHasSearched(true);
          },
          badge: !!committedQuery,
        },
        { match: 'Scan', onClick: () => setIsScanModalOpen(true) },
        { match: displayLabel, onClick: () => setIsFilterOpen(true) },
      ]}
      disableAnimation={hasSearched}
    >
      {`Search for the books in your library. Scan to add new books.\nCurrently showing ${displayLabel}.`}
    </TextAnimate>
  );

  const heroContent = (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        opacity: isSearching ? 1 : 0,
        filter: isSearching ? 'blur(0px)' : 'blur(10px)',
        pointerEvents: isSearching ? 'auto' : 'none',
        transition: 'opacity 0.6s ease, filter 0.6s ease'
      }}>
        {searchContent}
      </div>
      <div style={{
        opacity: isSearching ? 0 : 1,
        filter: isSearching ? 'blur(10px)' : 'blur(0px)',
        pointerEvents: isSearching ? 'none' : 'auto',
        transition: 'opacity 0.6s ease, filter 0.6s ease'
      }}>
        {staticContent}
      </div>
    </div>
  );

  return (
    <div className="page-container" style={styles.frame}>
      {/* Design Header with Bottom Gradient Fade */}
      <header style={styles.header} className="app-header">
        <motion.div
          className="desktop-header-row"
          style={styles.headerContent}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.05, duration: 0.8, ease: 'easeOut' }}
        >
          <div style={styles.leftNav}>
            <AnimatePresence mode="wait">
              {isHeaderSearching ? (
                // Checked first: once a header search session is open, only Escape/outside-click/Enter
                // (handled inside SearchPill) may close it. An incidental scroll-position change caused
                // by the grid reflowing as results are live-filtered must never evict it.
                <motion.div
                  key="header-search-pill"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                >
                  <SearchPill
                    id="header-search-wrapper"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onEnter={() => { commitSearch(); setIsHeaderSearching(false); }}
                    onEscape={() => setIsHeaderSearching(false)}
                    onClear={clearSearch}
                    fontSize={32}
                    autoFocus
                  />
                </motion.div>
              ) : !headerCompact ? (
                <motion.button
                  key="manage-locations"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  onClick={() => setIsManageLocationsOpen(true)}
                  className="nav-link"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  Manage Locations
                </motion.button>
              ) : (
                <motion.button
                  key="header-search-trigger"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  onClick={() => committedQuery ? clearSearch() : setIsHeaderSearching(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-newsreader), Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: '32px',
                    color: 'var(--accent-primary)',
                    textDecoration: 'underline wavy var(--accent-primary)',
                    textDecorationThickness: '1.5px',
                  }}
                >
                  {committedQuery ? 'Clear search' : 'Search'}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Fades from the title into the "Currently showing X" status (same style as the hero's) on scroll */}
          <div style={styles.logoSlot}>
            <AnimatePresence mode="wait">
              {headerCompact || isHeaderSearching ? (
                <motion.div
                  key="header-actions"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  style={{ display: 'inline-block', pointerEvents: 'auto' }}
                >
                  <div style={{
                    filter: isHeaderSearching ? 'blur(5px)' : 'blur(0px)',
                    opacity: isHeaderSearching ? 0.4 : 1,
                    transition: 'all 0.5s ease',
                  }}>
                    <TextAnimate
                      animation="blurIn"
                      as="div"
                      className="display-serif"
                      style={{ ...styles.heroTitle, whiteSpace: 'nowrap' }}
                      highlights={[
                        { match: displayLabel, onClick: () => setIsFilterOpen(true) },
                      ]}
                    >
                      {`Currently showing ${displayLabel}.`}
                    </TextAnimate>
                  </div>
                </motion.div>
              ) : (
                <motion.h1
                  key="header-logo"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  className="display-serif"
                  style={{ ...styles.logo, pointerEvents: 'auto' }}
                >
                  My Personal Library
                </motion.h1>
              )}
            </AnimatePresence>
          </div>

          <div style={styles.rightNav}>
            <AnimatePresence mode="wait">
              {isEditMode ? (
                <motion.button
                  key="edit-done"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  onClick={exitEditMode}
                  style={styles.editModeTrigger}
                >
                  Done
                </motion.button>
              ) : isScrolled ? (
                <motion.button
                  key="edit-trigger"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  onClick={enterEditMode}
                  style={styles.editModeTrigger}
                >
                  Edit
                </motion.button>
              ) : (
                <motion.div
                  key="logout-link"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                >
                  <LogoutLink />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="mobile-header-row">
          <AnimatePresence mode="wait">
            {headerCompact || isHeaderSearching || isMobileSearchOpen ? (
              <motion.h1
                key="mobile-logo-status"
                className="mobile-logo"
                initial={{ opacity: 0, filter: 'blur(6px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(6px)' }}
                transition={{ duration: 0.25 }}
              >
                {displayLabel}
              </motion.h1>
            ) : (
              <motion.h1
                key="mobile-logo-mpl"
                className="mobile-logo"
                initial={{ opacity: 0, filter: 'blur(6px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(6px)' }}
                transition={{ duration: 0.25 }}
              >
                MPL
              </motion.h1>
            )}
          </AnimatePresence>

          <div className="mobile-header-actions">
            <button
              className="mobile-icon-btn"
              onClick={() => setIsMobileSearchOpen(true)}
              aria-label="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            <button
              className="mobile-icon-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Unified Flex Layout with Hero Centered and 6-Column Shelf Peeking at Bottom */}
      <main
        style={{
          ...styles.mainLayout,
          // On mobile: no side padding — booksSection owns its own gutters
          ...(isMobile && { padding: '90px 0 0 0' }),
        }}
        className="main-layout-mobile"
      >
        {/* Center Column (Hero Text / Action Space) */}
        <motion.div
          id="hero-search-container"
          className="hero-container-mobile"
          style={{
            ...styles.heroContainer,
            opacity: heroOpacity,
            scale: heroScale,
            y: heroY,
            pointerEvents: isScrolled ? 'none' : 'auto',
            // On mobile: add side padding for the hero text
            ...(isMobile && { padding: '24px 20px' }),
          }}
        >
          <div style={{
            filter: isSearching ? 'blur(8px)' : 'blur(0px)',
            opacity: isSearching ? 0.4 : 1,
            transition: 'filter 0.6s ease, opacity 0.6s ease',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <HeroAnimation />
          </div>
          {heroContent}
        </motion.div>

        {/* 6-Column Shelf Grid Peeking above the fold */}
        <motion.div
          style={{
            ...styles.booksSection,
            // On mobile: full width with equal 20px gutters, no negative margin trick
            ...(isMobile && {
              width: '100%',
              maxWidth: '100%',
              marginTop: 0,
              paddingTop: 0,
              paddingLeft: '20px',
              paddingRight: '20px',
              boxSizing: 'border-box',
            }),
          }}
          className="books-section-mobile"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.85, duration: 1.0, ease: [0.25, 1, 0.5, 1] }}
        >
          <div
            style={{
              ...styles.booksGrid,
            }}
            className="books-grid"
          >
            <AnimatePresence>
              {books
                .filter(b => bookMatchesQuery(b, normalizeQuery(appliedQuery)) && matchesFilter(b))
                .map((book) => (
                  <motion.div
                    key={book.id}
                    layout
                    initial={{ opacity: 0, y: 35, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: 35, filter: 'blur(0px)' }}
                    transition={{ duration: 0.3 }}
                  >
                    <BookCard 
                      book={book} 
                      onClick={setSelectedBook}
                      isMobile={isMobile}
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>

      {/* Scan FAB, only surfaces once the hero has scrolled out of view */}
      <AnimatePresence>
        {(isScrolled || isHeaderSearching) && (
          <motion.button
            key="scan-fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => setIsScanModalOpen(true)}
            aria-label="Scan a book"
            style={styles.scanFab}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <line x1="14" y1="14" x2="14" y2="21" />
              <line x1="21" y1="14" x2="21" y2="21" />
              <line x1="17.5" y1="14" x2="17.5" y2="21" />
              <line x1="14" y1="17.5" x2="21" y2="17.5" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Book details overlay modal */}
      <AnimatePresence>
        {selectedBook && (
          <BookCardModal
            book={selectedBook}
            onClose={() => setSelectedBook(null)}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            onLocationChange={handleLocationChange}
            onFavoriteToggle={handleFavoriteToggle}
          />
        )}
        {isManageLocationsOpen && (
          <ManageLocationsModal onClose={() => setIsManageLocationsOpen(false)} />
        )}
        {isScanModalOpen && (
          <ScanBookModal
            onClose={() => setIsScanModalOpen(false)}
            books={books}
            showToast={showToast}
            onBookAdded={(newBook) => {
              setBooks(prev => [newBook, ...prev]);
              setIsScanModalOpen(false);
              showToast(`Added "${newBook.title}" to your library`);
            }}
          />
        )}
        {isFilterOpen && (
          <FilterPanel
            mode={filterMode}
            room={filterRoom}
            rooms={rooms}
            onApply={(mode, room) => {
              setFilterMode(mode);
              setFilterRoom(room);
            }}
            onClose={() => setIsFilterOpen(false)}
          />
        )}
        {isMobileMenuOpen && (
          <MobileMenu
            onClose={() => setIsMobileMenuOpen(false)}
            onManageLocations={() => setIsManageLocationsOpen(true)}
          />
        )}
        {isMobileSearchOpen && (
          <MobileSearchOverlay
            value={searchQuery}
            onChange={setSearchQuery}
            onEnter={() => { commitSearch(); setIsMobileSearchOpen(false); }}
            onClear={clearSearch}
            onClose={() => setIsMobileSearchOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification Container */}
      <div style={{
        position: 'fixed',
        bottom: '40px',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 9999,
      }}>
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--accent-primary)',
                padding: '12px 24px',
                borderRadius: '9999px',
                boxShadow: '0 4px 16px rgba(0, 44, 188, 0.15)',
                fontFamily: 'var(--font-instrument-sans), sans-serif',
                fontSize: '0.9rem',
                fontWeight: '600',
                pointerEvents: 'auto',
              }}
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Inner Component for Book Cards
interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
  isMobile?: boolean;
}

function BookCard({ book, onClick, isMobile = false }: BookCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const showMeta = isMobile || hovered;

  const mobileMeta: React.CSSProperties = isMobile ? {
    width: '100%',
    maxWidth: '100%',
    height: 'auto',
    marginTop: '8px',
    overflow: 'hidden',
    boxSizing: 'border-box',
  } : {};

  const mobileTitleStyle: React.CSSProperties = isMobile ? {
    fontSize: '0.82rem',
    lineHeight: '1.25',
    marginBottom: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    display: 'block',
  } : {};

  const mobileAuthorStyle: React.CSSProperties = isMobile ? {
    fontSize: '0.75rem',
    lineHeight: '1.2',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    display: 'block',
  } : {};

  return (
    <div
      style={styles.cardContainer}
      className="book-card-container"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(book)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(book);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${book.title}`}
    >
      {/* Cover Image Wrapper - Enlarged Size (180px x 252px) */}
      <motion.div
        animate={{
          scale: hovered ? 1.04 : 1,
          boxShadow: hovered 
            ? '0 20px 30px rgba(17, 22, 37, 0.18)' 
            : '0 4px 12px rgba(17, 22, 37, 0.06)',
        }}
        transition={{ duration: 0.2 }}
        style={styles.coverWrapper}
        className="book-card-cover"
      >
        {book.cover_url && !imgError ? (
          <Image
            src={book.cover_url}
            alt={book.title}
            fill
            sizes="(max-width: 480px) 140px, 180px"
            style={{ objectFit: 'cover' }}
            draggable={false}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
            <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
            <span className="display-serif" style={styles.placeholderText}>{book.title}</span>
          </div>
        )}
      </motion.div>

      {/* Name and author fade in cleanly underneath on hover - Always visible on mobile */}
      <div style={{ ...styles.metaContainer, ...mobileMeta }} className="book-card-meta">
        <AnimatePresence>
          {showMeta && (
            <motion.div
              initial={isMobile ? undefined : { opacity: 0, y: 6, filter: 'blur(2px)' }}
              animate={isMobile ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={isMobile ? undefined : { opacity: 0, y: 6, filter: 'blur(2px)' }}
              transition={isMobile ? { duration: 0 } : { duration: 0.15 }}
              style={{ pointerEvents: 'none', width: '100%', overflow: 'hidden' }}
            >
              <h4 style={{ ...styles.bookTitle, ...mobileTitleStyle }}>
                {book.title}
              </h4>
              <p className="handwritten" style={{ ...styles.bookAuthor, ...mobileAuthorStyle }}>
                {book.authors.join(', ')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    minHeight: '100vh',
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
    justifyContent: 'space-between',
    width: '100%',
    marginTop: '8px',
    marginBottom: '12px',
  },
  leftNav: {
    display: 'flex',
    gap: '24px',
  },
  logoSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    textAlign: 'center',
    pointerEvents: 'none', // Re-enabled on the actual clickable content below
  },
  logo: {
    display: 'inline-block', // Shrink-wraps to the text so its pointer-events:auto area doesn't span the full header width
    fontSize: '2.5rem',
    color: 'var(--accent-primary)',
    fontWeight: 'normal',
    textAlign: 'center',
    margin: 0,
  },
  rightNav: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  editModeTrigger: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-newsreader), Georgia, serif',
    fontStyle: 'italic',
    fontSize: '32px',
    color: 'var(--accent-primary)',
    textDecoration: 'underline wavy var(--accent-primary)',
    textDecorationThickness: '1.5px',
  },
  scanFab: {
    position: 'fixed',
    right: '32px',
    bottom: '32px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-sheet)',
    border: 'none',
    boxShadow: '0 4px 16px rgba(17, 22, 37, 0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 900,
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between', // Push grid to bottom edge
    width: '100%',
    minHeight: '100vh', // Make mainLayout fill height
    padding: '170px 40px 0 40px', // Added 170px padding-top for fixed header offset
    overflowX: 'hidden',
  },
  heroContainer: {
    textAlign: 'center',
    width: '100%', // Stretch container to full width to prevent layout shrink
    maxWidth: '1100px',
    height: 'calc(100vh - 130px)', // Take up exact vertical viewport height below fixed header
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    transform: 'translateY(-134px)', // Shift text slightly above center
  },
  heroTitle: {
    fontSize: '32px', // Exactly 32px
    color: 'var(--text-primary)',
    lineHeight: '1.4',
    fontWeight: 'normal', // Regular weight
    whiteSpace: 'nowrap', // Force 1 line
    userSelect: 'none', // Prevent browser selection highlight on click
    WebkitUserSelect: 'none',
  },
  heroSubtitle: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
  },
  booksSection: {
    width: '95%', // Smaller margins
    maxWidth: '1400px', // Wider grid container
    marginTop: '-190px', // Pulls the top of the covers up to peek above the fold
    paddingTop: '40px',
  },
  booksGrid: {
    display: 'grid',
    // gap and grid-template-columns are handled by .books-grid CSS class and its mobile media query
    width: '100%',
    paddingBottom: '24px',
  },
  // BookCard styles
  cardContainer: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    width: '100%', // Always fill the grid cell — prevents asymmetric sizing
  },
  coverWrapper: {
    borderRadius: '0px',
    border: 'none',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-sheet)',
    position: 'relative',
  },
  placeholderCover: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 12px 12px 22px', // Extra left padding so text clears the spine strip
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
    fontSize: '0.95rem',
    lineHeight: '1.2',
    color: '#FFFDFB',
  },
  metaContainer: {
    height: '80px',
    width: '100%', // Fill the card column — never fixed px so it can't overflow narrow mobile columns
    maxWidth: '180px',
    marginTop: '20px',
    overflow: 'hidden', // Clip any child that overflows
    boxSizing: 'border-box',
  },
  bookTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: '1.3',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  bookAuthor: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--accent-primary)',
    margin: '4px 0 0 0',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  emptySearchState: {
    gridColumn: 'span 6',
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'var(--bg-sheet)',
    borderRadius: '0px',
    boxShadow: '0 4px 15px rgba(17, 22, 37, 0.03)',
    width: '100%',
  },
};
