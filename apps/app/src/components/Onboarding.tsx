import { useMemo, useState, type FormEvent } from 'react';
import { IonButton, IonContent, IonIcon, IonPage } from '@ionic/react';
import { arrowBack, arrowForward, checkmarkCircle, shieldCheckmark } from 'ionicons/icons';
import { ageOnDate, type SafetyFlag, type UserProfile } from '@vitamate/domain';
import { BrandMark } from './BrandMark';

interface Draft {
  fullName: string;
  preferredName: string;
  bodyOutcome: NonNullable<UserProfile['bodyOutcome']>;
  dateOfBirth: string;
  biologicalSexForCalculation: UserProfile['biologicalSexForCalculation'];
  heightCm: string;
  weightKg: string;
  primaryGoal: UserProfile['primaryGoal'];
  activityLevel: UserProfile['activityLevel'];
  weeklyTrainingDays: string;
  trainingMinutes: string;
  equipment: string;
  dietaryPattern: UserProfile['dietaryPattern'];
  mealsPerDay: string;
  cookingLevel: UserProfile['cookingLevel'];
  favoriteFoods: string;
  dislikedFoods: string;
  allergies: string;
  preferredCuisines: string;
  availableCookingMinutes: string;
  foodBudget: UserProfile['foodBudget'];
  weeklyFoodBudgetMxn: string;
  mealPreparationPreference: UserProfile['mealPreparationPreference'];
  mealPrepStructure: UserProfile['mealPrepStructure'];
  mealPrepRotationDays: string;
  supplements: string;
  trainingPreference: UserProfile['trainingPreference'];
  preferredSport: string;
  coachStyle: UserProfile['coachStyle'];
  safetyFlags: SafetyFlag[];
  terms: boolean;
  privacy: boolean;
  ai: boolean;
}

const INITIAL: Draft = {
  fullName: '', preferredName: '', bodyOutcome: 'defined', dateOfBirth: '', biologicalSexForCalculation: 'not_provided',
  heightCm: '', weightKg: '', primaryGoal: 'fitness', activityLevel: 'moderate',
  weeklyTrainingDays: '3', trainingMinutes: '45', equipment: 'Peso corporal y mancuernas',
  dietaryPattern: 'omnivore', mealsPerDay: '4', cookingLevel: 'intermediate', coachStyle: 'motivating',
  favoriteFoods: '', dislikedFoods: '', allergies: '', preferredCuisines: 'Mexicana', availableCookingMinutes: '30', foodBudget: 'balanced',
  weeklyFoodBudgetMxn: '1400', mealPreparationPreference: 'cook_fresh', mealPrepStructure: 'same_by_meal', mealPrepRotationDays: '3', supplements: '',
  trainingPreference: 'gym', preferredSport: '',
  safetyFlags: [], terms: false, privacy: false, ai: false,
};

const SAFETY_OPTIONS: Array<{ value: SafetyFlag; label: string }> = [
  { value: 'pregnancy_or_breastfeeding', label: 'Embarazo o lactancia' },
  { value: 'eating_disorder', label: 'Antecedente o sospecha de trastorno de la conducta alimentaria' },
  { value: 'recent_surgery', label: 'Cirugía o lesión reciente' },
  { value: 'chest_pain_or_fainting', label: 'Dolor de pecho, desmayo o mareo con ejercicio' },
  { value: 'uncontrolled_condition', label: 'Condición médica no controlada' },
  { value: 'medical_exercise_restriction', label: 'Restricción médica para hacer ejercicio' },
];

const OUTCOME_IMAGES: Record<'female' | 'male', Record<Draft['bodyOutcome'], string>> = {
  female: {
    lean: '/onboarding/female-lean-v1.webp',
    defined: '/onboarding/female-defined-v1.webp',
    muscular: '/onboarding/female-muscular-v1.webp',
  },
  male: {
    lean: '/onboarding/male-lean-v1.webp',
    defined: '/onboarding/male-defined-v1.webp',
    muscular: '/onboarding/male-muscular-v1.webp',
  },
};

