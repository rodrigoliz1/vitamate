import { Capacitor } from '@capacitor/core';
import { Health, type HealthSample } from '@capgo/capacitor-health';
import type { SleepEntry } from '@vitamate/domain';

export interface NativeHealthSummary {
  stepsToday?: number;
  activeCaloriesToday?: number;
  restingHeartRate?: number;
  sleepEntries: Array<Omit<SleepEntry, 'id' | 'createdAt'>>;
  source: 'Apple Health';
  updatedAt: string;
}

const readTypes = ['steps', 'calories', 'restingHeartRate', 'sleep'] as const;
export function supportsNativeHealth(): boolean { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'; }

async function aggregate(dataType: 'steps' | 'calories' | 'restingHeartRate', aggregation: 'sum' | 'average'): Promise<number | undefined> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const result = await Health.queryAggregated({ dataType, startDate: start.toISOString(), endDate: new Date().toISOString(), bucket: 'day', aggregation });
  const values = result.samples.map((sample) => sample.value).filter(Number.isFinite);
  if (!values.length) return undefined;
  return aggregation === 'sum' ? Math.round(values.reduce((sum, value) => sum + value, 0)) : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sleepNightKey(endedAt: string): string {
  const date = new Date(endedAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeAppleSleep(samples: HealthSample[]): Array<Omit<SleepEntry, 'id' | 'createdAt'>> {
  const byNightAndSource = new Map<string, HealthSample[]>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.value) || sample.value <= 0 || !sample.sleepState || sample.sleepState === 'inBed') continue;
    const key = `${sleepNightKey(sample.endDate)}::${sample.sourceId ?? sample.sourceName ?? 'apple-health'}`;
    byNightAndSource.set(key, [...(byNightAndSource.get(key) ?? []), sample]);
  }
  const bestByNight = new Map<string, HealthSample[]>();
  for (const [key, sourceSamples] of byNightAndSource) {
    const night = key.split('::')[0];
    const detailed = sourceSamples.filter((sample) => ['rem', 'deep', 'light'].includes(sample.sleepState ?? ''));
    const asleep = sourceSamples.filter((sample) => sample.sleepState === 'asleep');
    const chosen = detailed.length ? detailed : asleep;
    const current = bestByNight.get(night) ?? [];
    const total = chosen.reduce((sum, sample) => sum + sample.value, 0);
    const currentTotal = current.reduce((sum, sample) => sum + sample.value, 0);
    if (total > currentTotal) bestByNight.set(night, chosen);
  }
  return [...bestByNight.entries()].map(([night, nightSamples]) => {
    const startedAt = nightSamples.map((sample) => sample.startDate).sort()[0];
    const endedAt = nightSamples.map((sample) => sample.endDate).sort().at(-1)!;
    const stageMinutes = (stage: HealthSample['sleepState']) => Math.round(nightSamples.filter((sample) => sample.sleepState === stage).reduce((sum, sample) => sum + sample.value, 0));
    return {
      startedAt,
      endedAt,
      durationMinutes: Math.min(1_440, Math.round(nightSamples.reduce((sum, sample) => sum + sample.value, 0))),
      source: 'apple_health' as const,
      externalId: `apple-health-sleep:${night}`,
      stages: {
        remMinutes: stageMinutes('rem') || undefined,
        deepMinutes: stageMinutes('deep') || undefined,
        lightMinutes: stageMinutes('light') || undefined,
      },
    };
  }).sort((left, right) => right.endedAt.localeCompare(left.endedAt));
}

async function readSleepEntries(): Promise<Array<Omit<SleepEntry, 'id' | 'createdAt'>>> {
  const start = new Date(Date.now() - 8 * 86_400_000);
  const result = await Health.readSamples({ dataType: 'sleep', startDate: start.toISOString(), endDate: new Date().toISOString(), limit: 500, ascending: true });
  return normalizeAppleSleep(result.samples);
}

export async function readNativeHealthSummary(requestPermission = false): Promise<NativeHealthSummary> {
  if (!supportsNativeHealth()) throw new Error('Apple Health sólo está disponible en la app de iPhone.');
  const available = await Health.isAvailable();
  if (!available.available) throw new Error('Apple Health no está disponible en este dispositivo.');
  if (requestPermission) await Health.requestAuthorization({ read: [...readTypes], write: [] });
  else {
    const status = await Health.checkAuthorization({ read: [...readTypes] });
    if (!status.readAuthorized.length) throw new Error('Conecta Apple Health para ver tu actividad autorizada.');
  }
  const [stepsToday, activeCaloriesToday, restingHeartRate, sleepEntries] = await Promise.all([
    aggregate('steps', 'sum').catch(() => undefined),
    aggregate('calories', 'sum').catch(() => undefined),
    aggregate('restingHeartRate', 'average').catch(() => undefined),
    readSleepEntries().catch(() => []),
  ]);
  return { stepsToday, activeCaloriesToday, restingHeartRate, sleepEntries, source: 'Apple Health', updatedAt: new Date().toISOString() };
}
