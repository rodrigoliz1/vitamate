import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export type NativePhotoSource = 'camera' | 'photos';

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No pudimos leer la fotografía.'));
    reader.readAsDataURL(blob);
  });
}

export async function pickNativePhoto(source: NativePhotoSource): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const media = source === 'camera'
    ? await Camera.takePhoto({ quality: 82, targetWidth: 1800, targetHeight: 1800, correctOrientation: true })
    : (await Camera.chooseFromGallery({ quality: 82, targetWidth: 1800, targetHeight: 1800, correctOrientation: true, limit: 1 })).results[0];
  if (!media?.webPath) return null;
  const response = await fetch(media.webPath);
  if (!response.ok) throw new Error('No pudimos abrir la fotografía seleccionada.');
  return blobToDataUrl(await response.blob());
}
