import type { Metadata } from "next";
import { Newsreader, Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NavLogo } from "@/components/brand/NavLogo";
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
  weight: ["300", "400", "500"],
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

export const metadata: Metadata = {
  title: "Boreal",
  description:
    "Deal sourcing para PE/M&A — empresas com risco sucessório, priorizadas por IA.",
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
        <nav className="sticky top-0 z-50 border-b border-hairline bg-smoky px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <NavLogo />
            <div className="flex items-center gap-5">
              <a
                href="/validacao"
                className="font-data text-[11px] uppercase tracking-wider text-bone transition-colors hover:text-floral"
              >
                Validação
              </a>
              <a
                href="/mercado"
                className="font-data text-[11px] uppercase tracking-wider text-bone transition-colors hover:text-floral"
              >
                Mercado
              </a>
              <a
                href="/consolidadores"
                className="font-data text-[11px] uppercase tracking-wider text-bone transition-colors hover:text-floral"
              >
                Consolidadores
              </a>
              <a
                href="/pipeline"
                className="font-data text-[11px] uppercase tracking-wider text-bone transition-colors hover:text-floral"
              >
                Pipeline
              </a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
