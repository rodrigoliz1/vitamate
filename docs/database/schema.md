# Arquitectura de Base de Datos

## Principios
- PostgreSQL gestionado por Supabase.
- Uso exclusivo de UUIDs como Primary Keys.
- Columnas base requeridas en toda tabla principal: `id`, `user_id`, `created_at`, `updated_at`, `deleted_at` (soft deletes donde aplique), `source`, `version`, `metadata`.
- Row Level Security (RLS) habilitado por defecto denegando todo acceso.

## Entidades Principales

### Identidad y Perfil
- **profiles:** `id`, `user_id`, `preferred_name`, `date_of_birth`, `locale`, `country`, `timezone`, `units`, `onboarding_status`.
- **health_profiles:** `id`, `user_id`, `biological_sex_for_calculation`, `height_cm`, `current_weight_kg`, `body_fat_percentage`, `training_experience`, `activity_level`, `limitations`, `safety_flags`.
- **user_preferences:** Configuración de UX, nutrición y notificaciones.
- **user_goals:** Metas del usuario (pérdida grasa, hipertrofia).
- **consent_records:** Auditoría legal de TOS y privacidad (versionado, fechas de aceptación, revocación).

### Mediciones y Progreso
- **body_measurements:** Medidas corporales a lo largo del tiempo.
- **progress_photos:** Path al bucket privado, fecha, ángulo.
- **daily_checkins:** Reporte de hambre, energía, sueño, estrés.

### Nutrición
- **nutrition_targets:** Macros asignados (histórico y actual).
- **foods:** Catálogo interno (curado, FoodData Central, subidos por usuario).
- **meal_entries:** Registro del usuario (qué comió, cuánto, nivel de confianza, fuente).
- **food_images** y **food_analysis_jobs:** Histórico de fotos procesadas por IA y sus estados asíncronos.
- **meal_plans:** Planes de alimentación generados o asignados.

### Entrenamiento
- **exercises:** Biblioteca de ejercicios curados, instrucciones, y contraindicaciones.
- **workout_plans:** Mesociclos/planes asignados.
- **workout_sessions** y **workout_sets:** Registro de sesiones completadas, RPE, peso usado.
- **personal_records:** PRs en ejercicios específicos.

### Chat e Inteligencia Artificial
- **chat_threads**, **chat_messages**, **conversation_summaries**, **user_memories**: Persistencia de la relación Coach-Usuario estructurada para análisis contextual.
- **ai_runs:** Auditoría de tokens, latencias, costo estimado y errores para analítica interna (sin secretos).

### Suscripciones y Entitlements
- **billing_customers**, **subscriptions**, **entitlements**, **billing_events**: Reflejan la fuente de la verdad originada por webhooks (Stripe/Apple).

## Seguridad de Archivos (Buckets)
- Las imágenes de progreso y comida se guardan en un bucket `private`.
- Las URIs usan firmas de corta duración.
- Formato sugerido: `users/{userId}/food/{year}/{month}/{uuid}.webp`.
