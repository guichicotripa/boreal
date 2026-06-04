// Look-alike — dada uma empresa, quão parecida é outra (perfil de negócio, não financeiro).
// Inspirado na "similarity matching" do Grata, mas com o nosso dado (CNPJ): CNAE + praça + porte +
// época de fundação. Determinístico e explicável (devolve os motivos do match). Pura — testável.

import type { Empresa } from "./types";

export type Similaridade = { pontos: number; motivos: string[] };
export type EmpresaSimilar = Empresa & { similaridade: Similaridade };

export function divisaoCnae(e: Pick<Empresa, "cnae_principal">): string {
  return (e.cnae_principal ?? "").slice(0, 2);
}

function ano(e: Pick<Empresa, "data_inicio_atividade">): number | null {
  const y = e.data_inicio_atividade ? Number(e.data_inicio_atividade.slice(0, 4)) : NaN;
  return Number.isFinite(y) ? y : null;
}

type Perfil = Pick<Empresa, "cnae_principal" | "municipio" | "uf" | "porte" | "data_inicio_atividade">;

// 0–100, somável e explicável. Pesos: setor domina, depois praça, porte, época.
export function similaridade(seed: Perfil, c: Perfil): Similaridade {
  const motivos: string[] = [];
  let p = 0;

  const sc = seed.cnae_principal ?? "";
  const cc = c.cnae_principal ?? "";
  if (sc && cc) {
    if (sc === cc) { p += 40; motivos.push("mesmo CNAE"); }
    else if (sc.slice(0, 4) === cc.slice(0, 4)) { p += 25; motivos.push("mesma classe CNAE"); }
    else if (sc.slice(0, 2) === cc.slice(0, 2)) { p += 10; }
  }

  if (seed.municipio && c.municipio && seed.municipio === c.municipio) { p += 25; motivos.push("mesma cidade"); }
  else if (seed.uf && c.uf && seed.uf === c.uf) { p += 8; }

  if (seed.porte && c.porte && seed.porte === c.porte) { p += 15; motivos.push("mesmo porte"); }

  const sy = ano(seed), cy = ano(c);
  if (sy != null && cy != null) {
    const d = Math.abs(sy - cy);
    if (d <= 10) { p += 12; motivos.push("fundada na mesma época"); }
    else if (d <= 20) { p += 6; }
  }

  return { pontos: Math.min(p, 100), motivos };
}
