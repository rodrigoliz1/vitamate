import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand"><BrandMark inverse /><p>La vida fit que se adapta a tu vida.</p></div>
        <div className="footer-links"><strong>Descubre</strong><Link href="/funciones">Funciones</Link><Link href="/como-funciona">Cómo funciona</Link><Link href="/precios">Planes</Link><Link href="/fuentes">Fuentes</Link></div>
        <div className="footer-links"><strong>VITAMATE</strong><Link href="/nosotros">Nosotros</Link><Link href="/privacidad">Privacidad</Link><Link href="/terminos">Términos</Link><a href="mailto:contacto@vitamate.mx">Contacto</a></div>
        <div className="footer-note"><span>Hecho en México</span><p>Orientación de bienestar asistida por IA. No sustituye diagnóstico ni atención profesional.</p></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} VITAMATE</span><span>vitamate.mx</span></div>
    </footer>
  );
}
