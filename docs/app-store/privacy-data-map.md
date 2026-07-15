# Privacy Data Map (App Store / Google Play)

Este documento mapea los datos recopilados por VITAMATE para cumplir con los requisitos de App Privacy de Apple y Data Safety de Google Play.

## Datos Recopilados

### Información de Contacto
| Dato | Propósito | Vinculado a Identidad | Seguimiento |
|------|-----------|----------------------|-------------|
| Email | Autenticación, comunicación | Sí | No |
| Nombre preferido | Personalización | Sí | No |

### Salud y Fitness
| Dato | Propósito | Vinculado a Identidad | Seguimiento |
|------|-----------|----------------------|-------------|
| Peso | Cálculo de planes nutricionales | Sí | No |
| Altura | Cálculo de gasto energético | Sí | No |
| Medidas corporales | Seguimiento de progreso | Sí | No |
| Porcentaje de grasa | Cálculos opcionales | Sí | No |
| Actividad física | Seguimiento de entrenamientos | Sí | No |
| Datos de HealthKit/Health Connect | Sincronización de actividad | Sí | No |
| Consumo alimentario | Seguimiento nutricional | Sí | No |

### Contenido del Usuario
| Dato | Propósito | Vinculado a Identidad | Seguimiento |
|------|-----------|----------------------|-------------|
| Fotos de alimentos | Análisis nutricional por IA | Sí | No |
| Fotos de progreso | Seguimiento personal | Sí | No |
| Mensajes de chat | Interacción con coach IA | Sí | No |
| Notas de entrenamiento | Registro personal | Sí | No |

### Información Financiera
| Dato | Propósito | Vinculado a Identidad | Seguimiento |
|------|-----------|----------------------|-------------|
| Historial de compras | Gestión de suscripción | Sí | No |

### Analítica
| Dato | Propósito | Vinculado a Identidad | Seguimiento |
|------|-----------|----------------------|-------------|
| Eventos de producto | Mejora de la app | No | No |
| Crashlytics | Estabilidad | No | No |

## Datos NO Recopilados
- Ubicación precisa.
- Contactos del dispositivo.
- Historial de navegación.
- Mensajes SMS/llamadas.
- Archivos del dispositivo (más allá de fotos seleccionadas por el usuario).

## Datos NO Usados para Seguimiento (Tracking)
VITAMATE **no** realiza tracking publicitario. Ningún dato se comparte con redes publicitarias, data brokers o terceros para perfilado.

## Datos Compartidos con Terceros
| Tercero | Datos | Propósito |
|---------|-------|-----------|
| Stripe | Email, ID de cliente | Procesamiento de pagos |
| OpenAI/Anthropic | Contexto anonimizado del usuario, fotos de comida | Generación de respuestas de IA |
| Supabase | Todos los datos almacenados | Infraestructura (procesador de datos) |

## Retención y Eliminación
- Los datos se retienen mientras la cuenta esté activa.
- El usuario puede exportar todos sus datos en cualquier momento.
- El usuario puede solicitar eliminación completa de su cuenta.
- Tras solicitud de eliminación, los datos se purgan en un plazo máximo de 30 días.
- Las fotografías se eliminan del storage inmediatamente.
