import { useState, type FormEvent } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { closeOutline, refreshOutline, saveOutline } from 'ionicons/icons';
import type { UserProfile } from '@vitamate/domain';

interface Props {
  profile: UserProfile;
  onSave(profile: UserProfile): void;
  onClose(): void;
}

const toList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20);

export function ProfileEditor({ profile, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(() => ({
    ...profile,
    favoriteFoodsText: (profile.favoriteFoods ?? []).join(', '),
    dislikedFoodsText: (profile.dislikedFoods ?? []).join(', '),
    allergiesText: (profile.allergies ?? []).join(', '),
    preferredCuisinesText: (profile.preferredCuisines ?? []).join(', '),
    supplementsText: (profile.supplements ?? []).join(', '),
  }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      ...profile, ...draft,
      preferredName: draft.preferredName.trim(), heightCm: Number(draft.heightCm), weightKg: Number(draft.weightKg),
      weeklyTrainingDays: Number(draft.weeklyTrainingDays), trainingMinutes: Number(draft.trainingMinutes), mealsPerDay: Number(draft.mealsPerDay),
      availableCookingMinutes: Number(draft.availableCookingMinutes), favoriteFoods: toList(draft.favoriteFoodsText),
      dislikedFoods: toList(draft.dislikedFoodsText), allergies: toList(draft.allergiesText), preferredCuisines: toList(draft.preferredCuisinesText),
      supplements: toList(draft.supplementsText), weeklyFoodBudgetMxn: Number(draft.weeklyFoodBudgetMxn),
    });
    onClose();
  };

  return <div className="modal-card profile-editor"><header><div><p className="eyebrow">Cuestionario VITAMATE</p><h2>Actualiza tu plan</h2></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}><IonIcon icon={closeOutline} /></button></header>
    <form onSubmit={submit} className="profile-editor-form">
      <section><h3>Tu cuenta y objetivo</h3><div className="form-grid"><Field label="Nombre"><input required minLength={2} value={draft.preferredName} onChange={(event) => setDraft({ ...draft, preferredName: event.target.value })} /></Field><Field label="Fecha de nacimiento"><input required type="date" value={draft.dateOfBirth} onChange={(event) => setDraft({ ...draft, dateOfBirth: event.target.value })} /></Field><Field label="Estatura (cm)"><input required type="number" min="120" max="230" value={draft.heightCm} onChange={(event) => setDraft({ ...draft, heightCm: Number(event.target.value) })} /></Field><Field label="Peso actual (kg)"><input required type="number" min="35" max="300" step="0.1" value={draft.weightKg} onChange={(event) => setDraft({ ...draft, weightKg: Number(event.target.value) })} /></Field></div>
        <Field label="Objetivo principal"><select value={draft.primaryGoal} onChange={(event) => setDraft({ ...draft, primaryGoal: event.target.value as UserProfile['primaryGoal'] })}><option value="fitness">Mejorar condición física</option><option value="fat_loss">Perder grasa</option><option value="muscle_gain">Ganar músculo</option><option value="recomposition">Recomposición corporal</option><option value="strength">Ganar fuerza</option><option value="maintain">Mantenerme</option><option value="habits">Crear hábitos</option></select></Field>
      </section>
      <section><h3>Movimiento</h3><Field label="Actividad cotidiana"><select value={draft.activityLevel} onChange={(event) => setDraft({ ...draft, activityLevel: event.target.value as UserProfile['activityLevel'] })}><option value="sedentary">Mayormente sentado/a</option><option value="light">Actividad ligera</option><option value="moderate">Actividad moderada</option><option value="high">Actividad alta</option><option value="very_high">Actividad muy alta</option></select></Field><Field label="Forma preferida de entrenar"><select value={draft.trainingPreference} onChange={(event) => setDraft({ ...draft, trainingPreference: event.target.value as UserProfile['trainingPreference'] })}><option value="gym">Gimnasio</option><option value="home">En casa</option><option value="sport">Deporte</option><option value="outdoor">Al aire libre</option><option value="mixed">Combinado</option></select></Field>{draft.trainingPreference === 'sport' && <Field label="Deporte"><input value={draft.preferredSport} onChange={(event) => setDraft({ ...draft, preferredSport: event.target.value })} /></Field>}<div className="form-grid"><Field label="Entrenamientos por semana"><input type="number" min="1" max="7" value={draft.weeklyTrainingDays} onChange={(event) => setDraft({ ...draft, weeklyTrainingDays: Number(event.target.value) })} /></Field><Field label="Minutos por sesión"><input type="number" min="15" max="120" step="5" value={draft.trainingMinutes} onChange={(event) => setDraft({ ...draft, trainingMinutes: Number(event.target.value) })} /></Field></div><Field label="Equipo disponible"><input value={draft.equipment} onChange={(event) => setDraft({ ...draft, equipment: event.target.value })} /></Field></section>
      <section><h3>Nutrición y gustos</h3><div className="form-grid"><Field label="Patrón alimenticio"><select value={draft.dietaryPattern} onChange={(event) => setDraft({ ...draft, dietaryPattern: event.target.value as UserProfile['dietaryPattern'] })}><option value="omnivore">Omnívoro</option><option value="vegetarian">Vegetariano</option><option value="vegan">Vegano</option><option value="pescatarian">Pescetariano</option><option value="other">Otro</option></select></Field><Field label="Comidas al día"><input type="number" min="2" max="6" value={draft.mealsPerDay} onChange={(event) => setDraft({ ...draft, mealsPerDay: Number(event.target.value) })} /></Field><Field label="Preparación"><select value={draft.mealPreparationPreference} onChange={(event) => setDraft({ ...draft, mealPreparationPreference: event.target.value as UserProfile['mealPreparationPreference'] })}><option value="cook_fresh">Cada comida al momento</option><option value="meal_prep">Meal prep</option></select></Field><Field label="Presupuesto semanal MXN"><input type="number" min="300" step="50" value={draft.weeklyFoodBudgetMxn} onChange={(event) => setDraft({ ...draft, weeklyFoodBudgetMxn: Number(event.target.value) })} /></Field><Field label="Nivel de cocina"><select value={draft.cookingLevel} onChange={(event) => setDraft({ ...draft, cookingLevel: event.target.value as UserProfile['cookingLevel'] })}><option value="basic">Básico</option><option value="intermediate">Intermedio</option><option value="advanced">Avanzado</option></select></Field><Field label="Tiempo para cocinar"><select value={draft.availableCookingMinutes} onChange={(event) => setDraft({ ...draft, availableCookingMinutes: Number(event.target.value) })}><option value="10">10 minutos</option><option value="20">20 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option></select></Field></div>{draft.mealPreparationPreference === 'meal_prep' && <div className="form-grid"><Field label="Estructura"><select value={draft.mealPrepStructure} onChange={(event) => setDraft({ ...draft, mealPrepStructure: event.target.value as UserProfile['mealPrepStructure'] })}><option value="same_by_meal">Mismo menú por tipo de comida</option><option value="full_day_blocks">Menú completo por bloques</option></select></Field><Field label="Rotación (días)"><input type="number" min="1" max="7" value={draft.mealPrepRotationDays} onChange={(event) => setDraft({ ...draft, mealPrepRotationDays: Number(event.target.value) })} /></Field></div>}<Field label="Suplementos"><input value={draft.supplementsText} onChange={(event) => setDraft({ ...draft, supplementsText: event.target.value })} placeholder="Proteína, creatina, vitaminas" /></Field><Field label="Alimentos favoritos"><input value={draft.favoriteFoodsText} onChange={(event) => setDraft({ ...draft, favoriteFoodsText: event.target.value })} placeholder="Pollo, avena, frutos rojos" /></Field><Field label="Alimentos que no te gustan"><input value={draft.dislikedFoodsText} onChange={(event) => setDraft({ ...draft, dislikedFoodsText: event.target.value })} /></Field><Field label="Alergias o ingredientes a evitar"><input value={draft.allergiesText} onChange={(event) => setDraft({ ...draft, allergiesText: event.target.value })} /></Field><Field label="Cocinas favoritas"><input value={draft.preferredCuisinesText} onChange={(event) => setDraft({ ...draft, preferredCuisinesText: event.target.value })} /></Field><Field label="Estilo de VITACOACH"><select value={draft.coachStyle} onChange={(event) => setDraft({ ...draft, coachStyle: event.target.value as UserProfile['coachStyle'] })}><option value="motivating">Motivador</option><option value="direct">Directo</option><option value="calm">Tranquilo</option><option value="technical">Técnico</option><option value="brief">Breve</option></select></Field></section>
      <p className="profile-recalculation"><IonIcon icon={refreshOutline} /> Al guardar se recalculan tus metas, tu plan alimenticio y tu semana de entrenamiento.</p>
      <IonButton type="submit" expand="block" className="primary-button"><IonIcon slot="start" icon={saveOutline} />Guardar y recalcular</IonButton>
    </form>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
