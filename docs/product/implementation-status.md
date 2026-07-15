# Estado de implementación — 14 de julio de 2026

## Entregado

- PWA Ionic React + TypeScript con manifiesto, service worker y navegación offline.
- Onboarding de seis pasos, perfil persistente, objetivos nutricionales y plan inicial; ahora captura alimentos favoritos, rechazos, alergias, cocinas preferidas, presupuesto y tiempo disponible.
- Entrenamiento guiado a pantalla completa con guía visual, técnica paso a paso, cronómetro global, contador táctil de cada repetición, ajuste manual, avance al objetivo, evaluación de dificultad por ejercicio e historial detallado.
- Retroalimentación final personalizada con duración, dificultad e historial reciente.
- Catálogo de ejercicios y flujo fal.ai idempotente: una generación por ejercicio/versión, almacenamiento en Supabase Storage y revisión humana obligatoria antes de publicarla.
- Registro de alimentos mediante catálogo local, búsqueda interna, búsqueda externa explícita en USDA, código de barras con Open Food Facts, fotografía con análisis multimodal y confirmación editable.
- Alimentos personales reutilizables con alta, edición y eliminación.
- API Fastify con normalización nutricional, validación de plausibilidad, caché PostgreSQL, timeouts y límites propios.
- Importador por streaming para el archivo completo de Open Food Facts, filtrado a productos mexicanos con macros completos.
- Infraestructura persistente de español/inglés conservada en el perfil, pero selector oculto temporalmente mediante una bandera de función y presentación fijada en español hasta completar la traducción.
- Tema claro/oscuro seleccionable desde Progreso, persistente por dispositivo y aplicado a navegación, formularios, tarjetas, modales, VITACOACH, nutrición y entrenamiento.
- Migración Supabase con RLS para perfiles, alimentos, diarios, sesiones, ejercicios, repeticiones, medios y buckets privados/públicos.
- Autenticación sin contraseña mediante enlace mágico de Supabase y sincronización reconciliada entre el repositorio local y el perfil remoto.
- Historial normalizado en Supabase para peso, alimentos personales, comidas, sesiones, repeticiones y mensajes del Coach, siempre con políticas RLS por propietario.
- VITACOACH convertido en función principal: chat contextual conectado a OpenAI Responses, tono configurable, mensajes persistentes, envío de fotos, retroalimentación y confirmación del registro nutricional dentro de la conversación.
- Conversación por voz con transcripción, respuesta hablada y respaldo de cada turno en el chat; preparada para evolucionar a OpenAI Realtime/WebRTC cuando se requiera menor latencia.
- Plan alimenticio diario matemáticamente distribuido entre 2–6 comidas, con dos alternativas por momento, macros, ingredientes, receta, tiempo y complejidad ajustados al perfil.
- Catálogo inicial de 12 fotografías de platillos generado una sola vez con fal.ai y persistido en Supabase Storage para uso global.
- Cuenta accesible desde el nombre del saludo, con datos del perfil, estado de respaldo y espacio de suscripción; Progreso permite volver a tomar el quiz y recalcular planes en cualquier momento.
- Autenticación del endpoint de VITACOACH preparada: valida bearer tokens de Supabase y puede hacerse obligatoria con `REQUIRE_COACH_AUTH=true`.
- Acciones estructuradas de VITACOACH: una comida o actividad física relatada como ya realizada se registra en el historial, se muestra una confirmación dentro del chat y puede deshacerse.
- Navegación del chat corregida para abrir en el último mensaje y llamada manos libres continua después de una sola activación, con selección preferente de voz natural disponible en el dispositivo.
- Elección exclusiva del plan diario: al registrar una opción se descarta visualmente la alternativa, se marca como comida realizada y puede anularse.
- Plan de lunes a domingo y lista semanal del súper con consolidación de cantidades, estimado MXN, cambio inmediato entre alternativas y enlaces contextuales a VITACOACH para sustituir comidas o insumos.
- Balance nutricional semanal y de actividad: excedentes y déficits se distribuyen de lunes a domingo; Hoy muestra exceso en rojo, detalle presionable e historial reciente, y Entrenar permite registrar actividad libre mediante VITACOACH.
- Quiz y editor ampliados con modalidad de cocina al momento/meal prep, estructura y rotación de lotes, suplementos, deporte o entorno preferido y presupuesto semanal editable.
- Lista semanal del súper compacta: se abre bajo demanda, conserva los productos tachados, permite sustituir insumos con VITACOACH y abre el presupuesto desde el estimado.
- Plan de fuerza estable con doble progresión 4–6: contador por serie, series incompletas válidas, carga real por serie e incremento de repeticiones o peso según el historial del mismo ejercicio.
- Meta flexible de Entrenar expresada en calorías semanales; scroll único y aislamiento de errores por sesión para evitar pantallas bloqueadas.
- VITACOACH preparado para cansancio y recuperación contextual, lectura transitoria de estudios PDF y persistencia exclusiva de su resumen privado.
- Llamada de baja latencia implementada con OpenAI Realtime/WebRTC, client secrets efímeros emitidos por el backend y respaldo de voz del navegador.
- Entrenar permite elegir **Gimnasio** o **En casa** cada día sin modificar la preferencia permanente del perfil; cada entorno usa ejercicios, equipo y rangos de progresión propios.
- Rutinas de fuerza reorganizadas según 1–5 sesiones semanales: cuerpo completo para baja frecuencia, torso/pierna para cuatro días y empuje/tracción/pierna/torso/pierna para cinco días.
- Cobertura visual completa en Entrenar: las tarjetas muestran todos los ejercicios en una fila desplazable y cada ejercicio cuenta con imagen aprobada o esquema vectorial específico de inicio/posición clave con recuperación automática ante imágenes remotas rotas.
- Registro nutricional navegable por **día, semana o mes**, con controles de periodo anterior/siguiente, totales del intervalo y fechas visibles en historiales de más de un día.
- Trece fotografías realistas de ejercicios almacenadas globalmente en Supabase Storage y aprobadas tras revisión visual; la API prioriza la fotografía aprobada más reciente por ejercicio y nunca publica candidatos pendientes o rechazados.
- Regreso desde el entrenamiento guiado corregido: la sesión se abre en una capa desplazable sin desmontar el `IonContent` de Entrenar, y al salir se limpian inmediatamente las clases de bloqueo.
- Memoria híbrida de VITACOACH: historial completo por usuario en Supabase, caché local de 200 mensajes y memoria estructurada de largo plazo con importancia, confianza, caducidad y eliminación solicitada por el usuario.
- Contexto viable para conversaciones largas: cada respuesta usa hasta 20 mensajes recientes y 40 recuerdos relevantes, sin reenviar todo el historial ni hacer una segunda llamada de resumen.
- Personalidad contextual ampliada para actuar como entrenador, educador nutricional, mentor, acompañante y apoyo emocional, manteniendo límites clínicos y evitando dependencia o falsas credenciales profesionales.
- Interfaz de VITACOACH convertida en viewport fijo: sólo se desplaza la conversación y el compositor permanece visible sobre la navegación en escritorio, tableta y móvil.
- Llamada de VITACOACH iniciada automáticamente al abrir el modal, con tono breve de enlace generado en el dispositivo, cronómetro continuo y finalización exclusiva mediante la “X”.
- Control de micrófono corregido: el botón central habilita o silencia la pista local sin cerrar WebRTC, detener el audio remoto ni reiniciar la conversación; el modo alterno del navegador conserva el mismo comportamiento.
- Orbe de voz animado por estado: respiración suave al escuchar y dos aros de flujo independientes cuando VITACOACH habla.
- Registro por peso real para catálogo, USDA y código de barras: la porción de la fuente se convierte a gramos cuando es una unidad de masa, el usuario ajusta el gramaje y calorías/macros se tabulan en vivo antes de guardar.
- Motor oficial de costos del súper: catálogo canónico y alias revisados, importación streaming de PROFECO QQP, normalización de presentaciones, trazabilidad por observación, actualización opcional con INPC, exclusión IQR, caché y confianza explícita.
- Lista del súper ampliada con ciudad, periodo y personas; muestra desembolso económico/mediano/alto, costo consumido, presentaciones completas, sobrante, categorías, fecha, fuente y una referencia estadística fundada cuando falta coincidencia exacta.
- INPC corregido a la serie absoluta mensual oficial de la Calculadora de Inflación de INEGI: indicador interno `865541`, base segunda quincena de julio de 2018 = 100, 678 observaciones históricas importadas e idempotentes.
- Estimador del súper v3 con respaldo PROFECO por categoría/unidad, explicación de la base usada y caché fija por semana; nuevas importaciones no cambian listas ya calculadas.
- Los dos archivos PROFECO QQP de mayo de 2026 fueron procesados: más de un millón de filas examinadas, 27,285 registros de producto importados y 67,629 observaciones de precio, sin abortar por filas inválidas.
- Coincidencia de pechuga de pollo corregida para considerar nombre y presentación de QQP sin mezclar nuggets, caldos, preparados ni productos empanizados.
- VITACOACH de texto tolera fallos transitorios de OpenAI y fallos de persistencia: reintenta respuestas elegibles y no convierte una respuesta válida en error 500 si el historial remoto falla.
- Cada llamada finalizada crea un mensaje de sistema visible en el chat con su duración y conserva metadatos de inicio/fin cuando el usuario está autenticado.
- Sitio comercial Next.js terminado con portada, Funciones, Cómo funciona, Planes, Fuentes, Nosotros, Aviso de privacidad y Términos; diseño responsive, navegación móvil y guía ilustrada de instalación PWA para iPhone mostrada una sola vez.
- Plan alimenticio canónico por usuario y semana (`schemaVersion: 4`): Nutrición, Plan semanal y Lista del súper leen el mismo objeto persistido; las imágenes sólo enriquecen la presentación y ya no regeneran ni reordenan comidas.
- Elección de alternativas y sustituciones de VITACOACH ligadas al plan canónico: cambiar comida o ingrediente actualiza inmediatamente recetas, selección y consolidado del súper.
- Sincronización silenciosa del plan canónico con Supabase al iniciar sesión y después de cambios, con reconciliación de snapshots v3/v4 y protección contra carreras y ciclos de escritura.
- Onboarding comercial de ocho etapas con nombre legal y preferido, resultado corporal esperado, preferencias de entrenamiento y alimentación, consentimiento y resumen gráfico de 12 semanas antes del registro.
- Acceso por OTP de seis dígitos generado por Supabase y entregado mediante una plantilla transaccional propia de Brevo; el frontend nunca recibe claves SMTP o API.
- Plan Gratis restringido al contador de macros, búsqueda, código de barras y alimentos personales. Foto, VITACOACH, entrenamiento, planes, costos y demás funciones con IA se bloquean antes de invocar proveedores externos.
- VITAMATE Premium mensual/anual con Checkout, Customer Portal, prueba única de siete días, webhook firmado e idempotente y reversión automática al plan gratuito cuando la suscripción deja de estar vigente.
- Veintiocho de veintiocho ejercicios cuentan con una fotografía global aprobada y persistida; ninguna imagen se genera por usuario ni durante una sesión.
- Rate limiting persistente en PostgreSQL para OTP, búsquedas externas, Coach, Realtime, análisis fotográfico y estimaciones; en producción falla cerrado si no puede comprobar el límite.
- Cabeceras de seguridad, CORS estricto por origen y respuestas 5xx sin detalles internos en la API.
- Iconos rasterizados 192/512 y Apple Touch Icon añadidos al instalable PWA.
- Modal del tutorial de instalación PWA centrado con viewport dinámico y scroll seguro en pantallas bajas.
- Quiz: selección obligatoria de Mujer u Hombre para personalización; seis referencias fotográficas locales (tres por opción) se muestran sólo después de elegirla y corresponden al objetivo ligero, definido o músculo.
- OTP: cuando Brevo restringe la IP del entorno, la API intenta un enlace seguro de Supabase como respaldo; los límites de envío se devuelven como `429 AUTH_EMAIL_RATE_LIMITED`, nunca como error 500 genérico.

