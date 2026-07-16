import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { IonActionSheet, IonButton, IonContent, IonFooter, IonIcon, IonModal, IonPage, IonSpinner, useIonViewDidEnter } from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { callOutline, cameraOutline, chatbubbleEllipsesOutline, checkmarkCircleOutline, closeOutline, documentAttachOutline, folderOpenOutline, imagesOutline, micOutline, micOffOutline, paperPlaneOutline, shieldCheckmarkOutline, sparklesOutline } from 'ionicons/icons';
import { buildWeeklyNutritionBalance, buildWeeklyWorkoutBalance, summarizeNutritionDay, weeklyMealPlanForDate, type CoachChatMessage, type CoachMemoryUpdate, type HealthDocumentSummary, type MealEntry, type MealPlanOption, type MealType, type WorkoutSession } from '@vitamate/domain';
import { BrandMark } from '../components/BrandMark';
import { resolveUiLocale } from '../config/appFeatures';
import type { VitamateSnapshot } from '../data/localRepository';
import { analyzeFoodPhoto, fetchCoachHistory, fetchRealtimeToken, recordCoachCall, sendCoachMessage, type CoachChatContext, type PhotoAnalysis } from '../services/api';
import { pickNativePhoto, type NativePhotoSource } from '../services/nativeCamera';
import { isNativeIos } from '../services/nativePlatform';
import { prepareFoodPhoto } from '../services/imageCompression';

interface CoachProps {
  snapshot: VitamateSnapshot;
  healthSummary?: CoachChatContext['healthSummary'];
  onAppendMessages: (messages: CoachChatMessage[]) => void;
  onMergeMessages: (messages: CoachChatMessage[]) => void;
  onApplyMemoryUpdates: (updates: CoachMemoryUpdate[]) => void;
  onAddMeal(meal: Omit<MealEntry, 'id' | 'createdAt' | 'source' | 'confirmed'> & { source?: MealEntry['source'] }): string;
  onDeleteMeal(id: string): void;
  onAddManualWorkout(workout: { title: string; activityType: WorkoutSession['activityType']; completedAt: string; durationMinutes: number; caloriesBurned: number; perceivedEffort: number }): string;
  onDeleteWorkout(id: string): void;
  onAddHealthDocument(document: Omit<HealthDocumentSummary, 'id' | 'uploadedAt'>): string;
  onReplaceMealPlanOption(slotId: string, option: MealPlanOption): void;
  onReplaceMealPlanIngredient(ingredientToReplace: string, replacementIngredient: string, slotId?: string): void;
}

interface PendingPhotoMeal {
  preview: string;
  analysis: PhotoAnalysis;
  name: string;
  mealType: MealType;
}

function createId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi) cryptoApi.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function inferMealType(date = new Date()): MealType {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 17) return 'lunch';
  if (hour >= 17 && hour < 23) return 'dinner';
  return 'snack';
}

