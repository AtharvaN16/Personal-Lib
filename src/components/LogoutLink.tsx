'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutLink() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button 
      onClick={handleLogout} 
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        fontFamily: 'var(--font-instrument-sans), sans-serif',
        fontSize: '1rem',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        transition: 'color 0.2s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
    >
      Logout
    </button>
  );
}
