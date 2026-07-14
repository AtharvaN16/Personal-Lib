'use client';

import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Book } from '@/components/BookModal';

export interface QueuedBook {
  id: string;
  title: string;
  authors: string[];
  isbn?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  description?: string | null;
  cover_url?: string | null;
  locationId: string;
  location: { room: string; bookshelf: string } | null;
  overridden: boolean;
  rowState: 'idle' | 'saving';
  editingLocation: boolean;
}

export interface BookLookupResult {
  title: string;
  authors: string[];
  isbn: string;
  publisher: string | null;
  published_date: string | null;
  description: string | null;
  cover_url: string | null;
}

export function useScanQueue(
  isGuest: boolean,
  books: Book[],
  onBookAdded: (book: Omit<Book, 'id'>, locationId?: string) => Promise<void> | void,
  showToast: (msg: string) => void,
  resolveLocationSelection: (room: string, shelfId: string) => Promise<{ id: string; room: string; bookshelf: string } | null>,
  uniqueRooms: string[],
  queue: QueuedBook[],
  setQueue: Dispatch<SetStateAction<QueuedBook[]>>
) {
  const addResultToQueue = useCallback((
    result: BookLookupResult,
    defaultLocationId: string,
    defaultLocationObj: { room: string; bookshelf: string } | null
  ) => {
    const isDuplicate = books.some((b) =>
      (b.isbn && result.isbn && b.isbn.replace(/[\s-]/g, '') === result.isbn.replace(/[\s-]/g, '')) ||
      (b.title.toLowerCase().trim() === result.title.toLowerCase().trim() &&
        b.authors.map((a) => a.toLowerCase().trim()).join(',') ===
          result.authors.map((a) => a.toLowerCase().trim()).join(','))
    ) || queue.some((q) =>
      (q.isbn && result.isbn && q.isbn.replace(/[\s-]/g, '') === result.isbn.replace(/[\s-]/g, '')) ||
      (q.title.toLowerCase().trim() === result.title.toLowerCase().trim() &&
        q.authors.map((a) => a.toLowerCase().trim()).join(',') ===
          result.authors.map((a) => a.toLowerCase().trim()).join(','))
    );

    if (isDuplicate) {
      showToast(`"${result.title}" already exists in library`);
      return false;
    }

    setQueue((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: result.title,
        authors: result.authors,
        isbn: result.isbn,
        publisher: result.publisher,
        published_date: result.published_date,
        description: result.description,
        cover_url: result.cover_url,
        locationId: defaultLocationId,
        location: defaultLocationObj,
        overridden: false,
        rowState: 'idle',
        editingLocation: false,
      },
    ]);
    return true;
  }, [books, queue, showToast, setQueue]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, [setQueue]);

  const startEditLocation = useCallback((id: string) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, editingLocation: true } : q)));
  }, [setQueue]);

  const cancelEditLocation = useCallback((id: string) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, editingLocation: false } : q)));
  }, [setQueue]);

  const confirmChanges = useCallback(async (
    id: string,
    title: string,
    authors: string[],
    room: string,
    shelfId: string
  ) => {
    if (!room || !uniqueRooms.includes(room)) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                title,
                authors,
                locationId: '',
                location: null,
                overridden: true,
                editingLocation: false,
              }
            : q
        )
      );
      return;
    }
    const resolved = await resolveLocationSelection(room, shelfId);
    if (!resolved) return;
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              title,
              authors,
              locationId: resolved.id,
              location: { room: resolved.room, bookshelf: resolved.bookshelf },
              overridden: true,
              editingLocation: false,
            }
          : q
      )
    );
  }, [uniqueRooms, resolveLocationSelection, setQueue]);

  const persistQueuedBook = useCallback(async (row: QueuedBook) => {
    const draftBook: Omit<Book, 'id'> = {
      title: row.title,
      authors: row.authors,
      isbn: row.isbn || null,
      publisher: row.publisher || null,
      published_date: row.published_date || null,
      description: row.description || null,
      cover_url: row.cover_url || null,
      location: row.location,
      status: 'To Read',
      favorite: false,
    };
    await onBookAdded(draftBook, row.locationId || undefined);
  }, [onBookAdded]);

  const saveQueueRow = useCallback(async (id: string) => {
    const row = queue.find((q) => q.id === id);
    if (!row) return;
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, rowState: 'saving' } : q)));
    try {
      await persistQueuedBook(row);
      setQueue((prev) => prev.filter((q) => q.id !== id));
      showToast(`Added "${row.title}" to your library`);
    } catch {
      setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, rowState: 'idle' } : q)));
    }
  }, [queue, persistQueuedBook, showToast, setQueue]);

  const saveAllQueue = useCallback(async () => {
    if (queue.length === 0) return;
    const rows = queue;
    setQueue((prev) => prev.map((q) => ({ ...q, rowState: 'saving' })));
    
    const results = await Promise.allSettled(rows.map((row) => persistQueuedBook(row)));
    
    const failedIds = new Set<string>();
    results.forEach((res, idx) => {
      if (res.status === 'rejected') {
        failedIds.add(rows[idx].id);
      }
    });

    if (failedIds.size > 0) {
      setQueue((prev) =>
        prev
          .filter((q) => failedIds.has(q.id))
          .map((q) => ({ ...q, rowState: 'idle' }))
      );
      showToast(`Failed to save ${failedIds.size} book(s)`);
    } else {
      setQueue([]);
    }
  }, [queue, persistQueuedBook, showToast, setQueue]);

  return {
    queue,
    addResultToQueue,
    removeFromQueue,
    startEditLocation,
    cancelEditLocation,
    confirmLocation: confirmChanges,
    saveQueueRow,
    saveAllQueue,
    setQueue,
  };
}
