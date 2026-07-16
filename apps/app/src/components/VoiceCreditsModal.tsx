import { useState } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import { callOutline, checkmarkCircleOutline, closeOutline, timeOutline } from 'ionicons/icons';
import type { VoiceCreditBalance, VoiceCreditOffer } from '../services/api';

interface Props {
  isOpen: boolean;
  balance: VoiceCreditBalance | null;
  offers: VoiceCreditOffer[];
  busy: boolean;
  message?: string;
  onDismiss(): void;
  onPurchase(offer: VoiceCreditOffer): Promise<unknown>;
}

function minutes(seconds: number): string {
  const whole = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${whole}:${String(remainder).padStart(2, '0')} min` : `${whole} min`;
}

function price(offer: VoiceCreditOffer): string {
  if (offer.displayPrice) return offer.displayPrice;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: offer.currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(offer.amount / 100);
}

export function VoiceCreditsModal({ isOpen, balance, offers, busy, message, onDismiss, onPurchase }: Props) {
  const [selected, setSelected] = useState<VoiceCreditOffer['id'] | null>(null);
  const buy = async (offer: VoiceCreditOffer) => {
    setSelected(offer.id);
    try {
      await onPurchase(offer);
    } finally {
      setSelected(null);
    }
  };
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} className="voice-credits-modal">
      <section className="voice-credits-dialog">
        <button type="button" className="subscription-close" aria-label="Cerrar" onClick={onDismiss}>
          <IonIcon icon={closeOutline} />
        </button>
        <span className="voice-credits-icon">
          <IonIcon icon={callOutline} />
        </span>
        <p className="eyebrow">Tiempo con VITACOACH</p>
        <h2>Continúa la conversación</h2>
        <p>Premium incluye 30 minutos cada mes. Los minutos adicionales no caducan y se conservan para los meses siguientes.</p>
        {balance && (
          <div className="voice-credits-balance">
            <IonIcon icon={timeOutline} />
            <span>
              <small>Disponible ahora</small>
              <strong>{minutes(balance.totalRemainingSeconds)}</strong>
            </span>
            <em>
              {minutes(balance.monthlyRemainingSeconds)} del plan · {minutes(balance.extraBalanceSeconds)} extra
            </em>
          </div>
        )}
        <div className="voice-credits-grid">
          {offers.map((offer) => (
            <button type="button" key={offer.id} disabled={busy} onClick={() => void buy(offer)} className={offer.id === 'voice_30' ? 'is-featured' : ''}>
              {offer.id === 'voice_30' && <small>Más elegido</small>}
              <strong>+{offer.minutes} min</strong>
              <span>{price(offer)}</span>
              <em>No caducan</em>
              {selected === offer.id && <IonSpinner />}
            </button>
          ))}
        </div>
        <p className="voice-credits-order">
          <IonIcon icon={checkmarkCircleOutline} />
          Primero se usan los minutos mensuales; después, tus minutos extra.
        </p>
        {message && <p className="form-error">{message}</p>}
        <IonButton fill="clear" expand="block" onClick={onDismiss}>
          Ahora no
        </IonButton>
      </section>
    </IonModal>
  );
}
