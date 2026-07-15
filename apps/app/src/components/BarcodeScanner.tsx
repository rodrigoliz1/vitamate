import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { cameraOutline, stopCircleOutline } from 'ionicons/icons';

type Detector = { detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

export function BarcodeScanner({ onDetected }: { onDetected(barcode: string): void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>();
  const [active, setActive] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const stop = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; setActive(false);
  };

  useEffect(() => stop, []);

  const start = async () => {
    const BarcodeDetector = (globalThis as typeof globalThis & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!BarcodeDetector || !navigator.mediaDevices?.getUserMedia) { setUnsupported(true); return; }
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
    {unsupported && <small>Este navegador no ofrece escaneo nativo. Ingresa el número del código de barras o usa la app nativa posteriormente.</small>}
  </div>;
}
