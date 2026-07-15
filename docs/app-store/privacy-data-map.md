# Mapa de datos para App Privacy

Este documento es la fuente de trabajo para completar el cuestionario de privacidad de App Store Connect. Debe compararse con producción antes de cada versión.

| Categoría Apple | Ejemplos VITAMATE | Vinculado al usuario | Tracking | Finalidad |
|---|---|---:|---:|---|
| Nombre | Nombre completo y preferido | Sí | No | Cuenta y personalización |
| Email | Inicio de sesión y soporte | Sí | No | Autenticación/comunicación |
| Salud | Peso, altura, objetivos, consumo, documentos voluntarios | Sí | No | Funcionalidad de la app |
| Fitness | Actividad, entrenamientos, pasos y energía autorizados | Sí | No | Funcionalidad de la app |
| Fotos o videos | Fotos de alimentos y archivos elegidos | Sí | No | Análisis solicitado |
| Otro contenido | Mensajes, memoria de VITACOACH y notas | Sí | No | Coach y personalización |
| Historial de compras | Producto, vigencia y transacción | Sí | No | Suscripción/antifraude |
| ID de usuario | UUID de Supabase y appAccountToken | Sí | No | Cuenta/seguridad |

VITAMATE no usa datos para publicidad ni seguimiento entre apps o sitios. No se declara ubicación precisa, contactos, historial de navegación, SMS ni llamadas telefónicas.

## Encargados tecnológicos actuales

| Proveedor | Información necesaria |
|---|---|
| Supabase | Cuenta, base de datos, RLS y almacenamiento |
| OpenAI | Mensajes, contexto mínimo, archivos/fotos cuando la persona solicita análisis |
| Apple | Compra de App Store y datos de Apple Health autorizados localmente |
| Stripe | Compras realizadas en la web |
| Brevo | Email y contenido transaccional |
| fal.ai/Cloudinary | Activos globales generados; no debe enviarse información clínica del usuario |

## Controles ya implementados

- Sesión nativa guardada en Keychain.
- Permisos de cámara, fotos, micrófono y salud con descripción contextual.
- HealthKit no se usa para publicidad.
- Eliminación dentro de Cuenta → **Eliminar mi cuenta y mis datos**.
- La API cancela suscripciones Stripe activas antes de borrar; una compra de App Store se administra separadamente con Apple y la UI lo advierte.
- RLS y autorización separan los datos de cada cuenta.
- `PrivacyInfo.xcprivacy` declara recopilación vinculada, sin tracking.

## Antes de enviar

Revisar que Aviso de Privacidad y App Store Connect coincidan exactamente con el binario y el backend desplegado. Completar razón social, domicilio, responsable, plazos de conservación y mecanismo ARCO reales; el texto comercial actual todavía indica que esos datos jurídicos están pendientes.
