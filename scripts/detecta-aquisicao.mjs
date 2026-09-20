/**
 * Detector de "esta empresa provavelmente já foi comprada", a partir SÓ do quadro societário público.
 *
 *   node --env-file=.env.local scripts/detecta-aquisicao.mjs            # empresas salvas no pipeline
 *   node --env-file=.env.local scripts/detecta-aquisicao.mjs --mandato=foco-a-vet-lab
 *
 * POR QUE ISTO EXISTE: é a pergunta que a Fernanda (Setter) faz à mão, uma empresa por vez, no
 * CNPJ.biz: "entro nela para olhar, para entender se ela não foi adquirida" (áudio de 24/08/2026).
 *
 * COMO RECONHECE PESSOA JURÍDICA: `cpf_cnpj_mascarado` com 14 dígitos e `faixa_etaria = '0'`. É
 * cadastro, não heurística de nome. Regex de nome erraria com "LLC" e "INC", e com pessoa física
 * cujo sobrenome pareça razão social.
 *
 * A DISTINÇÃO QUE FAZ O DETECTOR NÃO MENTIR: sócio PJ entrando pode ser (a) comprador de fora ou
 * (b) holding da própria família, que é reorganização e não é venda. Exemplo real: SÃO FRANCISCO
 * SERVIÇOS FUNERÁRIOS tem VILA PARTICIPAÇÕES no quadro, e os sócios pessoa física se chamam VILA.
 * Sem separar os dois casos, o detector chamaria de vendida uma empresa que segue com a família.
 * A separação é por sobrenome em comum, e quando não dá para decidir o veredito é "não sei".
 */
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "url";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const MANDATO = arg("mandato");

/* Partículas e termos de razão social que NÃO servem para casar família: aparecem em qualquer nome
   e criariam parentesco falso entre coisas sem relação nenhuma. */
const VAZIAS = new Set(["DE", "DA", "DO", "DAS", "DOS", "LTDA", "EIRELI", "PARTICIPACOES", "PARTICIPACAO",
  "HOLDING", "ADMINISTRACAO", "ADMINISTRADORA", "EMPREENDIMENTOS", "EMPREENDIMENTO", "INVESTIMENTOS",
  "INVESTIMENTO", "COMERCIO", "SERVICOS", "SERVICO", "GESTAO", "GESTORA", "CONSULTORIA", "IMOBILIARIA",
  "AGROPECUARIA", "BRASIL", "GRUPO", "IRMAOS", "FILHOS", "COMPANHIA", "JUNIOR", "NETO", "FILHO",
  "SOBRINHO", "SANTOS", "SILVA", "SOUZA", "OLIVEIRA"]);

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const tokens = (nome) => semAcento(nome).split(/[^A-Z0-9]+/).filter((t) => t.length >= 4 && !VAZIAS.has(t));
const ehPJ = (s) => s.faixa_etaria === "0" || String(s.cpf_cnpj_mascarado || "").replace(/\D/g, "").length === 14;
const ano = (d) => (d ? Number(String(d).slice(0, 4)) : null);

const SELECT = "id, cnpj, razao_social, nome_fantasia, municipio, uf, capital_social, data_inicio_atividade, socio(nome, cpf_cnpj_mascarado, faixa_etaria, qualificacao, data_entrada_sociedade)";

async function empresasAlvo() {
  if (MANDATO) {
    const { MANDATOS, filtroOr } = await import("../src/lib/mandatos.ts");
    const m = MANDATOS.find((x) => x.id === MANDATO);
    if (!m) { console.error(`mandato "${MANDATO}" não existe`); process.exit(1); }
    const out = [];
    for (let off = 0; ; off += 500) {
      const r = await supabase.from("empresa").select(SELECT).or(filtroOr(m))
        .eq("porte", "DEMAIS").not("opcao_simples", "is", true).order("id").range(off, off + 499);
      if (r.error) { console.error(r.error.message); process.exit(1); }
      out.push(...r.data);
      if (r.data.length < 500) break;
    }
    return out;
  }
  const { data: op, error } = await supabase.from("oportunidade").select("empresa_id");
  if (error) { console.error(error.message); process.exit(1); }
  const r = await supabase.from("empresa").select(SELECT).in("id", op.map((o) => o.empresa_id));
  if (r.error) { console.error(r.error.message); process.exit(1); }
  return r.data;
}

/** Em quantas OUTRAS empresas da base esta mesma sócia PJ aparece. Consolidador repete. */
async function alcanceDasHoldings(cnpjs) {
  const mapa = new Map();
  for (let i = 0; i < cnpjs.length; i += 100) {
    const { data } = await supabase.from("socio").select("cpf_cnpj_mascarado, empresa_id").in("cpf_cnpj_mascarado", cnpjs.slice(i, i + 100));
    for (const s of data ?? []) {
      if (!mapa.has(s.cpf_cnpj_mascarado)) mapa.set(s.cpf_cnpj_mascarado, new Set());
      mapa.get(s.cpf_cnpj_mascarado).add(s.empresa_id);
    }
  }
  return mapa;
}

