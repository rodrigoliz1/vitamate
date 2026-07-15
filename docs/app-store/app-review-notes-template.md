# Notas para App Review

Copiar a App Store Connect y sustituir los campos entre corchetes.

## Cuenta de revisión

```text
Email: [CUENTA_DE_REVIEW]
Contraseña: [CONTRASEÑA]
OTP: la cuenta debe quedar confirmada antes del envío
```

La cuenta debe tener Premium activo y datos de muestra sin información de una persona real.

## Descripción

VITAMATE integra seguimiento nutricional, entrenamientos guiados y VITACOACH. La modalidad Gratis permite registrar alimentos mediante búsqueda, código de barras y alimentos personales; las funciones de IA, entrenamiento y planificación requieren Premium.

## Cómo probar

1. Iniciar sesión con la cuenta anterior; no es necesario repetir el onboarding.
2. Nutrición → buscar y registrar un alimento.
3. Nutrición → cámara → tomar o elegir una foto y confirmar la estimación.
4. Entrenar → elegir gimnasio/casa → iniciar y completar una sesión.
5. VITACOACH → chat; para llamada conceder micrófono.
6. Progreso → Conectar Apple Health. El permiso sólo aparece después de este toque y puede denegarse.
7. Nombre del usuario → Suscripción → Restaurar/Administrar en App Store.
8. Nombre del usuario → Eliminar mi cuenta y mis datos.

## Aclaraciones

- Las recomendaciones de IA son orientación de bienestar, no diagnóstico ni atención de urgencia.
- Las fotos de comida producen estimaciones que el usuario confirma antes de registrar.
- Apple Health se lee sólo después de consentimiento contextual; negar permisos no bloquea la app.
- Las nuevas compras dentro de iOS usan exclusivamente In-App Purchase.
- La app requiere internet para IA, sincronización, pagos y catálogos remotos.

## URLs

- Privacidad: `https://vitamate.mx/privacidad`
- Términos: `https://vitamate.mx/terminos`
- Soporte: `https://vitamate.mx/soporte`
- Notificaciones App Store: `https://api.vitamate.mx/v1/billing/apple/notifications`
