// Investiga (research-agent) as empresas-top das teses de SAÚDE e EDUCAÇÃO do demo-cache e
// salva em research-cache.json → clique em "Investigar" fica instantâneo no site. VIA ASSINATURA
// (Agent SDK + WebSearch, custo zero). Espelha src/lib/research.ts (inclui perfil_negocio).
// Lento: ~30-90s por empresa (busca na web). Salva incremental (resiliente a falha).
//   node scripts/cache-research-saude-edu.mjs [topN=10]
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../src/lib/demo-cache.json");
const OUT = path.resolve(__dirname, "../src/lib/research-cache.json");
const TOP = Number(process.argv[2] ?? 10);

const PESOS = {
  mencao_sucessao_venda:   { peso: +12, rotulo: "Menção pública a sucessão/venda" },
  banco_investimento:      { peso: +15, rotulo: "Assessor/banco de investimento contratado" },
  herdeiro_fora_carreira:  { peso: +8,  rotulo: "Herdeiro(s) em outra carreira" },
  csuite_externo:          { peso: +6,  rotulo: "C-suite profissional externo à família" },
  big4_auditoria:          { peso: +5,  rotulo: "Auditoria Big 4" },
  sem_presenca_digital:    { peso: +3,  rotulo: "Sem pegada digital (perfil old-school)" },
  sucessor_familiar_ativo: { peso: -25, rotulo: "Sucessor familiar já atuando" },
};
const TIPOS = Object.keys(PESOS).join(", ");
const clamp = (n) => Math.max(0, Math.min(100, n));
const SYSTEM =
  "Você é um analista de origination de M&A investigando uma empresa familiar brasileira para avaliar " +
  "risco sucessório. Você pesquisa SOMENTE fontes públicas (LinkedIn público, imprensa, site da empresa, " +
  "registros). NUNCA inventa fatos — se não achar evidência de um sinal, não o reporte. Toda afirmação " +
  "precisa de uma URL de fonte real encontrada na busca.";

