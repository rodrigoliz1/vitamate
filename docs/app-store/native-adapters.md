# Adaptadores nativos implementados

VITAMATE conserva una base Ionic React y selecciona capacidades por `Capacitor.getPlatform()`.

| Capacidad | Web/PWA | iOS | Archivo principal |
|---|---|---|---|
| Sesión | Supabase en almacenamiento web | Supabase PKCE y sesión en Keychain | `src/services/supabase.ts` |
| Pagos | Stripe Checkout/Portal | StoreKit y restauración | `src/services/nativeBilling.ts` |
| Cámara | Selector de archivo/capture | Cámara y galería nativas | `src/services/nativeCamera.ts` |
| Código de barras | `BarcodeDetector` y entrada manual | Escáner nativo EAN/UPC | `src/components/BarcodeScanner.tsx` |
| Salud | Registro manual | Apple Health contextual | `src/services/nativeHealth.ts` |
| Ciclo de app | Eventos del navegador | deep link, resume y red | `src/services/nativePlatform.ts` |
| Teclado | Visual Viewport | resize nativo de Capacitor | `capacitor.config.json` y CSS |
| IA | API de VITAMATE | La misma API; ningún secreto en el binario | `src/services/api.ts` |

## Proyecto iOS

- Ruta: `apps/app/ios/App/App.xcodeproj`.
- Bundle ID: `mx.vitamate.app`.
- iOS mínimo: 15.0.
- Dispositivos: iPhone e iPad.
- Icono: 1024×1024 opaco y variantes generadas en `Assets.xcassets`.
- Capacidades: HealthKit y Associated Domains.
- URL scheme para auth: `mx.vitamate://auth/callback`.
- `PrivacyInfo.xcprivacy` está incluido en Resources.

## Reglas de arquitectura

1. Claves de OpenAI, fal.ai, Stripe, Brevo, Supabase service role y Apple nunca entran al frontend.
2. Cualquier compra se verifica en la API antes de conceder Premium.
3. Un plugin nativo debe tener degradación explícita en web o quedar oculto allí.
4. Después de cambiar dependencias o configuración ejecutar `pnpm --filter vitamate-app native:sync:ios`.
5. No editar `ios/App/App/public`; se reemplaza al sincronizar.

## Capacidades instaladas

Capacitor App, Barcode Scanner, Browser, Camera, Haptics, Keyboard, Local Notifications, Network, Preferences, Push Notifications, Splash Screen, Status Bar, almacenamiento seguro, Apple Health y compras nativas. Push/local notifications están instaladas y preparadas, pero la experiencia de recordatorios y el registro APNs del servidor deben validarse antes de solicitarlos al usuario.
