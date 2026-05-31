// Fábrica de cache de research via ASSINATURA (Agent SDK + WebSearch, custo zero).
// Investiga candidatas "do meio" (score v0 75-89, com espaço pra SUBIR) pra achar o caso
// de demo onde a IA acha um sinal escondido (banco de investimento, menção a venda) e ELEVA
// o score — o lado oposto do rebaixamento da PRENSA. Salva as que sobem no research-cache.json.
//
// Lê tudo do demo-cache.json (que já tem dados completos + score v0); não toca Supabase.
// Espelha o prompt e os pesos de src/lib/research.ts. Roda: node scripts/cache-research-sub.mjs
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../src/lib/demo-cache.json");
const CACHE = path.resolve(__dirname, "../src/lib/research-cache.json");

// Pesos idênticos ao research.ts (determinístico no código, LLM não inventa score).
const PESOS = {
  mencao_sucessao_venda: { peso: +12, rotulo: "Menção pública a sucessão/venda" },
  banco_investimento: { peso: +15, rotulo: "Assessor/banco de investimento contratado" },
  herdeiro_fora_carreira: { peso: +8, rotulo: "Herdeiro(s) em outra carreira" },
  csuite_externo: { peso: +6, rotulo: "C-suite profissional externo à família" },
  big4_auditoria: { peso: +5, rotulo: "Auditoria Big 4" },
  sem_presenca_digital: { peso: +3, rotulo: "Sem pegada digital (perfil old-school)" },
  sucessor_familiar_ativo: { peso: -25, rotulo: "Sucessor familiar já atuando" },
};
const TIPOS = Object.keys(PESOS).join(", ");
const SYSTEM =
  "Você é um analista de origination de M&A investigando uma empresa familiar brasileira para " +
  "avaliar risco sucessório. Você pesquisa SOMENTE fontes públicas (LinkedIn público, imprensa, " +
  "site da empresa, registros). NUNCA inventa fatos — se não achar evidência de um sinal, não o " +
  "reporte. Toda afirmação precisa de uma URL de fonte real encontrada na busca.";
const clamp = (n) => Math.max(0, Math.min(100, n));
const PORTE_RANK = { DEMAIS: 0, EPP: 1, ME: 2 };

// ── Coleta candidatas do demo-cache: score 75-89, ainda não cacheadas ──────────
const demo = JSON.parse(fs.readFileSync(DEMO, "utf8"));
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
const seen = new Set();
const cands = [];
for (const resp of Object.values(demo)) {
  for (const e of resp.empresas ?? []) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const sc = e.score?.score ?? 0;
    if (sc >= 75 && sc <= 89 && !cache[e.id]) cands.push(e);
  }
}
// Maior porte primeiro, depois score desc, depois capital desc — proxies de visibilidade.
cands.sort((a, b) =>
  (PORTE_RANK[a.porte] ?? 3) - (PORTE_RANK[b.porte] ?? 3) ||
  (b.score?.score ?? 0) - (a.score?.score ?? 0) ||
  (Number(b.capital_social) || 0) - (Number(a.capital_social) || 0)
);
const N = Number(process.argv[2] ?? 6);
const OFFSET = Number(process.argv[3] ?? 0);
const alvos = cands.slice(OFFSET, OFFSET + N);
console.log(`${cands.length} candidatas no range; investigando ${alvos.length} (offset ${OFFSET}).\n`);