async function investigar(e) {
  const scoreV0 = e.score?.score ?? 0;
  const socios = (e.socio ?? []).map((s) => s.nome).join(", ");
  const prompt = `Investigue esta empresa na web e procure sinais de risco/propensão sucessória.

Empresa: ${e.razao_social}${e.nome_fantasia ? ` (${e.nome_fantasia})` : ""}
Setor: ${e.cnae_principal_desc ?? e.cnae_principal}
Cidade: ${e.municipio} / ${e.uf}
Fundada em: ${e.data_inicio_atividade?.slice(0, 4) ?? "?"}
Sócios: ${socios || "não informado"}

Procure evidência pública para estes tipos de sinal (só reporte os que REALMENTE encontrar, com fonte):
- "mencao_sucessao_venda" — notícia/post mencionando sucessão, venda, fusão ou reorganização
- "banco_investimento" — empresa contratou assessor/banco de investimento
- "herdeiro_fora_carreira" — filhos/herdeiros do(s) sócio(s) em outras profissões
- "csuite_externo" — executivos C-level com sobrenome diferente da família fundadora
- "big4_auditoria" — auditoria por Big 4 (Deloitte, PwC, EY, KPMG)
- "sucessor_familiar_ativo" — herdeiro da família JÁ atuando na gestão/sociedade (REDUZ o risco)
- "sem_presenca_digital" — a empresa praticamente não tem presença online encontrável

REGRA CRÍTICA: "tipo" DEVE ser EXATAMENTE um dos sete identificadores (snake_case). A descrição vai em "descricao".

Decida também:
- "gatilho" — em UMA frase, o motivo mais acionável pra abordar AGORA (ou null se nada time-sensitive).
- "mensagem_abordagem" — rascunho curto (3-4 frases, PT-BR, consultivo, não vendedor) citando o gatilho (ou null).

Separado da análise sucessória, descreva o NEGÓCIO:
- "perfil_negocio" — 2-3 frases: o que a empresa faz (produtos/serviços), modelo de negócio e tipo de
  cliente. Só com o que achar na web; não invente nem estime faturamento. Se nada além do CNAE, null.

Ao final, responda APENAS com este JSON (sem markdown):
{"presenca_digital":"baixa","resumo":"1-2 frases","perfil_negocio":"... ou null","sinais":[{"tipo":"<identificador>","descricao":"...","fonte_url":"https://..."}],"gatilho":"... ou null","mensagem_abordagem":"... ou null"}
Valores válidos de "tipo": ${TIPOS}. Se não achar nada, "sinais": [].
EFICIÊNCIA: no máximo 4 buscas na web, depois conclua.`;

  let raw = null;
  for await (const m of query({
    prompt,
    options: { systemPrompt: SYSTEM, allowedTools: ["WebSearch", "WebFetch"], maxTurns: 18, env: { ...process.env, ANTHROPIC_API_KEY: undefined } },
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
      return { tipo: String(s.tipo), rotulo: def.rotulo, descricao: String(s.descricao ?? "").trim(), fonte_url: typeof s.fonte_url === "string" && s.fonte_url.startsWith("http") ? s.fonte_url : null, peso: def.peso };
    })
    .filter(Boolean);
  const scoreV1 = clamp(scoreV0 + sinais.reduce((a, s) => a + s.peso, 0));
  const gatilho = typeof parsed.gatilho === "string" && parsed.gatilho.trim() ? parsed.gatilho.trim() : null;
  const mensagem = typeof parsed.mensagem_abordagem === "string" && parsed.mensagem_abordagem.trim() ? parsed.mensagem_abordagem.trim() : null;
  return {
    sinais,
    presenca_digital: ["alta", "media", "baixa", "nenhuma"].includes(parsed.presenca_digital) ? parsed.presenca_digital : "baixa",
    resumo: String(parsed.resumo ?? "").trim(),
    perfil_negocio: typeof parsed.perfil_negocio === "string" && parsed.perfil_negocio.trim() ? parsed.perfil_negocio.trim() : null,
    score_v0: scoreV0, score_v1: scoreV1, delta: scoreV1 - scoreV0,
    gatilho, mensagem_abordagem: gatilho ? mensagem : null,
  };
}

// ── Alvos: top-N das chaves compostas (saúde/educação) do demo-cache ──
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
const demo = readJson(DEMO);
const cache = fs.existsSync(OUT) ? readJson(OUT) : {};
const byId = new Map();
const alvoIds = new Set();
for (const [k, resp] of Object.entries(demo)) {
  if (!k.includes("|")) continue; // só saúde/educação (chave composta)
  (resp.empresas ?? []).slice(0, TOP).forEach((e) => { byId.set(e.id, e); alvoIds.add(e.id); });
}
const alvos = [...alvoIds].filter((id) => !cache[id]);
console.log(`${alvoIds.size} alvos saúde/educação (top ${TOP}); ${alvos.length} a investigar, ${alvoIds.size - alvos.length} já em cache.\n`);

let i = 0;
for (const id of alvos) {
  i++;
  const e = byId.get(id);
  process.stdout.write(`[${i}/${alvos.length}] ${e.razao_social.slice(0, 40)} … `);
  const t0 = Date.now();
  try {
    // Timeout por empresa: a busca na web às vezes trava; pula a ruim em vez de parar a fila.
    const r = await Promise.race([
      investigar(e),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 240s")), 240000)),
    ]);
    cache[id] = r;
    fs.writeFileSync(OUT, JSON.stringify(cache, null, 2));
    const arrow = r.delta > 0 ? "↑" : r.delta < 0 ? "↓" : "=";
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s · v0:${r.score_v0}→v1:${r.score_v1} ${arrow} · ${r.sinais.length} sinais · perfil:${r.perfil_negocio ? "ok" : "—"}`);
  } catch (err) {
    console.log(`FALHOU (${err.message})`);
  }
}
console.log(`\n✓ research-cache: ${Object.keys(cache).length} empresas investigadas.`);
