"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:4174";

export function AppEntry({ children = "Ingresar", className = "button button-primary" }: { children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [open]);

  function enterApp() {
    if (window.localStorage.getItem("vitamate-install-guide-seen") === "1") {
      window.location.assign(appUrl);
      return;
    }
    setOpen(true);
  }

  function continueToApp() {
    window.localStorage.setItem("vitamate-install-guide-seen", "1");
    window.location.assign(appUrl);
  }

  return (
    <>
      <button type="button" className={className} onClick={enterApp}>{children}</button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="install-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="install-guide" role="dialog" aria-modal="true" aria-labelledby="install-title">
            <button className="install-close" type="button" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
            <div className="install-copy">
              <span className="eyebrow">Tu app, siempre a un toque</span>
              <h2 id="install-title">Agrega VITAMATE a tu iPhone</h2>
              <p>No necesitas descargar nada. Safari puede instalar la Web App en tu pantalla de inicio.</p>
              <ol className="install-steps">
                <li><span>1</span><div><strong>Abre en Safari</strong><small>Si estás en otro navegador, copia vitamate.mx y ábrelo en Safari.</small></div></li>
                <li><span>2</span><div><strong>Toca Compartir</strong><small>Es el icono de un cuadro con una flecha hacia arriba.</small></div></li>
                <li><span>3</span><div><strong>Agregar a inicio</strong><small>Confirma “Agregar” y VITAMATE aparecerá como cualquier app.</small></div></li>
              </ol>
              <button className="button button-primary button-wide" type="button" onClick={continueToApp}>Entendido, entrar a VITAMATE <span>→</span></button>
              <button className="quiet-action" type="button" onClick={continueToApp}>Entrar ahora sin instalar</button>
            </div>
            <div className="install-phone" aria-hidden="true">
              <div className="phone-island" />
              <div className="phone-screen">
                <span className="phone-kicker">Safari</span>
                <div className="share-icon">↑</div>
                <div className="add-home-row"><span className="mini-app-icon">V</span><span>Agregar a pantalla de inicio</span><b>›</b></div>
                <div className="home-preview"><span className="mini-app-icon large">V</span><strong>VITAMATE</strong><small>Tu compañero diario</small></div>
              </div>
            </div>
          </section>
        </div>
      , document.body)}
    </>
  );
}
