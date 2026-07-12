import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import Dashboard from '@/components/Dashboard';
import { Book } from '@/components/BookModal';
import { GUEST_BOOKS } from '@/lib/guestData';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isGuest = cookieStore.get('guest_session')?.value === 'true';

  if (!user && isGuest) {
    return <Dashboard isGuest={true} initialGuestBooks={GUEST_BOOKS} />;
  }

  if (!user) {
    redirect('/login');
  }

  return <Dashboard userEmail={user.email ?? null} />;
}
