# Plan de Privacidad y Seguridad

## Principios Centrales
VITAMATE maneja información sumamente sensible: datos biométricos (peso, medidas), fotografías de progreso corporal, condiciones de salud, y patrones de alimentación.
- **Minimización de Datos:** Solo se solicita lo estrictamente necesario para que los motores (Nutrición/Entrenamiento) funcionen.
- **Retención Definida:** Si el usuario elimina su cuenta, se borran fotos y registros de base de datos de manera definitiva tras el período legal requerido.
- **Sin Publicidad:** Los datos de salud NUNCA se venderán ni se compartirán con SDKs de terceros para perfilado o publicidad.
- **Uso de IA Seguro:** NINGUNA información altamente identificable se enviará al LLM. Los prompts se nutren del contexto del usuario pero sin nombre completo, email o IDs públicos.

## Revocación y Consentimientos
- Todo usuario debe firmar explícitamente el Aviso de Privacidad y Términos de Servicio.
- Se debe recabar un **consentimiento separado** para:
  1. Uso del Coach IA (entendiendo que los mensajes se procesan por modelos externos como OpenAI/Anthropic).
  2. Subida de imágenes corporales (explicando cómo se protegen).
- En cualquier momento el usuario puede exportar un `.zip` o `.json` con todo su historial.
- Flujo de eliminación de cuenta disponible dentro de la App (requerido por Apple App Store).

## Observabilidad y Analítica
- El uso de herramientas (ej. PostHog, Mixpanel o Amplitude) estará restringido exclusivamente a **Métricas de Producto**:
  - `landing_viewed`, `signup_started`, `subscription_created`.
- **PROHIBIDO:** Enviar peso, calorías, mensajes del chat, u objetivos específicos de salud a servicios analíticos.

## Manejo de Fotografías
- **EXIF:** Se eliminarán coordenadas GPS, fecha de captura y metadatos de cámara desde el lado del cliente (Canvas) antes de enviarse al Storage.
- **Buckets Privados:** Ni las fotos de progreso ni las fotos de comidas son públicas.
- Para consumirlas, el cliente requiere un JWT de sesión activo que le firma una URL con duración de X minutos.
