import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { IonActionSheet, IonButton, IonContent, IonFooter, IonIcon, IonModal, IonPage, IonSpinner, useIonViewDidEnter } from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { callOutline, cameraOutline, chatbubbleEllipsesOutline, checkmarkCircleOutline, closeOutline, documentAttachOutline, folderOpenOutline, imagesOutline, micOutline, micOffOutline, paperPlaneOutline, refreshOutline, shieldCheckmarkOutline, sparklesOutline } from 'ionicons/icons';
import { buildWeeklyNutritionBalance, buildWeeklyWorkoutBalance, summarizeNutritionDay, weeklyMealPlanForDate, type CoachChatMessage, type CoachMemoryUpdate, type HealthDocumentSummary, type MealEntry, type MealPlanOption, type MealType, type SleepEntry, type WorkoutSession } from '@vitamate/domain';
import { BrandMark } from '../components/BrandMark';
import { VoiceCreditsModal } from '../components/VoiceCreditsModal';
import { resolveUiLocale } from '../config/appFeatures';
import type { VitamateSnapshot } from '../data/localRepository';
import { fetchCoachHistory, fetchRealtimeToken, heartbeatCoachCall, recalculateCoachMeal, recordCoachCall, sendCoachMessage, startCoachCall, type CoachAction, type CoachChatContext, type RealtimeCallUsage, type VoiceCreditBalance, type VoiceCreditOffer } from '../services/api';
import { pickNativePhoto, type NativePhotoSource } from '../services/nativeCamera';
import { isNativeIos } from '../services/nativePlatform';
import { prepareFoodPhoto } from '../services/imageCompression';

interface CoachProps {
  snapshot: VitamateSnapshot;
  healthSummary?: CoachChatContext['healthSummary'];
  voiceBalance: VoiceCreditBalance | null;
  voiceOffers: VoiceCreditOffer[];
  billingBusy: boolean;
  billingMessage: string;
  onRefreshVoice(): Promise<unknown>;
  onPurchaseVoice(offer: VoiceCreditOffer): Promise<unknown>;
  onVoiceBalance(balance: VoiceCreditBalance): void;
  onAppendMessages: (messages: CoachChatMessage[]) => void;
  onMergeMessages: (messages: CoachChatMessage[]) => void;
  onApplyMemoryUpdates: (updates: CoachMemoryUpdate[]) => void;
  onAddMeal(
    meal: Omit<MealEntry, 'id' | 'createdAt' | 'source' | 'confirmed'> & {
      source?: MealEntry['source'];
    },
  ): string;
  onDeleteMeal(id: string): void;
  onAddManualWorkout(workout: { title: string; activityType: WorkoutSession['activityType']; completedAt: string; durationMinutes: number; caloriesBurned: number; perceivedEffort: number }): string;
  onDeleteWorkout(id: string): void;
  onAddSleep(sleep: Omit<SleepEntry, 'id' | 'createdAt'>): string;
  onDeleteSleep(id: string): void;
  onAddHealthDocument(document: Omit<HealthDocumentSummary, 'id' | 'uploadedAt'>): string;
  onReplaceMealPlanOption(slotId: string, option: MealPlanOption): void;
  onReplaceMealPlanIngredient(ingredientToReplace: string, replacementIngredient: string, slotId?: string): void;
}

type PendingCoachRecord =
  | { kind: 'meal'; preview?: string; source: 'chat' | 'photo'; meal: Extract<CoachAction, { type: 'log_meal' }>['meal']; sourceChecked: boolean }
  | { kind: 'workout'; preview?: string; source: 'chat' | 'photo'; workout: Extract<CoachAction, { type: 'log_workout' }>['workout'] };

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

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Colación',
};

