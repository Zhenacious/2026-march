import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X } from 'lucide-react';

/**
 * Camera barcode scanner. Mount it to start the camera, unmount to stop it —
 * the parent should remove it from the tree as soon as onScan fires so a
 * barcode can't be read twice.
 */
export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    const scanner = new Html5Qrcode('barcode-scanner', {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      verbose: false,
    });
    scannerRef.current = scanner;

    // start() is async: if the effect is cleaned up before it resolves
    // (StrictMode double-mount, fast close), stop the camera right away.
    let cancelled = false;
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => { onScanRef.current(decodedText); },
        () => {} // fires on every frame without a barcode — ignore
      )
      .then(() => { if (cancelled) scanner.stop().catch(() => {}); })
      .catch((err) => setCameraError(err?.message || 'Camera unavailable'));

    return () => {
      cancelled = true;
      scanner.stop().catch(() => {}); // rejects if never started — fine
    };
  }, []);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-zinc-400 text-xs">Point the camera at the barcode</p>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {cameraError ? (
        <p className="text-red-400 text-sm py-4 text-center">
          {cameraError.includes('Permission') || cameraError.includes('NotAllowed')
            ? 'Camera access was denied. Allow camera permission in your browser settings and try again.'
            : cameraError}
        </p>
      ) : (
        <div id="barcode-scanner" className="w-full rounded-lg overflow-hidden" />
      )}
    </div>
  );
}
