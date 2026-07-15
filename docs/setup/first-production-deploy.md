# Primer despliegue: GitHub, Render, Vercel, dominios y servicios

Este instructivo publica el primer entorno de producción de VITAMATE sin subir credenciales al repositorio. Objetivo final:

```text
https://vitamate.mx       Sitio comercial (Vercel)
https://app.vitamate.mx   PWA (Vercel)
https://api.vitamate.mx   API Fastify (Render)
```

> No copies claves desde conversaciones ni archivos `.env` al repositorio. Si una credencial fue compartida antes, rótala en el proveedor antes de producción.

## 0. Verificación previa

Desde la raíz del repositorio:

```bash
pnpm install --frozen-lockfile
pnpm --filter vitamate-app typecheck
pnpm --filter vitamate-app lint
pnpm --filter vitamate-app build
pnpm --filter vitamate-api typecheck
pnpm --filter vitamate-website typecheck
pnpm --filter vitamate-website lint
pnpm --filter vitamate-website build
```

La PWA tiene el favicon de VITAMATE declarado en `apps/app/index.html`, manifest y assets. El sitio comercial contiene el mismo favicon SVG en `apps/website/public/favicon.svg`.

## 1. Publicar el repositorio en GitHub

El repositorio de destino es `https://github.com/rodrigoliz1/vitamate`.

Antes de publicar, confirma que `.env`, `.env.local`, `node_modules`, `.next`, `dist`, `.turbo`, `.pnpm-store`, `.DS_Store` y copias de iCloud con el sufijo ` 2` no aparecerán entre los archivos a subir.

```bash
git init
git add .
git status --short
git commit -m "Initial VITAMATE platform"
git branch -M main
git remote add origin https://github.com/rodrigoliz1/vitamate.git
git push -u origin main
```

Si `origin` ya existe:

```bash
git remote set-url origin https://github.com/rodrigoliz1/vitamate.git
git push -u origin main
```

## 2. Variables de entorno

### Render — API (`apps/api`)

Agregar en **Render → Environment**. Las variables marcadas como secretas nunca van a Vercel ni a un archivo versionado.

| Variable | Valor de producción / origen | Tipo |
| --- | --- | --- |
| `NODE_ENV` | `production` | texto |
| `TRUST_PROXY` | `true` | texto |
| `APP_ORIGIN` | `https://app.vitamate.mx,https://vitamate.mx` | texto |
| `PUBLIC_APP_URL` | `https://app.vitamate.mx` | texto |
| `OPEN_FOOD_FACTS_BASE_URL` | `https://world.openfoodfacts.org` | texto |
| `OPEN_FOOD_FACTS_USER_AGENT` | `VITAMATE/1.0 (https://vitamate.mx; contacto@vitamate.mx)` | texto |
| `USDA_FDC_API_KEY` | clave actual de USDA FoodData Central | secreto |
| `SUPABASE_URL` | URL del proyecto Supabase | secreto de servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | service role de Supabase | secreto de servidor |
| `OPENAI_API_KEY` | clave rotada de OpenAI | secreto |
| `OPENAI_VISION_MODEL` | `gpt-4o-mini` o modelo elegido | texto |
| `OPENAI_COACH_MODEL` | `gpt-4o-mini` o modelo elegido | texto |
| `OPENAI_REALTIME_MODEL` | `gpt-realtime-2.1` | texto |
| `OPENAI_REALTIME_VOICE` | `marin` o voz elegida | texto |
| `FAL_KEY` | clave rotada fal.ai | secreto |
| `FAL_IMAGE_MODEL` | `fal-ai/nano-banana-pro` o modelo contratado | texto |
| `FAL_MEAL_IMAGE_MODEL` | `fal-ai/flux/dev` o modelo contratado | texto |
| `ADMIN_BOOTSTRAP_TOKEN` | token aleatorio de al menos 20 caracteres para administración interna | secreto |
| `STRIPE_SECRET_KEY` | clave secreta **live** de Stripe al lanzar pagos reales; test mientras se prueba | secreto |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` exclusivo del webhook `api.vitamate.mx/v1/billing/webhook` | secreto |
| `STRIPE_PRICE_MONTHLY` | ID `price_...` mensual | secreto/identificador |
| `STRIPE_PRICE_ANNUAL` | ID `price_...` anual | secreto/identificador |
| `BREVO_API_KEY` | API key transaccional rotada | secreto |
| `BREVO_SMTP_KEY` | SMTP key rotada | secreto |
| `BREVO_SENDER_EMAIL` | `noreply@vitamate.mx` | texto |
| `BREVO_SENDER_NAME` | `VITAMATE` | texto |
| `REQUIRE_COACH_AUTH` | `true` | texto |
| `PROFECO_QQP_SOURCE_URL` | URL oficial de CSV/paquete QQP, sólo si se automatiza importación | texto opcional |
| `INEGI_INPC_SOURCE` | `calculator` | texto |
| `INEGI_INPC_INDICATOR_ID` | `865541` | texto |
| `INEGI_INPC_CALCULATOR_URL` | `https://www.inegi.org.mx/app/indicesdeprecios/CalculadoraInflacion.aspx` | texto |
| `INEGI_INPC_CONFIG_URL` | `https://www.inegi.org.mx/componentes/biinegi/config.min.js?v1.0.5` | texto |
| `INEGI_INPC_DATA_BASE_URL` | `https://www.inegi.org.mx/app/api/indicadores/interna_v1_3` | texto |
| `INEGI_INPC_SERIES_JSON` | `{"General":"865541"}` | texto |

