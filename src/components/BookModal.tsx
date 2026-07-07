'use client';

import { motion } from 'framer-motion';

export interface Book {
  id: string;
  title: string;
  authors: string[];
  isbn?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  description?: string | null;
  cover_url?: string | null;
  location?: {
    room: string;
    bookshelf: string;
  } | null;
  genres?: string[];
  status?: 'Completed' | 'Reading' | 'To Read';
  notes?: string | null;
  x?: number;
  y?: number;
}

interface BookModalProps {
  book: Book;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: 'Completed' | 'Reading' | 'To Read') => void;
}

export default function BookModal({ book, onClose, onDelete, onStatusChange }: BookModalProps) {
  // Format publish year cleanly
  const publishYear = book.published_date 
    ? book.published_date.substring(0, 4) 
    : '';

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="cozy-card"
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div style={styles.content}>
          {/* Left Column - Cover and Actions */}
          <div style={styles.leftCol}>
            <div style={styles.coverWrapper}>
              {book.cover_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={book.cover_url} alt={book.title} style={styles.coverImg} />
              ) : (
                <div style={styles.placeholderCover}>
                  <span className="handwritten">{book.title}</span>
                </div>
              )}
            </div>

            {/* Read Status Selector */}
            <div style={styles.statusWrapper}>
              <select
                value={book.status || 'To Read'}
                onChange={(e) => onStatusChange?.(book.id, e.target.value as 'Completed' | 'Reading' | 'To Read')}
                style={styles.statusSelect}
                className="handwritten"
              >
                <option value="Completed">Completed v</option>
                <option value="Reading">Reading v</option>
                <option value="To Read">To Read v</option>
              </select>
            </div>

            {/* Delete Button */}
            {onDelete && (
              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to delete this book?')) {
                    onDelete(book.id);
                  }
                }} 
                style={styles.deleteBtn}
              >
                Delete
              </button>
            )}
          </div>

          {/* Right Column - Information */}
          <div style={styles.rightCol}>
            <div style={styles.headerInfo}>
              <h2 style={styles.title}>
                {book.title}
                {publishYear && <span className="handwritten" style={styles.year}> {publishYear}</span>}
              </h2>
              <p className="handwritten" style={styles.author}>
                {book.authors.join(', ')}
              </p>
            </div>

            {/* Location Section */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Location</h3>
                <button style={styles.editLink}>Edit</button>
              </div>
              <p style={styles.sectionContent}>
                {book.location 
                  ? `${book.location.room}, ${book.location.bookshelf}` 
                  : 'Unassigned shelf'}
              </p>
            </div>

            {/* Genre Section */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Genre</h3>
              <p style={styles.genreTags}>
                {book.genres && book.genres.length > 0 
                  ? book.genres.join('   ') 
                  : 'No genres assigned'}
              </p>
            </div>
            
            {/* Description (If available) */}
            {book.description && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Description</h3>
                <p style={styles.descriptionText}>{book.description}</p>
              </div>
            )}
          </div>
        </div>
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
    backgroundColor: 'rgba(17, 22, 37, 0.25)', // Subtle backdrop shadow
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    width: '100%',
    maxWidth: '680px',
    backgroundColor: 'var(--bg-primary)', // #F4F2E4 to match card background in screenshot
    padding: '40px 36px 36px 36px',
    position: 'relative',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'color 0.2s ease',
  },
  content: {
    display: 'flex',
    gap: '36px',
    flexDirection: 'row',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
    width: '200px',
    flexShrink: 0,
  },
  coverWrapper: {
    width: '200px',
    height: '280px',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 12px 24px rgba(17, 22, 37, 0.15)', // Shadow from screenshot
    border: '1px solid var(--border-sketch)',
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
    padding: '16px',
    textAlign: 'center',
    backgroundColor: 'var(--bg-sheet)',
  },
  statusWrapper: {
    marginTop: '8px',
  },
  statusSelect: {
    background: 'none',
    border: 'none',
    color: '#0D7F54', // Muted green text from screenshot
    fontSize: '1.4rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'var(--font-caveat), cursive',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#8B1E1E', // Dark red text from screenshot
    fontSize: '1.25rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    transition: 'opacity 0.2s ease',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
    flex: 1,
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    lineHeight: '1.1',
  },
  year: {
    fontSize: '1.6rem',
    color: 'var(--text-secondary)',
    fontWeight: 'normal',
    verticalAlign: 'middle',
  },
  author: {
    fontSize: '1.6rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  editLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    textDecoration: 'underline',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  sectionContent: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
  },
  genreTags: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
    letterSpacing: '0.02em',
  },
  descriptionText: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
};
