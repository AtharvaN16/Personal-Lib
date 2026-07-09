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
        style={styles.card}
      >
        <div style={styles.header}>
          <h1 className="display-serif" style={styles.title}>
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
                <label htmlFor="login-email" style={styles.label}>Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  className="field-white"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label htmlFor="login-password" style={styles.label}>Password</label>
                <input
                  id="login-password"
                  type="password"
                  className="field-white"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  style={styles.input}
                />
              </div>

              {/* Status notifications */}
              {message.text && (
                <div
                  style={{
                    ...styles.notification,
                    ...(message.type === 'success' ? styles.successNotify : styles.errorNotify),
                  }}
                >
                  <p>{message.text}</p>
                </div>
              )}

              <button
                type="submit"
                style={{ ...styles.submitBtn, opacity: loading ? 0.6 : 1 }}
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
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-instrument-sans), sans-serif',
        fontSize: '1rem'
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
    padding: '40px 32px 36px 32px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    backgroundColor: 'var(--bg-sheet)',
    borderRadius: '0px',
    border: 'none',
    boxShadow: '0 12px 35px rgba(17, 22, 37, 0.15)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 500,
    color: 'var(--accent-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
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
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  input: {
    padding: '10px 14px',
    fontSize: '0.95rem',
    borderRadius: '0px',
    width: '100%',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    color: 'var(--text-primary)',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    justifyContent: 'center',
    width: '100%',
    marginTop: '8px',
    padding: '10px 16px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  notification: {
    padding: '12px',
    fontSize: '0.85rem',
    lineHeight: '1.4',
    textAlign: 'center',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  successNotify: {
    backgroundColor: 'var(--accent-sage-light)',
    color: '#3d5242',
  },
  errorNotify: {
    backgroundColor: 'var(--accent-terracotta-light)',
    color: 'var(--error)',
  },
  footer: {
    textAlign: 'center',
    marginTop: '12px',
    borderTop: '1px solid rgba(17, 22, 37, 0.08)',
    paddingTop: '16px',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
};
