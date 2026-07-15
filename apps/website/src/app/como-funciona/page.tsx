import type { Metadata } from "next";
import { AppEntry } from "@/components/AppEntry";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = { title: "Cómo funciona", description: "Del quiz inicial al seguimiento semanal adaptativo de VITAMATE." };
const steps = [
  ["01", "Cuéntanos cómo vives", "Objetivos, experiencia, horarios, gustos, restricciones, suplementos, presupuesto, cocina y forma preferida de entrenar."],
  ["02", "Recibe una semana practicable", "VITAMATE organiza entrenamientos y comidas alrededor de tu disponibilidad; tú confirmas y puedes cambiar cualquier propuesta."],
  ["03", "Registra sin fricción", "Texto, voz, fotografía, búsqueda, código de barras o un toque durante el entrenamiento. El sistema pide confirmación cuando hay una estimación."],
  ["04", "Aprende y ajusta", "El balance semanal y tu percepción de esfuerzo permiten ajustar el siguiente paso sin borrar el progreso por un día imperfecto."],
] as const;

export default function HowItWorksPage() {
  return <PageShell><section className="subhero centered section-shell"><Reveal><span className="eyebrow">De cero a acompañado</span><h1>Personal desde el inicio.<br /><em>Más preciso con el tiempo.</em></h1><p>VITAMATE combina tus decisiones, registros y retroalimentación. Tú conservas el control.</p></Reveal></section><section className="process section-shell">{steps.map(([number, title, text], index) => <Reveal key={number} delay={index * 70}><article><span>{number}</span><div><h2>{title}</h2><p>{text}</p></div><i>↘</i></article></Reveal>)}</section><section className="method-grid section-shell"><Reveal><div className="method-card dark"><span className="eyebrow light">El principio</span><h2>Una meta semanal.<br />Siete oportunidades.</h2><p>Calorías, macronutrientes y actividad se observan en conjunto. La flexibilidad no elimina la dirección; la hace sostenible.</p></div></Reveal><Reveal delay={100}><div className="method-card pale"><span className="eyebrow">Tu decisión siempre manda</span><h2>IA que propone.<br />Tú confirmas.</h2><p>Una fotografía de comida o un consejo de entrenamiento no se trata como verdad absoluta. Puedes corregir cantidades, rechazar opciones y editar tus datos.</p></div></Reveal></section><section className="simple-cta section-shell"><Reveal><h2>Tu primera semana empieza con una conversación honesta.</h2><p>No necesitas tener todo resuelto para comenzar.</p><AppEntry>Crear mi perfil <span>→</span></AppEntry></Reveal></section></PageShell>;
}