export function classifica(empresa) {
  const socios = empresa.socio ?? [];
  const pjs = socios.filter(ehPJ);
  const pfs = socios.filter((s) => !ehPJ(s));
  const sobrenomesPF = new Set(pfs.flatMap((s) => tokens(s.nome)));

  const deTerceiro = pjs.filter((pj) => !tokens(pj.nome).some((t) => sobrenomesPF.has(t)));
  const daFamilia = pjs.filter((pj) => tokens(pj.nome).some((t) => sobrenomesPF.has(t)));

  const anoFund = ano(empresa.data_inicio_atividade);
  const entradas = socios.map((s) => ano(s.data_entrada_sociedade)).filter(Boolean);
  /* Quadro inteiro entrou anos depois da fundação: ninguém que abriu a empresa continua nela. É
     troca de controle mesmo sem PJ no quadro, porque pode ter sido comprada por pessoas físicas. */
  const quadroTrocado = entradas.length > 0 && anoFund && Math.min(...entradas) >= anoFund + 3;

  if (deTerceiro.length) {
    const recente = deTerceiro.slice().sort((a, b) => String(b.data_entrada_sociedade).localeCompare(String(a.data_entrada_sociedade)))[0];
    return {
      veredito: "provavelmente comprada",
      confianca: ano(recente.data_entrada_sociedade) >= 2018 ? "alta" : "média",
      porque: `sócia ${recente.nome}, sem sobrenome em comum com o quadro, entrou em ${ano(recente.data_entrada_sociedade)}`,
      holding: recente,
    };
  }
  if (daFamilia.length) {
    const h = daFamilia[0];
    return {
      veredito: "reorganização familiar",
      confianca: "média",
      porque: `sócia ${h.nome} divide sobrenome com os sócios pessoa física, então parece holding da própria família`,
      holding: h,
    };
  }
  if (quadroTrocado) {
    return {
      veredito: "não sei, mas o quadro mudou",
      confianca: "baixa",
      porque: `nenhum sócio atual estava na empresa na fundação (${anoFund}); o primeiro entrou em ${Math.min(...entradas)}`,
      holding: null,
    };
  }
  return {
    veredito: "sem sinal de venda",
    confianca: "alta",
    porque: "só sócios pessoa física, e pelo menos um desde a fundação",
    holding: null,
  };
}

/* Guarda de execucao: este arquivo tambem e IMPORTADO (por scripts/verifica-aquisicao.ts, que
   reusa `classifica`). Sem isto, importar dispararia o relatorio inteiro, com consultas ao banco
   e saida no console no meio de outro script. */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {

  const empresas = await empresasAlvo();
  const analisadas = empresas.map((e) => ({ empresa: e, ...classifica(e) }));
  const holdings = [...new Set(analisadas.map((a) => a.holding?.cpf_cnpj_mascarado).filter(Boolean))];
  const alcance = await alcanceDasHoldings(holdings);

  const ORDEM = { "provavelmente comprada": 0, "reorganização familiar": 1, "não sei, mas o quadro mudou": 2, "sem sinal de venda": 3 };
  analisadas.sort((a, b) => ORDEM[a.veredito] - ORDEM[b.veredito] || String(a.empresa.razao_social).localeCompare(b.empresa.razao_social));

  const fmtCnpj = (c) => String(c).replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const contagem = {};
  for (const a of analisadas) contagem[a.veredito] = (contagem[a.veredito] || 0) + 1;

  console.log(`\n${empresas.length} empresas analisadas${MANDATO ? ` no mandato ${MANDATO}` : " (salvas no pipeline)"}\n`);
  for (const [v, n] of Object.entries(contagem)) console.log(`${String(n).padStart(4)}  ${v}`);

  let atual = null;
  for (const a of analisadas) {
    if (a.veredito !== atual) { atual = a.veredito; console.log(`\n### ${atual.toUpperCase()}\n`); }
    const e = a.empresa;
    const n = a.holding ? (alcance.get(a.holding.cpf_cnpj_mascarado)?.size ?? 1) - 1 : 0;
    const extra = n > 0 ? ` · essa sócia também aparece em ${n} outra(s) empresa(s) da base` : "";
    console.log(`${e.razao_social}${e.nome_fantasia ? ` (${e.nome_fantasia})` : ""}`);
    console.log(`   ${fmtCnpj(e.cnpj)} · ${e.municipio}/${e.uf} · fundada ${ano(e.data_inicio_atividade)} · confiança ${a.confianca}`);
    console.log(`   ${a.porque}${extra}`);
  }
  console.log(`\nFonte: quadro societário do CNPJ (Receita Federal), snapshot de 09/11/2025.`);
  console.log(`Sinal de cadastro, não confirmação de negócio.`);

}
