import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { supabase } from './supabase';

export const isNativeIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

async function handleDeepLink(urlString: string): Promise<void> {
  let url: URL;
  try { url = new URL(urlString); } catch { return; }
  const code = url.searchParams.get('code');
  if (code && supabase) await supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
  const path = url.protocol === 'mx.vitamate:'
    ? (url.host === 'auth' ? '/hoy' : `/${url.host}${url.pathname}`)
    : url.pathname;
  const allowed = new Set(['/hoy', '/nutricion', '/plan-semanal', '/entrenar', '/coach', '/progreso', '/cuenta']);
  const destination = allowed.has(path) ? path : '/hoy';
  window.history.replaceState({}, '', `${destination}${url.searchParams.has('checkout') ? url.search : ''}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export async function initializeNativePlatform(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add('capacitor-native', `capacitor-${Capacitor.getPlatform()}`);
  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    Keyboard.setAccessoryBarVisible({ isVisible: true }),
  ]);
  const updateNetwork = (connected: boolean) => {
    document.documentElement.classList.toggle('native-offline', !connected);
    window.dispatchEvent(new CustomEvent('vitamate:network', { detail: { connected } }));
  };
  const status = await Network.getStatus().catch(() => null);
  if (status) updateNetwork(status.connected);
  await Network.addListener('networkStatusChange', ({ connected }) => updateNetwork(connected));
  await Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
    document.documentElement.classList.add('native-keyboard-open');
    document.documentElement.style.setProperty('--native-keyboard-height', `${keyboardHeight}px`);
  });
  await Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.classList.remove('native-keyboard-open');
    document.documentElement.style.removeProperty('--native-keyboard-height');
  });
  await CapacitorApp.addListener('appUrlOpen', ({ url }) => { void handleDeepLink(url); });
  await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) window.dispatchEvent(new CustomEvent('vitamate:native-resume'));
  });
  window.addEventListener('load', () => { void SplashScreen.hide(); }, { once: true });
  window.setTimeout(() => { void SplashScreen.hide(); }, 1600);
}
