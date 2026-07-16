# Configuración de minutos de VITACOACH

El backend ya incluye 30 minutos mensuales por usuario Premium y paquetes acumulables que no caducan. Para habilitar las compras en producción faltan únicamente las configuraciones de las tiendas.

## App Store Connect

Crea cuatro compras dentro de la app de tipo **Consumable** con estos identificadores exactos:

| Producto | Identificador | Precio objetivo en México |
| --- | --- | ---: |
| 5 minutos | `mx.vitamate.voice.5` | $59 MXN |
| 10 minutos | `mx.vitamate.voice.10` | $99 MXN |
| 30 minutos | `mx.vitamate.voice.30` | $249 MXN |
| 60 minutos | `mx.vitamate.voice.60` | $399 MXN |

Completa el nombre, descripción, captura para revisión y traducción en español; selecciona el nivel de precio que corresponda y marca los productos como disponibles para la venta. Agrégalos también al archivo StoreKit Configuration del esquema de Xcode para probarlos en el simulador. El precio que muestre iOS siempre será el precio localizado que devuelva App Store.

## Stripe

No hacen falta Price IDs adicionales: Checkout crea el cargo único con el importe del catálogo firmado por el backend. Conserva activos `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`, y verifica que el webhook de producción incluya `checkout.session.completed`. El endpoint sigue siendo `/v1/billing/webhook`.

## Despliegue y prueba

1. Despliega la API y la PWA desde el commit que contiene la migración `202607160016_voice_credits.sql`.
2. En Xcode ejecuta **Product > Clean Build Folder**, compila otra vez y prueba una compra con un usuario Sandbox.
3. Confirma que una llamada sin intervención del usuario no reste segundos y que la primera frase sí inicie el contador.
4. Compra un paquete, termina una llamada y confirma en Mi cuenta que primero disminuyen los minutos mensuales y después los extra.
5. Prueba una renovación mensual: los 30 minutos del plan deben reponerse y el saldo extra debe conservarse.

Las operaciones son idempotentes: repetir un webhook o la verificación de una misma transacción no duplica minutos.
