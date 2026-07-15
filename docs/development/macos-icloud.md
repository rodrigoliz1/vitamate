# Desarrollo en macOS con iCloud

VITAMATE está actualmente bajo una carpeta de Escritorio sincronizada por iCloud. Para herramientas como Vite, TypeScript y pnpm, todos los archivos del proyecto deben permanecer disponibles localmente.

## Configuración recomendada

1. Abre Finder y localiza `VITAMATE CODIGO`.
2. Haz clic secundario en la carpeta.
3. Selecciona **Mantener descargado**.
4. Espera a que desaparezca el indicador de descarga.
5. Ejecuta desde la carpeta del proyecto:

```bash
pnpm install
pnpm --filter vitamate-app dev
```

Si iCloud continúa expulsando archivos, mueve el repositorio a una carpeta local no sincronizada, por ejemplo `~/Developer/VITAMATE`, y conserva el repositorio remoto como respaldo.

No guardes secretos en `.env` dentro de iCloud. Usa variables del entorno de despliegue o un gestor de secretos y agrega solo claves ya rotadas.
