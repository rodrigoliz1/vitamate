# Sitio comercial de VITAMATE

Aplicación Next.js independiente de la PWA. Está destinada a `https://vitamate.mx`; el producto autenticado se sirve desde la URL configurada en `NEXT_PUBLIC_APP_URL`.

## Rutas

- `/` — portada comercial;
- `/funciones` — VITACOACH, entrenamiento, nutrición y progreso;
- `/como-funciona` — recorrido de personalización;
- `/precios` — planes mensual y anual;
- `/fuentes` — fuentes y metodología;
- `/nosotros` — misión y principios;
- `/privacidad` — aviso integral en borrador jurídico;
- `/terminos` — condiciones de uso en borrador jurídico.

## Entorno

```dotenv
NEXT_PUBLIC_SITE_URL=https://vitamate.mx
NEXT_PUBLIC_APP_URL=https://app.vitamate.mx
```

Ambas variables son públicas. Nunca coloques secretos en una variable `NEXT_PUBLIC_*`.

## Desarrollo y validación

```bash
corepack pnpm --filter vitamate-website dev
corepack pnpm --filter vitamate-website lint
corepack pnpm --filter vitamate-website typecheck
corepack pnpm --filter vitamate-website build
```

La guía de instalación de iPhone se muestra la primera vez que se pulsa un acceso a la aplicación y después redirige directamente. Para volver a probarla, utiliza un perfil de navegador de prueba limpio.

Antes de producción deben completarse los datos corporativos y someterse Privacidad y Términos a revisión jurídica en México.
