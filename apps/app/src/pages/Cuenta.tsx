import { useState } from 'react';
import { IonButton, IonContent, IonIcon, IonModal, IonPage, IonRouterLink, IonSpinner } from '@ionic/react';
import { callOutline, cardOutline, chevronForward, closeOutline, cloudDoneOutline, mailOutline, personCircleOutline, settingsOutline, shieldCheckmarkOutline, trashOutline, warningOutline } from 'ionicons/icons';
import { BrandMark } from '../components/BrandMark';
import { VoiceCreditsModal } from '../components/VoiceCreditsModal';
import type { VitamateSnapshot } from '../data/localRepository';
import type { BillingEntitlement, VoiceCreditBalance, VoiceCreditOffer } from '../services/api';

interface Props {
  snapshot: VitamateSnapshot;
  cloudEmail: string | null;
  entitlement: BillingEntitlement | null;
  voiceBalance: VoiceCreditBalance | null;
  voiceOffers: VoiceCreditOffer[];
  billingBusy: boolean;
  billingMessage: string;
  onOpenSubscription(): void;
  onPurchaseVoice(offer: VoiceCreditOffer): Promise<unknown>;
  onDeleteAccount(): Promise<void>;
}

const goalLabels: Record<string, string> = {
  fat_loss: 'Perder grasa',
  muscle_gain: 'Ganar músculo',
  recomposition: 'Recomposición corporal',
  fitness: 'Mejorar condición',
  maintain: 'Mantenerme',
  habits: 'Crear hábitos',
  strength: 'Ganar fuerza',
};

