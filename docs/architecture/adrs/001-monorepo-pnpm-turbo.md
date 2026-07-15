# ADR-001: Adopción de Monorepositorio con pnpm y Turborepo

## Estado
Aceptado

## Contexto
El ecosistema VITAMATE requiere escalar ordenadamente. Actualmente sabemos que tendremos una web pública, una aplicación PWA/Nativa, una API backend y un panel administrativo, compartiendo configuraciones, componentes UI y lógica de negocio.
Si dividimos esto en repositorios separados, enfrentaremos problemas de versionado, duplicación de código y sobrecarga cognitiva para los desarrolladores.

## Decisión
Se ha decidido adoptar una arquitectura de **Monorepositorio** utilizando:
- **pnpm** como gestor de paquetes. Sus workspaces son robustos y su instalación basada en symlinks duros (store) reduce drásticamente el espacio en disco y el tiempo de instalación.
- **Turborepo** como orquestador de compilación. Permite cacheo agresivo (local y en nube), ejecución paralela y control fino de las dependencias entre paquetes (ej. no construir el `app` sin haber construido `packages/ui`).

## Consecuencias
### Positivas
- **DRY (Don't Repeat Yourself):** Los esquemas de Zod, componentes visuales, hooks y validaciones se centralizan en la carpeta `packages/`.
- **Productividad:** Las actualizaciones son atómicas. Un cambio en un componente se refleja inmediatamente en todas las apps que lo consumen.
- **Onboarding:** Un desarrollador clona un solo repositorio, hace `pnpm install` y está listo para correr el sistema completo.

### Negativas
- **Curva de Aprendizaje:** Comprender la estructura de dependencias internas de Turborepo requiere lectura inicial.
- **Deployment:** Es necesario configurar correctamente Vercel y Render para que ignoren builds innecesarias mediante el filtrado de comandos (ej. `npx turbo-ignore`).