export function Onboarding({ onComplete, onExitToAuth, initialProfile, initialStep = 0 }: {
  onComplete(profile: UserProfile): void;
  onExitToAuth?(): void;
  initialProfile?: UserProfile | null;
  initialStep?: number;
}) {
  const [step, setStep] = useState(() => Math.max(0, Math.min(7, initialStep)));
  const [draft, setDraft] = useState<Draft>(() => initialProfile ? draftFromProfile(initialProfile) : INITIAL);
  const [error, setError] = useState('');
  const totalSteps = 8;

  const canContinue = useMemo(() => {
    if (step === 0) return draft.fullName.trim().length >= 5 && draft.preferredName.trim().length >= 2 && ageOnDate(draft.dateOfBirth) >= 18;
    if (step === 1) return Boolean(draft.bodyOutcome) && draft.biologicalSexForCalculation !== 'not_provided';
    if (step === 2) return Number(draft.heightCm) >= 120 && Number(draft.heightCm) <= 230 && Number(draft.weightKg) >= 35 && Number(draft.weightKg) <= 300;
    if (step === 3) return Number(draft.weeklyTrainingDays) >= 1 && Number(draft.trainingMinutes) >= 15;
    if (step === 4) return Number(draft.mealsPerDay) >= 2;
    if (step === 5) return Number(draft.availableCookingMinutes) >= 5 && Number(draft.weeklyFoodBudgetMxn) >= 300;
    if (step === 6) return draft.terms && draft.privacy && draft.ai;
    return true;
  }, [draft, step]);

  const next = () => {
    if (!canContinue) {
      setError(step === 0 ? 'Completa tu nombre y confirma que tienes 18 años o más.' : 'Revisa los campos requeridos para continuar.');
      return;
    }
    setError('');
    setStep((current) => Math.min(totalSteps - 1, current + 1));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canContinue) return next();
    onComplete({
      fullName: draft.fullName.trim(),
      preferredName: draft.preferredName.trim(),
      bodyOutcome: draft.bodyOutcome,
      dateOfBirth: draft.dateOfBirth,
      biologicalSexForCalculation: draft.biologicalSexForCalculation,
      heightCm: Number(draft.heightCm), weightKg: Number(draft.weightKg),
      primaryGoal: draft.primaryGoal, activityLevel: draft.activityLevel,
      weeklyTrainingDays: Number(draft.weeklyTrainingDays), trainingMinutes: Number(draft.trainingMinutes),
      equipment: draft.equipment.trim(), dietaryPattern: draft.dietaryPattern,
      mealsPerDay: Number(draft.mealsPerDay), cookingLevel: draft.cookingLevel,
      favoriteFoods: splitList(draft.favoriteFoods), dislikedFoods: splitList(draft.dislikedFoods), allergies: splitList(draft.allergies),
      preferredCuisines: splitList(draft.preferredCuisines), availableCookingMinutes: Number(draft.availableCookingMinutes), foodBudget: draft.foodBudget,
      weeklyFoodBudgetMxn: Number(draft.weeklyFoodBudgetMxn), mealPreparationPreference: draft.mealPreparationPreference,
      mealPrepStructure: draft.mealPrepStructure, mealPrepRotationDays: Number(draft.mealPrepRotationDays), supplements: splitList(draft.supplements),
      trainingPreference: draft.trainingPreference, preferredSport: draft.preferredSport.trim(),
      coachStyle: draft.coachStyle, safetyFlags: draft.safetyFlags,
      consents: { terms: draft.terms, privacy: draft.privacy, ai: draft.ai },
      locale: 'es-MX', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
      units: 'metric', completedAt: new Date().toISOString(),
    });
  };

  const toggleSafety = (flag: SafetyFlag) => {
    setDraft((current) => ({
      ...current,
      safetyFlags: current.safetyFlags.includes(flag)
        ? current.safetyFlags.filter((item) => item !== flag)
        : [...current.safetyFlags, flag],
    }));
  };

  return (
    <IonPage className="onboarding-page">
      <IonContent fullscreen>
        <main className="onboarding-shell">
          <header className="onboarding-header"><BrandMark /><div><span>Paso {step + 1} de {totalSteps}</span>{onExitToAuth && <button type="button" onClick={onExitToAuth}>Iniciar sesión</button>}</div></header>
          <div className="step-track"><span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div>
          <form onSubmit={submit} className="onboarding-card">
            {step === 0 && <section>
              <p className="eyebrow">Primero, tú</p><h1>Construyamos un plan que sí encaje contigo.</h1>
              <p className="lead">Usaremos tus respuestas para personalizar nutrición, entrenamiento y el estilo de acompañamiento.</p>
              <label className="field"><span>Nombre completo</span><input autoComplete="name" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} placeholder="Nombre y apellidos" /></label>
              <label className="field"><span>¿Cómo quieres que te llamemos?</span><input autoComplete="given-name" value={draft.preferredName} onChange={(e) => setDraft({ ...draft, preferredName: e.target.value })} placeholder="Tu nombre" /></label>
              <label className="field"><span>Fecha de nacimiento</span><input type="date" value={draft.dateOfBirth} onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })} /></label>
              <p className="privacy-note"><IonIcon icon={shieldCheckmark} /> VITAMATE está diseñado inicialmente para personas de 18 años o más.</p>
            </section>}

            {step === 1 && <section>
              <p className="eyebrow">Tu dirección</p><h1>Imaginemos una versión de ti que sí quieras construir.</h1><p className="lead">Selecciona una opción para personalizar los cálculos y mostrarte referencias visuales coherentes. Esta información es obligatoria para crear tu plan.</p>
              <div className="sex-selector" role="group" aria-label="Sexo para personalización">
                <button type="button" className={draft.biologicalSexForCalculation === 'female' ? 'sex-option is-selected' : 'sex-option'} onClick={() => setDraft({ ...draft, biologicalSexForCalculation: 'female' })}><strong>Mujer</strong><small>Referencias y cálculos femeninos</small></button>
                <button type="button" className={draft.biologicalSexForCalculation === 'male' ? 'sex-option is-selected' : 'sex-option'} onClick={() => setDraft({ ...draft, biologicalSexForCalculation: 'male' })}><strong>Hombre</strong><small>Referencias y cálculos masculinos</small></button>
              </div>
              {draft.biologicalSexForCalculation === 'not_provided'
                ? <p className="outcome-placeholder">Elige Mujer u Hombre para ver las referencias de resultado.</p>
                : <><h2 className="outcome-question">¿Qué resultado te gustaría construir?</h2><p className="lead outcome-lead">No prometemos un cuerpo idéntico a una imagen. Esta elección orienta el énfasis de tu plan y se ajustará a tu progreso real.</p><div className="body-outcome-grid"><Outcome value="lean" label="Más ligero" description="Reducir grasa y sentir más agilidad" draft={draft} setDraft={setDraft} /><Outcome value="defined" label="Más definido" description="Equilibrar fuerza y composición" draft={draft} setDraft={setDraft} /><Outcome value="muscular" label="Más músculo" description="Priorizar fuerza y masa muscular" draft={draft} setDraft={setDraft} /></div></>}
            </section>}

            {step === 2 && <section>
              <p className="eyebrow">Tu punto de partida</p><h1>Objetivo y medidas actuales</h1>
              <div className="form-grid">
                <label className="field"><span>Estatura (cm)</span><input type="number" min="120" max="230" value={draft.heightCm} onChange={(e) => setDraft({ ...draft, heightCm: e.target.value })} /></label>
                <label className="field"><span>Peso (kg)</span><input type="number" min="35" max="300" step="0.1" value={draft.weightKg} onChange={(e) => setDraft({ ...draft, weightKg: e.target.value })} /></label>
              </div>
              <label className="field"><span>Objetivo principal</span><select value={draft.primaryGoal} onChange={(e) => setDraft({ ...draft, primaryGoal: e.target.value as Draft['primaryGoal'] })}><option value="fitness">Mejorar condición física</option><option value="fat_loss">Perder grasa</option><option value="muscle_gain">Ganar músculo</option><option value="recomposition">Recomposición corporal</option><option value="strength">Ganar fuerza</option><option value="maintain">Mantenerme</option><option value="habits">Crear hábitos</option></select></label>
            </section>}

            {step === 3 && <section>
              <p className="eyebrow">Movimiento</p><h1>Una semana realista supera a una perfecta.</h1>
              <label className="field"><span>Actividad cotidiana</span><select value={draft.activityLevel} onChange={(e) => setDraft({ ...draft, activityLevel: e.target.value as Draft['activityLevel'] })}><option value="sedentary">Mayormente sentado/a</option><option value="light">Actividad ligera</option><option value="moderate">Actividad moderada</option><option value="high">Actividad alta</option><option value="very_high">Actividad muy alta</option></select></label>
              <label className="field"><span>¿Cómo prefieres entrenar?</span><select value={draft.trainingPreference} onChange={(e) => setDraft({ ...draft, trainingPreference: e.target.value as Draft['trainingPreference'] })}><option value="gym">Gimnasio</option><option value="home">Ejercicio en casa</option><option value="sport">Deporte</option><option value="outdoor">Al aire libre</option><option value="mixed">Combinado</option></select></label>
              {draft.trainingPreference === 'sport' && <label className="field"><span>¿Qué deporte practicas?</span><input value={draft.preferredSport} onChange={(e) => setDraft({ ...draft, preferredSport: e.target.value })} placeholder="Ej. fútbol, pádel, boxeo, ciclismo" /></label>}
              <div className="form-grid">
                <label className="field"><span>Días por semana</span><input type="number" min="1" max="5" value={draft.weeklyTrainingDays} onChange={(e) => setDraft({ ...draft, weeklyTrainingDays: e.target.value })} /></label>
                <label className="field"><span>Minutos por sesión</span><input type="number" min="15" max="120" step="5" value={draft.trainingMinutes} onChange={(e) => setDraft({ ...draft, trainingMinutes: e.target.value })} /></label>
              </div>
              <label className="field"><span>Equipo disponible</span><input value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })} /></label>
            </section>}

            {step === 4 && <section>
              <p className="eyebrow">Nutrición y acompañamiento</p><h1>Tu plan también debe gustarte.</h1>
              <label className="field"><span>Patrón de alimentación</span><select value={draft.dietaryPattern} onChange={(e) => setDraft({ ...draft, dietaryPattern: e.target.value as Draft['dietaryPattern'] })}><option value="omnivore">Omnívoro</option><option value="vegetarian">Vegetariano</option><option value="vegan">Vegano</option><option value="pescatarian">Pescetariano</option><option value="other">Otro</option></select></label>
              <div className="form-grid">
                <label className="field"><span>Comidas al día</span><input type="number" min="2" max="8" value={draft.mealsPerDay} onChange={(e) => setDraft({ ...draft, mealsPerDay: e.target.value })} /></label>
                <label className="field"><span>Nivel de cocina</span><select value={draft.cookingLevel} onChange={(e) => setDraft({ ...draft, cookingLevel: e.target.value as Draft['cookingLevel'] })}><option value="basic">Básico</option><option value="intermediate">Intermedio</option><option value="advanced">Avanzado</option></select></label>
              </div>
              <label className="field"><span>Estilo del coach</span><select value={draft.coachStyle} onChange={(e) => setDraft({ ...draft, coachStyle: e.target.value as Draft['coachStyle'] })}><option value="motivating">Motivador</option><option value="direct">Directo</option><option value="calm">Tranquilo</option><option value="technical">Técnico</option><option value="brief">Breve</option></select></label>
            </section>}

            {step === 5 && <section>
              <p className="eyebrow">Gustos y cocina</p><h1>Comer bien también debe darte gusto.</h1>
              <p className="lead">Separa varios elementos con comas. VITAMATE usará estas preferencias para ordenar tus dos opciones de cada comida.</p>
              <label className="field"><span>Alimentos que disfrutas</span><input value={draft.favoriteFoods} onChange={(e) => setDraft({ ...draft, favoriteFoods: e.target.value })} placeholder="Ej. pollo, avena, tacos, frutos rojos" /></label>
              <label className="field"><span>Alimentos que no te gustan</span><input value={draft.dislikedFoods} onChange={(e) => setDraft({ ...draft, dislikedFoods: e.target.value })} placeholder="Ej. champiñones, atún" /></label>
              <label className="field"><span>Alergias o ingredientes que debes evitar</span><input value={draft.allergies} onChange={(e) => setDraft({ ...draft, allergies: e.target.value })} placeholder="Ej. cacahuate, leche; escribe Ninguna si aplica" /></label>
              <label className="field"><span>Cocinas favoritas</span><input value={draft.preferredCuisines} onChange={(e) => setDraft({ ...draft, preferredCuisines: e.target.value })} placeholder="Ej. mexicana, mediterránea, italiana" /></label>
              <label className="field"><span>¿Cómo prefieres preparar tus comidas?</span><select value={draft.mealPreparationPreference} onChange={(e) => setDraft({ ...draft, mealPreparationPreference: e.target.value as Draft['mealPreparationPreference'] })}><option value="cook_fresh">Preparar cada comida al momento y tener más variedad</option><option value="meal_prep">Cocinar por lotes (meal prep)</option></select></label>
              {draft.mealPreparationPreference === 'meal_prep' && <div className="form-grid"><label className="field"><span>Estructura del meal prep</span><select value={draft.mealPrepStructure} onChange={(e) => setDraft({ ...draft, mealPrepStructure: e.target.value as Draft['mealPrepStructure'] })}><option value="same_by_meal">Mismos desayunos, mismas comidas y mismas cenas</option><option value="full_day_blocks">Repetir todo el menú por bloques de días</option></select></label>{draft.mealPrepStructure === 'full_day_blocks' && <label className="field"><span>Rotar el menú cada</span><select value={draft.mealPrepRotationDays} onChange={(e) => setDraft({ ...draft, mealPrepRotationDays: e.target.value })}><option value="2">2 días</option><option value="3">3 días</option><option value="4">4 días</option><option value="7">7 días</option></select></label>}</div>}
              <label className="field"><span>Suplementos que utilizas</span><input value={draft.supplements} onChange={(e) => setDraft({ ...draft, supplements: e.target.value })} placeholder="Ej. proteína, creatina, multivitamínico; Ninguno si aplica" /></label>
              <div className="form-grid"><label className="field"><span>Tiempo disponible por comida</span><select value={draft.availableCookingMinutes} onChange={(e) => setDraft({ ...draft, availableCookingMinutes: e.target.value })}><option value="10">10 minutos</option><option value="20">20 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option></select></label><label className="field"><span>Presupuesto semanal aproximado (MXN)</span><input type="number" min="300" step="50" value={draft.weeklyFoodBudgetMxn} onChange={(e) => setDraft({ ...draft, weeklyFoodBudgetMxn: e.target.value })} /></label></div>
            </section>}

            {step === 6 && <section>
              <p className="eyebrow">Seguridad y consentimiento</p><h1>Tu bienestar va primero.</h1>
              <p className="lead">Selecciona cualquier situación aplicable. Si existe una bandera, no generaremos objetivos personalizados hasta contar con revisión profesional.</p>
              <div className="check-list">{SAFETY_OPTIONS.map((option) => <label key={option.value}><input type="checkbox" checked={draft.safetyFlags.includes(option.value)} onChange={() => toggleSafety(option.value)} /><span>{option.label}</span></label>)}</div>
              <div className="consent-box">
                <label><input type="checkbox" checked={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.checked })} /><span>Acepto los términos de uso.</span></label>
                <label><input type="checkbox" checked={draft.privacy} onChange={(e) => setDraft({ ...draft, privacy: e.target.checked })} /><span>Acepto el aviso de privacidad.</span></label>
                <label><input type="checkbox" checked={draft.ai} onChange={(e) => setDraft({ ...draft, ai: e.target.checked })} /><span>Entiendo que la IA puede equivocarse y no sustituye atención médica.</span></label>
              </div>
            </section>}

            {step === 7 && <section className="plan-reveal">
              <p className="eyebrow">Tu punto de partida</p><h1>{draft.preferredName}, ya tenemos una ruta para ti.</h1><p className="lead">Tu propuesta combina {draft.weeklyTrainingDays} sesiones por semana, {draft.mealsPerDay} comidas al día y acompañamiento adaptativo para un objetivo de 12 semanas.</p>
              <div className="journey-line"><span><b>Hoy</b><small>Conocemos tu punto de partida</small></span><i /><span><b>Semana 4</b><small>Ajustamos adherencia y cargas</small></span><i /><span><b>Semana 8</b><small>Consolidamos rutina y progreso</small></span><i /><span className="is-goal"><b>Semana 12</b><small>Evaluamos resultados y siguiente ciclo</small></span></div>
              <div className="plan-reveal-summary"><article><small>Dirección corporal</small><strong>{{ lean: 'Más ligero/a y ágil', defined: 'Más definición y equilibrio', muscular: 'Más fuerza y músculo' }[draft.bodyOutcome]}</strong></article><article><small>Estilo de alimentación</small><strong>{draft.mealPreparationPreference === 'meal_prep' ? 'Meal prep práctico' : 'Comidas variadas al momento'}</strong></article><article><small>Acompañamiento</small><strong>VITACOACH {draft.coachStyle}</strong></article></div>
              <p className="expectation-note">Doce semanas es un primer ciclo habitual, no una garantía. El ritmo depende de salud, adherencia, descanso y punto de partida.</p>
            </section>}

            {error && <p className="form-error" role="alert">{error}</p>}
            <footer className="onboarding-actions">
              {step > 0
                ? <IonButton type="button" fill="clear" onClick={() => { setError(''); setStep(step - 1); }}><IonIcon slot="start" icon={arrowBack} />Atrás</IonButton>
                : onExitToAuth && <IonButton type="button" fill="clear" onClick={onExitToAuth}><IonIcon slot="start" icon={arrowBack} />Volver al acceso</IonButton>}
              {step < totalSteps - 1
                ? <IonButton type="button" className="primary-button" onClick={next}>Continuar<IonIcon slot="end" icon={arrowForward} /></IonButton>
                : <IonButton type="submit" className="primary-button">Quiero mi mejor versión<IonIcon slot="end" icon={checkmarkCircle} /></IonButton>}
            </footer>
          </form>
        </main>
      </IonContent>
    </IonPage>
  );
}

