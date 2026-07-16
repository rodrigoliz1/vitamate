import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { cameraOutline, stopCircleOutline } from 'ionicons/icons';

type ScannerControls = { stop(): void };

function normalizeBarcode(value: string): string {
  return value.replace(/\D/g, '');
}

export function BarcodeScanner({ onDetected }: { onDetected(barcode: string): void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const detectedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    detectedRef.current = false;
    setStarting(false);
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const startNative = async () => {
    if (!Capacitor.isPluginAvailable('CapacitorBarcodeScanner')) {
      setScannerMessage('El escáner nativo no quedó disponible en esta instalación. Actualiza la app e inténtalo nuevamente.');
      return;
    }
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
      const value = normalizeBarcode(result.ScanResult ?? '');
      if (/^\d{8,14}$/.test(value)) onDetected(value);
      else if (value) setScannerMessage('El código detectado no corresponde a un producto EAN o UPC válido.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message && !/cancel/i.test(message)) setScannerMessage('No pudimos abrir el escáner. Permite el acceso a Cámara para VITAMATE en Ajustes.');
    } finally {
      setActive(false);
    }
  };

  const startWeb = async () => {
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setScannerMessage('La cámara requiere una conexión segura HTTPS. También puedes ingresar el número impreso bajo el código.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setScannerMessage('Este dispositivo no expone una cámara al navegador. Ingresa el número impreso bajo el código.');
      return;
    }
    setStarting(true);
    detectedRef.current = false;
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current,
        (result, _error, callbackControls) => {
          if (!result || detectedRef.current) return;
          const value = normalizeBarcode(result.getText());
          if (!/^\d{8,14}$/.test(value)) return;
          detectedRef.current = true;
          callbackControls.stop();
          controlsRef.current = null;
          setActive(false);
          setScannerMessage('Código detectado. Consultando el producto…');
          onDetected(value);
        },
      );
      if (detectedRef.current) controls.stop();
      else {
        controlsRef.current = controls;
        setActive(true);
      }
    } catch (error) {
      stop();
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError') setScannerMessage('No hay permiso de cámara. Habilítalo en la configuración de Safari o del navegador.');
      else if (name === 'NotFoundError') setScannerMessage('No encontramos una cámara disponible en este dispositivo.');
      else setScannerMessage('No pudimos iniciar la cámara. Puedes ingresar manualmente el número del código.');
    } finally {
      setStarting(false);
    }
  };

  const start = async () => {
    setScannerMessage('');
    if (Capacitor.getPlatform() !== 'web') await startNative();
    else await startWeb();
  };

  return <div className="barcode-scanner">
    <div className={`barcode-preview${active ? ' is-active' : ''}`}>
      <video ref={videoRef} muted playsInline />
      {active && <span aria-hidden="true" className="barcode-target" />}
    </div>
    <IonButton fill="outline" disabled={starting} onClick={active ? stop : () => void start()}>
      {starting ? <IonSpinner slot="start" /> : <IonIcon slot="start" icon={active ? stopCircleOutline : cameraOutline} />}
      {starting ? 'Abriendo cámara…' : active ? 'Detener cámara' : 'Escanear con cámara'}
    </IonButton>
    {scannerMessage && <small role="status">{scannerMessage}</small>}
  </div>;
}
