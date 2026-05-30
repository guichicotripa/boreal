import type { Metadata } from "next";
import { Newsreader, Space_Grotesk, Archivo, IBM_Plex_Mono } from "next/font/google";
import { Logo } from "@/components/brand/Logo";
import "./globals.css";

// Serif editorial — headlines, nomes de empresa, statements
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

// Geometric sans — interface: body, botões, labels, inputs
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
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
      className={`${newsreader.variable} ${spaceGrotesk.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-smoky">
        <nav className="border-b border-hairline bg-smoky px-6 py-4">
          <div className="mx-auto max-w-4xl">
            <Logo />
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
