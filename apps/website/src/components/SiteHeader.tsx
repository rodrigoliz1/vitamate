"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppEntry } from "./AppEntry";
import { BrandMark } from "./BrandMark";

const links = [
  ["/funciones", "Funciones"],
  ["/como-funciona", "Cómo funciona"],
  ["/precios", "Planes"],
  ["/fuentes", "Fuentes"],
  ["/nosotros", "Nosotros"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link href="/" className="brand-link" onClick={() => setOpen(false)}><BrandMark /></Link>
        <button className="menu-toggle" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-navigation" aria-label={open ? "Cerrar menú" : "Abrir menú"}><span /><span /></button>
        <nav id="site-navigation" className={open ? "is-open" : ""} aria-label="Navegación principal">
          {links.map(([href, label]) => <Link key={href} href={href} className={pathname === href ? "active" : ""} onClick={() => setOpen(false)}>{label}</Link>)}
        </nav>
        <AppEntry className="nav-login">Ingresar <span>↗</span></AppEntry>
      </div>
    </header>
  );
}
