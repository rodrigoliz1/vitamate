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
  icons: {
    icon: [
      { url: "/favicon.svg?v=vitamate-20260716", type: "image/svg+xml" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.svg?v=vitamate-20260716",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "VITAMATE",
    description: "Tu entrenamiento, tu alimentación y VITACOACH, juntos.",
    url: "/",
    type: "website",
    locale: "es_MX",
    siteName: "VITAMATE",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "VITAMATE — La vida fit que se adapta a tu vida" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VITAMATE — La vida fit que se adapta a tu vida",
    description: "Entrenamiento, nutrición y VITACOACH, juntos.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className={`${sans.variable} ${display.variable}`}><body>{children}</body></html>;
}
