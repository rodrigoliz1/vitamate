# Traspaso integral de VITAMATE

> Documento para continuar el desarrollo con otra cuenta de Codex. Actualizado el 14 de julio de 2026. No contiene secretos: deben permanecer exclusivamente en los gestores de variables de entorno y en los `.env` locales ignorados por Git.

## 1. Producto, marca y decisión de despliegue

**VITAMATE** es una plataforma mexicana de acompañamiento fitness, nutrición, progreso y suscripción. El asistente central se llama **VITACOACH**. El producto combina:

- registro de comida, macros, foto, búsqueda, código de barras y alimentos personales;
- plan alimenticio y lista semanal del súper con precios PROFECO/INEGI;
- entrenamiento guiado, progresión de carga y registro de actividad;
- chat y llamada de voz con memoria contextual;
- onboarding personalizado, cuenta, autenticación y suscripción Premium.

La identidad visual usa, como mínimo:

- verde bosque `#2F5233`;
- verde salvia `#5A7D5E`;
- melocotón `#E6C7B2`;
- azul marino `#1A2E3E`;
- blanco `#FFFFFF`.

El material de marca está en los recursos de diseño ya incorporados en la PWA y sitio. El nombre comercial es VITAMATE y el dominio objetivo es `vitamate.mx`.

Decisión de despliegue vigente:

| Componente | Destino |
| --- | --- |
| Sitio comercial | Vercel → `vitamate.mx` |
| PWA | Vercel → `app.vitamate.mx` |
| API Fastify | Render → `api.vitamate.mx` |
| Base de datos/Auth | Supabase PostgreSQL/Auth |

No usar Netlify.

## 2. Estructura del repositorio

```text
apps/
  app/        PWA Ionic React + Vite + Capacitor
  api/        API Fastify + TypeScript
  website/    Sitio comercial Next.js
packages/
  domain/     Tipos, reglas y motores de dominio compartidos
  ui/         Componentes compartidos
  design-tokens/ Tokens de diseño
  config/     Configuración común
supabase/
  migrations/ Esquema y RLS
docs/        Arquitectura, operaciones, legal y producto
```

El monorepo usa pnpm 8, Turborepo y Node 22+; Capacitor 8 requiere esta versión mínima. Los scripts principales están en [`package.json`](../../package.json).

## 3. Estado funcional implementado

### PWA

- Rutas: Hoy, Nutrición, Plan semanal, Entrenar, VITACOACH, Progreso y Cuenta.
- Tema oscuro implementado. El selector de inglés está oculto de UI mediante `LANGUAGE_SELECTION_ENABLED=false`, no eliminado.
- Onboarding ampliado: nombre completo/preferido, sexo Hombre/Mujer obligatorio, objetivo físico, preferencias dietéticas, gustos/disgustos, alergias, suplementos, gimnasio/casa/deporte, meal prep, presupuesto y estilo del coach.
- Resultado posterior al quiz con propuesta, horizonte estimado y oferta Premium.
- Cuenta: registro con correo y contraseña, OTP, inicio de sesión, recuperación de contraseña por OTP y controles de mostrar/ocultar contraseña.
- Gratuito: contador de macros, búsqueda, código de barras y alimentos personales. Las funciones IA/Premium deben bloquearse antes de consumir OpenAI o fal.ai.
- Premium: planes, chat, llamada, foto IA, estimaciones, entrenamientos guiados y progreso avanzado.
- Nutrición: porciones normalizadas, alimentos personales, Open Food Facts, USDA, escáner de código, foto IA con confirmación previa, metas y balance semanal.
- Plan alimenticio: opciones por comida, selección persistente, meal prep y lista del súper ligada al mismo plan. Hay pruebas de regresión de coherencia plan/lista.
- Entrenar: plan casa/gimnasio, registro por series y repeticiones, peso, RPE, progresión doble, historial y registro manual mediante VITACOACH.
- VITACOACH: historial durable, memoria estructurada, acciones para registrar comidas/actividad y cambios de plan, PDF de estudios, fotos de alimentos y llamada Realtime WebRTC.
- Sitio comercial Next.js: landing, cómo funciona, funciones, fuentes, nosotros, precios, privacidad y términos. Incluye guía de instalación PWA y CTA a la app.

### API

Principales módulos:

