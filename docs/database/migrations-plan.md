# Plan de Migraciones (Base de Datos)

## Herramienta
Se utilizará el CLI de Supabase para manejar el esquema relacional de PostgreSQL.

## Flujo de Trabajo
1. Cambios en desarrollo usando la instancia local o de staging.
2. Generación de la migración: `supabase db diff -f nombre_descriptivo`.
3. Revisión de SQL crudo (comprobación de RLS, grants y defaults).
4. Commit y revisión en PR (GitHub).
5. Despliegue a Producción usando GitHub Actions (`supabase db push`).

## Estrategia de Versionado
Las migraciones deben ser aditivas o destructivas seguras (si se borra una columna en producción, la API ya debe haber dejado de usarla en la versión anterior).
Se usarán las carpetas `supabase/migrations/` numeradas cronológicamente `YYYYMMDDHHMMSS_name.sql`.

## Migraciones Iniciales Planteadas (Fase 2)
1. `0000_enable_pgcrypto.sql`: Habilitar UUID v4.
2. `0001_profiles.sql`: Crear perfiles y health_profiles, con RLS.
3. `0002_nutrition.sql`: Esquema base de foods, targets, meal_entries.
4. `0003_training.sql`: Esquema base de exercises, sessions, sets.
5. `0004_subscriptions.sql`: Esquema de billing y webhooks idempotentes.
6. `0005_ai_coach.sql`: Hilos, mensajes, uso de tokens.
