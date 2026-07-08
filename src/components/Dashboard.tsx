'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LogoutLink from '@/components/LogoutLink';
import BookModal, { Book } from '@/components/BookModal';
import { createClient } from '@/lib/supabase/client';

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
  }
];

export default function Dashboard() {
  const supabase = createClient();
  const [books, setBooks] = useState<Book[]>(defaultMockBooks);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

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

  // Distribute books between Left and Right columns to keep Center column clear
  const leftBooks = books.filter((_, idx) => idx % 2 === 0);
  const rightBooks = books.filter((_, idx) => idx % 2 !== 0);

  return (
    <div className="page-container" style={styles.frame}>
      {/* Design Header with Bottom Gradient Fade */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.leftNav}>
            <a href="#" className="nav-link">Catalog</a>
            <a href="#" className="nav-link">Search</a>
          </div>
          
          <h1 className="handwritten" style={styles.logo}>
            My Personal Library
          </h1>
          
          <div style={styles.rightNav}>
            <LogoutLink />
          </div>
        </div>
      </header>

      {/* 3-Column Layout */}
      <main style={styles.mainLayout}>
        {/* Left Column (Masonry grid flow) */}
        <div style={styles.sideColumn}>
          {leftBooks.map((book) => (
            <BookCard key={book.id} book={book} onClick={setSelectedBook} />
          ))}
        </div>

        {/* Center Column (Hero Text / Action Space) */}
        <div style={styles.centerColumn}>
          <div style={styles.heroContainer}>
            <h2 className="handwritten" style={styles.heroTitle}>
              Your Quiet Reading Corner
            </h2>
            <p style={styles.heroSubtitle}>
              Scan a book barcode to automatically log details, or explore the tabs to organize your shelves.
            </p>
          </div>
        </div>

        {/* Right Column (Masonry grid flow) */}
        <div style={styles.sideColumn}>
          {rightBooks.map((book) => (
            <BookCard key={book.id} book={book} onClick={setSelectedBook} />
          ))}
        </div>
      </main>

      {/* Book details overlay modal */}
      <AnimatePresence>
        {selectedBook && (
          <BookModal
            book={selectedBook}
            onClose={() => setSelectedBook(null)}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Inner Component for Book Cards to manage local hover state
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
      {/* Cover Image - No Stroke, No Radius, Smaller (120px width) */}
      <motion.div
        animate={{
          scale: hovered ? 1.03 : 1,
          boxShadow: hovered 
            ? '0 16px 25px rgba(17, 22, 37, 0.15)' 
            : '0 4px 10px rgba(17, 22, 37, 0.05)',
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
            <span className="handwritten" style={styles.placeholderText}>{book.title}</span>
          </div>
        )}
      </motion.div>

      {/* Name and author fade in cleanly underneath on hover */}
      <div style={styles.metaContainer}>
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
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
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    width: '100%',
    // Bottom gradient fade transition
    background: 'linear-gradient(to bottom, var(--bg-primary) 75%, rgba(244, 242, 228, 0.9) 90%, rgba(244, 242, 228, 0) 100%)',
    padding: '30px 40px 45px 40px',
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
    display: 'grid',
    gridTemplateColumns: '160px 1fr 160px', // Restrain side columns to hold book covers
    gap: '40px',
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 40px 60px 40px',
  },
  sideColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '36px',
    alignItems: 'center',
    paddingTop: '20px',
  },
  centerColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 20px',
  },
  heroContainer: {
    textAlign: 'center',
    maxWidth: '500px',
  },
  heroTitle: {
    fontSize: '3rem',
    color: 'var(--text-primary)',
    marginBottom: '16px',
    lineHeight: '1.2',
  },
  heroSubtitle: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
  },
  // BookCard styles
  cardContainer: {
    width: '120px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  coverWrapper: {
    width: '120px',
    height: '168px',
    borderRadius: '0px', // Removed radius
    border: 'none', // Removed stroke
    overflow: 'hidden',
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
    padding: '12px',
    textAlign: 'center',
    backgroundColor: 'var(--bg-sheet)',
  },
  placeholderText: {
    fontSize: '0.8rem',
    lineHeight: '1.2',
  },
  metaContainer: {
    height: '50px', // Lock height to prevent shifting layout when hover reveals metadata
    width: '120px',
    marginTop: '10px',
  },
  bookTitle: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: '1.2',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  bookAuthor: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    margin: '2px 0 0 0',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
