import Link from "next/link";
import Image from "next/image";
import { AppEntry } from "@/components/AppEntry";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";

const features = [
  { number: "01", icon: "✦", title: "VITACOACH", text: "Un coach que conversa, recuerda tu contexto y convierte lo que cuentas en acciones: comidas, actividad, ajustes y seguimiento." },
  { number: "02", icon: "↗", title: "Entrena con intención", text: "Rutinas adaptadas a casa o gym, registro set por set y progresión basada en tu desempeño real." },
  { number: "03", icon: "◒", title: "Nutrición practicable", text: "Planes por comidas, macros semanales, reconocimiento por foto y una lista del súper que considera tu presupuesto." },
] as const;

export default function Home() {
  return (
    <PageShell className="home-page">
      <section className="hero section-shell">
        <div className="hero-copy">
          <Reveal><span className="eyebrow">Entrenamiento + nutrición + compañía</span><h1>Tu vida cambia.<br /><em>Tu plan también.</em></h1></Reveal>
          <Reveal delay={90}><p>VITAMATE aprende de tu ritmo para ayudarte a comer mejor, entrenar con constancia y avanzar sin convertir tu vida en una hoja de cálculo.</p><div className="hero-actions"><AppEntry>Comenzar ahora <span>→</span></AppEntry><Link className="text-link" href="/como-funciona">Ver cómo funciona <span>↘</span></Link></div></Reveal>
          <Reveal delay={160}><div className="trust-line"><span className="avatar-stack"><i>R</i><i>M</i><i>A</i></span><div><b>Una semana, no un día perfecto</b><small>Balance flexible y seguimiento que sí cabe en la vida real.</small></div></div></Reveal>
        </div>
        <Reveal className="hero-visual" delay={120}>
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="floating-note note-one"><span>Balance semanal</span><strong>Proteína · 82%</strong><i><b /></i></div>
          <div className="floating-note note-two"><span>Próximo avance</span><strong>+1 repetición</strong><small>Sobrecarga progresiva</small></div>
          <div className="hero-phone">
            <div className="phone-top"><span>9:41</span><i /></div>
            <div className="app-greeting"><small>Buenos días, Rodrigo</small><strong>Hoy avanzamos juntos.</strong></div>
            <div className="coach-card"><div className="coach-orb">VC</div><div><small>VITACOACH</small><b>¿Cómo te sientes hoy?</b><p>Puedo ajustar tu entrenamiento o ayudarte con tu desayuno.</p></div></div>
            <div className="day-score"><div><small>Balance de hoy</small><b>1,840 <em>kcal</em></b></div><span>76%</span></div>
            <div className="macro-bars"><i style={{ "--value": "82%" } as React.CSSProperties}><span>Proteína</span><b /></i><i style={{ "--value": "68%" } as React.CSSProperties}><span>Carbos</span><b /></i><i style={{ "--value": "74%" } as React.CSSProperties}><span>Grasas</span><b /></i></div>
            <div className="next-workout"><span className="workout-glyph">↗</span><div><small>ENTRENAMIENTO</small><b>Fuerza · Día A</b><p>32 min · 5 ejercicios</p></div><strong>›</strong></div>
            <div className="phone-nav"><b>⌂</b><span>◎</span><span>✦</span><span>◌</span></div>
          </div>
        </Reveal>
      </section>

      <section className="manifesto section-shell">
        <Reveal><span className="eyebrow">Una idea diferente de constancia</span><p className="statement">No se trata de vivir para el plan.<br />Se trata de construir <em>un plan que viva contigo.</em></p></Reveal>
      </section>

      <section className="feature-editorial section-shell">
        <div className="section-heading"><Reveal><span className="eyebrow">Todo conectado</span><h2>Un compañero.<br />Tres formas de avanzar.</h2></Reveal><Reveal delay={100}><p>Lo que comes, cómo entrenas y cómo te sientes no viven en sistemas separados. VITAMATE los entiende como una sola historia.</p></Reveal></div>
        <div className="feature-list">{features.map((feature, index) => <Reveal key={feature.number} delay={index * 80}><article><span className="feature-number">{feature.number}</span><div className="feature-icon">{feature.icon}</div><h3>{feature.title}</h3><p>{feature.text}</p><Link href="/funciones">Explorar <span>→</span></Link></article></Reveal>)}</div>
      </section>

      <section className="product-proof section-shell">
        <div className="section-heading product-proof-heading">
          <Reveal><span className="eyebrow">La experiencia real</span><h2>Todo tu progreso,<br />en un mismo lugar.</h2></Reveal>
          <Reveal delay={100}><p>Tu día, tus entrenamientos y tus señales de salud se convierten en decisiones claras. Sin brincar entre cinco aplicaciones ni reconstruir tu contexto cada mañana.</p></Reveal>
        </div>
        <div className="product-proof-grid">
          <Reveal className="product-shot product-shot-main" delay={60}>
            <Image src="/product/dashboard.webp" alt="Panel principal de VITAMATE con nutrición y progreso semanal" width={620} height={1291} sizes="(max-width: 760px) 84vw, 390px" />
            <span><b>Tu día, de un vistazo</b><small>Nutrición, entrenamiento y acciones importantes.</small></span>
          </Reveal>
          <div className="product-proof-side">
            <Reveal className="product-shot product-shot-side" delay={130}>
              <Image src="/product/training.webp" alt="Entrenamiento personalizado dentro de VITAMATE" width={620} height={1291} sizes="(max-width: 760px) 72vw, 300px" />
              <span><b>Entrena con estructura</b><small>Rutinas listas para ejecutar y registrar.</small></span>
            </Reveal>
            <Reveal className="product-shot product-shot-side product-shot-health" delay={200}>
              <Image src="/product/apple-health.webp" alt="Conexión de VITAMATE con Apple Health" width={620} height={1286} sizes="(max-width: 760px) 72vw, 300px" />
              <span><b>Tu salud, conectada</b><small>Actividad, frecuencia cardiaca y sueño.</small></span>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="coach-showcase">
        <div className="section-shell showcase-grid">
          <Reveal className="showcase-copy"><span className="eyebrow light">Conoce a VITACOACH</span><h2>Un chat que<br /><em>sí te conoce.</em></h2><p>Cuéntale que desayunaste, que estás cansado o que hoy preferiste correr. VITACOACH conecta esa conversación con tu seguimiento y aprende lo que te funciona.</p><ul><li><span>✓</span> Conversaciones con memoria útil y controlada</li><li><span>✓</span> Análisis de alimentos por texto o fotografía</li><li><span>✓</span> Voz natural para conversar sin usar las manos</li></ul><Link className="button button-light" href="/funciones#vitacoach">Descubrir VITACOACH</Link></Reveal>
          <Reveal className="chat-stage" delay={100}>
            <div className="chat-glow" />
            <figure className="real-app-shot real-app-shot-coach">
              <Image src="/product/vitacoach.webp" alt="Conversación real con VITACOACH dentro de la aplicación" width={620} height={1286} sizes="(max-width: 760px) 78vw, 390px" />
              <figcaption><i /> Conversación real dentro de VITAMATE</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="weekly-section section-shell">
        <Reveal className="weekly-visual">
          <figure className="real-app-shot real-app-shot-weekly">
            <Image src="/product/weekly-plan.webp" alt="Plan semanal de alimentación y lista de compras en VITAMATE" width={620} height={1291} sizes="(max-width: 760px) 78vw, 390px" />
            <figcaption><i /> Planeación semanal que se adapta a ti</figcaption>
          </figure>
        </Reveal>
        <Reveal className="weekly-copy" delay={120}><span className="eyebrow">Flexibilidad con dirección</span><h2>Tu semana cuenta más que un martes imperfecto.</h2><p>Un exceso o una comida improvisada no cancela tu progreso. VITAMATE redistribuye el balance de calorías, macros y actividad durante la semana para mantener una meta realista.</p><Link className="text-link dark" href="/como-funciona">Así se adapta tu plan <span>→</span></Link></Reveal>
      </section>

      <section className="final-cta section-shell"><Reveal><div className="cta-panel"><span className="eyebrow light">Tu siguiente semana puede sentirse distinta</span><h2>Menos culpa.<br />Más claridad.<br /><em>Progreso que permanece.</em></h2><AppEntry className="button button-light">Crear mi plan <span>→</span></AppEntry><p>Disponible como Web App · iPhone y escritorio</p></div></Reveal></section>
    </PageShell>
  );
}
