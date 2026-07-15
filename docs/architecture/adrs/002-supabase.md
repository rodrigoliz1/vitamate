# ADR-002: Adopción de Supabase (PostgreSQL, Auth, Storage)

## Estado
Aceptado

## Contexto
VITAMATE necesita tres servicios de infraestructura fundamentales:
1. **Base de datos relacional** con soporte para JSON, full-text search y Row Level Security.
2. **Autenticación** con JWT, OAuth social (Google, Apple Sign-In), verificación de email y gestión de sesiones.
3. **Almacenamiento de archivos** con buckets privados y URLs firmadas para imágenes sensibles (fotos de progreso corporal, fotos de comida).

Las alternativas evaluadas fueron:

| Criterio | Supabase | Firebase | AWS (RDS + Cognito + S3) | PlanetScale + Auth0 + Cloudflare R2 |
|---|---|---|---|---|
| Base de datos | PostgreSQL completo | Firestore (NoSQL) | PostgreSQL | MySQL (sin FK en free tier) |
| Auth integrado | ✅ GoTrue + JWKS | ✅ Firebase Auth | ✅ Cognito | ✅ Auth0 |
| Storage integrado | ✅ S3-compatible | ✅ Cloud Storage | ✅ S3 | ❌ Separado |
| Row Level Security | ✅ Nativo PostgreSQL | ❌ Reglas propietarias | ✅ Con esfuerzo | ❌ |
| Costo MVP (< 10K users) | $0–$25/mes | $0–$25/mes | ~$50+/mes | ~$60+/mes |
| Vendor lock-in | Bajo (es PostgreSQL) | Alto (NoSQL propietario) | Medio | Medio |
| Self-host posible | ✅ Docker Compose | ❌ | ❌ | ❌ |
| Ecosistema TypeScript | ✅ SDK oficial | ✅ SDK oficial | ⚠️ AWS SDK pesado | ⚠️ Múltiples SDKs |

## Decisión
Se ha decidido adoptar **Supabase** como plataforma de infraestructura principal para:
- **PostgreSQL gestionado** como base de datos primaria.
- **Supabase Auth (GoTrue)** como proveedor de autenticación.
- **Supabase Storage** como almacenamiento de archivos privados.

### Justificación detallada

#### PostgreSQL como base de datos
VITAMATE tiene un modelo de datos inherentemente relacional: usuarios tienen perfiles, perfiles tienen planes de nutrición, planes contienen comidas, comidas referencian alimentos del catálogo. PostgreSQL ofrece:
- **Row Level Security (RLS):** Seguridad a nivel de fila que garantiza que un usuario solo acceda a sus propios datos. Se configura como "deny by default".
- **JSONB:** Para columnas de metadata flexible sin sacrificar la integridad relacional.
- **UUIDs nativos:** Generación de identificadores universales sin colisiones.
- **Extensiones:** `pgcrypto`, `pg_trgm` (búsqueda fuzzy de alimentos), `postgis` (futuro uso geográfico).

#### Supabase Auth
- Genera JWTs estándar validables mediante JWKS endpoint en el backend Fastify.
- Soporta email/password, magic links, OAuth (Google, Apple Sign-In).
- El JWT incluye `sub` (user_id) que se usa como clave foránea universal (`user_id` en todas las tablas).
- No se usa el SDK de Supabase en el frontend para queries directas; toda la comunicación pasa por la API de Fastify.

#### Supabase Storage
- Buckets privados con políticas RLS (solo el dueño del archivo puede acceder).
- URLs firmadas con expiración configurable (5 minutos por defecto).
- Compatible con S3 API, lo que permite migración futura sin cambios de código.
- Formato de almacenamiento: `users/{userId}/food/{year}/{month}/{uuid}.webp`.

## Reglas de Uso

### Lo que SÍ se usa de Supabase
- PostgreSQL como base de datos (via conexión directa o pooler).
- Auth para registro, login, verificación de email, recuperación de contraseña, OAuth.
- Storage para imágenes (comida, progreso).
- Dashboard para administración y monitoreo de la base de datos.

### Lo que NO se usa de Supabase
- **Supabase Realtime:** Se usa SSE desde Fastify para el streaming del Coach IA.
- **Supabase Edge Functions:** Toda la lógica de negocio vive en la API de Fastify.
- **Supabase SDK en cliente para queries:** El cliente solo habla con `/v1/*` de la API.
- **PostgREST directo:** No se expone; la API de Fastify es el único punto de acceso.

## Consecuencias

### Positivas
- **Seguridad por defecto:** RLS elimina una categoría entera de vulnerabilidades IDOR.
- **Costo predecible:** El tier gratuito cubre desarrollo y staging. El Pro ($25/mes) cubre hasta ~100K usuarios activos mensuales.
- **Portabilidad:** Si Supabase desaparece o cambia de pricing, se puede migrar a cualquier PostgreSQL gestionado (Neon, Railway, RDS) con mínimo esfuerzo.
- **DX (Developer Experience):** Dashboard visual, logs de Auth, editor SQL integrado, y CLI para migraciones.
- **Eliminación de cuenta:** Supabase Auth soporta `admin.deleteUser()` requerido por Apple App Store.

### Negativas
- **Dependencia en disponibilidad de Supabase:** Un outage de Supabase afecta Auth, DB y Storage simultáneamente. Mitigación: monitoreo con alertas y runbook de contingencia.
- **Complejidad de RLS:** Las políticas RLS pueden volverse complejas para queries multi-tabla. Se mitigará con tests automatizados de políticas.
- **Connection pooling:** Supabase usa PgBouncer en modo transacción por defecto, lo que impide prepared statements persistentes. Se debe configurar correctamente el pool del ORM/query builder.

## Referencias
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [GoTrue Auth Server](https://github.com/supabase/gotrue)