async function investigar(empresa) {
  const scoreV0 = empresa.score?.score ?? 0;
  const socios = (empresa.socio ?? []).map((s) => s.nome).join(", ");
  const prompt = `Investigue esta empresa na web e procure sinais de risco/propensão sucessória.

Empresa: ${empresa.razao_social}${empresa.nome_fantasia ? ` (${empresa.nome_fantasia})` : ""}
Setor: ${empresa.cnae_principal_desc ?? empresa.cnae_principal}
Cidade: ${empresa.municipio} / ${empresa.uf}
Fundada em: ${empresa.data_inicio_atividade?.slice(0, 4) ?? "?"}
Sócios: ${socios || "não informado"}

Procure evidência pública para estes tipos de sinal (só reporte os que REALMENTE encontrar, com fonte):
- "mencao_sucessao_venda" — notícia/post mencionando sucessão, venda, fusão ou reorganização
- "banco_investimento" — empresa contratou assessor/banco de investimento
- "herdeiro_fora_carreira" — filhos/herdeiros do(s) sócio(s) em outras profissões (não no negócio)
- "csuite_externo" — executivos C-level com sobrenome diferente da família fundadora
- "big4_auditoria" — auditoria por Big 4 (Deloitte, PwC, EY, KPMG)
- "sucessor_familiar_ativo" — herdeiro da família JÁ atuando na gestão/sociedade (REDUZ o risco)
- "sem_presenca_digital" — a empresa praticamente não tem presença online encontrável

REGRA CRÍTICA: o campo "tipo" DEVE ser EXATAMENTE um dos sete identificadores acima (snake_case).

Ao final, responda APENAS com este JSON (sem markdown):
{"presenca_digital":"baixa","resumo":"1-2 frases","sinais":[{"tipo":"<identificador exato>","descricao":"...","fonte_url":"https://..."}]}
Valores válidos de "tipo": ${TIPOS}. Se não achar nada, retorne "sinais": [].

EFICIÊNCIA: no máximo 4 buscas na web, depois conclua com o JSON.`;

  let raw = null;
  for await (const m of query({
    prompt,
    options: {
      systemPrompt: SYSTEM,
      allowedTools: ["WebSearch", "WebFetch"],
      maxTurns: 18,
      env: { ...process.env, ANTHROPIC_API_KEY: undefined }, // força assinatura
    },
  })) {
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("sem resultado");

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("sem JSON: " + raw.slice(0, 120));
  const parsed = JSON.parse(match[0]);
  const sinais = (Array.isArray(parsed.sinais) ? parsed.sinais : [])
    .map((s) => {
      const def = PESOS[String(s.tipo ?? "")];
      if (!def) return null;
      return {
        tipo: String(s.tipo), rotulo: def.rotulo, descricao: String(s.descricao ?? "").trim(),
        fonte_url: typeof s.fonte_url === "string" && s.fonte_url.startsWith("http") ? s.fonte_url : null,
        peso: def.peso,
      };
    })
    .filter(Boolean);
  const ajuste = sinais.reduce((a, s) => a + s.peso, 0);
  const scoreV1 = clamp(scoreV0 + ajuste);
  return {
    sinais,
    presenca_digital: ["alta", "media", "baixa", "nenhuma"].includes(parsed.presenca_digital) ? parsed.presenca_digital : "baixa",
    resumo: String(parsed.resumo ?? "").trim(),
    score_v0: scoreV0, score_v1: scoreV1, delta: scoreV1 - scoreV0,
  };
}

const resultados = [];
for (let i = 0; i < alvos.length; i++) {
  const e = alvos[i];
  process.stdout.write(`[${i + 1}/${alvos.length}] ${e.razao_social.slice(0, 38)} (v0:${e.score?.score}) … `);
  const t0 = Date.now();
  try {
    const r = await investigar(e);
    const arrow = r.delta > 0 ? "↑" : r.delta < 0 ? "↓" : "=";
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s · v0:${r.score_v0}→v1:${r.score_v1} ${arrow}${r.delta} · ${r.sinais.map((s) => s.tipo).join(",") || "sem sinais"}`);
    resultados.push({ id: e.id, razao: e.razao_social, r });
  } catch (err) {
    console.log(`FALHOU (${err.message})`);
  }
}

// Salva no cache APENAS as que subiram (delta > 0) — o caso de demo que queremos.
const subiram = resultados.filter((x) => x.r.delta > 0).sort((a, b) => b.r.delta - a.r.delta);
console.log(`\n${subiram.length} empresa(s) subiram de score.`);
if (subiram.length > 0) {
  for (const x of subiram) cache[x.id] = x.r;
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  console.log(`✓ Adicionadas ao cache: ${subiram.map((x) => `${x.razao.slice(0,30)} (+${x.r.delta})`).join(" · ")}`);
  console.log(`  Melhor caso de demo "subida": ${subiram[0].razao} v0:${subiram[0].r.score_v0}→v1:${subiram[0].r.score_v1}`);
} else {
  console.log("Nenhuma subiu — rode com mais candidatas: node scripts/cache-research-sub.mjs 10");
}
