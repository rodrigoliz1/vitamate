# Estrategia PWA a Capacitor

## Fase 1: PWA First (MVP)
En esta fase, la meta es lanzar VITAMATE al mercado lo más rápido posible sin sacrificar la calidad ni la capacidad de iteración. 
El MVP será distribuido mediante la Web (`app.vitamate.mx`) configurado con:
- **Service Worker:** Soporte parcial offline y cacheo de assets estáticos.
- **Web App Manifest:** Definición de iconos, pantalla de apertura, nombre corto (`VITAMATE`) y modo `standalone`.
- **Adaptadores Web:**
  - `BrowserCameraProvider` (File input para fotos).
  - `StripeWebBillingProvider` (Stripe Checkout).
  - `WebPushNotificationProvider`.

## Fase 2: Transición Híbrida
El frontend está construido sobre Ionic React, lo cual pre-resuelve problemas de layout seguro (`safe-area-inset`), transiciones de página móviles y teclado virtual nativo.
Cuando se comience el desarrollo para las tiendas:
- Se generará el proyecto nativo usando `npx cap add ios` y `npx cap add android`.
- **Los adaptadores se intercambian por inyección de dependencias**, implementando:
  - `CapacitorCameraProvider`.
  - `StoreKitBillingProvider` / `GooglePlayBillingProvider`.
  - `APNSNotificationProvider`.
  - `AppleSignInProvider`.

## Fase 3: Integraciones Profundas Nativas (iOS/Android)
La meta final es utilizar las bondades exclusivas de los SO móviles.
- **Apple HealthKit / Health Connect:** A través de un módulo nativo construido (o auditado rigurosamente) que solicite acceso explícito y lea/escriba progresos (energía, sueño, etc.).
- **Almacenamiento Seguro:** Pasar tokens de autenticación de `localStorage`/`IndexedDB` a `Keychain`/`Keystore`.
- **Notificaciones Enriquecidas:** Uso de payloads complejos para interactuar desde el Lock Screen.
