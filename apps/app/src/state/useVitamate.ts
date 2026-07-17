import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { calculateNutritionTarget, buildWorkoutFeedback, generateStarterWorkoutPlan, generateWeeklyMealPlan, replaceWeeklyMealPlanIngredient, replaceWeeklyMealPlanOption, selectWeeklyMealPlanOption, weeklyMealPlanForDate, type AppLocale, type CoachChatMessage, type CoachMemoryUpdate, type HealthDocumentSummary, type MealEntry, type MealPlanOption, type PersonalFood, type SleepEntry, type UserProfile, type WeightEntry, type WorkoutDay, type WorkoutExerciseResult, type WorkoutSession } from '@vitamate/domain';
import { browserLocalRepository, type VitamateSnapshot } from '../data/localRepository';
import { fetchCloudSnapshot, reconcileCloudSnapshot } from '../services/cloudRepository';
import { supabase, supabaseConfigured } from '../services/supabase';
import { claimPromotionalTrial as claimRemotePromotionalTrial, deleteAccount as deleteRemoteAccount, fetchBillingStatus, reconcileCheckout as reconcileStripeCheckout, reconcileVoiceCheckout as reconcileStripeVoiceCheckout, registerAccount, requestAuthOtp, requestPasswordReset, resendRegistrationOtp, type BillingEntitlement, type BillingOffer, type OtpVerificationType, type PromotionalTrialOffer, type VoiceCreditBalance, type VoiceCreditOffer } from '../services/api';
import { loadBillingOffers, loadVoiceOffers, manageSubscription, nativeBilling, purchaseVoiceTime, restoreSubscriptions, startSubscription } from '../services/nativeBilling';
import { readNativeHealthSummary, supportsNativeHealth, type NativeHealthSummary } from '../services/nativeHealth';
import type { WellnessReminder } from '../models/reminders';
import { syncReminderNotifications } from '../services/reminders';
import { enableRemoteNotifications } from '../services/pushNotifications';

const localSnapshotOwnerKey = 'vitamate.snapshot.owner.v1';

