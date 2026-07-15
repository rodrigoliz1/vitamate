import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`site-page ${className}`}><SiteHeader /><main>{children}</main><SiteFooter /></div>;
}
