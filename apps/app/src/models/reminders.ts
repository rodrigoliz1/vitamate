export type ReminderKind = 'water' | 'medication' | 'meal' | 'workout' | 'vitacoach' | 'custom';

export interface WellnessReminder {
  id: string;
  kind: ReminderKind;
  title: string;
  details: string;
  /** Local time in HH:mm, one or more moments per selected day. */
  times: string[];
  /** JavaScript weekday numbers: Sunday 0 through Saturday 6. */
  weekdays: number[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderLog {
  id: string;
  reminderId: string;
  completedAt: string;
  outcome: 'completed' | 'skipped';
}

export const REMINDER_KIND_LABELS: Record<ReminderKind, string> = {
  water: 'Agua',
  medication: 'Medicamento o suplemento',
  meal: 'Comida',
  workout: 'Entrenamiento',
  vitacoach: 'VITACOACH',
  custom: 'Personalizado',
};

