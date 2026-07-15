import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Soporte",
  description: "Ayuda, contacto y administración de cuenta para usuarios de VITAMATE.",
};

export default function SupportPage() {
  return <PageShell>
    <section className="legal-hero section-shell">
      <span className="eyebrow">Estamos contigo</span>
      <h1>Soporte VITAMATE</h1>
      <p>Ayuda para tu cuenta, suscripción y experiencia en la app.</p>
    </section>
    <div className="legal-layout section-shell">
      <aside><span>Ayuda</span><a href="#contacto">Contacto</a><a href="#cuenta">Cuenta</a><a href="#suscripcion">Suscripción</a><a href="#privacidad">Privacidad</a></aside>
      <article className="legal-document">
        <section id="contacto"><h2>Contacto</h2><p>Escríbenos a <a href="mailto:soporte@vitamate.mx">soporte@vitamate.mx</a>. Incluye el correo de tu cuenta, el dispositivo y una descripción del problema. Nunca envíes contraseñas, códigos OTP ni datos completos de pago.</p></section>
        <section id="cuenta"><h2>Cuenta y acceso</h2><p>Puedes recuperar tu contraseña desde la pantalla de inicio de sesión. Para eliminar definitivamente tu cuenta y sus datos, entra en la app, abre tu nombre, selecciona <strong>Eliminar mi cuenta y mis datos</strong> y confirma la acción.</p></section>
        <section id="suscripcion"><h2>Suscripciones</h2><p>Las compras realizadas en iPhone se administran desde tu cuenta de App Store. En la app abre Cuenta → Suscripción → Administrar en App Store. Las compras realizadas en vitamate.mx se administran desde el mismo sitio.</p></section>
        <section id="privacidad"><h2>Privacidad y seguridad</h2><p>Consulta nuestro <Link href="/privacidad">Aviso de privacidad</Link> y los <Link href="/terminos">Términos de uso</Link>. Para ejercer derechos de privacidad escribe a <a href="mailto:privacidad@vitamate.mx">privacidad@vitamate.mx</a>.</p></section>
      </article>
    </div>
  </PageShell>;
}
