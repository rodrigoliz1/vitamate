import { useMemo, useState, type FormEvent } from 'react';
import { IonButton, IonContent, IonIcon, IonModal, IonPage, IonSpinner, IonToast } from '@ionic/react';
import { analyticsOutline, cloudDoneOutline, cloudOfflineOutline, logOutOutline, mailOutline, moonOutline, refreshOutline, scaleOutline, sunnyOutline, syncOutline, trendingDownOutline, trendingUpOutline } from 'ionicons/icons';
import { sessionsThisWeek, type UserProfile } from '@vitamate/domain';
import { BrandMark } from '../components/BrandMark';
import { ProfileEditor } from '../components/ProfileEditor';
import { resolveUiLocale, type ColorTheme } from '../config/appFeatures';
import type { VitamateSnapshot } from '../data/localRepository';

interface Props {
  snapshot: VitamateSnapshot;
  onAddWeight(weight: number): void;
  onUpdateProfile(profile: UserProfile): void;
  theme: ColorTheme;
  onSetTheme(theme: ColorTheme): void;
  cloud: { configured: boolean; email: string | null; busy: boolean; message: string };
  onRequestMagicLink(email: string): Promise<void>;
  onSyncCloud(): Promise<void>;
  onSignOutCloud(): Promise<void>;
}

