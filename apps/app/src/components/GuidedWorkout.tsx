import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { addOutline, arrowBack, checkmarkCircle, closeOutline, pause, play, removeOutline, swapHorizontalOutline, timeOutline } from 'ionicons/icons';
import { buildWorkoutFeedback, getProgressivePrescription, type UserProfile, type WorkoutDay, type WorkoutExerciseResult, type WorkoutSession, type WorkoutSetResult } from '@vitamate/domain';
import { createActiveWorkout, type ActiveExerciseDraft, type ActiveWorkoutState } from '../data/activeWorkoutRepository';
import { ExerciseGuide } from './ExerciseGuide';

interface Props {
  day: WorkoutDay;
  profile: UserProfile;
  history: WorkoutSession[];
  initialState?: ActiveWorkoutState | null;
  onProgress(state: ActiveWorkoutState): void;
  onExit(): void;
  onFinish(startedAt: string, durationMinutes: number, results: WorkoutExerciseResult[]): void;
}

const emptyDraft = (): ActiveExerciseDraft => ({ reps: 0, completedSets: [], loadInput: '', repTimestamps: [], timedSeconds: 0 });

export class GuidedWorkoutBoundary extends Component<{ children: ReactNode; onExit(): void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Guided workout render failed', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="guided-workout guided-workout--summary"><p className="eyebrow">No pudimos abrir la sesión</p><h1>El entrenamiento sigue guardado.</h1><p>{this.state.error.message}</p><IonButton className="primary-button" onClick={this.props.onExit}>Volver a mi plan</IonButton></div>;
  }
}

