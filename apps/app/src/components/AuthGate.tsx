import { useEffect, useState, type FormEvent } from 'react';
import { IonButton, IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/react';
import { checkmarkCircle, eyeOffOutline, eyeOutline, lockClosedOutline, logInOutline, mailOutline, personAddOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import type { OtpVerificationType } from '../services/api';
import { dismissNativeKeyboard } from '../services/nativePlatform';
import { BrandMark } from './BrandMark';

type View = 'welcome' | 'register' | 'verify' | 'login' | 'forgot' | 'recover';
type EntryView = Extract<View, 'welcome' | 'register' | 'verify' | 'login'>;

interface AuthGateProps {
  busy: boolean;
  message: string;
  initialView?: EntryView;
  initialEmail?: string;
  onStartQuiz(): void;
  onBack?(): void;
  onRegister(email: string, password: string): Promise<{ verificationType: 'signup' }>;
  onResendRegistration(email: string): Promise<{ verificationType: OtpVerificationType }>;
  onSignIn(email: string, password: string): Promise<void>;
  onRequestPasswordRecovery(email: string): Promise<{ verificationType: 'recovery' }>;
  onResetPassword(email: string, otp: string, password: string): Promise<void>;
  onVerify(email: string, otp: string, type: OtpVerificationType): Promise<void>;
}

const RESEND_SECONDS = 45;

function cooldownStorageKey(email: string, type: 'signup' | 'recovery'): string {
  return `vitamate.auth-code-sent.${type}.${email.trim().toLocaleLowerCase('es-MX')}`;
}

function verificationTypeStorageKey(email: string): string {
  return `vitamate.auth-code-type.${email.trim().toLocaleLowerCase('es-MX')}`;
}

function initialVerificationType(email: string): OtpVerificationType {
  const stored = window.localStorage.getItem(verificationTypeStorageKey(email));
  return stored === 'email' || stored === 'recovery' ? stored : 'signup';
}

function remainingCooldown(email: string, type: 'signup' | 'recovery'): number {
  if (!email) return 0;
  const sentAt = Number(window.localStorage.getItem(cooldownStorageKey(email, type)) ?? 0);
  return Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - sentAt) / 1000));
}