## Verificación

- Typecheck de `@vitamate/domain`, `vitamate-app` y `vitamate-api`: aprobado.
- Build de producción PWA: aprobado (284 módulos, service worker y bundle dividido en aplicación, Supabase y UI; ningún chunk supera 500 kB).
- API local: endpoint de salud aprobado en puerto 3001.
- Navegador: selector nutricional y sus cuatro métodos aprobados.
- Navegador: apertura de entrenamiento, instrucciones, cronómetro, contador 0→30 y aparición automática de evaluación de dificultad aprobados.
- Migración de planes locales anteriores añadida para conservar datos ya guardados.
- Archivos de entorno y configuración local excluidos del control de versiones; ningún secreto del servidor se incorpora al bundle de la PWA.
- Importación completa de Open Food Facts: 4,532,767 filas examinadas y 15,037 productos mexicanos con macros centrales guardados.
- Migraciones `202607130002_weight_entries.sql` y `202607130003_coach_messages.sql` aplicadas al proyecto remoto.
- Prueba real del endpoint y la interfaz del Coach aprobada: tomó “Fuerza total A” del plan vigente y respondió en español sin exponer la clave al navegador.
- Configuración pública de Supabase persistida en `apps/app/.env.local` y excluida por `.gitignore`; secretos de servidor permanecen en `apps/api/.env`.
- Migración `202607130004_meal_media.sql` aplicada al proyecto remoto; endpoint comprobado con 12 imágenes globales disponibles.
- Once pruebas automatizadas aprobadas: regresión nutricional, identidad entre Nutrición/Plan semanal, sustituciones de VITACOACH y súper, conversión de porciones, balance, meal prep, doble progresión y variantes gym/casa.
- Navegador: VITACOACH, llamada por voz, plan alimenticio con imágenes, editor de perfil y cuenta desde el saludo aprobados.
- Prueba real con la frase de cuatro huevos, chorizo Corona, tortillas Tía Rosa y salsa macha: respuesta 200, acción `log_meal`, registro visible y opción Deshacer.
- Prueba real de “Corrí 30 minutos y quemé 300 calorías”: acción `log_workout` con cardio, duración y gasto extraídos correctamente.
- Migración `202607130005_weekly_tracking.sql` aplicada al proyecto remoto; conserva origen/tipo/calorías de actividad e identificadores de selección del plan.
- Fal.ai v3/v4 generado y revisado visualmente. Sólo sentadilla, press de hombro y cardio fueron aprobados; el resto se rechazó y la PWA muestra indicaciones escritas en lugar de diagramas ambiguos.
- Navegador: contador 4→siguiente serie, cierre anticipado con 2 repeticiones, scroll completo, lista compacta/tachado, presupuesto y opciones condicionales de meal prep aprobados.
- Migración `202607130006_personalization_progressive_health.sql` aplicada al proyecto remoto: series/cargas progresivas y resúmenes privados de documentos de salud con RLS.
- Endpoint Realtime comprobado contra OpenAI: respondió 200 con client secret efímero y vencimiento; la clave estándar permaneció en el servidor.
- Prueba real de cansancio: VITACOACH respondió con ajuste proporcional y recuperación, sin crear registros ficticios.
- Migración `202607130007_training_environments.sql` aplicada al proyecto remoto: catálogo estable para los ejercicios nuevos de gimnasio y casa, listo para medios globales revisados.
- Navegador: las cuatro rutinas de gimnasio y las cuatro de casa muestran guía para cada ejercicio; selector diario, sesión guiada y rangos 4–6/6–10 aprobados.
- Regresión móvil a 390 px: ancho documental 390 px, tarjetas 362 px y carruseles visuales internos sin desbordamiento de la pantalla; consola sin errores.
- Navegador: selector Día/Semana/Mes aprobado, incluyendo navegación semanal y consolidación de registros; Entrenar comprobado con fotografías remotas reales tanto en gimnasio como en casa.
- Navegador: tema oscuro aplicado y conservado tras recarga; tema claro restaurado por la misma interfaz. Selector de idioma ausente sin borrar el dato ni la lógica de localización.
- Regresión de Entrenar: dos ciclos consecutivos de abrir/cerrar Torso A dejan cero diálogos, `pointer-events: auto`, `overflow-y: auto` y conservan la posición de scroll; consola sin errores ni advertencias.
- Build PWA de producción y typecheck de `vitamate-app` aprobados después de estos cambios (285 módulos y service worker generado).
- Migración `202607130008_coach_memory.sql` aplicada al proyecto remoto con RLS para hilos y memorias; mensajes enlazados al hilo continuo del usuario.
- Navegador: respuesta real de VITACOACH aprobada después de activar memoria; compositor visible con historial de 1,685 px, conversación abierta en el último mensaje, scroll exterior bloqueado y consola sin errores.
- Navegador: Llamar abre e inicia sin segundo toque; cronómetro 00:02→00:17→00:34, silencio y reactivación conservan el diálogo, y la “X” elimina el diálogo y libera la llamada sin errores de consola.
- Migración `202607130009_market_price_estimates.sql` aplicada al proyecto remoto con tablas e índices de ingredientes, precios PROFECO, INPC, estimaciones, caché y bitácora de importación.
- Nueve pruebas de dominio aprobadas, incluyendo conversión oz/kg→g, recálculo de nutrientes y garantía de que la lista base ya no incorpora precios heurísticos.
- Consulta real de INEGI aprobada con HTTP 200: 678 niveles absolutos mensuales, desde enero de 1970 hasta junio de 2026 (`145.131`), e importación remota completada.
- Importaciones QQP `05-2026_Q1.csv` y `05-2026_Q2.csv` completadas; prueba de tres ingredientes en Guadalajara devolvió tres precios y cero faltantes. Pechuga: 21 observaciones locales y coincidencia exacta PROFECO.
- La segunda solicitud idéntica del súper devolvió `cached: true` y el mismo total; el vencimiento quedó fijado al inicio de la siguiente semana.
- Chat real sin autenticación respondió HTTP 200 y el registro de llamada respondió HTTP 200 con el mensaje de duración esperado.
- Typecheck de API, PWA y sitio comercial aprobado. `next build` generó estáticamente las nueve rutas del sitio; lint del sitio aprobado.
- Revisión visual del sitio a 1280 px y 390 px aprobada: ancho documental igual al viewport, menú móvil interactivo y guía de instalación modal funcional.
- Navegador: el día actual de Plan semanal coincide con Nutrición; cambiar el desayuno a opción 2 se reflejó en ambas vistas y restaurar opción 1 sobrevivió una recarga sin regenerar el menú.
- Migraciones `202607140010_billing_entitlements.sql` y `202607140011_persistent_rate_limits.sql` aplicadas al proyecto remoto.
- Stripe en modo prueba: ofertas reales, Checkout mensual/anual, prueba única, portal y proyección firmada de alta, duplicado y cancelación comprobados. Los objetos y usuarios temporales fueron eliminados.
- RLS comprobado con dos cuentas temporales: el propietario pudo escribir y la segunda cuenta obtuvo cero filas y no pudo insertar ni modificar. Ambas cuentas fueron eliminadas.
- Guardas Premium comprobadas con una cuenta gratuita: chat, fotografía, guías y estimación devolvieron `402 PREMIUM_REQUIRED` antes de usar OpenAI o fal.ai.
- Búsqueda nutricional corregida para combinar el catálogo curado con la base remota, eliminar duplicados y priorizar resultados con nutrientes completos.
- El tutorial de instalación se monta ahora como portal directamente en `document.body`, fuera de secciones animadas o transformadas; las llamadas desde cualquier CTA usan el mismo diálogo fijo, centrado y con áreas seguras de iPhone.
- Checkout conserva la selección comercial antes de abandonar la PWA y vuelve a `/cuenta` con `session_id`; al regresar, la app reconcilia la sesión autenticada directamente con Stripe, evita duplicar suscripciones y muestra una celebración Premium con prueba, vigencia y próxima facturación.
- El endpoint de Stripe fue corregido a `/v1/billing/webhook` con los eventos de suscripción, factura y Checkout. Una compra de prueba completada fue reconciliada como Premium en estado de prueba; el webhook necesita que `api.vitamate.mx` resuelva al despliegue para recibir eventos de producción.
- Checkout y Customer Portal regresan ahora al mismo origen desde el que se abrieron (`localhost` o `127.0.0.1` y su puerto activo en desarrollo). En producción sólo se permiten los orígenes configurados. La consulta de facturación además reconcilia una suscripción activa de Stripe pendiente de webhook, evitando que una compra válida requiera pegar manualmente su `session_id`.
- VITACOACH normaliza el historial persistido antes de enviarlo a Responses y ya no transmite metadatos de interfaz como `createdAt`; comprobación real contra OpenAI aprobada con un historial durable.
- Desarrollo en red local habilitado para `http://192.168.0.9`: la API acepta CORS en el puerto activo y la PWA sustituye el loopback configurado por el host LAN cuando se abre desde un iPhone.
- El chat móvil mantiene el compositor sobre el teclado visual de iOS, evita el zoom automático mediante un tamaño de texto de 16 px y conserva los mensajes agrupados como conversación. Las llamadas Realtime ahora pueden pedir el registro real de una comida o actividad reportada y reciben el resultado desde el flujo autenticado del chat antes de confirmarlo por voz.
- El compositor de VITACOACH queda fijo sobre la navegación inferior en iPhone, con el historial limitado al alto disponible. La llamada detecta ahora explícitamente una conexión HTTP insegura y no intenta el reconocimiento heredado de Safari como sustituto; WebRTC y el micrófono requieren HTTPS válido.
- Para la prueba local de la llamada en iPhone, Vite puede exponerse mediante un túnel HTTPS: sus rutas `/v1` se proxifican a `127.0.0.1:3001` y la PWA usa ese mismo origen seguro, sin abrir la API al exterior.
- VITACOACH usa ahora una cuadrícula de chat real: el historial ocupa sólo la fila disponible y el compositor permanece debajo de éste, ajustándose al teclado visual de iOS sin cubrir mensajes. Los identificadores locales de mensajes tienen formato UUID aun en Safari sin `crypto.randomUUID`.
- El acceso se reorganizó antes del cuestionario: una persona sin sesión puede registrarse con correo único, contraseña y OTP de Brevo/Supabase, o iniciar sesión con correo y contraseña. Al iniciar, la PWA restaura primero el historial remoto; una cuenta nueva continúa entonces al cuestionario.
- El acceso incluye recuperación de contraseña por OTP: solicitar código, verificarlo y reemplazar la contraseña en Supabase. Registro, inicio y recuperación incluyen controles accesibles para mostrar u ocultar la contraseña; la recuperación no revela si un correo está registrado.
- Los campos OTP ya no imponen una longitud local: aceptan el código numérico emitido por Supabase, incluidos códigos de nueve dígitos. En iPhone VITACOACH reserva el alto del compositor sobre la conversación y, al aparecer el teclado, oculta temporalmente la barra de navegación y coloca el compositor directamente sobre él.
- El compositor de VITACOACH se reestructuró como `IonFooter` real, fuera del panel desplazable de mensajes: ahora el historial recibe únicamente el alto sobrante y nunca queda debajo de la caja de texto. En móvil se acopla al `VisualViewport` de iOS, con la navegación inferior oculta mientras el teclado está abierto. El selector de foto ofrece explícitamente tomar una fotografía, elegirla del álbum o seleccionar un archivo.
- Corrección posterior: la composición `IonFooter` no se comportó correctamente en Safari iPhone y se revirtió. El campo volvió al flujo de página, conservando el selector de foto. La solución definitiva del chat móvil queda abierta y exige validación visual en dispositivo real antes de volver a modificar su estructura.

