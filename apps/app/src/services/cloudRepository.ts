import { normalizeVitamateSnapshot, type VitamateSnapshot } from '../data/localRepository';
import { supabase } from './supabase';

interface RemoteProfileData {
  appSnapshot?: Omit<Partial<VitamateSnapshot>, 'schemaVersion'> & { schemaVersion?: number };
  snapshotUpdatedAt?: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function persistNormalizedHistory(userId: string, snapshot: VitamateSnapshot) {
  if (!supabase) return;
  const personalFoods = snapshot.personalFoods.filter((food) => uuidPattern.test(food.id)).map((food) => ({
    id: food.id, user_id: userId, name: food.name, serving_label: food.servingLabel, serving_quantity: 1,
    calories: food.calories, protein_g: food.proteinG, carbohydrates_g: food.carbohydratesG, fat_g: food.fatG,
    fiber_g: food.fiberG, updated_at: food.updatedAt, created_at: food.createdAt,
  }));
  if (personalFoods.length) { const { error } = await supabase.from('personal_foods').upsert(personalFoods); if (error) throw error; }

  const meals = snapshot.meals.filter((meal) => uuidPattern.test(meal.id)).map((meal) => ({
    id: meal.id, user_id: userId, source: meal.source, meal_type: meal.mealType, name_snapshot: meal.name,
    calories: meal.calories, protein_g: meal.proteinG, carbohydrates_g: meal.carbohydratesG, fat_g: meal.fatG,
    quantity_grams: meal.quantityGrams ?? null,
    user_confirmed: meal.confirmed, occurred_at: meal.occurredAt, created_at: meal.createdAt,
    plan_slot_id: meal.planSlotId ?? null, plan_option_id: meal.planOptionId ?? null,
  }));
  if (meals.length) { const { error } = await supabase.from('meal_entries').upsert(meals); if (error) throw error; }

  const weights = snapshot.weightEntries.filter((entry) => uuidPattern.test(entry.id)).map((entry) => ({
    id: entry.id, user_id: userId, weight_kg: entry.weightKg, recorded_at: entry.recordedAt,
  }));
  if (weights.length) { const { error } = await supabase.from('weight_entries').upsert(weights); if (error) throw error; }

  const coachMessages = snapshot.coachMessages.filter((message) => uuidPattern.test(message.id)).map((message) => ({
    id: message.id, user_id: userId, role: message.role, content: message.content, created_at: message.createdAt,
  }));
  if (coachMessages.length) { const { error } = await supabase.from('coach_messages').upsert(coachMessages); if (error) throw error; }

  const healthDocuments = snapshot.healthDocuments.filter((document) => uuidPattern.test(document.id)).map((document) => ({
    id: document.id, user_id: userId, filename: document.filename, mime_type: document.mimeType,
    summary: document.summary, uploaded_at: document.uploadedAt,
  }));
  if (healthDocuments.length) { const { error } = await supabase.from('health_documents').upsert(healthDocuments); if (error) throw error; }

  const sessions = snapshot.workoutSessions.filter((session) => uuidPattern.test(session.id));
  if (sessions.length) {
    const sessionRows = sessions.map((session) => ({
      id: session.id, user_id: userId, workout_day_id: session.workoutDayId, workout_title: session.workoutTitle,
      started_at: session.startedAt ?? new Date(new Date(session.completedAt).getTime() - session.durationMinutes * 60_000).toISOString(),
      completed_at: session.completedAt, duration_seconds: session.durationMinutes * 60,
      perceived_effort: session.perceivedEffort, feedback: session.feedback ?? null,
      source: session.source ?? 'guided', activity_type: session.activityType ?? null,
      calories_burned: session.caloriesBurned ?? null, requirement_credit_minutes: session.requirementCreditMinutes ?? session.durationMinutes,
    }));
    const { error } = await supabase.from('workout_sessions').upsert(sessionRows); if (error) throw error;
    for (const session of sessions) {
      if (!session.exerciseResults?.length) continue;
      const { error: deleteError } = await supabase.from('workout_session_exercises').delete().eq('session_id', session.id);
      if (deleteError) throw deleteError;
      const rows = session.exerciseResults.map((result, index) => ({
        session_id: session.id, exercise_slug: result.exerciseSlug, exercise_name: result.exerciseName,
        order_index: index, target_reps: result.targetReps, completed_reps: result.completedReps,
        target_seconds: result.targetSeconds, completed_seconds: result.completedSeconds, difficulty: result.difficulty,
        started_at: session.startedAt ?? null, completed_at: session.completedAt,
        prescribed_load_kg: result.prescribedLoadKg ?? null, set_results: result.sets ?? [],
      }));
      const { data: inserted, error: exerciseError } = await supabase.from('workout_session_exercises').insert(rows).select('id,order_index');
      if (exerciseError) throw exerciseError;
      const repRows = (inserted ?? []).flatMap((row) => {
        const result = session.exerciseResults?.[row.order_index];
        return (result?.repTimestamps ?? []).map((occurredAt, index) => ({ session_exercise_id: row.id, rep_number: index + 1, occurred_at: occurredAt }));
      });
      if (repRows.length) { const { error: repError } = await supabase.from('workout_rep_events').insert(repRows); if (repError) throw repError; }
    }
  }
}

export async function reconcileCloudSnapshot(userId: string, local: VitamateSnapshot): Promise<{ snapshot: VitamateSnapshot; direction: 'uploaded' | 'downloaded' }> {
  if (!supabase || !local.profile) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('profiles').select('profile_data,updated_at').eq('id', userId).maybeSingle();
  if (error) throw error;

  const remoteData = (data?.profile_data ?? {}) as RemoteProfileData;
  const remote = remoteData.appSnapshot;
  const localTime = new Date(local.cloudUpdatedAt ?? local.profile.completedAt).getTime();
  const remoteTime = new Date(remoteData.snapshotUpdatedAt ?? data?.updated_at ?? 0).getTime();
  if (remote && [3, 4, 5].includes(remote.schemaVersion ?? 0) && remoteTime > localTime) return {
    snapshot: normalizeVitamateSnapshot(remote),
    direction: 'downloaded',
  };

  const now = new Date().toISOString();
  const snapshot = { ...local, cloudUpdatedAt: now };
  const { error: upsertError } = await supabase.from('profiles').upsert({
    id: userId,
    preferred_name: local.profile.preferredName,
    locale: local.profile.locale,
    timezone: local.profile.timezone,
    units: local.profile.units,
    profile_data: { appSnapshot: snapshot, snapshotUpdatedAt: now },
    updated_at: now,
  });
  if (upsertError) throw upsertError;
  await persistNormalizedHistory(userId, snapshot);
  return { snapshot, direction: 'uploaded' };
}

/** Restores the one durable snapshot for an already authenticated account.
 * It intentionally never uploads browser data: signing into a different
 * account on the same device must not overwrite that person's history. */
export async function fetchCloudSnapshot(userId: string): Promise<VitamateSnapshot | null> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase
    .from('profiles')
    .select('profile_data')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  const remoteData = (data?.profile_data ?? {}) as RemoteProfileData;
  const remote = remoteData.appSnapshot;
  return remote && [3, 4, 5].includes(remote.schemaVersion ?? 0)
    ? normalizeVitamateSnapshot(remote)
    : null;
}