const Cuenta = ({ snapshot, cloudEmail, entitlement, voiceBalance, voiceOffers, billingBusy, billingMessage, onOpenSubscription, onPurchaseVoice, onDeleteAccount }: Props) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [voiceCatalogOpen, setVoiceCatalogOpen] = useState(false);
  const profile = snapshot.profile!;
  const periodActive = !entitlement?.currentPeriodEnd || Date.parse(entitlement.currentPeriodEnd) > Date.now();
  const premium = entitlement?.plan === 'premium' && ['active', 'trialing'].includes(entitlement.status) && periodActive;
  return (
    <IonPage className="app-page">
      <IonContent fullscreen>
        <main className="page-shell account-shell">
          <header className="app-header">
            <BrandMark compact />
          </header>
          <section className="account-hero">
            <span>
              <IonIcon icon={personCircleOutline} />
            </span>
            <div>
              <p className="eyebrow">Tu cuenta</p>
              <h1>{profile.preferredName}</h1>
              <p>{cloudEmail ?? 'Perfil guardado localmente en este dispositivo'}</p>
            </div>
          </section>
          <div className="account-grid">
            <button className="account-card account-card--button" onClick={onOpenSubscription}>
              <header>
                <IonIcon icon={cardOutline} />
                <div>
                  <small>Suscripción</small>
                  <h2>VITAMATE {premium ? 'Premium' : 'Gratis'}</h2>
                </div>
                <IonIcon className="account-chevron" icon={chevronForward} />
              </header>
              <p>{premium ? (entitlement?.status === 'trialing' ? 'Tu prueba de siete días está activa.' : `Tu acceso Premium está vigente y verificado por ${entitlement?.source === 'apple' ? 'App Store' : 'Stripe'}.`) : 'Macros, búsqueda, código de barras y alimentos personales.'}</p>
              <span className="account-status">{premium ? 'Administrar plan' : 'Ver Premium'}</span>
            </button>
            {premium && (
              <button className="account-card account-card--button" onClick={() => setVoiceCatalogOpen(true)}>
                <header>
                  <IonIcon icon={callOutline} />
                  <div>
                    <small>Llamadas con VITACOACH</small>
                    <h2>{formatVoiceMinutes(voiceBalance?.totalRemainingSeconds ?? 0)} disponibles</h2>
                  </div>
                  <IonIcon className="account-chevron" icon={chevronForward} />
                </header>
                <p>
                  {formatVoiceMinutes(voiceBalance?.monthlyRemainingSeconds ?? 0)} del plan este mes · {formatVoiceMinutes(voiceBalance?.extraBalanceSeconds ?? 0)} extra sin caducidad.
                </p>
                <span className="account-status">Agregar minutos</span>
              </button>
            )}
            <section className="account-card">
              <header>
                <IonIcon icon={cloudEmail ? cloudDoneOutline : mailOutline} />
                <div>
                  <small>Cuenta y respaldo</small>
                  <h2>{cloudEmail ? 'Sincronización disponible' : 'Sin correo vinculado'}</h2>
                </div>
              </header>
              <p>{cloudEmail ? 'Tu historial puede sincronizarse de forma segura con Supabase.' : 'Vincula un correo desde Progreso para proteger tu historial.'}</p>
              <IonRouterLink routerLink="/progreso">
                Administrar respaldo <IonIcon icon={chevronForward} />
              </IonRouterLink>
            </section>
          </div>
          <section className="account-details">
            <h2>Datos del perfil</h2>
            <div>
              <Detail label="Nombre completo" value={profile.fullName ?? profile.preferredName} />
              <Detail label="Objetivo" value={goalLabels[profile.primaryGoal] ?? profile.primaryGoal} />
              <Detail label="Plan de entrenamiento" value={`${profile.weeklyTrainingDays} días · ${profile.trainingMinutes} min`} />
              <Detail label="Nutrición" value={`${profile.mealsPerDay} comidas · ${profile.dietaryPattern}`} />
              <Detail label="Cocina" value={`${profile.cookingLevel} · hasta ${profile.availableCookingMinutes ?? 30} min`} />
              <Detail label="Privacidad" value="Datos sensibles protegidos" icon={shieldCheckmarkOutline} />
            </div>
          </section>
          <IonRouterLink routerLink="/progreso" className="account-settings-link">
            <IonIcon icon={settingsOutline} />
            <span>
              <strong>Editar metas, gustos y necesidades</strong>
              <small>Puedes volver a responder el cuestionario cuando quieras.</small>
            </span>
            <IonIcon icon={chevronForward} />
          </IonRouterLink>
          <button className="account-delete-link" type="button" onClick={() => setDeleteOpen(true)}>
            <IonIcon icon={trashOutline} />
            Eliminar mi cuenta y mis datos
          </button>
        </main>
      </IonContent>
      <VoiceCreditsModal isOpen={voiceCatalogOpen} balance={voiceBalance} offers={voiceOffers} busy={billingBusy} message={billingMessage} onDismiss={() => setVoiceCatalogOpen(false)} onPurchase={onPurchaseVoice} />
      <IonModal
        isOpen={deleteOpen}
        onDidDismiss={() => {
          setDeleteOpen(false);
          setConfirmation('');
          setDeleteError('');
        }}
        className="account-delete-modal"
      >
        <section className="account-delete-dialog">
          <button className="subscription-close" aria-label="Cerrar" onClick={() => setDeleteOpen(false)}>
            <IonIcon icon={closeOutline} />
          </button>
          <span>
            <IonIcon icon={warningOutline} />
          </span>
          <p className="eyebrow">Acción permanente</p>
          <h2>Eliminar cuenta VITAMATE</h2>
          <p>Se eliminarán tu perfil, comidas, entrenamientos, documentos, memoria y conversaciones. Esta acción no se puede deshacer.</p>
          {premium && entitlement?.source === 'apple' && (
            <p>
              <strong>Importante:</strong> una suscripción de App Store seguirá cobrándose hasta que la canceles con Apple. Antes de eliminar tu cuenta, abre Suscripción y elige Administrar en App Store.
            </p>
          )}
          <label className="field">
            <span>Escribe ELIMINAR para confirmar</span>
            <input value={confirmation} autoCapitalize="characters" onChange={(event) => setConfirmation(event.target.value.toLocaleUpperCase('es-MX'))} />
          </label>
          {deleteError && <p className="form-error">{deleteError}</p>}
          <IonButton
            expand="block"
            color="danger"
            disabled={deleteBusy || confirmation !== 'ELIMINAR'}
            onClick={async () => {
              setDeleteBusy(true);
              setDeleteError('');
              try {
                await onDeleteAccount();
                setDeleteOpen(false);
              } catch (error) {
                setDeleteError(error instanceof Error ? error.message : 'No fue posible eliminar la cuenta.');
              } finally {
                setDeleteBusy(false);
              }
            }}
          >
            {deleteBusy ? <IonSpinner /> : 'Eliminar definitivamente'}
          </IonButton>
        </section>
      </IonModal>
    </IonPage>
  );
};

function formatVoiceMinutes(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <article>
      {icon && <IonIcon icon={icon} />}
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </article>
  );
}

export default Cuenta;
