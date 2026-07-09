import { useEffect } from 'react';

const MIN_CODE_LENGTH = 8; // Shortest realistic barcode (UPC-E-ish)
const MAX_CODE_LENGTH = 13; // ISBN-13 / EAN-13
const MAX_AVG_MS_PER_CHAR = 40; // Hardware scanners type far faster than any human
const BUFFER_STALE_MS = 200; // Reset if the next character doesn't arrive quickly

/**
 * Detects hardware barcode-scanner input (keyboard-wedge devices) globally while `active`.
 * Scanners emit characters far faster than human typing and terminate with Enter, so a
 * plain keydown listener buffering inter-character timing tells scans apart from typing
 * without needing focus on any particular element.
 */
export function useHardwareScanner(active: boolean, onScan: (code: string) => void) {
  useEffect(() => {
    if (!active) return;

    let buffer: { char: string; time: number }[] = [];
    let staleTimer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      buffer = [];
      if (staleTimer) {
        clearTimeout(staleTimer);
        staleTimer = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Enter') {
        if (buffer.length >= MIN_CODE_LENGTH && buffer.length <= MAX_CODE_LENGTH) {
          const code = buffer.map(b => b.char).join('');
          const isAllDigits = /^\d+$/.test(code);
          const gaps = buffer.slice(1).map((b, i) => b.time - buffer[i].time);
          const avgGapMs = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity;

          if (isAllDigits && avgGapMs < MAX_AVG_MS_PER_CHAR) {
            onScan(code);
          }
        }
        reset();
        return;
      }

      // Only buffer single printable characters; ignore Shift/Tab/arrows/etc.
      if (e.key.length === 1) {
        buffer.push({ char: e.key, time: performance.now() });
        if (staleTimer) clearTimeout(staleTimer);
        staleTimer = setTimeout(reset, BUFFER_STALE_MS);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      reset();
    };
  }, [active, onScan]);
}
