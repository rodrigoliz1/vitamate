import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = { title: "Fuentes y metodología", description: "Transparencia sobre las fuentes de datos y límites de las estimaciones de VITAMATE." };

const sources = [
  { tag: "NUTRICIÓN", name: "USDA FoodData Central", href: "https://fdc.nal.usda.gov/", text: "Referencia de composición nutricional para alimentos genéricos y productos disponibles en su catálogo." },
  { tag: "PRODUCTOS", name: "Open Food Facts", href: "https://world.openfoodfacts.org/", text: "Datos colaborativos de productos y códigos de barras. Pueden ser incompletos y siempre deben contrastarse con la etiqueta." },
  { tag: "PRECIOS", name: "PROFECO · Quién es Quién en los Precios", href: "https://datos.profeco.gob.mx/datos_abiertos/qqp.php", text: "Observaciones de precios, establecimientos, presentaciones y localidades para estimar el costo de compra en México." },
  { tag: "ACTUALIZACIÓN", name: "INEGI · INPC", href: "https://www.inegi.org.mx/app/indicesdeprecios/CalculadoraInflacion.aspx", text: "Nivel absoluto mensual del INPC general para actualizar observaciones antiguas cuando no existe información suficientemente reciente." },
] as const;

export default function SourcesPage() {
  return <PageShell><section className="subhero section-shell"><Reveal><span className="eyebrow">Transparencia antes que certeza falsa</span><h1>De dónde vienen<br /><em>los datos.</em></h1><p>VITAMATE combina fuentes oficiales, abiertas y datos aportados por el usuario. Una estimación siempre se presenta como estimación.</p></Reveal></section><section className="sources-grid section-shell">{sources.map((source, index) => <Reveal key={source.name} delay={index * 70}><a href={source.href} target="_blank" rel="noreferrer"><span>{source.tag}</span><h2>{source.name}</h2><p>{source.text}</p><b>Visitar fuente oficial ↗</b></a></Reveal>)}</section><section className="methodology section-shell"><Reveal><span className="eyebrow">Cómo se construye un estimado</span><h2>Precio observable, coincidencia compatible y una confianza explícita.</h2></Reveal><div className="method-steps">{[["01", "Normalizar", "Ingredientes en gramos, mililitros o piezas y presentaciones comerciales comparables."], ["02", "Priorizar", "Misma ciudad, observaciones recientes y coincidencias exactas antes de ampliar la búsqueda."], ["03", "Robustecer", "Mediana y descarte de valores anómalos. INPC sólo para actualizar datos históricos."], ["04", "Comunicar", "Rango económico, central y alto; fuente, fecha, muestra y confianza." ]].map(([n,t,d], i) => <Reveal key={n} delay={i*60}><article><span>{n}</span><h3>{t}</h3><p>{d}</p></article></Reveal>)}</div><div className="source-warning"><strong>Importante</strong><p>Los precios son aproximados y pueden variar según la tienda, marca, presentación, disponibilidad, ciudad y fecha de compra. Los datos nutricionales también pueden contener errores o diferencias de preparación.</p></div></section></PageShell>;
}
