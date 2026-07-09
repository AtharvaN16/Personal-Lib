'use client';

import { useLogout } from '@/hooks/useLogout';

export default function LogoutLink() {
  const logout = useLogout();

  return (
    <button
      onClick={logout}
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
