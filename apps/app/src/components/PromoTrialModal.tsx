import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import { checkmarkCircle, closeOutline, giftOutline, shieldCheckmarkOutline, sparkles, star, timeOutline } from 'ionicons/icons';

export type PromoTrialNotice = 'gift' | 'two_days' | 'one_day' | 'today' | 'expired';

interface Props {
  isOpen: boolean;
  notice: PromoTrialNotice;
  preferredName?: string;
  endsAt?: string | null;
  busy?: boolean;
  message?: string;
  onDismiss(): void;
  onClaim(): Promise<void>;
  onSubscribe(): void;
}

export function PromoTrialModal({ isOpen, notice, preferredName, endsAt, busy = false, message = '', onDismiss, onClaim, onSubscribe }: Props) {
  const gift = notice === 'gift';
  const expired = notice === 'expired';
  const reminder = !gift && !expired;
  const name = preferredName?.trim();
  const title = gift
    ? '5 días de VITAMATE Premium para ti'
    : expired
      ? 'Tu prueba gratis ha finalizado'
      : notice === 'two_days'
        ? 'Te quedan 2 días de Premium'
        : notice === 'one_day'
          ? 'Te queda 1 día de Premium'
          : 'Tu prueba Premium finaliza hoy';
  const lead = gift
    ? `${name ? `${name}, e` : 'E'}ste regalo es para que vivas VITAMATE completo, sin compromiso y sin ingresar una tarjeta.`
    : expired
      ? 'Tu información y tus avances siguen seguros. Continúa con el acompañamiento completo de VITACOACH cuando estés listo.'
      : 'Aprovecha cada función hasta el último momento. Tu prueba terminará automáticamente y no se realizará ningún cargo.';

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} backdropDismiss={!busy} className="promo-trial-modal">
      <section className={`promo-trial-shell promo-trial-shell--${notice}`} aria-labelledby="promo-trial-title">
        <button type="button" className="promo-trial-close" aria-label="Cerrar" disabled={busy} onClick={onDismiss}>
          <IonIcon icon={closeOutline} />
        </button>
        <div className="promo-trial-art" aria-hidden="true">
          <i className="promo-trial-orbit"><IonIcon icon={star} /></i>
          <i className="promo-trial-spark promo-trial-spark--one"><IonIcon icon={sparkles} /></i>
          <i className="promo-trial-spark promo-trial-spark--two"><IonIcon icon={sparkles} /></i>
          <span><IonIcon icon={expired ? timeOutline : giftOutline} /></span>
        </div>
        <p className="promo-trial-eyebrow">{gift ? 'REGALO GRATIS' : expired ? 'TU CAMINO CONTINÚA' : 'TU PRUEBA PREMIUM'}</p>
        <h2 id="promo-trial-title">{title}</h2>
        <p className="promo-trial-lead">{lead}</p>

        {gift && (
          <div className="promo-trial-benefits">
            <article><IonIcon icon={checkmarkCircle} /><span><strong>VITACOACH completo</strong><small>Chat, llamadas y gestión de tus registros</small></span></article>
            <article><IonIcon icon={checkmarkCircle} /><span><strong>Planes hechos para ti</strong><small>Nutrición, entrenamiento y progreso</small></span></article>
            <article><IonIcon icon={shieldCheckmarkOutline} /><span><strong>Sin tarjeta ni compromiso</strong><small>Finaliza solo, sin cargos sorpresa</small></span></article>
          </div>
        )}

        {reminder && endsAt && (
          <div className="promo-trial-date">
            <IonIcon icon={timeOutline} />
            <span><small>Acceso completo hasta</small><strong>{formatDateTime(endsAt)}</strong></span>
          </div>
        )}

        {expired && (
          <div className="promo-trial-retained">
            <IonIcon icon={shieldCheckmarkOutline} />
            <span><strong>No pierdes tus datos</strong><small>Tus comidas, entrenamientos, sueño y progreso permanecen guardados.</small></span>
          </div>
        )}

        {message && <p className="form-error promo-trial-error" role="alert">{message}</p>}

        {gift ? (
          <IonButton expand="block" className="primary-button promo-trial-primary" disabled={busy} onClick={() => void onClaim()}>
            {busy ? <IonSpinner /> : <><IonIcon slot="start" icon={giftOutline} />Aceptar plan de prueba gratis</>}
          </IonButton>
        ) : expired ? (
          <IonButton expand="block" className="primary-button promo-trial-primary" onClick={onSubscribe}>Continuar con VITAMATE Premium</IonButton>
        ) : (
          <IonButton expand="block" className="primary-button promo-trial-primary" onClick={onDismiss}>Seguir aprovechando Premium</IonButton>
        )}
        {gift && <button type="button" className="promo-trial-secondary" disabled={busy} onClick={onDismiss}>Ahora no</button>}
        <small className="promo-trial-fineprint">{gift ? 'Oferta promocional de un solo uso por cuenta.' : expired ? 'Puedes continuar con el plan Gratis o activar Premium.' : 'No necesitas cancelar: no existe renovación automática.'}</small>
      </section>
    </IonModal>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}
