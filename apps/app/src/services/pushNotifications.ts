import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerPushDevice } from './api';

let configuredForUser: string | null = null;

function apnsEnvironment(): 'sandbox' | 'production' {
  return import.meta.env.VITE_APNS_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
}

export async function enableRemoteNotifications(userId: string): Promise<'registered' | 'unsupported'> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return 'unsupported';
  if (configuredForUser === userId) return 'registered';
  configuredForUser = userId;
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    configuredForUser = null;
    throw new Error('Activa las notificaciones de VITAMATE en Configuración para recibir avisos del servidor.');
  }
  await PushNotifications.addListener('registration', ({ value }) => {
    void registerPushDevice({ token: value, platform: 'ios', environment: apnsEnvironment() });
  });
  await PushNotifications.addListener('registrationError', ({ error }) => {
    configuredForUser = null;
    console.warn('APNs registration failed', error);
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const path = typeof notification.data?.path === 'string' ? notification.data.path : '/hoy';
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await PushNotifications.register();
  return 'registered';
}
