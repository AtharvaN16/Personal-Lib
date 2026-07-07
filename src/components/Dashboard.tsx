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
    x: -180,
    y: -100,
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
    x: 100,
    y: 80,
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
    x: -120,
    y: 250,
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
    x: 180,
    y: -220,
  }
];

export default function Dashboard() {
  const supabase = createClient();
  const [books, setBooks] = useState<Book[]>(defaultMockBooks);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Load books from Supabase on mount
  useEffect(() => {
    async function loadBooks() {
      try {
        const { data } = await supabase
          .from('books')
          .select('*, location:location_id(room, bookshelf)');

        if (data && data.length > 0) {
          // Format DB books and assign layout coordinates staggered in column offsets
          const formatted = data.map((b: { id: string; title: string; authors?: string[]; isbn?: string | null; publisher?: string | null; published_date?: string | null; description?: string | null; cover_url?: string | null; location?: { room: string; bookshelf: string } | null; status?: 'Completed' | 'Reading' | 'To Read' | null; notes?: string | null }, idx: number) => ({
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
            // Stagger position calculation
            x: ((idx % 3) - 1) * 280 + (Math.sin(idx) * 40),
            y: Math.floor(idx / 3) * 350 - 50 + (Math.cos(idx) * 40),
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

  // Listen to Arrow Keys to pan the canvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip Arrow keys panning if detail modal is open
      if (selectedBook) return;

      const step = 40;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPosition(prev => ({ ...prev, y: prev.y + step }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPosition(prev => ({ ...prev, y: prev.y - step }));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPosition(prev => ({ ...prev, x: prev.x + step }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPosition(prev => ({ ...prev, x: prev.x - step }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBook]);

  // Recenter canvas coordinates
  const handleRecenter = () => {
    setPosition({ x: 0, y: 0 });
  };

  // Handle status update locally and in Supabase
  const handleStatusChange = async (id: string, status: 'Completed' | 'Reading' | 'To Read') => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    if (selectedBook && selectedBook.id === id) {
      setSelectedBook(prev => prev ? { ...prev, status } : null);
    }
    
    // Attempt saving to Supabase if it's a real book
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

    // Attempt deleting from Supabase
    try {
      await supabase.from('books').delete().eq('id', id);
    } catch {
      console.warn('Failed to delete book from Supabase');
    }
  };

  // Check if canvas has panned away from center (with small buffer)
  const isPanned = Math.abs(position.x) > 10 || Math.abs(position.y) > 10;

  return (
    <div className="page-container" style={styles.frame}>
      {/* Design Header */}
      <header style={styles.header}>
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
      </header>

      {/* Infinite Canvas Viewport */}
      <main style={styles.viewport}>
        <motion.div
          drag
          dragMomentum={true}
          dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
          animate={{ x: position.x, y: position.y }}
          onDrag={(e, info) => {
            setPosition(prev => ({
              x: prev.x + info.delta.x,
              y: prev.y + info.delta.y
            }));
          }}
          style={styles.canvas}
        >
          {/* Staggered Masonry Books Grid */}
          {books.map((book) => (
            <BookCard key={book.id} book={book} onClick={setSelectedBook} />
          ))}
        </motion.div>

        {/* Recenter Button (Fades in when panned away from center) */}
        <AnimatePresence>
          {isPanned && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={handleRecenter}
              style={styles.recenterBtn}
              className="btn-cozy sketch-border"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Center
            </motion.button>
          )}
        </AnimatePresence>
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
    <motion.div
      style={{
        position: 'absolute',
        left: `calc(50% + ${book.x}px)`,
        top: `calc(50% + ${book.y}px)`,
        width: '160px',
        cursor: hovered ? 'grabbing' : 'grab',
        zIndex: hovered ? 100 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(book)}
    >
      {/* Cover Image with custom drop shadows */}
      <motion.div
        animate={{
          scale: hovered ? 1.03 : 1,
          boxShadow: hovered 
            ? '0 20px 30px rgba(17, 22, 37, 0.16)' 
            : '0 4px 10px rgba(17, 22, 37, 0.05)',
        }}
        transition={{ duration: 0.2 }}
        style={{
          width: '160px',
          height: '224px',
          borderRadius: '8px',
          border: '2px solid var(--border-sketch)',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-sheet)',
        }}
      >
        {book.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img 
            src={book.cover_url} 
            alt={book.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            draggable={false}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '16px', textAlign: 'center' }}>
            <span className="handwritten">{book.title}</span>
          </div>
        )}
      </motion.div>

      {/* Name and author fade in cleanly underneath on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{
              marginTop: '12px',
              textAlign: 'left',
              pointerEvents: 'none', // Prevent hover loops
            }}
          >
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, lineHeight: '1.2' }}>
              {book.title}
            </h4>
            <p className="handwritten" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              {book.authors.join(', ')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    padding: '30px 40px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: '20px',
    flexShrink: 0,
  },
  leftNav: {
    display: 'flex',
    gap: '30px',
    flex: 1,
  },
  logo: {
    fontSize: '2.5rem',
    color: 'var(--accent-primary)', // #002CBC
    fontWeight: 'normal',
    textAlign: 'center',
    flex: 1,
  },
  rightNav: {
    display: 'flex',
    justifyContent: 'flex-end',
    flex: 1,
  },
  viewport: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    position: 'absolute',
    width: '3000px',
    height: '3000px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: '24px',
    right: '24px',
    zIndex: 999,
    boxShadow: '0 4px 10px rgba(17, 22, 37, 0.05)',
    backgroundColor: 'var(--bg-sheet)',
    border: '2px solid var(--border-sketch)',
    borderRadius: '20px',
    padding: '8px 16px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
};
