'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

interface ShareLibraryModalProps {
  accentColor: string;
  onClose: () => void;
}

interface ShareState {
  shareToken: string | null;
  shareEnabled: boolean;
  shareUrl: string | null;
}

export default function ShareLibraryModal({ accentColor, onClose }: ShareLibraryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<InstanceType<typeof import('qr-code-styling').default> | null>(null);

  const [state, setState] = useState<ShareState>({ shareToken: null, shareEnabled: false, shareUrl: null });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [isConfirmingRegen, setIsConfirmingRegen] = useState(false);

  // Focus trap / escape / body-scroll-lock, matching AddLocationModal's pattern
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/share')
      .then((r) => r.json())
      .then((data: ShareState) => {
        if (!cancelled) setState(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Render/update the QR code whenever the share URL or accent color changes.
  useEffect(() => {
    if (!state.shareEnabled || !state.shareUrl || !qrContainerRef.current) return;

    let cancelled = false;
    import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (cancelled || !qrContainerRef.current) return;
      qrContainerRef.current.innerHTML = '';
      const qr = new QRCodeStyling({
        width: 220,
        height: 220,
        data: state.shareUrl!,
        margin: 8,
        dotsOptions: { color: accentColor, type: 'rounded' },
        cornersSquareOptions: { color: accentColor, type: 'extra-rounded' },
        cornersDotOptions: { color: accentColor, type: 'dot' },
        backgroundOptions: { color: '#FFFDFB' },
      });
      qr.append(qrContainerRef.current);
      qrCodeRef.current = qr;
    });

    return () => { cancelled = true; };
  }, [state.shareEnabled, state.shareUrl, accentColor]);

  const postAction = useCallback(async (action: 'enable' | 'disable' | 'regenerate') => {
    setToggling(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data: ShareState = await res.json();
      setState(data);
    } finally {
      setToggling(false);
    }
  }, []);

  const handleToggle = () => {
    postAction(state.shareEnabled ? 'disable' : 'enable');
  };

  const handleCopy = async () => {
    if (!state.shareUrl) return;
    await navigator.clipboard.writeText(state.shareUrl);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy'), 2000);
  };

  const handleShare = async () => {
    if (!state.shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Library', url: state.shareUrl });
      } catch {
        // User cancelled the share sheet — no-op.
      }
    } else {
      await handleCopy();
    }
  };

  const handleRegenerate = async () => {
    await postAction('regenerate');
    setIsConfirmingRegen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={styles.backdrop}
      onClick={onClose}
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share Library"
        tabIndex={-1}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 30, filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
        style={{ ...styles.modal, outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={styles.closeBtn} className="modal-close-btn no-print" aria-label="Close">
          CLOSE
        </button>

        <h2 style={styles.title}>Share Library</h2>
        <p style={styles.subtitle}>
          Let friends browse your library. They can search for books, but can&apos;t scan, edit, or move anything.
        </p>

        {!loading && (
          <>
            <div style={styles.toggleRow} className="no-print">
              <span style={styles.toggleLabel}>{state.shareEnabled ? 'Sharing is on' : 'Sharing is off'}</span>
              <button
                onClick={handleToggle}
                disabled={toggling}
                role="switch"
                aria-checked={state.shareEnabled}
                style={{
                  ...styles.switchTrack,
                  backgroundColor: state.shareEnabled ? accentColor : 'rgba(17, 22, 37, 0.15)',
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                <motion.span
                  animate={{ x: state.shareEnabled ? 20 : 2 }}
                  transition={{ duration: 0.2 }}
                  style={styles.switchThumb}
                />
              </button>
            </div>

            {state.shareEnabled && state.shareUrl && (
              <>
                <div className="share-print-area">
                  <div ref={qrContainerRef} style={styles.qrWrapper} />
                  <p style={styles.printCaption}>Scan to see our library</p>
                </div>

                <div style={styles.actionsRow} className="no-print">
                  <button onClick={handlePrint} style={styles.secondaryBtn}>Print QR Code</button>
                </div>

                <div style={styles.linkRow} className="no-print">
                  <input readOnly value={state.shareUrl} className="field-white" style={styles.linkInput} />
                  <button onClick={handleCopy} style={styles.secondaryBtn}>{copyLabel}</button>
                  <button onClick={handleShare} style={styles.primaryBtn}>Share</button>
                </div>

                <div className="no-print" style={styles.regenRow}>
                  {isConfirmingRegen ? (
                    <span style={styles.confirmRow}>
                      <span style={styles.confirmText}>This invalidates the old link/QR code.</span>
                      <button onClick={handleRegenerate} style={styles.confirmBtn}>Regenerate</button>
                      <button onClick={() => setIsConfirmingRegen(false)} style={styles.cancelBtn}>Cancel</button>
                    </span>
                  ) : (
                    <button onClick={() => setIsConfirmingRegen(true)} style={styles.regenLink}>
                      Regenerate link
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 22, 37, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'var(--bg-sheet)',
    padding: '28px 24px 24px 24px',
    position: 'relative',
    maxHeight: '90svh',
    overflowY: 'auto',
    borderRadius: '0px',
    boxShadow: '0 12px 30px rgba(17, 22, 37, 0.12)',
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    padding: 0,
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    marginBottom: '6px',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
    lineHeight: '1.4',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  toggleLabel: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  switchTrack: {
    width: '44px',
    height: '24px',
    borderRadius: '9999px',
    border: 'none',
    position: 'relative',
    cursor: 'pointer',
    padding: 0,
    transition: 'background-color 0.2s ease',
  },
  switchThumb: {
    position: 'absolute',
    top: '2px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#FFFDFB',
    boxShadow: '0 1px 3px rgba(17, 22, 37, 0.3)',
  },
  qrWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  printCaption: {
    textAlign: 'center',
    fontFamily: 'var(--font-newsreader), Georgia, serif',
    fontStyle: 'italic',
    fontSize: '1rem',
    color: 'var(--text-primary)',
    marginBottom: '20px',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  linkRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '16px',
  },
  linkInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '0.8rem',
    borderRadius: '0px',
    minWidth: 0,
  },
  regenRow: {
    borderTop: '1px solid rgba(17, 22, 37, 0.12)',
    paddingTop: '16px',
  },
  regenLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    textDecoration: 'underline',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  confirmText: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  confirmBtn: {
    background: 'none',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    backgroundColor: 'var(--bg-sheet)',
    color: 'var(--error)',
    fontWeight: 'bold',
    fontSize: '0.85rem',
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
  },
  secondaryBtn: {
    background: 'none',
    border: '1px solid rgba(17, 22, 37, 0.15)',
    color: 'var(--text-primary)',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    borderRadius: '0px',
    whiteSpace: 'nowrap',
  },
  primaryBtn: {
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(17, 22, 37, 0.08)',
    color: 'var(--bg-sheet)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    whiteSpace: 'nowrap',
  },
};