| Ruta/archivo | Responsabilidad |
| --- | --- |
| `apps/api/src/routes/auth.ts` | registro, OTP, recuperación y Brevo |
| `apps/api/src/routes/billing.ts` | Stripe Checkout, portal, estado y webhook |
| `apps/api/src/routes/coach.ts` | chat, historial, memoria, Realtime y PDF |
| `apps/api/src/routes/foods.ts` | catálogo, búsqueda, porción, barcode y Open Food Facts |
| `apps/api/src/routes/nutrition.ts` | análisis fotográfico de comida y recetas/medios |
| `apps/api/src/routes/exerciseMedia.ts` | imágenes globales de ejercicios y fal.ai |
| `apps/api/src/routes/marketPrices.ts` | estimación de lista del súper |
| `apps/api/src/services/groceryEstimator.ts` | consolidación, presentación y precios |
| `apps/api/src/providers/openaiCoach.ts` | Responses, acciones estructuradas y memoria |
| `apps/api/src/providers/openaiFoodVision.ts` | análisis de foto de comida |

Proveedores conectados o preparados: Supabase, Stripe, Brevo, OpenAI Responses/Realtime, fal.ai, USDA, Open Food Facts, PROFECO e INEGI.

### Supabase

Migraciones existentes, en orden:

1. `202607130001_vitamate_core.sql`
2. `202607130002_weight_entries.sql`
3. `202607130003_coach_messages.sql`
4. `202607130004_meal_media.sql`
5. `202607130005_weekly_tracking.sql`
6. `202607130006_personalization_progressive_health.sql`
7. `202607130007_training_environments.sql`
8. `202607130008_coach_memory.sql`
9. `202607130009_market_price_estimates.sql`
10. `202607140010_billing_entitlements.sql`
11. `202607140011_persistent_rate_limits.sql`

Las migraciones se han aplicado al proyecto remoto durante el desarrollo. Mantener RLS: todo dato de usuario debe limitarse a `auth.uid()`; service role sólo en API después de validar el bearer token.

## 4. Datos, precios e IA

### Catálogo y precios

- Open Food Facts se consulta desde backend, con User-Agent identificable y caché local; no usarlo como autocomplete en cada tecla.
- USDA complementa la búsqueda nutricional.
- Ya se importó Open Food Facts mexicano y CSV QQP de PROFECO de mayo de 2026.
- INPC: el importador correcto utiliza la calculadora oficial de INEGI y el índice absoluto mensual general (base segunda quincena de julio de 2018 = 100), indicador/configuración `865541`; consultar [`market-price-data.md`](../setup/market-price-data.md).
- El súper guarda una estimación congelada por semana. Sólo debe recalcularse cuando cambia plan, ubicación, personas o presupuesto.
- Cuando no exista precio exacto debe usar una estimación fundada por categoría/unidad basada en PROFECO, indicar confianza baja y explicación; nunca dejar un ingrediente sin explicación ni inventar un precio sin observaciones compatibles.

### Memoria VITACOACH

La arquitectura relevante está en [`docs/architecture/vitacoach-memory.md`](../architecture/vitacoach-memory.md):

- historial completo persistido en `coach_messages`;
- hilo en `coach_threads`;
- hasta 40 memorias activas estructuradas en `coach_memories`;
- la PWA conserva caché local y sincroniza al autenticar;
- nunca guardar secretos ni documentos médicos en bruto como memoria.

El coach debe tratar al usuario como acompañante, entrenador, educador nutricional y apoyo emocional, sin fingir ser médico/nutriólogo/psicólogo licenciado ni diagnosticar.

### Imágenes fal.ai

- Medios de ejercicios se generan globalmente y se guardan para reutilización, no por usuario.
- La correspondencia biomecánica ha recibido una revisión interna, pero falta aprobación profesional formal de entrenador/fisioterapeuta antes de presentarla como validada.
- Fotos de recetas tienen proveedor fal.ai y fallback seguro.

## 5. Variables de entorno y secretos

Referencias completas: [`docs/architecture/env-variables.md`](../architecture/env-variables.md) y [`docs/setup/production-services.md`](../setup/production-services.md).

Archivos esperados:

```text
apps/api/.env          secretos sólo del servidor
apps/app/.env.local    URL pública de API + Supabase publicable
apps/website/.env      variables NEXT_PUBLIC únicamente
```

