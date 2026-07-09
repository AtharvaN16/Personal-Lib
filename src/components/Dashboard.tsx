'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LogoutLink from '@/components/LogoutLink';
import BookCardModal, { Book } from '@/components/BookModal';
import AddLocationModal from '@/components/AddLocationModal';
import { createClient } from '@/lib/supabase/client';
import { TextAnimate } from '@/registry/magicui/text-animate';

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
  }
];

export default function Dashboard() {
  const supabase = createClient();
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [books, setBooks] = useState<Book[]>(defaultMockBooks);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  return (
    <div className="page-container" style={styles.frame}>
      {/* Design Header with Bottom Gradient Fade */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.leftNav}>
            <a href="#" className="nav-link">Catalog</a>
            <a href="#" className="nav-link">Search</a>
            <button 
              onClick={() => setIsAddLocationOpen(true)} 
              className="nav-link" 
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              + Add Location
            </button>
          </div>
          
          {/* Using Newsreader Display Font */}
          <h1 className="display-serif" style={styles.logo}>
            My Personal Library
          </h1>
          
          <div style={styles.rightNav}>
            <LogoutLink />
          </div>
        </div>
      </header>

      {/* Unified Flex Layout with Hero Centered and 6-Column Shelf Peeking at Bottom */}
      <main style={styles.mainLayout}>
        {/* Center Column (Hero Text / Action Space) */}
        <div id="hero-search-container" style={styles.heroContainer}>
          {isSearching ? (
            <h1 className="display-serif" style={styles.heroTitle}>
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
                  lineHeight: '1.4' 
                }}>
                  Search
                </span>
                
                {/* Absolute input with dynamic width, padding, and background */}
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
                    left: '-20px', // Adjusted offset to center the pill around "Search" word
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
                    width: searchQuery ? `${Math.max(100, searchQuery.length * 16 + 40)}px` : '120px', // Dynamic width hugs query
                    lineHeight: '1.4',
                    height: 'calc(100% + 12px)',
                    margin: 0,
                  }}
                />
                
                {/* Dynamic press enter hint */}
                {searchQuery && (
                  <span style={{
                    position: 'absolute',
                    right: '-105px', // Shifted slightly right to not overlap the larger padding search pill
                    top: '50%',
                    transform: 'translateY(-55%)',
                    fontSize: '15px', // Larger
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-instrument-sans), sans-serif',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    opacity: 0.8,
                    fontWeight: 'bold',
                  }}>
                    press ⏎
                  </span>
                )}
              </span>
              <span style={{ 
                filter: 'blur(5px)', 
                opacity: 0.4, 
                transition: 'all 0.3s ease',
                display: 'inline-block',
                marginLeft: '12px',
                whiteSpace: 'nowrap',
              }}>
                for the books in your library. Scan to add new books
              </span>
            </h1>
          ) : (
            /* Using Newsreader Display Font with TextAnimate */
            <TextAnimate
              animation="blurIn"
              as="h1"
              className="display-serif"
              style={styles.heroTitle}
              onSearchClick={() => {
                setIsSearching(true);
                setHasSearched(true);
              }}
              disableAnimation={hasSearched}
            >
              Search for the books in your library. Scan to add new books
            </TextAnimate>
          )}
        </div>

        {/* 6-Column Shelf Grid Peeking above the fold */}
        <div style={styles.booksSection}>
          <div style={styles.booksGrid}>
            <AnimatePresence>
              {books
                .filter(b => {
                  const query = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
                  if (!query) return true;
                  return (
                    b.title.toLowerCase().includes(query) ||
                    b.authors.some(a => a.toLowerCase().includes(query))
                  );
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
        </div>
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
        {isAddLocationOpen && (
          <AddLocationModal
            onClose={() => setIsAddLocationOpen(false)}
            onLocationAdded={(loc) => {
              alert(`Successfully added location: ${loc.bookshelf} in ${loc.room}!`);
            }}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification Container */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            style={{
              position: 'fixed',
              bottom: '40px',
              left: '50%',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              padding: '12px 24px',
              borderRadius: '30px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
              zIndex: 9999,
              fontFamily: 'var(--font-instrument-sans), sans-serif',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              userSelect: 'none',
            }}
          >
            <span>📖</span> {toastMessage}
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

  return (
    <div
      style={styles.cardContainer}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(book)}
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
      >
        {book.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img 
            src={book.cover_url} 
            alt={book.title} 
            style={styles.coverImg} 
            draggable={false}
          />
        ) : (
          <div style={styles.placeholderCover}>
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
    background: 'linear-gradient(to bottom, var(--bg-primary) 75%, rgba(244, 242, 228, 0.9) 90%, rgba(244, 242, 228, 0) 100%)',
    padding: '24px 40px 36px 40px',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  leftNav: {
    display: 'flex',
    gap: '30px',
    flex: 1,
  },
  logo: {
    fontSize: '2.5rem',
    color: 'var(--accent-primary)',
    fontWeight: 'normal',
    textAlign: 'center',
    flex: 1,
  },
  rightNav: {
    display: 'flex',
    justifyContent: 'flex-end',
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between', // Push grid to bottom edge
    width: '100%',
    minHeight: '100vh', // Make mainLayout fill height
    padding: '130px 40px 0 40px', // Added 130px padding-top for fixed header offset
    overflowX: 'hidden',
  },
  heroContainer: {
    textAlign: 'center',
    maxWidth: '1100px',
    height: 'calc(100vh - 130px)', // Take up exact vertical viewport height below fixed header
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    transform: 'translateY(-70px)', // Shift text slightly above the exact center
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
  wigglyLink: {
    fontStyle: 'italic',
    color: 'var(--accent-primary)',
    textDecoration: 'underline wavy var(--accent-primary)',
    textDecorationThickness: '1.5px',
  },
  booksSection: {
    width: '95%', // Smaller margins
    maxWidth: '1400px', // Wider grid container
    marginTop: '-190px', // Pulls the top of the covers up to peek above the fold
    paddingTop: '40px',
  },
  booksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '32px', // Comfortable spacing for larger cards
    width: '100%',
    paddingBottom: '24px',
  },
  // BookCard styles
  cardContainer: {
    width: '180px', // Enlarged Card width
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
  },
  coverWrapper: {
    width: '180px', // Enlarged Cover Width
    height: '252px', // Enlarged Cover Height
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
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    textAlign: 'center',
    backgroundColor: 'var(--bg-sheet)',
  },
  placeholderText: {
    fontSize: '0.95rem',
    lineHeight: '1.2',
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
    fontSize: '15px', // Increased author size
    color: 'var(--text-secondary)',
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
