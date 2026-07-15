# ADR-005: Estrategia de Proveedor de IA (Adapter Pattern)

## Estado
Aceptado

## Contexto
VITAMATE utiliza modelos de Inteligencia Artificial en múltiples funcionalidades:
1. **Coach IA (Chat):** Conversación en tiempo real con streaming (SSE).
2. **Visión de Alimentos:** Análisis de fotografías de comida para estimar nutrientes.
3. **Generación de Planes:** Creación de planes de nutrición y entrenamiento personalizados.
4. **Resúmenes y Memoria:** Compresión de conversaciones y extracción de datos estructurados.
5. **Clasificación de Seguridad:** Detección de mensajes que requieran derivación médica.

El mercado de LLMs cambia radicalmente cada 3–6 meses:
- Los modelos mejoran y se abaratan constantemente.
- Un proveedor puede cambiar pricing, deprecar modelos, o sufrir outages.
- Cada caso de uso tiene un ratio costo/calidad diferente (el chat necesita el mejor modelo; la clasificación de seguridad puede usar uno más barato).

**No es viable** acoplarse a un solo proveedor.

### Alternativas evaluadas

| Estrategia | Descripción | Riesgo |
|---|---|---|
| Solo OpenAI | Usar GPT-4o para todo | Alto vendor lock-in, un outage paraliza todo |
| Solo Anthropic | Usar Claude para todo | Alto vendor lock-in |
| Multi-provider directo | Llamar a cada SDK directamente | Código duplicado, difícil de mantener |
| **Adapter Pattern** | **Interfaz abstracta + implementaciones intercambiables** | **Bajo riesgo, máxima flexibilidad** |
| AI Gateway (LiteLLM/Portkey) | Proxy unificado entre la app y los LLMs | Dependencia de un servicio más, latencia adicional |

## Decisión
Se ha decidido implementar un **Adapter Pattern (patrón de adaptador)** para la capa de IA, definiendo una interfaz TypeScript abstracta (`AIProvider`) con implementaciones concretas por proveedor.

### Interfaz Base

```typescript
// packages/domain/src/ai/ai-provider.ts

export interface AICompletionParams {
  model: string;
  systemPrompt: string;
  messages: AIMessage[];
  temperature?: number;       // 0.0 – 2.0
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  tools?: AITool[];           // Function calling
}

export interface AIStreamParams extends AICompletionParams {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string, usage: AIUsage) => void;
  onError: (error: AIProviderError) => void;
}

export interface AIVisionParams {
  model: string;
  systemPrompt: string;
  imageUrl: string;           // URL firmada de Supabase Storage
  userMessage?: string;
  responseFormat: 'json';
  maxTokens?: number;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AIProvider {
  readonly name: string;      // 'openai' | 'anthropic' | 'google' | ...
  
  complete(params: AICompletionParams): Promise<AICompletionResult>;
  stream(params: AIStreamParams): Promise<void>;
  vision(params: AIVisionParams): Promise<AIVisionResult>;
  
  // Healthcheck para circuit breaker
  ping(): Promise<boolean>;
}
```

### Implementaciones Concretas

```typescript
// apps/api/src/adapters/ai/openai-provider.ts
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  // Usa el SDK oficial de OpenAI
}

// apps/api/src/adapters/ai/anthropic-provider.ts
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  // Usa el SDK oficial de Anthropic
}

// apps/api/src/adapters/ai/google-provider.ts
export class GoogleAIProvider implements AIProvider {
  readonly name = 'google';
  // Usa Gemini API
}
```

### Router de Modelos

No todos los casos de uso necesitan el mismo modelo. Se implementa un router que asigna el proveedor y modelo óptimo por tarea:

