# Preparación para App Store — VITAMATE

Última revisión: 14 de julio de 2026. El código nativo está preparado; el archivo firmado para TestFlight depende de Xcode, Apple Developer y App Store Connect.

## Completado en el repositorio

- [x] Capacitor 8, iOS mínimo 15 y proyecto SPM generado.
- [x] Bundle ID `mx.vitamate.app` y URL scheme `mx.vitamate`.
- [x] Icono opaco, splash, cámara, galería, micrófono, teclado, estado de red y safe areas.
- [x] Sesión Supabase PKCE guardada en Keychain.
- [x] Auth por contraseña/OTP, recuperación y eliminación dentro de la app.
- [x] HealthKit contextual y degradación si se deniega.
- [x] StoreKit mensual/anual, precio localizado, compra, restauración y administración.
- [x] Verificación JWS y App Store Server Notifications V2 en backend.
- [x] Un solo entitlement para Stripe web y Apple, sin Stripe para compras nuevas en iOS.
- [x] `PrivacyInfo.xcprivacy`, descripciones de permisos y entitlements.
- [x] URLs web de privacidad, términos y soporte.
- [x] Build web, typecheck API, lint app, `cap sync ios` y `cap doctor` aprobados.

## Acciones del propietario en Apple

- [ ] Instalar Xcode 26 o posterior desde App Store y aceptar licencia.
- [ ] Seleccionar el Team de Apple Developer en Signing & Capabilities.
- [ ] Registrar el App ID `mx.vitamate.app`.
- [ ] Activar HealthKit y Associated Domains para el identificador.
- [ ] Crear la app en App Store Connect y anotar su Apple numeric App ID.
- [ ] Crear grupo **VITAMATE Premium** y productos mensual/anual.
- [ ] Configurar la oferta introductoria de siete días, territorios, precios y textos.
- [ ] Configurar App Store Server Notifications V2 para producción y sandbox.
- [ ] Crear una cuenta Sandbox y probar compras/restauración.
- [ ] Completar contratos, impuestos y datos bancarios en App Store Connect.

## Infraestructura antes de TestFlight

- [ ] Desplegar `app.vitamate.mx`, `api.vitamate.mx` y `vitamate.mx` con HTTPS.
- [x] Aplicar la migración `202607140012_apple_storekit.sql` al Supabase vinculado.
- [ ] Configurar las variables Apple del backend, en particular `APPLE_APP_ID`.
- [ ] Añadir `mx.vitamate://auth/callback` a Redirect URLs de Supabase.
- [ ] Publicar `apple-app-site-association` con el Team ID real.
- [ ] Rotar toda credencial expuesta anteriormente y usar sólo secretos del hosting.
- [ ] Probar CORS y la autenticación obligatoria de VITACOACH en dominios reales.
- [ ] Configurar logs, alertas, rate limiting persistente y respaldos.

## Calidad en dispositivo real

- [ ] iPhone pequeño, iPhone 6.7 pulgadas e iPad: navegación, teclado y orientación.
- [ ] Chat VITACOACH con teclado, cámara, archivos y audio WebRTC.
- [ ] Permisos denegados y reactivados para cámara, micrófono, fotos y HealthKit.
- [ ] Offline, conexión lenta, suspensión, reanudación y token vencido.
- [ ] VoiceOver, Dynamic Type, contraste, teclado externo y Reduce Motion.
- [ ] Cuenta Gratis no genera llamadas a OpenAI/fal.ai.
- [ ] Cuenta Premium, vencida, cancelada, reembolsada y restaurada.
- [ ] Eliminación de cuenta y separación RLS con dos usuarios.
- [ ] Notificaciones sólo si la experiencia APNs queda terminada; de lo contrario no solicitar permiso.

## Contenido, legal y revisión

- [ ] Reemplazar en textos legales razón social, domicilio, responsable y proceso ARCO definitivos.
- [ ] Revisión por abogado mexicano.
- [ ] Revisión de rutinas por entrenador/fisioterapeuta y nutrición por nutriólogo.
- [ ] Confirmar licencias y atribuciones de imágenes y fuentes alimentarias.
- [ ] Completar App Privacy conforme a `privacy-data-map.md`.
- [ ] Preparar cuenta de review Premium y notas según `app-review-notes-template.md`.
- [ ] Crear screenshots reales de iPhone y, como el target soporta iPad, también de iPad.
- [ ] Completar nombre, subtítulo, descripción, keywords, categoría Health & Fitness y clasificación de edad.

## Condición de salida

No declarar “lista para publicar” hasta que exista un Archive firmado, una compilación procesada en TestFlight, la matriz Sandbox aprobada, los datos jurídicos definitivos y una beta en dispositivos reales sin errores bloqueantes.
