import type { ReactNode } from "react";
import { PageShell } from "./PageShell";

export function LegalPage({ eyebrow, title, updated, sections }: { eyebrow: string; title: string; updated: string; sections: readonly (readonly [string, ReactNode])[] }) {
  return <PageShell><section className="legal-hero section-shell"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{updated}</p></section><div className="legal-layout section-shell"><aside><span>Contenido</span>{sections.map(([heading]) => <a key={heading} href={`#${heading.split(".")[0]}`}>{heading}</a>)}</aside><article className="legal-document"><div className="legal-callout"><strong>Documento en preparación para lanzamiento</strong><p>Este texto describe el funcionamiento previsto. Los datos corporativos y condiciones definitivas deben validarse con asesoría jurídica mexicana antes de aceptar usuarios de producción.</p></div>{sections.map(([heading, content]) => <section key={heading} id={heading.split(".")[0]}><h2>{heading}</h2>{content}</section>)}</article></div></PageShell>;
}
