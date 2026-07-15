import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
}

const source = process.env.INEGI_INPC_SOURCE ?? 'calculator';
const indicatorId = process.env.INEGI_INPC_INDICATOR_ID ?? '865541';
const calculatorPageUrl = process.env.INEGI_INPC_CALCULATOR_URL
  ?? 'https://www.inegi.org.mx/app/indicesdeprecios/CalculadoraInflacion.aspx';
const configUrl = process.env.INEGI_INPC_CONFIG_URL
  ?? 'https://www.inegi.org.mx/componentes/biinegi/config.min.js?v1.0.5';
const dataBaseUrl = (process.env.INEGI_INPC_DATA_BASE_URL
  ?? 'https://www.inegi.org.mx/app/api/indicadores/interna_v1_3').replace(/\/$/, '');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const spanishMonths = new Map([
  ['ene', '01'], ['feb', '02'], ['mar', '03'], ['abr', '04'],
  ['may', '05'], ['jun', '06'], ['jul', '07'], ['ago', '08'],
  ['sep', '09'], ['oct', '10'], ['nov', '11'], ['dic', '12'],
]);

function parseCalculatorObservation(value) {
  const [label, rawIndex] = String(value).split('&');
  const match = label?.trim().match(/^([A-Za-zÁÉÍÓÚáéíóú]{3})-(\d{4})$/);
  const month = match ? spanishMonths.get(match[1].toLocaleLowerCase('es-MX')) : null;
  const indexValue = Number(rawIndex);
  if (!match || !month || !Number.isFinite(indexValue) || indexValue <= 0) return null;
  const period = `${match[2]}-${month}`;
  return {
    source: 'inegi_inpc',
    indicator_id: String(indicatorId),
    category: 'General',
    geography_code: '00000',
    period,
    index_value: indexValue,
    observed_at: `${period}-01`,
    source_url: calculatorPageUrl,
    raw_source_data: { label, value: rawIndex, sourceMechanism: 'CalculadoraINPInformacion' },
  };
}

function parseIndicatorPeriod(period) {
  const match = String(period).match(/^(\d{4})[-/]?(\d{2})/);
  return match ? { period: `${match[1]}-${match[2]}`, observedAt: `${match[1]}-${match[2]}-01` } : null;
}

async function fetchCalculatorRows() {
  // La calculadora obtiene un token público desde la configuración del propio
  // sitio. Se resuelve en cada importación para no tratarlo como secreto ni
  // depender de INEGI_API_TOKEN.
  const configResponse = await fetch(configUrl, { signal: AbortSignal.timeout(20_000) });
  if (!configResponse.ok) throw new Error(`No fue posible cargar la configuración oficial de INEGI (${configResponse.status}).`);
  const configSource = await configResponse.text();
  const siteToken = configSource.match(/C_token\s*=\s*["']([^"']+)/)?.[1];
  if (!siteToken) throw new Error('INEGI no publicó el token de sitio esperado en su configuración oficial.');

  const requestUrl = `${dataBaseUrl}/CalculadoraINPInformacion/${encodeURIComponent(indicatorId)}/null/true/json/${encodeURIComponent(siteToken)}`;
  const response = await fetch(requestUrl, { signal: AbortSignal.timeout(30_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`INEGI respondió ${response.status}. Respuesta: ${body.slice(0, 1000)}`);
  const raw = JSON.parse(body);
  const rows = (Array.isArray(raw?.datos) ? raw.datos : []).map(parseCalculatorObservation).filter(Boolean);
  if (!rows.length) throw new Error('La calculadora oficial de INEGI respondió HTTP 200, pero no incluyó niveles mensuales utilizables.');
  return rows;
}

async function fetchPublicIndicatorRows() {
  if (!process.env.INEGI_API_TOKEN) {
    throw new Error('INEGI_API_TOKEN sólo es obligatorio cuando INEGI_INPC_SOURCE=indicator_api.');
  }
  const geographyCode = '00000';
  const requestUrl = `https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/${encodeURIComponent(indicatorId)}/es/${geographyCode}/false/BISE/2.0/${encodeURIComponent(process.env.INEGI_API_TOKEN)}?type=json`;
  const response = await fetch(requestUrl, { signal: AbortSignal.timeout(30_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`INEGI respondió ${response.status}. Respuesta: ${body.slice(0, 1000)}`);
  const raw = JSON.parse(body);
  const observations = raw?.Series?.[0]?.OBSERVATIONS ?? [];
  const rows = observations.flatMap((observation) => {
    const parsed = parseIndicatorPeriod(observation.TIME_PERIOD);
    const indexValue = Number(observation.OBS_VALUE);
    if (!parsed || !Number.isFinite(indexValue) || indexValue <= 0) return [];
    return [{
      source: 'inegi_inpc', indicator_id: String(indicatorId), category: 'General', geography_code: geographyCode,
      period: parsed.period, index_value: indexValue, observed_at: parsed.observedAt,
      source_url: requestUrl.replace(process.env.INEGI_API_TOKEN, '[TOKEN]'), raw_source_data: observation,
    }];
  });
  if (!rows.length) throw new Error('La API pública de indicadores no devolvió niveles mensuales utilizables.');
  return rows;
}

const rows = source === 'calculator'
  ? await fetchCalculatorRows()
  : source === 'indicator_api'
    ? await fetchPublicIndicatorRows()
    : (() => { throw new Error(`INEGI_INPC_SOURCE no soportado: ${source}`); })();

for (let index = 0; index < rows.length; index += 500) {
  const { error } = await db.from('price_index_observations').upsert(rows.slice(index, index + 500), {
    onConflict: 'source,indicator_id,geography_code,period',
  });
  if (error) throw error;
}

// No se invalidan listas semanales ya calculadas. Permanecen fijas hasta su
// vencimiento o hasta que cambie la lista, ubicación, personas o presupuesto.
console.log(`General: ${rows.length} niveles absolutos mensuales del INPC importados desde ${source} (indicador ${indicatorId}).`);