export function AuthGate({
  busy,
  message,
  initialView = 'welcome',
  initialEmail = '',
  onStartQuiz,
  onBack,
  onRegister,
  onResendRegistration,
  onSignIn,
  onRequestPasswordRecovery,
  onResetPassword,
  onVerify,
}: AuthGateProps) {
  const [view, setView] = useState<View>(initialView);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationType, setVerificationType] = useState<OtpVerificationType>(() => initialVerificationType(initialEmail));
  const [resendSeconds, setResendSeconds] = useState(() => initialView === 'verify' ? remainingCooldown(initialEmail, 'signup') : 0);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  const transitionTo = (next: View) => {
    dismissNativeKeyboard();
    setView(next);
  };

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const resetError = () => setError('');
  const startCooldown = (type: 'signup' | 'recovery') => {
    window.localStorage.setItem(cooldownStorageKey(email, type), String(Date.now()));
    setResendSeconds(RESEND_SECONDS);
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    if (password !== passwordConfirmation) return setError('Las contraseñas no coinciden.');
    try {
      const response = await onRegister(email.trim(), password);
      setVerificationType(response.verificationType);
      window.localStorage.setItem(verificationTypeStorageKey(email), response.verificationType);
      startCooldown('signup');
      transitionTo('verify');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible crear tu cuenta.'); }
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    try { await onSignIn(email.trim(), password); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible iniciar sesión.'); }
  };

  const submitVerification = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    try { await onVerify(email.trim(), otp.trim(), verificationType); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible verificar el código.'); }
  };

  const submitRecoveryRequest = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    try {
      await onRequestPasswordRecovery(email.trim());
      setOtp('');
      startCooldown('recovery');
      transitionTo('recover');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible solicitar el código.'); }
  };

  const submitPasswordReset = async (event: FormEvent) => {
    event.preventDefault(); resetError();
    if (password !== passwordConfirmation) return setError('Las contraseñas no coinciden.');
    try { await onResetPassword(email.trim(), otp.trim(), password); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible cambiar tu contraseña.'); }
  };

  const resendCode = async () => {
    if (busy || resendSeconds > 0) return;
    resetError();
    try {
      const response = view === 'verify'
        ? await onResendRegistration(email.trim())
        : await onRequestPasswordRecovery(email.trim());
      setVerificationType(response.verificationType);
      window.localStorage.setItem(verificationTypeStorageKey(email), response.verificationType);
      setOtp('');
      startCooldown(view === 'verify' ? 'signup' : 'recovery');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible generar un código nuevo.'); }
  };

  const resetSensitiveFields = () => {
    setPassword(''); setPasswordConfirmation(''); setOtp('');
    setShowPassword(false); setShowPasswordConfirmation(false); resetError();
  };

  const back = () => {
    resetSensitiveFields();
    if (view === 'verify') return transitionTo('register');
    if (view === 'recover') return transitionTo('forgot');
    if ((view === initialView || (view === 'register' && ['register', 'verify'].includes(initialView))) && onBack) return onBack();
    transitionTo('welcome');
  };

  const title = view === 'welcome' ? 'Tu mejor versión empieza con unas respuestas.'
    : view === 'register' ? 'Ahora sí, guarda tu plan'
      : view === 'verify' ? 'Confirma tu correo'
        : view === 'forgot' ? 'Recupera tu contraseña'
          : view === 'recover' ? 'Elige una nueva contraseña'
            : 'Qué gusto verte de nuevo';
  const lead = view === 'welcome' ? 'Primero descubre una ruta hecha para ti. Crearás tu cuenta al final del quiz, cuando ya puedas ver hacia dónde vas.'
    : view === 'register' ? 'Tu propuesta está lista. Crea una cuenta para protegerla y continuar desde cualquier dispositivo.'
      : view === 'verify' ? `Ingresa el código que enviamos a ${email}.`
        : view === 'forgot' ? 'Te enviaremos un código de un solo uso para que puedas elegir una contraseña nueva.'
          : view === 'recover' ? `Ingresa el código enviado a ${email} y crea una contraseña nueva.`
            : 'Ingresa con el correo y la contraseña que elegiste al crear tu cuenta.';

  return <IonPage className="auth-page"><IonContent fullscreen><main className="auth-shell"><BrandMark /><section className="auth-card">
    <span className="auth-icon"><IonIcon icon={view === 'login' ? logInOutline : view === 'register' ? personAddOutline : view === 'verify' ? shieldCheckmarkOutline : mailOutline} /></span>
    <p className="eyebrow">Tu cuenta VITAMATE</p><h1>{title}</h1><p>{lead}</p>
    {view === 'welcome' && <div className="auth-choice-grid"><IonButton className="primary-button" expand="block" onClick={() => { resetError(); onStartQuiz(); }}><IonIcon slot="start" icon={personAddOutline} />Crear mi cuenta</IonButton><IonButton fill="outline" expand="block" onClick={() => { resetError(); transitionTo('login'); }}><IonIcon slot="start" icon={logInOutline} />Iniciar sesión</IonButton></div>}
    {view === 'register' && <form onSubmit={submitRegister}>
      <label className="field"><span>Correo electrónico</span><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
      <PasswordField label="Contraseña" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" placeholder="Mínimo 10 caracteres" />
      <PasswordField label="Confirma tu contraseña" value={passwordConfirmation} onChange={setPasswordConfirmation} show={showPasswordConfirmation} onToggle={() => setShowPasswordConfirmation((value) => !value)} autoComplete="new-password" placeholder="Repite tu contraseña" />
      <IonButton type="submit" expand="block" className="primary-button" disabled={busy || !email.includes('@') || password.length < 10 || password !== passwordConfirmation}>{busy ? <IonSpinner /> : <>Crear y guardar mi plan<IonIcon slot="end" icon={checkmarkCircle} /></>}</IonButton>
    </form>}
    {view === 'verify' && <form onSubmit={submitVerification}><label className="field otp-field"><span>Código de acceso</span><input type="text" inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="Código" /></label><IonButton type="submit" expand="block" className="primary-button" disabled={busy || !otp}>{busy ? <IonSpinner /> : <>Verificar y continuar<IonIcon slot="end" icon={checkmarkCircle} /></>}</IonButton><ResendButton seconds={resendSeconds} busy={busy} onClick={resendCode} /></form>}
    {view === 'login' && <form onSubmit={submitLogin}><label className="field"><span>Correo electrónico</span><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><PasswordField label="Contraseña" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="current-password" placeholder="Tu contraseña" /><button type="button" className="auth-forgot-password" onClick={() => { resetError(); setPassword(''); transitionTo('forgot'); }}>Olvidé mi contraseña</button><IonButton type="submit" expand="block" className="primary-button" disabled={busy || !email.includes('@') || !password}>{busy ? <IonSpinner /> : <>Entrar a VITAMATE<IonIcon slot="end" icon={logInOutline} /></>}</IonButton></form>}
    {view === 'forgot' && <form onSubmit={submitRecoveryRequest}><label className="field"><span>Correo electrónico</span><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><IonButton type="submit" expand="block" className="primary-button" disabled={busy || !email.includes('@')}>{busy ? <IonSpinner /> : <>Enviarme un código<IonIcon slot="end" icon={mailOutline} /></>}</IonButton></form>}
    {view === 'recover' && <form onSubmit={submitPasswordReset}><label className="field otp-field"><span>Código de recuperación</span><input type="text" inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="Código" /></label><PasswordField label="Nueva contraseña" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" placeholder="Mínimo 10 caracteres" /><PasswordField label="Confirma tu nueva contraseña" value={passwordConfirmation} onChange={setPasswordConfirmation} show={showPasswordConfirmation} onToggle={() => setShowPasswordConfirmation((value) => !value)} autoComplete="new-password" placeholder="Repite tu contraseña" /><IonButton type="submit" expand="block" className="primary-button" disabled={busy || !otp || password.length < 10 || password !== passwordConfirmation}>{busy ? <IonSpinner /> : <>Guardar nueva contraseña<IonIcon slot="end" icon={checkmarkCircle} /></>}</IonButton><ResendButton seconds={resendSeconds} busy={busy} onClick={resendCode} /></form>}
    {(error || message) && <p className={error ? 'form-error' : 'auth-message'} role="status">{error || message}</p>}
    {view !== 'welcome' && <button type="button" className="text-button" onClick={back} disabled={busy}>{view === 'login' && initialView === 'welcome' ? 'Quiero crear una cuenta' : 'Volver'}</button>}
    <small><IonIcon icon={lockClosedOutline} /> Tu correo es único y personal. Al continuar aceptas el tratamiento de tus datos conforme al aviso de privacidad.</small>
  </section></main></IonContent></IonPage>;
}

function ResendButton({ seconds, busy, onClick }: { seconds: number; busy: boolean; onClick(): void }) {
  const countdown = `00:${String(seconds).padStart(2, '0')}`;
  return <button type="button" className="auth-resend" disabled={busy || seconds > 0} onClick={onClick}>{seconds > 0 ? <>Podrás generar otro código en <strong>{countdown}</strong></> : 'Generar un nuevo código'}</button>;
}

function PasswordField({ label, value, onChange, show, onToggle, autoComplete, placeholder }: { label: string; value: string; onChange(value: string): void; show: boolean; onToggle(): void; autoComplete: string; placeholder: string }) {
  return <label className="field password-field"><span>{label}</span><div><input type={show ? 'text' : 'password'} autoComplete={autoComplete} minLength={10} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><button type="button" aria-label={show ? `Ocultar ${label.toLocaleLowerCase('es-MX')}` : `Mostrar ${label.toLocaleLowerCase('es-MX')}`} aria-pressed={show} onClick={onToggle}><IonIcon icon={show ? eyeOffOutline : eyeOutline} /></button></div></label>;
}
