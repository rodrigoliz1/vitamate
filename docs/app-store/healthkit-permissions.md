# Apple Health: permisos implementados

Estado del código al 14 de julio de 2026.

## Alcance actual

La integración está en `apps/app/src/services/nativeHealth.ts` y sólo se activa en iOS cuando la persona pulsa **Conectar Apple Health** desde Progreso. Negar el permiso no impide utilizar VITAMATE.

| Dato solicitado para lectura | Uso actual |
|---|---|
| Pasos | Resumen de actividad del día |
| Calorías activas | Resumen de gasto activo del día |
| Frecuencia cardiaca en reposo | Resumen del día |
| Entrenamientos | Autorizado para sincronización posterior |
| Peso | Autorizado para sincronización posterior |

La primera versión no escribe datos en HealthKit. Tampoco solicita sueño, ubicación, contactos ni expedientes clínicos. El resumen que se muestra en la app consulta pasos, calorías activas y frecuencia cardiaca en reposo.

## Comportamiento de privacidad

- La solicitud es contextual, nunca durante el primer arranque.
- La app continúa funcionando si se deniega cualquier permiso.
- Apple Health no se utiliza para publicidad ni seguimiento.
- La UI identifica el origen como `Apple Health` y muestra cuándo se actualizó.
- Antes de ampliar los tipos o escribir entrenamientos/peso se debe actualizar esta tabla, `Info.plist`, el manifiesto de privacidad y la ficha de App Store.

## Configuración nativa

El target incluye HealthKit en `App.entitlements` y `NSHealthShareUsageDescription` en `Info.plist`. `NSHealthUpdateUsageDescription` se añadirá únicamente cuando exista y se pruebe una función real de escritura.

## Prueba obligatoria

1. Probar en un iPhone físico; el simulador no representa todos los datos.
2. Abrir Progreso → Conectar Apple Health.
3. Autorizar sólo algunos datos y confirmar degradación parcial sin errores.
4. Denegar todos y confirmar que la app sigue operativa.
5. Revocar permisos en Ajustes → Salud → Acceso a datos y volver a abrir VITAMATE.