function draftFromProfile(profile: UserProfile): Draft {
  return {
    fullName: profile.fullName ?? profile.preferredName,
    preferredName: profile.preferredName,
    bodyOutcome: profile.bodyOutcome ?? 'defined',
    dateOfBirth: profile.dateOfBirth,
    biologicalSexForCalculation: profile.biologicalSexForCalculation,
    heightCm: String(profile.heightCm), weightKg: String(profile.weightKg),
    primaryGoal: profile.primaryGoal, activityLevel: profile.activityLevel,
    weeklyTrainingDays: String(profile.weeklyTrainingDays), trainingMinutes: String(profile.trainingMinutes),
    equipment: profile.equipment, dietaryPattern: profile.dietaryPattern,
    mealsPerDay: String(profile.mealsPerDay), cookingLevel: profile.cookingLevel,
    favoriteFoods: profile.favoriteFoods.join(', '), dislikedFoods: profile.dislikedFoods.join(', '), allergies: profile.allergies.join(', '),
    preferredCuisines: profile.preferredCuisines.join(', '), availableCookingMinutes: String(profile.availableCookingMinutes), foodBudget: profile.foodBudget,
    weeklyFoodBudgetMxn: String(profile.weeklyFoodBudgetMxn), mealPreparationPreference: profile.mealPreparationPreference,
    mealPrepStructure: profile.mealPrepStructure, mealPrepRotationDays: String(profile.mealPrepRotationDays), supplements: profile.supplements.join(', '),
    trainingPreference: profile.trainingPreference, preferredSport: profile.preferredSport,
    coachStyle: profile.coachStyle, safetyFlags: profile.safetyFlags,
    terms: profile.consents.terms, privacy: profile.consents.privacy, ai: profile.consents.ai,
  };
}

function Outcome({ value, label, description, draft, setDraft }: { value: Draft['bodyOutcome']; label: string; description: string; draft: Draft; setDraft(value: Draft): void }) {
  const sex = draft.biologicalSexForCalculation === 'male' ? 'male' : 'female';
  return <button type="button" className={draft.bodyOutcome === value ? 'body-outcome-card is-selected' : 'body-outcome-card'} onClick={() => setDraft({ ...draft, bodyOutcome: value })}><span className={`body-outcome-visual body-outcome-visual--${value}`}><img src={OUTCOME_IMAGES[sex][value]} alt={`Referencia visual: ${label.toLocaleLowerCase('es-MX')}`} decoding="async" /></span><strong>{label}</strong><small>{description}</small></button>;
}

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter((item) => item.length > 0 && item.toLocaleLowerCase('es-MX') !== 'ninguna').slice(0, 20);
}
