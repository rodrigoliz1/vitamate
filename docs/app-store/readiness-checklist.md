# Checklist de Preparación para App Store — VITAMATE

> **Última actualización:** 2026-07-12  
> **Estado:** 🟡 En preparación  
> **Fase actual:** 0 (Documentación y Arquitectura)

---

## Resumen
Este documento es el checklist maestro de todos los requisitos que VITAMATE debe cumplir antes de enviarse para revisión en el Apple App Store y Google Play Store. Se divide en categorías técnicas, legales, de contenido y de negocio.

---

## 1. Requisitos Técnicos de Apple App Store

### 1.1 Compilación y Distribución
- [ ] Proyecto Xcode generado via `npx cap add ios` y configurado.
- [ ] Bundle ID registrado en Apple Developer: `mx.vitamate.app`.
- [ ] Certificados de distribución (Distribution Certificate) creados.
- [ ] Provisioning Profile de distribución (App Store) generado.
- [ ] App firmada con el perfil de distribución correcto.
- [ ] Build subido a App Store Connect via Xcode o `xcrun altool`.
- [ ] TestFlight configurado para testing interno (equipo) y externo (beta testers).
- [ ] Versión mínima de iOS definida: iOS 16.0+.
- [ ] Architecturas: arm64 (dispositivos reales), x86_64 eliminado del build de producción.

### 1.2 Capacitor / Webview
- [ ] WKWebView configurado correctamente (NO UIWebView — deprecado y rechazado).
- [ ] Content Security Policy (CSP) configurado en el webview.
- [ ] Deep links / Universal Links configurados (archivo `apple-app-site-association` en `vitamate.mx`).
- [ ] Capacitor plugins auditados: solo los necesarios, sin plugins abandonados.
- [ ] Splash screen y launch storyboard configurados (no imágenes estáticas).

### 1.3 Funcionalidad Mínima
- [ ] La app funciona completamente sin depender de la webview del navegador.
- [ ] Navegación nativa funcional (back swipe, tab bar, keyboard avoidance).
- [ ] La app maneja correctamente la pérdida de conexión (muestra estado offline, no crash).
- [ ] La app no abre Safari para funcionalidades core (checkout puede ser excepción temporal).
- [ ] Rendimiento fluido: 60 fps en navegación, sin jank visible.

### 1.4 Seguridad
- [ ] No se almacenan tokens JWT en `UserDefaults` ni archivos planos. Usar Keychain via `@capacitor/secure-storage`.
- [ ] SSL Pinning evaluado (opcional pero recomendado para datos sensibles).
- [ ] Datos sensibles (peso, medidas, fotos) NO se incluyen en backups de iCloud no cifrados.
- [ ] Logs de debug deshabilitados en build de producción.

---

## 2. Requisitos de Apple Específicos para VITAMATE

### 2.1 Suscripciones In-App (StoreKit 2)
- [ ] Productos de suscripción creados en App Store Connect:
  - [ ] `mx.vitamate.premium.monthly` — Mensual
  - [ ] `mx.vitamate.premium.annual` — Anual
- [ ] Grupo de suscripción configurado: "VITAMATE Premium".
- [ ] Free trial de 7 días configurado en ambos productos.
- [ ] StoreKit 2 implementado en el adapter nativo `StoreKitBillingProvider`.
- [ ] Server-side receipt validation implementada (App Store Server API v2).
- [ ] Manejo de estados: `.subscribed`, `.expired`, `.revoked`, `.inGracePeriod`, `.inBillingRetryPeriod`.
- [ ] Restore purchases implementado y accesible.
- [ ] Entitlements sincronizados con tabla `entitlements` en backend.
- [ ] Subscription offer codes evaluados (promociones).
- [ ] Precio localizado usando `Product.displayPrice` de StoreKit 2.

