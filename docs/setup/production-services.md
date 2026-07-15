# Activación de Stripe, Brevo y VITACOACH Realtime

Las claves que alguna vez se pegaron en un chat deben considerarse comprometidas. Revócalas, crea credenciales nuevas y colócalas únicamente en el entorno seguro del backend. No uses variables `VITE_*` para secretos.

## 1. Stripe Billing

1. En Stripe, modo de prueba, crea el producto **VITAMATE Premium**.
2. Crea dos precios recurrentes: mensual y anual. Copia sus identificadores `price_...`.
3. Activa y personaliza el Customer Portal en **Billing → Customer portal**.
4. En **Developers / Workbench → Webhooks**, registra el endpoint público `https://api.vitamate.mx/v1/billing/webhook`.
5. Selecciona al menos estos eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` y `customer.subscription.deleted`.
6. Copia el signing secret propio de ese endpoint (`whsec_...`). No es la clave secreta general.
7. En el entorno seguro de `apps/api`, configura:

```dotenv
STRIPE_SECRET_KEY=sk_test_nueva
STRIPE_WEBHOOK_SECRET=whsec_nuevo
STRIPE_PRICE_MONTHLY=price_mensual
STRIPE_PRICE_ANNUAL=price_anual
PUBLIC_APP_URL=https://app.vitamate.mx
```

El acceso premium se actualizará sólo después de verificar la firma del webhook y guardar el estado en Supabase. La URL de éxito de Checkout no concede permisos por sí sola.

Para probar localmente, Stripe CLI puede reenviar los eventos al backend; el signing secret que imprime la CLI es temporal y distinto del webhook de producción.

## 2. Brevo

1. En Brevo, registra `noreply@vitamate.mx` como remitente.
2. Autentica `vitamate.mx` con los registros DNS que Brevo muestre (DKIM y los demás registros solicitados) y espera a que el panel lo marque verificado. Si Brevo responde `unrecognised IP`, autoriza primero la IP del servidor o de desarrollo en **Security → Authorised IPs**.
3. Rota la API key y la SMTP key expuestas anteriormente.
4. Configura en el backend:

```dotenv
BREVO_API_KEY=xkeysib_nueva
BREVO_SMTP_KEY=xsmtpsib_nueva
BREVO_SENDER_EMAIL=noreply@vitamate.mx
```

VITAMATE usa la API transaccional de Brevo para enviar su correo de acceso con código OTP de seis dígitos. Supabase genera y verifica el token, pero la plantilla y la entrega las controla el backend de VITAMATE. Como respaldo para correos propios de Supabase Auth, configura su SMTP personalizado con `smtp-relay.brevo.com`, puerto 587, el usuario SMTP de Brevo y la **SMTP key** (no la API key).

## 3. OpenAI Realtime sobre WebRTC

La implementación ya está conectada así:

1. La PWA solicita `POST /v1/coach/realtime-token` al backend autenticado.
2. El backend usa `OPENAI_API_KEY` para crear un client secret efímero, con el modelo y la voz configurados.
3. La PWA abre micrófono y una conexión WebRTC directamente con OpenAI usando únicamente ese client secret temporal.
4. El audio remoto se reproduce continuamente; no hace falta mantener presionado el micrófono.
5. Si WebRTC no está disponible, se conserva el modo continuo del navegador como respaldo.

Variables opcionales:

```dotenv
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_REALTIME_VOICE=marin
```

Para probar: inicia API y PWA, abre **VITACOACH → Llamar** y concede micrófono. La llamada comienza automáticamente. Todos los endpoints de VITACOACH exigen una sesión válida y un entitlement Premium; `REQUIRE_COACH_AUTH=true` se conserva además como configuración explícita de producción.

## 4. Despliegue de base de datos

Desde la raíz del proyecto:

```bash
corepack pnpm dlx supabase link --project-ref wxezdboreybgxdlivoeo
corepack pnpm dlx supabase db push
```

Las migraciones `202607140010_billing_entitlements.sql` y `202607140011_persistent_rate_limits.sql` añaden clientes de Stripe, entitlements, deduplicación de webhooks y límites persistentes con RLS. Las migraciones previas añaden planes, memoria, precios y entrenamiento progresivo.

En producción configura también:

```dotenv
APP_ORIGIN=https://app.vitamate.mx
TRUST_PROXY=true
REQUIRE_COACH_AUTH=true
```

## 5. Verificación local de Stripe

En otra terminal, con la API en el puerto 3001:

```bash
stripe listen --forward-to http://'http://127.0.0.1:3001'/v1/billing/webhook
```

Coloca temporalmente el `whsec_...` que imprime la CLI en `STRIPE_WEBHOOK_SECRET`, reinicia la API y completa Checkout con una cuenta de prueba. Verifica alta, renovación, cancelación, pago fallido y reactivación desde Stripe. El frontend nunca concede Premium por el parámetro `checkout=success`; sólo consulta el entitlement proyectado por el webhook.
