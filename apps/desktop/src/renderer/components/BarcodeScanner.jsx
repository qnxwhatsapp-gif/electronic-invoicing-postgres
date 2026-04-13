/**
 * BarcodeScanner — reusable modal that supports:
 *   1. Webcam scanning via @zxing/browser (BrowserMultiFormatReader)
 *   2. USB barcode gun input (rapid keystrokes < 100ms)
 *   3. Manual barcode entry fallback
 *
 * Props:
 *   onDetected(barcode: string) — called once when a barcode is found
 *   onClose()                  — called when user dismisses the modal
 *   title                      — optional header label (default "Scan Barcode")
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function BarcodeScanner({ onDetected, onClose, title = 'Scan Barcode' }) {
  const [tab, setTab] = useState('webcam');           // 'webcam' | 'gun' | 'manual'
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [gunBuffer, setGunBuffer] = useState('');
  const [gunFlash, setGunFlash] = useState(false);

  const videoRef = useRef(null);
  const controlsRef = useRef(null);   // ZXing controls object (has .stop())
  const readerRef = useRef(null);     // BrowserMultiFormatReader instance
  const gunTimerRef = useRef(null);
  const detectedRef = useRef(false);  // prevent double-fire

  // ── Load available cameras ───────────────────────────────────────────────
  useEffect(() => {
    async function loadCameras() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        setCameras(devices);
        if (devices.length > 0) setSelectedCamera(devices[0].deviceId);
      } catch (err) {
        setCameraError('Could not access cameras: ' + err.message);
      }
    }
    loadCameras();
    return () => stopCamera();
  }, []);

  // ── Start / stop camera when tab or selected camera changes ─────────────
  useEffect(() => {
    if (tab === 'webcam') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [tab, selectedCamera]);

  async function startCamera() {
    stopCamera();
    setScanResult('');
    setCameraError('');
    setScanning(true);
    detectedRef.current = false;

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      if (!videoRef.current) { setScanning(false); return; }

      const controls = await reader.decodeFromVideoDevice(
        selectedCamera || undefined,
        videoRef.current,
        (result, err) => {
          if (result && !detectedRef.current) {
            detectedRef.current = true;
            const code = result.getText();
            setScanResult(code);
            setScanning(false);
            // Brief pause so user sees the result, then fire
            setTimeout(() => {
              stopCamera();
              onDetected(code);
            }, 800);
          }
        }
      );
      controlsRef.current = controls;
    } catch (err) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your system settings.'
          : err.name === 'NotFoundError'
          ? 'No camera found. Connect a webcam and try again.'
          : 'Camera error: ' + err.message
      );
      setScanning(false);
    }
  }

  function stopCamera() {
    try { controlsRef.current?.stop(); } catch { /* ignore */ }
    controlsRef.current = null;
    readerRef.current = null;
    setScanning(false);
  }

  // ── USB Barcode Gun listener ─────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'gun') return;
    detectedRef.current = false;

    function onKey(e) {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

      if (e.key === 'Enter') {
        clearTimeout(gunTimerRef.current);
        const code = gunBuffer;
        setGunBuffer('');
        if (code.length >= 4 && !detectedRef.current) {
          detectedRef.current = true;
          setGunFlash(true);
          setTimeout(() => setGunFlash(false), 600);
          setScanResult(code);
          setTimeout(() => {
            onDetected(code);
          }, 600);
        }
        return;
      }

      if (e.key.length === 1) {
        setGunBuffer(prev => {
          clearTimeout(gunTimerRef.current);
          gunTimerRef.current = setTimeout(() => setGunBuffer(''), 100);
          return prev + e.key;
        });
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(gunTimerRef.current);
    };
  }, [tab, gunBuffer, onDetected]);

  // ── Manual submit ────────────────────────────────────────────────────────
  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualCode.trim().length < 2) return;
    onDetected(manualCode.trim());
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const tabStyle = active => ({
    padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: active ? '#1e293b' : '#f1f5f9',
    color: active ? '#fff' : '#64748b',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Use webcam, barcode gun, or enter manually</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '14px 20px 10px', display: 'flex', gap: 8 }}>
          <button style={tabStyle(tab === 'webcam')} onClick={() => setTab('webcam')}>📷 Webcam</button>
          <button style={tabStyle(tab === 'gun')} onClick={() => setTab('gun')}>🔫 Barcode Gun</button>
          <button style={tabStyle(tab === 'manual')} onClick={() => setTab('manual')}>⌨️ Manual</button>
        </div>

        <div style={{ padding: '0 20px 20px', flex: 1 }}>

          {/* ── WEBCAM TAB ─────────────────────────────────────────────── */}
          {tab === 'webcam' && (
            <div>
              {/* Camera selector */}
              {cameras.length > 1 && (
                <select
                  value={selectedCamera}
                  onChange={e => setSelectedCamera(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, marginBottom: 10, color: '#374151' }}
                >
                  {cameras.map(c => (
                    <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 8)}`}</option>
                  ))}
                </select>
              )}

              {/* Viewfinder */}
              <div style={{ position: 'relative', background: '#0f172a', borderRadius: 12, overflow: 'hidden', height: 280 }}>
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  autoPlay
                  playsInline
                  muted
                />

                {/* Scanning frame overlay */}
                {!cameraError && !scanResult && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    {/* Corner brackets */}
                    {[
                      { top: '25%', left: '20%', borderTop: '3px solid #22c55e', borderLeft: '3px solid #22c55e', borderRadius: '4px 0 0 0' },
                      { top: '25%', right: '20%', borderTop: '3px solid #22c55e', borderRight: '3px solid #22c55e', borderRadius: '0 4px 0 0' },
                      { bottom: '25%', left: '20%', borderBottom: '3px solid #22c55e', borderLeft: '3px solid #22c55e', borderRadius: '0 0 0 4px' },
                      { bottom: '25%', right: '20%', borderBottom: '3px solid #22c55e', borderRight: '3px solid #22c55e', borderRadius: '0 0 4px 0' },
                    ].map((s, i) => (
                      <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s }} />
                    ))}
                    {/* Animated scan line */}
                    <ScanLine />
                  </div>
                )}

                {/* Camera error */}
                {cameraError && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
                    <div style={{ color: '#fca5a5', fontSize: 13, lineHeight: 1.5 }}>{cameraError}</div>
                    <button onClick={startCamera} style={{ marginTop: 14, padding: '7px 18px', background: '#22c55e', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                      Try Again
                    </button>
                  </div>
                )}

                {/* Success overlay */}
                {scanResult && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 48 }}>✅</div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginTop: 8 }}>Barcode Detected!</div>
                    <div style={{ color: '#dcfce7', fontSize: 14, marginTop: 4, fontFamily: 'monospace' }}>{scanResult}</div>
                  </div>
                )}

                {/* Scanning indicator */}
                {scanning && !cameraError && !scanResult && (
                  <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center' }}>
                    <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, padding: '3px 12px', borderRadius: 20 }}>
                      Scanning… point camera at barcode
                    </span>
                  </div>
                )}
              </div>

              {/* Restart scan button */}
              {(scanResult || cameraError) && (
                <button onClick={startCamera} style={{ marginTop: 12, width: '100%', padding: '9px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, color: '#374151' }}>
                  🔄 Scan Again
                </button>
              )}
            </div>
          )}

          {/* ── GUN TAB ────────────────────────────────────────────────── */}
          {tab === 'gun' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🔫</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#1e293b' }}>USB Barcode Gun Ready</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
                Point your barcode gun at the label and pull the trigger.<br />
                The barcode will be captured automatically.
              </div>

              {/* Buffer display */}
              <div style={{ background: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: 12, padding: '16px 20px', minHeight: 54, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {gunBuffer ? (
                  <span style={{ fontFamily: 'monospace', fontSize: 22, letterSpacing: 2, color: '#1e293b' }}>{gunBuffer}</span>
                ) : scanResult ? (
                  <span style={{ fontFamily: 'monospace', fontSize: 20, color: '#16a34a', fontWeight: 700 }}>✓ {scanResult}</span>
                ) : (
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Waiting for scan…</span>
                )}
              </div>

              {/* Flash feedback */}
              {gunFlash && (
                <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#166534', fontWeight: 600, marginBottom: 12 }}>
                  ✅ Barcode captured!
                </div>
              )}

              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Make sure this window is focused. Gun must send keystrokes faster than 100ms.
              </div>
            </div>
          )}

          {/* ── MANUAL TAB ─────────────────────────────────────────────── */}
          {tab === 'manual' && (
            <div style={{ padding: '20px 0' }}>
              <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>⌨️</div>
              <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20 }}>
                Type or paste the barcode number below
              </div>
              <form onSubmit={handleManualSubmit}>
                <input
                  autoFocus
                  className="form-input"
                  placeholder="Enter barcode (e.g. 8539500001)"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  style={{ fontSize: 16, textAlign: 'center', letterSpacing: 2, fontFamily: 'monospace' }}
                />
                <button
                  type="submit"
                  disabled={manualCode.trim().length < 2}
                  style={{
                    marginTop: 14, width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                    background: manualCode.trim().length >= 2 ? '#1e293b' : '#e2e8f0',
                    color: manualCode.trim().length >= 2 ? '#fff' : '#94a3b8',
                    fontWeight: 600, fontSize: 14, cursor: manualCode.trim().length >= 2 ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                  }}
                >
                  Confirm Barcode
                </button>
              </form>
            </div>
          )}

          {/* Supported formats note */}
          <div style={{ marginTop: 14, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
            Supports: EAN-13, EAN-8, Code 128, Code 39, QR Code, UPC-A, UPC-E, Data Matrix
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Animated scanning line ─────────────────────────────────────────────────
function ScanLine() {
  const lineRef = useRef(null);
  useEffect(() => {
    let pos = 0;
    let dir = 1;
    let raf;
    function animate() {
      pos += dir * 1.5;
      if (pos > 100) dir = -1;
      if (pos < 0) dir = 1;
      if (lineRef.current) lineRef.current.style.top = pos + '%';
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={lineRef} style={{
      position: 'absolute', left: '15%', right: '15%', height: 2,
      background: 'linear-gradient(90deg, transparent, #22c55e, transparent)',
      boxShadow: '0 0 6px #22c55e',
      pointerEvents: 'none',
    }} />
  );
}