No copiar claves de chats, capturas ni historial a código. Deben rotarse las que se compartieron antes. Variables importantes del backend:

```dotenv
APP_ORIGIN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=
OPENAI_VISION_MODEL=
OPENAI_REALTIME_MODEL=
OPENAI_REALTIME_VOICE=
FAL_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_ANNUAL=
BREVO_API_KEY=
BREVO_SMTP_KEY=
BREVO_SENDER_EMAIL=
PROFECO_QQP_SOURCE_URL=
INEGI_INPC_SOURCE=calculator
```

PWA:

```dotenv
VITE_API_BASE_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Nunca colocar service role, OpenAI, Stripe secret, Brevo, fal.ai o Cloudinary secret en `VITE_*` o `NEXT_PUBLIC_*`.

## 6. Ejecución local y comprobación

Desde la raíz:

```bash
corepack pnpm install
corepack pnpm --filter vitamate-api dev
corepack pnpm --filter vitamate-app dev -- --host 0.0.0.0
corepack pnpm --filter vitamate-website dev
```

Verificación básica:

```bash
corepack pnpm --filter vitamate-app typecheck
corepack pnpm --filter vitamate-app lint
corepack pnpm --filter vitamate-app build
corepack pnpm --filter vitamate-api typecheck
corepack pnpm --filter vitamate-website typecheck
corepack pnpm --filter vitamate-website lint
```

Para Supabase:

```bash
corepack pnpm dlx supabase link --project-ref wxezdboreybgxdlivoeo
corepack pnpm dlx supabase db push
```

Para imports:

```bash
corepack pnpm --filter vitamate-api import:profeco -- /ruta/archivo.csv
corepack pnpm --filter vitamate-api import:inpc
corepack pnpm --filter vitamate-api import:off
```

Para pruebas de iPhone, abrir la PWA en la IP LAN o un túnel HTTPS. Realtime/WebRTC y micrófono requieren HTTPS real en iPhone. En Vite, `/v1` se proxifica a API durante desarrollo para evitar exponer API con el túnel.

## 7. Incidencia activa: interfaz de VITACOACH en iPhone

Este es el trabajo prioritario para la siguiente cuenta.

### Síntoma

En Safari iPhone, el historial y el campo para escribir se han solapado repetidamente. Las capturas del usuario muestran:

- versiones anteriores: el composer cubría mensajes y/o quedaba fuera de vista con teclado;
- intento de 14-jul: convertirlo en `IonFooter` produjo una caja excesivamente alta y botones distribuidos en vertical.

### Estado tras este traspaso

El intento de `IonFooter` se revirtió. El composer vuelve a estar dentro de la página desplazable, que era más legible que el resultado roto. Se mantienen:

- selector de foto con **Tomar foto**, **Elegir del álbum** y **Elegir archivo**;
- IDs UUID correctos para mensajes locales;
- OTP sin límite local de seis dígitos.

Archivos que se deben revisar antes de modificar:

- `apps/app/src/pages/Coach.tsx`
- `apps/app/src/features.css`
- `apps/app/src/App.tsx` (tabs y outlet Ionic)
- `apps/app/src/App.css` (layout global, `IonTabs`/tab bar)

### Requisito de aceptación estricto

En Safari iPhone real, con historial largo:

1. el campo se ve siempre en reposo;
2. al tocarlo, el teclado y campo se comportan como una sola composición tipo WhatsApp;
3. no tapa mensajes ni queda detrás del tab bar;
4. el listado se desplaza al último mensaje al abrir/enviar;
5. el textarea no provoca zoom (font-size mínimo efectivo: 16px);
6. los botones caben horizontalmente en 390 px CSS;
7. comprobar en equipo real y con captura antes de afirmar que está resuelto.

No introducir un segundo sistema de posicionamiento (`fixed` + `IonFooter` + `VisualViewport`) sin aislar primero cómo Ionic calcula el alto de `IonPage`, `IonContent` y `IonTabBar`. La prueba anterior falló precisamente por esa combinación.

## 8. Stripe, autenticación y producción

### Stripe

- Hay flujo de Checkout mensual/anual con prueba gratis de siete días una vez por usuario.
- Customer Portal y webhook están implementados.
- La fuente de verdad de Premium es el entitlement escrito tras webhook Stripe verificado; la URL `?checkout=success` sólo reconcilia y muestra UI, no concede acceso por sí sola.
- Eventos necesarios: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- En producción el endpoint debe ser `https://api.vitamate.mx/v1/billing/webhook`, con signing secret propio.
- Probar alta, cancelación, renovación, pago fallido, reactivación y segunda prueba gratis denegada.

