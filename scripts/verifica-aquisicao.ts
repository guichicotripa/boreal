/**
 * Confirma na web se uma empresa já foi comprada, e grava em `verificacao_aquisicao`.
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/verifica-aquisicao.ts --dry
 *   node --experimental-strip-types --env-file=.env.local scripts/verifica-aquisicao.ts --limite=13
 *   node --experimental-strip-types --env-file=.env.local scripts/verifica-aquisicao.ts --tudo
 *
 * ── Por que na assinatura, e o que isso custa em produto ──────────────────────
 * Mesma troca de transporte do `precache-mandatos.ts`: `query()` do Agent SDK com
 * `ANTHROPIC_API_KEY: undefined`, que força a assinatura em vez da chave de API (sem crédito desde
 * 25/07). Custo de API: zero.
 *
 * O PREÇO DISSO É ARQUITETURAL, e precisa estar dito em algum lugar: a assinatura exige o Claude
 * Code logado na máquina local. **Não roda em serverless.** Então isto NUNCA vira um botão que o
 * originador da Setter aperta e espera a resposta: é lote, rodado aqui, e o resultado aparece na
 * tela já pronto. A fila abaixo é o que torna isso operável: a Setter marca a empresa salvando no
 * pipeline, o lote roda, a resposta aparece na próxima vez que ela abrir.
 *
 * ── Por que um prompt próprio, e não o `research.ts` ──────────────────────────
 * O research responde "o que há de relevante sobre esta empresa" e custa ~150s por empresa, porque
 * varre vários ângulos. Aqui a pergunta é uma só, fechada, e a resposta útil tem quatro campos.
 * Prompt focado gasta menos turno, erra menos e cabe na cota.
 *
 * ── A regra que evita o pior erro possível ────────────────────────────────────
 * O pior resultado deste script não é dizer "não sei": é dizer "comprada" sobre uma empresa que
 * segue independente, porque isso faz a Setter DESCARTAR um alvo bom. Por isso o prompt exige
 * fonte para afirmar compra, e o parse rebaixa para "inconclusivo" qualquer veredito de compra sem
 * pelo menos uma URL.
 */
import { createClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const args = process.argv.slice(2);
const flag = (n: string, p: string | null = null) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3).trim() : p;
};
const LIMITE = Number(flag("limite", "20"));
const DRY = args.includes("--dry");
const TUDO = args.includes("--tudo");        // reverifica quem já tem resposta

const SYSTEM = `Você verifica se uma empresa brasileira já foi adquirida por outra.

Responda APENAS com um objeto JSON, sem texto antes ou depois:
{"veredito":"comprada|independente|inconclusivo","comprador":string|null,"quando":string|null,
 "confianca":"alta|media|baixa","resumo":string,"fontes":[{"url":string,"titulo":string}]}

Regras que não podem ser quebradas:
- Só responda "comprada" se encontrar fonte publicada dizendo isso. Sem fonte, é "inconclusivo".
- Nunca invente URL. Se não achou nada, devolva fontes vazias e veredito "inconclusivo".
- "independente" só quando houver indício positivo de que segue com os donos originais, como
  entrevista recente ou site institucional atual. Ausência de notícia não é prova de independência,
  e nesse caso o correto é "inconclusivo".
- "resumo" tem no máximo 2 frases, em português, sem adjetivo de venda.
- No máximo 4 buscas.`;

type Verificacao = {
  veredito: "comprada" | "independente" | "inconclusivo";
  comprador: string | null;
  quando: string | null;
  confianca: "alta" | "media" | "baixa";
  resumo: string;
  fontes: { url: string; titulo: string }[];
};

function prompt(e: { razao_social: string; nome_fantasia: string | null; cnpj: string; municipio: string | null; uf: string | null; cnae_principal_desc: string | null; sinal: string }) {
  return `Empresa: ${e.razao_social}${e.nome_fantasia ? ` (nome fantasia: ${e.nome_fantasia})` : ""}
CNPJ: ${e.cnpj}
Cidade: ${e.municipio ?? "?"}/${e.uf ?? "?"}
Atividade: ${e.cnae_principal_desc ?? "?"}

O quadro societário no cadastro da Receita sugere: ${e.sinal}

Pergunta: esta empresa foi adquirida por outra empresa, fundo ou grupo? Se sim, por quem e quando?
Busque por notícia de aquisição, fato relevante, release, entrevista ou página institucional.`;
}

/** Aceita JSON puro ou dentro de bloco de código, que é como o modelo às vezes devolve. */
function parse(raw: string): Verificacao {
  const texto = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim < 0) throw new Error(`resposta sem JSON: ${texto.slice(0, 120)}`);
  const o = JSON.parse(texto.slice(inicio, fim + 1)) as Partial<Verificacao>;

  const fontes = (Array.isArray(o.fontes) ? o.fontes : [])
    .filter((f) => f && typeof f.url === "string" && /^https?:\/\//.test(f.url))
    .map((f) => ({ url: f.url, titulo: String(f.titulo ?? "").slice(0, 200) }));

  let veredito = o.veredito === "comprada" || o.veredito === "independente" ? o.veredito : "inconclusivo";
  let confianca = o.confianca === "alta" || o.confianca === "media" ? o.confianca : "baixa";

  /* A trava do cabeçalho: afirmar compra sem fonte vira "não sei". Custa um falso negativo e evita
     o falso positivo, que é o erro que faz a Setter jogar fora um alvo bom. */
  if (veredito === "comprada" && fontes.length === 0) {
    veredito = "inconclusivo";
    confianca = "baixa";
  }
  return { veredito, comprador: o.comprador ?? null, quando: o.quando ?? null, confianca, resumo: String(o.resumo ?? "").slice(0, 600), fontes };
}