## Adaptación nativa iOS completada en código — 14 de julio de 2026

- Proyecto Capacitor 8/Swift Package Manager generado en `apps/app/ios`, con Bundle ID `mx.vitamate.app`, iOS 15+, iPhone/iPad, icono opaco, splash y manifiesto de privacidad.
- Sesión Supabase PKCE persistida en Keychain, deep link `mx.vitamate://auth/callback`, reanudación y estado de red nativos.
- Cámara/galería nativa integradas en Nutrición y VITACOACH; archivos conservan el flujo web. El código de barras usa un escáner nativo EAN/UPC en iOS y mantiene entrada manual/`BarcodeDetector` en PWA.
- Apple Health solicita acceso contextual y muestra pasos, calorías activas y frecuencia cardiaca en reposo sin bloquear la app si se deniega.
- Compras iOS migradas a StoreKit: mensual/anual, precio localizado, restaurar y administrar. Stripe permanece exclusivamente para web y los suscriptores web conservan su entitlement al iniciar en iOS.
- API con verificación criptográfica JWS de Apple, vinculación de compra a UUID Supabase y webhook V2 idempotente. La migración `202607140012_apple_storekit.sql` ya fue aplicada al proyecto remoto.
- Eliminación de cuenta disponible dentro de Cuenta; la API cancela Stripe y elimina el usuario/datos. La interfaz advierte que las suscripciones App Store se gestionan por Apple.
- Página pública `vitamate.mx/soporte` añadida para la ficha de App Store.
- Build de app, typecheck API, lint, sincronización iOS, Capacitor Doctor y validación plist aprobados.
- El Archive/TestFlight no puede crearse en esta Mac hasta instalar Xcode completo; actualmente sólo están instaladas las Command Line Tools.

