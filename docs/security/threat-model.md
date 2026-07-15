# Modelo de Amenazas (VITAMATE)

## Actores y Perfiles
1. **Usuarios Malintencionados:** Buscan explotar vulnerabilidades lógicas para evadir pagos, consumir cuota de IA gratis o acceder a perfiles de terceros.
2. **Atacantes Externos / Bots:** Intentan DDOS, account takeover (fuerza bruta, credential stuffing), extracción de datos (scraping).
3. **Usuarios Internos (Admins):** Acceso a paneles sin auditoría.
4. **Vulnerabilidades de IA (Prompt Injection):** Uso malintencionado del chat para romper las directivas de seguridad (ej. pedir información médica o hacer que el sistema revele prompts internos).

## Superficies de Ataque
### API (Backend)
- Falta de Rate Limiting por endpoint.
- Inyección SQL (mitigado al usar Prisma/Drizzle/Supabase RLS).
- Fallas de autorización (IDOR - Insecure Direct Object Reference) al consultar IDs de otros usuarios.
- Replay attacks en Webhooks de pago.

### Aplicación Cliente
- Almacenamiento inseguro de tokens JWT en `localStorage`.
- XSS en el contenido generado por la IA (Markdown malicioso).

### Inteligencia Artificial
- Generación de respuestas dañinas o clínicamente peligrosas.
- Consumo masivo de tokens (Denial of Wallet).
- Procesamiento de imágenes adversarias o inapropiadas que consuman visión sin ser comida.

## Estrategias de Mitigación
1. **Autorización y Autenticación:** 
   - JWT validado mediante JWKS en el backend. 
   - Row Level Security (RLS) en Supabase: "Deny by default". Solo el `auth.uid()` accede a sus registros.
2. **Validación de Datos:** 
   - `Zod` usado en **todos** los endpoints para validar body, params y query.
3. **Seguridad en IA:**
   - LLMs configurados con system prompts rigurosos (guardrails).
   - Rate limiting a nivel usuario/plan (ej. Max X fotos/día, Max Y mensajes/minuto).
   - El LLM **NUNCA** ejecuta SQL ni llama endpoints de escritura directa sin intervención/confirmación del usuario.
4. **Almacenamiento de Archivos:**
   - Imágenes de comida y progreso son privadas (URL firmadas o buckets cerrados).
   - Se eliminan metadatos (EXIF) en cliente y backend antes del guardado.
5. **Auditoría:**
   - Loggear todas las operaciones privilegiadas y fallos de webhooks en sistemas externos, sin registrar PII ni secrets.
