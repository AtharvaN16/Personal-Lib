'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Book } from '@/components/BookModal';
import { GUEST_DATA_VERSION, GUEST_SHELVES } from '@/lib/guestData';

export function useBooks(isGuest: boolean = false, initialGuestBooks: Book[] = []) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Load books from Supabase or localStorage guest mode
  const refetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isGuest) {
        const stored = localStorage.getItem('guest_books');
        if (stored) {
          setBooks(JSON.parse(stored));
        } else if (initialGuestBooks && initialGuestBooks.length > 0) {
          setBooks(initialGuestBooks);
          localStorage.setItem('guest_books', JSON.stringify(initialGuestBooks));
        }
      } else {
        // Logged-in Supabase fetch
        const { data, error: fetchErr } = await supabase
          .from('books')
          .select('*, location:location_id(room, bookshelf)');

        if (fetchErr) {
          setError(fetchErr.message);
          console.error('Failed to load books:', fetchErr);
        } else if (data) {
          interface SupabaseBookRow {
            id: string;
            user_id: string;
            title: string;
            authors: string[] | null;
            isbn: string | null;
            publisher: string | null;
            published_date: string | null;
            description: string | null;
            cover_url: string | null;
            location_id: string | null;
            status: string;
            favorite: boolean;
            notes: string | null;
            created_at: string;
            genres?: string[];
            location: { room: string; bookshelf: string } | null;
          }

          const formatted: Book[] = (data as unknown as SupabaseBookRow[]).map((b) => ({
            id: b.id,
            title: b.title,
            authors: b.authors || [],
            isbn: b.isbn,
            publisher: b.publisher,
            published_date: b.published_date,
            description: b.description,
            cover_url: b.cover_url,
            location: b.location ? { room: b.location.room, bookshelf: b.location.bookshelf } : null,
            status: b.status as Book['status'],
            favorite: b.favorite,
            notes: b.notes,
            genres: b.genres || [],
          }));
          setBooks(formatted);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load books';
      setError(msg);
      console.error('Error loading books:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, isGuest, initialGuestBooks]);

  useEffect(() => {
    if (isGuest) {
      // Reseed everything when the curated guest catalog/shelf set has changed since this
      // browser last cached it, so guests don't get stuck on data from an older version.
      const isStale = localStorage.getItem('guest_data_version') !== GUEST_DATA_VERSION;
      if (isStale) {
        localStorage.removeItem('guest_books');
        localStorage.removeItem('guest_shelves');
        localStorage.setItem('guest_data_version', GUEST_DATA_VERSION);
      }

      if (!localStorage.getItem('guest_shelves')) {
        localStorage.setItem('guest_shelves', JSON.stringify(GUEST_SHELVES));
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetchBooks();
  }, [refetchBooks, isGuest]);

  // Update book status
  const updateBookStatus = useCallback(async (id: string, status: Book['status']) => {
    if (isGuest) {
      setBooks((prev) => {
        const updated = prev.map((b) => (b.id === id ? { ...b, status } : b));
        localStorage.setItem('guest_books', JSON.stringify(updated));
        return updated;
      });
      return;
    }

    const { error: updateErr } = await supabase
      .from('books')
      .update({ status })
      .eq('id', id);

    if (updateErr) {
      console.error('Failed to update book status:', updateErr);
      throw new Error(updateErr.message);
    }

    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }, [isGuest, supabase]);

  // Toggle book favorite status
  const toggleBookFavorite = useCallback(async (id: string, favorite: boolean) => {
    if (isGuest) {
      setBooks((prev) => {
        const updated = prev.map((b) => (b.id === id ? { ...b, favorite } : b));
        localStorage.setItem('guest_books', JSON.stringify(updated));
        return updated;
      });
      return;
    }

    const { error: updateErr } = await supabase
      .from('books')
      .update({ favorite })
      .eq('id', id);

    if (updateErr) {
      console.error('Failed to toggle book favorite:', updateErr);
      throw new Error(updateErr.message);
    }

    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, favorite } : b)));
  }, [isGuest, supabase]);

  // Update book title and authors details
  const updateBookDetails = useCallback(async (id: string, title: string, authors: string[]) => {
    if (isGuest) {
      setBooks((prev) => {
        const updated = prev.map((b) => (b.id === id ? { ...b, title, authors } : b));
        localStorage.setItem('guest_books', JSON.stringify(updated));
        return updated;
      });
      return;
    }

    const { error: updateErr } = await supabase
      .from('books')
      .update({ title, authors })
      .eq('id', id);

    if (updateErr) {
      console.error('Failed to update book details:', updateErr);
      throw new Error(updateErr.message);
    }

    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, title, authors } : b)));
  }, [isGuest, supabase]);

  // Delete books (individual or bulk)
  const deleteBooks = useCallback(async (ids: string[]) => {
    const isMultiple = ids.length > 1;
    setBooks((prev) => {
      const updated = prev.filter((b) => !ids.includes(b.id));
      if (isGuest) {
        try {
          localStorage.setItem('guest_books', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save guest deletion:', e);
        }
      }
      return updated;
    });

    if (isGuest) return;

    // Use .in() or .eq() depending on counts
    const query = supabase.from('books').delete();
    const { error: deleteErr } = isMultiple ? await query.in('id', ids) : await query.eq('id', ids[0]);

    if (deleteErr) {
      console.error('Failed to delete book(s):', deleteErr);
      throw new Error(deleteErr.message);
    }
  }, [isGuest, supabase]);

  // Move books location (individual or bulk)
  const moveBooks = useCallback(async (
    ids: string[],
    locationId: string,
    locationObj: Book['location']
  ) => {
    const isMultiple = ids.length > 1;
    if (isGuest) {
      setBooks((prev) => {
        const updated = prev.map((b) => (ids.includes(b.id) ? { ...b, location: locationObj } : b));
        localStorage.setItem('guest_books', JSON.stringify(updated));
        return updated;
      });
      return;
    }

    const locationIdVal = locationId === '' || locationId === 'unassigned' ? null : locationId;
    const query = supabase.from('books').update({ location_id: locationIdVal });
    const { error: updateErr } = isMultiple ? await query.in('id', ids) : await query.eq('id', ids[0]);

    if (updateErr) {
      console.error('Failed to update location for book(s):', updateErr);
      throw new Error(updateErr.message);
    }

    setBooks((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, location: locationObj } : b)));
  }, [isGuest, supabase]);

  // Add a book (individual)
  const addBook = useCallback(async (book: Omit<Book, 'id'>, locationId?: string) => {
    if (isGuest) {
      const newBook: Book = {
        ...book,
        id: `guest-book-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };
      setBooks((prev) => {
        const updated = [newBook, ...prev];
        try {
          localStorage.setItem('guest_books', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save guest book:', e);
        }
        return updated;
      });
      return newBook;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user session');

    const { data, error: insertErr } = await supabase
      .from('books')
      .insert([{
        user_id: user.id,
        title: book.title,
        authors: book.authors,
        isbn: book.isbn || null,
        publisher: book.publisher || null,
        published_date: book.published_date || null,
        description: book.description || null,
        cover_url: book.cover_url || null,
        location_id: locationId || null,
        status: book.status || 'To Read',
        favorite: book.favorite || false,
      }])
      .select();

    if (insertErr) {
      console.error('Failed to save book to Supabase:', insertErr);
      throw insertErr;
    }

    if (!data || !data[0]) {
      throw new Error('Failed to insert book');
    }

    const formatted: Book = {
      ...data[0],
      location: data[0].location_id ? book.location : null,
      authors: data[0].authors || [],
      genres: data[0].genres || [],
    };

    setBooks((prev) => [formatted, ...prev]);
    return formatted;
  }, [isGuest, supabase]);

  return {
    books,
    loading,
    error,
    updateBookStatus,
    toggleBookFavorite,
    updateBookDetails,
    deleteBooks,
    moveBooks,
    addBook,
    setBooks,
    refetchBooks,
  };
}
