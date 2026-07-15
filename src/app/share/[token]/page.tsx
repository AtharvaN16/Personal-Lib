import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import PublicLibrary from '@/components/PublicLibrary';
import { Book } from '@/components/BookModal';
import { Shelf } from '@/lib/hooks/useLocations';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, theme_color, share_enabled')
    .eq('share_token', token)
    .maybeSingle();

  if (!profile || !profile.share_enabled) {
    notFound();
  }

  const { data: booksData } = await supabase
    .from('books')
    .select('*, location:location_id(room, bookshelf)')
    .eq('user_id', profile.user_id);

  const { data: shelvesData } = await supabase
    .from('shelves')
    .select('id, room, bookshelf')
    .eq('user_id', profile.user_id)
    .order('room');

  const books: Book[] = (booksData || []).map((b) => ({
    id: b.id,
    title: b.title,
    authors: b.authors || [],
    isbn: b.isbn,
    publisher: b.publisher,
    published_date: b.published_date,
    description: b.description,
    cover_url: b.cover_url,
    location: b.location ? { room: b.location.room, bookshelf: b.location.bookshelf } : null,
    status: b.status,
  }));

  const shelves: Shelf[] = shelvesData || [];

  return (
    <PublicLibrary
      books={books}
      shelves={shelves}
      accentColor={profile.theme_color || '#002CBC'}
    />
  );
}
