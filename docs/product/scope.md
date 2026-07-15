# Alcance Técnico y Funcional (VITAMATE)

## Identidad del Producto
VITAMATE es un entrenador personal inteligente, posicionado como un coach personal de entrenamiento, nutrición y progreso disponible todos los días. 
- **Dominio Principal:** `vitamate.mx`
- **Subdominios:** `app.vitamate.mx` (PWA), `api.vitamate.mx` (API), `admin.vitamate.mx` (Panel Admin).
- **Idioma Inicial:** Español de México (preparado para internacionalización i18n).
- **Unidades:** Sistema métrico (kg, cm, ml, kcal).

## Funcionalidades del MVP (PWA)
1. **Cuenta y Autenticación:** Registro por email, verificación, recuperación, inicio sesión con Google (opcional), eliminación de cuenta, exportación de datos, manejo de consentimientos (TOS, IA).
2. **Onboarding Personalizado:** 8 pasos obligatorios (bienvenida, perfil básico, objetivo, entrenamiento, nutrición, estilo de coach, seguridad, consentimiento).
3. **Panel Diario:** Dashboard con consumo de calorías, macros, hidratación, actividad, entrenamiento programado, alertas y resumen.
4. **Nutrición:** Objetivos diarios, diario dividido en comidas, búsqueda de alimentos, fotos de alimentos, creación de recetas, historial, promedios.
5. **Entrenamiento:** Plan semanal personalizado, registro de sesiones, cronómetro, sustitución de ejercicios, progresión de cargas, RPE/RIR.
6. **Coach de IA:** Chat en tiempo real con contexto total de usuario, memoria estructurada, sugerencias con confirmación obligatoria. No modifica DB directamente.
7. **Progreso:** Registro de peso, medidas, adherencia, fotos de progreso (opcional y privado). Revisiones semanales.
8. **Suscripciones:** Integración con Stripe (Mensual/Anual), pruebas gratuitas, manejo de webhooks, control de consumo (rate limits para IA).
9. **PWA Instalable:** Manifest, Service Worker, modo standalone, offline parcial, notificaciones web.

## Fuera del Alcance Inicial (MVP)
No se bloqueará el lanzamiento por: Apple Health, Apple Watch, Google Play Billing, StoreKit, Widgets, Live Activities, comunidad social, escaneo de códigos de barras, expedientes clínicos.
