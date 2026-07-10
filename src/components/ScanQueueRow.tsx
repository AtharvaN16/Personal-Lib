'use client';

import Image from 'next/image';
import { useState } from 'react';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';
import type { QueuedBook } from '@/components/ScanBookModal';

interface ScanQueueRowProps {
  book: QueuedBook;
  onSave: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function ScanQueueRow({ book, onSave, onRemove }: ScanQueueRowProps) {
  const [imgError, setImgError] = useState(false);
  const isSaving = book.rowState === 'saving';

  return (
    <div style={styles.row} className="scan-queue-row">
      <div style={styles.coverWrapper}>
        {book.cover_url && !imgError ? (
          <Image
            src={book.cover_url}
            alt={book.title}
            fill
            sizes="40px"
            style={{ objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
            <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
          </div>
        )}
      </div>

      <div style={styles.textCol}>
        <span style={styles.title}>{book.title}</span>
        <span style={styles.author}>{book.authors.join(', ') || 'Unknown Author'}</span>
        <span style={styles.location}>
          {book.location?.room}
          {book.location?.bookshelf ? ` • ${book.location.bookshelf}` : ''}
        </span>
      </div>

      <div style={styles.actions} className="scan-queue-row-actions">
        <button
          type="button"
          onClick={() => onSave(book.id)}
          disabled={isSaving}
          style={{ ...styles.saveBtn, opacity: isSaving ? 0.6 : 1 }}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => onRemove(book.id)} style={styles.removeBtn}>
          Remove
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(17, 22, 37, 0.06)',
  },
  coverWrapper: {
    width: '40px',
    height: '56px',
    flexShrink: 0,
    position: 'relative',
    borderRadius: '0px',
    overflow: 'hidden',
    boxShadow: '0 4px 10px rgba(17, 22, 37, 0.1)',
  },
  placeholderCover: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  placeholderSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px',
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    gap: '2px',
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  author: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  location: {
    fontSize: '0.8rem',
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  saveBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--error)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
