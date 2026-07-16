import { useEffect, useMemo, useState } from 'react';
import { IonButton, IonContent, IonIcon, IonModal, IonPage, IonRouterLink } from '@ionic/react';
import { barbellOutline, chatbubbleEllipsesOutline, checkmarkCircle, closeOutline, createOutline, flameOutline, homeOutline, playCircleOutline, timeOutline, trashOutline } from 'ionicons/icons';
import { buildWeeklyWorkoutBalance, generateStarterWorkoutPlan, sessionsThisWeek, type TrainingEnvironment, type WorkoutDay, type WorkoutExerciseResult, type WorkoutSession } from '@vitamate/domain';
import { BrandMark } from '../components/BrandMark';
import { ExerciseGuide } from '../components/ExerciseGuide';
import { GuidedWorkout, GuidedWorkoutBoundary } from '../components/GuidedWorkout';
import { resolveUiLocale } from '../config/appFeatures';
import type { VitamateSnapshot } from '../data/localRepository';
import { fetchExerciseGuides } from '../services/api';

interface Props {
  snapshot: VitamateSnapshot;
  onCompleteWorkout(day: WorkoutDay, startedAt: string, durationMinutes: number, results: WorkoutExerciseResult[]): void;
  onUpdateWorkout(
    id: string,
    changes: {
      workoutTitle: string;
      activityType: WorkoutSession['activityType'];
      completedAt: string;
      durationMinutes: number;
      caloriesBurned: number;
      perceivedEffort: number;
    },
  ): void;
  onDeleteWorkout(id: string): void;
}