No establecer manualmente `PORT`: Render la inyecta. `INEGI_API_TOKEN` queda vacío cuando se usa `INEGI_INPC_SOURCE=calculator`.

### Vercel — PWA (`apps/app`)

Estas variables se incrustan en el bundle al construir; redeploy obligatorio tras cambiarlas.

| Variable | Valor |
| --- | --- |
| `VITE_API_BASE_URL` | `https://api.vitamate.mx` |
| `VITE_SUPABASE_URL` | URL pública del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clave publicable/anon de Supabase |

Las dos variables de Supabase son públicas por diseño; no agregar service role, Stripe, OpenAI, fal.ai ni Brevo.

### Vercel — sitio comercial (`apps/website`)

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://vitamate.mx` |
| `NEXT_PUBLIC_APP_URL` | `https://app.vitamate.mx` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave publicable/anon de Supabase |
| `NEXT_PUBLIC_PREMIUM_MONTHLY_MXN` | precio público mensual en MXN, por ejemplo `349` |
| `NEXT_PUBLIC_PREMIUM_ANNUAL_MXN` | precio público anual en MXN, por ejemplo `2999` |

Los importes públicos son sólo presentación. El precio que cobra Stripe se determina exclusivamente por `STRIPE_PRICE_*` en la API.

## 3. Crear API en Render

1. En Render, crear **New → Web Service** y conectar el repositorio `rodrigoliz1/vitamate`.
2. Usar región cercana a México/usuarios objetivo y un plan que no suspenda el servicio si se cobrará Premium.
3. Configurar:

   | Campo Render | Valor |
   | --- | --- |
   | Runtime | Node |
   | Branch | `main` |
   | Root directory | dejar vacío (raíz del monorepo) |
   | Build command | `pnpm install --frozen-lockfile --prod=false && pnpm --filter vitamate-api build` |
   | Start command | `pnpm --filter vitamate-api start` |
   | Health check path | `/health` |

4. Cargar todas las variables de Render antes de desplegar.
5. Desplegar. Validar `https://<servicio-render>/health` y esperar `{ "ok": true, "service": "vitamate-api" }`.
6. Agregar dominio personalizado `api.vitamate.mx` en Render. Copiar **exactamente** el registro DNS que Render indique; no adivinar el destino CNAME.
7. Esperar HTTPS válido y volver a comprobar `https://api.vitamate.mx/health`.

> Render define `NODE_ENV=production` durante el build y, por ello, pnpm omite las dependencias de desarrollo por defecto. La API necesita `typescript` y `@types/node` para ejecutar su verificación de compilación. El argumento `--prod=false` sólo las instala durante el build; no expone ninguna dependencia al navegador ni modifica las variables de producción del proceso de la API.

## 4. Crear la PWA en Vercel

