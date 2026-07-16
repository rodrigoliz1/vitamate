import React, { useEffect, useRef, useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { barbell, chatbubbles, home, lockClosed, restaurant, trendingUp } from 'ionicons/icons';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@vitamate/design-tokens/index.css';
import type { UserProfile } from '@vitamate/domain';
import { Onboarding } from './components/Onboarding';
import { SignupJourney } from './components/SignupJourney';
import { PlanSelection } from './components/PlanSelection';
import { PremiumGate } from './components/PremiumGate';
import { SubscriptionModal } from './components/SubscriptionModal';
import { SubscriptionCelebration } from './components/SubscriptionCelebration';
import { BrandMark } from './components/BrandMark';
import type { BillingEntitlement } from './services/api';
import { resolveUiLocale, type ColorTheme } from './config/appFeatures';
import Coach from './pages/Coach';
import Cuenta from './pages/Cuenta';
import Entrenar from './pages/Entrenar';
import Hoy from './pages/Hoy';
import Nutricion from './pages/Nutricion';
import PlanSemanal from './pages/PlanSemanal';
import Progreso from './pages/Progreso';
import Recordatorios from './pages/Recordatorios';
import { useVitamate } from './state/useVitamate';
import './App.css';
import './features.css';

setupIonicReact({ mode: 'ios' });

const themeStorageKey = 'vitamate.color-theme';
const pendingProfileStorageKey = 'vitamate.pending-signup-profile.v1';
const pendingEmailStorageKey = 'vitamate.pending-signup-email.v1';

function initialTheme(): ColorTheme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light';
}

function initialPendingProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(pendingProfileStorageKey);
    return value ? JSON.parse(value) as UserProfile : null;
  } catch { return null; }
}

function initialPendingEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(pendingEmailStorageKey);
}

function AppBootScreen() {
  return <IonApp><main className="app-boot-screen" aria-label="Preparando VITAMATE">
    <div className="app-boot-halo"><BrandMark /></div>
    <p>Preparando tu experiencia</p>
    <span className="app-boot-dots" aria-hidden="true"><i /><i /><i /></span>
  </main></IonApp>;
}