const Entrenar = ({ snapshot, onCompleteWorkout, onUpdateWorkout, onDeleteWorkout }: Props) => {
  const [activeDay, setActiveDay] = useState<WorkoutDay | null>(null);
  const [guides, setGuides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<WorkoutSession | null>(null);
  const profile = snapshot.profile;
  const [environment, setEnvironment] = useState<TrainingEnvironment>(() => (profile?.trainingPreference === 'home' ? 'home' : 'gym'));
  const plan = useMemo(() => (profile ? generateStarterWorkoutPlan(profile, new Date(), environment) : snapshot.workoutPlan), [profile, environment, snapshot.workoutPlan]);
  const weekly = sessionsThisWeek(snapshot.workoutSessions);
  const balance = profile ? buildWeeklyWorkoutBalance(profile, snapshot.workoutSessions) : null;
  useEffect(() => {
    fetchExerciseGuides()
      .then(setGuides)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('guided-workout-active', Boolean(activeDay));
    return () => document.body.classList.remove('guided-workout-active');
  }, [activeDay]);
  const days = useMemo(
    () =>
      plan?.days.map((day) => ({
        ...day,
        exercises: day.exercises.map((exercise) => ({
          ...exercise,
          mediaUrl: guides[exercise.slug] ?? exercise.mediaUrl,
        })),
      })) ?? [],
    [plan, guides],
  );

  const closeWorkout = () => {
    document.body.classList.remove('guided-workout-active');
    setActiveDay(null);
  };

  return (
    <IonPage className="app-page">
      <IonContent fullscreen>
        <main className="page-shell">
          <header className="app-header">
            <BrandMark compact />
            <span className="date-pill">{weekly.length} sesiones esta semana</span>
          </header>
          <section className="page-title">
            <p className="eyebrow">Entrenar</p>
            <h1>{plan?.name ?? 'Tu plan semanal'}</h1>
            <p>{plan?.note}</p>
          </section>
          <section className="training-location-card" aria-labelledby="training-location-title">
            <div>
              <p className="eyebrow">Decisión de hoy</p>
              <h2 id="training-location-title">¿Dónde vas a entrenar?</h2>
              <p>Puedes cambiarlo cada día. VITAMATE mantiene la misma estructura semanal y adapta ejercicios, equipo y progresión.</p>
            </div>
            <div className="training-location-options" role="group" aria-label="Lugar del entrenamiento">
              <button type="button" className={environment === 'gym' ? 'is-active' : ''} aria-pressed={environment === 'gym'} onClick={() => setEnvironment('gym')}>
                <IonIcon icon={barbellOutline} />
                <span>
                  <strong>Gimnasio</strong>
                  <small>Barras, máquinas y poleas</small>
                </span>
              </button>
              <button type="button" className={environment === 'home' ? 'is-active' : ''} aria-pressed={environment === 'home'} onClick={() => setEnvironment('home')}>
                <IonIcon icon={homeOutline} />
                <span>
                  <strong>En casa</strong>
                  <small>Peso corporal, mochila o mancuernas</small>
                </span>
              </button>
            </div>
          </section>
          {balance && (
            <section className="training-requirement-card">
              <div>
                <p className="eyebrow">Meta semanal flexible</p>
                <h2>
                  {balance.caloriesBurned} / {balance.targetCalories} kcal
                </h2>
                <p>{balance.remainingCalories ? `Te faltan aproximadamente ${balance.remainingCalories} kcal de actividad. Puedes repartirlas en los días que mejor encajen contigo; VITACOACH ajustará la sugerencia al tipo de ejercicio que prefieras.` : 'Objetivo semanal cubierto. Prioriza recuperación y movimiento que disfrutes.'}</p>
              </div>
              <span>
                <IonIcon icon={flameOutline} />
                <strong>{Math.min(100, Math.round((balance.caloriesBurned / balance.targetCalories) * 100))}%</strong>
                <small>
                  {balance.sessions} / {balance.targetSessions} sesiones
                </small>
              </span>
              <IonRouterLink routerLink={`/coach?draft=${encodeURIComponent('Registra mi actividad física: ')}`}>
                <IonIcon icon={chatbubbleEllipsesOutline} /> Registrar otro entrenamiento
              </IonRouterLink>
            </section>
          )}
          {plan?.status === 'needs_professional_review' ? (
            <section className="safety-notice">
              <strong>Plan pendiente de revisión</strong>
              <p>Por tus respuestas de seguridad, consulta a un profesional antes de iniciar un programa personalizado.</p>
            </section>
          ) : (
            <section className="workout-grid">
              {days.map((day, index) => (
                <article className="workout-card workout-card--guided" key={day.id}>
                  <header>
                    <span>Día {index + 1}</span>
                    <small>
                      <IonIcon icon={timeOutline} /> {day.durationMinutes} min
                    </small>
                  </header>
                  <h2>{day.title}</h2>
                  <p>{day.focus}</p>
                  <div className="exercise-preview-row" aria-label={`Guías de ${day.title}`}>
                    {day.exercises.map((exercise) => (
                      <div key={exercise.id}>
                        <ExerciseGuide exercise={exercise} />
                        <span>{exercise.name}</span>
                      </div>
                    ))}
                  </div>
                  <ol>
                    {day.exercises.map((item) => (
                      <li key={item.id}>
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.note}</small>
                        </span>
                        <b>
                          {item.sets} × {item.repRange}
                        </b>
                      </li>
                    ))}
                  </ol>
                  <IonButton expand="block" className="primary-button" onClick={() => setActiveDay(day)}>
                    <IonIcon slot="start" icon={playCircleOutline} />
                    Iniciar entrenamiento
                  </IonButton>
                </article>
              ))}
            </section>
          )}
          {snapshot.workoutSessions.length > 0 && (
            <section className="history-section">
              <h2>Sesiones recientes</h2>
              {snapshot.workoutSessions.slice(0, 5).map((session) => (
                <article className="history-row" key={session.id}>
                  <span>
                    <IonIcon icon={checkmarkCircle} />
                  </span>
                  <div>
                    <strong>{session.workoutTitle}</strong>
                    <small>{new Intl.DateTimeFormat(resolveUiLocale(profile?.locale ?? 'es-MX'), { dateStyle: 'medium' }).format(new Date(session.completedAt))}</small>
                  </div>
                  <b>
                    {session.durationMinutes} min · RPE {session.perceivedEffort}
                  </b>
                  {session.source === 'manual' && (
                    <div className="history-row-actions">
                      <button className="icon-button" aria-label={`Editar ${session.workoutTitle}`} onClick={() => setEditing(session)}>
                        <IonIcon icon={createOutline} />
                      </button>
                      <button className="icon-button" aria-label={`Eliminar ${session.workoutTitle}`} onClick={() => onDeleteWorkout(session.id)}>
                        <IonIcon icon={trashOutline} />
                      </button>
                    </div>
                  )}
                  {session.feedback && <p>{session.feedback}</p>}
                </article>
              ))}
            </section>
          )}
        </main>
      </IonContent>
      {activeDay && profile && (
        <section className="guided-workout-layer" role="dialog" aria-modal="true" aria-label={`Entrenamiento ${activeDay.title}`}>
          <GuidedWorkoutBoundary key={activeDay.id} onExit={closeWorkout}>
            <GuidedWorkout day={activeDay} profile={profile} history={snapshot.workoutSessions} onExit={closeWorkout} onFinish={(startedAt, duration, results) => onCompleteWorkout(activeDay, startedAt, duration, results)} />
          </GuidedWorkoutBoundary>
        </section>
      )}
      <IonModal isOpen={Boolean(editing)} onDidDismiss={() => setEditing(null)}>
        <div className="modal-card">
          <header>
            <div>
              <p className="eyebrow">Actividad manual</p>
              <h2>Editar entrenamiento</h2>
            </div>
            <button className="icon-button" onClick={() => setEditing(null)}>
              <IonIcon icon={closeOutline} />
            </button>
          </header>
          {editing && (
            <form
              className="meal-form"
              onSubmit={(event) => {
                event.preventDefault();
                onUpdateWorkout(editing.id, {
                  workoutTitle: editing.workoutTitle,
                  activityType: editing.activityType,
                  completedAt: editing.completedAt,
                  durationMinutes: editing.durationMinutes,
                  caloriesBurned: editing.caloriesBurned ?? 0,
                  perceivedEffort: editing.perceivedEffort,
                });
                setEditing(null);
              }}
            >
              <label className="field">
                <span>Actividad</span>
                <input required value={editing.workoutTitle} onChange={(event) => setEditing({ ...editing, workoutTitle: event.target.value })} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Tipo</span>
                  <select
                    value={editing.activityType ?? 'other'}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        activityType: event.target.value as WorkoutSession['activityType'],
                      })
                    }
                  >
                    <option value="strength">Fuerza</option>
                    <option value="cardio">Cardio</option>
                    <option value="mobility">Movilidad</option>
                    <option value="sport">Deporte</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
                <label className="field">
                  <span>Fecha y hora</span>
                  <input
                    type="datetime-local"
                    value={toLocalDateTime(editing.completedAt)}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        completedAt: new Date(event.target.value).toISOString(),
                      })
                    }
                  />
                </label>
                <WorkoutNumber label="Duración (min)" value={editing.durationMinutes} min={1} onChange={(value) => setEditing({ ...editing, durationMinutes: value })} />
                <WorkoutNumber label="Calorías" value={editing.caloriesBurned ?? 0} min={0} onChange={(value) => setEditing({ ...editing, caloriesBurned: value })} />
                <WorkoutNumber label="Esfuerzo (1–10)" value={editing.perceivedEffort} min={1} max={10} onChange={(value) => setEditing({ ...editing, perceivedEffort: value })} />
              </div>
              <IonButton type="submit" expand="block" className="primary-button">
                Guardar cambios
              </IonButton>
            </form>
          )}
        </div>
      </IonModal>
    </IonPage>
  );
};
function WorkoutNumber({ label, value, min, max, onChange }: { label: string; value: number; min: number; max?: number; onChange(value: number): void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Math.max(min, Math.min(max ?? 100000, Number(event.target.value))))} />
    </label>
  );
}
function toLocalDateTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export default Entrenar;
