import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();

export const supabaseConfigured = Boolean(url && publishableKey);
const native = Capacitor.isNativePlatform();
const authStorage = native ? {
  getItem: (key: string) => SecureStorage.getItem(key),
  setItem: (key: string, value: string) => SecureStorage.setItem(key, value),
  removeItem: (key: string) => SecureStorage.removeItem(key),
} : window.localStorage;
export const supabase = supabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !native, flowType: 'pkce', storage: authStorage },
    })
  : null;
