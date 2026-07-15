# HealthKit Permissions

## Tipos de Datos Solicitados

### Lectura (HKObjectType)
| Tipo | Identificador | Cuándo se solicita | Propósito |
|------|---------------|-------------------|-----------|
| Pasos | `HKQuantityTypeIdentifierStepCount` | Al activar sincronización | Actividad diaria |
| Energía activa | `HKQuantityTypeIdentifierActiveEnergyBurned` | Al activar sincronización | Cálculo de TDEE |
| Energía en reposo | `HKQuantityTypeIdentifierBasalEnergyBurned` | Al activar sincronización | Cálculo de TDEE |
| Distancia | `HKQuantityTypeIdentifierDistanceWalkingRunning` | Al activar sincronización | Registro de actividad |
| Minutos de ejercicio | `HKQuantityTypeIdentifierAppleExerciseTime` | Al activar sincronización | Registro de actividad |
| Peso | `HKQuantityTypeIdentifierBodyMass` | Al activar sincronización | Seguimiento de peso |
| Entrenamientos | `HKWorkoutType` | Al activar sincronización | Registro de actividad |
| Frecuencia cardiaca | `HKQuantityTypeIdentifierHeartRate` | Solo si el usuario activa monitoreo cardíaco | Métricas avanzadas |
| Sueño | `HKCategoryTypeIdentifierSleepAnalysis` | Con consentimiento separado | Recuperación |

### Escritura (HKObjectType)
| Tipo | Identificador | Cuándo se solicita | Propósito |
|------|---------------|-------------------|-----------|
| Entrenamientos | `HKWorkoutType` | Al completar un entrenamiento | Registrar sesiones |
| Peso | `HKQuantityTypeIdentifierBodyMass` | Al registrar peso en la app | Sincronizar mediciones |

## Estrategia de Solicitud de Permisos

### Principio: Solicitud Contextual
- **NO** solicitar todos los permisos al abrir la app por primera vez.
- Solicitar cada permiso en el momento en que el usuario active la funcionalidad correspondiente.
- Ejemplo: el permiso de peso se solicita la primera vez que el usuario accede a la sección de Progreso y activa sincronización.

### Flujo
1. Usuario navega a una función que requiere HealthKit.
2. Se muestra una pantalla explicativa (pre-prompt) indicando qué datos se leerán y por qué.
3. Si el usuario acepta, se llama a `requestAuthorization`.
4. Si el usuario deniega, la app funciona normalmente sin esos datos.
5. Se ofrece la opción de activar permisos desde Configuración más adelante.

## Info.plist Strings
```xml
<key>NSHealthShareUsageDescription</key>
<string>VITAMATE usa tus datos de salud para calcular tu gasto energético, registrar tu actividad y personalizar tus planes de entrenamiento y nutrición. Nunca compartimos estos datos con anunciantes.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>VITAMATE registra tus entrenamientos completados y tu peso en Apple Health para mantener un historial unificado de tu progreso.</string>
```

## Reglas de Seguridad
- Los datos de HealthKit **nunca** se envían a herramientas de analítica o publicidad.
- Los datos se sincronizan únicamente al backend de VITAMATE y se almacenan con las mismas políticas de privacidad que el resto de datos del usuario.
- La desconexión de HealthKit elimina la capacidad de leer nuevos datos pero preserva el historial ya registrado.
- Se registra el `source` de cada dato como `"apple_health"` para auditoría.
