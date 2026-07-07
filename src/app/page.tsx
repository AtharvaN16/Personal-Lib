import { createClient } from '@/lib/supabase/server';
import LogoutLink from '@/components/LogoutLink';

export default async function Home() {
  const supabase = await createClient();
  
  // Verify user session in background
  await supabase.auth.getUser();

  return (
    <div className="page-container" style={styles.frame}>
      {/* Design Header */}
      <header style={styles.header}>
        <div style={styles.leftNav}>
          <a href="#" className="nav-link">Catalog</a>
          <a href="#" className="nav-link">Search</a>
        </div>
        
        <h1 className="handwritten" style={styles.logo}>
          My Personal Library
        </h1>
        
        <div style={styles.rightNav}>
          <LogoutLink />
        </div>
      </header>

      {/* Blank Canvas Area */}
      <main style={styles.main}>
        {/* Working with a blank canvas underneath */}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    padding: '30px 40px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: '20px',
  },
  leftNav: {
    display: 'flex',
    gap: '30px',
    flex: 1,
  },
  logo: {
    fontSize: '2.5rem',
    color: 'var(--accent-primary)', // #002CBC
    fontWeight: 'normal',
    textAlign: 'center',
    flex: 1,
  },
  rightNav: {
    display: 'flex',
    justifyContent: 'flex-end',
    flex: 1,
  },
  main: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
