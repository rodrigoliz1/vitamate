import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';

export interface NativeHealthSummary {
  stepsToday?: number;
  activeCaloriesToday?: number;
  restingHeartRate?: number;
  source: 'Apple Health';
  updatedAt: string;
}

const readTypes = ['steps', 'calories', 'restingHeartRate', 'workouts', 'weight'] as const;
export function supportsNativeHealth(): boolean { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'; }

async function aggregate(dataType: 'steps' | 'calories' | 'restingHeartRate', aggregation: 'sum' | 'average'): Promise<number | undefined> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const result = await Health.queryAggregated({ dataType, startDate: start.toISOString(), endDate: new Date().toISOString(), bucket: 'day', aggregation });
  const values = result.samples.map((sample) => sample.value).filter(Number.isFinite);
  if (!values.length) return undefined;
  return aggregation === 'sum' ? Math.round(values.reduce((sum, value) => sum + value, 0)) : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function readNativeHealthSummary(requestPermission = false): Promise<NativeHealthSummary> {
  if (!supportsNativeHealth()) throw new Error('Apple Health sólo está disponible en la app de iPhone.');
  const available = await Health.isAvailable();
  if (!available.available) throw new Error('Apple Health no está disponible en este dispositivo.');
  if (requestPermission) await Health.requestAuthorization({ read: [...readTypes] });
  else {
    const status = await Health.checkAuthorization({ read: [...readTypes] });
    if (!status.readAuthorized.length) throw new Error('Conecta Apple Health para ver tu actividad autorizada.');
  }
  const [stepsToday, activeCaloriesToday, restingHeartRate] = await Promise.all([
    aggregate('steps', 'sum').catch(() => undefined),
    aggregate('calories', 'sum').catch(() => undefined),
    aggregate('restingHeartRate', 'average').catch(() => undefined),
  ]);
  return { stepsToday, activeCaloriesToday, restingHeartRate, source: 'Apple Health', updatedAt: new Date().toISOString() };
}
