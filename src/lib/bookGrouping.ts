import { Book } from '@/components/BookModal';

export interface RoomGrouping {
  /** Distinct bookshelf names within the room, in first-seen order. */
  bookshelves: string[];
  /** Books in the room, keyed by bookshelf name (only shelves with >=1 book are present). */
  booksByShelf: Record<string, Book[]>;
  /** Books in the room with no bookshelf assigned. */
  unassignedBooks: Book[];
}

/** Groups a room's books by bookshelf, matching the room-filter view's existing behavior. */
export function groupBooksByRoom(books: Book[], room: string): RoomGrouping {
  const allBooksInRoom = books.filter(b => b.location?.room === room);

  const bookshelves = Array.from(
    new Set(allBooksInRoom.map(b => b.location?.bookshelf).filter((s): s is string => Boolean(s)))
  );

  const booksByShelf: Record<string, Book[]> = {};
  for (const shelf of bookshelves) {
    booksByShelf[shelf] = allBooksInRoom.filter(b => b.location?.bookshelf === shelf);
  }

  const unassignedBooks = allBooksInRoom.filter(b => !b.location?.bookshelf);

  return { bookshelves, booksByShelf, unassignedBooks };
}
