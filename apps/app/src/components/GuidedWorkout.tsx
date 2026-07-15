import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { addOutline, arrowBack, checkmarkCircle, closeOutline, pause, play, removeOutline, timeOutline } from 'ionicons/icons';
import {
  buildWorkoutFeedback,
  getProgressivePrescription,
  type UserProfile,
  type WorkoutDay,
  type WorkoutExerciseResult,
  type WorkoutSession,
  type WorkoutSetResult,
} from '@vitamate/domain';
import { ExerciseGuide } from './ExerciseGuide';

interface Props {
  day: WorkoutDay;
  profile: UserProfile;
  history: WorkoutSession[];
  onExit(): void;
  onFinish(startedAt: string, durationMinutes: number, results: WorkoutExerciseResult[]): void;
}

export class GuidedWorkoutBoundary extends Component<{ children: ReactNode; onExit(): void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Guided workout render failed', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="guided-workout guided-workout--summary"><p className="eyebrow">No pudimos abrir la sesión</p><h1>El entrenamiento sigue guardado.</h1><p>{this.state.error.message}</p><IonButton className="primary-button" onClick={this.props.onExit}>Volver a mi plan</IonButton></div>;
  }
}

export function GuidedWorkout({ day, profile, history, onExit, onFinish }: Props) {
  const startedAt = useRef(new Date().toISOString());
  const transitionTimer = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [index, setIndex] = useState(0);
  const [reps, setReps] = useState(0);
  const [completedSets, setCompletedSets] = useState<WorkoutSetResult[]>([]);
  const [loadInput, setLoadInput] = useState('');
  const [repTimestamps, setRepTimestamps] = useState<string[]>([]);
  const [timedSeconds, setTimedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [rating, setRating] = useState(false);
  const [results, setResults] = useState<WorkoutExerciseResult[]>([]);
  const [finished, setFinished] = useState(false);
  const exercise = day.exercises[index];
  const prescription = useMemo(() => exercise ? getProgressivePrescription(exercise, history) : null, [exercise, history]);
  const targetReps = exercise?.targetReps ? (prescription?.targetRepsPerSet ?? exercise.targetReps) : null;
  const targetSeconds = exercise?.targetSeconds ? exercise.targetSeconds * exercise.sets : null;
  const currentSet = Math.min(exercise?.sets ?? 1, completedSets.length + 1);

  useEffect(() => {
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
  }, []);

  useEffect(() => {
    setLoadInput(prescription?.suggestedLoadKg?.toString() ?? prescription?.previousLoadKg?.toString() ?? '');
    setCompletedSets([]);
    setReps(0);
    setRepTimestamps([]);
    setTimedSeconds(0);
    setTimerRunning(false);
  }, [exercise?.id, prescription?.suggestedLoadKg, prescription?.previousLoadKg]);

  useEffect(() => {
    if (!timerRunning || rating || finished) return;
    const interval = window.setInterval(() => setTimedSeconds((value) => {
      const next = value + 1;
      if (targetSeconds && next >= targetSeconds) { window.setTimeout(() => setRating(true), 200); setTimerRunning(false); }
      return next;
    }), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, rating, finished, targetSeconds]);

  if (!exercise || !prescription) throw new Error('El entrenamiento no contiene un ejercicio válido.');

  const exerciseProgress = targetReps
    ? Math.min(100, ((completedSets.length + reps / targetReps) / exercise.sets) * 100)
    : targetSeconds ? Math.min(100, (timedSeconds / targetSeconds) * 100) : 0;
  const durationMinutes = Math.max(1, Math.ceil(elapsed / 60));
  const feedback = useMemo(() => buildWorkoutFeedback(profile, history, results, durationMinutes), [profile, history, results, durationMinutes]);

  const parsedLoad = (): number | null => {
    const value = Number(loadInput.replace(',', '.'));
    return Number.isFinite(value) && value >= 0 ? value : null;
  };

  const completeSet = (completedReps = reps) => {
    if (!targetReps || rating || transitionTimer.current !== null) return;
    const setResult: WorkoutSetResult = { setNumber: currentSet, targetReps, completedReps, loadKg: parsedLoad() };
    const nextSets = [...completedSets, setResult];
    setCompletedSets(nextSets);
    navigator.vibrate?.([20, 30, 20]);
    transitionTimer.current = window.setTimeout(() => {
      transitionTimer.current = null;
      setReps(0);
      if (nextSets.length >= exercise.sets) setRating(true);
    }, 260);
  };

  const addRep = () => {
    if (!targetReps || rating || transitionTimer.current !== null) return;
    const next = Math.min(targetReps, reps + 1);
    setReps(next);
    setRepTimestamps((current) => [...current, new Date().toISOString()]);
    navigator.vibrate?.(18);
    if (next >= targetReps) completeSet(next);
  };

  const rateAndContinue = (difficulty: number) => {
    const nextResults = [...results, {
      exerciseId: exercise.id,
      exerciseSlug: exercise.slug,
      exerciseName: exercise.name,
      targetReps,
      completedReps: completedSets.reduce((sum, set) => sum + set.completedReps, 0),
      targetSeconds,
      completedSeconds: timedSeconds,
      difficulty,
      repTimestamps,
      sets: targetReps ? completedSets : undefined,
      prescribedLoadKg: prescription.suggestedLoadKg,
    }];
    setResults(nextResults);
    setRating(false);
    setTimerRunning(false);
    if (index >= day.exercises.length - 1) {
      setFinished(true);
      onFinish(startedAt.current, durationMinutes, nextResults);
    } else setIndex((value) => value + 1);
  };

  if (finished) return <div className="guided-workout guided-workout--summary">
    <div className="workout-complete-icon"><IonIcon icon={checkmarkCircle} /></div>
    <p className="eyebrow">Entrenamiento terminado</p><h1>Completaste {day.title}</h1>
    <div className="completion-stats"><div><strong>{durationMinutes}</strong><span>minutos</span></div><div><strong>{results.length}</strong><span>ejercicios</span></div><div><strong>{results.reduce((sum, item) => sum + item.completedReps, 0)}</strong><span>repeticiones</span></div></div>
    <section className="feedback-card"><h2>Retroalimentación para ti</h2><p>{feedback}</p></section>
    <IonButton className="primary-button" expand="block" onClick={onExit}>Volver a mi plan</IonButton>
  </div>;

  return <div className="guided-workout">
    <header className="guided-header"><button onClick={onExit} aria-label="Salir"><IonIcon icon={closeOutline} /></button><div><span>{index + 1} de {day.exercises.length}</span><strong><IonIcon icon={timeOutline} /> {formatTime(elapsed)}</strong></div></header>
    <div className="guided-progress"><span style={{ width: `${((index + exerciseProgress / 100) / day.exercises.length) * 100}%` }} /></div>
    <main>
      <p className="eyebrow">{targetReps ? `Serie ${currentSet} de ${exercise.sets}` : 'Ejercicio por tiempo'}</p>
      <h1>{exercise.name}</h1><p className="guided-note">{exercise.note}</p>
      <ExerciseGuide exercise={exercise} />
      <ol className="technique-list">{(exercise.instructions ?? [exercise.note]).map((instruction, instructionIndex) => <li key={instruction}><b>{instructionIndex + 1}</b><span>{instruction}</span></li>)}</ol>
      {targetReps ? <>
        <section className="progressive-card"><div><small>Sobrecarga progresiva</small><strong>{prescription.previousLoadKg === null ? 'Crea tu referencia inicial' : `Última carga: ${prescription.previousLoadKg} kg`}</strong><p>{prescription.progressionNote}</p></div><label>Carga de esta serie (kg)<input inputMode="decimal" type="number" min="0" step="0.5" value={loadInput} placeholder="Ej. 40" onChange={(event) => setLoadInput(event.target.value)} /></label></section>
        <section className="rep-counter"><button className="rep-adjust" onClick={() => { setReps(Math.max(0, reps - 1)); setRepTimestamps((current) => current.slice(0, -1)); }} aria-label="Restar repetición"><IonIcon icon={removeOutline} /></button><button className="rep-main" onClick={addRep}><span>{reps}</span><small>de {targetReps} reps en esta serie</small><em><IonIcon icon={addOutline} /> Toca por cada repetición</em></button><button className="rep-adjust" onClick={addRep} aria-label="Sumar repetición"><IonIcon icon={addOutline} /></button></section>
        <button className="finish-set-button" onClick={() => completeSet()}>{reps < targetReps ? `Terminar serie con ${reps} ${reps === 1 ? 'repetición' : 'repeticiones'}` : 'Completar serie'}</button>
        <div className="set-progress-row">{Array.from({ length: exercise.sets }, (_, setIndex) => <span key={setIndex} className={setIndex < completedSets.length ? 'is-complete' : setIndex === completedSets.length ? 'is-current' : ''}>{setIndex < completedSets.length ? completedSets[setIndex].completedReps : setIndex + 1}</span>)}</div>
      </> : <section className="timer-counter"><strong>{formatTime(timedSeconds)}</strong><span>objetivo {formatTime(targetSeconds ?? 0)}</span><IonButton className="primary-button" onClick={() => setTimerRunning((value) => !value)}><IonIcon slot="start" icon={timerRunning ? pause : play} />{timerRunning ? 'Pausar' : 'Iniciar'}</IonButton><button className="text-button" onClick={() => setRating(true)}>Terminar este ejercicio</button></section>}
    </main>
    {rating && <div className="difficulty-sheet"><div><p className="eyebrow">Antes de continuar</p><h2>¿Qué tan difícil se sintió?</h2><p>Se guardaron tus repeticiones reales y la carga de cada serie. Esto ajustará la próxima semana.</p><div className="difficulty-options">{[1,2,3,4,5].map((value) => <button key={value} onClick={() => rateAndContinue(value)}><strong>{value}</strong><span>{['Muy fácil','Fácil','Adecuado','Difícil','Muy difícil'][value - 1]}</span></button>)}</div>{(!targetReps && timedSeconds < (targetSeconds ?? 0)) && <button className="text-button" onClick={() => setRating(false)}><IonIcon icon={arrowBack} /> Seguir con el ejercicio</button>}</div></div>}
  </div>;
}

function formatTime(seconds: number): string { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`; }
