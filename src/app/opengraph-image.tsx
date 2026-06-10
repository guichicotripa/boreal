import { ImageResponse } from "next/og";

// OG/Twitter preview do link compartilhado. Tipográfico (sem SVG) pra render
// previsível no satori. Paleta da marca: Smoky / Floral White / Bone.
export const alt = "Boreal — Deal sourcing por risco sucessório";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#11120D",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#FFFBF4",
            fontSize: 34,
            letterSpacing: "0.18em",
            fontWeight: 600,
          }}
        >
          BOREAL
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#FFFBF4", fontSize: 68, lineHeight: 1.1, maxWidth: 1000 }}>
            O gargalo do deal sourcing, colapsado de duas semanas para trinta segundos.
          </div>
          <div style={{ display: "flex", color: "#D8CFBC", fontSize: 30, marginTop: 28 }}>
            Empresas industriais familiares priorizadas por risco sucessório.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
