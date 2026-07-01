// Ícone de linha por SEÇÃO econômica (CNAE, siglas A–U). Usado no badge de hover do heat-map.
// Traço fino, fill none, herda currentColor — combina com o brand (bone/floral).

const P: Record<string, string> = {
  A: "M12 21v-8 M12 13c0-3 2-5 5-5 0 3-2 5-5 5 M12 13c0-3-2-5-5-5 0 3 2 5 5 5", // agro (broto)
  B: "M3 20l6-9 4 5 3-4 5 8z M14 7l3-3 M15 4h3v3", // extrativas (montanha+picareta)
  C: "M3 21V10l5 3V10l5 3V6l5 3v9z M3 21h18", // indústria (fábrica)
  D: "M13 2 4 14h7l-1 8 9-12h-7z", // eletricidade (raio)
  E: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z", // água (gota)
  F: "M4 20h16 M6 20v-6a6 6 0 0 1 12 0v6 M11 5h2v3", // construção (capacete)
  G: "M3 4h2l2.2 11h10.6l1.8-8H6 M9 20a1 1 0 1 0 .01 0 M17 20a1 1 0 1 0 .01 0", // comércio (carrinho)
  H: "M2 7h11v9H2z M13 10h4l3 3v3h-7z M6.5 18a1.5 1.5 0 1 0 .01 0 M17 18a1.5 1.5 0 1 0 .01 0", // transporte (caminhão)
  I: "M3 17v-4h13a4 4 0 0 1 4 4v1 M3 9v8 M21 18v-3 M6 13V9a1 1 0 0 1 1-1h4", // alojamento (cama)
  J: "M5 12a10 10 0 0 1 14 0 M8.5 15.5a5 5 0 0 1 7 0 M12 19h.01", // informação (sinal)
  K: "M3 21h18 M4 21V10 M20 21V10 M3 10l9-6 9 6z M8 21v-7 M12 21v-7 M16 21v-7", // finanças (banco)
  L: "M4 21V4h9v17 M13 9h7v12 M7 8h3 M7 12h3 M7 16h3 M16 13h1 M16 17h1", // imobiliárias (prédio)
  M: "M3 8h18v12H3z M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 13h18", // profissionais (pasta)
  N: "M7 5h10v16H7z M9 5V4a3 3 0 0 1 6 0v1 M10 11h4 M10 15h4", // administrativos (prancheta)
  O: "M3 21h18 M5 21V9 M9 21V9 M15 21V9 M19 21V9 M2 9h20 M12 3l9 5H3z", // adm pública (fórum)
  P: "M2 8 12 4l10 4-10 4z M6 10v5c0 1.4 12 1.4 12 0v-5 M22 8v5", // educação (beca)
  Q: "M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z", // saúde (cruz)
  R: "M12 3a9 9 0 1 0 1 18c1 0 1.5-.8 1.5-1.7 0-1 .8-1.3 1.5-1.3H18a3 3 0 0 0 3-3c0-5-4-9-9-9z M8 12h.01 M10 8h.01 M14 8h.01", // artes (paleta)
  S: "M15 6a4 4 0 0 1-5.3 5.3L4 17l3 3 5.7-5.7A4 4 0 0 1 18 9z", // outros serviços (chave)
  T: "M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6", // domésticos (casa)
  U: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z", // outros (grade)
};

export function SecaoIcon({ sigla, className }: { sigla: string; className?: string }) {
  const d = P[sigla] ?? P.U;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
