'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book } from '@/components/BookModal';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';

interface PublicBookCardProps {
  book: Book;
  onClick: (book: Book) => void;
  isMobile?: boolean;
}

export default function PublicBookCard({ book, onClick, isMobile = false }: PublicBookCardProps) {
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
          <img
            src={book.cover_url}
            alt={book.title}
            style={{ position: 'absolute', height: '100%', width: '100%', left: 0, top: 0, right: 0, bottom: 0, objectFit: 'cover' }}
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
              <h4 style={{ ...styles.bookTitle, ...mobileTitleStyle }}>{book.title}</h4>
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
  cardContainer: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
  },
  coverWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '4px',
  },
  placeholderCover: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    left: 0,
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box',
  },
  placeholderSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '10px',
  },
  placeholderText: {
    color: '#FFFDFB',
    fontSize: '0.85rem',
    textAlign: 'center',
    lineHeight: '1.3',
  },
  metaContainer: {
    marginTop: '10px',
    minHeight: '38px',
  },
  bookTitle: {
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  bookAuthor: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
};
