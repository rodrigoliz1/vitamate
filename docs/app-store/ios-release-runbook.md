# Runbook de primera entrega iOS

## 1. Preparar la Mac

1. Confirmar Node.js 22 o posterior (`node --version`).
2. Instalar Xcode 26 o posterior desde App Store.
3. Abrirlo una vez y aceptar licencia/componentes.
4. Ejecutar:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
xcodebuild -version
```

La máquina actual sólo tiene Command Line Tools, por eso el repositorio puede sincronizar iOS pero todavía no crear un Archive firmado.

## 2. Base de datos y backend

```bash
cd "/Users/rodrigo/Desktop/VITAMATE/VITAMATE CODIGO"
corepack pnpm install
corepack pnpm dlx supabase link --project-ref wxezdboreybgxdlivoeo
corepack pnpm dlx supabase db push
```

Desplegar la API y configurar `APPLE_APP_ID` con el ID numérico de App Store Connect. Registrar:

`https://api.vitamate.mx/v1/billing/apple/notifications`

como App Store Server Notifications V2 para Sandbox y Producción.

## 3. Apple Developer

1. Crear el identifier `mx.vitamate.app`.
2. Activar HealthKit y Associated Domains.
3. En App Store Connect crear la app con ese Bundle ID.
4. Crear el grupo VITAMATE Premium y los productos exactos definidos en `storekit-migration.md`.
5. Configurar precios localizados y prueba introductoria.

## 4. Deep links

En Supabase Auth → URL Configuration agregar:

`mx.vitamate://auth/callback`

Para Universal Links publicar, sin extensión y con `Content-Type: application/json`, `https://app.vitamate.mx/.well-known/apple-app-site-association` y `https://vitamate.mx/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appIDs": ["APPLE_TEAM_ID.mx.vitamate.app"],
      "components": [{ "/": "/auth/*" }, { "/": "/cuenta*" }]
    }]
  }
}
```

Sustituir `APPLE_TEAM_ID`; no publicar el placeholder.

## 5. Generar y abrir Xcode

```bash
corepack pnpm --filter vitamate-app native:sync:ios
corepack pnpm --filter vitamate-app native:open:ios
```

En Xcode:

1. Seleccionar target **App** → Signing & Capabilities.
2. Elegir el Team real y confirmar Bundle ID.
3. Verificar HealthKit y Associated Domains.
4. Seleccionar un iPhone físico y ejecutar.
5. No activar Push Notifications hasta que el backend APNs esté configurado y probado.

## 6. Sandbox y TestFlight

1. Crear Sandbox Tester.
2. Probar la matriz de `storekit-migration.md` en dispositivo.
3. Incrementar `CURRENT_PROJECT_VERSION` para cada subida.
4. Product → Archive → Distribute App → App Store Connect.
5. Esperar procesamiento, completar export compliance (`ITSAppUsesNonExemptEncryption=false`) y abrir beta interna.
6. Ejecutar todas las pruebas de `readiness-checklist.md`.

## 7. Envío

Completar metadata, privacidad, screenshots, cuenta de revisión y notas. Adjuntar las suscripciones a la versión si App Store Connect lo solicita. Sólo enviar después de que web, API y URLs legales estén públicas y estables.

## Comandos de verificación repetibles

```bash
corepack pnpm --filter vitamate-app lint
corepack pnpm --filter vitamate-app build
corepack pnpm --filter vitamate-api typecheck
corepack pnpm --filter vitamate-website lint
corepack pnpm --filter vitamate-website build
corepack pnpm --filter vitamate-app native:sync:ios
corepack pnpm --filter vitamate-app native:doctor
plutil -lint apps/app/ios/App/App/Info.plist apps/app/ios/App/App/PrivacyInfo.xcprivacy apps/app/ios/App/App/App.entitlements
```