const Coach = ({ snapshot, healthSummary, voiceBalance, voiceOffers, billingBusy, billingMessage, onRefreshVoice, onPurchaseVoice, onVoiceBalance, onAppendMessages, onMergeMessages, onApplyMemoryUpdates, onAddMeal, onDeleteMeal, onAddManualWorkout, onDeleteWorkout, onAddSleep, onDeleteSleep, onAddHealthDocument, onReplaceMealPlanOption, onReplaceMealPlanIngredient }: CoachProps) => {
  const profile = snapshot.profile!;
  const location = useLocation();
  const uiLocale = resolveUiLocale(profile.locale);
  const english = uiLocale === 'en-US';
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingRecord, setPendingRecord] = useState<PendingCoachRecord | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceCatalogOpen, setVoiceCatalogOpen] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [lastAction, setLastAction] = useState<{
    kind: 'meal' | 'workout' | 'sleep' | 'plan';
    id?: string;
    label: string;
  } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLElement>(null);
  const photoAlbumRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const suggestions = english ? ['Plan my day', 'How can I reach my protein goal?', 'Be honest about my progress'] : ['Planea mi día', '¿Cómo alcanzo mi proteína?', 'Sé honesto con mi progreso'];
  const openVoice = () => {
    void onRefreshVoice();
    if (voiceBalance && voiceBalance.totalRemainingSeconds <= 0) setVoiceCatalogOpen(true);
    else setVoiceOpen(true);
  };

  const context = (message = '', includeActionContext = false): CoachChatContext => {
    const todayNutrition = summarizeNutritionDay(snapshot.meals);
    const weeklyNutrition = buildWeeklyNutritionBalance(snapshot.meals, snapshot.nutritionTarget);
    const weeklyWorkout = buildWeeklyWorkoutBalance(profile, snapshot.workoutSessions);
    const latestWeight = snapshot.weightEntries[0];
    const currentMealPlan = weeklyMealPlanForDate(snapshot.mealPlans);
    const recentSleep = snapshot.sleepEntries.slice(0, 7);
    const parameters = new URLSearchParams(location.search);
    const planAction = parameters.get('planAction');
    const planChangeTarget =
      planAction === 'replace_meal'
        ? {
            type: 'replace_meal' as const,
            slotId: parameters.get('planSlotId') ?? undefined,
          }
        : planAction === 'replace_ingredient'
          ? {
              type: 'replace_ingredient' as const,
              ingredient: parameters.get('ingredient') ?? undefined,
            }
          : undefined;
    const normalizedMessage = message.toLocaleLowerCase('es-MX');
    const needsPlan = includeActionContext || Boolean(planChangeTarget) || /(cambia|reemplaza|sustituye|intercambia).*(plan|menú|menu|comida|ingrediente)/.test(normalizedMessage);
    const needsHealthDocuments = /laboratorio|análisis|analisis|estudio|documento|pdf|resultado|glucosa|colesterol/.test(normalizedMessage);
    const needsWorkoutCatalog = !message || /entren|ejercicio|rutina|serie|repetición|repeticion|gym|fuerza|cardio/.test(normalizedMessage);
    return {
      locale: uiLocale,
      currentDateTime: new Date().toISOString(),
      timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      profile: {
        preferredName: profile.preferredName,
        primaryGoal: profile.primaryGoal,
        activityLevel: profile.activityLevel,
        weeklyTrainingDays: profile.weeklyTrainingDays,
        trainingMinutes: profile.trainingMinutes,
        equipment: profile.equipment,
        dietaryPattern: profile.dietaryPattern,
        coachStyle: profile.coachStyle,
        safetyFlags: profile.safetyFlags,
        favoriteFoods: profile.favoriteFoods ?? [],
        dislikedFoods: profile.dislikedFoods ?? [],
        allergies: profile.allergies ?? [],
        preferredCuisines: profile.preferredCuisines ?? [],
        mealsPerDay: profile.mealsPerDay,
        cookingLevel: profile.cookingLevel,
        supplements: profile.supplements ?? [],
        trainingPreference: profile.trainingPreference,
        preferredSport: profile.preferredSport,
        mealPreparationPreference: profile.mealPreparationPreference,
        mealPrepStructure: profile.mealPrepStructure,
        mealPrepRotationDays: profile.mealPrepRotationDays,
        weeklyFoodBudgetMxn: profile.weeklyFoodBudgetMxn,
      },
      nutritionTarget: snapshot.nutritionTarget
        ? {
            status: snapshot.nutritionTarget.status,
            calories: snapshot.nutritionTarget.calories,
            proteinG: snapshot.nutritionTarget.proteinG,
            carbohydratesG: snapshot.nutritionTarget.carbohydratesG,
            fatG: snapshot.nutritionTarget.fatG,
          }
        : undefined,
      recentWorkouts: snapshot.workoutSessions.slice(0, 5).map((session) => ({
        workoutTitle: session.workoutTitle,
        durationMinutes: session.durationMinutes,
        perceivedEffort: session.perceivedEffort,
        completedAt: session.completedAt,
      })),
      availableWorkouts: needsWorkoutCatalog
        ? (snapshot.workoutPlan?.days ?? []).slice(0, 4).map((day) => ({
            title: day.title,
            focus: day.focus,
            durationMinutes: day.durationMinutes,
            exercises: day.exercises.slice(0, 8).map((exercise) => `${exercise.name}: ${exercise.sets} × ${exercise.repRange}`),
          }))
        : [],
      todayNutrition,
      weeklyNutrition: weeklyNutrition
        ? {
            consumed: weeklyNutrition.consumed,
            target: weeklyNutrition.target,
            balance: weeklyNutrition.balance,
          }
        : undefined,
      weeklyWorkout,
      weightTrend: latestWeight
        ? {
            latestKg: latestWeight.weightKg,
            previousKg: snapshot.weightEntries[1]?.weightKg ?? null,
          }
        : undefined,
      healthDocuments: needsHealthDocuments
        ? snapshot.healthDocuments.slice(0, 3).map(({ filename, uploadedAt, summary }) => ({
            filename,
            uploadedAt,
            summary: summary.slice(0, 1200),
          }))
        : [],
      healthSummary,
      sleepSummary: {
        latestMinutes: recentSleep[0]?.durationMinutes,
        averageMinutes7Days: recentSleep.length ? Math.round(recentSleep.reduce((sum, entry) => sum + entry.durationMinutes, 0) / recentSleep.length) : undefined,
        recent: recentSleep.map(({ startedAt, endedAt, durationMinutes, quality, source }) => ({
          startedAt,
          endedAt,
          durationMinutes,
          quality,
          source,
        })),
      },
      mealPlanContext: needsPlan && currentMealPlan ? JSON.stringify(currentMealPlan) : undefined,
      planChangeTarget,
    };
  };

  useEffect(() => {
    const prefill = new URLSearchParams(location.search).get('draft');
    if (prefill) setDraft(prefill);
  }, [location.search]);

  useEffect(() => {
    if (isNativeIos) return undefined;
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const syncKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty('--vitacoach-keyboard-inset', `${inset}px`);
      document.documentElement.style.setProperty('--vitacoach-viewport-height', `${viewport.height}px`);
      document.documentElement.style.setProperty('--vitacoach-viewport-top', `${viewport.offsetTop}px`);
      document.documentElement.classList.toggle('vitacoach-keyboard-open', inset > 96);
    };
    syncKeyboardInset();
    viewport.addEventListener('resize', syncKeyboardInset);
    viewport.addEventListener('scroll', syncKeyboardInset);
    return () => {
      viewport.removeEventListener('resize', syncKeyboardInset);
      viewport.removeEventListener('scroll', syncKeyboardInset);
      document.documentElement.style.removeProperty('--vitacoach-keyboard-inset');
      document.documentElement.style.removeProperty('--vitacoach-viewport-height');
      document.documentElement.style.removeProperty('--vitacoach-viewport-top');
      document.documentElement.classList.remove('vitacoach-keyboard-open');
    };
  }, []);

  useIonViewDidEnter(() => {
    void fetchCoachHistory(100)
      .then((messages) => {
        if (messages.length) onMergeMessages(messages);
      })
      .catch(() => undefined);
    window.requestAnimationFrame(() => {
      const element = conversationRef.current;
      if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
    });
  });
  useEffect(() => {
    const element = conversationRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [snapshot.coachMessages.length, busy, pendingRecord, lastAction]);

  const applyCoachAction = (action: CoachAction): { success: true; message: string } => {
    if (action.type === 'log_meal') {
      const id = onAddMeal({ ...action.meal, source: 'manual' });
      setLastAction({ kind: 'meal', id, label: action.meal.name });
      return {
        success: true,
        message: english ? `${action.meal.name} was registered.` : `${action.meal.name} quedó registrada.`,
      };
    }
    if (action.type === 'log_workout') {
      const id = onAddManualWorkout({
        title: action.workout.title,
        activityType: action.workout.activityType,
        completedAt: action.workout.occurredAt,
        durationMinutes: action.workout.durationMinutes,
        caloriesBurned: action.workout.caloriesBurned,
        perceivedEffort: action.workout.perceivedEffort,
      });
      setLastAction({ kind: 'workout', id, label: action.workout.title });
      return {
        success: true,
        message: english ? `${action.workout.title} was registered.` : `${action.workout.title} quedó registrada.`,
      };
    }
    if (action.type === 'log_sleep') {
      const id = onAddSleep({ ...action.sleep, source: 'vitacoach' });
      const label = `${Math.floor(action.sleep.durationMinutes / 60)} h ${action.sleep.durationMinutes % 60} min`;
      setLastAction({ kind: 'sleep', id, label });
      return {
        success: true,
        message: english ? `${label} of sleep was registered.` : `Se registraron ${label} de sueño.`,
      };
    }
    if (action.type === 'replace_plan_meal') {
      onReplaceMealPlanOption(action.change.slotId, action.change.option);
      setLastAction({
        kind: 'plan',
        label: `${action.change.option.name} · plan y súper actualizados`,
      });
      return {
        success: true,
        message: english ? 'The meal plan and grocery list were updated.' : 'El plan y la lista del súper quedaron actualizados.',
      };
    }
    onReplaceMealPlanIngredient(action.change.ingredientToReplace, action.change.replacementIngredient, action.change.slotId);
    setLastAction({
      kind: 'plan',
      label: `${action.change.ingredientToReplace} → ${action.change.replacementIngredient}`,
    });
    return {
      success: true,
      message: english ? 'The ingredient was replaced in the plan and grocery list.' : 'El ingrediente se sustituyó en el plan y la lista del súper.',
    };
  };

  const stageCoachAction = async (action: CoachAction, source: 'chat' | 'photo' = 'chat', preview?: string) => {
    if (action.type === 'log_meal') {
      setPendingRecord({ kind: 'meal', source, preview, meal: action.meal, sourceChecked: false });
      try {
        const result = await recalculateCoachMeal({
          description: action.meal.name,
          mealType: action.meal.mealType,
          occurredAt: action.meal.occurredAt,
          timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: uiLocale,
        });
        setPendingRecord((current) => current?.kind === 'meal'
          ? { ...current, meal: { ...result.meal, mealType: current.meal.mealType, occurredAt: current.meal.occurredAt }, sourceChecked: true }
          : current);
      } catch {
        // El usuario aún puede corregir los valores sugeridos manualmente.
      }
      return;
    }
    if (action.type === 'log_workout') {
      setPendingRecord({ kind: 'workout', source, preview, workout: action.workout });
      return;
    }
    applyCoachAction(action);
  };

  const ask = async (
    content: string,
    options?: {
      appendUser?: boolean;
      history?: CoachChatMessage[];
      attachment?: string | { filename: string; mimeType: 'application/pdf'; dataUrl: string };
    },
  ): Promise<string | null> => {
    if (!content.trim() || busy) return null;
    setError('');
    setBusy(true);
    const appendUser = options?.appendUser ?? true;
    const userMessage: CoachChatMessage = {
      id: createId(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    const history = options?.history ?? snapshot.coachMessages;
    if (appendUser) onAppendMessages([userMessage]);
    try {
      const reply = await sendCoachMessage(context(content.trim()), history, content.trim(), options?.attachment, appendUser ? userMessage : undefined, snapshot.coachMemories);
      if (reply.action) await stageCoachAction(reply.action);
      onAppendMessages([
        reply.assistantMessage ?? {
          id: createId(),
          role: 'assistant',
          content: reply.response,
          createdAt: new Date().toISOString(),
        },
      ]);
      onApplyMemoryUpdates(reply.memoryUpdates ?? []);
      return reply.response;
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : english ? 'Could not contact VITACOACH.' : 'No fue posible contactar a VITACOACH.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event?: FormEvent, suggestion?: string) => {
    event?.preventDefault();
    const content = (suggestion ?? draft).trim();
    if (!content) return;
    setDraft('');
    await ask(content);
  };

  const processPhoto = async (preview: string) => {
    if (preview.length > 7_500_000) return setError('La imagen debe pesar menos de 5.5 MB.');
    const photoMessage: CoachChatMessage = {
      id: createId(),
      role: 'user',
      content: '📷 Foto enviada a VITACOACH',
      createdAt: new Date().toISOString(),
    };
    onAppendMessages([photoMessage]);
    setBusy(true);
    setError('');
    try {
      const prompt = `Analiza la imagen antes de asumir qué contiene. Si muestra una caminadora, reloj, bicicleta, máquina o resumen de actividad física ya realizada, lee únicamente las métricas visibles y devuelve log_workout. Si muestra comida o bebida ya consumida, devuelve log_meal. Si no es posible identificar un registro real, no devuelvas acción. En actividad usa el tiempo, calorías, distancia, velocidad e inclinación visibles para titular y estimar; no inventes datos ilegibles. En comida estima con prudencia. En ambos casos explica brevemente que preparaste un borrador editable que el usuario debe confirmar; todavía no digas que quedó registrado.`;
      const reply = await sendCoachMessage(context(prompt), snapshot.coachMessages, prompt, preview, photoMessage, snapshot.coachMemories);
      if (reply.action) await stageCoachAction(reply.action, 'photo', preview);
      onAppendMessages([
        reply.assistantMessage ?? {
          id: createId(),
          role: 'assistant',
          content: reply.response,
          createdAt: new Date().toISOString(),
        },
      ]);
      onApplyMemoryUpdates(reply.memoryUpdates ?? []);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'No pudimos analizar la foto.');
    } finally {
      setBusy(false);
    }
  };

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5_500_000) return setError('La imagen debe pesar menos de 5.5 MB.');
    const preview = await prepareFoodPhoto(file);
    await processPhoto(preview);
  };

  const handleNativePhoto = async (source: NativePhotoSource) => {
    setError('');
    try {
      const preview = await pickNativePhoto(source);
      if (preview) await processPhoto(preview);
    } catch (unknownError) {
      if (!String(unknownError).toLocaleLowerCase('es-MX').includes('cancel')) setError(unknownError instanceof Error ? unknownError.message : 'No pudimos abrir la cámara.');
    }
  };

  const confirmPendingRecord = () => {
    if (!pendingRecord) return;
    if (pendingRecord.kind === 'workout') {
      applyCoachAction({ type: 'log_workout', workout: pendingRecord.workout });
      setPendingRecord(null);
      return;
    }
    const pendingMeal = pendingRecord;
    const id = onAddMeal({
      ...pendingMeal.meal,
      source: pendingMeal.source === 'photo' ? 'photo' : 'manual',
    });
    onAppendMessages([
      {
        id: createId(),
        role: 'assistant',
        content: `${MEAL_LABELS[pendingMeal.meal.mealType]} registrada. La tomaré en cuenta para las recomendaciones del resto del día.`,
        createdAt: new Date().toISOString(),
      },
    ]);
    setLastAction({ kind: 'meal', id, label: pendingMeal.meal.name });
    setPendingRecord(null);
  };

  const handleHealthDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') return setError('Por ahora VITACOACH acepta estudios en PDF.');
    if (file.size > 8_000_000) return setError('El PDF debe pesar menos de 8 MB.');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No pudimos leer el PDF.'));
      reader.readAsDataURL(file);
    });
    const message = `📄 Revisa mi documento de salud “${file.name}”. Resume los hallazgos medidos, señala qué valores aparecen fuera del rango del propio laboratorio y explícame qué conviene conversar con un profesional. No hagas un diagnóstico.`;
    const reply = await ask(message, {
      history: snapshot.coachMessages,
      attachment: { filename: file.name, mimeType: 'application/pdf', dataUrl },
    });
    if (reply)
      onAddHealthDocument({
        filename: file.name,
        mimeType: file.type,
        summary: reply,
      });
  };

  const composer = (
    <div className="coach-footer">
      <div className="suggestion-grid">
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" disabled={busy} onClick={() => void submit(undefined, suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form className="coach-composer" onSubmit={(event) => void submit(event)}>
        <button type="button" className="coach-tool-button" disabled={busy} aria-label="Añadir foto" onClick={() => setPhotoPickerOpen(true)}>
          <IonIcon icon={cameraOutline} />
        </button>
        <input ref={photoCameraRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void handlePhoto(event)} />
        <input ref={photoAlbumRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handlePhoto(event)} />
        <input ref={photoFileRef} className="sr-only" type="file" accept="image/*" onChange={(event) => void handlePhoto(event)} />
        <button type="button" className="coach-tool-button coach-document-button" disabled={busy} aria-label="Adjuntar estudios en PDF" onClick={() => documentRef.current?.click()}>
          <IonIcon icon={documentAttachOutline} />
        </button>
        <input ref={documentRef} className="sr-only" type="file" accept="application/pdf" onChange={(event) => void handleHealthDocument(event)} />
        <label htmlFor="coach-message" className="sr-only">
          {english ? 'Message VITACOACH' : 'Mensaje para VITACOACH'}
        </label>
        <textarea
          id="coach-message"
          rows={2}
          maxLength={1500}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={english ? 'Message VITACOACH…' : 'Escríbele a VITACOACH…'}
          disabled={busy}
          onFocus={() =>
            window.requestAnimationFrame(() =>
              conversationRef.current?.scrollTo({
                top: conversationRef.current.scrollHeight,
                behavior: 'auto',
              }),
            )
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          className="coach-tool-button"
          disabled={busy}
          aria-label="Hablar por voz"
          onClick={(event) => {
            event.currentTarget.blur();
            openVoice();
          }}
        >
          <IonIcon icon={micOutline} />
        </button>
        <button type="submit" disabled={busy || !draft.trim()} aria-label={english ? 'Send message' : 'Enviar mensaje'}>
          <IonIcon icon={paperPlaneOutline} />
        </button>
      </form>
    </div>
  );

  return (
    <IonPage className={`app-page coach-page${isNativeIos ? ' native-coach-page' : ''}`}>
      <IonContent scrollY={false}>
        <main className="page-shell coach-shell vitacoach-shell">
          <header className="app-header">
            <BrandMark compact />
            <button
              className="voice-call-button"
              onClick={(event) => {
                event.currentTarget.blur();
                openVoice();
              }}
            >
              <IonIcon icon={callOutline} />
              <span>
                {english ? 'Call' : 'Llamar'}
                {voiceBalance && <small>{formatCallDuration(voiceBalance.totalRemainingSeconds)}</small>}
              </span>
            </button>
          </header>
          <section className="coach-heading">
            <span>
              <IonIcon icon={sparklesOutline} />
            </span>
            <div>
              <p className="eyebrow coach-memory-status">
                <span>VITACOACH</span>
                <span title="Puedes pedirme que recuerde, corrija u olvide algo">
                  <IonIcon icon={shieldCheckmarkOutline} /> Memoria activa
                </span>
              </p>
              <h1>{english ? `I'm with you, ${profile.preferredName}` : `Estoy contigo, ${profile.preferredName}`}</h1>
              <p>{english ? 'Chat freely, send a meal photo, or start a voice conversation.' : 'Habla libremente, envía una foto de tu comida o inicia una conversación por voz.'}</p>
            </div>
          </section>
          <section ref={conversationRef} className="coach-conversation" aria-live="polite">
            {snapshot.coachMessages.length === 0 && (
              <div className="chat-bubble chat-bubble--coach">
                <IonIcon icon={chatbubbleEllipsesOutline} />
                <p>{english ? 'I am VITACOACH. I use your goals, workouts, meals and preferences to coach you with context. Tell me what is really going on today.' : 'Soy VITACOACH. Uso tus metas, entrenamientos, comidas y preferencias para acompañarte con contexto. Cuéntame cómo va tu día de verdad.'}</p>
              </div>
            )}
            {snapshot.coachMessages.map((message) => (
              <article key={message.id} className={`coach-message coach-message--${message.role}`}>
                <span>{message.role === 'assistant' ? 'VC' : profile.preferredName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <small>{message.role === 'assistant' ? 'VITACOACH' : english ? 'You' : 'Tú'}</small>
                  <p>{message.content}</p>
                </div>
              </article>
            ))}
            {pendingRecord && (
              <article className="coach-food-confirmation">
                {pendingRecord.preview && <img src={pendingRecord.preview} alt={pendingRecord.kind === 'meal' ? 'Alimento analizado' : 'Actividad analizada'} />}
                <div>
                  <small>{pendingRecord.kind === 'meal' ? `Borrador de alimento${pendingRecord.sourceChecked ? ' · contrastado con fuentes' : ''}` : 'Borrador de actividad física'} · revisa antes de guardar</small>
                  {pendingRecord.kind === 'meal' ? <>
                    <label className="field"><span>Alimento y porciones</span><input value={pendingRecord.meal.name} onChange={(event) => setPendingRecord({ ...pendingRecord, meal: { ...pendingRecord.meal, name: event.target.value }, sourceChecked: false })} /></label>
                    <div className="form-grid">
                      <label className="field"><span>Momento</span><select value={pendingRecord.meal.mealType} onChange={(event) => setPendingRecord({ ...pendingRecord, meal: { ...pendingRecord.meal, mealType: event.target.value as MealType } })}>{Object.entries(MEAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label className="field"><span>Fecha y hora</span><input type="datetime-local" value={toLocalDateTimeInput(pendingRecord.meal.occurredAt)} onChange={(event) => setPendingRecord({ ...pendingRecord, meal: { ...pendingRecord.meal, occurredAt: fromLocalDateTimeInput(event.target.value) } })} /></label>
                    </div>
                    <div className="form-grid coach-record-macros">
                      <NumberField label="kcal" value={pendingRecord.meal.calories} onChange={(value) => setPendingRecord({ ...pendingRecord, meal: { ...pendingRecord.meal, calories: value } })} />
                      <NumberField label="Proteína (g)" value={pendingRecord.meal.proteinG} onChange={(value) => setPendingRecord({ ...pendingRecord, meal: { ...pendingRecord.meal, proteinG: value } })} />
                      <NumberField label="Carbos (g)" value={pendingRecord.meal.carbohydratesG} onChange={(value) => setPendingRecord({ ...pendingRecord, meal: { ...pendingRecord.meal, carbohydratesG: value } })} />
                      <NumberField label="Grasa (g)" value={pendingRecord.meal.fatG} onChange={(value) => setPendingRecord({ ...pendingRecord, meal: { ...pendingRecord.meal, fatG: value } })} />
                    </div>
                    <IonButton size="small" fill="outline" disabled={busy} onClick={() => void stageCoachAction({ type: 'log_meal', meal: pendingRecord.meal }, pendingRecord.source, pendingRecord.preview)}><IonIcon slot="start" icon={refreshOutline} />Recalcular con fuentes</IonButton>
                  </> : <>
                    <label className="field"><span>Actividad</span><input value={pendingRecord.workout.title} onChange={(event) => setPendingRecord({ ...pendingRecord, workout: { ...pendingRecord.workout, title: event.target.value } })} /></label>
                    <div className="form-grid">
                      <label className="field"><span>Tipo</span><select value={pendingRecord.workout.activityType} onChange={(event) => setPendingRecord({ ...pendingRecord, workout: { ...pendingRecord.workout, activityType: event.target.value as NonNullable<WorkoutSession['activityType']> } })}><option value="cardio">Cardio</option><option value="strength">Fuerza</option><option value="sport">Deporte</option><option value="mobility">Movilidad</option><option value="other">Otra</option></select></label>
                      <label className="field"><span>Fecha y hora</span><input type="datetime-local" value={toLocalDateTimeInput(pendingRecord.workout.occurredAt)} onChange={(event) => setPendingRecord({ ...pendingRecord, workout: { ...pendingRecord.workout, occurredAt: fromLocalDateTimeInput(event.target.value) } })} /></label>
                    </div>
                    <div className="form-grid coach-record-macros">
                      <NumberField label="Minutos" value={pendingRecord.workout.durationMinutes} min={1} onChange={(value) => setPendingRecord({ ...pendingRecord, workout: { ...pendingRecord.workout, durationMinutes: value } })} />
                      <NumberField label="kcal activas" value={pendingRecord.workout.caloriesBurned} onChange={(value) => setPendingRecord({ ...pendingRecord, workout: { ...pendingRecord.workout, caloriesBurned: value } })} />
                      <NumberField label="Esfuerzo (1–10)" value={pendingRecord.workout.perceivedEffort} min={1} max={10} onChange={(value) => setPendingRecord({ ...pendingRecord, workout: { ...pendingRecord.workout, perceivedEffort: value } })} />
                    </div>
                  </>}
                  <div>
                    <IonButton size="small" className="primary-button" onClick={confirmPendingRecord}>
                      Confirmar y registrar
                    </IonButton>
                    <IonButton size="small" fill="clear" color="medium" onClick={() => setPendingRecord(null)}>
                      Descartar
                    </IonButton>
                  </div>
                </div>
              </article>
            )}
            {busy && (
              <article className="coach-message coach-message--assistant">
                <span>VC</span>
                <div>
                  <small>VITACOACH</small>
                  <p className="coach-thinking">
                    <IonSpinner name="dots" /> {english ? 'Thinking…' : 'Pensando…'}
                  </p>
                </div>
              </article>
            )}
            {lastAction && (
              <article className="coach-action-confirmed">
                <IonIcon icon={checkmarkCircleOutline} />
                <div>
                  <strong>{lastAction.kind === 'meal' ? 'Comida registrada' : lastAction.kind === 'workout' ? 'Actividad registrada' : lastAction.kind === 'sleep' ? 'Sueño registrado' : 'Plan alimenticio actualizado'}</strong>
                  <span>{lastAction.label}</span>
                </div>
                {lastAction.kind !== 'plan' && lastAction.id && (
                  <button
                    onClick={() => {
                      if (lastAction.kind === 'meal') onDeleteMeal(lastAction.id!);
                      else if (lastAction.kind === 'workout') onDeleteWorkout(lastAction.id!);
                      else onDeleteSleep(lastAction.id!);
                      setLastAction(null);
                    }}
                  >
                    Deshacer
                  </button>
                )}
              </article>
            )}
            <div ref={endRef} />
          </section>
        </main>
      </IonContent>
      <IonFooter className="coach-input-footer">{composer}</IonFooter>
      <IonActionSheet
        isOpen={photoPickerOpen}
        onDidDismiss={() => setPhotoPickerOpen(false)}
        header="Analizar comida o actividad"
        buttons={[
          {
            text: 'Tomar foto',
            icon: cameraOutline,
            handler: () => {
              if (isNativeIos) void handleNativePhoto('camera');
              else photoCameraRef.current?.click();
            },
          },
          {
            text: 'Elegir del álbum',
            icon: imagesOutline,
            handler: () => {
              if (isNativeIos) void handleNativePhoto('photos');
              else photoAlbumRef.current?.click();
            },
          },
          {
            text: 'Elegir archivo',
            icon: folderOpenOutline,
            handler: () => photoFileRef.current?.click(),
          },
          { text: 'Cancelar', role: 'cancel' },
        ]}
      />
      <VoiceCall
        open={voiceOpen}
        english={english}
        getContext={() => context('', true)}
        onClose={() => setVoiceOpen(false)}
        onExhausted={() => {
          setVoiceOpen(false);
          setVoiceCatalogOpen(true);
        }}
        onAction={applyCoachAction}
        onEnded={async (event) => {
          const result = await recordCoachCall({ locale: uiLocale, ...event });
          onVoiceBalance(result.voiceBalance);
          if (result.voiceBalance.totalRemainingSeconds <= 0) setVoiceCatalogOpen(true);
        }}
      />
      <VoiceCreditsModal isOpen={voiceCatalogOpen} balance={voiceBalance} offers={voiceOffers} busy={billingBusy} message={billingMessage} onDismiss={() => setVoiceCatalogOpen(false)} onPurchase={onPurchaseVoice} />
    </IonPage>
  );
};

function formatCallDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function NumberField({ label, value, min = 0, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange(value: number): void }) {
  return <label className="field"><span>{label}</span><input type="number" inputMode="decimal" min={min} max={max} step="any" value={value} onChange={(event) => onChange(Math.max(min, max === undefined ? Number(event.target.value) || 0 : Math.min(max, Number(event.target.value) || 0)))} /></label>;
}

function emptyRealtimeUsage(): RealtimeCallUsage {
  return {
    responses: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    inputTextTokens: 0,
    inputAudioTokens: 0,
    cachedTextTokens: 0,
    cachedAudioTokens: 0,
    outputTextTokens: 0,
    outputAudioTokens: 0,
  };
}

interface RealtimeResponseUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
    cached_tokens?: number;
    cached_tokens_details?: { text_tokens?: number; audio_tokens?: number };
  };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
}

function accumulateRealtimeUsage(current: RealtimeCallUsage, usage?: RealtimeResponseUsage): RealtimeCallUsage {
  if (!usage) return current;
  const input = usage.input_token_details;
  const cached = input?.cached_tokens_details;
  const output = usage.output_token_details;
  return {
    responses: current.responses + 1,
    inputTokens: current.inputTokens + Math.max(0, usage.input_tokens ?? 0),
    cachedInputTokens: current.cachedInputTokens + Math.max(0, input?.cached_tokens ?? 0),
    outputTokens: current.outputTokens + Math.max(0, usage.output_tokens ?? 0),
    inputTextTokens: current.inputTextTokens + Math.max(0, input?.text_tokens ?? 0),
    inputAudioTokens: current.inputAudioTokens + Math.max(0, input?.audio_tokens ?? 0),
    cachedTextTokens: current.cachedTextTokens + Math.max(0, cached?.text_tokens ?? 0),
    cachedAudioTokens: current.cachedAudioTokens + Math.max(0, cached?.audio_tokens ?? 0),
    outputTextTokens: current.outputTextTokens + Math.max(0, output?.text_tokens ?? 0),
    outputAudioTokens: current.outputAudioTokens + Math.max(0, output?.audio_tokens ?? 0),
  };
}

function realtimeString(value: unknown, field: string, maxLength = 240): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Falta ${field}`);
  return value.trim().slice(0, maxLength);
}

function realtimeNumber(value: unknown, field: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Falta ${field}`);
  return Math.max(minimum, Math.min(maximum, value));
}

