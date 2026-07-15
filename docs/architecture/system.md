# Arquitectura General del Sistema (VITAMATE)

## Resumen de la Arquitectura
VITAMATE se construye utilizando una arquitectura de Monorepositorio gestionada por Turborepo y pnpm.
Los diferentes dominios (Web Pública, App, API, Panel de Administración) se manejan en espacios de trabajo independientes (`apps/`) que comparten lógica transversal, de dominio y diseño mediante paquetes (`packages/`).

## Monorepositorio (Turborepo + pnpm)
Estructura:
- `apps/app`: PWA principal (Ionic React + Vite).
- `apps/website`: Sitio web público y landing page (Next.js).
- `apps/api`: Backend principal (Fastify + Node.js).
- `apps/admin`: Panel administrativo (React).
- `packages/*`: Paquetes transversales (UI, Domain, Configs, Design Tokens).

## Infraestructura (Ambientes y Despliegue)
- **Frontend y Website:** Desplegado en Vercel (Edge Network).
- **Backend API:** Desplegado en Render (o infraestructura equivalente Node).
- **Base de Datos:** PostgreSQL administrado por Supabase.
- **Autenticación y Storage:** Supabase Auth y Storage.
- **Gestión de colas/caché:** Redis (usado para rate limiting y background jobs).
- **Ambientes:** Desarrollo, Staging y Producción (totalmente aislados entre sí).

## Capa de Adaptadores (Interfaces Abstraídas)
Para evitar doble desarrollo, la aplicación depende de interfaces como:
- `HealthDataProvider`
- `BillingProvider`
- `NotificationProvider`
- `CameraProvider`
- `SecureStorageProvider`
- `AuthProvider`
- `AIProvider`

Estas se inyectan en tiempo de ejecución, lo que permite intercambiar entre la implementación Web (MVP) y las futuras implementaciones nativas (iOS/Android).

## Flujo de Datos
1. Cliente PWA hace peticiones REST a `/v1/*` de la API de Fastify.
2. La API autentica el JWT a través de Supabase Auth.
3. Las reglas de negocio, motores de nutrición y entrenamiento se evalúan en el backend.
4. Las operaciones intensivas (análisis de imágenes con IA) se envían a colas en Redis para su procesamiento asíncrono.
5. Los Webhooks (Stripe) son la fuente de verdad de las suscripciones.
