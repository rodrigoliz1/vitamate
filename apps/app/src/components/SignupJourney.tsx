import { useState } from 'react';
import { IonButton, IonContent, IonIcon, IonPage } from '@ionic/react';
import { arrowForward, barbellOutline, chatbubbleEllipsesOutline, checkmarkCircle, nutritionOutline, sparkles } from 'ionicons/icons';
import type { UserProfile } from '@vitamate/domain';
import type { OtpVerificationType } from '../services/api';
import { isNativeIos } from '../services/nativePlatform';
import { AuthGate } from './AuthGate';
import { BrandMark } from './BrandMark';
import { Onboarding } from './Onboarding';

type Stage = 'intro' | 'auth' | 'login' | 'quiz' | 'register' | 'verify';

interface SignupJourneyProps {
  busy: boolean;
  message: string;
  pendingProfile: UserProfile | null;
  pendingRegistrationEmail: string | null;
  onPendingProfile(profile: UserProfile): void;
  onRegistrationEmail(email: string): void;
  onRegister(email: string, password: string): Promise<{ verificationType: 'signup' }>;
  onResendRegistration(email: string): Promise<{ verificationType: OtpVerificationType }>;
  onSignIn(email: string, password: string): Promise<void>;
  onRequestPasswordRecovery(email: string): Promise<{ verificationType: 'recovery' }>;
  onResetPassword(email: string, otp: string, password: string): Promise<void>;
  onVerify(email: string, otp: string, type: OtpVerificationType): Promise<void>;
}

const IOS_WELCOME_KEY = 'vitamate.ios-welcome-seen.v1';

function shouldShowNativeWelcome(): boolean {
  return isNativeIos || (import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview-ios-welcome'));
}

export function SignupJourney(props: SignupJourneyProps) {
  const [loginReturn, setLoginReturn] = useState<Extract<Stage, 'intro' | 'auth'>>('auth');
  const [stage, setStage] = useState<Stage>(() => {
    if (props.pendingProfile && props.pendingRegistrationEmail) return 'verify';
    if (props.pendingProfile) return 'register';
    if (shouldShowNativeWelcome() && window.localStorage.getItem(IOS_WELCOME_KEY) !== 'true') return 'intro';
    return 'auth';
  });

  const leaveIntro = (next: Stage) => {
    window.localStorage.setItem(IOS_WELCOME_KEY, 'true');
    setStage(next);
  };

  const register = async (email: string, password: string) => {
    const response = await props.onRegister(email, password);
    props.onRegistrationEmail(email.trim().toLocaleLowerCase('es-MX'));
    return response;
  };

  if (stage === 'intro') return <NativeWelcome onCreate={() => leaveIntro('quiz')} onSignIn={() => { setLoginReturn('intro'); leaveIntro('login'); }} />;

  if (stage === 'quiz') return <Onboarding
    initialProfile={props.pendingProfile}
    initialStep={props.pendingProfile ? 7 : 0}
    onExitToAuth={() => { setLoginReturn('auth'); setStage('login'); }}
    onComplete={(profile) => { props.onPendingProfile(profile); setStage('register'); }}
  />;

  return <AuthGate
    key={stage}
    busy={props.busy}
    message={props.message}
    initialView={stage === 'register' ? 'register' : stage === 'verify' ? 'verify' : stage === 'login' ? 'login' : 'welcome'}
    initialEmail={stage === 'verify' ? props.pendingRegistrationEmail ?? '' : ''}
    onStartQuiz={() => setStage('quiz')}
    onBack={stage === 'register' || stage === 'verify' ? () => setStage('quiz') : stage === 'login' ? () => setStage(loginReturn) : undefined}
    onRegister={register}
    onResendRegistration={props.onResendRegistration}
    onSignIn={props.onSignIn}
    onRequestPasswordRecovery={props.onRequestPasswordRecovery}
    onResetPassword={props.onResetPassword}
    onVerify={props.onVerify}
  />;
}

function NativeWelcome({ onCreate, onSignIn }: { onCreate(): void; onSignIn(): void }) {
  return <IonPage className="native-welcome-page"><IonContent fullscreen><main className="native-welcome-shell">
    <header><BrandMark compact /><span className="native-welcome-badge"><IonIcon icon={sparkles} />Hecho para tu vida</span></header>
    <section className="native-welcome-copy">
      <p className="eyebrow">Tu bienestar, en una sola app</p>
      <h1>Un plan que aprende contigo, no una rutina que te persigue.</h1>
      <p>VITAMATE une nutrición, movimiento y acompañamiento personal para ayudarte a avanzar con claridad, sin extremos y a tu ritmo.</p>
    </section>
    <section className="native-welcome-art" aria-label="Vista de las herramientas personalizadas de VITAMATE">
      <div className="welcome-orbit welcome-orbit--one" /><div className="welcome-orbit welcome-orbit--two" />
      <article className="welcome-float-card welcome-float-card--food"><IonIcon icon={nutritionOutline} /><span><small>Nutrición</small><strong>Hecha para ti</strong></span><IonIcon icon={checkmarkCircle} /></article>
      <div className="welcome-phone-card"><span className="welcome-phone-pill">HOY</span><div className="welcome-vita-ring"><span>72</span><small>tu ritmo</small></div><strong>Todo suma.</strong><p>Hábitos simples, progreso visible.</p><div className="welcome-mini-bars"><i /><i /><i /><i /><i /></div></div>
      <article className="welcome-float-card welcome-float-card--coach"><IonIcon icon={chatbubbleEllipsesOutline} /><span><small>VITACOACH</small><strong>Estoy contigo</strong></span></article>
      <article className="welcome-float-card welcome-float-card--training"><IonIcon icon={barbellOutline} /><span><small>Esta semana</small><strong>3 sesiones</strong></span></article>
    </section>
    <section className="native-welcome-actions">
      <IonButton expand="block" className="primary-button" onClick={onCreate}>Descubrir mi plan<IonIcon slot="end" icon={arrowForward} /></IonButton>
      <button type="button" onClick={onSignIn}>Ya tengo una cuenta</button>
      <small>Empieza con un quiz breve. Crearás tu cuenta cuando tu propuesta esté lista.</small>
    </section>
  </main></IonContent></IonPage>;
}
