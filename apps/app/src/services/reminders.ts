import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Weekday, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import type { WellnessReminder } from '../models/reminders';

const storedIdsKey = 'vitamate.reminder.notification-ids.v1';
let listenersReady = false;
let webTimer: number | undefined;

const weekdayMap: Record<number, Weekday> = {
  0: Weekday.Sunday,
  1: Weekday.Monday,
  2: Weekday.Tuesday,
  3: Weekday.Wednesday,
  4: Weekday.Thursday,
  5: Weekday.Friday,
  6: Weekday.Saturday,
};

function stableNotificationId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 100_000 + (Math.abs(hash) % 2_000_000_000);
}

function reminderBody(reminder: WellnessReminder): string {
  if (reminder.details.trim()) return reminder.details.trim();
  if (reminder.kind === 'water') return 'Un vaso ahora suma a tu energía y recuperación.';
  if (reminder.kind === 'meal') return 'Registra lo que comiste para mantener tu balance semanal al día.';
  if (reminder.kind === 'workout') return 'Tu entrenamiento está programado. VITAMATE te acompaña paso a paso.';
  if (reminder.kind === 'vitacoach') return '¿Cómo vas hoy? Abre VITACOACH y cuéntame lo que necesites.';
  return 'Tienes un recordatorio de bienestar pendiente.';
}

function nativeNotification(reminder: WellnessReminder, weekday: number, time: string): LocalNotificationSchema {
  const [hour, minute] = time.split(':').map(Number);
  return {
    id: stableNotificationId(`${reminder.id}:${weekday}:${time}`),
    title: reminder.kind === 'vitacoach' ? 'VITACOACH está contigo' : reminder.title,
    body: reminderBody(reminder),
    sound: 'default',
    actionTypeId: 'VITAMATE_REMINDER',
    threadIdentifier: `vitamate.${reminder.kind}`,
    schedule: { on: { weekday: weekdayMap[weekday], hour, minute }, repeats: true },
    extra: { reminderId: reminder.id, path: '/recordatorios' },
  };
}

function navigateFromNotification(path = '/recordatorios') {
  const allowed = new Set(['/recordatorios', '/nutricion', '/entrenar', '/coach', '/hoy']);
  const destination = allowed.has(path) ? path : '/recordatorios';
  window.history.pushState({}, '', destination);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export async function initializeReminderNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || listenersReady) return;
  listenersReady = true;
  await LocalNotifications.registerActionTypes({
    types: [{
      id: 'VITAMATE_REMINDER',
      actions: [
        { id: 'COMPLETE', title: 'Listo' },
        { id: 'OPEN', title: 'Abrir VITAMATE', foreground: true },
      ],
    }],
  });
  await LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
    const reminderId = String(notification.extra?.reminderId ?? '');
    if (actionId === 'COMPLETE' && reminderId) {
      window.dispatchEvent(new CustomEvent('vitamate:reminder-completed', { detail: { reminderId } }));
    }
    navigateFromNotification(String(notification.extra?.path ?? '/recordatorios'));
  });
}

export async function notificationPermission(request = false): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    const status = request ? await LocalNotifications.requestPermissions() : await LocalNotifications.checkPermissions();
    return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'prompt';
  }
  if (!('Notification' in window)) return 'denied';
  if (request && Notification.permission === 'default') await Notification.requestPermission();
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt';
}

function nextWebOccurrence(reminders: WellnessReminder[]): { reminder: WellnessReminder; at: number } | null {
  const now = new Date();
  let candidate: { reminder: WellnessReminder; at: number } | null = null;
  for (const reminder of reminders.filter((item) => item.enabled)) {
    for (let offset = 0; offset < 8; offset += 1) {
      const day = new Date(now);
      day.setDate(now.getDate() + offset);
      if (!reminder.weekdays.includes(day.getDay())) continue;
      for (const time of reminder.times) {
        const [hour, minute] = time.split(':').map(Number);
        day.setHours(hour, minute, 0, 0);
        if (day.getTime() <= now.getTime()) continue;
        if (!candidate || day.getTime() < candidate.at) candidate = { reminder, at: day.getTime() };
      }
    }
  }
  return candidate;
}

function scheduleWebSession(reminders: WellnessReminder[]) {
  if (webTimer) window.clearTimeout(webTimer);
  const next = nextWebOccurrence(reminders);
  if (!next || Notification.permission !== 'granted') return;
  webTimer = window.setTimeout(() => {
    new Notification(next.reminder.title, { body: reminderBody(next.reminder), tag: `vitamate-${next.reminder.id}` });
    scheduleWebSession(reminders);
  }, Math.min(next.at - Date.now(), 2_147_000_000));
}

export async function syncReminderNotifications(reminders: WellnessReminder[], requestPermission = false): Promise<'granted' | 'denied' | 'prompt'> {
  const permission = await notificationPermission(requestPermission);
  if (permission !== 'granted') return permission;
  if (!Capacitor.isNativePlatform()) {
    scheduleWebSession(reminders);
    return permission;
  }

  await initializeReminderNotifications();
  const stored = await Preferences.get({ key: storedIdsKey });
  const previousIds = stored.value ? JSON.parse(stored.value) as number[] : [];
  if (previousIds.length) await LocalNotifications.cancel({ notifications: previousIds.map((id) => ({ id })) });
  const notifications = reminders
    .filter((reminder) => reminder.enabled)
    .flatMap((reminder) => reminder.weekdays.flatMap((weekday) => reminder.times.map((time) => nativeNotification(reminder, weekday, time))));
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  await Preferences.set({ key: storedIdsKey, value: JSON.stringify(notifications.map(({ id }) => id)) });
  return permission;
}

