'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Signs out of Supabase and navigates back to /login. Shared by the desktop AccountMenu and the mobile menu. */
export function useLogout() {
  const router = useRouter();
  const supabase = createClient();

  return async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };
}