const Progreso = ({ snapshot, onAddWeight, onUpdateProfile, theme, onSetTheme, cloud, onRequestMagicLink, onSyncCloud, onSignOutCloud }: Props) => {
  const [weight, setWeight] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const entries = snapshot.weightEntries;
  const weekly = sessionsThisWeek(snapshot.workoutSessions);
  const change = useMemo(() => entries.length > 1 ? entries[0].weightKg - entries[entries.length - 1].weightKg : 0, [entries]);

  const submitWeight = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(weight);
    if (!Number.isFinite(value) || value < 30 || value > 350) return setMessage('Ingresa un peso válido entre 30 y 350 kg.');
    onAddWeight(value); setWeight(''); setMessage('Peso registrado. Mira la tendencia, no un solo día.');
  };
  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMessage('Ingresa un correo válido.');
    try { await onRequestMagicLink(email.trim()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos enviar el enlace.'); }
  };
  const runCloud = async (action: () => Promise<void>) => {
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos completar la sincronización.'); }
  };

  return <IonPage className="app-page"><IonContent fullscreen><main className="page-shell">
    <header className="app-header"><BrandMark compact /></header>
    <section className="page-title"><p className="eyebrow">Progreso</p><h1>Tu historia, con contexto.</h1><p>Las tendencias semanales cuentan más que una medición aislada.</p></section>
    <section className="stats-grid"><article><span><IonIcon icon={scaleOutline} /></span><small>Peso actual</small><strong>{entries[0]?.weightKg.toFixed(1) ?? '—'} <b>kg</b></strong></article><article><span><IonIcon icon={change <= 0 ? trendingDownOutline : trendingUpOutline} /></span><small>Cambio total</small><strong>{change > 0 ? '+' : ''}{change.toFixed(1)} <b>kg</b></strong></article><article><span><IonIcon icon={analyticsOutline} /></span><small>Sesiones esta semana</small><strong>{weekly.length}</strong></article></section>
    <div className="progress-layout"><section className="weight-form-card"><h2>Registrar peso</h2><p>Procura medirlo en condiciones parecidas para una tendencia más útil.</p><form onSubmit={submitWeight}><label className="field"><span>Peso en kilogramos</span><input type="number" min="30" max="350" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder={entries[0]?.weightKg.toFixed(1) ?? '70.0'} /></label><IonButton type="submit" expand="block" className="primary-button">Guardar medición</IonButton></form><section className="appearance-setting" aria-labelledby="appearance-title"><h2 id="appearance-title">Apariencia</h2><p>Elige cómo quieres ver VITAMATE en este dispositivo.</p><div role="group" aria-label="Tema de la interfaz"><button type="button" className={theme === 'light' ? 'is-active' : ''} aria-pressed={theme === 'light'} onClick={() => onSetTheme('light')}><IonIcon icon={sunnyOutline} /><span><strong>Claro</strong><small>Fondo luminoso</small></span></button><button type="button" className={theme === 'dark' ? 'is-active' : ''} aria-pressed={theme === 'dark'} onClick={() => onSetTheme('dark')}><IonIcon icon={moonOutline} /><span><strong>Oscuro</strong><small>Menos brillo</small></span></button></div></section></section><section className="weight-history"><h2>Mediciones recientes</h2>{entries.slice(0, 8).map((entry, index) => <article key={entry.id}><span>{new Intl.DateTimeFormat(resolveUiLocale(snapshot.profile?.locale ?? 'es-MX'), { day: 'numeric', month: 'short' }).format(new Date(entry.recordedAt))}</span><strong>{entry.weightKg.toFixed(1)} kg</strong>{index < entries.length - 1 ? <small>{(entry.weightKg - entries[index + 1].weightKg).toFixed(1)} kg</small> : <small>Inicio</small>}</article>)}</section></div>
    <section className="profile-retake-card"><div><p className="eyebrow">Metas y preferencias</p><h2>Tu plan cambia contigo</h2><p>Modifica tu objetivo, actividad, comidas, gustos, alergias, tiempo de cocina o estilo de VITACOACH. Recalcularemos tus planes al guardar.</p></div><IonButton fill="outline" onClick={() => setEditingProfile(true)}><IonIcon slot="start" icon={refreshOutline} />Volver a tomar el quiz</IonButton></section>
    <section className="cloud-card"><header><span><IonIcon icon={cloud.email ? cloudDoneOutline : cloudOfflineOutline} /></span><div><p className="eyebrow">Cuenta y respaldo</p><h2>{cloud.email ? 'Tus datos pueden sincronizarse' : 'Protege tu historial en la nube'}</h2></div></header>{!cloud.configured ? <div className="cloud-warning"><strong>Configuración pendiente</strong><p>Falta la clave publicable de Supabase en la PWA. Ningún secreto debe colocarse en el frontend.</p></div> : cloud.email ? <div className="cloud-session"><p>Sesión iniciada como <strong>{cloud.email}</strong>.</p><div><IonButton className="primary-button" disabled={cloud.busy} onClick={() => runCloud(onSyncCloud)}>{cloud.busy ? <IonSpinner /> : <><IonIcon slot="start" icon={syncOutline} />Sincronizar ahora</>}</IonButton><IonButton fill="clear" color="medium" disabled={cloud.busy} onClick={() => runCloud(onSignOutCloud)}><IonIcon slot="start" icon={logOutOutline} />Cerrar sesión</IonButton></div></div> : <form className="cloud-login" onSubmit={submitEmail}><p>Recibirás un enlace seguro por correo; no necesitas contraseña.</p><label className="field"><span>Correo electrónico</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><IonButton type="submit" className="primary-button" disabled={cloud.busy}>{cloud.busy ? <IonSpinner /> : <><IonIcon slot="start" icon={mailOutline} />Enviar enlace mágico</>}</IonButton></form>}{cloud.message && <p className="cloud-message">{cloud.message}</p>}</section>
  </main></IonContent><IonModal isOpen={editingProfile} onDidDismiss={() => setEditingProfile(false)}>{snapshot.profile && <ProfileEditor profile={snapshot.profile} onSave={(profile) => { onUpdateProfile(profile); setMessage('Perfil actualizado y planes recalculados.'); }} onClose={() => setEditingProfile(false)} />}</IonModal><IonToast isOpen={Boolean(message)} message={message} duration={3000} onDidDismiss={() => setMessage('')} /></IonPage>;
};
export default Progreso;
