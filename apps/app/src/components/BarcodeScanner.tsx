import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonIcon } from '@ionic/react';
import { cameraOutline, stopCircleOutline } from 'ionicons/icons';

type Detector = { detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

export function BarcodeScanner({ onDetected }: { onDetected(barcode: string): void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>();
  const [active, setActive] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');

  const stop = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; setActive(false);
  };

  useEffect(() => stop, []);

  const start = async () => {
    setScannerMessage('');
    if (Capacitor.isNativePlatform()) {
      setActive(true);
      try {
        const { CapacitorBarcodeScanner, CapacitorBarcodeScannerCameraDirection, CapacitorBarcodeScannerScanOrientation, CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
        const result = await CapacitorBarcodeScanner.scanBarcode({
          hint: CapacitorBarcodeScannerTypeHint.ALL,
          cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
          scanOrientation: CapacitorBarcodeScannerScanOrientation.PORTRAIT,
          scanInstructions: 'Alinea el código de barras dentro del recuadro.',
          scanButton: false,
          cancelButtonAccessibilityLabel: 'Cancelar escaneo',
          torchButtonOnAccessibilityLabel: 'Apagar linterna',
          torchButtonOffAccessibilityLabel: 'Encender linterna',
        });
        const value = result.ScanResult?.replace(/\D/g, '') ?? '';
        if (/^\d{8,14}$/.test(value)) onDetected(value);
        else if (value) setScannerMessage('El código detectado no corresponde a un producto EAN o UPC válido.');
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message && !/cancel/i.test(message)) setScannerMessage('No pudimos abrir el escáner. Revisa el permiso de cámara en Ajustes.');
      } finally {
        setActive(false);
      }
      return;
    }
    const BarcodeDetector = (globalThis as typeof globalThis & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!BarcodeDetector || !navigator.mediaDevices?.getUserMedia) { setScannerMessage('Este navegador no ofrece escaneo automático. Ingresa el número impreso bajo el código.'); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    streamRef.current = stream; setActive(true);
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream; await videoRef.current.play();
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    const scan = async () => {
      if (!videoRef.current || !streamRef.current) return;
      try {
        const results = await detector.detect(videoRef.current);
        const value = results[0]?.rawValue;
        if (value) { stop(); onDetected(value); return; }
      } catch { /* The next frame can recover. */ }
      frameRef.current = requestAnimationFrame(scan);
    };
    frameRef.current = requestAnimationFrame(scan);
  };

  return <div className="barcode-scanner">
    <video ref={videoRef} muted playsInline className={active ? 'is-active' : ''} />
    <IonButton fill="outline" onClick={active ? stop : start}><IonIcon slot="start" icon={active ? stopCircleOutline : cameraOutline} />{active ? 'Detener cámara' : 'Escanear con cámara'}</IonButton>
    {scannerMessage && <small>{scannerMessage}</small>}
  </div>;
}
