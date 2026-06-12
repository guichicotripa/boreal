import { ImageResponse } from "next/og";

// OG/Twitter preview do link compartilhado. Bloco centralizado: lockup do logo
// (onda dupla + wordmark) + tagline, na tipografia da marca (Newsreader/Plex Sans).
// Paleta: Smoky / Floral White / Bone.
export const alt = "Boreal · Deal sourcing por risco sucessório";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEADLINE = "O gargalo do deal sourcing, colapsado de duas semanas para trinta segundos.";
const SUBTITLE = "Empresas industriais familiares priorizadas por risco sucessório.";
const WORDMARK = "BOREAL";

// Satori não traz as fontes da marca; busca o subset (só os glifos usados) do Google
// Fonts. Sem User-Agent de browser, o Google devolve TTF (formato que o satori lê).
async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(/src:\s*url\((.+?)\)\s*format\('(opentype|truetype)'\)/);
  if (!resource) throw new Error(`font css sem url: ${family} ${weight}`);
  const res = await fetch(resource[1]);
  if (!res.ok) throw new Error(`font fetch ${res.status}: ${family} ${weight}`);
  return res.arrayBuffer();
}

export default async function OpengraphImage() {
  // Falha de fetch de fonte não pode derrubar a rota — cai pra fonte default do satori.
  let fonts: { name: string; data: ArrayBuffer; weight: 400 | 500; style: "normal" }[] = [];
  try {
    const [news400, news500, plex400] = await Promise.all([
      loadGoogleFont("Newsreader", 400, HEADLINE),
      loadGoogleFont("Newsreader", 500, WORDMARK),
      loadGoogleFont("IBM Plex Sans", 400, SUBTITLE),
    ]);
    fonts = [
      { name: "Newsreader", data: news400, weight: 400, style: "normal" },
      { name: "Newsreader", data: news500, weight: 500, style: "normal" },
      { name: "IBM Plex Sans", data: plex400, weight: 400, style: "normal" },
    ];
  } catch {
    fonts = [];
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 36,
          backgroundColor: "#11120D",
          padding: "80px",
          fontFamily: "Newsreader",
        }}
      >
        {/* Lockup: onda dupla (translate do Mark já embutido nas coordenadas) + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="76" height="76" viewBox="0 0 120 120" fill="none" stroke="#FFFBF4">
            <path strokeWidth={7} d="M8 45 C 30 27 46 27 60 45 C 74 63 90 63 112 45" />
            <path strokeWidth={13} d="M15 76 C 37 58 53 58 67 76 C 81 94 97 94 119 76" />
          </svg>
          <div
            style={{
              display: "flex",
              fontFamily: "Newsreader",
              fontWeight: 500,
              fontSize: 46,
              letterSpacing: 4,
              color: "#FFFBF4",
            }}
          >
            {WORDMARK}
          </div>
        </div>

        {/* Tagline + subtítulo */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Newsreader",
              fontWeight: 400,
              color: "#FFFBF4",
              fontSize: 66,
              lineHeight: 1.08,
              maxWidth: 1000,
            }}
          >
            {HEADLINE}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "IBM Plex Sans",
              color: "#D8CFBC",
              fontSize: 29,
              marginTop: 26,
              maxWidth: 940,
              lineHeight: 1.3,
            }}
          >
            {SUBTITLE}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
