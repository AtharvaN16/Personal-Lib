'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 className="display-serif" style={styles.title}>Something went wrong</h1>
        <p style={styles.text}>
          Sorry about that — something didn&apos;t load right. You can try again, or come back later.
        </p>
        <button onClick={reset} style={styles.button}>
          Try again
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100dvh',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backgroundColor: 'var(--bg-primary)',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px 32px',
    textAlign: 'center',
    backgroundColor: 'var(--bg-sheet)',
    boxShadow: '0 12px 35px rgba(17, 22, 37, 0.15)',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 500,
    color: 'var(--accent-primary)',
    marginBottom: '12px',
  },
  text: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    lineHeight: 1.5,
    marginBottom: '24px',
  },
  button: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    color: 'var(--bg-sheet)',
    padding: '10px 24px',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
