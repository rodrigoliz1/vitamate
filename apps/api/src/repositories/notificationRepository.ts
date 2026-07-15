import { requireSupabase } from '../services/supabase.js';

export interface NotificationDevice {
  id: string;
  token: string;
  environment: 'sandbox' | 'production';
}

export async function upsertNotificationDevice(input: {
  userId: string;
  token: string;
  platform: 'ios' | 'web';
  environment: 'sandbox' | 'production';
  locale?: string;
  timezone?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await requireSupabase().from('notification_devices').upsert({
    user_id: input.userId,
    platform: input.platform,
    environment: input.environment,
    device_token: input.token,
    locale: input.locale ?? null,
    timezone: input.timezone ?? null,
    active: true,
    last_seen_at: now,
    updated_at: now,
  }, { onConflict: 'platform,device_token' });
  if (error) throw error;
}

export async function notificationDevicesForUser(userId: string): Promise<NotificationDevice[]> {
  const { data, error } = await requireSupabase().from('notification_devices').select('id,device_token,environment').eq('user_id', userId).eq('platform', 'ios').eq('active', true);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, token: row.device_token, environment: row.environment }));
}

export async function deactivateNotificationDevice(id: string): Promise<void> {
  const { error } = await requireSupabase().from('notification_devices').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

