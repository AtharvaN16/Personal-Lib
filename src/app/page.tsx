import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

export default async function Home() {
  const supabase = await createClient();
  
  // Verify the user session on the server
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div style={styles.container}>
      {/* Cozy Header */}
      <header style={styles.header}>
        <h1 className="handwritten" style={styles.logo}>
          Personal Library
        </h1>
        <div style={styles.headerRight}>
          <span style={styles.userEmail}>{user.email}</span>
          <LogoutButton />
        </div>
      </header>

      {/* Cozy Dashboard Workspace */}
      <main style={styles.main}>
        <div className="cozy-card" style={styles.welcomeCard}>
          <h2 className="handwritten" style={styles.welcomeTitle}>
            Welcome to your library!
          </h2>
          <p style={styles.welcomeText}>
            You have successfully authenticated your account. This is the starting point for cataloging your books and organizing your bookshelves.
          </p>

          <div style={styles.grid}>
            <div className="cozy-card" style={styles.actionItem}>
              <h3 className="handwritten" style={styles.itemTitle}>1. Set up shelves</h3>
              <p style={styles.itemDescription}>
                Configure your rooms and bookshelves (e.g., &ldquo;Living Room &rarr; Oak Shelf&rdquo;) so you always know where your books are.
              </p>
            </div>

            <div className="cozy-card" style={styles.actionItem}>
              <h3 className="handwritten" style={styles.itemTitle}>2. Catalog books</h3>
              <p style={styles.itemDescription}>
                Use your hardware barcode scanner or mobile camera to look up book details automatically and place them on your shelves.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%',
    padding: '0 24px 40px 24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 0',
    borderBottom: '2px solid var(--border-sketch)',
    marginBottom: '40px',
  },
  logo: {
    fontSize: '2.25rem',
    color: 'var(--text-coffee)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userEmail: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  main: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
  },
  welcomeCard: {
    padding: '40px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  welcomeTitle: {
    fontSize: '2.5rem',
    color: 'var(--accent-sage)',
  },
  welcomeText: {
    fontSize: '1.1rem',
    color: 'var(--text-coffee)',
    maxWidth: '700px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginTop: '16px',
  },
  actionItem: {
    padding: '24px',
    backgroundColor: 'var(--bg-parchment)',
    borderStyle: 'dashed',
  },
  itemTitle: {
    fontSize: '1.5rem',
    color: 'var(--accent-terracotta)',
    marginBottom: '8px',
  },
  itemDescription: {
    fontSize: '0.95rem',
    color: 'var(--text-coffee)',
  },
};