function createId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi) cryptoApi.getRandomValues(bytes);
  else
    bytes.forEach((_, index) => {
      bytes[index] = Math.floor(Math.random() * 256);
    });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function useVitamate() {
  const [snapshot, setSnapshot] = useState<VitamateSnapshot>(() => browserLocalRepository.load());
  const [cloudEmail, setCloudEmail] = useState<string | null>(null);
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState('');
  const [sessionReady, setSessionReady] = useState(!supabase);
  const [cloudSnapshotReady, setCloudSnapshotReady] = useState(!supabase);
  const [billing, setBilling] = useState<BillingEntitlement | null>(null);
  const [promoTrial, setPromoTrial] = useState<PromotionalTrialOffer | null>(null);
  const [billingOffers, setBillingOffers] = useState<BillingOffer[]>([]);
  const [voiceBalance, setVoiceBalance] = useState<VoiceCreditBalance | null>(null);
  const [voiceOffers, setVoiceOffers] = useState<VoiceCreditOffer[]>([]);
  const [billingConfigured, setBillingConfigured] = useState<boolean | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingMessage, setBillingMessage] = useState('');
  const [healthSummary, setHealthSummary] = useState<NativeHealthSummary | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthMessage, setHealthMessage] = useState('');
  const [autoSyncPulse, setAutoSyncPulse] = useState(0);
  const autoSyncing = useRef(false);
  const lastAutoSyncedAt = useRef<string | null>(null);
  const latestSnapshot = useRef(snapshot);

  useEffect(() => {
    latestSnapshot.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const applySession = async (session: Session | null) => {
      setCloudEmail(session?.user.email ?? null);
      setCloudUserId(session?.user.id ?? null);
      if (!session) {
        if (!cancelled) setCloudSnapshotReady(true);
        return;
      }
      if (!cancelled) setCloudSnapshotReady(false);
      const localOwner = window.localStorage.getItem(localSnapshotOwnerKey);
      const ownerMismatch = Boolean(localOwner && localOwner !== session.user.id);
      if (ownerMismatch && !cancelled) {
        const empty = browserLocalRepository.empty();
        latestSnapshot.current = empty;
        setSnapshot(empty);
        browserLocalRepository.save(empty);
        window.localStorage.setItem(localSnapshotOwnerKey, session.user.id);
      }
      // Snapshots created before account scoping are adopted once by the
      // first authenticated account after this migration.
      if (!localOwner) window.localStorage.setItem(localSnapshotOwnerKey, session.user.id);
      try {
        const remote = await fetchCloudSnapshot(session.user.id);
        if (!cancelled && remote) {
          latestSnapshot.current = remote;
          setSnapshot(remote);
          browserLocalRepository.save(remote);
          window.localStorage.setItem(localSnapshotOwnerKey, session.user.id);
        } else if (!cancelled && (ownerMismatch || !latestSnapshot.current.profile)) {
          const empty = browserLocalRepository.empty();
          latestSnapshot.current = empty;
          setSnapshot(empty);
          browserLocalRepository.save(empty);
          window.localStorage.setItem(localSnapshotOwnerKey, session.user.id);
        }
      } catch {
        // Si la red falla conservamos únicamente los datos que ya estaban
        // asociados a esta cuenta; nunca exponemos los de otra persona.
      } finally {
        if (!cancelled) setCloudSnapshotReady(true);
      }
    };
    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session).finally(() => {
        if (!cancelled) setSessionReady(true);
      });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const refreshBilling = useCallback(async () => {
    if (!cloudUserId) {
      setBilling(null);
      setPromoTrial(null);
      return null;
    }
    setBillingBusy(true);
    setBillingMessage('');
    try {
      const result = await fetchBillingStatus();
      setBilling(result.entitlement);
      setPromoTrial(result.promoTrial ?? null);
      setVoiceBalance(result.voiceBalance ?? null);
      const serverVoiceOffers = result.voiceOffers ?? [];
      const [offers, callOffers] = await Promise.all([loadBillingOffers(result.offers).catch(() => (nativeBilling ? [] : result.offers)), loadVoiceOffers(serverVoiceOffers).catch(() => serverVoiceOffers)]);
      setBillingOffers(offers);
      setVoiceOffers(callOffers);
      setBillingConfigured(nativeBilling ? offers.length > 0 : result.configured);
      return result.entitlement;
    } catch (error) {
      setBillingConfigured(null);
      setBillingMessage(error instanceof Error ? error.message : 'No fue posible consultar tu suscripción.');
      return null;
    } finally {
      setBillingBusy(false);
    }
  }, [cloudUserId]);

  const claimPromotionalTrial = useCallback(async () => {
    if (!cloudUserId) throw new Error('Primero inicia sesión en tu cuenta.');
    setBillingBusy(true);
    setBillingMessage('');
    try {
      const result = await claimRemotePromotionalTrial();
      setBilling(result.entitlement);
      setPromoTrial(result.promoTrial);
      return result.entitlement;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible activar tu regalo Premium.';
      setBillingMessage(message);
      throw error;
    } finally {
      setBillingBusy(false);
    }
  }, [cloudUserId]);

  useEffect(() => {
    void refreshBilling();
  }, [refreshBilling]);

  useEffect(() => {
    void syncReminderNotifications(snapshot.reminders).catch(() => undefined);
  }, [snapshot.reminders]);

  const update = useCallback((recipe: (current: VitamateSnapshot) => VitamateSnapshot) => {
    // Persistimos antes de que una navegación externa (Checkout, enlace mágico,
    // cierre de Safari) pueda desmontar React. Evita reiniciar el cuestionario.
    const next = {
      ...recipe(latestSnapshot.current),
      cloudUpdatedAt: new Date().toISOString(),
    };
    latestSnapshot.current = next;
    browserLocalRepository.save(next);
    setSnapshot(next);
  }, []);

  const importHealthSummary = useCallback(
    (summary: NativeHealthSummary) => {
      setHealthSummary(summary);
      if (!summary.sleepEntries.length) return;
      update((current) => {
        const existingByExternalId = new Map(current.sleepEntries.filter((entry) => entry.externalId).map((entry) => [entry.externalId!, entry]));
        const imported = summary.sleepEntries.map((entry) => {
          const existing = entry.externalId ? existingByExternalId.get(entry.externalId) : undefined;
          return {
            ...entry,
            id: existing?.id ?? createId(),
            createdAt: existing?.createdAt ?? new Date().toISOString(),
          } satisfies SleepEntry;
        });
        const importedIds = new Set(imported.map((entry) => entry.externalId));
        return {
          ...current,
          sleepEntries: [...imported, ...current.sleepEntries.filter((entry) => !entry.externalId || !importedIds.has(entry.externalId))].sort((left, right) => right.endedAt.localeCompare(left.endedAt)).slice(0, 180),
        };
      });
    },
    [update],
  );

  useEffect(() => {
    if (!supportsNativeHealth() || window.localStorage.getItem('vitamate.health.connected') !== 'true') return;
    void readNativeHealthSummary()
      .then(importHealthSummary)
      .catch(() => undefined);
  }, [importHealthSummary]);

  useEffect(() => {
    const resume = () => {
      void refreshBilling();
      if (supportsNativeHealth() && window.localStorage.getItem('vitamate.health.connected') === 'true') {
        void readNativeHealthSummary()
          .then(importHealthSummary)
          .catch(() => undefined);
      }
    };
    window.addEventListener('vitamate:native-resume', resume);
    return () => window.removeEventListener('vitamate:native-resume', resume);
  }, [importHealthSummary, refreshBilling]);

  useEffect(() => {
    const complete = (event: Event) => {
      const reminderId = (event as CustomEvent<{ reminderId?: string }>).detail?.reminderId;
      if (!reminderId) return;
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        reminderLogs: [
          {
            id: createId(),
            reminderId,
            completedAt: now,
            outcome: 'completed' as const,
          },
          ...current.reminderLogs,
        ].slice(0, 500),
      }));
    };
    window.addEventListener('vitamate:reminder-completed', complete);
    return () => window.removeEventListener('vitamate:reminder-completed', complete);
  }, [update]);

  const completeOnboarding = useCallback(
    (profile: UserProfile) => {
      const nutritionTarget = calculateNutritionTarget(profile);
      update((current) => ({
        ...current,
        profile,
        nutritionTarget,
        workoutPlan: generateStarterWorkoutPlan(profile),
        mealPlans: [generateWeeklyMealPlan(profile, nutritionTarget)],
        planSelectionCompleted: false,
        weightEntries: current.weightEntries.length
          ? current.weightEntries
          : [
              {
                id: createId(),
                weightKg: profile.weightKg,
                recordedAt: new Date().toISOString(),
              },
            ],
      }));
    },
    [update],
  );

  const addMeal = useCallback(
    (
      meal: Omit<MealEntry, 'id' | 'createdAt' | 'source' | 'confirmed'> & {
        source?: MealEntry['source'];
      },
    ) => {
      const now = new Date().toISOString();
      const entry: MealEntry = {
        ...meal,
        id: createId(),
        createdAt: now,
        source: meal.source ?? 'manual',
        confirmed: true,
      };
      update((current) => ({ ...current, meals: [entry, ...current.meals] }));
      return entry.id;
    },
    [update],
  );

  const deleteMeal = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        meals: current.meals.filter((meal) => meal.id !== id),
      }));
    },
    [update],
  );

  const updateMeal = useCallback(
    (id: string, changes: Pick<MealEntry, 'name' | 'mealType' | 'occurredAt' | 'calories' | 'proteinG' | 'carbohydratesG' | 'fatG'>) => {
      update((current) => ({
        ...current,
        meals: current.meals.map((meal) => (meal.id === id ? { ...meal, ...changes, confirmed: true } : meal)),
      }));
    },
    [update],
  );

  const completeWorkout = useCallback(
    (day: WorkoutDay, durationMinutes: number, perceivedEffort: number) => {
      const session: WorkoutSession = {
        id: createId(),
        workoutDayId: day.id,
        workoutTitle: day.title,
        completedAt: new Date().toISOString(),
        durationMinutes,
        perceivedEffort,
      };
      update((current) => ({
        ...current,
        workoutSessions: [session, ...current.workoutSessions],
      }));
    },
    [update],
  );

  const completeGuidedWorkout = useCallback(
    (day: WorkoutDay, startedAt: string, durationMinutes: number, results: WorkoutExerciseResult[]) => {
      update((current) => {
        if (!current.profile) return current;
        const effort = Math.max(1, Math.min(10, Math.round((results.reduce((sum, result) => sum + result.difficulty, 0) / Math.max(1, results.length)) * 2)));
        const session: WorkoutSession = {
          id: createId(),
          workoutDayId: day.id,
          workoutTitle: day.title,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMinutes,
          perceivedEffort: effort,
          exerciseResults: results,
          source: 'guided',
          activityType: day.focus.toLocaleLowerCase('es-MX').includes('aerób') ? 'cardio' : 'strength',
          caloriesBurned: Math.round(durationMinutes * Math.max(4, current.profile.weightKg * 0.075)),
          requirementCreditMinutes: durationMinutes,
          feedback: buildWorkoutFeedback(current.profile, current.workoutSessions, results, durationMinutes),
        };
        return {
          ...current,
          workoutSessions: [session, ...current.workoutSessions],
        };
      });
    },
    [update],
  );

  const addManualWorkout = useCallback(
    (workout: { title: string; activityType: WorkoutSession['activityType']; completedAt: string; durationMinutes: number; caloriesBurned: number; perceivedEffort: number }) => {
      const id = createId();
      const session: WorkoutSession = {
        id,
        workoutDayId: 'manual',
        workoutTitle: workout.title,
        completedAt: workout.completedAt,
        startedAt: new Date(new Date(workout.completedAt).getTime() - workout.durationMinutes * 60_000).toISOString(),
        durationMinutes: workout.durationMinutes,
        perceivedEffort: workout.perceivedEffort,
        source: 'manual',
        activityType: workout.activityType,
        caloriesBurned: workout.caloriesBurned,
        requirementCreditMinutes: workout.durationMinutes,
        feedback: `Actividad registrada por VITACOACH: ${workout.durationMinutes} min y ${workout.caloriesBurned} kcal estimadas.`,
      };
      update((current) => ({
        ...current,
        workoutSessions: [session, ...current.workoutSessions],
      }));
      return id;
    },
    [update],
  );

  const deleteWorkoutSession = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        workoutSessions: current.workoutSessions.filter((session) => session.id !== id),
      }));
    },
    [update],
  );

  const updateWorkoutSession = useCallback(
    (
      id: string,
      changes: {
        workoutTitle: string;
        activityType: WorkoutSession['activityType'];
        completedAt: string;
        durationMinutes: number;
        caloriesBurned: number;
        perceivedEffort: number;
      },
    ) => {
      update((current) => ({
        ...current,
        workoutSessions: current.workoutSessions.map((session) =>
          session.id === id && session.source === 'manual'
            ? {
                ...session,
                ...changes,
                startedAt: new Date(new Date(changes.completedAt).getTime() - changes.durationMinutes * 60_000).toISOString(),
                requirementCreditMinutes: changes.durationMinutes,
              }
            : session,
        ),
      }));
    },
    [update],
  );

  const savePersonalFood = useCallback(
    (
      input: Omit<PersonalFood, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string;
      },
    ) => {
      const now = new Date().toISOString();
      update((current) => {
        const existing = input.id ? current.personalFoods.find((food) => food.id === input.id) : undefined;
        const food: PersonalFood = {
          ...input,
          id: input.id ?? createId(),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        return {
          ...current,
          personalFoods: existing ? current.personalFoods.map((item) => (item.id === food.id ? food : item)) : [food, ...current.personalFoods],
        };
      });
    },
    [update],
  );

  const deletePersonalFood = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        personalFoods: current.personalFoods.filter((food) => food.id !== id),
      }));
    },
    [update],
  );

  const setLocale = useCallback(
    (locale: AppLocale) => {
      update((current) => (current.profile ? { ...current, profile: { ...current.profile, locale } } : current));
    },
    [update],
  );

  const updateProfile = useCallback(
    (profile: UserProfile) => {
      const nutritionTarget = calculateNutritionTarget(profile);
      const newPlan = generateWeeklyMealPlan(profile, nutritionTarget);
      update((current) => ({
        ...current,
        profile,
        nutritionTarget,
        workoutPlan: generateStarterWorkoutPlan(profile),
        mealPlans: [...current.mealPlans.filter((plan) => plan.weekStart !== newPlan.weekStart), newPlan].slice(-8),
      }));
    },
    [update],
  );

  const updateCurrentMealPlan = useCallback(
    (recipe: (plan: NonNullable<ReturnType<typeof weeklyMealPlanForDate>>) => NonNullable<ReturnType<typeof weeklyMealPlanForDate>>) => {
      update((current) => {
        const plan = weeklyMealPlanForDate(current.mealPlans);
        if (!plan) return current;
        const nextPlan = recipe(plan);
        return {
          ...current,
          mealPlans: current.mealPlans.map((item) => (item.id === plan.id ? nextPlan : item)),
        };
      });
    },
    [update],
  );

  const selectMealPlanOption = useCallback(
    (slotId: string, optionIndex: 0 | 1) => {
      updateCurrentMealPlan((plan) => selectWeeklyMealPlanOption(plan, slotId, optionIndex));
    },
    [updateCurrentMealPlan],
  );

  const replaceMealPlanOption = useCallback(
    (slotId: string, option: MealPlanOption) => {
      updateCurrentMealPlan((plan) => replaceWeeklyMealPlanOption(plan, slotId, option));
    },
    [updateCurrentMealPlan],
  );

  const replaceMealPlanIngredient = useCallback(
    (ingredientToReplace: string, replacementIngredient: string, slotId?: string) => {
      updateCurrentMealPlan((plan) => replaceWeeklyMealPlanIngredient(plan, ingredientToReplace, replacementIngredient, slotId));
    },
    [updateCurrentMealPlan],
  );

  const addWeight = useCallback(
    (weightKg: number) => {
      const entry: WeightEntry = {
        id: createId(),
        weightKg,
        recordedAt: new Date().toISOString(),
      };
      update((current) => ({
        ...current,
        weightEntries: [entry, ...current.weightEntries],
      }));
    },
    [update],
  );

  const addSleep = useCallback(
    (input: Omit<SleepEntry, 'id' | 'createdAt'>) => {
      const entry: SleepEntry = {
        ...input,
        id: createId(),
        createdAt: new Date().toISOString(),
      };
      update((current) => ({
        ...current,
        sleepEntries: [entry, ...current.sleepEntries].sort((left, right) => right.endedAt.localeCompare(left.endedAt)).slice(0, 180),
      }));
      return entry.id;
    },
    [update],
  );

  const deleteSleep = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        sleepEntries: current.sleepEntries.filter((entry) => entry.id !== id),
      }));
    },
    [update],
  );

  const saveReminder = useCallback(
    (
      input: Omit<WellnessReminder, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string;
      },
    ) => {
      const now = new Date().toISOString();
      update((current) => {
        const existing = input.id ? current.reminders.find((reminder) => reminder.id === input.id) : undefined;
        const reminder: WellnessReminder = {
          ...input,
          id: input.id ?? createId(),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        return {
          ...current,
          reminders: existing ? current.reminders.map((item) => (item.id === reminder.id ? reminder : item)) : [reminder, ...current.reminders],
        };
      });
    },
    [update],
  );

  const deleteReminder = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        reminders: current.reminders.filter((reminder) => reminder.id !== id),
      }));
    },
    [update],
  );

  const completeReminder = useCallback(
    (reminderId: string, outcome: 'completed' | 'skipped' = 'completed') => {
      const entry = {
        id: createId(),
        reminderId,
        completedAt: new Date().toISOString(),
        outcome,
      } as const;
      update((current) => ({
        ...current,
        reminderLogs: [entry, ...current.reminderLogs].slice(0, 500),
      }));
    },
    [update],
  );

  const enableNotifications = useCallback(async () => {
    const permission = await syncReminderNotifications(latestSnapshot.current.reminders, true);
    if (permission !== 'granted') throw new Error('No se concedió permiso para mostrar notificaciones. Puedes activarlo después desde Configuración.');
    // El calendario local ya está activo en este punto. APNs es una capa
    // adicional y puede no estar disponible en el simulador o antes del
    // siguiente despliegue del backend, por lo que nunca invalida el permiso.
    if (cloudUserId) await enableRemoteNotifications(cloudUserId).catch(() => undefined);
    return permission;
  }, [cloudUserId]);

  const appendCoachMessages = useCallback(
    (messages: CoachChatMessage[]) => {
      update((current) => ({
        ...current,
        coachMessages: [...current.coachMessages, ...messages].slice(-200),
      }));
    },
    [update],
  );

  const mergeCoachMessages = useCallback(
    (messages: CoachChatMessage[]) => {
      update((current) => {
        const merged = new Map(current.coachMessages.map((message) => [message.id, message]));
        for (const message of messages) merged.set(message.id, message);
        return {
          ...current,
          coachMessages: [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-200),
        };
      });
    },
    [update],
  );

  const applyCoachMemoryUpdates = useCallback(
    (updates: CoachMemoryUpdate[]) => {
      if (!updates.length) return;
      update((current) => {
        const memories = new Map(current.coachMemories.map((memory) => [memory.key, memory]));
        const now = new Date().toISOString();
        for (const item of updates) {
          if (item.operation === 'delete') {
            memories.delete(item.key);
            continue;
          }
          memories.set(item.key, {
            key: item.key,
            category: item.category,
            content: item.content,
            importance: item.importance,
            confidence: item.confidence,
            expiresAt: item.ttlDays === null ? null : new Date(Date.now() + item.ttlDays * 86_400_000).toISOString(),
            updatedAt: now,
          });
        }
        const active = [...memories.values()].filter((memory) => !memory.expiresAt || new Date(memory.expiresAt).getTime() > Date.now());
        return {
          ...current,
          coachMemories: active.sort((a, b) => b.importance - a.importance || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 60),
        };
      });
    },
    [update],
  );

  const addHealthDocument = useCallback(
    (document: Omit<HealthDocumentSummary, 'id' | 'uploadedAt'>) => {
      const entry: HealthDocumentSummary = {
        ...document,
        id: createId(),
        uploadedAt: new Date().toISOString(),
      };
      update((current) => ({
        ...current,
        healthDocuments: [entry, ...current.healthDocuments].slice(0, 20),
      }));
      return entry.id;
    },
    [update],
  );

  const requestMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Falta configurar la clave publicable de Supabase en la PWA.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: nativeBilling ? 'mx.vitamate://auth/callback' : `${window.location.origin}/progreso`,
        },
      });
      if (error) throw error;
      setCloudMessage('Revisa tu correo y abre el enlace para iniciar sesión.');
    } finally {
      setCloudBusy(false);
    }
  }, []);

  const requestOtp = useCallback(async (email: string) => {
    const profile = latestSnapshot.current.profile;
    if (!profile) throw new Error('Completa primero tu cuestionario.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      const response = await requestAuthOtp({
        email,
        fullName: profile.fullName || profile.preferredName,
        preferredName: profile.preferredName,
      });
      setCloudMessage('Enviamos un código a tu correo.');
      return response;
    } finally {
      setCloudBusy(false);
    }
  }, []);

  const registerWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Falta configurar Supabase en la PWA.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      const response = await registerAccount({ email, password });
      setCloudMessage('Enviamos un código a tu correo.');
      return response;
    } finally {
      setCloudBusy(false);
    }
  }, []);

  const resendRegistrationCode = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Falta configurar Supabase en la PWA.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      const response = await resendRegistrationOtp(email.trim().toLocaleLowerCase('es-MX'));
      setCloudMessage('Enviamos un código nuevo a tu correo.');
      return response;
    } finally {
      setCloudBusy(false);
    }
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Falta configurar Supabase en la PWA.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLocaleLowerCase('es-MX'),
        password,
      });
      if (error) throw error;
      setCloudMessage('Sesión iniciada. Recuperando tu cuenta…');
    } finally {
      setCloudBusy(false);
    }
  }, []);

  const requestPasswordRecovery = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Falta configurar Supabase en la PWA.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      const response = await requestPasswordReset(email.trim().toLocaleLowerCase('es-MX'));
      setCloudMessage('Si existe una cuenta con ese correo, enviamos un código de recuperación.');
      return response;
    } finally {
      setCloudBusy(false);
    }
  }, []);

  const resetPasswordWithOtp = useCallback(async (email: string, token: string, password: string) => {
    if (!supabase) throw new Error('Falta configurar Supabase en la PWA.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      const { error: verificationError } = await supabase.auth.verifyOtp({
        email: email.trim().toLocaleLowerCase('es-MX'),
        token,
        type: 'recovery',
      });
      if (verificationError) throw verificationError;
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
      });
      if (passwordError) throw passwordError;
      setCloudMessage('Contraseña actualizada. Tu sesión está lista.');
    } finally {
      setCloudBusy(false);
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string, verificationType: OtpVerificationType) => {
    if (!supabase) throw new Error('Falta configurar Supabase en la PWA.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: verificationType,
      });
      if (error) throw error;
      setCloudMessage('Cuenta verificada. Tu historial ya puede protegerse en la nube.');
    } finally {
      setCloudBusy(false);
    }
  }, []);

  const completePlanSelection = useCallback(() => {
    update((current) => ({ ...current, planSelectionCompleted: true }));
  }, [update]);

  const reconcileCheckout = useCallback(async (sessionId: string) => {
    setBillingBusy(true);
    setBillingMessage('');
    try {
      const result = await reconcileStripeCheckout(sessionId);
      setBilling(result.entitlement);
      return result;
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : 'No fue posible confirmar tu suscripción.');
      throw error;
    } finally {
      setBillingBusy(false);
    }
  }, []);

  const reconcileVoiceCheckout = useCallback(async (sessionId: string) => {
    setBillingBusy(true);
    setBillingMessage('');
    try {
      const result = await reconcileStripeVoiceCheckout(sessionId);
      setVoiceBalance(result.voiceBalance);
      return result;
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : 'No fue posible confirmar tus minutos.');
      throw error;
    } finally {
      setBillingBusy(false);
    }
  }, []);

  const purchaseVoiceCredits = useCallback(
    async (offer: VoiceCreditOffer) => {
      if (!cloudUserId) throw new Error('Primero inicia sesión en tu cuenta.');
      setBillingBusy(true);
      setBillingMessage('');
      try {
        const result = await purchaseVoiceTime(offer, cloudUserId);
        if (result.voiceBalance) setVoiceBalance(result.voiceBalance);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible comprar minutos.';
        setBillingMessage(message);
        throw error;
      } finally {
        setBillingBusy(false);
      }
    },
    [cloudUserId],
  );

  const purchaseSubscription = useCallback(
    async (interval: 'month' | 'year') => {
      if (!cloudUserId) throw new Error('Primero inicia sesión en tu cuenta.');
      setBillingBusy(true);
      setBillingMessage('');
      try {
        const result = await startSubscription(interval, cloudUserId);
        if (result.entitlement) setBilling(result.entitlement);
        return result.entitlement ?? null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible completar la suscripción.';
        setBillingMessage(message);
        throw error;
      } finally {
        setBillingBusy(false);
      }
    },
    [cloudUserId],
  );

  const restoreSubscription = useCallback(async () => {
    if (!cloudUserId) throw new Error('Primero inicia sesión en tu cuenta.');
    setBillingBusy(true);
    setBillingMessage('');
    try {
      const result = await restoreSubscriptions(cloudUserId);
      setBilling(result.entitlement);
      return result.entitlement;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible restaurar tus compras.';
      setBillingMessage(message);
      throw error;
    } finally {
      setBillingBusy(false);
    }
  }, [cloudUserId]);

  const openSubscriptionManagement = useCallback(async () => {
    setBillingBusy(true);
    setBillingMessage('');
    try {
      const webPurchase = billing?.source === 'stripe' || (billing?.source !== 'apple' && Boolean(billing?.stripeCustomerId));
      if (nativeBilling && webPurchase) {
        throw new Error('Este plan fue adquirido en vitamate.mx. Adminístralo desde el sitio web donde realizaste la compra.');
      }
      await manageSubscription();
    } finally {
      setBillingBusy(false);
    }
  }, [billing?.source]);

  const connectHealth = useCallback(async () => {
    setHealthBusy(true);
    setHealthMessage('');
    try {
      const summary = await readNativeHealthSummary(true);
      window.localStorage.setItem('vitamate.health.connected', 'true');
      importHealthSummary(summary);
      setHealthMessage('Apple Health está conectado. Importamos únicamente la actividad y el sueño que autorizaste.');
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible conectar Apple Health.';
      setHealthMessage(message);
      throw error;
    } finally {
      setHealthBusy(false);
    }
  }, [importHealthSummary]);

  const refreshHealth = useCallback(async () => {
    setHealthBusy(true);
    setHealthMessage('');
    try {
      const summary = await readNativeHealthSummary();
      importHealthSummary(summary);
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible actualizar Apple Health.';
      setHealthMessage(message);
      throw error;
    } finally {
      setHealthBusy(false);
    }
  }, [importHealthSummary]);

  const syncCloud = useCallback(async () => {
    if (!cloudUserId) throw new Error('Primero inicia sesión.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      const result = await reconcileCloudSnapshot(cloudUserId, snapshot);
      lastAutoSyncedAt.current = result.snapshot.cloudUpdatedAt ?? null;
      setSnapshot(result.snapshot);
      browserLocalRepository.save(result.snapshot);
      window.localStorage.setItem(localSnapshotOwnerKey, cloudUserId);
      setCloudMessage(result.direction === 'uploaded' ? 'Tus datos locales se guardaron en la nube.' : 'Recuperamos la copia más reciente de la nube.');
    } finally {
      setCloudBusy(false);
    }
  }, [cloudUserId, snapshot]);

  useEffect(() => {
    if (!cloudUserId || !snapshot.profile || autoSyncing.current || lastAutoSyncedAt.current === snapshot.cloudUpdatedAt) return;
    const timer = window.setTimeout(async () => {
      autoSyncing.current = true;
      const sourceUpdatedAt = snapshot.cloudUpdatedAt ?? null;
      let shouldRetry = false;
      try {
        const result = await reconcileCloudSnapshot(cloudUserId, snapshot);
        if ((latestSnapshot.current.cloudUpdatedAt ?? null) === sourceUpdatedAt) {
          lastAutoSyncedAt.current = result.snapshot.cloudUpdatedAt ?? null;
          setSnapshot(result.snapshot);
          browserLocalRepository.save(result.snapshot);
          window.localStorage.setItem(localSnapshotOwnerKey, cloudUserId);
        } else {
          lastAutoSyncedAt.current = sourceUpdatedAt;
          shouldRetry = true;
        }
      } catch {
        // La sincronización manual continúa disponible si la red está temporalmente fuera de servicio.
      } finally {
        autoSyncing.current = false;
        if (shouldRetry) setAutoSyncPulse((value) => value + 1);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [autoSyncPulse, cloudUserId, snapshot]);

  const signOutCloud = useCallback(async () => {
    if (!supabase) return;
    setCloudBusy(true);
    try {
      await supabase.auth.signOut();
      setCloudMessage('Sesión cerrada. Tus datos locales permanecen en este dispositivo.');
    } finally {
      setCloudBusy(false);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!supabase || !cloudUserId) throw new Error('No encontramos una sesión activa.');
    setCloudBusy(true);
    setCloudMessage('');
    try {
      await deleteRemoteAccount();
      await supabase.auth.signOut({ scope: 'local' });
      const empty = browserLocalRepository.empty();
      browserLocalRepository.save(empty);
      window.localStorage.removeItem(localSnapshotOwnerKey);
      latestSnapshot.current = empty;
      setSnapshot(empty);
      setBilling(null);
      setPromoTrial(null);
      setVoiceBalance(null);
      setCloudMessage('Tu cuenta y sus datos fueron eliminados.');
    } finally {
      setCloudBusy(false);
    }
  }, [cloudUserId]);

  const billingPeriodActive = !billing?.currentPeriodEnd || Date.parse(billing.currentPeriodEnd) > Date.now();
  const isPremium = billing?.plan === 'premium' && ['active', 'trialing'].includes(billing.status) && billingPeriodActive;

  return {
    snapshot,
    completeOnboarding,
    completePlanSelection,
    updateProfile,
    selectMealPlanOption,
    replaceMealPlanOption,
    replaceMealPlanIngredient,
    addMeal,
    updateMeal,
    deleteMeal,
    completeWorkout,
    completeGuidedWorkout,
    addManualWorkout,
    updateWorkoutSession,
    deleteWorkoutSession,
    addWeight,
    addSleep,
    deleteSleep,
    saveReminder,
    deleteReminder,
    completeReminder,
    enableNotifications,
    appendCoachMessages,
    mergeCoachMessages,
    applyCoachMemoryUpdates,
    addHealthDocument,
    savePersonalFood,
    deletePersonalFood,
    setLocale,
    requestMagicLink,
    requestOtp,
    registerWithPassword,
    resendRegistrationCode,
    signInWithPassword,
    requestPasswordRecovery,
    resetPasswordWithOtp,
    verifyOtp,
    syncCloud,
    signOutCloud,
    deleteAccount,
    refreshBilling,
    reconcileCheckout,
    reconcileVoiceCheckout,
    billing: {
      entitlement: billing,
      promoTrial,
      offers: billingOffers,
      configured: billingConfigured,
      busy: billingBusy,
      message: billingMessage,
      isPremium,
      native: nativeBilling,
      refresh: refreshBilling,
      purchase: purchaseSubscription,
      claimPromotionalTrial,
      restore: restoreSubscription,
      manage: openSubscriptionManagement,
      voiceBalance,
      voiceOffers,
      purchaseVoice: purchaseVoiceCredits,
      setVoiceBalance,
    },
    health: {
      supported: supportsNativeHealth(),
      summary: healthSummary,
      busy: healthBusy,
      message: healthMessage,
      connect: connectHealth,
      refresh: refreshHealth,
    },
    cloud: {
      configured: supabaseConfigured,
      email: cloudEmail,
      userId: cloudUserId,
      sessionReady,
      snapshotReady: cloudSnapshotReady,
      busy: cloudBusy,
      message: cloudMessage,
    },
  };
}
