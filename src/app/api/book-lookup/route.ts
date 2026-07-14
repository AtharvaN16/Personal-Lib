import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { fetchBookByIsbn, type BookLookupResult } from '@/lib/openLibrary';

const GUEST_DAILY_LOOKUP_LIMIT = 25;
const USER_DAILY_LOOKUP_LIMIT = 200;
const GUEST_LOOKUP_USAGE_COOKIE = 'guest_book_lookup_usage';

function normalizeIsbn(isbn: string | null): string {
  return (isbn || '').replace(/[\s-]/g, '').trim();
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function consumeGuestLookupQuota(cookieStore: Awaited<ReturnType<typeof cookies>>): {
  allowed: boolean;
  count: number;
} {
  const today = todayUtc();
  const stored = cookieStore.get(GUEST_LOOKUP_USAGE_COOKIE)?.value;
  let count = 0;

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { date?: string; count?: number };
      if (parsed.date === today && typeof parsed.count === 'number') {
        count = parsed.count;
      }
    } catch {
      count = 0;
    }
  }

  if (count >= GUEST_DAILY_LOOKUP_LIMIT) {
    return { allowed: false, count };
  }

  const nextCount = count + 1;
  cookieStore.set(GUEST_LOOKUP_USAGE_COOKIE, JSON.stringify({ date: today, count: nextCount }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 2,
  });

  return { allowed: true, count: nextCount };
}

function toLookupResult(row: {
  isbn: string;
  title: string;
  authors: string[];
  publisher: string | null;
  published_date: string | null;
  description: string | null;
  cover_url: string | null;
}): BookLookupResult {
  return {
    isbn: row.isbn,
    title: row.title,
    authors: row.authors,
    publisher: row.publisher,
    published_date: row.published_date,
    description: row.description,
    cover_url: row.cover_url,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = normalizeIsbn(searchParams.get('isbn'));

  if (!/^\d{10}(\d{3})?$/.test(isbn)) {
    return NextResponse.json({ error: 'Enter a valid 10 or 13 digit ISBN.' }, { status: 400 });
  }

  const supabase = await createClient();
  const cookieStore = await cookies();
  const isGuest = cookieStore.get('guest_session')?.value === 'true';

  const { data: cached } = await supabase
    .from('book_lookup_cache')
    .select('isbn, title, authors, publisher, published_date, description, cover_url')
    .eq('isbn', isbn)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({ book: toLookupResult(cached), source: 'cache' });
  }

  if (isGuest) {
    const quota = consumeGuestLookupQuota(cookieStore);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Daily scan lookup limit reached (${GUEST_DAILY_LOOKUP_LIMIT}/day). Sign in for a higher limit.`,
          limit: GUEST_DAILY_LOOKUP_LIMIT,
          count: quota.count,
        },
        { status: 429 }
      );
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to scan books.' }, { status: 401 });
    }

    const isSharvariNayak = 
      (user.email?.toLowerCase().includes('sharvari') && user.email?.toLowerCase().includes('nayak')) ||
      (user.user_metadata?.full_name?.toLowerCase().includes('sharvari') && user.user_metadata?.full_name?.toLowerCase().includes('nayak')) ||
      (user.user_metadata?.name?.toLowerCase().includes('sharvari') && user.user_metadata?.name?.toLowerCase().includes('nayak'));

    const userLimit = isSharvariNayak ? 500 : USER_DAILY_LOOKUP_LIMIT;

    const { data: quotaRows, error: quotaError } = await supabase.rpc('consume_book_lookup_quota', {
      p_lookup_date: todayUtc(),
      p_max_lookups: userLimit,
    });

    if (quotaError) {
      console.warn('Failed to consume book lookup quota:', quotaError);
      return NextResponse.json({ error: 'Could not check scan limit.' }, { status: 503 });
    }

    const quota = quotaRows?.[0];
    if (!quota?.allowed) {
      return NextResponse.json(
        {
          error: `Daily scan lookup limit reached (${userLimit}/day).`,
          limit: userLimit,
          count: quota?.lookup_count ?? userLimit,
        },
        { status: 429 }
      );
    }
  }

  const book = await fetchBookByIsbn(isbn);
  if (!book) {
    return NextResponse.json({ book: null }, { status: 404 });
  }

  await supabase
    .from('book_lookup_cache')
    .upsert({
      isbn,
      title: book.title,
      authors: book.authors,
      publisher: book.publisher,
      published_date: book.published_date,
      description: book.description,
      cover_url: book.cover_url,
      updated_at: new Date().toISOString(),
    });

  return NextResponse.json({ book: { ...book, isbn }, source: 'external' });
}