```typescript
// apps/api/src/adapters/ai/model-router.ts

export interface ModelAssignment {
  provider: AIProvider;
  model: string;
  fallback?: ModelAssignment;    // Proveedor de respaldo
  maxRetries: number;
  timeoutMs: number;
}

export const MODEL_ROUTER: Record<AITask, ModelAssignment> = {
  'coach-chat': {
    provider: anthropicProvider,
    model: 'claude-sonnet-4-20250514',
    fallback: { provider: openaiProvider, model: 'gpt-4o', ... },
    maxRetries: 2,
    timeoutMs: 30_000,
  },
  'food-vision': {
    provider: openaiProvider,
    model: 'gpt-4o',
    fallback: { provider: googleProvider, model: 'gemini-2.5-flash', ... },
    maxRetries: 1,
    timeoutMs: 15_000,
  },
  'nutrition-plan': {
    provider: anthropicProvider,
    model: 'claude-sonnet-4-20250514',
    fallback: { provider: openaiProvider, model: 'gpt-4o', ... },
    maxRetries: 2,
    timeoutMs: 60_000,
  },
  'workout-plan': {
    provider: anthropicProvider,
    model: 'claude-sonnet-4-20250514',
    fallback: null,
    maxRetries: 2,
    timeoutMs: 60_000,
  },
  'conversation-summary': {
    provider: openaiProvider,
    model: 'gpt-4o-mini',
    fallback: { provider: googleProvider, model: 'gemini-2.5-flash', ... },
    maxRetries: 1,
    timeoutMs: 10_000,
  },
  'safety-classification': {
    provider: openaiProvider,
    model: 'gpt-4o-mini',
    fallback: { provider: anthropicProvider, model: 'claude-haiku', ... },
    maxRetries: 1,
    timeoutMs: 5_000,
  },
  'weekly-review': {
    provider: anthropicProvider,
    model: 'claude-sonnet-4-20250514',
    fallback: { provider: openaiProvider, model: 'gpt-4o', ... },
    maxRetries: 2,
    timeoutMs: 45_000,
  },
};
```

> **Nota:** Los modelos y proveedores asignados son la configuración inicial y se ajustarán según benchmarks de calidad, costo y latencia en producción.

### Registro de Auditoría (ai_runs)

Cada llamada a un proveedor de IA se registra en la tabla `ai_runs`:

```text
ai_runs
├── id (UUID)
├── user_id (FK)
├── task (enum: coach-chat, food-vision, ...)
├── provider (string: openai, anthropic, google)
├── model (string)
├── prompt_tokens (int)
├── completion_tokens (int)
├── total_tokens (int)
├── estimated_cost_usd (decimal)
├── latency_ms (int)
├── status (enum: success, error, timeout, fallback_used)
├── error_message (text, nullable)
├── fallback_provider (string, nullable)
└── created_at (timestamp)
```

Esto permite:
- **Análisis de costos:** Dashboard de gasto por tarea, por usuario, por día.
- **Optimización:** Identificar qué tareas pueden migrar a modelos más baratos.
- **Detección de abuso:** Usuarios que consumen tokens anómalamente.
- **SLA interno:** Monitorear latencia y tasa de errores por proveedor.

### Circuit Breaker

Si un proveedor falla consecutivamente, se activa el fallback automáticamente:

```text
Flujo de Circuit Breaker:
1. Intento con proveedor principal → Falla
2. Retry (hasta maxRetries) → Falla
3. Activar fallback provider → Éxito
4. Registrar en ai_runs: status='fallback_used', fallback_provider='openai'
5. Después de N minutos, re-intentar con proveedor principal (half-open)
```

## Reglas de Seguridad para IA

1. **Sanitización de contexto:** Antes de enviar datos al LLM, se eliminan: email, nombre completo, IDs de base de datos, tokens, y cualquier PII no necesaria.
2. **Sin ejecución directa:** El LLM NUNCA ejecuta SQL, NUNCA llama endpoints de escritura, NUNCA modifica datos. Solo sugiere acciones que requieren confirmación del usuario.
3. **Rate limiting por plan:**
   - Free trial: 20 mensajes/día, 3 fotos/día.
   - Premium: 100 mensajes/día, 15 fotos/día.
4. **Tokens máximos:** Cada tarea tiene un `maxTokens` configurado para evitar Denial of Wallet.

## Consecuencias

### Positivas
- **Sin vendor lock-in:** Se puede cambiar de proveedor en minutos modificando la configuración del router.
- **Optimización de costos:** Cada tarea usa el modelo más cost-effective para su complejidad.
- **Resiliencia:** Un outage de OpenAI no paraliza la aplicación; el fallback a Anthropic (o viceversa) es automático.
- **Observabilidad:** `ai_runs` permite tomar decisiones basadas en datos reales de costo, latencia y calidad.
- **Testing:** Se puede crear un `MockAIProvider` que devuelve respuestas predefinidas para tests.

### Negativas
- **Complejidad inicial:** Implementar el adapter, router y circuit breaker requiere más código que usar un solo SDK.
- **Diferencias de APIs:** Cada proveedor tiene peculiaridades (formato de herramientas, streaming protocol, vision API). El adapter debe normalizar estas diferencias.
- **Consistencia de respuestas:** Diferentes modelos pueden generar respuestas con distinto estilo o calidad. Los system prompts deben ser robustos para producir resultados consistentes independientemente del modelo.

## Referencias
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic API Reference](https://docs.anthropic.com/en/api)
- [Google Gemini API](https://ai.google.dev/docs)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