export function GuidedWorkout({ day, profile, history, initialState, onProgress, onExit, onFinish }: Props) {
  const transitionTimer = useRef<number | null>(null);
  const [state, setState] = useState<ActiveWorkoutState>(() => initialState?.day.id === day.id ? initialState : createActiveWorkout(day, profile.completedAt));
  const [timerRunning, setTimerRunning] = useState(false);
  const [rating, setRating] = useState(false);
  const [finished, setFinished] = useState(false);
  const [postponed, setPostponed] = useState('');
  const exercise = day.exercises.find(({ id }) => id === state.queue[0]);
  const draft = exercise ? (state.drafts[exercise.id] ?? emptyDraft()) : emptyDraft();
  const prescription = useMemo(() => exercise ? getProgressivePrescription(exercise, history) : null, [exercise, history]);
  const targetReps = exercise?.targetReps ? (prescription?.targetRepsPerSet ?? exercise.targetReps) : null;
  const targetSeconds = exercise?.targetSeconds ? exercise.targetSeconds * exercise.sets : null;
  const currentSet = Math.min(exercise?.sets ?? 1, draft.completedSets.length + 1);

  const updateDraft = (recipe: (current: ActiveExerciseDraft) => ActiveExerciseDraft) => {
    if (!exercise) return;
    setState((current) => ({ ...current, drafts: { ...current.drafts, [exercise.id]: recipe(current.drafts[exercise.id] ?? emptyDraft()) }, updatedAt: new Date().toISOString() }));
  };

  useEffect(() => {
    const interval = window.setInterval(() => setState((current) => ({ ...current, elapsedSeconds: current.elapsedSeconds + 1, updatedAt: new Date().toISOString() })), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => { onProgress(state); }, [state, onProgress]);
  useEffect(() => () => { if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current); }, []);

  useEffect(() => {
    if (!exercise || !prescription || state.drafts[exercise.id]) return;
    updateDraft((current) => ({ ...current, loadInput: prescription.suggestedLoadKg?.toString() ?? prescription.previousLoadKg?.toString() ?? '' }));
  }, [exercise?.id, prescription?.suggestedLoadKg, prescription?.previousLoadKg]);

  useEffect(() => {
    if (!timerRunning || rating || finished || !exercise) return;
    const interval = window.setInterval(() => updateDraft((current) => {
      const next = current.timedSeconds + 1;
      if (targetSeconds && next >= targetSeconds) { window.setTimeout(() => setRating(true), 100); setTimerRunning(false); }
      return { ...current, timedSeconds: next };
    }), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, rating, finished, targetSeconds, exercise?.id]);

  if (!exercise || !prescription) throw new Error('El entrenamiento no contiene un ejercicio pendiente válido.');

  const exerciseProgress = targetReps ? Math.min(100, ((draft.completedSets.length + draft.reps / targetReps) / exercise.sets) * 100) : targetSeconds ? Math.min(100, (draft.timedSeconds / targetSeconds) * 100) : 0;
  const durationMinutes = Math.max(1, Math.ceil(state.elapsedSeconds / 60));
  const feedback = useMemo(() => buildWorkoutFeedback(profile, history, state.results, durationMinutes), [profile, history, state.results, durationMinutes]);
  const parsedLoad = (): number | null => { const value = Number(draft.loadInput.replace(',', '.')); return Number.isFinite(value) && value >= 0 ? value : null; };

  const completeSet = (completedReps = draft.reps) => {
    if (!targetReps || rating || transitionTimer.current !== null) return;
    const setResult: WorkoutSetResult = { setNumber: currentSet, targetReps, completedReps, loadKg: parsedLoad() };
    const nextSets = [...draft.completedSets, setResult];
    updateDraft((current) => ({ ...current, completedSets: nextSets }));
    navigator.vibrate?.([20, 30, 20]);
    transitionTimer.current = window.setTimeout(() => {
      transitionTimer.current = null;
      updateDraft((current) => ({ ...current, reps: 0 }));
      if (nextSets.length >= exercise.sets) setRating(true);
    }, 260);
  };

  const addRep = () => {
    if (!targetReps || rating || transitionTimer.current !== null) return;
    const next = Math.min(targetReps, draft.reps + 1);
    updateDraft((current) => ({ ...current, reps: next, repTimestamps: [...current.repTimestamps, new Date().toISOString()] }));
    navigator.vibrate?.(18);
    if (next >= targetReps) completeSet(next);
  };

  const postponeExercise = () => {
    if (state.queue.length < 2) return;
    setTimerRunning(false); setRating(false); setPostponed(`${exercise.name} quedó al final de la sesión.`);
    setState((current) => ({ ...current, queue: [...current.queue.slice(1), current.queue[0]], updatedAt: new Date().toISOString() }));
  };

  const rateAndContinue = (difficulty: number) => {
    const result: WorkoutExerciseResult = { exerciseId: exercise.id, exerciseSlug: exercise.slug, exerciseName: exercise.name, targetReps, completedReps: draft.completedSets.reduce((sum, set) => sum + set.completedReps, 0), targetSeconds, completedSeconds: draft.timedSeconds, difficulty, repTimestamps: draft.repTimestamps, sets: targetReps ? draft.completedSets : undefined, prescribedLoadKg: prescription.suggestedLoadKg };
    const nextResults = [...state.results, result];
    const nextQueue = state.queue.slice(1);
    const nextState = { ...state, results: nextResults, queue: nextQueue, updatedAt: new Date().toISOString() };
    setState(nextState); setRating(false); setTimerRunning(false); setPostponed('');
    if (!nextQueue.length) { setFinished(true); onFinish(state.startedAt, durationMinutes, nextResults); }
  };

  if (finished) return <div className="guided-workout guided-workout--summary"><div className="workout-complete-icon"><IonIcon icon={checkmarkCircle} /></div><p className="eyebrow">Entrenamiento terminado</p><h1>Completaste {day.title}</h1><div className="completion-stats"><div><strong>{durationMinutes}</strong><span>minutos</span></div><div><strong>{state.results.length}</strong><span>ejercicios</span></div><div><strong>{state.results.reduce((sum, item) => sum + item.completedReps, 0)}</strong><span>repeticiones</span></div></div><section className="feedback-card"><h2>Retroalimentación para ti</h2><p>{feedback}</p></section><IonButton className="primary-button" expand="block" onClick={onExit}>Volver a mi plan</IonButton></div>;

  return <div className="guided-workout">
    <header className="guided-header"><button onClick={onExit} aria-label="Salir y conservar sesión"><IonIcon icon={closeOutline} /></button><div><span>{state.results.length + 1} de {day.exercises.length}</span><strong><IonIcon icon={timeOutline} /> {formatTime(state.elapsedSeconds)}</strong></div></header>
    <div className="guided-progress"><span style={{ width: `${((state.results.length + exerciseProgress / 100) / day.exercises.length) * 100}%` }} /></div>
    <main>
      {postponed && <p className="guided-postponed-note">{postponed}</p>}
      <p className="eyebrow">{targetReps ? `Serie ${currentSet} de ${exercise.sets}` : 'Ejercicio por tiempo'}</p><h1>{exercise.name}</h1><p className="guided-note">{exercise.note}</p>
      <button className="postpone-exercise-button" type="button" disabled={state.queue.length < 2} onClick={postponeExercise}><IonIcon icon={swapHorizontalOutline} /><span><strong>Postergar ejercicio</strong><small>Si la máquina está ocupada, lo moveremos al final</small></span></button>
      <ExerciseGuide exercise={exercise} />
      <ol className="technique-list">{(exercise.instructions ?? [exercise.note]).map((instruction, instructionIndex) => <li key={instruction}><b>{instructionIndex + 1}</b><span>{instruction}</span></li>)}</ol>
      {targetReps ? <><section className="progressive-card"><div><small>Sobrecarga progresiva</small><strong>{prescription.previousLoadKg === null ? 'Crea tu referencia inicial' : `Última carga: ${prescription.previousLoadKg} kg`}</strong><p>{prescription.progressionNote}</p></div><label>Carga de esta serie (kg)<input inputMode="decimal" type="number" min="0" step="0.5" value={draft.loadInput} placeholder="Ej. 40" onChange={(event) => updateDraft((current) => ({ ...current, loadInput: event.target.value }))} /></label></section><section className="rep-counter"><button className="rep-adjust" onClick={() => updateDraft((current) => ({ ...current, reps: Math.max(0, current.reps - 1), repTimestamps: current.repTimestamps.slice(0, -1) }))} aria-label="Restar repetición"><IonIcon icon={removeOutline} /></button><button className="rep-main" onClick={addRep}><span>{draft.reps}</span><small>de {targetReps} reps en esta serie</small><em><IonIcon icon={addOutline} /> Toca por cada repetición</em></button><button className="rep-adjust" onClick={addRep} aria-label="Sumar repetición"><IonIcon icon={addOutline} /></button></section><button className="finish-set-button" onClick={() => completeSet()}>{draft.reps < targetReps ? `Terminar serie con ${draft.reps} ${draft.reps === 1 ? 'repetición' : 'repeticiones'}` : 'Completar serie'}</button><div className="set-progress-row">{Array.from({ length: exercise.sets }, (_, setIndex) => <span key={setIndex} className={setIndex < draft.completedSets.length ? 'is-complete' : setIndex === draft.completedSets.length ? 'is-current' : ''}>{setIndex < draft.completedSets.length ? draft.completedSets[setIndex].completedReps : setIndex + 1}</span>)}</div></> : <section className="timer-counter"><strong>{formatTime(draft.timedSeconds)}</strong><span>objetivo {formatTime(targetSeconds ?? 0)}</span><IonButton className="primary-button" onClick={() => setTimerRunning((value) => !value)}><IonIcon slot="start" icon={timerRunning ? pause : play} />{timerRunning ? 'Pausar' : 'Iniciar'}</IonButton><button className="text-button" onClick={() => setRating(true)}>Terminar este ejercicio</button></section>}
    </main>
    {rating && <div className="difficulty-sheet"><div><p className="eyebrow">Antes de continuar</p><h2>¿Qué tan difícil se sintió?</h2><p>Se guardaron tus repeticiones reales y la carga de cada serie. Esto ajustará la próxima semana.</p><div className="difficulty-options">{[1,2,3,4,5].map((value) => <button key={value} onClick={() => rateAndContinue(value)}><strong>{value}</strong><span>{['Muy fácil','Fácil','Adecuado','Difícil','Muy difícil'][value - 1]}</span></button>)}</div>{(!targetReps && draft.timedSeconds < (targetSeconds ?? 0)) && <button className="text-button" onClick={() => setRating(false)}><IonIcon icon={arrowBack} /> Seguir con el ejercicio</button>}</div></div>}
  </div>;
}

function formatTime(seconds: number): string { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`; }
