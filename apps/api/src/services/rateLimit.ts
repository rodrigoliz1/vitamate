import { supabaseAdmin } from './supabase.js';

const buckets = new Map<string, number[]>();
const MAX_IN_MEMORY_BUCKET_AGE_MS = 15 * 60_000;
let lastCleanupAt = 0;

function cleanupBuckets(now: number): void {
  if (now - lastCleanupAt < 60_000 && buckets.size < 10_000) return;
  lastCleanupAt = now;
  for (const [key, timestamps] of buckets) {
    const latest = timestamps[timestamps.length - 1] ?? 0;
    if (now - latest >= MAX_IN_MEMORY_BUCKET_AGE_MS) buckets.delete(key);
  }
}

export function allowRequest(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  cleanupBuckets(now);
  const recent = (buckets.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) { buckets.set(key, recent); return false; }
  recent.push(now); buckets.set(key, recent); return true;
}

export async function allowPersistentRequest(key: string, limit: number, windowMs = 60_000): Promise<boolean> {
  if (!supabaseAdmin) return allowRequest(key, limit, windowMs);
  const { data, error } = await supabaseAdmin.rpc('consume_api_rate_limit', {
    p_bucket_key: key.slice(0, 240),
    p_limit: limit,
    p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
  });
  if (!error) return data === true;
  // En producción se falla cerrado para no convertir una incidencia de base
  // en consumo ilimitado de IA o de proveedores externos.
  if (process.env.NODE_ENV === 'production') return false;
  return allowRequest(key, limit, windowMs);
}
