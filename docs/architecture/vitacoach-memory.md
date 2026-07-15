# Memoria de VITACOACH

## Objetivo

VITACOACH conserva continuidad entre sesiones sin introducir todo el historial en cada petición. La memoria se divide en tres capas:

1. **Perfil y métricas actuales:** objetivos, preferencias del quiz, alimentación, entrenamiento, peso y resúmenes de salud.
2. **Conversación reciente:** hasta 20 mensajes remotos autenticados —o 10 del caché local sin sesión— para mantener el hilo inmediato.
3. **Memoria de largo plazo:** hasta 40 hechos relevantes, explícitos y estructurados por usuario.

El historial completo se almacena en `coach_messages`, pero no se reenvía completo al modelo. Esto mantiene predecibles el costo, la latencia y el tamaño del contexto.

## Modelo de datos

- `coach_threads`: hilo continuo de relación; actualmente existe uno por usuario.
- `coach_messages`: registro cronológico completo. Incluye `thread_id` y metadatos de origen.
- `coach_memories`: hechos compactos con clave semántica, categoría, importancia, confianza, sensibilidad, vigencia y mensaje de origen.

Las tres tablas aplican RLS por `auth.uid()`. El servidor utiliza la service role exclusivamente después de validar el bearer token de Supabase.

## Ciclo de una respuesta

1. La API valida la sesión y recupera el hilo del usuario.
2. Carga los últimos 20 mensajes y hasta 40 memorias activas.
3. VITACOACH responde y devuelve, en la misma salida estructurada, hasta seis actualizaciones de memoria.
4. El servidor guarda el mensaje del usuario, la respuesta y las actualizaciones.
5. La PWA conserva un caché de hasta 200 mensajes para apertura inmediata.

Sin sesión, el historial y hasta 60 memorias activas permanecen localmente. Al autenticarse, las memorias locales iniciales se transfieren a Supabase.

## Reglas de memoria

- Sólo se recuerda información expresada explícitamente por el usuario.
- No se guardan contraseñas, credenciales, direcciones precisas, identificadores oficiales ni documentos médicos crudos.
- Preferencias y metas estables no caducan; situaciones temporales utilizan una vigencia de 7–30 días.
- El usuario puede decir “olvida…” o corregir un recuerdo; el modelo emite una eliminación o sustitución utilizando la misma clave.
- La memoria se usa sólo cuando resulta pertinente y nunca se presenta como certeza si puede estar desactualizada.

## Alcance humano y clínico

VITACOACH adapta su papel entre entrenador, educador nutricional, mentor, acompañante y apoyo emocional. No afirma ser médico, nutriólogo registrado o psicólogo con licencia; no diagnostica ni fomenta dependencia o exclusividad. Las señales de riesgo conservan las reglas de derivación profesional y atención urgente.