1. En Vercel, importar el mismo repositorio y crear proyecto **VITAMATE App**.
2. Seleccionar **Root Directory**: `apps/app`.
3. Framework preset: Vite. Mantener output `dist`.
4. Build command: `pnpm build`.
5. Cargar las tres variables de la sección PWA para Production, Preview y Development según corresponda. En Preview puede usarse API staging; no permitir preview público contra API de producción si no está incluido en CORS.
6. Desplegar y comprobar rutas directas `/hoy`, `/nutricion`, `/coach`, `/cuenta` y `/plan-semanal`. El archivo `apps/app/vercel.json` mantiene el fallback SPA para rutas Ionic.
7. Agregar el dominio `app.vitamate.mx` y copiar el registro DNS exacto indicado por Vercel.
8. Cuando HTTPS esté activo, actualizar `APP_ORIGIN` de Render con el dominio definitivo y redeploy de API si cambió.

## 5. Crear sitio comercial en Vercel

1. Importar el repositorio otra vez como proyecto separado **VITAMATE Website**.
2. Seleccionar **Root Directory**: `apps/website`.
3. Framework preset: Next.js.
4. Build command: `pnpm build`.
5. Cargar las variables de la sección Website.
6. Desplegar y validar `/`, `/como-funciona`, `/funciones`, `/precios`, `/fuentes`, `/nosotros`, `/privacidad` y `/terminos`.
7. Agregar `vitamate.mx` y `www.vitamate.mx`; configurar redirección canónica de `www` a `vitamate.mx` en Vercel.
8. Añadir los registros DNS exactos que Vercel muestre para dominio raíz y `www`; esperar certificados HTTPS.

## 6. Supabase y autenticación

1. En Supabase Auth → URL Configuration:
   - Site URL: `https://app.vitamate.mx`
   - Redirect URLs: `https://app.vitamate.mx/**`, y sólo los dominios de desarrollo necesarios.
2. Comprobar que el proveedor Email está activo y que el correo no se confirma sin OTP donde corresponda.
3. Confirmar SMTP Brevo para correo propio de Supabase, si se usa ese flujo.
4. Ejecutar en desarrollo antes de producción si existe alguna migración pendiente:

   ```bash
   pnpm dlx supabase link --project-ref wxezdboreybgxdlivoeo
   pnpm dlx supabase db push
   ```

5. Probar con dos cuentas: cada una puede ver sólo su historial, comidas, memorias, documentos, sesiones y datos de facturación.

## 7. Stripe y Brevo después de tener `api.vitamate.mx`

### Stripe

1. Crear/confirmar producto Premium mensual y anual.
2. Activar Customer Portal.
3. Crear webhook `https://api.vitamate.mx/v1/billing/webhook`.
4. Escuchar: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
5. Pegar el signing secret de ese endpoint en `STRIPE_WEBHOOK_SECRET` de Render y redeploy.
6. Probar alta, prueba de 7 días, cancelación, fallo de pago, renovación, reactivación y denegación de una segunda prueba gratis.
7. Confirmar que una suscripción sólo habilita Premium tras estado/webhook válido.

### Brevo

1. Verificar `noreply@vitamate.mx` y `vitamate.mx`.
2. Publicar SPF, DKIM y DMARC que Brevo solicite.
3. Autorizar la IP de Render si Brevo restringe por IP.
4. Rotar API/SMTP key, actualizar Render y redeploy.
5. Probar registro, OTP, inicio de sesión, recuperación de contraseña y entregabilidad desde un correo externo.

## 8. Revisión final de lanzamiento

No habilitar pagos públicos hasta completar:

- prueba end-to-end real: onboarding, registro, login/recovery, alimento, foto, barcode, entrenamiento, plan/lista, chat, llamada y Stripe;
- matriz de voz/micrófono: iPhone Safari/PWA, Android, iPad y escritorio;
- solución validada en iPhone real para el compositor de VITACOACH;
- RLS, rate limits, logs, alertas y backup/restauración;
- revisión legal mexicana (ARCO, responsable/domicilio, consentimiento y conservación de datos);
- revisión formal de entrenador/fisioterapeuta y nutriólogo;
- cron de importación semanal PROFECO y mensual INPC.

## 9. Rollback

- Vercel: redeploy del deployment anterior desde la consola de cada proyecto.
- Render: redeploy de un commit anterior o rollback desde el historial del servicio.
- Base de datos: nunca ejecutar migraciones destructivas para rollback sin backup probado; crear migración correctiva.
- Stripe: no revocar entitlements manualmente sin revisar evento/subscription de origen.
