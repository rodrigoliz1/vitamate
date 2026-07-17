import { useState } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import { barbellOutline, cameraOutline, chatbubblesOutline, checkmarkCircle, closeOutline, restaurantOutline, sparklesOutline } from 'ionicons/icons';
import type { BillingEntitlement, BillingOffer } from '../services/api';

interface Props {
  isOpen: boolean;
  onDismiss(): void;
  entitlement: BillingEntitlement | null;
  offers: BillingOffer[];
  configured?: boolean | null;
  loading?: boolean;
  statusMessage?: string;
  native?: boolean;
  onRefresh?(): Promise<BillingEntitlement | null>;
  onPurchase(interval: 'month' | 'year'): Promise<BillingEntitlement | null>;
  onManage(): Promise<void>;
  onRestore(): Promise<BillingEntitlement>;
  onLeavingForCheckout?(): void;
}

export function SubscriptionModal({ isOpen, onDismiss, entitlement, offers, configured = null, loading = false, statusMessage = '', native = false, onRefresh, onPurchase, onManage, onRestore, onLeavingForCheckout }: Props) {
  const [busy, setBusy] = useState<'month' | 'year' | 'portal' | 'restore' | 'refresh' | null>(null);
  const [error, setError] = useState('');
  const periodActive = !entitlement?.currentPeriodEnd || Date.parse(entitlement.currentPeriodEnd) > Date.now();
  const premium = entitlement?.plan === 'premium' && ['active', 'trialing'].includes(entitlement.status) && periodActive;
  const promotional = premium && entitlement?.source === 'none';
  const webPurchase = entitlement?.source === 'stripe' || (entitlement?.source !== 'apple' && Boolean(entitlement?.stripeCustomerId));
  const start = async (interval: 'month' | 'year') => {
    setBusy(interval); setError('');
    try { onLeavingForCheckout?.(); const purchased = await onPurchase(interval); if (purchased) onDismiss(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible abrir el pago.'); setBusy(null); }
  };
  const portal = async () => {
    setBusy('portal'); setError('');
    try { await onManage(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible abrir tu suscripción.'); setBusy(null); }
  };
  const restore = async () => {
    setBusy('restore'); setError('');
    try { await onRestore(); onDismiss(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible restaurar tus compras.'); setBusy(null); }
  };
  const refresh = async () => {
    if (!onRefresh) return;
    setBusy('refresh'); setError('');
    try { await onRefresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible actualizar tu suscripción.'); }
    finally { setBusy(null); }
  };
  return <IonModal isOpen={isOpen} onDidDismiss={onDismiss} className="subscription-modal"><div className="subscription-shell">
    <button className="subscription-close" aria-label="Cerrar" onClick={onDismiss}><IonIcon icon={closeOutline} /></button>
    <header><span><IonIcon icon={sparklesOutline} /></span><p className="eyebrow">VITAMATE Premium</p><h2>{premium ? 'Tu mejor versión está en marcha' : 'Todo tu plan. Un solo compañero.'}</h2><p>{premium ? subscriptionStatus(entitlement) : 'Elige el plan que mejor encaja contigo y convierte tus datos en un acompañamiento que aprende contigo.'}</p></header>
    <div className="premium-benefits"><Benefit icon={chatbubblesOutline} text="VITACOACH por chat y llamada" /><Benefit icon={cameraOutline} text="Análisis de alimentos por fotografía" /><Benefit icon={barbellOutline} text="Entrenamientos guiados y progresivos" /><Benefit icon={restaurantOutline} text="Plan alimenticio, súper y costos" /></div>
    {premium ? <div className="current-plan-panel"><strong>{promotional ? 'Prueba Premium de regalo' : `Plan Premium ${entitlement.billingInterval === 'year' ? 'anual' : 'mensual'}`}</strong><span>{promotional ? 'Acceso completo hasta' : entitlement.cancelAtPeriodEnd ? 'Termina' : 'Próxima renovación'}: {formatDate(entitlement.currentPeriodEnd)}</span>{promotional ? <small>Sin tarjeta, cargos ni renovación automática.</small> : <IonButton expand="block" className="primary-button" disabled={busy !== null} onClick={portal}>{busy === 'portal' ? <IonSpinner /> : webPurchase && native ? 'Plan adquirido en vitamate.mx' : `Administrar en ${native || entitlement.source === 'apple' ? 'App Store' : 'Stripe'}`}</IonButton>}</div> : <div className="subscription-options">
      <PlanButton interval="year" label="Premium anual" badge="Mejor elección" offer={offers.find((item) => item.interval === 'year')} busy={busy} onClick={start} />
      <PlanButton interval="month" label="Premium mensual" offer={offers.find((item) => item.interval === 'month')} busy={busy} onClick={start} />
      <p><IonIcon icon={checkmarkCircle} /> {entitlement?.trialUsed ? 'La prueba gratuita de esta cuenta ya fue utilizada.' : 'Pago protegido y administración desde el proveedor de tu plataforma.'}</p>
      {native && <button type="button" className="free-plan-link" disabled={busy !== null} onClick={restore}>{busy === 'restore' ? 'Restaurando…' : 'Restaurar compras de App Store'}</button>}
    </div>}
    {!premium && (loading || busy === 'refresh') && <p className="billing-connection-state"><IonSpinner /> Verificando tu cuenta y el catálogo…</p>}
    {!premium && !loading && statusMessage && <div className="billing-connection-error" role="alert"><strong>No pudimos verificar Premium</strong><span>{statusMessage}</span>{onRefresh && <button type="button" onClick={refresh}>Reintentar conexión</button>}</div>}
    {!premium && !loading && !statusMessage && configured === false && <div className="billing-connection-error" role="status"><strong>Catálogo temporalmente no disponible</strong><span>Tu cuenta sí está conectada, pero el servidor de pagos todavía no devolvió los planes.</span>{onRefresh && <button type="button" onClick={refresh}>Actualizar</button>}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!premium && <button className="free-plan-link" onClick={onDismiss}>Continuar con Gratis · sólo contador de macros</button>}
    <p className="subscription-legal">La suscripción se renueva automáticamente salvo cancelación. El cobro y la administración se realizan con el proveedor de la plataforma. <a href="https://vitamate.mx/terminos" target="_blank" rel="noreferrer">Términos de uso</a> · <a href="https://vitamate.mx/privacidad" target="_blank" rel="noreferrer">Aviso de privacidad</a></p>
  </div></IonModal>;
}

function Benefit({ icon, text }: { icon: string; text: string }) { return <article><IonIcon icon={icon} /><span>{text}</span></article>; }
function PlanButton({ interval, label, badge, offer, busy, onClick }: { interval: 'month' | 'year'; label: string; badge?: string; offer?: BillingOffer; busy: string | null; onClick(interval: 'month' | 'year'): void }) {
  return <button className={interval === 'year' ? 'subscription-plan is-featured' : 'subscription-plan'} disabled={busy !== null || !offer} onClick={() => onClick(interval)}>{badge && <b>{badge}</b>}<span><strong>{label}</strong><small>{interval === 'year' ? '12 meses de acompañamiento' : 'Flexibilidad mes a mes'}</small></span><em>{offer ? (offer.displayPrice ?? money(offer.amount, offer.currency)) : 'No disponible'}<small>/{interval === 'year' ? 'año' : 'mes'}</small></em>{busy === interval && <IonSpinner />}</button>;
}
function money(amount: number, currency: string) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount / 100); }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value)) : 'por confirmar'; }
function subscriptionStatus(entitlement: BillingEntitlement) { return entitlement.status === 'trialing' ? `Tu prueba termina el ${formatDate(entitlement.trialEnd)}.` : `Tu acceso está activo y se actualiza mediante ${entitlement.source === 'apple' ? 'App Store' : entitlement.source === 'stripe' ? 'Stripe' : 'VITAMATE'}.`; }
