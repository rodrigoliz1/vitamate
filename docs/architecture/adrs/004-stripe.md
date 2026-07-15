# ADR-004: Adopción de Stripe para Pagos y Suscripciones

## Estado
Aceptado

## Contexto
VITAMATE es un negocio de suscripciones con los siguientes requerimientos de monetización:
1. **Suscripciones recurrentes:** Plan mensual y anual con precios en MXN.
2. **Período de prueba gratuito:** 7 días sin cobro.
3. **Portal de autogestión:** El usuario debe poder cambiar de plan, actualizar método de pago y cancelar sin contactar soporte.
4. **Webhooks confiables:** La fuente de verdad del estado de la suscripción debe vivir en el backend, no en el cliente.
5. **Cumplimiento fiscal México:** Soporte para facturación y compliance con regulaciones mexicanas.
6. **Migración futura a StoreKit/Google Play Billing:** Cuando se lance en App Store y Google Play, se debe poder coexistir con pagos nativos.

### Alternativas evaluadas

| Criterio | Stripe | Paddle | Lemonsqueezy | RevenueCat |
|---|---|---|---|---|
| Merchant of Record | ❌ (tú facturas) | ✅ (ellos facturan) | ✅ | ❌ |
| Suscripciones | ✅ Nativo | ✅ Nativo | ✅ Nativo | ✅ (wrapper) |
| Webhooks robustos | ✅ 100+ eventos | ✅ | ⚠️ Limitados | ✅ |
| API / SDK calidad | ✅ Best-in-class | ✅ Buena | ⚠️ En desarrollo | ✅ Buena |
| Soporte México (MXN) | ✅ | ⚠️ Limitado | ⚠️ Limitado | ✅ (via Stripe) |
| Customer Portal | ✅ Hosted | ✅ Hosted | ⚠️ Básico | ❌ |
| Comisión | 3.6% + $3 MXN | 5% + $0.50 | 5% | Desde $0/mes + Stripe fees |
| Multi-plataforma (Web + App) | ✅ Web nativo | ✅ Web nativo | ✅ Web nativo | ✅ Especializado |

## Decisión
Se ha decidido adoptar **Stripe** como plataforma de pagos para la fase web (PWA) de VITAMATE.

### Justificación detallada

#### API Best-in-Class
Stripe tiene la API de pagos más documentada y mejor diseñada de la industria:
- SDK oficial para Node.js con tipos TypeScript completos.
- Idempotency keys nativos (crítico para webhooks y operaciones retry-safe).
- Eventos granulares (100+ tipos de webhook) para reaccionar a cada cambio de estado.

#### Stripe Checkout + Customer Portal
Para el MVP, se usa **Stripe Checkout** (hosted):
```text
Flujo de Suscripción:
1. Usuario hace clic en "Suscribirse" → Frontend redirige a Stripe Checkout.
2. Stripe procesa el pago → Envía webhook `checkout.session.completed`.
3. Backend recibe webhook → Crea/actualiza registros en `billing_customers`, `subscriptions`, `entitlements`.
4. Frontend consulta `/v1/billing/entitlements` → Desbloquea funcionalidades premium.
```

Stripe Customer Portal permite al usuario autogestionar:
- Cambiar plan (upgrade/downgrade).
- Actualizar tarjeta de crédito/débito.
- Ver historial de facturas.
- Cancelar suscripción.

#### Webhooks como Fuente de Verdad
**Regla fundamental:** El backend NUNCA confía en el cliente para determinar el estado de la suscripción. Solo los webhooks de Stripe actualizan las tablas de billing:

```text
Webhooks procesados:
├── checkout.session.completed     → Crear suscripción y entitlements
├── customer.subscription.updated  → Actualizar plan, período, estado
├── customer.subscription.deleted  → Revocar entitlements
├── invoice.payment_succeeded      → Registrar pago exitoso
├── invoice.payment_failed         → Marcar suscripción en riesgo
└── customer.subscription.trial_will_end → Notificar fin de trial
```

Cada webhook se procesa idempotentemente usando el `event.id` de Stripe para evitar duplicados.

#### Modelo de Datos de Billing

```text
billing_customers
├── id (UUID)
├── user_id (FK → profiles)
├── stripe_customer_id (string, único)
├── email
└── created_at

subscriptions
├── id (UUID)
├── billing_customer_id (FK)
├── stripe_subscription_id (string, único)
├── plan_id (enum: 'monthly', 'annual')
├── status (enum: 'trialing', 'active', 'past_due', 'canceled', 'unpaid')
├── current_period_start
├── current_period_end
├── cancel_at_period_end (boolean)
└── metadata (JSONB)

entitlements
├── id (UUID)
├── user_id (FK)
├── feature (enum: 'ai_coach', 'food_vision', 'advanced_analytics', ...)
├── granted_at
├── expires_at
└── source (enum: 'stripe', 'storekit', 'admin_override')

billing_events
├── id (UUID)
├── stripe_event_id (string, único — idempotency)
├── event_type (string)
├── payload (JSONB)
├── processed_at
└── error (text, nullable)
```

#### Soporte para México
Stripe opera en México con:
- Precios en MXN.
- Soporte para tarjetas de débito y crédito mexicanas.
- OXXO Pay (pago en efectivo en tiendas OXXO) — evaluación futura.

## Planes de Suscripción

| Plan | Precio MXN | Período | Trial | Incluye |
|---|---|---|---|---|
| Mensual | $149/mes | Mensual | 7 días | Acceso completo |
| Anual | $999/año (~$83/mes) | Anual | 7 días | Acceso completo |

> **Nota:** Los precios son iniciales y pueden ajustarse antes del lanzamiento.

## Estrategia de Coexistencia con App Stores
Cuando VITAMATE se publique en App Store y Google Play:
1. **Web:** Stripe sigue siendo el procesador de pagos (sin comisión de Apple/Google).
2. **iOS:** StoreKit 2 será requerido por Apple para compras in-app.
3. **Android:** Google Play Billing será requerido para compras in-app.
4. La tabla `entitlements` está diseñada con la columna `source` para soportar múltiples orígenes de pago.

## Consecuencias

### Positivas
- **Confiabilidad:** Stripe procesa millones de transacciones diarias. SLA de 99.99%+.
- **Developer Experience:** API y documentación ejemplares. Testing con `stripe listen --forward-to` en desarrollo.
- **Escalabilidad:** Desde 0 hasta millones de suscriptores sin cambios de arquitectura.
- **Compliance:** Stripe maneja PCI DSS. VITAMATE nunca toca datos de tarjetas.
- **Flexibilidad de precios:** Coupons, trials, prorations, y entitlements granulares.

### Negativas
- **Comisión:** 3.6% + $3 MXN por transacción. En una suscripción de $149 MXN, ~$8.36 MXN van a Stripe (~5.6%).
- **No es Merchant of Record:** VITAMATE es responsable de la facturación fiscal en México (RFC, CFDI). Se debe integrar con un servicio de facturación mexicano (ej. Facturapi).
- **Complejidad de webhooks:** El manejo correcto de todos los edge cases (payment_failed → retry → succeeded) requiere testing exhaustivo.
- **Doble sistema de billing:** Al agregar StoreKit/Google Play, se duplica la complejidad del sistema de entitlements.

## Referencias
- [Stripe Subscriptions Guide](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Webhooks Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Stripe México](https://stripe.com/mx)