## Decisiones y trabajo pendiente

1. Las 28 guías fotográficas pasan la revisión visual interna de correspondencia suficiente para el MVP. Antes de presentarlas como material técnico validado, un entrenador o fisioterapeuta debe realizar la revisión profesional formal.
2. Brevo rechazó la comprobación desde la IP local con `401 unrecognised IP`. El propietario debe autorizar la IP de desarrollo en Brevo o realizar la prueba desde el servidor de producción; después debe confirmar remitente, DKIM y entregar un OTP real a una cuenta de prueba.
3. `vitamate.mx` ya publica el código de validación de Brevo y DMARC. `app.vitamate.mx` y `api.vitamate.mx` aún no resuelven; falta elegir/vincular los destinos de hosting y crear sus registros DNS/HTTPS. En especial, Stripe no podrá entregar el webhook corregido hasta que `api.vitamate.mx/v1/billing/webhook` sea alcanzable por HTTPS.
4. El selector de inglés está oculto con `LANGUAGE_SELECTION_ENABLED=false`. Falta completar la traducción profunda y la regresión visual/end-to-end antes de volver a mostrarlo.
5. Antes de aceptar pagos públicos faltan la razón social, domicilio, responsable y procedimiento ARCO reales; revisión jurídica mexicana; revisión profesional de reglas clínicas/nutricionales; y rotar cualquier secreto que haya sido compartido fuera del gestor seguro del hosting.
6. OpenAI Realtime/WebRTC ya está implementado y protegido por sesión y Premium. Falta la matriz final de micrófono/audio en iPhone, Android, iPad y escritorio.
7. El esquema e importadores oficiales están activos. Falta programar en el proveedor de producción las ejecuciones semanales de PROFECO y mensuales de INPC, más alertas de fallo.
8. Despliegue decidido: sitio comercial y PWA en Vercel; API en Render. Falta crear los proyectos, variables de producción, dominios `vitamate.mx`, `app.vitamate.mx` y `api.vitamate.mx`, más sus registros DNS/HTTPS.
9. Para TestFlight faltan tareas que requieren al propietario: Xcode 26+, Team de Apple Developer, App ID/capabilities, Apple numeric App ID, productos StoreKit, contratos/impuestos/banca, servidor de notificaciones, AASA con Team ID, pruebas Sandbox y metadata legal definitiva. El procedimiento está en `docs/app-store/ios-release-runbook.md`.

## Restricción local detectada

El Escritorio está sincronizado por iCloud y puede volver archivos `dataless`. La copia de trabajo estable está en `/Users/rodrigo/Developer/VITAMATE-CODIGO-WORK` y se sincroniza de vuelta a esta carpeta.