### 2.2 HealthKit (Fase 3)
- [ ] HealthKit Entitlement habilitado en el proyecto Xcode.
- [ ] Tipos de datos solicitados documentados (ver `healthkit-permissions.md`).
- [ ] `NSHealthShareUsageDescription` agregado al Info.plist con descripción clara en español.
- [ ] `NSHealthUpdateUsageDescription` agregado si se escriben datos.
- [ ] Datos de HealthKit NO se envían a servidores externos sin consentimiento explícito.
- [ ] La app funciona correctamente si el usuario niega permisos de HealthKit.

### 2.3 Cámara y Fotos
- [ ] `NSCameraUsageDescription` agregado al Info.plist: "VITAMATE usa la cámara para tomar fotos de tus comidas y registrar tu progreso".
- [ ] `NSPhotoLibraryUsageDescription` agregado: "VITAMATE accede a tu galería para seleccionar fotos de comidas o progreso".
- [ ] La app funciona correctamente si el usuario niega acceso a la cámara/galería (funcionalidad degradada, no crash).

### 2.4 Notificaciones
- [ ] Push Notifications Entitlement habilitado.
- [ ] APNs Key creado en Apple Developer Portal.
- [ ] `UNUserNotificationCenter` configurado para solicitar permisos.
- [ ] La app funciona correctamente sin notificaciones si el usuario las deniega.

---

## 3. Contenido y Metadata

### 3.1 Información de la App
- [ ] Nombre de la app: "VITAMATE — Coach Fitness IA"
- [ ] Subtítulo: "Nutrición, Entrenamiento y Progreso"
- [ ] Categoría primaria: Health & Fitness
- [ ] Categoría secundaria: Lifestyle
- [ ] URL de soporte: `https://vitamate.mx/soporte`
- [ ] URL de política de privacidad: `https://vitamate.mx/privacidad`
- [ ] URL de términos de servicio: `https://vitamate.mx/terminos`
- [ ] Email de contacto: `soporte@vitamate.mx`

### 3.2 Screenshots
- [ ] Screenshots para iPhone 6.7" (iPhone 15 Pro Max): mínimo 3, máximo 10.
- [ ] Screenshots para iPhone 6.1" (iPhone 15 Pro).
- [ ] Screenshots para iPad Pro 12.9" (si la app soporta iPad).
- [ ] Screenshots muestran funcionalidad real, no mockups genéricos.
- [ ] Screenshots en español.
- [ ] No incluyen contenido que viole guidelines (ej. precios de competidores).

### 3.3 Descripción
- [ ] Descripción corta (hasta 170 caracteres) para Google Play.
- [ ] Descripción larga (hasta 4000 caracteres) con features principales.
- [ ] Keywords optimizadas (App Store): "fitness, nutrición, coach, IA, entrenamiento, dieta, macros, calorías, gym".
- [ ] Descripción NO menciona "gratis" si hay suscripción requerida para funcionalidades core.

### 3.4 App Preview (Video)
- [ ] Video de preview (opcional pero recomendado): 15-30 segundos mostrando el flujo principal.
- [ ] Sin contenido engañoso (no mostrar features que no existan aún).

### 3.5 Iconos
- [ ] App icon en todas las resoluciones requeridas (1024x1024 base).
- [ ] El ícono NO contiene screenshots, texto excesivo, ni contenido engañoso.
- [ ] Formato PNG, sin transparencia, sin bordes redondeados (iOS los aplica automáticamente).

---

## 4. Privacidad y Legal

### 4.1 Privacy Nutrition Labels (App Store)
- [ ] Privacy data map completado (ver `privacy-data-map.md`).
- [ ] Declaración en App Store Connect de todos los tipos de datos recolectados.
- [ ] Categorización correcta: "Data Used to Track You" vs "Data Not Linked to You".

### 4.2 Documentos Legales
- [ ] Política de Privacidad publicada y accesible via URL pública.
- [ ] Términos de Servicio publicados y accesibles via URL pública.
- [ ] Aviso de Privacidad conforme a la Ley Federal de Protección de Datos Personales (México - LFPDPPP).
- [ ] Consentimiento de IA separado (uso de datos por modelos de lenguaje).
- [ ] Consentimiento para fotos de progreso corporal separado.
- [ ] Mecanismo de eliminación de cuenta dentro de la app (REQUERIDO por Apple desde enero 2022).
- [ ] Mecanismo de exportación de datos del usuario (GDPR/best practice).

