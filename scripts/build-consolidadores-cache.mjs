// Gera o artefato do demo de consolidadores (src/lib/consolidadores.json): para uma lista curada de
// roll-ups reais de saúde, calcula o buy-box e os próximos alvos prováveis. Estático = instantâneo
// no demo (mesmo padrão do demo-cache). Regerar = rodar este script.
//   node --env-file=.env.local scripts/build-consolidadores-cache.mjs
import { BigQuery } from "@google-cloud/bigquery";
import { writeFileSync } from "fs";
import path from "path";

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCP_KEY_PATH),
});
const ANTIGO = "2023-06-10";
const NOVO = "2025-11-09";

// Roll-ups temáticos e interpretáveis (10–30 alvos). Evita as mega-estruturas (4ID/KSB) que são
// shared-services, não aquisição real.
const PADROES = ["SKINLASER", "MOGIANO", "REGENERATI", "SANTORIUS"];

const faixaLabel = { 9: "80+", 8: "71-80", 7: "61-70" };

async function um(padrao) {
  const [[adq]] = await bq.query({
    location: "US",
    query: `
      WITH alvos AS (
        SELECT cnpj_basico FROM \`basedosdados.br_me_cnpj.estabelecimentos\`
        WHERE data='${NOVO}' AND sigla_uf='SP' AND identificador_matriz_filial='1'
          AND cnae_fiscal_principal LIKE '86%'
      )
      SELECT s.documento AS doc, ANY_VALUE(s.nome) AS nome, COUNT(DISTINCT s.cnpj_basico) AS n
      FROM \`basedosdados.br_me_cnpj.socios\` s JOIN alvos USING (cnpj_basico)
      WHERE s.data='${NOVO}' AND s.tipo='1' AND s.data_entrada_sociedade > DATE('${ANTIGO}')
        AND UPPER(s.nome) LIKE '%${padrao}%'
      GROUP BY s.documento ORDER BY n DESC LIMIT 1`,
  });
  if (!adq) return null;

  const [perfil] = await bq.query({
    location: "US",
    query: `
      SELECT est.cnae_fiscal_principal AS cnae, est.id_municipio AS mun
      FROM \`basedosdados.br_me_cnpj.socios\` s
      JOIN \`basedosdados.br_me_cnpj.estabelecimentos\` est
        ON est.cnpj_basico=s.cnpj_basico AND est.data='${NOVO}' AND est.identificador_matriz_filial='1'
      WHERE s.data='${NOVO}' AND s.tipo='1' AND s.documento='${adq.doc}'
        AND s.data_entrada_sociedade > DATE('${ANTIGO}')`,
  });
  const cnaes = [...new Set(perfil.map((p) => p.cnae))];
  const muns = [...new Set(perfil.map((p) => String(p.mun)))];
  const cnaeList = cnaes.map((c) => `'${c}'`).join(",");
  const munList = muns.map((m) => `'${m}'`).join(",");

  const [cand] = await bq.query({
    location: "US",
    query: `
      WITH socinfo AS (
        SELECT cnpj_basico, MAX(SAFE_CAST(faixa_etaria AS INT64)) AS mf,
          COUNTIF(tipo='1') AS pj, COUNTIF(tipo='2') AS pf
        FROM \`basedosdados.br_me_cnpj.socios\` WHERE data='${NOVO}' GROUP BY 1
      )
      SELECT emp.razao_social AS nome, est.cnae_fiscal_principal AS cnae,
        si.mf, EXTRACT(YEAR FROM est.data_inicio_atividade) AS ano,
        (CASE si.mf WHEN 9 THEN 30 WHEN 8 THEN 26 WHEN 7 THEN 20 ELSE 0 END)
        + (CASE WHEN 2025-EXTRACT(YEAR FROM est.data_inicio_atividade) >= 25 THEN 22
                WHEN 2025-EXTRACT(YEAR FROM est.data_inicio_atividade) >= 15 THEN 10 ELSE 0 END)
        + 18 AS encaixe
      FROM \`basedosdados.br_me_cnpj.estabelecimentos\` est
      JOIN \`basedosdados.br_me_cnpj.empresas\` emp ON emp.cnpj_basico=est.cnpj_basico AND emp.data='${NOVO}'
      JOIN socinfo si ON si.cnpj_basico=est.cnpj_basico
      WHERE est.data='${NOVO}' AND est.identificador_matriz_filial='1'
        AND est.cnae_fiscal_principal IN (${cnaeList}) AND est.id_municipio IN (${munList})
        AND si.pj=0 AND si.pf>=1 AND si.mf >= 7
      ORDER BY encaixe DESC, si.mf DESC LIMIT 6`,
  });

  return {
    consolidador: adq.nome,
    n_adquiridas: Number(adq.n),
    cnaes,
    n_municipios: muns.length,
    proximos_alvos: cand.map((c) => ({
      nome: c.nome,
      cnae: c.cnae,
      socio_faixa: faixaLabel[c.mf] ?? "?",
      desde: Number(c.ano),
      encaixe: Number(c.encaixe),
    })),
  };
}

const resultados = [];
for (const p of PADROES) {
  const r = await um(p);
  if (r && r.proximos_alvos.length > 0) resultados.push(r);
  console.log(r ? `✓ ${r.consolidador} — ${r.n_adquiridas} adq · ${r.proximos_alvos.length} alvos` : `– ${p}: sem match`);
}

const artefato = {
  gerado_em: new Date().toISOString().slice(0, 10),
  janela: { antigo: ANTIGO, novo: NOVO },
  nota:
    "Consolidadores reais de saúde em SP, minerados das entradas de sócio PJ no CNPJ. O 'buy-box' é " +
    "o perfil das empresas que cada um já comprou (CNAE + praça). Os próximos alvos são empresas " +
    "ainda independentes (só sócios PF) que se encaixam no padrão e têm perfil sucessório (sócio 61+).",
  consolidadores: resultados,
};
const out = path.resolve("src/lib/consolidadores.json");
writeFileSync(out, JSON.stringify(artefato, null, 2) + "\n", "utf8");
console.log(`\n✓ ${out} — ${resultados.length} consolidadores`);
