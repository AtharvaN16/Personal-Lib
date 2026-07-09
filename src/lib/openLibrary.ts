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

/**
 * Looks up a book by ISBN via the Open Library API (no API key required).
 * Returns null when the ISBN isn't found so callers can show a "not found" state.
 */
export async function fetchBookByIsbn(isbn: string): Promise<BookLookupResult | null> {
  const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Library lookup failed (${res.status})`);

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

  return {
    title: data.title,
    authors: authorNames.filter((n): n is string => Boolean(n)),
    isbn,
    publisher: data.publishers?.[0] || null,
    published_date: data.publish_date || null,
    description: workDetails.description,
    cover_url: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
  };
}
