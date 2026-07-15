# ADR-003: Adopción de Fastify como Framework Backend

## Estado
Aceptado

## Contexto
VITAMATE requiere un framework HTTP para Node.js que sirva como la capa de API principal (`apps/api`). Los requisitos son:
1. **Alto rendimiento:** El streaming de respuestas del Coach IA via SSE exige un framework con bajo overhead.
2. **Validación de esquemas nativa:** Para evitar capas adicionales de validación manual.
3. **Generación automática de OpenAPI:** La documentación de la API debe generarse desde los esquemas, no mantenerse manualmente.
4. **Soporte de plugins:** Autenticación, rate limiting, CORS, y hooks deben integrarse sin middleware spaghetti.
5. **TypeScript first:** Tipado extremo sin sacrificar ergonomía.

### Alternativas evaluadas

| Criterio | Fastify | Express | NestJS | Hono |
|---|---|---|---|---|
| Rendimiento (req/s) | ~77K | ~15K | ~15K (Express bajo) | ~80K+ |
| Validación de esquemas | ✅ JSON Schema / Zod | ❌ Manual | ✅ Class-validator | ⚠️ Zod adapter |
| OpenAPI automático | ✅ `@fastify/swagger` | ❌ Swagger manual | ✅ Decoradores | ⚠️ Parcial |
| Plugin ecosystem | ✅ Maduro (200+) | ✅ Maduro (middleware) | ✅ Módulos | ⚠️ En crecimiento |
| SSE / Streaming | ✅ Nativo | ⚠️ Con hacks | ⚠️ Con adapters | ✅ Nativo |
| Curva de aprendizaje | Media | Baja | Alta (decoradores, DI) | Baja |
| Madurez / Producción | ✅ 8+ años, OWASP | ✅ 13+ años | ✅ 7+ años | ⚠️ 3 años |
| Encapsulación | ✅ Plugin scoping | ❌ Global | ✅ Módulos | ❌ |

## Decisión
Se ha decidido adoptar **Fastify v5** como framework HTTP principal para la API de VITAMATE.

### Justificación detallada

#### Rendimiento
Fastify es uno de los frameworks Node.js más rápidos gracias a su compilación de esquemas y serialización optimizada. Con ~77K req/s en benchmarks estándar, supera a Express por 5x. Esto es crítico para:
- Endpoints de alta frecuencia (polling del dashboard, logs de comidas).
- Streaming de SSE para respuestas del Coach IA.
- Procesamiento eficiente de webhooks de Stripe con respuestas rápidas (< 200ms para evitar reintentos).

#### Validación con Zod + Type Provider
Fastify soporta `@fastify/type-provider-zod`, lo que permite:
```typescript
// El esquema Zod define validación, tipos TypeScript y documentación OpenAPI simultáneamente
const createMealEntrySchema = {
  body: z.object({
    food_id: z.string().uuid(),
    quantity_g: z.number().positive().max(5000),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  }),
  response: { 201: MealEntryResponseSchema },
};
```
Un solo esquema produce: validación en runtime, tipos en compilación, y documentación OpenAPI.

#### Sistema de Plugins
El sistema de plugins de Fastify permite encapsulación por scope:
```typescript
// Cada dominio registra sus rutas, hooks y decoradores en su propio scope
fastify.register(nutritionRoutes, { prefix: '/v1/nutrition' });
fastify.register(trainingRoutes, { prefix: '/v1/training' });
fastify.register(coachRoutes, { prefix: '/v1/coach' });
fastify.register(billingRoutes, { prefix: '/v1/billing' });
```
Esto evita la contaminación global de middleware y permite testing aislado por módulo.

#### Hooks y Lifecycle
Fastify ofrece hooks granulares (`onRequest`, `preParsing`, `preValidation`, `preHandler`, `onSend`, `onResponse`) que permiten:
- **Auth Guard:** Validar JWT en `onRequest` antes de que se parsee el body.
- **Rate Limiting:** Aplicar límites en `preHandler` basados en plan de suscripción.
- **Logging estructurado:** Pino integrado (JSON logs) para observabilidad en producción.

#### OpenAPI Automático
Con `@fastify/swagger` + `@fastify/swagger-ui`:
- La documentación se genera automáticamente desde los esquemas Zod registrados.
- Disponible en `/docs` en desarrollo.
- Se puede exportar como JSON para generar clientes tipados (`openapi-typescript`).

## Arquitectura del Backend con Fastify

```text
apps/api/
├── src/
│   ├── server.ts              # Bootstrap, registro de plugins globales
│   ├── plugins/
│   │   ├── auth.ts            # JWT validation via JWKS
│   │   ├── rate-limit.ts      # Rate limiting por usuario/plan
│   │   ├── error-handler.ts   # Manejo global de errores estructurados
│   │   └── swagger.ts         # Configuración OpenAPI
│   ├── modules/
│   │   ├── nutrition/
│   │   │   ├── routes.ts      # Endpoints REST
│   │   │   ├── service.ts     # NutritionEngine (lógica de negocio)
│   │   │   └── schemas.ts     # Zod schemas
│   │   ├── training/
│   │   ├── coach/
│   │   ├── billing/
│   │   └── users/
│   ├── adapters/              # Implementaciones de interfaces externas
│   │   ├── ai/
│   │   ├── storage/
│   │   └── payments/
│   └── lib/                   # Utilidades compartidas
└── tests/
```

## Consecuencias

### Positivas
- **Performance probado:** Fastify es usado en producción por empresas como Microsoft, Platformatic, y Clinic.js.
- **DX excepcional:** Autocompletado completo en rutas, esquemas y hooks gracias a TypeScript.
- **Logging de producción:** Pino (integrado) produce JSON logs de alta velocidad, listos para ingestión en herramientas de observabilidad.
- **Compatibilidad con el ecosistema:** `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/multipart` cubren todos los casos de uso.
- **Testing fácil:** `fastify.inject()` permite tests de integración sin levantar un servidor HTTP real.

### Negativas
- **Menor comunidad que Express:** Aunque madura, la comunidad es más pequeña. La mayoría de tutoriales de Node.js asumen Express.
- **Serialización estricta:** Fastify serializa las respuestas usando el schema de respuesta. Si no se define, puede omitir campos. Se debe ser explícito en los schemas de `response`.
- **Migración futura:** Si se decide migrar a otro runtime (Bun, Deno), Fastify no es portable. Mitigación: la lógica de negocio vive en los services, no en los controllers de Fastify.

## Referencias
- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Fastify Benchmarks](https://fastify.dev/benchmarks/)
- [Zod Type Provider](https://github.com/turkerdev/fastify-type-provider-zod)
