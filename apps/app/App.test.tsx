import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { barbell, chatbubbles, home, restaurant, trendingUp } from 'ionicons/icons';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@vitamate/design-tokens/index.css';
import { Onboarding } from './components/Onboarding';
import Coach from './pages/Coach';
import Entrenar from './pages/Entrenar';
import Hoy from './pages/Hoy';
import Nutricion from './pages/Nutricion';
import Progreso from './pages/Progreso';
import { useVitamate } from './state/useVitamate';
import './App.css';

setupIonicReact({ mode: 'ios' });

const App: React.FC = () => {
  const actions = useVitamate();
  const { snapshot } = actions;
  if (!snapshot.profile) return <IonApp><Onboarding onComplete={actions.completeOnboarding} /></IonApp>;

  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/hoy" render={() => <Hoy snapshot={snapshot} />} />
            <Route exact path="/nutricion" render={() => <Nutricion snapshot={snapshot} onAddMeal={actions.addMeal} onDeleteMeal={actions.deleteMeal} />} />
            <Route exact path="/entrenar" render={() => <Entrenar snapshot={snapshot} onCompleteWorkout={actions.completeWorkout} />} />
            <Route exact path="/coach" render={() => <Coach profile={snapshot.profile!} />} />
            <Route exact path="/progreso" render={() => <Progreso snapshot={snapshot} onAddWeight={actions.addWeight} />} />
            <Route exact path="/"><Redirect to="/hoy" /></Route>
          </IonRouterOutlet>
          <IonTabBar slot="bottom" className="app-tab-bar">
            <IonTabButton tab="hoy" href="/hoy"><IonIcon icon={home} /><IonLabel>Hoy</IonLabel></IonTabButton>
            <IonTabButton tab="nutricion" href="/nutricion"><IonIcon icon={restaurant} /><IonLabel>Nutrición</IonLabel></IonTabButton>
            <IonTabButton tab="entrenar" href="/entrenar"><IonIcon icon={barbell} /><IonLabel>Entrenar</IonLabel></IonTabButton>
            <IonTabButton tab="coach" href="/coach"><IonIcon icon={chatbubbles} /><IonLabel>Coach</IonLabel></IonTabButton>
            <IonTabButton tab="progreso" href="/progreso"><IonIcon icon={trendingUp} /><IonLabel>Progreso</IonLabel></IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
