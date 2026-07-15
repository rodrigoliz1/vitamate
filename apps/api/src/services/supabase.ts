import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabaseAdmin: SupabaseClient | null = config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabaseAdmin) throw new Error('Supabase no está configurado en el servidor.');
  return supabaseAdmin;
}

export async function verifySupabaseAccessToken(token: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
