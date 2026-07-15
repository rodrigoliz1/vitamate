# Precios oficiales para la lista del súper

VITAMATE no consulta CSV completos durante una solicitud. El backend importa observaciones oficiales, normaliza presentaciones y fija cada estimación durante la semana del plan. Sólo cambia antes de la semana siguiente cuando cambia la lista, la ubicación, el número de personas o el presupuesto.

## 1. Aplicar el esquema

La migración `202607130009_market_price_estimates.sql` crea catálogo canónico, alias revisados, productos y observaciones de mercado, estimaciones, caché, series INPC y bitácoras. Se aplica con:

```bash
corepack pnpm dlx supabase db push
```

## 2. Importar PROFECO QQP
Descarga el paquete anual desde el portal oficial de Datos Abiertos de PROFECO. En julio de 2026 el portal entrega `QQP_2026.rar`, que contiene CSV separados por mes y quincena. Extráelo e importa primero los CSV más recientes:

```bash
corepack pnpm --filter vitamate-api import:profeco -- /ruta/al/archivo.csv
```

También puede configurarse `PROFECO_QQP_SOURCE_URL` para que una tarea programada descargue el archivo. El proceso:

- lee por streaming;
- conserva fila original, URL, fecha, ciudad, estado, establecimiento y presentación;
- convierte kg→g y L→ml;
- sólo vincula alias y unidades compatibles previamente revisados;
- registra filas inválidas sin detener la importación completa;
- es idempotente mediante hashes de producto y observación.

El repositorio todavía no incluye un scheduler. En producción, ejecuta este comando semanalmente desde el cron del proveedor o CI. No publiques el script como endpoint de la PWA.

## 3. Importar INPC de INEGI

Configura la serie absoluta mensual que utiliza la calculadora oficial de INEGI:

```dotenv
INEGI_INPC_SOURCE=calculator
INEGI_INPC_INDICATOR_ID=865541
INEGI_INPC_CALCULATOR_URL=https://www.inegi.org.mx/app/indicesdeprecios/CalculadoraInflacion.aspx
INEGI_INPC_CONFIG_URL=https://www.inegi.org.mx/componentes/biinegi/config.min.js?v1.0.5
INEGI_INPC_DATA_BASE_URL=https://www.inegi.org.mx/app/api/indicadores/interna_v1_3
```

Después ejecuta:

```bash
corepack pnpm --filter vitamate-api import:inpc
```

VITAMATE sólo aplica el cociente de índices a observaciones PROFECO de más de 90 días y deja `usedInpc=true`. Si no existe una coincidencia exacta, utiliza una referencia estadística fundada de la misma categoría y unidad —o, como último respaldo, de la misma unidad a nivel nacional—, la etiqueta como `Estimación VITAMATE · PROFECO` y reduce la confianza. No genera cifras sin observaciones de mercado compatibles.

El identificador `865541` corresponde al nivel absoluto mensual del INPC general, base segunda quincena de julio de 2018 = 100. El importador obtiene el valor público de sesión desde la configuración del propio sitio de INEGI, por lo que `INEGI_API_TOKEN` no se necesita en el modo `calculator`. Sólo se requiere al seleccionar explícitamente `INEGI_INPC_SOURCE=indicator_api`.

## 4. Método de estimación

1. Prioriza al menos tres observaciones de la ciudad; después el estado y finalmente México.
2. Compara únicamente presentaciones con la misma unidad base.
3. Excluye atípicos con cercas de Tukey: Q1 − 1.5×IQR y Q3 + 1.5×IQR.
4. Calcula unidades comerciales completas, sobrante, costo consumido y desembolso económico/mediano/alto.
5. La confianza considera muestra, antigüedad, alcance geográfico, coincidencia y uso de INPC.
6. Cuando falta una coincidencia exacta, calcula el rango con observaciones PROFECO compatibles por categoría y unidad, conserva la justificación en `estimationBasis` y muestra confianza baja.
7. La clave de caché contiene la semana, lista, ciudad, personas y presupuesto; una lista ya creada no cambia por nuevas importaciones durante esa misma semana.

Fuentes oficiales: [Datos abiertos de PROFECO](https://datos.profeco.gob.mx/datos_abiertos/qqp.php), [diccionario QQP](https://datos.profeco.gob.mx/diccionarioDatosQQP.php), [calculadora de inflación del INEGI](https://www.inegi.org.mx/app/indicesdeprecios/CalculadoraInflacion.aspx) y [API de Indicadores del INEGI](https://www.inegi.org.mx/servicios/api_indicadores.html).
