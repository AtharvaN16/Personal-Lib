'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const errorMsg = searchParams.get('error');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | null }>(
    errorMsg ? { text: errorMsg, type: 'error' } : { text: '', type: null }
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: null });

    try {
      if (isSignUp) {
        // Sign Up Flow
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        // If email confirmation is enabled, user will need to confirm email
        if (data.user && data.session === null) {
          setMessage({
            text: 'Check your email for a verification link to complete sign up!',
            type: 'success',
          });
        } else {
          router.push('/');
          router.refresh();
        }
      } else {
        // Sign In Flow
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      setMessage({
        text: err instanceof Error ? err.message : 'An error occurred during authentication.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.backgroundBlob1} />
      <div style={styles.backgroundBlob2} />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="cozy-card"
        style={styles.card}
      >
        {/* Sketchy Handdrawn Title */}
        <div style={styles.header}>
          <h1 className="handwritten" style={styles.title}>
            Personal Library
          </h1>
          <p style={styles.subtitle}>Catalog your books & organize your shelves</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={isSignUp ? 'signup' : 'login'}
            initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
            transition={{ duration: 0.25 }}
          >
            <form onSubmit={handleAuth} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  className="input-cozy"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  className="input-cozy"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Status notifications */}
              {message.text && (
                <div
                  style={{
                    ...styles.notification,
                    ...(message.type === 'success' ? styles.successNotify : styles.errorNotify),
                  }}
                  className="sketch-border"
                >
                  <p>{message.text}</p>
                </div>
              )}

              <button
                type="submit"
                className="btn-cozy btn-cozy-primary"
                style={styles.submitBtn}
                disabled={loading}
              >
                {loading ? 'Working on it...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          </motion.div>
        </AnimatePresence>

        <div style={styles.footer}>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage({ text: '', type: null });
            }}
            style={styles.toggleBtn}
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-caveat), cursive',
        fontSize: '2rem'
      }}>
        Loading...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

// Inline styles for layouts, overlaying cozy styling tokens defined in globals.css
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flex: 1,
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundBlob1: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    width: '40vw',
    height: '40vw',
    backgroundColor: '#E8ECE9', // Soft sage tint
    borderRadius: '50%',
    filter: 'blur(80px)',
    zIndex: -1,
  },
  backgroundBlob2: {
    position: 'absolute',
    bottom: '-10%',
    right: '-10%',
    width: '35vw',
    height: '35vw',
    backgroundColor: '#F7EAE6', // Soft terracotta tint
    borderRadius: '50%',
    filter: 'blur(80px)',
    zIndex: -1,
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px 32px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '3rem',
    color: 'var(--text-coffee)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-coffee)',
  },
  submitBtn: {
    justifyContent: 'center',
    width: '100%',
    marginTop: '8px',
    fontSize: '1rem',
  },
  notification: {
    padding: '12px',
    fontSize: '0.85rem',
    lineHeight: '1.4',
    textAlign: 'center',
  },
  successNotify: {
    backgroundColor: 'var(--accent-sage-light)',
    borderColor: 'var(--accent-sage)',
    color: '#3d5242',
  },
  errorNotify: {
    backgroundColor: 'var(--accent-terracotta-light)',
    borderColor: 'var(--accent-terracotta)',
    color: '#823725',
  },
  footer: {
    textAlign: 'center',
    marginTop: '12px',
    borderTop: '1px dashed var(--border-sketch)',
    paddingTop: '16px',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
