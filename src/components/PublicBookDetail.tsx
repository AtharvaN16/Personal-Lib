'use client';

import { motion } from 'framer-motion';
import { Book } from '@/components/BookModal';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';

interface PublicBookDetailProps {
  book: Book;
  onClose: () => void;
}

export default function PublicBookDetail({ book, onClose }: PublicBookDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={styles.backdrop}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn" aria-label="Close">
          CLOSE
        </button>

        <div style={styles.body}>
          <div style={styles.coverWrapper}>
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} style={styles.coverImg} />
            ) : (
              <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
                <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
              </div>
            )}
          </div>
          <div style={styles.info}>
            <h2 style={styles.title}>{book.title}</h2>
            <p style={styles.authors}>{book.authors.join(', ')}</p>
            {book.status && <p style={styles.meta}>Status: {book.status}</p>}
            {book.location && (
              <p style={styles.meta}>
                Location: {book.location.room}{book.location.bookshelf ? ` · ${book.location.bookshelf}` : ''}
              </p>
            )}
            {book.description && <p style={styles.description}>{book.description}</p>}
          </div>
        </div>
      </motion.div>
    </motion.div>
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    width: '100%',
    maxWidth: '520px',
    backgroundColor: 'var(--bg-sheet)',
    padding: '28px 24px 24px 24px',
    position: 'relative',
    maxHeight: '90svh',
    overflowY: 'auto',
    borderRadius: '0px',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.12)',
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    padding: 0,
  },
  body: {
    display: 'flex',
    gap: '20px',
    marginTop: '20px',
  },
  coverWrapper: {
    width: '120px',
    height: '168px',
    flexShrink: 0,
    position: 'relative',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  placeholderSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '10px',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    margin: 0,
  },
  authors: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  meta: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  description: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
    marginTop: '8px',
  },
};
