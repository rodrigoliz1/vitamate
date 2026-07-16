# Variables para iOS y App Store

No agregues secretos a `apps/app/.env*`, Xcode, `Info.plist` ni variables `VITE_*`.

## App / Vercel (`apps/app`)

```dotenv
VITE_API_BASE_URL=https://api.vitamate.mx
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLICABLE_O_ANON
```

Estas tres variables quedan en el bundle cliente. La clave publicable de Supabase no es una service role y su seguridad depende de RLS.

## API / Render

Además de las variables normales de VITAMATE, StoreKit requiere:

```dotenv
NODE_ENV=production
TRUST_PROXY=true
APP_ORIGIN=https://app.vitamate.mx
PUBLIC_APP_URL=https://app.vitamate.mx

SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SECRETO_ROTADO

APPLE_BUNDLE_ID=mx.vitamate.app
APPLE_APP_ID=ID_NUMERICO_APP_STORE_CONNECT
APPLE_PRODUCT_MONTHLY=mx.vitamate.premium.monthly
APPLE_PRODUCT_ANNUAL=mx.vitamate.premium.annual
APPLE_ROOT_CERTIFICATES_BASE64=
```

Conservar también OpenAI, fal.ai, Brevo, USDA, Stripe web y las fuentes de precios indicadas en `apps/api/.env.example`. Stripe sigue siendo necesario para clientes web aunque iOS compre con Apple.

## Supabase

En Auth → URL Configuration:

- Site URL: `https://app.vitamate.mx`
- Redirect URLs: `https://app.vitamate.mx/**` y `mx.vitamate://auth/callback`

No usar `SUPABASE_SERVICE_ROLE_KEY` en Vercel frontend ni en el binario.
