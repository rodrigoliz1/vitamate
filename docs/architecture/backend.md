# Arquitectura Backend

## Stack Tecnológico Principal
- **Runtime:** Node.js.
- **Framework Web:** Fastify.
- **Lenguaje:** TypeScript estricto.
- **Validación de Datos:** Zod.
- **Documentación:** OpenAPI (Swagger).
- **Autenticación:** JWT validado en servidor mediante JWKS (Supabase Auth).

## Principios de Diseño
1. **Separación por Dominios:** El backend está dividido lógicamente en módulos de negocio (Ej: Nutrición, Entrenamiento, Suscripciones, IA).
2. **Inyección de Dependencias Ligera:** Para facilitar el testing y la modularidad de adaptadores externos.
3. **Manejo de Errores Global:** Respuestas estructuradas (código de error, mensaje amistoso, detalles de validación si aplica). Sin filtrado de stacktraces a los clientes.
4. **Idempotencia:** Especialmente crítico para webhooks de Stripe y operaciones offline que pudieran reenviarse.
5. **Rate Limiting:** Aplicado por IP o por usuario, con reglas estrictas para el consumo de la IA.

## Capa de APIs (`/v1`)
- **Controladores:** Manejan el parsing de request/response y llaman a los servicios.
- **Esquemas:** Zod define la entrada y salida, que a su vez genera los tipos y la especificación OpenAPI.
- **Servicios:** Contienen los motores de lógica (Ej. `NutritionEngine` evalúa calorías, `TrainingEngine` sugiere progresiones).

## Manejo Asíncrono
- **Cola de Trabajos (Job Queue):** Las tareas como el análisis de imágenes por IA o envíos de correos se procesan mediante colas (ej. BullMQ con Redis).
- **Comunicación en Tiempo Real:** Server-Sent Events (SSE) para el streaming de respuestas del Coach de Inteligencia Artificial.

## Seguridad e Integridad
- No confiar nunca en el `user_id` enviado en el body, extraerlo siempre del token validado.
- Validar esquemas estrictos antes de cualquier inserción en DB.
- Cifrado en tránsito y manejo de secretos a través de variables de entorno (no codeadas).
