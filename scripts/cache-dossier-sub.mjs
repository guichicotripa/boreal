// Fábrica de cache de DOSSIÊS (memos) via ASSINATURA (Agent SDK, custo zero).
// Gera a análise do memo (overview/análise sucessória/perguntas/tese) das empresas-chave dos
// demos e salva em src/lib/dossier-cache.json → expandir o memo no pitch é instantâneo.
//
// Cobre: top 5 de cada query do demo-cache ∪ as empresas do research-cache (PRENSA, MECANOTECNICA…).
// Lê os dados completos do demo-cache; não toca Supabase. Espelha o prompt de src/lib/dossier.ts.
// Sem web search (o dossiê é só análise dos dados). Roda: node scripts/cache-dossier-sub.mjs
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../src/lib/demo-cache.json");
const RESEARCH = path.resolve(__dirname, "../src/lib/research-cache.json");
const OUT = path.resolve(__dirname, "../src/lib/dossier-cache.json");

const SYSTEM =
  "Você é um sócio de uma boutique de M&A no Brasil, especializado em originação de deals com " +
  "empresas familiares em risco sucessório. Recebe o dossiê de dados de uma empresa e escreve uma " +
  "análise objetiva e acionável para um analista que vai fazer o primeiro contato com o fundador. " +
  "Tom profissional, específico, sem encher linguiça. Responde SEMPRE e APENAS com JSON válido, sem markdown.";

const FAIXA_LABEL = { "1": "0-12", "2": "13-20", "3": "21-30", "4": "31-40", "5": "41-50", "6": "51-60", "7": "61-70", "8": "71-80", "9": "80+" };

function dadosParaPrompt(e) {
  const socios = (e.socio ?? []).map((s) => ({
    nome: s.nome,
    faixa_etaria: s.faixa_etaria ? FAIXA_LABEL[s.faixa_etaria] ?? s.faixa_etaria : null,
    qualificacao: s.qualificacao,
    entrou_em: s.data_entrada_sociedade?.slice(0, 4) ?? null,
  }));
  return {
    razao_social: e.razao_social, nome_fantasia: e.nome_fantasia,
    setor: e.cnae_principal_desc ?? e.cnae_principal,
    atividades_secundarias: (e.cnaes_secundarios ?? []).map((c) => c.descricao).filter(Boolean),
    cidade: e.municipio, uf: e.uf, fundada_em: e.data_inicio_atividade?.slice(0, 4) ?? null,
    natureza_juridica: e.natureza_juridica, capital_social: e.capital_social, porte: e.porte,
    score_risco_sucessorio: e.score?.score ?? null, sinais: e.score?.sinais ?? [],
    quadro_societario: socios,
  };
}

async function gerarAnalise(empresa) {
  const prompt = `Gere a análise do dossiê desta empresa. Use SÓ os dados fornecidos —
não invente faturamento, número de funcionários ou fatos que não estão aqui.

Responda APENAS com este JSON:
{
  "overview": "2-3 frases sobre o que a empresa é (setor, idade, porte, localização)",
  "analise_sucessoria": "1 parágrafo: leia o quadro societário e explique por que há (ou não) risco sucessório — idade dos sócios, há quanto tempo o quadro está parado, presença ou ausência de herdeiros mais jovens, sinais de transição",
  "perguntas_abordagem": ["4 a 5 perguntas específicas para o primeiro contato com o fundador, ancoradas nos dados desta empresa — não genéricas"],
  "tese_aproximacao": "2 frases: por que essa empresa é um alvo interessante e qual o ângulo de abordagem"
}

Dados da empresa:
${JSON.stringify(dadosParaPrompt(empresa), null, 2)}`;

  let raw = null;
  for await (const m of query({
    prompt,
    options: { systemPrompt: SYSTEM, maxTurns: 1, env: { ...process.env, ANTHROPIC_API_KEY: undefined } },
  })) {
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("sem resultado");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("sem JSON: " + raw.slice(0, 120));
  const parsed = JSON.parse(match[0]);
  return {
    overview: String(parsed.overview ?? "").trim(),
    analise_sucessoria: String(parsed.analise_sucessoria ?? "").trim(),
    perguntas_abordagem: Array.isArray(parsed.perguntas_abordagem)
      ? parsed.perguntas_abordagem.map((p) => String(p).trim()).filter(Boolean) : [],
    tese_aproximacao: String(parsed.tese_aproximacao ?? "").trim(),
  };
}

// ── Monta o conjunto: top 5 de cada query ∪ empresas do research-cache ──────────
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); // strip BOM
const demo = readJson(DEMO);
const research = fs.existsSync(RESEARCH) ? readJson(RESEARCH) : {};
const cache = fs.existsSync(OUT) ? readJson(OUT) : {};

const empresaById = new Map();
const alvoIds = new Set();
for (const resp of Object.values(demo)) {
  (resp.empresas ?? []).forEach((e, i) => {
    empresaById.set(e.id, e);
    if (i < 5) alvoIds.add(e.id); // top 5 de cada query
  });
}
for (const id of Object.keys(research)) if (empresaById.has(id)) alvoIds.add(id); // PRENSA, MECANOTECNICA…

const alvos = [...alvoIds].filter((id) => !cache[id]); // não regerar o que já está em cache
console.log(`${alvoIds.size} empresas-alvo (${alvos.length} a gerar; ${alvoIds.size - alvos.length} já em cache)\n`);

let i = 0;
for (const id of alvos) {
  i++;
  const e = empresaById.get(id);
  process.stdout.write(`[${i}/${alvos.length}] ${e.razao_social.slice(0, 40)} … `);
  const t0 = Date.now();
  try {
    cache[id] = await gerarAnalise(e);
    fs.writeFileSync(OUT, JSON.stringify(cache, null, 2)); // salva incremental (resiliente a falha)
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s ok`);
  } catch (err) {
    console.log(`FALHOU (${err.message})`);
  }
}
console.log(`\n✓ dossier-cache: ${Object.keys(cache).length} memos em ${path.relative(process.cwd(), OUT)}`);
