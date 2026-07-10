import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import Dashboard from '@/components/Dashboard';
import { Book } from '@/components/BookModal';

interface GoogleBookVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    imageLinks?: {
      thumbnail?: string;
    };
    categories?: string[];
  };
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isGuest = cookieStore.get('guest_session')?.value === 'true';

  if (!user && isGuest) {
    let parsedBooks: Book[] = [];
    try {
      const res = await fetch(
        'https://www.googleapis.com/books/v1/volumes?q=subject:fiction&maxResults=10&langRestrict=en',
        { next: { revalidate: 86400 } }
      );
      if (res.ok) {
        const data = await res.json();
        const items: GoogleBookVolume[] = data.items || [];
        parsedBooks = items.map((item) => {
          const info = item.volumeInfo || {};
          const industryIdentifiers = info.industryIdentifiers || [];
          const isbnObj = industryIdentifiers.find((id) => id.type === 'ISBN_13') || industryIdentifiers.find((id) => id.type === 'ISBN_10');
          
          let coverUrl = info.imageLinks?.thumbnail || null;
          if (coverUrl && coverUrl.startsWith('http://')) {
            coverUrl = coverUrl.replace('http://', 'https://');
          }

          return {
            id: item.id,
            title: info.title || 'Untitled Book',
            authors: info.authors || [],
            isbn: isbnObj ? isbnObj.identifier : null,
            publisher: info.publisher || null,
            published_date: info.publishedDate || null,
            description: info.description || null,
            cover_url: coverUrl,
            location: null,
            genres: info.categories || [],
            status: 'To Read',
            notes: null,
            favorite: false,
          };
        });
      }
    } catch (err) {
      console.error('Failed to fetch guest books from Google Books API:', err);
    }

    return <Dashboard isGuest={true} initialGuestBooks={parsedBooks} />;
  }

  if (!user) {
    redirect('/login');
  }

  return <Dashboard />;
}