function realtimeDate(value: unknown): string {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return new Date().toISOString();
}

function realtimeStringArray(value: unknown, field: string, maxItems: number): string[] {
  if (!Array.isArray(value)) throw new Error(`Falta ${field}`);
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim().slice(0, 400) : ''))
    .filter(Boolean)
    .slice(0, maxItems);
  if (!items.length) throw new Error(`Falta ${field}`);
  return items;
}

function realtimeToolAction(name: string, rawArguments: string): CoachAction {
  const args = JSON.parse(rawArguments || '{}') as Record<string, unknown>;
  if (name === 'log_meal') {
    const mealType = realtimeString(args.mealType, 'mealType', 20);
    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) throw new Error('mealType inválido');
    return {
      type: 'log_meal',
      meal: {
        name: realtimeString(args.name, 'name', 180),
        mealType: mealType as MealType,
        occurredAt: realtimeDate(args.occurredAt),
        calories: Math.round(realtimeNumber(args.calories, 'calories', 0, 10_000)),
        proteinG: Math.round(realtimeNumber(args.proteinG, 'proteinG', 0, 1_000) * 10) / 10,
        carbohydratesG: Math.round(realtimeNumber(args.carbohydratesG, 'carbohydratesG', 0, 1_000) * 10) / 10,
        fatG: Math.round(realtimeNumber(args.fatG, 'fatG', 0, 1_000) * 10) / 10,
      },
    };
  }
  if (name === 'log_workout') {
    const activityType = realtimeString(args.activityType, 'activityType', 20);
    if (!['strength', 'cardio', 'mobility', 'sport', 'other'].includes(activityType)) throw new Error('activityType inválido');
    return {
      type: 'log_workout',
      workout: {
        title: realtimeString(args.title, 'title', 180),
        activityType: activityType as NonNullable<WorkoutSession['activityType']>,
        occurredAt: realtimeDate(args.occurredAt),
        durationMinutes: Math.round(realtimeNumber(args.durationMinutes, 'durationMinutes', 1, 1_440)),
        caloriesBurned: Math.round(realtimeNumber(args.caloriesBurned, 'caloriesBurned', 0, 20_000)),
        perceivedEffort: Math.round(realtimeNumber(args.perceivedEffort, 'perceivedEffort', 1, 10)),
      },
    };
  }
  if (name === 'log_sleep') {
    const startedAt = realtimeDate(args.startedAt);
    const endedAt = realtimeDate(args.endedAt);
    const durationMinutes = Math.round(realtimeNumber(args.durationMinutes, 'durationMinutes', 30, 1_440));
    const quality = typeof args.quality === 'number' ? (Math.round(realtimeNumber(args.quality, 'quality', 1, 5)) as SleepEntry['quality']) : undefined;
    return {
      type: 'log_sleep',
      sleep: {
        startedAt,
        endedAt,
        durationMinutes,
        quality,
        note: typeof args.note === 'string' ? args.note.trim().slice(0, 300) : undefined,
      },
    };
  }
  if (name === 'replace_plan_meal') {
    const mealType = realtimeString(args.mealType, 'mealType', 20);
    const difficulty = realtimeString(args.difficulty, 'difficulty', 20);
    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) throw new Error('mealType inválido');
    if (!['basic', 'intermediate', 'advanced'].includes(difficulty)) throw new Error('difficulty inválido');
    return {
      type: 'replace_plan_meal',
      change: {
        slotId: realtimeString(args.slotId, 'slotId', 160),
        option: {
          id: typeof args.optionId === 'string' && args.optionId.trim() ? args.optionId.trim().slice(0, 160) : `vitacoach-${Date.now()}`,
          name: realtimeString(args.name, 'name', 180),
          mealType: mealType as MealType,
          calories: Math.round(realtimeNumber(args.calories, 'calories', 0, 5_000)),
          proteinG: Math.round(realtimeNumber(args.proteinG, 'proteinG', 0, 500)),
          carbohydratesG: Math.round(realtimeNumber(args.carbohydratesG, 'carbohydratesG', 0, 500)),
          fatG: Math.round(realtimeNumber(args.fatG, 'fatG', 0, 500)),
          ingredients: realtimeStringArray(args.ingredients, 'ingredients', 20),
          steps: realtimeStringArray(args.steps, 'steps', 12),
          prepMinutes: Math.round(realtimeNumber(args.prepMinutes, 'prepMinutes', 1, 600)),
          difficulty: difficulty as MealPlanOption['difficulty'],
          imageUrl: null,
        },
      },
    };
  }
  if (name === 'replace_plan_ingredient') {
    return {
      type: 'replace_plan_ingredient',
      change: {
        slotId: typeof args.slotId === 'string' && args.slotId.trim() ? args.slotId.trim().slice(0, 160) : undefined,
        ingredientToReplace: realtimeString(args.ingredientToReplace, 'ingredientToReplace'),
        replacementIngredient: realtimeString(args.replacementIngredient, 'replacementIngredient'),
      },
    };
  }
  throw new Error('Acción no autorizada');
}

