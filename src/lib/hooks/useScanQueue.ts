'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
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
  onBookAdded: (book: Book) => void,
  showToast: (msg: string) => void,
  resolveLocationSelection: (room: string, shelfId: string) => Promise<{ id: string; room: string; bookshelf: string } | null>,
  uniqueRooms: string[]
) {
  const [queue, setQueue] = useState<QueuedBook[]>([]);
  const supabase = createClient();

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
          q.authors.map((a) => a.toLowerCase().trim()).join(','))
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
  }, [books, queue, showToast]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const startEditLocation = useCallback((id: string) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, editingLocation: true } : q)));
  }, []);

  const cancelEditLocation = useCallback((id: string) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, editingLocation: false } : q)));
  }, []);

  const confirmLocation = useCallback(async (id: string, room: string, shelfId: string) => {
    if (!room || !uniqueRooms.includes(room)) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
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
              locationId: resolved.id,
              location: { room: resolved.room, bookshelf: resolved.bookshelf },
              overridden: true,
              editingLocation: false,
            }
          : q
      )
    );
  }, [uniqueRooms, resolveLocationSelection]);

  const persistQueuedBook = useCallback(async (row: QueuedBook) => {
    if (isGuest) {
      const mockId = `guest-book-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      onBookAdded({
        id: mockId,
        title: row.title,
        authors: row.authors,
        isbn: row.isbn,
        publisher: row.publisher,
        published_date: row.published_date,
        description: row.description,
        cover_url: row.cover_url,
        location: row.location,
        status: 'To Read',
        favorite: false,
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user session');

      const { data, error } = await supabase
        .from('books')
        .insert([{
          user_id: user.id,
          title: row.title,
          authors: row.authors,
          isbn: row.isbn || null,
          publisher: row.publisher || null,
          published_date: row.published_date || null,
          description: row.description || null,
          cover_url: row.cover_url || null,
          location_id: row.locationId || null,
          status: 'To Read',
        }])
        .select();

      if (error) throw error;

      onBookAdded({
        id: data && data[0] ? data[0].id : row.id,
        title: row.title,
        authors: row.authors,
        isbn: row.isbn,
        publisher: row.publisher,
        published_date: row.published_date,
        description: row.description,
        cover_url: row.cover_url,
        location: row.location,
        status: 'To Read',
        favorite: false,
      });
    } catch {
      console.warn('Failed to save queued book to Supabase, adding locally instead');
      const mockId = Math.random().toString(36).substring(7);
      onBookAdded({
        id: mockId,
        title: row.title,
        authors: row.authors,
        isbn: row.isbn,
        publisher: row.publisher,
        published_date: row.published_date,
        description: row.description,
        cover_url: row.cover_url,
        location: row.location,
        status: 'To Read',
        favorite: false,
      });
    }
  }, [supabase, onBookAdded, isGuest]);

  const saveQueueRow = useCallback(async (id: string) => {
    const row = queue.find((q) => q.id === id);
    if (!row) return;
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, rowState: 'saving' } : q)));
    await persistQueuedBook(row);
    setQueue((prev) => prev.filter((q) => q.id !== id));
    showToast(`Added "${row.title}" to your library`);
  }, [queue, persistQueuedBook, showToast]);

  const saveAllQueue = useCallback(async () => {
    if (queue.length === 0) return;
    const rows = queue;
    setQueue((prev) => prev.map((q) => ({ ...q, rowState: 'saving' })));
    await Promise.all(rows.map((row) => persistQueuedBook(row)));
    setQueue([]);
    showToast(`Added ${rows.length} book${rows.length === 1 ? '' : 's'} to your library`);
  }, [queue, persistQueuedBook, showToast]);

  return {
    queue,
    addResultToQueue,
    removeFromQueue,
    startEditLocation,
    cancelEditLocation,
    confirmLocation,
    saveQueueRow,
    saveAllQueue,
    setQueue,
  };
}
