'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Shelf {
  id: string;
  room: string;
  bookshelf: string;
}

export function useLocations(isGuest: boolean = false) {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [bookCounts, setBookCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isGuest) {
        const storedShelves = localStorage.getItem('guest_shelves');
        const guestShelves = storedShelves ? JSON.parse(storedShelves) : [];
        setShelves(guestShelves);

        const storedBooks = localStorage.getItem('guest_books');
        const guestBooks = storedBooks ? JSON.parse(storedBooks) : [];
        const counts: Record<string, number> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        guestBooks.forEach((b: any) => {
          if (b.location) {
            const match = guestShelves.find(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (s: any) => s.room === b.location.room && s.bookshelf === b.location.bookshelf
            );
            if (match) {
              counts[match.id] = (counts[match.id] || 0) + 1;
            }
          }
        });
        setBookCounts(counts);
        return;
      }

      // Logged-in Supabase load
      const { data: shelvesData, error: shelvesErr } = await supabase
        .from('shelves')
        .select('id, room, bookshelf')
        .order('room');

      if (shelvesErr) throw shelvesErr;
      setShelves(shelvesData || []);

      const { data: booksData, error: booksErr } = await supabase.from('books').select('location_id');
      if (booksErr) throw booksErr;

      const counts: Record<string, number> = {};
      if (booksData) {
        booksData.forEach((b: { location_id: string | null }) => {
          if (b.location_id) {
            counts[b.location_id] = (counts[b.location_id] || 0) + 1;
          }
        });
      }
      setBookCounts(counts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load locations';
      setError(msg);
      console.error('Error loading locations:', err);
    } finally {
      setLoading(false);
    }
  }, [isGuest, supabase]);

  // Load on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLocations();
  }, [loadLocations]);

  // Add location
  const addLocation = useCallback(async (room: string, bookshelf: string) => {
    const trimmedRoom = room.trim();
    const trimmedShelf = bookshelf.trim();

    if (isGuest) {
      const newShelf: Shelf = {
        id: `guest-shelf-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        room: trimmedRoom,
        bookshelf: trimmedShelf,
      };

      setShelves((prev) => {
        const updated = [...prev, newShelf];
        localStorage.setItem('guest_shelves', JSON.stringify(updated));
        return updated;
      });
      return newShelf;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user session');

    // Duplicate check
    const { data: existing } = await supabase
      .from('shelves')
      .select('*')
      .eq('room', trimmedRoom)
      .eq('bookshelf', trimmedShelf)
      .eq('user_id', user.id);

    if (existing && existing.length > 0) {
      throw new Error('This bookshelf in this room already exists!');
    }

    const { data, error: insertErr } = await supabase
      .from('shelves')
      .insert([{ room: trimmedRoom, bookshelf: trimmedShelf, user_id: user.id }])
      .select();

    if (insertErr) throw insertErr;
    if (!data || !data[0]) throw new Error('Failed to insert location');

    setShelves((prev) => [...prev, data[0]]);
    return data[0] as Shelf;
  }, [isGuest, supabase]);

  // Delete location (single shelf)
  const deleteLocation = useCallback(async (id: string) => {
    const shelfToDelete = shelves.find((s) => s.id === id);

    if (isGuest) {
      const updatedShelves = shelves.filter((s) => s.id !== id);
      setShelves(updatedShelves);
      localStorage.setItem('guest_shelves', JSON.stringify(updatedShelves));

      if (shelfToDelete) {
        const storedBooks = localStorage.getItem('guest_books');
        if (storedBooks) {
          const guestBooks = JSON.parse(storedBooks);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatedBooks = guestBooks.map((b: any) => {
            if (
              b.location &&
              b.location.room === shelfToDelete.room &&
              b.location.bookshelf === shelfToDelete.bookshelf
            ) {
              return { ...b, location: null };
            }
            return b;
          });
          localStorage.setItem('guest_books', JSON.stringify(updatedBooks));
        }
      }
      return;
    }

    const { error: deleteErr } = await supabase.from('shelves').delete().eq('id', id);
    if (deleteErr) throw deleteErr;

    setShelves((prev) => prev.filter((s) => s.id !== id));
  }, [isGuest, shelves, supabase]);

  // Delete room (all shelves in room)
  const deleteRoom = useCallback(async (room: string) => {
    if (isGuest) {
      const updatedShelves = shelves.filter((s) => s.room !== room);
      setShelves(updatedShelves);
      localStorage.setItem('guest_shelves', JSON.stringify(updatedShelves));

      const storedBooks = localStorage.getItem('guest_books');
      if (storedBooks) {
        const guestBooks = JSON.parse(storedBooks);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedBooks = guestBooks.map((b: any) => {
          if (b.location && b.location.room === room) {
            return { ...b, location: null };
          }
          return b;
        });
        localStorage.setItem('guest_books', JSON.stringify(updatedBooks));
      }
      return;
    }

    const { error: deleteErr } = await supabase.from('shelves').delete().eq('room', room);
    if (deleteErr) throw deleteErr;

    setShelves((prev) => prev.filter((s) => s.room !== room));
  }, [isGuest, shelves, supabase]);

  // Bulk save changes (renames + insertions)
  const saveBulkChanges = useCallback(async (
    roomDrafts: Record<string, string>,
    shelfDrafts: Record<string, string>,
    newShelves: { room: string; bookshelf: string }[]
  ) => {
    const updatedShelves = shelves.map((s) => ({
      ...s,
      room: (roomDrafts[s.room] ?? s.room).trim() || s.room,
      bookshelf: (shelfDrafts[s.id] ?? s.bookshelf).trim(),
    }));

    if (isGuest) {
      const inserts = newShelves.map((n, i) => ({
        id: `guest-shelf-${Date.now()}-${i}`,
        room: (roomDrafts[n.room] ?? n.room).trim() || n.room,
        bookshelf: n.bookshelf.trim(),
      }));

      const finalShelves = [...updatedShelves, ...inserts];
      localStorage.setItem('guest_shelves', JSON.stringify(finalShelves));

      // Sync renames back to guest books
      const storedBooks = localStorage.getItem('guest_books');
      if (storedBooks) {
        const guestBooks = JSON.parse(storedBooks);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedBooks = guestBooks.map((b: any) => {
          if (!b.location) return b;

          let room = b.location.room;
          const roomRename = roomDrafts[room];
          if (roomRename !== undefined && roomRename.trim()) {
            room = roomRename.trim();
          }

          let bookshelf = b.location.bookshelf;
          const shelf = shelves.find((s) => s.room === b.location.room && s.bookshelf === b.location.bookshelf);
          if (shelf) {
            const shelfRename = shelfDrafts[shelf.id];
            if (shelfRename !== undefined) {
              bookshelf = shelfRename.trim();
            }
          }

          return {
            ...b,
            location: { room, bookshelf },
          };
        });
        localStorage.setItem('guest_books', JSON.stringify(updatedBooks));
      }

      setShelves(finalShelves);
      return;
    }

    // DB Mode saves
    const rooms = Array.from(new Set(shelves.map((s) => s.room)));
    const roomRenames = rooms.filter((r) => roomDrafts[r] && roomDrafts[r].trim() && roomDrafts[r].trim() !== r);
    await Promise.all(
      roomRenames.map((oldRoom) =>
        supabase.from('shelves').update({ room: roomDrafts[oldRoom].trim() }).eq('room', oldRoom)
      )
    );

    const shelfRenames = shelves.filter((s) => {
      const draft = shelfDrafts[s.id];
      return draft !== undefined && draft.trim() !== s.bookshelf;
    });
    await Promise.all(
      shelfRenames.map((s) => supabase.from('shelves').update({ bookshelf: shelfDrafts[s.id].trim() }).eq('id', s.id))
    );

    if (newShelves.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      const rows = newShelves.map((n) => ({
        room: (roomDrafts[n.room] ?? n.room).trim() || n.room,
        bookshelf: n.bookshelf.trim(),
        user_id: user?.id,
      }));
      const { data, error: insertErr } = await supabase.from('shelves').insert(rows).select();
      if (insertErr) throw insertErr;
      if (data) {
        setShelves((prev) => [...prev, ...data]);
      }
    }

    await loadLocations();
  }, [isGuest, shelves, supabase, loadLocations]);

  return {
    shelves,
    bookCounts,
    loading,
    error,
    addLocation,
    deleteLocation,
    deleteRoom,
    saveBulkChanges,
    loadLocations,
  };
}
