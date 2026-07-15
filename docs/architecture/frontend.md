# Arquitectura Frontend

## Stack Tecnológico Principal
- **Framework Core:** React 18+.
- **Mobile UI / Layout:** Ionic React (utilizado por su robustez en gestos y animaciones nativas).
- **Bundler:** Vite.
- **Lenguaje:** TypeScript estricto.
- **Routing:** React Router.
- **Data Fetching:** TanStack Query.
- **State Management:** Zustand (estado local, solo cuando sea estrictamente necesario).
- **Formularios:** React Hook Form + Zod (validación estricta).
- **PWA:** Vite PWA Plugin.
- **Gráficos:** Librería ligera (por ejemplo Recharts o Chart.js) accesible.
- **Estilos:** Vanilla CSS con CSS variables controladas desde `packages/design-tokens`. (Evitar Tailwind a menos que se re-evalue).

## Diseño Visual y Experiencia
- **Paleta de Colores:** Premium, energética (Vita Green, Lime Accent, Deep Forest, Warm White, Surface, etc).
- **Responsive:** Mobile first (iPhone/Android) respetando `safe-area-inset`. Soporte para escritorio/iPad en formato adaptado.
- **Microinteracciones:** Animaciones CSS fluidas que mejoran la experiencia sin sobrecargar el DOM.
- **Accesibilidad:** Soporte para tamaños de texto ampliados, alto contraste y `prefers-reduced-motion`.

## Arquitectura de Carpetas en `apps/app`
- `src/pages/`: Vistas completas a nivel de ruta (Hoy, Nutrición, Entrenar, Coach, Progreso).
- `src/features/`: Módulos agnósticos a la ruta (ej. `features/coach`, `features/nutrition`).
- `src/core/`: Adaptadores de plataforma, utilidades globales, hooks transversales.
- `src/components/`: Componentes específicos de la aplicación (la mayoría viene de `packages/ui`).

## Operación Offline
- **Estrategia Outbox:** Utilizando IndexedDB, las mutaciones offline se guardan con UUID, Payload validado y estado de sincronización.
- **Reconexión:** Al recuperar conexión, se validan sesiones y se envían operaciones asíncronamente con resolución de conflictos básica (el último gana o merge inteligente por dominio).
- **Caché Limitada:** Los datos sensibles solo se guardan lo necesario; la caché privada se limpia al cerrar sesión.