const MEAL_LABELS: Record<MealType, string> = { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena', snack: 'Colación' };

const Coach = ({ snapshot, healthSummary, onAppendMessages, onMergeMessages, onApplyMemoryUpdates, onAddMeal, onDeleteMeal, onAddManualWorkout, onDeleteWorkout, onAddHealthDocument, onReplaceMealPlanOption, onReplaceMealPlanIngredient }: CoachProps) => {
  const profile = snapshot.profile!;
  const location = useLocation();
  const uiLocale = resolveUiLocale(profile.locale);
  const english = uiLocale === 'en-US';
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingMeal, setPendingMeal] = useState<PendingPhotoMeal | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [lastAction, setLastAction] = useState<{ kind: 'meal' | 'workout' | 'plan'; id?: string; label: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLElement>(null);
  const photoAlbumRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const suggestions = english
    ? ['Plan my day', 'How can I reach my protein goal?', 'Be honest about my progress']
    : ['Planea mi día', '¿Cómo alcanzo mi proteína?', 'Sé honesto con mi progreso'];

  const context = (message = ''): CoachChatContext => {
    const todayNutrition = summarizeNutritionDay(snapshot.meals);
    const weeklyNutrition = buildWeeklyNutritionBalance(snapshot.meals, snapshot.nutritionTarget);
    const weeklyWorkout = buildWeeklyWorkoutBalance(profile, snapshot.workoutSessions);
    const latestWeight = snapshot.weightEntries[0];
    const currentMealPlan = weeklyMealPlanForDate(snapshot.mealPlans);
    const parameters = new URLSearchParams(location.search);
    const planAction = parameters.get('planAction');
    const planChangeTarget = planAction === 'replace_meal'
      ? { type: 'replace_meal' as const, slotId: parameters.get('planSlotId') ?? undefined }
      : planAction === 'replace_ingredient'
        ? { type: 'replace_ingredient' as const, ingredient: parameters.get('ingredient') ?? undefined }
        : undefined;
    const normalizedMessage = message.toLocaleLowerCase('es-MX');
    const needsPlan = Boolean(planChangeTarget) || /(cambia|reemplaza|sustituye|intercambia).*(plan|menú|menu|comida|ingrediente)/.test(normalizedMessage);
    const needsHealthDocuments = /laboratorio|análisis|analisis|estudio|documento|pdf|resultado|glucosa|colesterol/.test(normalizedMessage);
    const needsWorkoutCatalog = !message || /entren|ejercicio|rutina|serie|repetición|repeticion|gym|fuerza|cardio/.test(normalizedMessage);
    return {
      locale: uiLocale,
      currentDateTime: new Date().toISOString(),
      timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      profile: {
        preferredName: profile.preferredName, primaryGoal: profile.primaryGoal, activityLevel: profile.activityLevel,
        weeklyTrainingDays: profile.weeklyTrainingDays, trainingMinutes: profile.trainingMinutes, equipment: profile.equipment,
        dietaryPattern: profile.dietaryPattern, coachStyle: profile.coachStyle, safetyFlags: profile.safetyFlags,
        favoriteFoods: profile.favoriteFoods ?? [], dislikedFoods: profile.dislikedFoods ?? [], allergies: profile.allergies ?? [],
        preferredCuisines: profile.preferredCuisines ?? [], mealsPerDay: profile.mealsPerDay, cookingLevel: profile.cookingLevel,
        supplements: profile.supplements ?? [], trainingPreference: profile.trainingPreference, preferredSport: profile.preferredSport,
        mealPreparationPreference: profile.mealPreparationPreference, mealPrepStructure: profile.mealPrepStructure,
        mealPrepRotationDays: profile.mealPrepRotationDays, weeklyFoodBudgetMxn: profile.weeklyFoodBudgetMxn,
      },
      nutritionTarget: snapshot.nutritionTarget ? {
        status: snapshot.nutritionTarget.status, calories: snapshot.nutritionTarget.calories, proteinG: snapshot.nutritionTarget.proteinG,
        carbohydratesG: snapshot.nutritionTarget.carbohydratesG, fatG: snapshot.nutritionTarget.fatG,
      } : undefined,
      recentWorkouts: snapshot.workoutSessions.slice(0, 5).map((session) => ({ workoutTitle: session.workoutTitle, durationMinutes: session.durationMinutes, perceivedEffort: session.perceivedEffort, completedAt: session.completedAt })),
      availableWorkouts: needsWorkoutCatalog ? (snapshot.workoutPlan?.days ?? []).slice(0, 4).map((day) => ({ title: day.title, focus: day.focus, durationMinutes: day.durationMinutes, exercises: day.exercises.slice(0, 8).map((exercise) => `${exercise.name}: ${exercise.sets} × ${exercise.repRange}`) })) : [],
      todayNutrition,
      weeklyNutrition: weeklyNutrition ? { consumed: weeklyNutrition.consumed, target: weeklyNutrition.target, balance: weeklyNutrition.balance } : undefined,
      weeklyWorkout,
      weightTrend: latestWeight ? { latestKg: latestWeight.weightKg, previousKg: snapshot.weightEntries[1]?.weightKg ?? null } : undefined,
      healthDocuments: needsHealthDocuments ? snapshot.healthDocuments.slice(0, 3).map(({ filename, uploadedAt, summary }) => ({ filename, uploadedAt, summary: summary.slice(0, 1200) })) : [],
      healthSummary,
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
    void fetchCoachHistory(100).then((messages) => { if (messages.length) onMergeMessages(messages); }).catch(() => undefined);
    window.requestAnimationFrame(() => { const element = conversationRef.current; if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'auto' }); });
  });
  useEffect(() => { const element = conversationRef.current; if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' }); }, [snapshot.coachMessages.length, busy, pendingMeal, lastAction]);

  const ask = async (content: string, options?: { appendUser?: boolean; history?: CoachChatMessage[]; attachment?: string | { filename: string; mimeType: 'application/pdf'; dataUrl: string } }): Promise<string | null> => {
    if (!content.trim() || busy) return null;
    setError(''); setBusy(true);
    const appendUser = options?.appendUser ?? true;
    const userMessage: CoachChatMessage = { id: createId(), role: 'user', content: content.trim(), createdAt: new Date().toISOString() };
    const history = options?.history ?? snapshot.coachMessages;
    if (appendUser) onAppendMessages([userMessage]);
    try {
      const reply = await sendCoachMessage(context(content.trim()), history, content.trim(), options?.attachment, appendUser ? userMessage : undefined, snapshot.coachMemories);
      if (reply.action?.type === 'log_meal') {
        const id = onAddMeal({ ...reply.action.meal, source: 'manual' });
        setLastAction({ kind: 'meal', id, label: reply.action.meal.name });
      } else if (reply.action?.type === 'log_workout') {
        const id = onAddManualWorkout({ title: reply.action.workout.title, activityType: reply.action.workout.activityType, completedAt: reply.action.workout.occurredAt, durationMinutes: reply.action.workout.durationMinutes, caloriesBurned: reply.action.workout.caloriesBurned, perceivedEffort: reply.action.workout.perceivedEffort });
        setLastAction({ kind: 'workout', id, label: reply.action.workout.title });
      } else if (reply.action?.type === 'replace_plan_meal') {
        onReplaceMealPlanOption(reply.action.change.slotId, reply.action.change.option);
        setLastAction({ kind: 'plan', label: `${reply.action.change.option.name} · plan y súper actualizados` });
      } else if (reply.action?.type === 'replace_plan_ingredient') {
        onReplaceMealPlanIngredient(reply.action.change.ingredientToReplace, reply.action.change.replacementIngredient, reply.action.change.slotId);
        setLastAction({ kind: 'plan', label: `${reply.action.change.ingredientToReplace} → ${reply.action.change.replacementIngredient}` });
      }
      onAppendMessages([reply.assistantMessage ?? { id: createId(), role: 'assistant', content: reply.response, createdAt: new Date().toISOString() }]);
      onApplyMemoryUpdates(reply.memoryUpdates ?? []);
      return reply.response;
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : (english ? 'Could not contact VITACOACH.' : 'No fue posible contactar a VITACOACH.'));
      return null;
    } finally { setBusy(false); }
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
    const photoMessage: CoachChatMessage = { id: createId(), role: 'user', content: '📷 Foto de alimento enviada', createdAt: new Date().toISOString() };
    onAppendMessages([photoMessage]); setBusy(true); setError('');
    try {
      const analysis = await analyzeFoodPhoto(preview, uiLocale);
      const mealType = inferMealType();
      const name = analysis.items.map((item) => item.name).join(', ');
      setPendingMeal({ preview, analysis, name, mealType });
      const prompt = `El usuario acaba de enviar una foto de su alimento. La estimación visual (aún no confirmada) es: ${JSON.stringify({ name, mealType, totals: analysis.totals, confidence: analysis.overallConfidence, notes: analysis.notes })}. Dale retroalimentación breve y útil sobre cómo encaja con sus metas de hoy. Menciona que debe confirmar el registro y evita presentar la estimación como exacta.`;
      const reply = await sendCoachMessage(context(prompt), snapshot.coachMessages, prompt, undefined, photoMessage, snapshot.coachMemories);
      onAppendMessages([reply.assistantMessage ?? { id: createId(), role: 'assistant', content: reply.response, createdAt: new Date().toISOString() }]);
      onApplyMemoryUpdates(reply.memoryUpdates ?? []);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'No pudimos analizar la foto.');
    } finally { setBusy(false); }
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
    try { const preview = await pickNativePhoto(source); if (preview) await processPhoto(preview); }
    catch (unknownError) {
      if (!String(unknownError).toLocaleLowerCase('es-MX').includes('cancel')) setError(unknownError instanceof Error ? unknownError.message : 'No pudimos abrir la cámara.');
    }
  };

  const confirmMeal = () => {
    if (!pendingMeal) return;
    onAddMeal({ name: pendingMeal.name, occurredAt: new Date().toISOString(), mealType: pendingMeal.mealType, ...pendingMeal.analysis.totals, source: 'photo' });
    onAppendMessages([{ id: createId(), role: 'assistant', content: `${MEAL_LABELS[pendingMeal.mealType]} registrada. La tomaré en cuenta para las recomendaciones del resto del día.`, createdAt: new Date().toISOString() }]);
    setPendingMeal(null);
  };

  const handleHealthDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') return setError('Por ahora VITACOACH acepta estudios en PDF.');
    if (file.size > 8_000_000) return setError('El PDF debe pesar menos de 8 MB.');
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('No pudimos leer el PDF.')); reader.readAsDataURL(file); });
    const message = `📄 Revisa mi documento de salud “${file.name}”. Resume los hallazgos medidos, señala qué valores aparecen fuera del rango del propio laboratorio y explícame qué conviene conversar con un profesional. No hagas un diagnóstico.`;
    const reply = await ask(message, { history: snapshot.coachMessages, attachment: { filename: file.name, mimeType: 'application/pdf', dataUrl } });
    if (reply) onAddHealthDocument({ filename: file.name, mimeType: file.type, summary: reply });
  };

  const composer = <div className="coach-footer"><div className="suggestion-grid">{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={busy} onClick={() => void submit(undefined, suggestion)}>{suggestion}</button>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <form className="coach-composer" onSubmit={(event) => void submit(event)}><button type="button" className="coach-tool-button" disabled={busy} aria-label="Añadir foto" onClick={() => setPhotoPickerOpen(true)}><IonIcon icon={cameraOutline} /></button><input ref={photoCameraRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void handlePhoto(event)} /><input ref={photoAlbumRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handlePhoto(event)} /><input ref={photoFileRef} className="sr-only" type="file" accept="image/*" onChange={(event) => void handlePhoto(event)} /><button type="button" className="coach-tool-button coach-document-button" disabled={busy} aria-label="Adjuntar estudios en PDF" onClick={() => documentRef.current?.click()}><IonIcon icon={documentAttachOutline} /></button><input ref={documentRef} className="sr-only" type="file" accept="application/pdf" onChange={(event) => void handleHealthDocument(event)} /><label htmlFor="coach-message" className="sr-only">{english ? 'Message VITACOACH' : 'Mensaje para VITACOACH'}</label><textarea id="coach-message" rows={2} maxLength={1500} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={english ? 'Message VITACOACH…' : 'Escríbele a VITACOACH…'} disabled={busy} onFocus={() => window.requestAnimationFrame(() => conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'auto' }))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} /><button type="button" className="coach-tool-button" disabled={busy} aria-label="Hablar por voz" onClick={(event) => { event.currentTarget.blur(); setVoiceOpen(true); }}><IonIcon icon={micOutline} /></button><button type="submit" disabled={busy || !draft.trim()} aria-label={english ? 'Send message' : 'Enviar mensaje'}><IonIcon icon={paperPlaneOutline} /></button></form></div>;

  return <IonPage className={`app-page coach-page${isNativeIos ? ' native-coach-page' : ''}`}><IonContent scrollY={false}><main className="page-shell coach-shell vitacoach-shell">
    <header className="app-header"><BrandMark compact /><button className="voice-call-button" onClick={(event) => { event.currentTarget.blur(); setVoiceOpen(true); }}><IonIcon icon={callOutline} /><span>{english ? 'Call' : 'Llamar'}</span></button></header>
    <section className="coach-heading"><span><IonIcon icon={sparklesOutline} /></span><div><p className="eyebrow coach-memory-status"><span>VITACOACH</span><span title="Puedes pedirme que recuerde, corrija u olvide algo"><IonIcon icon={shieldCheckmarkOutline} /> Memoria activa</span></p><h1>{english ? `I'm with you, ${profile.preferredName}` : `Estoy contigo, ${profile.preferredName}`}</h1><p>{english ? 'Chat freely, send a meal photo, or start a voice conversation.' : 'Habla libremente, envía una foto de tu comida o inicia una conversación por voz.'}</p></div></section>
    <section ref={conversationRef} className="coach-conversation" aria-live="polite">
      {snapshot.coachMessages.length === 0 && <div className="chat-bubble chat-bubble--coach"><IonIcon icon={chatbubbleEllipsesOutline} /><p>{english ? 'I am VITACOACH. I use your goals, workouts, meals and preferences to coach you with context. Tell me what is really going on today.' : 'Soy VITACOACH. Uso tus metas, entrenamientos, comidas y preferencias para acompañarte con contexto. Cuéntame cómo va tu día de verdad.'}</p></div>}
      {snapshot.coachMessages.map((message) => <article key={message.id} className={`coach-message coach-message--${message.role}`}><span>{message.role === 'assistant' ? 'VC' : profile.preferredName.slice(0, 1).toUpperCase()}</span><div><small>{message.role === 'assistant' ? 'VITACOACH' : (english ? 'You' : 'Tú')}</small><p>{message.content}</p></div></article>)}
      {pendingMeal && <article className="coach-food-confirmation"><img src={pendingMeal.preview} alt="Alimento analizado" /><div><small>Estimación visual · {Math.round(pendingMeal.analysis.overallConfidence * 100)}% confianza</small><label className="field"><span>Alimento</span><input value={pendingMeal.name} onChange={(event) => setPendingMeal({ ...pendingMeal, name: event.target.value })} /></label><label className="field"><span>Momento detectado por la hora</span><select value={pendingMeal.mealType} onChange={(event) => setPendingMeal({ ...pendingMeal, mealType: event.target.value as MealType })}>{Object.entries(MEAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p><strong>{pendingMeal.analysis.totals.calories} kcal</strong> · {pendingMeal.analysis.totals.proteinG}g P · {pendingMeal.analysis.totals.carbohydratesG}g C · {pendingMeal.analysis.totals.fatG}g G</p><div><IonButton size="small" className="primary-button" onClick={confirmMeal}>Confirmar y registrar</IonButton><IonButton size="small" fill="clear" color="medium" onClick={() => setPendingMeal(null)}>Descartar</IonButton></div></div></article>}
      {busy && <article className="coach-message coach-message--assistant"><span>VC</span><div><small>VITACOACH</small><p className="coach-thinking"><IonSpinner name="dots" /> {english ? 'Thinking…' : 'Pensando…'}</p></div></article>}
      {lastAction && <article className="coach-action-confirmed"><IonIcon icon={checkmarkCircleOutline} /><div><strong>{lastAction.kind === 'meal' ? 'Comida registrada' : lastAction.kind === 'workout' ? 'Actividad registrada' : 'Plan alimenticio actualizado'}</strong><span>{lastAction.label}</span></div>{lastAction.kind !== 'plan' && lastAction.id && <button onClick={() => { if (lastAction.kind === 'meal') onDeleteMeal(lastAction.id!); else onDeleteWorkout(lastAction.id!); setLastAction(null); }}>Deshacer</button>}</article>}
      <div ref={endRef} />
    </section>
  </main></IonContent><IonFooter className="coach-input-footer">{composer}</IonFooter><IonActionSheet isOpen={photoPickerOpen} onDidDismiss={() => setPhotoPickerOpen(false)} header="Añadir foto de alimento" buttons={[{ text: 'Tomar foto', icon: cameraOutline, handler: () => { if (isNativeIos) void handleNativePhoto('camera'); else photoCameraRef.current?.click(); } }, { text: 'Elegir del álbum', icon: imagesOutline, handler: () => { if (isNativeIos) void handleNativePhoto('photos'); else photoAlbumRef.current?.click(); } }, { text: 'Elegir archivo', icon: folderOpenOutline, handler: () => photoFileRef.current?.click() }, { text: 'Cancelar', role: 'cancel' }]} /><VoiceCall open={voiceOpen} english={english} getContext={context} onClose={() => setVoiceOpen(false)} onAsk={(text) => ask(text)} onEnded={async (event) => {
    try {
      onAppendMessages([await recordCoachCall({ locale: uiLocale, ...event })]);
    } catch {
      const duration = formatCallDuration(event.durationSeconds);
      onAppendMessages([{ id: createId(), role: 'assistant', content: english ? `📞 Voice call with VITACOACH · ${duration}` : `📞 Llamada con VITACOACH · ${duration}`, createdAt: event.endedAt }]);
    }
  }} /></IonPage>;
};

interface SpeechResultEvent { results: { [index: number]: { [index: number]: { transcript: string } } } }
interface SpeechErrorEvent { error?: string }
interface BrowserRecognition { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: SpeechResultEvent) => void) | null; onerror: ((event: SpeechErrorEvent) => void) | null; onend: (() => void) | null; start(): void; stop(): void }
type RecognitionConstructor = new () => BrowserRecognition;

function formatCallDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function VoiceCall({ open, english, getContext, onClose, onAsk, onEnded }: { open: boolean; english: boolean; getContext(): CoachChatContext; onClose(): void; onAsk(text: string): Promise<string | null>; onEnded(event: { durationSeconds: number; startedAt: string; endedAt: string }): void | Promise<void> }) {
  const [listening, setListening] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [connectionError, setConnectionError] = useState(false);
  const [requiresSecureContext, setRequiresSecureContext] = useState(false);
  const [status, setStatus] = useState(english ? 'Linking call…' : 'Enlazando llamada…');
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const activeRef = useRef(false);
  const awaitingRef = useRef(false);
  const speakingRef = useRef(false);
  const mutedRef = useRef(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const completedToolCallsRef = useRef(new Set<string>());
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const finalizedRef = useRef(false);

  useEffect(() => {
    if (!callActive) { setCallSeconds(0); return; }
    const startedAt = Date.now();
    const tick = () => setCallSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [callActive]);

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
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, startsAt);
        gain.gain.setValueAtTime(0.0001, startsAt);
        gain.gain.exponentialRampToValueAtTime(0.045, startsAt + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.085);
        oscillator.connect(gain); gain.connect(audioContext.destination);
        oscillator.start(startsAt); oscillator.stop(startsAt + 0.09);
      });
      window.setTimeout(() => void audioContext.close(), 650);
    } catch { /* El tono es decorativo; la llamada continúa si el navegador lo bloquea. */ }
  };

  const chooseVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const language = english ? 'en' : 'es';
    const preferred = english ? /samantha|ava|allison|serena/i : /paulina|m[oó]nica|luciana|samantha/i;
    return voices.find((voice) => voice.lang.toLowerCase().startsWith(language) && preferred.test(voice.name))
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(language));
  };

  const listen = () => {
    if (!activeRef.current || mutedRef.current || awaitingRef.current || speakingRef.current || peerRef.current) return;
    const speechWindow = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setConnectionError(true); return setStatus(english ? 'Voice recognition is unavailable.' : 'El reconocimiento de voz no está disponible.'); }
    const recognition = new Recognition(); recognition.lang = english ? 'en-US' : 'es-MX'; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      setListening(false); awaitingRef.current = true; setStatus(transcript);
      void onAsk(transcript).then((reply) => {
        awaitingRef.current = false;
        if (!reply || !activeRef.current || mutedRef.current) return window.setTimeout(listen, 250);
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = english ? 'en-US' : 'es-MX'; utterance.rate = 0.96; utterance.pitch = 1; utterance.volume = 0.94;
        const voice = chooseVoice(); if (voice) utterance.voice = voice;
        speakingRef.current = true; setSpeaking(true); setStatus(english ? 'VITACOACH is speaking…' : 'VITACOACH está respondiendo…');
        utterance.onend = () => { speakingRef.current = false; setSpeaking(false); if (activeRef.current && !mutedRef.current) window.setTimeout(listen, 350); };
        window.speechSynthesis.speak(utterance);
      });
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(event.error ?? '')) {
        setConnectionError(true); setStatus(english ? 'Microphone connection failed.' : 'No fue posible conectar el micrófono.'); return;
      }
      if (activeRef.current && !mutedRef.current && !awaitingRef.current) window.setTimeout(listen, 700);
    };
    recognition.onend = () => { setListening(false); if (activeRef.current && !mutedRef.current && !awaitingRef.current && !speakingRef.current && !peerRef.current) window.setTimeout(listen, 300); };
    recognitionRef.current = recognition; setListening(true); setStatus(english ? 'Listening…' : 'Escuchando…');
    try { recognition.start(); } catch { setListening(false); }
  };
  const startBrowserFallback = () => {
    peerRef.current = null;
    setConnectionError(false);
    setStatus(english ? 'Listening…' : 'Escuchando…');
    window.setTimeout(listen, 250);
  };

  const startCall = async () => {
    if (activeRef.current) return;
    window.speechSynthesis.cancel();
    activeRef.current = true;
    startedAtRef.current = new Date().toISOString();
    finalizedRef.current = false;
    completedToolCallsRef.current.clear();
    mutedRef.current = false;
    setMuted(false);
    setConnectionError(false);
    setRequiresSecureContext(false);
    setCallActive(true);
    setStatus(english ? 'Linking call…' : 'Enlazando llamada…');
    playConnectionTone();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      activeRef.current = false;
      setCallActive(false);
      setConnectionError(true);
      setRequiresSecureContext(true);
      setStatus(english ? 'Voice calls on iPhone require a secure HTTPS connection.' : 'Las llamadas en iPhone requieren una conexión HTTPS segura.');
      return;
    }
    try {
      const secret = await fetchRealtimeToken(getContext());
      if (!secret.value) throw new Error('Token efímero vacío');
      if (!activeRef.current) return;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      peer.ontrack = (event) => { audio.srcObject = event.streams[0]; void audio.play().catch(() => undefined); };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!activeRef.current) { stream.getTracks().forEach((track) => track.stop()); peer.close(); return; }
      streamRef.current = stream;
      for (const track of stream.getTracks()) peer.addTrack(track, stream);
      const channel = peer.createDataChannel('oai-events');
      channelRef.current = channel;
      channel.onopen = () => { setConnectionError(false); setListening(true); setStatus(english ? 'Listening…' : 'Escuchando…'); };
      const resolveReportedUpdate = async (callId: string, transcript: string) => {
        if (completedToolCallsRef.current.has(callId)) return;
        completedToolCallsRef.current.add(callId);
        const reply = await onAsk(transcript);
        if (!channelRef.current || channelRef.current.readyState !== 'open') return;
        channelRef.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ recorded: Boolean(reply), transcript }) },
        }));
        channelRef.current.send(JSON.stringify({ type: 'response.create' }));
      };
      channel.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as { type?: string; response?: { output?: Array<{ type?: string; name?: string; call_id?: string; arguments?: string }> } };
          if (payload.type?.includes('speech_started')) { setListening(true); setSpeaking(false); setStatus(english ? 'Listening…' : 'Escuchando…'); }
          if (payload.type?.includes('response') && payload.type?.includes('audio')) { setListening(false); setSpeaking(true); setStatus(english ? 'VITACOACH is speaking…' : 'VITACOACH está respondiendo…'); }
          if (payload.type === 'response.done') {
            for (const output of payload.response?.output ?? []) {
              if (output.type !== 'function_call' || output.name !== 'record_reported_update' || !output.call_id) continue;
              try {
                const args = JSON.parse(output.arguments ?? '{}') as { transcript?: string };
                if (args.transcript?.trim()) void resolveReportedUpdate(output.call_id, args.transcript.trim());
              } catch { /* El modelo no pudo formar argumentos válidos; continúa la conversación. */ }
            }
          }
          if (payload.type === 'response.done') { setSpeaking(false); setListening(!mutedRef.current); setStatus(mutedRef.current ? (english ? 'Microphone muted' : 'Micrófono silenciado') : (english ? 'Listening…' : 'Escuchando…')); }
        } catch { /* Ignore non-JSON transport events. */ }
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') { setConnectionError(false); setStatus(english ? 'Listening…' : 'Escuchando…'); }
        if (peer.connectionState === 'failed' && activeRef.current) { setConnectionError(true); setStatus(english ? 'Connection error' : 'Error de conexión'); }
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { Authorization: `Bearer ${secret.value}`, 'Content-Type': 'application/sdp' }, body: offer.sdp });
      if (!response.ok) throw new Error(`Realtime ${response.status}`);
      const answerSdp = await response.text();
      if (!activeRef.current) { peer.close(); return; }
      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch {
      if (!activeRef.current) return;
      peerRef.current?.close();
      peerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      // iOS Safari does not provide the old SpeechRecognition API.  Do not
      // pretend that the microphone failed when the Realtime connection is
      // the actual issue; this also keeps the modal truthful on iPhone.
      const speechWindow = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
      if (speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition) {
        startBrowserFallback();
      } else {
        setListening(false);
        setConnectionError(true);
        setStatus(english ? 'We could not connect the voice call. Check HTTPS and try again.' : 'No pudimos conectar la llamada. Verifica HTTPS e inténtalo de nuevo.');
      }
    }
  };
  const toggleMute = () => {
    if (!callActive) return;
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted; setMuted(nextMuted);
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    if (nextMuted) {
      recognitionRef.current?.stop(); setListening(false); setStatus(english ? 'Microphone muted' : 'Micrófono silenciado');
    } else {
      setStatus(speakingRef.current ? (english ? 'VITACOACH is speaking…' : 'VITACOACH está respondiendo…') : (english ? 'Listening…' : 'Escuchando…'));
      if (!peerRef.current && !speakingRef.current) window.setTimeout(listen, 150);
    }
  };
  const stop = () => {
    activeRef.current = false; awaitingRef.current = false; speakingRef.current = false; mutedRef.current = false;
    recognitionRef.current?.stop(); peerRef.current?.close(); channelRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
    peerRef.current = null; channelRef.current = null; streamRef.current = null; audioRef.current = null;
    setListening(false); setSpeaking(false); setMuted(false); setCallActive(false); setConnectionError(false); window.speechSynthesis.cancel();
  };
  const close = () => {
    if (!finalizedRef.current && startedAtRef.current) {
      finalizedRef.current = true;
      const endedAt = new Date().toISOString();
      const durationSeconds = Math.max(callSeconds, Math.floor((new Date(endedAt).getTime() - new Date(startedAtRef.current).getTime()) / 1000));
      if (durationSeconds > 0) void onEnded({ durationSeconds, startedAt: startedAtRef.current, endedAt });
    }
    stop(); onClose();
  };
  const activityStatus = muted ? (english ? 'Microphone muted' : 'Micrófono silenciado') : status;
  return <IonModal isOpen={open} onWillPresent={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }} onDidPresent={() => { closeButtonRef.current?.focus(); void startCall(); }} onDidDismiss={close} className="voice-call-modal"><div className="voice-call"><button ref={closeButtonRef} className="voice-close" aria-label={english ? 'End call' : 'Finalizar llamada'} onClick={close}><IonIcon icon={closeOutline} /></button><div className={`voice-orb${speaking ? ' is-speaking' : listening ? ' is-listening' : callActive ? ' is-connecting' : ''}`}><span>VC</span></div><p className="eyebrow">VITACOACH</p><h2>{english ? 'Voice call' : 'Llamada de voz'}</h2><p className={`voice-timer${connectionError ? ' is-error' : ''}`}>{requiresSecureContext ? 'HTTPS requerido' : connectionError ? (english ? 'Connection error' : 'Error de conexión') : formatCallDuration(callSeconds)}</p><p className="voice-status" aria-live="polite">{activityStatus}</p><button className={`voice-mic${muted ? ' is-muted' : ' is-live'}`} aria-label={muted ? (english ? 'Unmute microphone' : 'Activar micrófono') : (english ? 'Mute microphone' : 'Silenciar micrófono')} aria-pressed={muted} disabled={!callActive || connectionError} onClick={toggleMute}><IonIcon icon={muted ? micOffOutline : micOutline} /></button></div></IonModal>;
}

export default Coach;
