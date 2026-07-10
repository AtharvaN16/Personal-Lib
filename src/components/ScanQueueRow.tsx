'use client';

import Image from 'next/image';
import { useState } from 'react';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';
import type { QueuedBook, Shelf } from '@/components/ScanBookModal';

interface ScanQueueRowProps {
  book: QueuedBook;
  shelves: Shelf[];
  onSave: (id: string) => void;
  onRemove: (id: string) => void;
  onStartEditLocation: (id: string) => void;
  onCancelEditLocation: (id: string) => void;
  onConfirmLocation: (id: string, room: string, shelfId: string) => void;
}

export default function ScanQueueRow({
  book,
  shelves,
  onSave,
  onRemove,
  onStartEditLocation,
  onCancelEditLocation,
  onConfirmLocation,
}: ScanQueueRowProps) {
  const [imgError, setImgError] = useState(false);
  const [editRoom, setEditRoom] = useState('');
  const [editShelfId, setEditShelfId] = useState('');
  const isSaving = book.rowState === 'saving';

  const startEdit = () => {
    setEditRoom(book.location?.room ?? '');
    setEditShelfId(book.locationId);
    onStartEditLocation(book.id);
  };

  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room)));
  const shelvesInRoom = shelves.filter(s => s.room === editRoom && s.bookshelf !== '');

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
        {book.editingLocation ? (
          <div style={styles.editLocationRow}>
            <select
              aria-label="Select room"
              value={editRoom}
              onChange={(e) => { setEditRoom(e.target.value); setEditShelfId(''); }}
              style={styles.miniSelect}
              className="book-modal-select"
            >
              <option value="">-- Select Room --</option>
              {uniqueRooms.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>
            {editRoom && (
              <select
                aria-label="Select shelf"
                value={editShelfId}
                onChange={(e) => setEditShelfId(e.target.value)}
                style={styles.miniSelect}
                className="book-modal-select"
              >
                <option value="">Unassigned</option>
                {shelvesInRoom.map((s) => (
                  <option key={s.id} value={s.id}>{s.bookshelf}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => onConfirmLocation(book.id, editRoom, editShelfId)}
              disabled={!editRoom}
              style={{ ...styles.miniSaveBtn, opacity: editRoom ? 1 : 0.5 }}
            >
              Save
            </button>
            <button type="button" onClick={() => onCancelEditLocation(book.id)} style={styles.miniCancelBtn}>
              Cancel
            </button>
          </div>
        ) : (
          <span style={styles.location}>
            {book.location?.room}
            {book.location?.bookshelf ? ` • ${book.location.bookshelf}` : ''}
          </span>
        )}
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
        <button type="button" onClick={startEdit} style={styles.changeBtn}>
          Change
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
  editLocationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '2px',
  },
  miniSelect: {
    padding: '3px 6px',
    border: '1px solid rgba(17, 22, 37, 0.12)',
    borderRadius: '0px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    backgroundColor: '#FFFFFF',
    color: 'var(--text-primary)',
    boxShadow: 'none',
    outline: 'none',
    fontSize: '0.8rem',
  },
  miniSaveBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    color: 'var(--bg-sheet)',
    padding: '3px 10px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  miniCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  changeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    textDecoration: 'underline',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
