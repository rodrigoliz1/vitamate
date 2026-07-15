import type { Metadata } from "next";
import { AppEntry } from "@/components/AppEntry";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = { title: "Planes", description: "VITAMATE Gratis y Premium mensual o anual con siete días de prueba para cuentas elegibles." };

const included = ["VITACOACH por chat y voz", "Planes de entrenamiento adaptativos", "Plan alimenticio y macros semanales", "Registro por foto, texto y código", "Lista del súper y costo estimado", "Historial y respaldo en la nube"];

const faqs = [
  ["¿Cómo funciona la prueba?", "Las cuentas elegibles reciben siete días Premium una sola vez. Stripe mostrará la fecha y el importe de la primera renovación antes de confirmar."],
  ["¿Puedo cancelar?", "Sí. Podrás gestionar o cancelar la renovación desde el portal seguro de Stripe. El acceso permanece hasta terminar el periodo vigente."],
  ["¿Qué ocurre si termina mi suscripción?", "Tu cuenta vuelve automáticamente al plan Gratis. Tus datos se conservan y puedes reactivar Premium desde tu perfil."],
  ["¿VITAMATE reemplaza a un profesional?", "No. Es una herramienta de orientación y seguimiento de bienestar; no diagnostica ni sustituye atención médica, psicológica o nutricional profesional."],
  ["¿Los precios pueden cambiar?", "Los precios mostrados son la propuesta vigente para lanzamiento y se confirmarán antes del cobro. Cualquier cambio futuro se comunicará conforme a la ley."],
];

const monthlyPrice = Number(process.env.NEXT_PUBLIC_PREMIUM_MONTHLY_MXN ?? 349);
const annualPrice = Number(process.env.NEXT_PUBLIC_PREMIUM_ANNUAL_MXN ?? 2999);
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);

export default function PricingPage() {
  return <PageShell>
    <section className="subhero centered section-shell"><Reveal><span className="eyebrow">Empieza con siete días Premium</span><h1>Invierte en una rutina<br /><em>que puedas conservar.</em></h1><p>Entrenamiento, nutrición, seguimiento y VITACOACH en una experiencia conectada. La prueba gratuita está disponible una sola vez por cuenta elegible.</p></Reveal></section>
    <section className="pricing-grid section-shell">
      <Reveal><article className="price-card"><span className="trial-pill">7 días gratis</span><span className="eyebrow">Premium mensual</span><div className="price"><strong>{money(monthlyPrice)}</strong><span>MXN / mes después de la prueba</span></div><p>Flexibilidad para comenzar y gestionar la renovación desde el portal seguro.</p><AppEntry className="button button-outline button-wide">Probar Premium mensual</AppEntry></article></Reveal>
      <Reveal delay={90}><article className="price-card featured"><span className="save-pill">Mejor valor</span><span className="eyebrow light">Premium anual</span><div className="price"><strong>{money(annualPrice)}</strong><span>MXN / año después de la prueba</span></div><p>La experiencia completa por aproximadamente {money(Math.round(annualPrice / 12))} MXN al mes.</p><AppEntry className="button button-light button-wide">Probar Premium anual</AppEntry></article></Reveal>
      <Reveal delay={150}><article className="price-card free"><span className="eyebrow">VITAMATE Gratis</span><div className="price"><strong>$0</strong><span>sin tarjeta</span></div><p>Contador de calorías y macros, búsqueda de alimentos, código de barras y alimentos personales. Sin funciones de IA.</p><AppEntry className="button button-quiet button-wide">Continuar gratis</AppEntry></article></Reveal>
      <Reveal delay={190} className="included-reveal"><article className="included-card"><span className="eyebrow">Premium incluye</span><ul>{included.map(item => <li key={item}><span>✓</span>{item}</li>)}</ul><small>Los importes definitivos, impuestos y elegibilidad de prueba se confirman antes de aceptar el cobro en Stripe. El acceso Premium depende de eventos de pago verificados.</small></article></Reveal>
    </section>
    <section className="faq section-shell"><Reveal><span className="eyebrow">Preguntas claras</span><h2>Antes de elegir</h2></Reveal>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</section>
  </PageShell>;
}