function VoiceCall({ open, english, getContext, onClose, onExhausted, onAction, onEnded }: { open: boolean; english: boolean; getContext(): CoachChatContext; onClose(): void; onExhausted(): void; onAction(action: CoachAction): { success: true; message: string } | Promise<{ success: true; message: string }>; onEnded(event: { callSessionId: string; durationSeconds: number; startedAt: string; endedAt: string; usage: RealtimeCallUsage }): void | Promise<void> }) {
  const connectionFailureMessage = english ? 'The call could not connect with VITACOACH. Try again.' : 'No se logró enlazar la llamada con VITACOACH. Intentalo de nuevo';
  const [listening, setListening] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [meteringStarted, setMeteringStarted] = useState(false);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(0);
  const [connectionError, setConnectionError] = useState(false);
  const [requiresSecureContext, setRequiresSecureContext] = useState(false);
  const [status, setStatus] = useState(english ? 'Connecting with VITACOACH…' : 'Conectando con VITACOACH…');
  const activeRef = useRef(false);
  const speakingRef = useRef(false);
  const mutedRef = useRef(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const completedToolCallsRef = useRef(new Set<string>());
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const reservationAtRef = useRef<string | null>(null);
  const callSessionIdRef = useRef<string | null>(null);
  const meteringStartedRef = useRef(false);
  const finalizedRef = useRef(false);
  const greetingSentRef = useRef(false);
  const usageRef = useRef<RealtimeCallUsage>(emptyRealtimeUsage());

  useEffect(() => {
    if (!meteringStarted) {
      setCallSeconds(0);
      return;
    }
    const startedAt = startedAtRef.current ? Date.parse(startedAtRef.current) : Date.now();
    const tick = () => setCallSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [meteringStarted]);

  useEffect(() => {
    if (!meteringStarted || !callSessionIdRef.current) return;
    const sessionId = callSessionIdRef.current;
    const timer = window.setInterval(() => void heartbeatCoachCall(sessionId), 15_000);
    return () => window.clearInterval(timer);
  }, [meteringStarted]);

  const playConnectionTone = () => {
    const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    try {
      const audioContext = new AudioContextConstructor();
      const now = audioContext.currentTime;
      [420, 520, 660].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const startsAt = now + index * 0.11;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startsAt);
        gain.gain.setValueAtTime(0.0001, startsAt);
        gain.gain.exponentialRampToValueAtTime(0.045, startsAt + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.085);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startsAt);
        oscillator.stop(startsAt + 0.09);
      });
      window.setTimeout(() => void audioContext.close(), 650);
    } catch (error) {
      if ((error as Error & { code?: string })?.code === 'VOICE_CREDITS_EXHAUSTED') {
        stopTransport();
        onExhausted();
        return;
      }
      /* El tono es decorativo; la llamada continúa si el navegador lo bloquea. */
    }
  };

  const startCall = async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    startedAtRef.current = null;
    reservationAtRef.current = new Date().toISOString();
    callSessionIdRef.current = null;
    meteringStartedRef.current = false;
    setMeteringStarted(false);
    setMaxDurationSeconds(0);
    finalizedRef.current = false;
    completedToolCallsRef.current.clear();
    greetingSentRef.current = false;
    usageRef.current = emptyRealtimeUsage();
    mutedRef.current = false;
    setMuted(false);
    setConnectionError(false);
    setRequiresSecureContext(false);
    setCallActive(true);
    setStatus(english ? 'Connecting with VITACOACH…' : 'Conectando con VITACOACH…');
    playConnectionTone();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      activeRef.current = false;
      setCallActive(false);
      setConnectionError(true);
      setRequiresSecureContext(true);
      setStatus(connectionFailureMessage);
      return;
    }
    try {
      const callContext = getContext();
      const secret = await fetchRealtimeToken(callContext);
      callSessionIdRef.current = secret.callSessionId;
      setMaxDurationSeconds(secret.maxDurationSeconds);
      if (!secret.value) throw new Error('Token efímero vacío');
      const configuredVoice = secret.session?.audio?.output?.voice;
      if (configuredVoice && configuredVoice !== 'marin') throw new Error(`Voz inesperada: ${configuredVoice}`);
      if (!activeRef.current) {
        await finishReservation();
        return;
      }
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const audio = audioRef.current;
      if (!audio) throw new Error('Salida de audio no disponible');
      audio.autoplay = true;
      audio.muted = false;
      audio.volume = 1;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => {
          if (!activeRef.current) return;
          setConnectionError(true);
          setStatus(connectionFailureMessage);
        });
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!activeRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        peer.close();
        return;
      }
      streamRef.current = stream;
      for (const track of stream.getTracks()) peer.addTrack(track, stream);
      const channel = peer.createDataChannel('oai-events');
      channelRef.current = channel;
      channel.onopen = () => {
        if (!activeRef.current || greetingSentRef.current) return;
        greetingSentRef.current = true;
        setConnectionError(false);
        setListening(false);
        speakingRef.current = true;
        setSpeaking(true);
        setStatus(english ? 'VITACOACH is answering…' : 'VITACOACH está contestando…');
        const preferredName = callContext.profile.preferredName.trim().slice(0, 60);
        const greeting = english ? `Hi ${preferredName || 'there'}, how can I help you today?` : `${preferredName ? `Hola ${preferredName}` : 'Hola'}, ¿en qué te puedo ayudar hoy?`;
        channel.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              output_modalities: ['audio'],
              max_output_tokens: 100,
              instructions: `This is the opening of the call. Say exactly this greeting, naturally and warmly, with no extra words: ${JSON.stringify(greeting)}`,
              metadata: { vitamate_event: 'call_greeting', voice: 'marin' },
            },
          }),
        );
      };
      channel.onerror = () => {
        if (!activeRef.current) return;
        setConnectionError(true);
        setStatus(connectionFailureMessage);
      };
      const resolveToolCall = async (callId: string, name: string, rawArguments: string) => {
        if (completedToolCallsRef.current.has(callId)) return;
        completedToolCallsRef.current.add(callId);
        setListening(false);
        setSpeaking(false);
        speakingRef.current = false;
        setStatus(english ? 'Updating your VITAMATE data…' : 'Actualizando tus datos en VITAMATE…');
        let output: Record<string, unknown>;
        try {
          const action = realtimeToolAction(name, rawArguments);
          output = await onAction(action);
        } catch (error) {
          output = {
            success: false,
            message: error instanceof Error ? error.message : english ? 'The request could not be applied.' : 'No se pudo aplicar la solicitud.',
          };
        }
        if (!channelRef.current || channelRef.current.readyState !== 'open') return;
        channelRef.current.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify(output),
            },
          }),
        );
        channelRef.current.send(JSON.stringify({ type: 'response.create' }));
      };
      channel.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            call_id?: string;
            name?: string;
            arguments?: string;
            error?: { message?: string };
            session?: { audio?: { output?: { voice?: string } } };
            response?: {
              usage?: RealtimeResponseUsage;
              output?: Array<{
                type?: string;
                name?: string;
                call_id?: string;
                arguments?: string;
              }>;
            };
          };
          if (payload.type === 'error') {
            setConnectionError(true);
            setSpeaking(false);
            speakingRef.current = false;
            setStatus(connectionFailureMessage);
          }
          if (payload.type === 'session.created' || payload.type === 'session.updated') {
            const activeVoice = payload.session?.audio?.output?.voice;
            if (activeVoice && activeVoice !== 'marin') {
              setConnectionError(true);
              setStatus(connectionFailureMessage);
            }
          }
          if (payload.type === 'input_audio_buffer.speech_started') {
            if (!meteringStartedRef.current && callSessionIdRef.current) {
              meteringStartedRef.current = true;
              startedAtRef.current = new Date().toISOString();
              setMeteringStarted(true);
              void startCoachCall(callSessionIdRef.current).catch(() => {
                setConnectionError(true);
                setStatus(connectionFailureMessage);
              });
            }
            setListening(true);
            setSpeaking(false);
            speakingRef.current = false;
            setStatus(english ? 'Listening…' : 'Escuchando…');
          }
          if (payload.type === 'response.output_audio.delta' || payload.type === 'response.output_audio_transcript.delta') {
            setListening(false);
            setSpeaking(true);
            speakingRef.current = true;
            setStatus(english ? 'VITACOACH is speaking…' : 'VITACOACH está respondiendo…');
            void audio.play().catch(() => undefined);
          }
          if (payload.type === 'response.function_call_arguments.done' && payload.call_id && payload.name) {
            void resolveToolCall(payload.call_id, payload.name, payload.arguments ?? '{}');
          }
          if (payload.type === 'response.done') {
            usageRef.current = accumulateRealtimeUsage(usageRef.current, payload.response?.usage);
            let hasToolCall = false;
            for (const output of payload.response?.output ?? []) {
              if (output.type !== 'function_call' || !output.name || !output.call_id) continue;
              hasToolCall = true;
              void resolveToolCall(output.call_id, output.name, output.arguments ?? '{}');
            }
            if (!hasToolCall) {
              speakingRef.current = false;
              setSpeaking(false);
              setListening(!mutedRef.current);
              setStatus(mutedRef.current ? (english ? 'Microphone muted' : 'Micrófono silenciado') : english ? 'Listening…' : 'Escuchando…');
            }
          }
        } catch {
          /* Ignore non-JSON transport events. */
        }
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') setConnectionError(false);
        if (['failed', 'disconnected'].includes(peer.connectionState) && activeRef.current) {
          setConnectionError(true);
          setStatus(connectionFailureMessage);
        }
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret.value}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });
      if (!response.ok) throw new Error(`Realtime ${response.status}`);
      const answerSdp = await response.text();
      if (!activeRef.current) {
        peer.close();
        return;
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch {
      if (!activeRef.current) return;
      peerRef.current?.close();
      peerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setListening(false);
      setSpeaking(false);
      speakingRef.current = false;
      setConnectionError(true);
      setStatus(connectionFailureMessage);
    }
  };
  const toggleMute = () => {
    if (!callActive) return;
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    if (nextMuted) {
      setListening(false);
      setStatus(english ? 'Microphone muted' : 'Micrófono silenciado');
    } else {
      setListening(!speakingRef.current);
      setStatus(speakingRef.current ? (english ? 'VITACOACH is speaking…' : 'VITACOACH está respondiendo…') : english ? 'Listening…' : 'Escuchando…');
    }
  };
  function stopTransport() {
    activeRef.current = false;
    speakingRef.current = false;
    mutedRef.current = false;
    peerRef.current?.close();
    channelRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    peerRef.current = null;
    channelRef.current = null;
    streamRef.current = null;
    setListening(false);
    setSpeaking(false);
    setMuted(false);
    setCallActive(false);
    setMeteringStarted(false);
    setConnectionError(false);
  }
  async function finishReservation() {
    const callSessionId = callSessionIdRef.current;
    if (finalizedRef.current || !callSessionId) return;
    finalizedRef.current = true;
    const endedAt = new Date().toISOString();
    await onEnded({
      callSessionId,
      durationSeconds: callSeconds,
      startedAt: startedAtRef.current ?? reservationAtRef.current ?? endedAt,
      endedAt,
      usage: usageRef.current,
    });
  }
  const retry = () => {
    void finishReservation().finally(() => {
      stopTransport();
      setRequiresSecureContext(false);
      window.setTimeout(() => void startCall(), 120);
    });
  };
  function close() {
    void finishReservation().catch(() => undefined);
    stopTransport();
    onClose();
  }
  useEffect(() => {
    if (meteringStarted && maxDurationSeconds > 0 && callSeconds >= maxDurationSeconds) close();
  }, [callSeconds, maxDurationSeconds, meteringStarted]);
  const activityStatus = muted ? (english ? 'Microphone muted' : 'Micrófono silenciado') : status;
  return (
    <IonModal
      isOpen={open}
      onWillPresent={() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }}
      onDidPresent={() => {
        closeButtonRef.current?.focus();
        void startCall();
      }}
      onDidDismiss={close}
      className="voice-call-modal"
    >
      <div className="voice-call">
        <audio
          ref={audioRef}
          className="voice-remote-audio"
          autoPlay
          playsInline
          aria-hidden="true"
          onPlaying={() => {
            if (!activeRef.current) return;
            setConnectionError(false);
            setRequiresSecureContext(false);
          }}
        />
        <button ref={closeButtonRef} className="voice-close" aria-label={english ? 'End call' : 'Finalizar llamada'} onClick={close}>
          <IonIcon icon={closeOutline} />
        </button>
        <div className={`voice-orb${speaking ? ' is-speaking' : listening ? ' is-listening' : callActive ? ' is-connecting' : ''}`}>
          <span>VC</span>
        </div>
        <p className="eyebrow">VITACOACH</p>
        <h2>{english ? 'Voice call' : 'Llamada de voz'}</h2>
        <p className={`voice-timer${connectionError ? ' is-error' : ''}`}>{requiresSecureContext ? 'HTTPS requerido' : connectionError ? (english ? 'Connection error' : 'Error de conexión') : meteringStarted ? formatCallDuration(callSeconds) : '00:00'}</p>
        {!connectionError && <p className="voice-credit-status">{meteringStarted ? `${english ? 'Remaining' : 'Restante'}: ${formatCallDuration(Math.max(0, maxDurationSeconds - callSeconds))}` : english ? 'Your time starts with your first question.' : 'Tu tiempo empieza con tu primera consulta.'}</p>}
        <p className="voice-status" aria-live="polite">
          {activityStatus}
        </p>
        {connectionError && !requiresSecureContext && (
          <button type="button" className="voice-retry" onClick={retry}>
            <IonIcon icon={refreshOutline} />
            {english ? 'Retry with VITACOACH' : 'Reintentar con VITACOACH'}
          </button>
        )}
        <button className={`voice-mic${muted ? ' is-muted' : ' is-live'}`} aria-label={muted ? (english ? 'Unmute microphone' : 'Activar micrófono') : english ? 'Mute microphone' : 'Silenciar micrófono'} aria-pressed={muted} disabled={!callActive || connectionError} onClick={toggleMute}>
          <IonIcon icon={muted ? micOffOutline : micOutline} />
        </button>
      </div>
    </IonModal>
  );
}

export default Coach;
