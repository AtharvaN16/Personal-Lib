'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';

const linkStyle: React.CSSProperties = {
  fontStyle: 'italic',
  fontFamily: 'var(--font-newsreader), Georgia, serif',
  color: 'var(--accent-primary)',
  textDecoration: 'underline wavy var(--accent-primary)',
  textDecorationThickness: '1.5px',
  textUnderlineOffset: '4px',
  display: 'inline-block',
};

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

const backLinkVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut', delay: 0.7 },
  },
};

/** Splits plain text into per-word motion.spans, matching the hero's blurIn word stagger. */
function AnimatedWords({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((segment, idx) =>
        /^\s+$/.test(segment) ? (
          <span key={idx}>{segment}</span>
        ) : (
          <motion.span key={idx} variants={wordVariants} style={{ display: 'inline-block' }}>
            {segment}
          </motion.span>
        )
      )}
    </>
  );
}

export default function AboutPage() {
  return (
    <div style={styles.page}>
      <motion.div
        style={styles.card}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <p className="display-serif hero-title-mobile" style={styles.text}>
          <AnimatedWords text="Made by Atharva. See more of my work at " />
          <motion.a
            variants={wordVariants}
            href="https://atharvanayak.design"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            atharvanayak.design
          </motion.a>
          <AnimatedWords text=", or say hello at " />
          <motion.a variants={wordVariants} href="mailto:atharvanayak16@gmail.com" style={linkStyle}>
            atharvanayak16@gmail.com
          </motion.a>
          <AnimatedWords text="." />
        </p>

        <motion.div variants={backLinkVariants}>
          <Link href="/" className="nav-link" style={styles.backLink}>
            Back to library
          </Link>
        </motion.div>
      </motion.div>
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
    maxWidth: '840px',
    display: 'flex',
    flexDirection: 'column',
    gap: '56px',
    textAlign: 'center',
  },
  text: {
    fontSize: '32px',
    lineHeight: '1.5',
    color: 'var(--text-primary)',
    fontWeight: 'normal',
  },
  backLink: {
    fontSize: '0.95rem',
  },
};
