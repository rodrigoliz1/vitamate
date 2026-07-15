# Variables de Entorno y Secretos

## Entorno: `apps/api` (Backend)

```bash
# Servidor
PORT=3001
NODE_ENV=development

# Base de Datos
DATABASE_URL=postgresql://user:pass@localhost:5432/vitamate
DIRECT_URL=postgresql://user:pass@localhost:5432/vitamate

# Supabase (Admin)
SUPABASE_URL=https://xyzcompany.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...

# Redis
REDIS_URL=redis://localhost:6379

# Pagos (Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_monthly
STRIPE_PRICE_ANNUAL=price_annual
PUBLIC_APP_URL=https://app.vitamate.mx

# Inteligencia Artificial
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_VISION_MODEL=gpt-4.1-mini
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_REALTIME_VOICE=marin

# Fuentes oficiales de precios (sólo backend)
PROFECO_QQP_SOURCE_URL=https://...csv
PROFECO_CSV_PATH=/ruta/opcional/qqp.csv
INEGI_INPC_SOURCE=calculator
INEGI_INPC_INDICATOR_ID=865541
INEGI_INPC_CALCULATOR_URL=https://www.inegi.org.mx/app/indicesdeprecios/CalculadoraInflacion.aspx
INEGI_INPC_CONFIG_URL=https://www.inegi.org.mx/componentes/biinegi/config.min.js?v1.0.5
INEGI_INPC_DATA_BASE_URL=https://www.inegi.org.mx/app/api/indicadores/interna_v1_3
# Opcional; sólo si INEGI_INPC_SOURCE=indicator_api.
INEGI_API_TOKEN=
```

## Entorno: `apps/app` (PWA / Ionic)

```bash
# URLs Públicas
VITE_API_BASE_URL=http://localhost:3001
VITE_WEBSITE_URL=http://localhost:3000

# Supabase (Público)
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Entorno: `apps/website` (Next.js)

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000 # Sitio comercial
NEXT_PUBLIC_APP_URL=http://localhost:5173 # Hacia la PWA; producción: https://app.vitamate.mx
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Reglas de Secretos
- NUNCA agregar `.env` a git.
- Usar `.env.example` en repositorios.
- Las claves que comienzan con `VITE_` o `NEXT_PUBLIC_` serán expuestas al navegador, **NO** incluir claves secretas aquí.
