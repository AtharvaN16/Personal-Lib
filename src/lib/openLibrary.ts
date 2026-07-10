export interface BookLookupResult {
  title: string;
  authors: string[];
  isbn: string;
  publisher: string | null;
  published_date: string | null;
  description: string | null;
  cover_url: string | null;
}

interface OpenLibraryIsbnResponse {
  title: string;
  authors?: { key: string }[];
  publishers?: string[];
  publish_date?: string;
  covers?: number[];
  works?: { key: string }[];
}

interface OpenLibraryAuthorResponse {
  name: string;
}

interface OpenLibraryWorkResponse {
  description?: string | { value: string };
  // Work-level authors are shaped differently from edition-level ones ({ author: { key } } vs { key }).
  authors?: { author: { key: string } }[];
}

async function fetchAuthorName(authorKey: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org${authorKey}.json`);
    if (!res.ok) return null;
    const data: OpenLibraryAuthorResponse = await res.json();
    return data.name || null;
  } catch {
    return null;
  }
}

interface WorkDetails {
  description: string | null;
  authorKeys: string[];
}

async function fetchWorkDetails(workKey: string): Promise<WorkDetails> {
  try {
    const res = await fetch(`https://openlibrary.org${workKey}.json`);
    if (!res.ok) return { description: null, authorKeys: [] };
    const data: OpenLibraryWorkResponse = await res.json();

    const description = !data.description
      ? null
      : typeof data.description === 'string' ? data.description : data.description.value;

    const authorKeys = (data.authors || []).map(a => a.author?.key).filter((k): k is string => Boolean(k));

    return { description, authorKeys };
  } catch {
    return { description: null, authorKeys: [] };
  }
}

async function fetchBookFromGoogle(isbn: string): Promise<BookLookupResult | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

    const volumeInfo = data.items[0].volumeInfo;
    const coverUrl = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || null;

    return {
      title: volumeInfo.title,
      authors: volumeInfo.authors || [],
      isbn,
      publisher: volumeInfo.publisher || null,
      published_date: volumeInfo.publishedDate || null,
      description: volumeInfo.description || null,
      cover_url: coverUrl ? coverUrl.replace('http://', 'https://') : null,
    };
  } catch (err) {
    console.warn('Google Books fallback query failed:', err);
    return null;
  }
}

/**
 * Looks up a book by ISBN via the Open Library API, with an automatic fallback to Google Books API
 * to salvage missing covers or handle missing edition records.
 * Returns null when the ISBN isn't found in either database.
 */
export async function fetchBookByIsbn(isbn: string): Promise<BookLookupResult | null> {
  let openLibraryResult: BookLookupResult | null = null;

  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (res.ok) {
      const data: OpenLibraryIsbnResponse = await res.json();

      const workDetails = data.works?.[0]?.key
        ? await fetchWorkDetails(data.works[0].key)
        : { description: null, authorKeys: [] };

      // Many classic/public-domain editions don't list authors on the edition record itself —
      // only on the work record — so fall back to that when the edition has none.
      const editionAuthorKeys = (data.authors || []).map(a => a.key);
      const authorKeys = editionAuthorKeys.length > 0 ? editionAuthorKeys : workDetails.authorKeys;
      const authorNames = await Promise.all(authorKeys.map(fetchAuthorName));

      const coverId = data.covers?.[0];
      const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;

      openLibraryResult = {
        title: data.title,
        authors: authorNames.filter((n): n is string => Boolean(n)),
        isbn,
        publisher: data.publishers?.[0] || null,
        published_date: data.publish_date || null,
        description: workDetails.description,
        cover_url: coverUrl,
      };
    }
  } catch (err) {
    console.warn('Open Library lookup encountered an error, trying Google Books:', err);
  }

  // If Open Library succeeded and has a cover, return it immediately
  if (openLibraryResult && openLibraryResult.cover_url) {
    return openLibraryResult;
  }

  // Otherwise, query Google Books to try to find the book or salvage a cover
  const googleResult = await fetchBookFromGoogle(isbn);

  if (googleResult) {
    if (openLibraryResult) {
      // Open Library succeeded but had no cover — combine Open Library metadata with Google's cover
      return {
        ...openLibraryResult,
        cover_url: googleResult.cover_url,
      };
    }
    // Open Library missed the book entirely — use the Google Books result
    return googleResult;
  }

  // If Google Books also has no record, return whatever Open Library found (even without a cover)
  return openLibraryResult;
}