async function pedirAoModelo(p: string): Promise<string> {
  let raw = "";
  for await (const m of query({
    prompt: p,
    options: {
      systemPrompt: SYSTEM,
      allowedTools: ["WebSearch", "WebFetch"],
      maxTurns: 10,
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
    },
  })) {
    if (m.type === "result" && m.subtype === "success") raw = m.result;
  }
  if (!raw) throw new Error("Agent SDK não devolveu resultado");
  return raw;
}

// ── Fila: as empresas salvas pela Setter, priorizando as que o cadastro não resolve ────────────
const { classifica } = await import("./detecta-aquisicao.mjs");
const SEL = "id, cnpj, razao_social, nome_fantasia, municipio, uf, cnae_principal_desc, data_inicio_atividade, socio(nome, cpf_cnpj_mascarado, faixa_etaria, qualificacao, data_entrada_sociedade)";

const { data: op, error: erroOp } = await supabase.from("oportunidade").select("empresa_id");
if (erroOp) { console.error(erroOp.message); process.exit(1); }
const { data: empresas, error } = await supabase.from("empresa").select(SEL).in("id", op!.map((o) => o.empresa_id));
if (error) { console.error(error.message); process.exit(1); }

const { data: jaFeitas } = await supabase.from("verificacao_aquisicao").select("empresa_id");
const feitas = new Set((jaFeitas ?? []).map((v) => v.empresa_id));

/* Ordem da fila: primeiro quem o cadastro NÃO resolve ("o quadro mudou"), depois quem ele acusa
   ("provavelmente comprada", para confirmar antes de a Setter descartar), e por último o resto.
   A cota da assinatura é finita, então a ordem é o que decide o que fica de fora. */
const PRIORIDADE: Record<string, number> = {
  "não sei, mas o quadro mudou": 0,
  "provavelmente comprada": 1,
  "reorganização familiar": 2,
  "sem sinal de venda": 3,
};
const fila = (empresas ?? [])
  .map((e) => ({ e, sinal: classifica(e).veredito as string }))
  .filter(({ e }) => TUDO || !feitas.has(e.id))
  .sort((a, b) => (PRIORIDADE[a.sinal] ?? 9) - (PRIORIDADE[b.sinal] ?? 9))
  .slice(0, LIMITE);

console.log(`${empresas?.length ?? 0} empresas no pipeline · ${feitas.size} já verificadas · ${fila.length} nesta rodada\n`);
if (DRY) {
  for (const { e, sinal } of fila) console.log(`  [${sinal}] ${e.razao_social}`);
  process.exit(0);
}

const t0 = Date.now();
let ok = 0, falhas = 0;
for (const [i, { e, sinal }] of fila.entries()) {
  const marca = `[${i + 1}/${fila.length}] ${e.razao_social.slice(0, 42)}`;
  const t = Date.now();
  try {
    const v = parse(await pedirAoModelo(prompt({ ...e, sinal })));
    const { error: erroGrav } = await supabase.from("verificacao_aquisicao").upsert({
      empresa_id: e.id, veredito: v.veredito, comprador: v.comprador, quando: v.quando,
      confianca: v.confianca, resumo: v.resumo, fontes: v.fontes, sinal_cadastro: sinal,
      modelo: "agent-sdk/assinatura",
    }, { onConflict: "empresa_id" });
    if (erroGrav) throw new Error(`gravação: ${erroGrav.message}`);
    ok++;
    console.log(`${marca} · ${Math.round((Date.now() - t) / 1000)}s · ${v.veredito}${v.comprador ? ` por ${v.comprador}` : ""}${v.quando ? ` (${v.quando})` : ""} · ${v.fontes.length} fonte(s) · cadastro dizia "${sinal}"`);
  } catch (err) {
    const msg = (err as Error).message;
    falhas++;
    console.log(`${marca} · FALHOU · ${msg.slice(0, 120)}`);
    /* Cota da assinatura esgotada: parar vale mais que insistir, porque toda chamada seguinte
       falharia igual e o log viraria 20 linhas de erro idêntico. Mesma decisão do precache. */
    if (/session limit|usage limit|rate.?limit/i.test(msg)) {
      console.log("\nCota da assinatura esgotada. Rode de novo mais tarde: a fila retoma de onde parou.");
      process.exit(3);
    }
  }
}
console.log(`\n${ok} verificadas · ${falhas} falhas · ${Math.round((Date.now() - t0) / 1000)}s`);
