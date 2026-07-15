import { useState, type FormEvent } from 'react';
import { IonButton, IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/react';
import { checkmarkCircle, eyeOffOutline, eyeOutline, lockClosedOutline, logInOutline, mailOutline, personAddOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import type { OtpVerificationType } from '../services/api';
import { BrandMark } from './BrandMark';

type View = 'welcome' | 'register' | 'verify' | 'login' | 'forgot' | 'recover';

export function AuthGate({
  busy,
  message,
  onRegister,
  onSignIn,
  onRequestPasswordRecovery,
  onResetPassword,
  onVerify,
}: {
  busy: boolean;
  message: string;
  onRegister(email: string, password: string): Promise<{ verificationType: 'signup' }>;
  onSignIn(email: string, password: string): Promise<void>;
  onRequestPasswordRecovery(email: string): Promise<{ verificationType: 'recovery' }>;
  onResetPassword(email: string, otp: string, password: string): Promise<void>;
  onVerify(email: string, otp: string, type: OtpVerificationType): Promise<void>;
}) {
  const [view, setView] = useState<View>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  const resetError = () => setError('');
  const submitRegister = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    if (password !== passwordConfirmation) return setError('Las contraseñas no coinciden.');
    try { await onRegister(email.trim(), password); setView('verify'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible crear tu cuenta.'); }
  };
  const submitLogin = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    try { await onSignIn(email.trim(), password); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible iniciar sesión.'); }
  };
  const submitVerification = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    try { await onVerify(email.trim(), otp.trim(), 'signup'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible verificar el código.'); }
  };
  const submitRecoveryRequest = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    try { await onRequestPasswordRecovery(email.trim()); setView('recover'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible solicitar el código.'); }
  };
  const submitPasswordReset = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    if (password !== passwordConfirmation) return setError('Las contraseñas no coinciden.');
    try { await onResetPassword(email.trim(), otp.trim(), password); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible cambiar tu contraseña.'); }
  };
  const back = () => { setView('welcome'); setPassword(''); setPasswordConfirmation(''); setOtp(''); setShowPassword(false); setShowPasswordConfirmation(false); resetError(); };

  const title = view === 'welcome' ? 'Tu progreso merece una cuenta.'
    : view === 'register' ? 'Crea tu cuenta VITAMATE'
    : view === 'verify' ? 'Confirma tu correo'
      : view === 'forgot' ? 'Recupera tu contraseña'
        : view === 'recover' ? 'Elige una nueva contraseña'
          : 'Qué gusto verte de nuevo';
  const lead = view === 'welcome' ? 'Regístrate para crear tu plan o inicia sesión para volver exactamente a donde te quedaste.'
    : view === 'register' ? 'Tu correo es único, tu contraseña es privada y tu historial queda ligado a ti.'
      : view === 'verify' ? `Ingresa el código que enviamos a ${email}.`
        : view === 'forgot' ? 'Te enviaremos un código de un solo uso para que puedas elegir una contraseña nueva.'
          : view === 'recover' ? `Ingresa el código enviado a ${email} y crea una contraseña nueva.`
            : 'Ingresa con el correo y la contraseña que elegiste al crear tu cuenta.';

  return <IonPage className="auth-page"><IonContent fullscreen><main className="auth-shell"><BrandMark /><section className="auth-card">
    <span className="auth-icon"><IonIcon icon={view === 'login' ? logInOutline : view === 'register' ? personAddOutline : view === 'verify' ? shieldCheckmarkOutline : mailOutline} /></span>
    <p className="eyebrow">Tu cuenta VITAMATE</p><h1>{title}</h1><p>{lead}</p>
    {view === 'welcome' && <div className="auth-choice-grid"><IonButton className="primary-button" expand="block" onClick={() => { resetError(); setView('register'); }}><IonIcon slot="start" icon={personAddOutline} />Crear mi cuenta</IonButton><IonButton fill="outline" expand="block" onClick={() => { resetError(); setView('login'); }}><IonIcon slot="start" icon={logInOutline} />Iniciar sesión</IonButton></div>}
    {view === 'register' && <form onSubmit={submitRegister}>
      <label className="field"><span>Correo electrónico</span><input autoFocus type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
      <PasswordField label="Contraseña" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" placeholder="Mínimo 10 caracteres" />
      <PasswordField label="Confirma tu contraseña" value={passwordConfirmation} onChange={setPasswordConfirmation} show={showPasswordConfirmation} onToggle={() => setShowPasswordConfirmation((value) => !value)} autoComplete="new-password" placeholder="Repite tu contraseña" />
      <IonButton type="submit" expand="block" className="primary-button" disabled={busy || !email.includes('@') || password.length < 10 || password !== passwordConfirmation}>{busy ? <IonSpinner /> : <>Continuar<IonIcon slot="end" icon={checkmarkCircle} /></>}</IonButton>
    </form>}
    {view === 'verify' && <form onSubmit={submitVerification}><label className="field otp-field"><span>Código de acceso</span><input autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="Código" /></label><IonButton type="submit" expand="block" className="primary-button" disabled={busy || !otp}>{busy ? <IonSpinner /> : <>Verificar y continuar<IonIcon slot="end" icon={checkmarkCircle} /></>}</IonButton></form>}
    {view === 'login' && <form onSubmit={submitLogin}><label className="field"><span>Correo electrónico</span><input autoFocus type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><PasswordField label="Contraseña" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="current-password" placeholder="Tu contraseña" /><button type="button" className="auth-forgot-password" onClick={() => { resetError(); setPassword(''); setView('forgot'); }}>Olvidé mi contraseña</button><IonButton type="submit" expand="block" className="primary-button" disabled={busy || !email.includes('@') || !password}>{busy ? <IonSpinner /> : <>Entrar a VITAMATE<IonIcon slot="end" icon={logInOutline} /></>}</IonButton></form>}
    {view === 'forgot' && <form onSubmit={submitRecoveryRequest}><label className="field"><span>Correo electrónico</span><input autoFocus type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><IonButton type="submit" expand="block" className="primary-button" disabled={busy || !email.includes('@')}>{busy ? <IonSpinner /> : <>Enviarme un código<IonIcon slot="end" icon={mailOutline} /></>}</IonButton></form>}
    {view === 'recover' && <form onSubmit={submitPasswordReset}><label className="field otp-field"><span>Código de recuperación</span><input autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="Código" /></label><PasswordField label="Nueva contraseña" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" placeholder="Mínimo 10 caracteres" /><PasswordField label="Confirma tu nueva contraseña" value={passwordConfirmation} onChange={setPasswordConfirmation} show={showPasswordConfirmation} onToggle={() => setShowPasswordConfirmation((value) => !value)} autoComplete="new-password" placeholder="Repite tu contraseña" /><IonButton type="submit" expand="block" className="primary-button" disabled={busy || !otp || password.length < 10 || password !== passwordConfirmation}>{busy ? <IonSpinner /> : <>Guardar nueva contraseña<IonIcon slot="end" icon={checkmarkCircle} /></>}</IonButton></form>}
    {(error || message) && <p className={error ? 'form-error' : 'auth-message'} role="status">{error || message}</p>}
    {view !== 'welcome' && <button type="button" className="text-button" onClick={back} disabled={busy}>{view === 'login' ? 'Quiero crear una cuenta' : 'Volver'}</button>}
    <small><IonIcon icon={lockClosedOutline} /> Tu correo es único y personal. Al continuar aceptas el tratamiento de tus datos conforme al aviso de privacidad.</small>
  </section></main></IonContent></IonPage>;
}

function PasswordField({ label, value, onChange, show, onToggle, autoComplete, placeholder }: { label: string; value: string; onChange(value: string): void; show: boolean; onToggle(): void; autoComplete: string; placeholder: string }) {
  return <label className="field password-field"><span>{label}</span><div><input type={show ? 'text' : 'password'} autoComplete={autoComplete} minLength={10} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><button type="button" aria-label={show ? `Ocultar ${label.toLocaleLowerCase('es-MX')}` : `Mostrar ${label.toLocaleLowerCase('es-MX')}`} aria-pressed={show} onClick={onToggle}><IonIcon icon={show ? eyeOffOutline : eyeOutline} /></button></div></label>;
}
