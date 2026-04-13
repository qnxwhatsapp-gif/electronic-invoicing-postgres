import { useEffect, useRef } from 'react';

/**
 * Detects USB barcode gun input (rapid keystrokes < 100ms apart)
 * vs normal keyboard typing, then calls onScan(barcode)
 */
export function useBarcodeGun(onScan, enabled = true) {
  const bufferRef = useRef('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e) {
      // Ignore modifier keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

      if (e.key === 'Enter') {
        clearTimeout(timerRef.current);
        if (bufferRef.current.length >= 4) {
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
        return;
      }

      if (e.key.length === 1) bufferRef.current += e.key;

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Typed too slowly — this is a human, not a gun
        bufferRef.current = '';
      }, 100);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timerRef.current);
    };
  }, [onScan, enabled]);
}
