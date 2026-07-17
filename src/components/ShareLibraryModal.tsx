'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeSwatches from '@/components/ThemeSwatches';

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
  const qrInstanceRef = useRef<InstanceType<typeof import('qr-code-styling').default> | null>(null);

  const [state, setState] = useState<ShareState>({ shareToken: null, shareEnabled: false, shareUrl: null });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [isConfirmingRegen, setIsConfirmingRegen] = useState(false);
  const [qrColor, setQrColor] = useState(accentColor);
  const [message, setMessage] = useState('Scan to see my library');
  const [editingMessage, setEditingMessage] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [pngReady, setPngReady] = useState(false);
  const [printCount, setPrintCount] = useState<1 | 2 | 4 | 6 | 8>(4);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string | null>(null);

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

  useEffect(() => {
    const storedColor = localStorage.getItem('share-qr-color');
    const storedMessage = localStorage.getItem('share-qr-message');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedColor) setQrColor(storedColor);
    if (storedMessage) setMessage(storedMessage);
  }, []);

  useEffect(() => {
    localStorage.setItem('share-qr-color', qrColor);
  }, [qrColor]);

  useEffect(() => {
    localStorage.setItem('share-qr-message', message);
  }, [message]);

  // Render/update the QR code whenever the share URL or QR color changes.
  useEffect(() => {
    if (!state.shareEnabled || !state.shareUrl || !qrContainerRef.current) return;
    setPngReady(false);

    let cancelled = false;
    import('qr-code-styling').then(async ({ default: QRCodeStyling }) => {
      if (cancelled || !qrContainerRef.current) return;
      qrContainerRef.current.innerHTML = '';
      const qr = new QRCodeStyling({
        width: 176,
        height: 176,
        data: state.shareUrl!,
        margin: 6,
        dotsOptions: { color: qrColor, type: 'rounded' },
        cornersSquareOptions: { color: qrColor, type: 'extra-rounded' },
        cornersDotOptions: { color: qrColor, type: 'dot' },
        backgroundOptions: { color: '#FFFDFB' },
      });
      qr.append(qrContainerRef.current);
      qrInstanceRef.current = qr;
      setPngReady(true);

      const blob = await qr.getRawData('png');
      if (cancelled || !blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (!cancelled) setQrPngDataUrl(reader.result as string);
      };
      reader.readAsDataURL(blob as Blob);
    });

    return () => { cancelled = true; };
  }, [state.shareEnabled, state.shareUrl, qrColor]);

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
    try {
      await navigator.clipboard.writeText(state.shareUrl);
      setCopyLabel('Copied!');
    } catch {
      setCopyLabel('Copy failed');
    }
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

  const handlePrintCount = (count: 1 | 2 | 4 | 6 | 8) => {
    setPrintCount(count);
    setPrintMenuOpen(false);
    requestAnimationFrame(() => window.print());
  };

  const handleDownloadPng = async () => {
    if (!qrInstanceRef.current) return;
    await qrInstanceRef.current.download({ name: 'library-qr', extension: 'png' });
  };

  const toTitleCase = (s: string) =>
    s.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const startEditingMessage = () => {
    setDraftMessage(message);
    setEditingMessage(true);
  };

  const commitMessage = () => {
    const next = toTitleCase(draftMessage);
    if (next) setMessage(next);
    setEditingMessage(false);
  };

  const cancelEditingMessage = () => {
    setEditingMessage(false);
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
                  justifyContent: state.shareEnabled ? 'flex-end' : 'flex-start',
                  backgroundColor: state.shareEnabled ? accentColor : 'rgba(17, 22, 37, 0.15)',
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                <motion.span
                  layout
                  transition={{ type: 'spring', stiffness: 700, damping: 35 }}
                  style={styles.switchThumb}
                />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {state.shareEnabled && state.shareUrl && (
                <motion.div
                  key="share-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <motion.div
                    initial={{ y: 8 }}
                    animate={{ y: 0 }}
                    exit={{ y: 8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div ref={qrContainerRef} style={styles.qrWrapper} />

                    <div style={styles.swatchRow} className="no-print">
                      <ThemeSwatches value={qrColor} onChange={setQrColor} />
                    </div>

                    <div style={styles.messageRow} className="no-print">
                      {editingMessage ? (
                        <input
                          autoFocus
                          value={draftMessage}
                          onChange={(e) => setDraftMessage(e.target.value)}
                          onBlur={commitMessage}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitMessage();
                            if (e.key === 'Escape') cancelEditingMessage();
                          }}
                          className="field-white"
                          style={styles.messageInput}
                        />
                      ) : (
                        <p style={{ ...styles.messageText, color: qrColor }}>{message}</p>
                      )}
                    </div>
                    <div className="share-print-area" data-print-count={printCount}>
                      {Array.from({ length: printCount }).map((_, i) => (
                        <div key={i} className="qr-print-card">
                          {qrPngDataUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={qrPngDataUrl} alt="Library QR code" className="qr-print-card-image" />
                          )}
                          <p className="qr-print-card-message" style={{ color: qrColor }}>{message}</p>
                        </div>
                      ))}
                    </div>

                    <div style={styles.iconToolbar} className="no-print">
                      <button
                        onClick={startEditingMessage}
                        style={styles.iconBtn}
                        title="Edit message"
                        aria-label="Edit message"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setPrintMenuOpen((v) => !v)}
                        disabled={!qrPngDataUrl}
                        style={{ ...styles.iconBtn, opacity: qrPngDataUrl ? 1 : 0.4, cursor: qrPngDataUrl ? 'pointer' : 'default' }}
                        title="Print"
                        aria-label="Print QR cards"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9" />
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                          <rect x="6" y="14" width="12" height="8" />
                        </svg>
                      </button>
                      <button
                        onClick={handleDownloadPng}
                        disabled={!pngReady}
                        style={{ ...styles.iconBtn, opacity: pngReady ? 1 : 0.4, cursor: pngReady ? 'pointer' : 'default' }}
                        title="Download PNG"
                        aria-label="Download QR as PNG"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    </div>

                    <AnimatePresence>
                      {printMenuOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                          className="no-print"
                        >
                          <div style={styles.printMenu}>
                            {([1, 2, 4, 6, 8] as const).map((count) => (
                              <button
                                key={count}
                                onClick={() => handlePrintCount(count)}
                                style={{
                                  ...styles.printMenuOption,
                                  ...(printCount === count ? styles.printMenuOptionActive : {}),
                                }}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div style={styles.linkRow} className="no-print">
                      <input readOnly value={state.shareUrl} className="field-white" style={styles.linkInput} />
                      <button onClick={handleCopy} style={styles.iconBtn} title={copyLabel} aria-label={copyLabel}>
                        {copyLabel === 'Copied!' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                      <button onClick={handleShare} style={styles.iconBtn} title="Share" aria-label="Share link">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                      </button>
                    </div>

                    <div className="no-print" style={styles.regenRow}>
                      {isConfirmingRegen ? (
                        <span style={styles.confirmRow}>
                          <span style={styles.confirmText}>This invalidates the old link/QR code.</span>
                          <button onClick={handleRegenerate} style={styles.confirmBtn}>Regenerate</button>
                          <button onClick={() => setIsConfirmingRegen(false)} style={styles.cancelBtn}>Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setIsConfirmingRegen(true)} style={styles.iconBtn} title="Regenerate link" aria-label="Regenerate link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
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
    height: '26px',
    borderRadius: '9999px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    padding: '2px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  switchThumb: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: '#FFFDFB',
    boxShadow: '0 1px 3px rgba(17, 22, 37, 0.3)',
    flexShrink: 0,
  },
  qrWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  swatchRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '14px',
  },
  messageRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  messageText: {
    textAlign: 'center',
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    fontWeight: 600,
    fontSize: '1.05rem',
    margin: 0,
    cursor: 'default',
  },
  messageInput: {
    width: '100%',
    maxWidth: '320px',
    padding: '8px 12px',
    fontSize: '0.95rem',
    borderRadius: '0px',
    textAlign: 'center',
  },
  iconToolbar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '20px',
  },
  printMenu: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '16px',
  },
  printMenuOption: {
    background: 'none',
    border: '1px solid rgba(17, 22, 37, 0.15)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    fontFamily: 'var(--font-instrument-sans), sans-serif',
    padding: '4px 10px',
    cursor: 'pointer',
    borderRadius: '0px',
  },
  printMenuOptionActive: {
    borderColor: 'var(--accent-primary)',
    color: 'var(--accent-primary)',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'color 0.15s ease, background-color 0.15s ease',
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
};