const App: React.FC = () => {
  const actions = useVitamate();
  const { snapshot } = actions;
  const [theme, setTheme] = useState<ColorTheme>(initialTheme);
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(initialPendingProfile);
  const [pendingRegistrationEmail, setPendingRegistrationEmail] = useState<string | null>(initialPendingEmail);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [celebration, setCelebration] = useState<BillingEntitlement | null>(null);
  const handledCheckout = useRef<string | null>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);
  useEffect(() => {
    const cloudEmail = actions.cloud.email?.trim().toLocaleLowerCase('es-MX');
    if (!cloudEmail || !actions.cloud.snapshotReady || !pendingProfile || cloudEmail !== pendingRegistrationEmail) return;
    if (!snapshot.profile) actions.completeOnboarding(pendingProfile);
    window.localStorage.removeItem(pendingProfileStorageKey);
    window.localStorage.removeItem(pendingEmailStorageKey);
    setPendingProfile(null);
    setPendingRegistrationEmail(null);
  }, [actions.cloud.email, actions.cloud.snapshotReady, actions.completeOnboarding, pendingProfile, pendingRegistrationEmail, snapshot.profile]);
  useEffect(() => {
    if (!actions.cloud.email) return;
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const sessionId = params.get('session_id');
    const key = `${checkout ?? ''}:${sessionId ?? ''}`;
    if (!checkout || handledCheckout.current === key) return;
    handledCheckout.current = key;
    // El estado se escribe de inmediato para que cancelar o completar Checkout
    // nunca reinicie al cuestionario al volver de Stripe.
    actions.completePlanSelection();
    const clearCheckoutUrl = () => window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    if (checkout === 'cancelled') {
      clearCheckoutUrl();
      return;
    }
    if (checkout !== 'success') return;
    let cancelled = false;
    const confirm = async () => {
      if (!sessionId) {
        // Compatibilidad con sesiones creadas antes de incluir session_id en
        // success_url: el webhook puede haber proyectado el acceso mientras
        // la persona estaba en Stripe.
        const entitlement = await actions.refreshBilling();
        if (!cancelled && entitlement?.plan === 'premium' && ['active', 'trialing'].includes(entitlement.status)) {
          setCelebration(entitlement);
        }
        clearCheckoutUrl();
        return;
      }
      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        try {
          const result = await actions.reconcileCheckout(sessionId);
          if (result.entitlement.plan === 'premium' && ['active', 'trialing'].includes(result.entitlement.status)) {
            if (!cancelled) setCelebration(result.entitlement);
            clearCheckoutUrl();
            return;
          }
        } catch {
          // El webhook puede llegar unos segundos después; reintentamos la
          // consulta firmada al servidor antes de mostrar cualquier estado.
        }
        await new Promise((resolve) => window.setTimeout(resolve, 900 * (attempt + 1)));
      }
      if (!cancelled) {
        const entitlement = await actions.refreshBilling();
        if (entitlement?.plan === 'premium' && ['active', 'trialing'].includes(entitlement.status)) {
          setCelebration(entitlement);
        }
      }
      clearCheckoutUrl();
    };
    void confirm();
    return () => { cancelled = true; };
  }, [actions.cloud.email, actions.completePlanSelection, actions.reconcileCheckout, actions.refreshBilling]);
  if (!actions.cloud.sessionReady) return <AppBootScreen />;
  if (!actions.cloud.email) return <IonApp><SignupJourney
    busy={actions.cloud.busy}
    message={actions.cloud.message}
    pendingProfile={pendingProfile}
    pendingRegistrationEmail={pendingRegistrationEmail}
    onPendingProfile={(profile) => {
      window.localStorage.setItem(pendingProfileStorageKey, JSON.stringify(profile));
      window.localStorage.removeItem(pendingEmailStorageKey);
      setPendingProfile(profile);
      setPendingRegistrationEmail(null);
    }}
    onRegistrationEmail={(email) => {
      window.localStorage.setItem(pendingEmailStorageKey, email);
      setPendingRegistrationEmail(email);
    }}
    onRegister={actions.registerWithPassword}
    onResendRegistration={actions.resendRegistrationCode}
    onSignIn={actions.signInWithPassword}
    onRequestPasswordRecovery={actions.requestPasswordRecovery}
    onResetPassword={actions.resetPasswordWithOtp}
    onVerify={actions.verifyOtp}
  /></IonApp>;
  if (!actions.cloud.snapshotReady) return <AppBootScreen />;
  if (!snapshot.profile) return <IonApp><Onboarding onComplete={actions.completeOnboarding} /></IonApp>;
  if (!snapshot.planSelectionCompleted) return <IonApp><PlanSelection entitlement={actions.billing.entitlement} offers={actions.billing.offers} configured={actions.billing.configured} loading={actions.billing.busy} statusMessage={actions.billing.message} native={actions.billing.native} onRefresh={actions.billing.refresh} onPurchase={actions.billing.purchase} onManage={actions.billing.manage} onRestore={actions.billing.restore} onComplete={actions.completePlanSelection} /></IonApp>;
  const english = resolveUiLocale(snapshot.profile.locale) === 'en-US';
  const premium = actions.billing.isPremium;
  const requirePremium = () => setSubscriptionOpen(true);
  const gated = (title: string, node: React.ReactNode) => premium ? node : <PremiumGate title={title} onUnlock={requirePremium} />;

  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/hoy" render={() => <Hoy snapshot={snapshot} isPremium={premium} onRequestPremium={requirePremium} />} />
            <Route exact path="/nutricion" render={() => <Nutricion snapshot={snapshot} isPremium={premium} onRequestPremium={requirePremium} onAddMeal={actions.addMeal} onDeleteMeal={actions.deleteMeal} onSavePersonalFood={actions.savePersonalFood} onDeletePersonalFood={actions.deletePersonalFood} onSelectMealPlanOption={actions.selectMealPlanOption} />} />
            <Route exact path="/plan-semanal" render={() => gated('Plan alimenticio y lista semanal del súper', <PlanSemanal snapshot={snapshot} onUpdateProfile={actions.updateProfile} onSelectMealPlanOption={actions.selectMealPlanOption} />)} />
            <Route exact path="/entrenar" render={() => gated('Entrenamientos personalizados y progresivos', <Entrenar snapshot={snapshot} onCompleteWorkout={actions.completeGuidedWorkout} />)} />
            <Route exact path="/coach" render={() => gated('VITACOACH por chat y llamada', <Coach snapshot={snapshot} healthSummary={actions.health.summary ?? undefined} onAppendMessages={actions.appendCoachMessages} onMergeMessages={actions.mergeCoachMessages} onApplyMemoryUpdates={actions.applyCoachMemoryUpdates} onAddMeal={actions.addMeal} onDeleteMeal={actions.deleteMeal} onAddManualWorkout={actions.addManualWorkout} onDeleteWorkout={actions.deleteWorkoutSession} onAddHealthDocument={actions.addHealthDocument} onReplaceMealPlanOption={actions.replaceMealPlanOption} onReplaceMealPlanIngredient={actions.replaceMealPlanIngredient} />)} />
            <Route exact path="/progreso" render={() => gated('Progreso, metas y personalización', <Progreso snapshot={snapshot} onAddWeight={actions.addWeight} onUpdateProfile={actions.updateProfile} theme={theme} onSetTheme={setTheme} health={actions.health} cloud={actions.cloud} onRequestMagicLink={actions.requestMagicLink} onSyncCloud={actions.syncCloud} onSignOutCloud={actions.signOutCloud} />)} />
            <Route exact path="/cuenta" render={() => <Cuenta snapshot={snapshot} cloudEmail={actions.cloud.email} entitlement={actions.billing.entitlement} onOpenSubscription={requirePremium} onDeleteAccount={actions.deleteAccount} />} />
            <Route exact path="/recordatorios" render={() => <Recordatorios snapshot={snapshot} onSave={actions.saveReminder} onDelete={actions.deleteReminder} onComplete={actions.completeReminder} onEnableNotifications={actions.enableNotifications} />} />
            <Route exact path="/"><Redirect to="/hoy" /></Route>
            <Route><Redirect to="/hoy" /></Route>
          </IonRouterOutlet>
          <IonTabBar slot="bottom" className="app-tab-bar">
            <IonTabButton tab="hoy" href="/hoy"><IonIcon icon={home} /><IonLabel>{english ? 'Today' : 'Hoy'}</IonLabel></IonTabButton>
            <IonTabButton tab="nutricion" href="/nutricion"><IonIcon icon={restaurant} /><IonLabel>{english ? 'Nutrition' : 'Nutrición'}</IonLabel></IonTabButton>
            <IonTabButton tab="entrenar" href={premium ? '/entrenar' : undefined} onClick={premium ? undefined : requirePremium}><IonIcon icon={barbell} /><IonLabel>{english ? 'Train' : 'Entrenar'}</IonLabel>{!premium && <IonIcon className="tab-lock" icon={lockClosed} />}</IonTabButton>
            <IonTabButton tab="coach" href={premium ? '/coach' : undefined} onClick={premium ? undefined : requirePremium} className="vitacoach-tab"><IonIcon icon={chatbubbles} /><IonLabel>VITACOACH</IonLabel>{!premium && <IonIcon className="tab-lock" icon={lockClosed} />}</IonTabButton>
            <IonTabButton tab="progreso" href={premium ? '/progreso' : undefined} onClick={premium ? undefined : requirePremium}><IonIcon icon={trendingUp} /><IonLabel>{english ? 'Progress' : 'Progreso'}</IonLabel>{!premium && <IonIcon className="tab-lock" icon={lockClosed} />}</IonTabButton>
          </IonTabBar>
        </IonTabs>
        <SubscriptionModal isOpen={subscriptionOpen} onDismiss={() => setSubscriptionOpen(false)} entitlement={actions.billing.entitlement} offers={actions.billing.offers} configured={actions.billing.configured} loading={actions.billing.busy} statusMessage={actions.billing.message} native={actions.billing.native} onRefresh={actions.billing.refresh} onPurchase={actions.billing.purchase} onManage={actions.billing.manage} onRestore={actions.billing.restore} onLeavingForCheckout={actions.completePlanSelection} />
        {celebration && <SubscriptionCelebration entitlement={celebration} isOpen onDismiss={() => setCelebration(null)} />}
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
