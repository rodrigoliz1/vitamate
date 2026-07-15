# Native Adapters Documentation

## Resumen
VITAMATE utiliza un patrón de adaptadores para abstraer las funcionalidades específicas de cada plataforma. Esto permite que la lógica de negocio y los componentes UI sean agnósticos a la plataforma, facilitando la transición de PWA a aplicaciones nativas.

## Interfaces y sus Implementaciones

### AuthProvider
| Método | Descripción |
|--------|-------------|
| `signIn(credentials)` | Autenticar usuario |
| `signOut()` | Cerrar sesión |
| `refreshSession()` | Renovar token |
| `getSession()` | Obtener sesión actual |

| Implementación | Plataforma | Notas |
|---------------|-----------|-------|
| `SupabaseAuthProvider` | Web / PWA | Supabase Auth con email + Google |
| `AppleSignInProvider` | iOS | Sign in with Apple + vinculación con Supabase |

---

### BillingProvider
| Método | Descripción |
|--------|-------------|
| `getOfferings()` | Listar productos disponibles |
| `purchase(productId)` | Iniciar compra |
| `restorePurchases()` | Restaurar compras previas |
| `openManagementPortal()` | Gestionar suscripción |

| Implementación | Plataforma | Notas |
|---------------|-----------|-------|
| `StripeWebBillingProvider` | Web / PWA | Stripe Checkout + Customer Portal |
| `StoreKitBillingProvider` | iOS | StoreKit 2, verificación S2S |
| `GooglePlayBillingProvider` | Android | Google Play Billing Library |

---

### CameraProvider
| Método | Descripción |
|--------|-------------|
| `capturePhoto(options?)` | Tomar foto con cámara |
| `selectFromLibrary(options?)` | Seleccionar desde galería |

| Implementación | Plataforma | Notas |
|---------------|-----------|-------|
| `BrowserCameraProvider` | Web / PWA | `<input type="file" capture>` |
| `CapacitorCameraProvider` | iOS / Android | `@capacitor/camera` nativo |

---

### NotificationProvider
| Método | Descripción |
|--------|-------------|
| `requestPermission()` | Solicitar permiso |
| `register()` | Registrar dispositivo |
| `scheduleLocal?(notification)` | Programar notificación local |

| Implementación | Plataforma | Notas |
|---------------|-----------|-------|
| `WebPushNotificationProvider` | Web / PWA | Web Push API |
| `APNSNotificationProvider` | iOS | Apple Push Notification service |
| `FirebasePushProvider` | Android | Firebase Cloud Messaging |

---

### SecureStorageProvider
| Método | Descripción |
|--------|-------------|
| `get(key)` | Leer valor |
| `set(key, value)` | Guardar valor |
| `remove(key)` | Eliminar valor |
| `clear()` | Limpiar todo |

| Implementación | Plataforma | Notas |
|---------------|-----------|-------|
| `WebSecureStorageProvider` | Web / PWA | `localStorage` (limitado) |
| `IOSSecureStorageProvider` | iOS | Keychain |
| `AndroidSecureStorageProvider` | Android | EncryptedSharedPreferences |

---

### HealthDataProvider
| Método | Descripción |
|--------|-------------|
| `isAvailable()` | ¿Disponible en este dispositivo? |
| `requestPermissions(types)` | Solicitar permisos granulares |
| `getDailyActivity(date)` | Actividad del día |
| `getMeasurements(range)` | Mediciones en rango |
| `getWorkouts(range)` | Entrenamientos externos |
| `saveWorkout?(workout)` | Guardar entrenamiento (opcional) |

| Implementación | Plataforma | Notas |
|---------------|-----------|-------|
| `ManualHealthDataProvider` | Web / PWA | Entrada manual de datos |
| `AppleHealthKitProvider` | iOS | HealthKit nativo |
| `HealthConnectProvider` | Android | Health Connect API |

---

### AIProvider
| Método | Descripción |
|--------|-------------|
| `generateCoachResponse(input)` | Respuesta del coach |
| `analyzeFoodImage(input)` | Análisis de foto de comida |
| `generateNutritionPlan(input)` | Generar plan nutricional |
| `generateWorkoutPlan(input)` | Generar plan de entrenamiento |

| Implementación | Plataforma | Notas |
|---------------|-----------|-------|
| `OpenAIProvider` | Todas | Adaptador para OpenAI API |
| `AnthropicProvider` | Todas | Adaptador futuro |

> **Nota:** `AIProvider` se ejecuta en el **backend**, no en el cliente. Las implementaciones son del lado del servidor exclusivamente.

## Selección de Adaptador

La selección se realiza mediante detección de plataforma en tiempo de ejecución:

```typescript
import { Capacitor } from '@capacitor/core';

function createBillingProvider(): BillingProvider {
  const platform = Capacitor.getPlatform();
  
  switch (platform) {
    case 'ios':
      return new StoreKitBillingProvider();
    case 'android':
      return new GooglePlayBillingProvider();
    default:
      return new StripeWebBillingProvider();
  }
}
```

Los adaptadores se registran centralmente y se inyectan a los componentes mediante React Context, evitando que la UI importe directamente SDKs nativos.
