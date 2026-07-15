import { Book } from '@/components/BookModal';

export const normalizeQuery = (query: string) => query.toLowerCase().trim().replace(/\s+/g, ' ');

export const bookMatchesQuery = (book: Book, normalizedQuery: string) => {
  if (!normalizedQuery) return true;
  return (
    book.title.toLowerCase().includes(normalizedQuery) ||
    book.authors.some(a => a.toLowerCase().includes(normalizedQuery))
  );
};
