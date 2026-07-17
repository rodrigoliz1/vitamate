import { useState, type CSSProperties } from 'react';
import { IonContent, IonIcon, IonModal, IonPage, IonRouterLink } from '@ionic/react';
import { alarmOutline, barbellOutline, chatbubbleEllipsesOutline, chevronForward, closeOutline, restaurantOutline } from 'ionicons/icons';
import { buildWeeklyNutritionBalance, buildWeeklyWorkoutBalance, percentage, sessionsThisWeek, summarizeNutritionDay } from '@vitamate/domain';
import { BrandMark } from '../components/BrandMark';
import type { VitamateSnapshot } from '../data/localRepository';

const Hoy = ({ snapshot, isPremium }: { snapshot: VitamateSnapshot; isPremium: boolean }) => {
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const { profile, nutritionTarget: target, meals } = snapshot;
  if (!profile) return null;
  const totals = summarizeNutritionDay(meals);
  const sessions = sessionsThisWeek(snapshot.workoutSessions);
  const targetSessions = snapshot.workoutPlan?.days.length ?? profile.weeklyTrainingDays;
  const hasTarget = target?.status === 'calculated' && target.calories !== null;
  const remaining = hasTarget ? Math.max(0, target.calories! - totals.calories) : null;
  const progress = percentage(totals.calories, target?.calories ?? null);
  const rawProgress = hasTarget ? Math.max(0, Math.round((totals.calories / target.calories!) * 100)) : 0;
  const exceeded = rawProgress > 100;
  const weeklyNutrition = buildWeeklyNutritionBalance(meals, target);
  const weeklyWorkout = buildWeeklyWorkoutBalance(profile, snapshot.workoutSessions);
  const date = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return <IonPage className="app-page"><IonContent fullscreen>
    <main className="page-shell dashboard-shell">
      <header className="app-header"><BrandMark compact /><span className="date-pill">{date}</span></header>
      <section className="welcome-block"><p className="eyebrow">Tu día</p><h1>Hola, <IonRouterLink routerLink="/cuenta" className="profile-name-link">{profile.preferredName}<IonIcon icon={chevronForward} /></IonRouterLink>.</h1><p>Pequeñas decisiones, registradas con constancia.</p></section>
      {!hasTarget && <section className="safety-notice"><strong>Objetivo nutricional pendiente</strong><p>{target?.status === 'needs_professional_review' ? 'Tu cuestionario requiere revisión profesional antes de personalizar objetivos.' : 'Falta un dato necesario para calcular tu estimación.'}</p></section>}
      <div className="dashboard-grid">
        <section className={`energy-card${isPremium ? ' energy-card--interactive' : ''}${exceeded ? ' energy-card--exceeded' : ''}`} role={isPremium ? 'button' : undefined} tabIndex={isPremium ? 0 : undefined} onClick={() => isPremium && setNutritionOpen(true)} onKeyDown={(event) => { if (isPremium && (event.key === 'Enter' || event.key === ' ')) setNutritionOpen(true); }}>
          <div className="energy-card__heading"><div><p className="eyebrow">Nutrición de hoy · ver balance semanal</p><div className="calorie-value"><strong>{totals.calories.toLocaleString('es-MX')}</strong><span>{hasTarget ? `/ ${target.calories?.toLocaleString('es-MX')} kcal` : ' kcal'}</span></div></div><div className="energy-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}><span>{rawProgress}%</span></div></div>
          <div className="energy-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="energy-meta"><span>{totals.calories} kcal consumidas</span>{hasTarget && <span>{exceeded ? `${totals.calories - target.calories!} kcal excedidas hoy` : `${remaining} kcal restantes`}</span>}</div>
          <div className="macro-grid"><Macro label="Proteína" value={totals.proteinG} target={target?.proteinG ?? null} /><Macro label="Carbohidratos" value={totals.carbohydratesG} target={target?.carbohydratesG ?? null} tone="peach" /><Macro label="Grasa" value={totals.fatG} target={target?.fatG ?? null} tone="navy" /></div>
        </section>
        <section className="week-card"><p className="eyebrow">Entrenamiento semanal</p><strong>{sessions.length}<small> / {targetSessions} sesiones</small></strong><div className="energy-track"><span style={{ width: `${percentage(weeklyWorkout.minutes, weeklyWorkout.targetMinutes)}%` }} /></div><p>{weeklyWorkout.remainingMinutes ? `Llevas ${weeklyWorkout.minutes} min. Faltan ${weeklyWorkout.remainingMinutes} min y ~${weeklyWorkout.remainingCalories} kcal de actividad esta semana.` : 'Cumpliste el volumen semanal. El movimiento extra es opcional y debe favorecer tu recuperación.'}</p><IonRouterLink routerLink="/entrenar">Ver plan e historial <IonIcon icon={chevronForward} /></IonRouterLink></section>
      </div>
      <section className="quick-section"><h2>Acciones rápidas</h2><div className="quick-grid"><Quick href="/nutricion" icon={restaurantOutline} label="Registrar alimento" /><Quick href="/recordatorios" icon={alarmOutline} label="Recordatorios y agua" /><Quick href="/entrenar" icon={barbellOutline} label="Iniciar entrenamiento" />{isPremium && <Quick href="/coach" icon={chatbubbleEllipsesOutline} label="Hablar con VITACOACH" accent />}</div></section>
      {snapshot.workoutSessions.length > 0 && <section className="today-history"><header><h2>Entrenamientos recientes</h2><IonRouterLink routerLink="/entrenar">Ver todos</IonRouterLink></header>{snapshot.workoutSessions.slice(0, 3).map((session) => <article key={session.id}><IonIcon icon={barbellOutline} /><span><strong>{session.workoutTitle}</strong><small>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(session.completedAt))}</small></span><b>{session.durationMinutes} min{session.caloriesBurned ? ` · ${session.caloriesBurned} kcal` : ''}</b></article>)}</section>}
    </main>
  </IonContent><IonModal isOpen={nutritionOpen} onDidDismiss={() => setNutritionOpen(false)} className="balance-modal"><div className="modal-card"><header><div><p className="eyebrow">Balance semanal</p><h2>Tu margen se ajusta a tu vida</h2></div><button className="icon-button" onClick={() => setNutritionOpen(false)}><IonIcon icon={closeOutline} /></button></header>{weeklyNutrition ? <div className="weekly-balance-content"><p>No necesitas acertar cada día: la meta se evalúa de lunes a domingo. Un déficit o exceso de hoy se distribuye entre los días restantes.</p><BalanceRow label="Calorías" consumed={weeklyNutrition.consumed.calories} target={weeklyNutrition.target.calories} balance={weeklyNutrition.balance.calories} unit="kcal" /><BalanceRow label="Proteína" consumed={Math.round(weeklyNutrition.consumed.proteinG)} target={weeklyNutrition.target.proteinG} balance={Math.round(weeklyNutrition.balance.proteinG)} unit="g" /><BalanceRow label="Carbohidratos" consumed={Math.round(weeklyNutrition.consumed.carbohydratesG)} target={weeklyNutrition.target.carbohydratesG} balance={Math.round(weeklyNutrition.balance.carbohydratesG)} unit="g" /><BalanceRow label="Grasa" consumed={Math.round(weeklyNutrition.consumed.fatG)} target={weeklyNutrition.target.fatG} balance={Math.round(weeklyNutrition.balance.fatG)} unit="g" /><div className="weekly-adjustment"><strong>Referencia para cada uno de los {weeklyNutrition.daysRemaining} días restantes</strong><span>{weeklyNutrition.suggestedDailyRemainder.calories} kcal · {weeklyNutrition.suggestedDailyRemainder.proteinG}g P · {weeklyNutrition.suggestedDailyRemainder.carbohydratesG}g C · {weeklyNutrition.suggestedDailyRemainder.fatG}g G</span><small>Es una referencia flexible, no una obligación de compensar con restricciones.</small></div></div> : <p>Completa tu perfil para calcular el balance semanal.</p>}</div></IonModal></IonPage>;
};

