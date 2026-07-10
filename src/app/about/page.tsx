import Link from 'next/link';

const linkStyle: React.CSSProperties = {
  fontStyle: 'italic',
  fontFamily: 'var(--font-newsreader), Georgia, serif',
  color: 'var(--accent-primary)',
  textDecoration: 'underline wavy var(--accent-primary)',
  textDecorationThickness: '1.5px',
  textUnderlineOffset: '4px',
};

export default function AboutPage() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p className="display-serif" style={styles.text}>
          Made by Atharva. See more of my work at{' '}
          <a href="https://atharvanayak.design" target="_blank" rel="noopener noreferrer" style={linkStyle}>
            atharvanayak.design
          </a>
          , or say hello at{' '}
          <a href="mailto:atharvanayak16@gmail.com" style={linkStyle}>
            atharvanayak16@gmail.com
          </a>
          .
        </p>
        <Link href="/" className="nav-link" style={styles.backLink}>
          ← Back to library
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    maxWidth: '560px',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    textAlign: 'center',
  },
  text: {
    fontSize: '22px',
    lineHeight: '1.6',
    color: 'var(--text-primary)',
    fontWeight: 'normal',
  },
  backLink: {
    fontSize: '0.95rem',
  },
};
