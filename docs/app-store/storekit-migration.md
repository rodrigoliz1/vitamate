# StoreKit Migration Plan

## Estado Actual (MVP PWA)
Las suscripciones se manejan exclusivamente mediante **Stripe Checkout** en la web.
- Flujo: Cliente → Backend → Stripe Checkout Session → Pago → Webhook → Entitlements.
- Los permisos se almacenan en la tabla `entitlements` con `source = 'stripe'`.

## Objetivo de la Migración
Cuando la app se publique en la App Store, Apple requiere que las compras in-app (IAP) se realicen mediante StoreKit. La arquitectura de adaptadores (`BillingProvider`) permite esta transición sin modificar la lógica de UI.

## Arquitectura del Adaptador

```typescript
// Implementación web actual
class StripeWebBillingProvider implements BillingProvider {
  async getOfferings(): Promise<BillingOffering[]> { /* Stripe prices */ }
  async purchase(productId: string): Promise<PurchaseResult> { /* Checkout Session */ }
  async restorePurchases(): Promise<RestoreResult> { /* Stripe Customer Portal */ }
  async openManagementPortal(): Promise<void> { /* Stripe Portal */ }
}

// Implementación futura iOS
class StoreKitBillingProvider implements BillingProvider {
  async getOfferings(): Promise<BillingOffering[]> { /* StoreKit 2 products */ }
  async purchase(productId: string): Promise<PurchaseResult> { /* StoreKit 2 purchase */ }
  async restorePurchases(): Promise<RestoreResult> { /* AppStore.sync() */ }
  async openManagementPortal(): Promise<void> { /* Abrir settings de suscripción */ }
}
```

## Plan de Implementación

### Fase 1: Configuración en App Store Connect
1. Crear productos de suscripción:
   - `mx.vitamate.premium.monthly` — VITAMATE Premium Mensual
   - `mx.vitamate.premium.annual` — VITAMATE Premium Anual
2. Configurar grupo de suscripciones.
3. Configurar Server-to-Server Notifications V2.

### Fase 2: Implementación del Plugin Capacitor
1. Implementar o adoptar un plugin de StoreKit 2 para Capacitor.
2. El plugin debe soportar: `getProducts`, `purchase`, `restorePurchases`, `listenForTransactions`.
3. Verificación de recibos en el backend mediante App Store Server API.

### Fase 3: Sincronización de Entitlements
- Cuando un usuario paga por StoreKit, el backend recibe la notificación S2S.
- Se actualiza la tabla `entitlements` con `source = 'apple'`.
- La misma tabla `entitlements` sirve para ambos proveedores.
- Un usuario que migre de web a iOS conserva su suscripción activa hasta que expire y renueva por el canal nativo.

### Fase 4: Pruebas en Sandbox
- Crear cuentas de sandbox en App Store Connect.
- Probar: compra, renovación, cancelación, expiración, restauración.
- Verificar que los webhooks S2S lleguen y se procesen idempotentemente.

## Variables de Entorno Adicionales
```bash
APPLE_SHARED_SECRET=
APPLE_S2S_NOTIFICATION_URL=
APPLE_BUNDLE_ID=mx.vitamate.app
```

## Consideraciones
- Apple cobra 30% (primer año) / 15% (Small Business Program) de comisión.
- Los precios en la App Store se configuran por tier, no por monto exacto.
- El usuario debe poder restaurar compras desde la pantalla de suscripción.
- Mostrar términos de suscripción antes del pago (requerido por Apple).
