# StoreKit para VITAMATE iOS

## Implementación terminada en código

- iOS usa `@capgo/native-purchases`; web/PWA conserva Stripe.
- Productos esperados:
  - `mx.vitamate.premium.monthly`
  - `mx.vitamate.premium.annual`
- La interfaz toma precio, moneda y oferta introductoria directamente de StoreKit.
- Compra y restauración envían `appAccountToken` con el UUID de Supabase.
- La API verifica el JWS con `@apple/app-store-server-library` y certificados raíz oficiales de Apple.
- La transacción original queda ligada a una sola cuenta VITAMATE.
- Las notificaciones V2 de App Store actualizan el mismo entitlement utilizado por Stripe.
- La tabla de deduplicación vuelve idempotente el webhook de Apple.
- Dentro de iOS no se ofrece Checkout de Stripe para compras nuevas.

## Estado externo pendiente

El propietario debe crear en App Store Connect el grupo **VITAMATE Premium**, ambos productos y, si se desea, la prueba introductoria única de siete días. Los Product ID deben coincidir exactamente con los anteriores.

Configurar la URL de notificaciones:

`https://api.vitamate.mx/v1/billing/apple/notifications`

Variables de la API:

```dotenv
APPLE_BUNDLE_ID=mx.vitamate.app
APPLE_APP_ID=ID_NUMERICO_DE_APP_STORE_CONNECT
APPLE_PRODUCT_MONTHLY=mx.vitamate.premium.monthly
APPLE_PRODUCT_ANNUAL=mx.vitamate.premium.annual
APPLE_ROOT_CERTIFICATES_BASE64=
```

`APPLE_ROOT_CERTIFICATES_BASE64` es opcional: si está vacío, la API obtiene y cachea los certificados desde la PKI oficial de Apple. En una red de producción sin salida a internet, cargar los certificados DER en base64 separados por comas.

## Base de datos

Aplicar `supabase/migrations/202607140012_apple_storekit.sql`. La migración añade proveedor, IDs de Apple, entorno, transacciones y deduplicación de notificaciones sin duplicar el modelo de permisos.

## Matriz de prueba Sandbox/TestFlight

- Compra mensual con prueba disponible.
- Compra anual con prueba disponible.
- Segundo intento en la misma cuenta sin nueva prueba.
- Restaurar compra después de reinstalar.
- Cancelar renovación y conservar acceso hasta el vencimiento.
- Vencimiento, reembolso/revocación y reactivación.
- Notificación duplicada sin duplicar cambios.
- Intento de ligar una compra a otra cuenta VITAMATE rechazado.
- Suscriptor web que inicia sesión en iOS conserva acceso, sin enlaces externos de compra.