function BalanceRow({ label, consumed, target, balance, unit }: { label: string; consumed: number; target: number; balance: number; unit: string }) {
  const over = balance < 0;
  return <article className={`balance-row${over ? ' is-over' : ''}`}><span><strong>{label}</strong><small>{consumed.toLocaleString('es-MX')} / {target.toLocaleString('es-MX')} {unit}</small></span><b>{over ? `${Math.abs(balance).toLocaleString('es-MX')} ${unit} excedidos` : `${balance.toLocaleString('es-MX')} ${unit} disponibles`}</b></article>;
}

function Macro({ label, value, target, tone = 'green' }: { label: string; value: number; target: number | null; tone?: string }) {
  return <article className={`macro-card macro-card--${tone}`}><div><span>{label}</span><strong>{Math.round(value)}g</strong></div><div className="macro-track"><span style={{ width: `${percentage(value, target)}%` }} /></div><small>{target ? `${target}g objetivo` : 'Sin objetivo'}</small></article>;
}

function Quick({ href, icon, label, accent = false }: { href: string; icon: string; label: string; accent?: boolean }) {
  return <IonRouterLink routerLink={href} className={`quick-action${accent ? ' quick-action--accent' : ''}`}><span className="quick-action__icon"><IonIcon icon={icon} /></span><strong>{label}</strong><IonIcon icon={chevronForward} /></IonRouterLink>;
}

export default Hoy;
