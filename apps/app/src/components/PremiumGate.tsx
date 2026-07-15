import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { lockClosedOutline, sparklesOutline } from 'ionicons/icons';

export function PremiumGate({ title, onUnlock }: { title: string; onUnlock(): void }) {
  return <IonPage className="app-page"><IonContent fullscreen><main className="premium-gate"><span><IonIcon icon={lockClosedOutline} /></span><p className="eyebrow">Función Premium</p><h1>{title}</h1><p>Tu plan Gratis conserva el contador de calorías y macronutrientes, búsqueda, código de barras y alimentos personales.</p><button className="premium-unlock" onClick={onUnlock}><IonIcon icon={sparklesOutline} />Descubrir Premium</button></main></IonContent></IonPage>;
}
