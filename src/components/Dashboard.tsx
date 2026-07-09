'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import LogoutLink from '@/components/LogoutLink';
import BookCardModal, { Book } from '@/components/BookModal';
import ManageLocationsModal from '@/components/ManageLocationsModal';
import ScanBookModal from '@/components/ScanBookModal';
import FilterPanel, { FilterMode } from '@/components/FilterPanel';
import { createClient } from '@/lib/supabase/client';
import { TextAnimate } from '@/registry/magicui/text-animate';
import HeroAnimation from '@/components/HeroAnimation';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';

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
  const [searchQuery, setSearchQuery] = useState('');
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

  // Fade the header title into the Search/Scan/Filter words as soon as the page starts scrolling
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY >= 150);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close search when clicking anywhere outside of it
  useEffect(() => {
    if (!isSearching) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const wrapper = document.getElementById('hero-search-wrapper');
      if (wrapper && !wrapper.contains(e.target as Node)) {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isSearching]);

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

  const displayText = searchQuery || 'Search';
  const pillWidth = Math.max(120, displayText.length * 16 + 40);
  const pillLeft = -20;

  const searchContent = (
    <h1 className="display-serif" style={{ ...styles.heroTitle, whiteSpace: 'normal' }}>
      <span id="hero-search-wrapper" style={{
        position: 'relative',
        display: 'inline-block',
        verticalAlign: 'baseline',
      }}>
        {/* Static hidden placeholder of "Search" so the rest of the sentence is placed correctly */}
        <span style={{
          visibility: 'hidden',
          fontStyle: 'italic',
          fontFamily: 'var(--font-newsreader), Georgia, serif',
          fontSize: '32px',
          fontWeight: 'normal',
          lineHeight: '1.4',
          opacity: 0.4,
          filter: 'blur(5px)',
        }}>
          Search
        </span>

        <input
          id="hero-search-input"
          autoFocus
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const query = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
              const matchedCount = books.filter(b => {
                if (!query) return true;
                return (
                  b.title.toLowerCase().includes(query) ||
                  b.authors.some(a => a.toLowerCase().includes(query))
                );
              }).length;

              if (matchedCount === 0 && query !== '') {
                showToast(`No books match "${searchQuery}"`);
                setSearchQuery('');
              }
              setIsSearching(false);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setIsSearching(false);
              setSearchQuery('');
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Search"
          style={{
            position: 'absolute',
            left: `${pillLeft}px`, // Offset slightly to overlap the text naturally
            top: '-6px',
            fontFamily: 'var(--font-newsreader), Georgia, serif',
            fontWeight: 'normal',
            fontSize: '32px',
            fontStyle: 'italic',
            color: 'var(--accent-primary)',
            backgroundColor: 'rgba(0, 44, 188, 0.06)', // Light blue container background
            borderRadius: '8px', // Clean capsule border radius
            padding: '6px 20px', // More padding to the search pill
            border: 'none',
            outline: 'none',
            textDecoration: 'underline wavy var(--accent-primary)',
            textDecorationThickness: '1.5px',
            width: `${pillWidth}px`, // Dynamic width hugs content to prevent "h" cuts
            lineHeight: '1.4',
            height: 'calc(100% + 12px)',
            margin: 0,
            boxSizing: 'border-box',
            zIndex: 10,
          }}
        />

        {searchQuery && (
          <span style={{
            position: 'absolute',
            left: `${pillWidth - 8}px`, // Dynamic offset pushed by the input width
            top: '50%',
            transform: 'translateY(-55%)',
            fontSize: '15px',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-instrument-sans), sans-serif',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: 0.8,
            fontWeight: 'bold',
            zIndex: 20,
          }}>
            press ⏎
          </span>
        )}
      </span>
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
          {filterLabel}
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
      className="display-serif"
      style={{ ...styles.heroTitle, whiteSpace: 'normal' }}
      highlights={[
        { match: 'Search', onClick: () => { setIsSearching(true); setHasSearched(true); } },
        { match: 'Scan', onClick: () => setIsScanModalOpen(true) },
        { match: filterLabel, onClick: () => setIsFilterOpen(true) },
      ]}
      disableAnimation={hasSearched}
    >
      {`Search for the books in your library. Scan to add new books.\nCurrently showing ${filterLabel}.`}
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
      <header style={styles.header}>
        <motion.div
          style={styles.headerContent}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.8, ease: 'easeOut' }}
        >
          <div style={styles.leftNav}>
            <button
              onClick={() => setIsManageLocationsOpen(true)}
              className="nav-link"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              Manage Locations
            </button>
          </div>

          {/* Fades from the title into wiggly Search/Scan/Filter words (same style as the hero's) on scroll */}
          <div style={styles.logoSlot}>
            <AnimatePresence mode="wait">
              {isScrolled ? (
                <motion.div
                  key="header-actions"
                  initial={{ opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.25 }}
                  style={{ display: 'inline-block', pointerEvents: 'auto' }}
                >
                  <TextAnimate
                    animation="blurIn"
                    as="div"
                    className="display-serif"
                    style={{ ...styles.heroTitle, whiteSpace: 'nowrap' }}
                    highlights={[
                      { match: 'Search', onClick: () => { setIsSearching(true); setHasSearched(true); } },
                      { match: 'Scan', onClick: () => setIsScanModalOpen(true) },
                      { match: 'Filter', onClick: () => setIsFilterOpen(true) },
                    ]}
                  >
                    {'Search   Scan   Filter'}
                  </TextAnimate>
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
            <LogoutLink />
          </div>
        </motion.div>
      </header>

      {/* Unified Flex Layout with Hero Centered and 6-Column Shelf Peeking at Bottom */}
      <main style={styles.mainLayout}>
        {/* Center Column (Hero Text / Action Space) */}
        <motion.div
          id="hero-search-container"
          style={{
            ...styles.heroContainer,
            opacity: heroOpacity,
            scale: heroScale,
            y: heroY,
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
          style={styles.booksSection}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.5, duration: 1.0, ease: [0.25, 1, 0.5, 1] }}
        >
          <div style={styles.booksGrid} className="books-grid">
            <AnimatePresence>
              {books
                .filter(b => {
                  const query = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
                  const matchesQuery = !query || (
                    b.title.toLowerCase().includes(query) ||
                    b.authors.some(a => a.toLowerCase().includes(query))
                  );
                  return matchesQuery && matchesFilter(b);
                })
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
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>

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
      </AnimatePresence>

      {/* Toast Notification Container */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'fixed',
              bottom: '40px',
              left: '50%',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--accent-primary)',
              padding: '12px 24px',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0, 44, 188, 0.15)',
              zIndex: 9999,
              fontFamily: 'var(--font-instrument-sans), sans-serif',
              fontSize: '0.9rem',
              fontWeight: '600',
              border: '1px solid var(--accent-primary)',
              transform: 'translateX(-50%)',
            }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Inner Component for Book Cards
interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
}

function BookCard({ book, onClick }: BookCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

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
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={book.cover_url}
            alt={book.title}
            style={styles.coverImg}
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
            <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
            <span className="display-serif" style={styles.placeholderText}>{book.title}</span>
          </div>
        )}
      </motion.div>

      {/* Name and author fade in cleanly underneath on hover - Larger Typography */}
      <div style={styles.metaContainer}>
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
              transition={{ duration: 0.15 }}
              style={{ pointerEvents: 'none' }}
            >
              <h4 style={styles.bookTitle}>
                {book.title}
              </h4>
              <p className="handwritten" style={styles.bookAuthor}>
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
    gap: '32px', // Comfortable spacing for larger cards
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
  },
  coverWrapper: {
    borderRadius: '0px',
    border: 'none',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-sheet)',
    position: 'relative',
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
    height: '80px', // Increased height
    width: '180px',
    marginTop: '20px', // Increased gap from cover
  },
  bookTitle: {
    fontSize: '18px', // Increased title size
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: '1.3',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  bookAuthor: {
    fontSize: '18px', // Increased author size
    fontWeight: '600', // Increased weight
    color: 'var(--accent-primary)', // Accent blue color
    margin: '4px 0 0 0',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
