import { IonContent, IonIcon, IonPage, IonRouterLink } from '@ionic/react';
import { cardOutline, chevronForward, cloudDoneOutline, mailOutline, personCircleOutline, settingsOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { BrandMark } from '../components/BrandMark';
import type { VitamateSnapshot } from '../data/localRepository';
import type { BillingEntitlement } from '../services/api';

interface Props {
  snapshot: VitamateSnapshot;
  cloudEmail: string | null;
  entitlement: BillingEntitlement | null;
  onOpenSubscription(): void;
}

const goalLabels: Record<string, string> = { fat_loss: 'Perder grasa', muscle_gain: 'Ganar músculo', recomposition: 'Recomposición corporal', fitness: 'Mejorar condición', maintain: 'Mantenerme', habits: 'Crear hábitos', strength: 'Ganar fuerza' };

const Cuenta = ({ snapshot, cloudEmail, entitlement, onOpenSubscription }: Props) => {
  const profile = snapshot.profile!;
  const periodActive = !entitlement?.currentPeriodEnd || Date.parse(entitlement.currentPeriodEnd) > Date.now();
  const premium = entitlement?.plan === 'premium' && ['active', 'trialing'].includes(entitlement.status) && periodActive;
  return <IonPage className="app-page"><IonContent fullscreen><main className="page-shell account-shell">
    <header className="app-header"><BrandMark compact /></header>
    <section className="account-hero"><span><IonIcon icon={personCircleOutline} /></span><div><p className="eyebrow">Tu cuenta</p><h1>{profile.preferredName}</h1><p>{cloudEmail ?? 'Perfil guardado localmente en este dispositivo'}</p></div></section>
    <div className="account-grid"><button className="account-card account-card--button" onClick={onOpenSubscription}><header><IonIcon icon={cardOutline} /><div><small>Suscripción</small><h2>VITAMATE {premium ? 'Premium' : 'Gratis'}</h2></div><IonIcon className="account-chevron" icon={chevronForward} /></header><p>{premium ? entitlement?.status === 'trialing' ? 'Tu prueba de siete días está activa.' : 'Tu acceso Premium está vigente y verificado por Stripe.' : 'Macros, búsqueda, código de barras y alimentos personales.'}</p><span className="account-status">{premium ? 'Administrar plan' : 'Ver Premium'}</span></button><section className="account-card"><header><IonIcon icon={cloudEmail ? cloudDoneOutline : mailOutline} /><div><small>Cuenta y respaldo</small><h2>{cloudEmail ? 'Sincronización disponible' : 'Sin correo vinculado'}</h2></div></header><p>{cloudEmail ? 'Tu historial puede sincronizarse de forma segura con Supabase.' : 'Vincula un correo desde Progreso para proteger tu historial.'}</p><IonRouterLink routerLink="/progreso">Administrar respaldo <IonIcon icon={chevronForward} /></IonRouterLink></section></div>
    <section className="account-details"><h2>Datos del perfil</h2><div><Detail label="Nombre completo" value={profile.fullName ?? profile.preferredName} /><Detail label="Objetivo" value={goalLabels[profile.primaryGoal] ?? profile.primaryGoal} /><Detail label="Plan de entrenamiento" value={`${profile.weeklyTrainingDays} días · ${profile.trainingMinutes} min`} /><Detail label="Nutrición" value={`${profile.mealsPerDay} comidas · ${profile.dietaryPattern}`} /><Detail label="Cocina" value={`${profile.cookingLevel} · hasta ${profile.availableCookingMinutes ?? 30} min`} /><Detail label="Privacidad" value="Datos sensibles protegidos" icon={shieldCheckmarkOutline} /></div></section>
    <IonRouterLink routerLink="/progreso" className="account-settings-link"><IonIcon icon={settingsOutline} /><span><strong>Editar metas, gustos y necesidades</strong><small>Puedes volver a responder el cuestionario cuando quieras.</small></span><IonIcon icon={chevronForward} /></IonRouterLink>
  </main></IonContent></IonPage>;
};

function Detail({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return <article>{icon && <IonIcon icon={icon} />}<span><small>{label}</small><strong>{value}</strong></span></article>;
}

export default Cuenta;
