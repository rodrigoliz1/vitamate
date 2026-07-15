import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://vitamate.mx"),
  title: { default: "VITAMATE — La vida fit que se adapta a tu vida", template: "%s · VITAMATE" },
  description: "Entrenamiento, nutrición y acompañamiento personal con IA en una sola experiencia.",
  applicationName: "VITAMATE",
  keywords: ["entrenamiento personalizado", "nutrición", "coach IA", "macronutrientes", "bienestar"],
  openGraph: { title: "VITAMATE", description: "Tu entrenamiento, tu alimentación y VITACOACH, juntos.", type: "website", locale: "es_MX", siteName: "VITAMATE" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className={`${sans.variable} ${display.variable}`}><body>{children}</body></html>;
}