### Brevo/Supabase

- Brevo envía OTP/registro/recovery; Supabase mantiene identidad y sesión.
- El correo es único. Registro con contraseña, confirmación por OTP, login y recovery existen.
- Brevo puede bloquear IP local como `401 unrecognised IP`; autorizar IP o probar desde servidor.
- Confirmar SPF, DKIM, DMARC, remitente y entregabilidad con un correo externo real.

### iOS / App Store

- El proyecto nativo Capacitor 8 está generado en `apps/app/ios` con Bundle ID `mx.vitamate.app`, iOS 15+, icono, splash, permisos y manifiesto de privacidad.
- StoreKit mensual/anual, restauración, precio localizado, Apple Health, cámara/galería, Keychain y deep links están integrados.
- La API verifica JWS de Apple y App Store Server Notifications V2; la migración `202607140012_apple_storekit.sql` ya está aplicada.
- Dentro de iOS las compras nuevas no usan Stripe. El acceso comprado en web se reconoce, pero no se promueve un checkout externo.
- Falta instalar Xcode completo, elegir Team, crear App ID/productos en App Store Connect, configurar el numeric App ID y webhook, publicar AASA, probar Sandbox y subir TestFlight.
- Usar `docs/app-store/ios-release-runbook.md`, `readiness-checklist.md` e `ios-environment.md` como fuentes actuales.

## 9. Pendiente antes de lanzamiento público

1. Resolver y probar la interfaz móvil de VITACOACH anterior.
2. Desplegar Vercel/Render; configurar DNS, HTTPS, CORS, `APP_ORIGIN`, secretos y dominios.
3. Revisar la autenticación obligatoria de VITACOACH, RLS con dos usuarios y límites persistentes.
4. Programar importación semanal PROFECO y mensual INPC con alertas de fallos.
5. Revisión formal por entrenador/fisioterapeuta de imágenes y rutinas; por nutriólogo de recetas, macros, alergias y reglas de fatiga; por abogado mexicano de legal/privacidad/ARCO.
6. Completar datos reales de responsable, razón social, domicilio, ARCO, cookies y conservación de datos en documentos legales. La eliminación dentro de la app ya está implementada.
7. Finalizar traducción inglesa profunda antes de reactivar idioma.
8. Pruebas end-to-end y regresión visual reales: iPhone, Android, iPad, escritorio, offline/reconexión, accesibilidad, carga, autorización entre cuentas y pagos.
9. Beta cerrada, analítica respetuosa de privacidad, soporte e iteración antes de pagos públicos.

## 10. Archivos de referencia obligatorios

- [`implementation-status.md`](../product/implementation-status.md): bitácora detallada de lo realizado y decisiones.
- [`production-services.md`](../setup/production-services.md): activación Stripe/Brevo/Realtime/Supabase.
- [`market-price-data.md`](../setup/market-price-data.md): importación y método PROFECO/INEGI.
- [`vitacoach-memory.md`](../architecture/vitacoach-memory.md): persistencia y límites de memoria.
- [`privacy-plan.md`](../security/privacy-plan.md): requisitos de datos sensibles.
- [`pwa-capacitor-strategy.md`](../architecture/pwa-capacitor-strategy.md): evolución a App Store/HealthKit.
- [`apps/website/AGENTS.md`](../../apps/website/AGENTS.md): instrucciones locales específicas para el sitio comercial.

## 11. Reglas para el siguiente agente

- Empieza por inspeccionar estado real de archivos y servidores; este repositorio puede contener copias de iCloud con nombres `* 2.*` que no son el código activo.
- No destruyas cambios ajenos ni ejecutes `git reset --hard`.
- Usa `apply_patch` para editar archivos.
- No divulgar ni reutilizar secretos previamente compartidos; rotarlos al desplegar.
- No prometer verificación en iPhone sin una prueba visual real.
- No permitir que una función gratuita llame a OpenAI/fal.ai.
- Mantener el plan alimenticio de Nutrición y Lista semanal usando la misma selección persistida; nunca regenerar al reabrir una vista.
