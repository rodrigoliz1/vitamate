import type { CSSProperties } from 'react';
import { IonButton, IonIcon, IonModal } from '@ionic/react';
import { checkmarkCircle, closeOutline, sparkles } from 'ionicons/icons';
import type { BillingEntitlement } from '../services/api';

const confetti = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 9) * 0.11}s`,
  duration: `${1.9 + (index % 6) * 0.16}s`,
  rotation: `${(index * 53) % 360}deg`,
}));

export function SubscriptionCelebration({ entitlement, isOpen, onDismiss }: { entitlement: BillingEntitlement; isOpen: boolean; onDismiss(): void }) {
  const annual = entitlement.billingInterval === 'year';
  const isTrial = entitlement.status === 'trialing';
  const promotional = isTrial && entitlement.source === 'none';
  const nextDate = isTrial ? entitlement.trialEnd : entitlement.currentPeriodEnd;
  return <IonModal isOpen={isOpen} onDidDismiss={onDismiss} className="celebration-modal">
    <section className="celebration-shell" aria-labelledby="celebration-title">
      <div className="vita-confetti" aria-hidden="true">{confetti.map((piece) => <i key={piece.id} style={{ '--left': piece.left, '--delay': piece.delay, '--duration': piece.duration, '--rotation': piece.rotation } as CSSProperties} />)}</div>
      <button className="celebration-close" onClick={onDismiss} aria-label="Cerrar"><IonIcon icon={closeOutline} /></button>
      <span className="celebration-mark"><IonIcon icon={checkmarkCircle} /></span>
      <p className="eyebrow">Bienvenido a VITAMATE Premium</p>
      <h2 id="celebration-title">{promotional ? 'Tu regalo Premium está activo.' : 'Gracias por elegir tu mejor versión.'}</h2>
      <p className="celebration-lead">{promotional ? 'Durante cinco días podrás vivir VITAMATE completo, sin tarjeta y sin ningún compromiso.' : 'Tu plan ya está activo. Acabas de convertir una intención en un compromiso contigo.'}</p>
      <div className="celebration-details">
        <article><small>Tu plan</small><strong>{promotional ? 'Premium de regalo' : `Premium ${annual ? 'anual' : 'mensual'}`}</strong></article>
        <article><small>{isTrial ? 'Prueba sin costo hasta' : entitlement.cancelAtPeriodEnd ? 'Tu acceso termina' : 'Próxima facturación'}</small><strong>{formatDate(nextDate)}</strong></article>
        <article><small>Estado</small><strong>{isTrial ? 'Prueba Premium activa' : entitlement.cancelAtPeriodEnd ? 'Cancelación programada' : 'Acceso Premium activo'}</strong></article>
      </div>
      <p className="celebration-note"><IonIcon icon={sparkles} /> VITACOACH, tu plan y tu progreso ya están listos para acompañarte.</p>
      <IonButton expand="block" className="primary-button celebration-button" onClick={onDismiss}>Comenzar mi camino</IonButton>
    </section>
  </IonModal>;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date(value)) : 'por confirmar';
}
