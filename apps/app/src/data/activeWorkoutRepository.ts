import type { WorkoutDay, WorkoutExerciseResult, WorkoutSetResult } from '@vitamate/domain';

export interface ActiveExerciseDraft {
  reps: number;
  completedSets: WorkoutSetResult[];
  loadInput: string;
  repTimestamps: string[];
  timedSeconds: number;
}

export interface ActiveWorkoutState {
  day: WorkoutDay;
  profileCompletedAt: string;
  startedAt: string;
  updatedAt: string;
  elapsedSeconds: number;
  queue: string[];
  drafts: Record<string, ActiveExerciseDraft>;
  results: WorkoutExerciseResult[];
}

const KEY = 'vitamate.active-workout.v1';

export function createActiveWorkout(day: WorkoutDay, profileCompletedAt: string): ActiveWorkoutState {
  const now = new Date().toISOString();
  return { day, profileCompletedAt, startedAt: now, updatedAt: now, elapsedSeconds: 0, queue: day.exercises.map(({ id }) => id), drafts: {}, results: [] };
}

export const activeWorkoutRepository = {
  load(profileCompletedAt: string): ActiveWorkoutState | null {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as ActiveWorkoutState;
      if (value.profileCompletedAt !== profileCompletedAt || !value.day?.exercises?.length || !value.queue?.length) return null;
      const backgroundSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(value.updatedAt)) / 1000));
      return { ...value, elapsedSeconds: Math.max(0, value.elapsedSeconds + backgroundSeconds), updatedAt: new Date().toISOString() };
    } catch {
      return null;
    }
  },
  save(state: ActiveWorkoutState): void {
    window.localStorage.setItem(KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  },
  clear(): void {
    window.localStorage.removeItem(KEY);
  },
};
