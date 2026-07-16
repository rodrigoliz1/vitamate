import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { supabase } from './supabase';
import { initializeReminderNotifications } from './reminders';

export const isNativeIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

function clearNativeViewportState(): void {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) activeElement.blur();
  document.documentElement.classList.remove('native-keyboard-open');
  document.documentElement.style.removeProperty('--native-keyboard-height');
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
}

export function dismissNativeKeyboard(): void {
  clearNativeViewportState();
  if (Capacitor.isNativePlatform()) void Keyboard.hide().catch(() => undefined);
}

async function handleDeepLink(urlString: string): Promise<void> {
  let url: URL;
  try { url = new URL(urlString); } catch { return; }
  const code = url.searchParams.get('code');
  if (code && supabase) await supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
  const rawPath = url.protocol === 'mx.vitamate:'
    ? (url.host === 'auth' ? '/hoy' : `/${url.host}${url.pathname}`)
    : url.pathname;
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
  const allowed = new Set(['/hoy', '/nutricion', '/plan-semanal', '/entrenar', '/coach', '/progreso', '/cuenta', '/recordatorios']);
  const destination = allowed.has(path) ? path : '/hoy';
  window.history.replaceState({}, '', `${destination}${url.searchParams.has('checkout') ? url.search : ''}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export async function initializeNativePlatform(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add('capacitor-native', `capacitor-${Capacitor.getPlatform()}`);
  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Light }),
    StatusBar.setOverlaysWebView({ overlay: false }),
    StatusBar.setBackgroundColor({ color: '#F8F6EF' }),
    Keyboard.setAccessoryBarVisible({ isVisible: true }),
  ]);
  await initializeReminderNotifications().catch(() => undefined);
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
    if (isActive) {
      clearNativeViewportState();
      void Keyboard.hide().catch(() => undefined);
      window.dispatchEvent(new CustomEvent('vitamate:native-resume'));
    }
  });
  window.addEventListener('load', () => { void SplashScreen.hide(); }, { once: true });
  window.setTimeout(() => { void SplashScreen.hide(); }, 1600);
}
