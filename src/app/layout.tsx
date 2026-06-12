import type { Metadata, Viewport } from "next";
import { Newsreader, Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Nav } from "@/components/brand/Nav";
import "./globals.css";

// Serif editorial — headlines, nomes de empresa, statements
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

// Humanist sans institucional — interface: body, botões, labels, inputs.
// Pareia com Plex Mono (mesma família IBM). Escolhida sobre Space Grotesk por
// não carregar o DNA visual "tech startup" da era Linear/Vercel/Notion.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"], // 400 body · 500 medium UI · 600 ênfase (strong). 300 removido (não usado)
});

// Wordmark — exclusivo para o lockup do logo
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

// Mono — scores, CNPJ, labels técnicos
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// URL base pro OG/canonical. No Vercel vem de VERCEL_PROJECT_PRODUCTION_URL
// automaticamente; localmente cai no localhost. Override explícito via env.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Boreal · Deal sourcing por risco sucessório",
    template: "%s · Boreal",
  },
  description:
    "Boreal encontra empresas industriais familiares no middle market brasileiro e prioriza oportunidades por risco sucessório — a partir de uma tese em linguagem natural.",
  applicationName: "Boreal",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Boreal",
    url: siteUrl,
    title: "Boreal · Deal sourcing por risco sucessório",
    description:
      "O gargalo do deal sourcing, colapsado de duas semanas para trinta segundos.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Boreal · Deal sourcing por risco sucessório",
    description:
      "O gargalo do deal sourcing, colapsado de duas semanas para trinta segundos.",
  },
};

// Smoky Black — pinta a barra do browser no mobile (Chrome Android, Safari iOS)
// com o fundo primário, em vez do branco padrão que quebra a moldura escura.
export const viewport: Viewport = {
  themeColor: "#11120d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${newsreader.variable} ${plexSans.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-smoky">
        <Nav />
        {children}
      </body>
    </html>
  );
}
