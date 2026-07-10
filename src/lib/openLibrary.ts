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
  personal_name?: string;
  alternate_names?: string[];
}

interface OpenLibraryWorkResponse {
  description?: string | { value: string };
  // Work-level authors are shaped differently from edition-level ones ({ author: { key } } vs { key }).
  authors?: { author: { key: string } }[];
}

const LATIN_REGEX = /^[\p{Script=Latin}\s.,'()\-’]+$/u;

function isLatin(str: string): boolean {
  return LATIN_REGEX.test(str.trim());
}

async function fetchAuthorName(authorKey: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org${authorKey}.json`);
    if (!res.ok) return null;
    const data: OpenLibraryAuthorResponse = await res.json();

    // Prioritize Latin/English name representations to avoid native characters (e.g. Chinese, Cyrillic)
    if (data.personal_name && isLatin(data.personal_name)) {
      return data.personal_name;
    }
    if (data.name && isLatin(data.name)) {
      return data.name;
    }
    if (data.alternate_names) {
      for (const alt of data.alternate_names) {
        if (isLatin(alt)) {
          return alt;
        }
      }
    }

    return data.personal_name || data.name || null;
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
    // Unauthenticated requests share a global daily quota across every anonymous caller on the
    // internet and are effectively always exhausted — a free key raises this app's own limit to
    // 1000/day. See https://console.cloud.google.com/apis/credentials (restrict by HTTP referrer).
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&hl=en${apiKey ? `&key=${apiKey}` : ''}`;
    const res = await fetch(url);
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
 * Amazon's legacy cover endpoint returns HTTP 200 with a ~43-byte placeholder GIF for ISBNs it
 * has no art for, rather than a 404 — so a missing cover has to be detected by response size.
 */
async function fetchAmazonCover(isbn: string): Promise<string | null> {
  try {
    const url = `https://images-na.ssl-images-amazon.com/images/P/${isbn}.jpg`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size < 1000) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Looks up a book by ISBN via the Open Library API, falling back to Google Books for missing
 * metadata/covers, then to Amazon's legacy cover endpoint, then to Open Library's own ISBN-keyed
 * cover lookup as a last resort. Returns null when the ISBN isn't found in either database.
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

      // -1 is Open Library's sentinel for a flagged/removed cover — it resolves to a broken
      // image, so skip past it to the first real (positive) cover id.
      const coverId = data.covers?.find(id => id > 0);
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

  // Prefer whichever source has metadata; Open Library wins if both found the book since its
  // records tend to be more complete (descriptions, publishers, etc).
  const metadata = openLibraryResult || googleResult;
  if (!metadata) return null;

  const coverUrl =
    googleResult?.cover_url ||
    (await fetchAmazonCover(isbn)) ||
    `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

  return { ...metadata, isbn, cover_url: coverUrl };
}