### 4.3 COPPA / Menores de Edad
- [ ] La app requiere ser mayor de 16 años para registrarse.
- [ ] Age gate implementado en el flujo de registro.
- [ ] No se recolectan datos de menores de 13 años intencionalmente.

---

## 5. App Review Específico

### 5.1 Cuenta de Demo
- [ ] Cuenta de demo creada para el equipo de revisión de Apple.
- [ ] Credenciales documentadas en App Review Notes (ver `app-review-notes-template.md`).
- [ ] La cuenta tiene suscripción activa para probar funcionalidades premium.
- [ ] Datos de ejemplo precargados (comidas, entrenamientos, progreso).

### 5.2 Notas para el Revisor
- [ ] App Review Notes escritas explicando funcionalidades de IA.
- [ ] Explicación de por qué se requieren permisos específicos (cámara, HealthKit).
- [ ] Si la app usa HealthKit, explicar qué datos se leen/escriben y por qué.
- [ ] Si la app usa AI generativa, explicar qué modelo se usa y cómo se moderan las respuestas.

### 5.3 Razones Comunes de Rechazo (Prevención)
- [ ] **Guideline 2.1 — Performance:** La app no crashea en ningún flujo.
- [ ] **Guideline 2.3 — Accurate Metadata:** Screenshots y descripción reflejan la app real.
- [ ] **Guideline 3.1.1 — In-App Purchase:** Toda funcionalidad premium usa StoreKit, no enlaces a web.
- [ ] **Guideline 3.1.2 — Subscriptions:** Términos de suscripción claros, botón de restaurar compras visible.
- [ ] **Guideline 4.2 — Minimum Functionality:** La app no es un wrapper de un sitio web.
- [ ] **Guideline 5.1 — Privacy:** Todos los accesos a datos están justificados y declarados.
- [ ] **Guideline 5.1.1 — Data Collection:** Privacy labels coinciden con el código real.
- [ ] **Guideline 5.1.2 — Data Use:** No se comparten datos con terceros para publicidad.

---

## 6. Google Play Store (Preparación Paralela)

### 6.1 Requisitos Técnicos
- [ ] Proyecto Android generado via `npx cap add android`.
- [ ] Keystore de firma creado y almacenado de forma segura.
- [ ] App Bundle (.aab) generado (no APK para Play Store).
- [ ] Versión mínima de Android: API 26 (Android 8.0).
- [ ] Target SDK: API 35 (Android 15).

### 6.2 Google Play Billing
- [ ] Productos de suscripción creados en Google Play Console.
- [ ] Google Play Billing Library v7+ implementada.
- [ ] Server-side validation con Google Play Developer API.

### 6.3 Contenido
- [ ] Feature Graphic (1024x500) diseñado.
- [ ] Screenshots para teléfono (mínimo 2, máximo 8).
- [ ] Data Safety form completado (equivalente a Privacy Labels de Apple).
- [ ] Content rating questionnaire completado.

---

## 7. CI/CD para App Stores

- [ ] Fastlane configurado para iOS (`fastlane ios beta`, `fastlane ios release`).
- [ ] Fastlane configurado para Android (`fastlane android beta`, `fastlane android release`).
- [ ] GitHub Actions workflow para builds automáticos en cada tag.
- [ ] Versionado semántico: `CFBundleShortVersionString` / `versionName` sincronizado con `package.json`.
- [ ] Build number auto-incrementado.
- [ ] Secrets (certificados, keystores) almacenados de forma segura (GitHub Secrets / Vault).

---

## 8. Post-Lanzamiento

- [ ] Monitoreo de crashes: Sentry o Firebase Crashlytics configurado.
- [ ] Analytics de retención y conversión (PostHog / Mixpanel).
- [ ] Proceso de respuesta a reviews del App Store establecido.
- [ ] Plan de actualización: al menos 1 update cada 3-4 semanas.
- [ ] Runbook para emergencias (app crashing, billing broken, AI down).
