'use client';

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { getPlaceholderColor, getSpineColor } from '@/lib/placeholderCover';
import type { QueuedBook } from '@/components/ScanBookModal';
import type { Shelf } from '@/lib/hooks/useLocations';

interface ScanQueueRowProps {
  book: QueuedBook;
  shelves: Shelf[];
  onSave: (id: string) => void;
  onRemove: (id: string) => void;
  onStartEditLocation: (id: string) => void;
  onCancelEditLocation: (id: string) => void;
  onConfirmChanges: (id: string, title: string, authors: string[], room: string, shelfId: string) => void;
}

export default function ScanQueueRow({
  book,
  shelves,
  onSave,
  onRemove,
  onStartEditLocation,
  onCancelEditLocation,
  onConfirmChanges,
}: ScanQueueRowProps) {
  const [imgError, setImgError] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editShelfId, setEditShelfId] = useState('');
  const isSaving = book.rowState === 'saving';

  const startEdit = () => {
    setEditTitle(book.title);
    setEditAuthor(book.authors.join(', '));
    setEditRoom(book.location?.room ?? '');
    setEditShelfId(book.locationId);
    onStartEditLocation(book.id);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirmChanges(
        book.id,
        editTitle,
        editAuthor.split(',').map(a => a.trim()).filter(Boolean),
        editRoom,
        editShelfId
      );
    }
  };

  const uniqueRooms = Array.from(new Set(shelves.map(s => s.room))).filter(Boolean);
  const editRoomIsKnown = uniqueRooms.includes(editRoom);
  const shelvesInRoom = editRoomIsKnown
    ? shelves.filter(s => s.room === editRoom && s.bookshelf !== '')
    : [];

  return (
    <div style={styles.row} className="scan-queue-row">
      <div style={styles.coverWrapper}>
        {book.cover_url && !imgError ? (
          <img
            src={book.cover_url}
            alt={book.title}
            style={{ position: 'absolute', height: '100%', width: '100%', left: 0, top: 0, right: 0, bottom: 0, objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ ...styles.placeholderCover, backgroundColor: getPlaceholderColor(book.title) }}>
            <div style={{ ...styles.placeholderSpine, backgroundColor: getSpineColor(book.title) }} />
          </div>
        )}
      </div>

      <div style={styles.textCol}>
        {book.editingLocation ? (
          <div style={styles.editFieldsWrapper}>
            <input
              type="text"
              aria-label="Edit title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              style={styles.miniInput}
              placeholder="Title"
            />
            <input
              type="text"
              aria-label="Edit author"
              value={editAuthor}
              onChange={(e) => setEditAuthor(e.target.value)}
              onKeyDown={handleKeyDown}
              style={styles.miniInput}
              placeholder="Author(s)"
            />
            <div style={styles.editLocationRow}>
              <select
                aria-label="Select room"
                value={editRoom}
                onChange={(e) => { setEditRoom(e.target.value); setEditShelfId(''); }}
                style={styles.miniSelect}
                className="book-modal-select"
              >
                <option value="">Unassigned</option>
                {uniqueRooms.map((r, i) => (
                  <option key={i} value={r}>{r}</option>
                ))}
              </select>
              {editRoomIsKnown && (
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
                onClick={() => onConfirmChanges(
                  book.id,
                  editTitle,
                  editAuthor.split(',').map(a => a.trim()).filter(Boolean),
                  editRoom,
                  editShelfId
                )}
                className="icon-btn"
                style={{ ...styles.rowIconBtn, color: 'var(--accent-primary)' }}
                title="Save changes"
                aria-label="Save changes"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  check
                </span>
              </button>
              <button
                type="button"
                onClick={() => onCancelEditLocation(book.id)}
                className="icon-btn"
                style={{ ...styles.rowIconBtn, color: 'var(--text-secondary)' }}
                title="Cancel"
                aria-label="Cancel"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  close
                </span>
              </button>
            </div>
          </div>

        ) : (
          <>
            <span style={styles.title}>{book.title}</span>
            <span style={styles.author}>{book.authors.join(', ') || 'Unknown Author'}</span>
            <span style={styles.location}>
              {book.location?.room}
              {book.location?.bookshelf ? ` • ${book.location.bookshelf}` : ''}
            </span>
          </>
        )}
      </div>

      <div style={styles.actions} className="scan-queue-row-actions">
        <button
          type="button"
          onClick={() => onSave(book.id)}
          disabled={isSaving}
          className="icon-btn"
          style={{ ...styles.rowIconBtn, color: 'var(--text-secondary)' }}
          title="Save book to library"
          aria-label="Save book to library"
        >
          <span className={`material-symbols-outlined${isSaving ? ' spin-icon' : ''}`} style={{ fontSize: '20px' }}>
            {isSaving ? 'progress_activity' : 'save'}
          </span>
        </button>
        <button
          type="button"
          onClick={startEdit}
          className="icon-btn"
          style={{ ...styles.rowIconBtn, color: 'var(--text-secondary)' }}
          title="Change location"
          aria-label="Change location"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            edit
          </span>
        </button>
        <button
          type="button"
          onClick={() => onRemove(book.id)}
          className="icon-btn"
          style={{ ...styles.rowIconBtn, color: 'var(--error)' }}
          title="Remove from queue"
          aria-label="Remove from queue"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            delete
          </span>
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
    gap: '4px',
    flexShrink: 0,
  },
  rowIconBtn: {
    background: 'none',
    border: 'none',
    padding: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  editFieldsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
  },
  miniInput: {
    padding: '4px 8px',
    border: '1px solid rgba(17, 22, 37, 0.12)',
    borderRadius: '0px',
    background: 'var(--bg-sheet)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
