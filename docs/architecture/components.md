# Diagrama Textual de Componentes

## Ecosistema VITAMATE

```text
+-------------------------------------------------------------+
|                        Monorepositorio                        |
|                                                             |
|  +--------------------+   +-----------------------------+   |
|  |    apps/website    |   |         apps/app            |   |
|  |     (Next.js)      |   | (Ionic React + Capacitor)   |   |
|  +---------+----------+   +--------------+--------------+   |
|            |                             |                  |
|            +-------------+---------------+                  |
|                          |                                  |
|                          v                                  |
|               +----------------------+                      |
|               |       apps/api       |                      |
|               |  (Fastify + Node.js) |                      |
|               +----------+-----------+                      |
|                          |                                  |
|      +-------------------+-------------------+              |
|      |                   |                   |              |
|      v                   v                   v              |
| +----------+      +-------------+     +---------------+     |
| | Supabase |      |  AI Engine  |     |   Redis (MQ)  |     |
| | (PostgreSQL/    | (LLMs,      |     | (Background   |     |
| |  Auth/Sto)      |  Vision)    |     |  jobs)        |     |
| +----------+      +-------------+     +---------------+     |
|                                                             |
|  +-------------------------------------------------------+  |
|  |                     packages/*                        |  |
|  | (ui, design-tokens, schemas, domain, api-client)      |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

## Componentes Internos de apps/api

- **Controllers (REST):** Manejan las rutas `/v1/*`.
- **Services (Business Logic):** `NutritionEngine`, `TrainingEngine`, `AICoachManager`.
- **Adapters:** `StripeWebhookAdapter`, `AIProviderAdapter`.
- **Middlewares:** Rate Limiter, Auth Guard, Request Validator (Zod).

## Componentes Internos de apps/app

- **Pages:** Hoy, Nutrición, Entrenar, Coach, Progreso.
- **State:** Zustand para estado local/UI, TanStack Query para caché del servidor.
- **Platform Adapters:** Proyección de hardware/SO a la lógica de UI.
