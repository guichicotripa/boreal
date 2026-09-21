/* Procedência do contato — de quem é esse e-mail, de verdade.

   O e-mail que vem do registro da Receita é o do RESPONSÁVEL PELO CADASTRO, que
   em empresa familiar frequentemente é o escritório de contabilidade. Medido na
   base: ~19% são de contabilidade e ~44% são webmail. Mostrar os três como
   "Contato" faz o originador mandar a abordagem pro contador achando que é o dono.

   Os três casos pedem tratamento DIFERENTE, e nenhum é "ruim":
     · contabilidade → intermediário; o contador costuma ser gatekeeper e às vezes
       é o melhor caminho pra sucessão, mas não é o decisor. Tem que ser explícito.
     · pessoal       → webmail do sócio. Em empresa familiar isso é linha DIRETA,
       muitas vezes o melhor contato que existe. Não é defeito.
     · empresa       → domínio próprio, canal institucional. */

export type ProcedenciaEmail = "contabilidade" | "intermediario" | "pessoal" | "empresa";

// Provedores de webmail comuns no Brasil.
const WEBMAIL = new Set([
  "gmail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br",
  "yahoo.com", "yahoo.com.br", "uol.com.br", "bol.com.br", "terra.com.br",
  "ig.com.br", "live.com", "msn.com", "globo.com", "r7.com", "superig.com.br",
  "zipmail.com.br", "globomail.com", "oi.com.br", "itelefonica.com.br",
  // Variantes que aparecem na base sem o .br ou fora do padrão.
  "uol.com", "gmail.com.br", "icloud.com", "me.com", "aol.com",
  "protonmail.com", "proton.me", "yandex.com",
]);
// Sobra ~0,1% com domínio digitado errado no cadastro da Receita ("gmail.comr",
// "hotmail.om"). Não vale corrigir por fuzzy: o risco de falso positivo em
// domínio real de empresa é maior que o ganho.

// Escritório contábil / assessoria. Casa no domínio E na parte local
// (contato@pmecontabil.com.br cai pelo domínio; contabilidade@empresa.com pela local).
const CONTABIL = /contab|contador|contadoria|assessor|escritorio|escritório|conta[dt]il/i;

/* `compartilhados` é o conjunto de domínios que atendem MUITAS empresas no CNPJ nacional, vindo de
   `scripts/data/intermediarios.json` (gerado por `scripts/build-intermediarios.mjs`). Ele existe
   porque a regex acima só acha quem SE DECLARA contabilidade no nome. Os maiores não se declaram:
   `laparo.com.br` atende 315 empresas só da nossa base, `maismei.com.br` 107 mil no Brasil, e
   nenhum dos dois casa com `CONTABIL`.

   É OPCIONAL de propósito. A lista tem 32 mil domínios e quase 1 MB, então nunca vai para o
   browser: quem classifica com ela é o backfill, que grava o resultado em `empresa.email_procedencia`.
   Sem o argumento, a função se comporta exatamente como antes, e é isso que a UI usa como reserva
   quando a coluna ainda está nula. */
export function procedenciaEmail(
  email: string | null | undefined,
  compartilhados?: ReadonlySet<string>,
): ProcedenciaEmail | null {
  if (!email) return null;
  const limpo = email.trim().toLowerCase();
  // Normaliza o domínio: o dado da Receita traz lixo como "gmail.com." (ponto
  // final), que sem isto escapa da lista de webmail e vira "institucional".
  const dominio = (limpo.split("@")[1] ?? "").replace(/[.\s]+$/, "");
  if (!dominio) return null;
  if (CONTABIL.test(limpo)) return "contabilidade";
  if (WEBMAIL.has(dominio)) return "pessoal";
  // Depois do webmail de propósito: gmail.com atende 23 milhões de CNPJs e lidera a lista de
  // compartilhados. Sem esta ordem, todo webmail viraria "intermediário".
  if (compartilhados?.has(dominio)) return "intermediario";
  return "empresa";
}

/** Rótulo curto pra UI. Descritivo, não valorativo — os três são úteis, de formas diferentes. */
export const PROCEDENCIA_LABEL: Record<ProcedenciaEmail, string> = {
  contabilidade: "contabilidade",
  intermediario: "compartilhado",
  pessoal: "pessoal",
  empresa: "institucional",
};

/** Explicação no hover — é aqui que o originador entende o que fazer com o contato. */
export const PROCEDENCIA_TITULO: Record<ProcedenciaEmail, string> = {
  // Vale pros dois casos que aparecem na base: escritório contábil externo
  // (pmecontabil.com.br) e departamento contábil no domínio próprio
  // (contabilidade@empresa.com.br). Nos dois é gatekeeper, não decisor.
  contabilidade:
    "Endereço de contabilidade, do escritório externo ou do departamento. Costuma ser gatekeeper: caminho pro sócio, mas não é o decisor.",
  intermediario:
    "Domínio que atende muitas empresas sem relação entre si: escritório, abertura de CNPJ, agência ou hospedagem. Não se declara contabilidade no nome, mas se comporta como intermediário.",
  pessoal:
    "Webmail pessoal do responsável pelo cadastro. Em empresa familiar costuma ser linha direta com o sócio.",
  empresa:
    "Domínio próprio da empresa. Canal institucional, pode cair em secretaria ou caixa genérica.",
};

/* ─────────────────────────────────────────────────────────────────────────────
   Telefone: o que nem vale discar

   O campo da Receita é preenchido por quem abre a empresa e ninguém confere. Medido na base de
   65 mil: `1199999999` aparece em 167 empresas. Número assim não é contato ruim, é ausência de
   contato disfarçada de contato, e faz o originador gastar uma ligação para descobrir.

   NÃO CONFUNDIR com telefone compartilhado. Compartilhado é real e atende alguém, só que atende
   também outras 453 empresas. Isso é `telefone_empresas_br`, medido no CNPJ nacional, e é outra
   coisa. Aqui é só sintaxe: o número nem existe.
   ───────────────────────────────────────────────────────────────────────────── */

/* DDDs que existem no Brasil. A lista é fechada e muda de década em década, então vale escrever:
   validar por faixa (11 a 99) deixaria passar 20, 23, 25, 26, 29, 30, 36, 39, 40, 50, 52, 56 a 60,
   70, 72, 76, 78, 80 e 90, que não são atribuídos. */
const DDD_VALIDO = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type TelefoneSuspeito = {
  suspeito: boolean;
  /** Frase curta para mostrar ao lado do número. `null` quando o número passa. */
  motivo: string | null;
};

export function telefoneSuspeito(telefone: string | null | undefined): TelefoneSuspeito {
  const d = String(telefone ?? "").replace(/\D/g, "");
  if (!d) return { suspeito: true, motivo: "sem telefone no registro" };
  if (d.length < 10 || d.length > 11) {
    return { suspeito: true, motivo: `${d.length} dígitos, e telefone brasileiro tem 10 ou 11` };
  }
  const ddd = Number(d.slice(0, 2));
  if (!DDD_VALIDO.has(ddd)) return { suspeito: true, motivo: `DDD ${d.slice(0, 2)} não existe` };

  const assinante = d.slice(2);
  // Todos os dígitos iguais (999999999, 000000000): preenchimento, não número.
  if (/^(\d)\1+$/.test(assinante)) {
    return { suspeito: true, motivo: "número de preenchimento, todos os dígitos iguais" };
  }
  // Sequência crescente ou decrescente inteira (12345678, 87654321).
  const cresce = assinante.split("").every((c, i, a) => i === 0 || Number(c) === Number(a[i - 1]) + 1);
  const decresce = assinante.split("").every((c, i, a) => i === 0 || Number(c) === Number(a[i - 1]) - 1);
  if (cresce || decresce) {
    return { suspeito: true, motivo: "número de preenchimento, dígitos em sequência" };
  }
  return { suspeito: false, motivo: null };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Site a partir do domínio do e-mail

   `empresa.site` está em ZERO de 65.520 linhas: a coluna existe desde a primeira migration e
   nunca foi preenchida. Ao mesmo tempo, milhares de empresas têm e-mail em domínio próprio, o
   que É o endereço do site. Derivar sai de graça e destrava o `research`, que hoje não tem por
   onde começar porque não tem URL.

   SÓ DERIVA DE `empresa`. De webmail sairia `https://gmail.com`; de contabilidade e de domínio
   compartilhado sairia o site do escritório, que é pior que nada porque parece certo. Por isso a
   função exige a procedência já calculada, em vez de recalcular por conta própria: quem chama
   tem que ter decidido antes.

   E EXIGE QUE O DOMÍNIO CASE COM O NOME DA EMPRESA. Sem isso a taxa de erro é alta: medido em
   21/09/2026 sobre 8.044 sites derivados, 33,4% tinham domínio sem relação nenhuma com o nome, e
   os exemplos explicam por quê. `olimarcontail.com.br` e `conabilidadeferrari.com.br` são
   escritórios de contabilidade que a regex `CONTABIL` não pega porque o dono digitou o nome
   errado no registro do domínio. Uma clínica médica ganhava o site do contador dela, e o
   originador abriria achando que era a empresa.

   O PREÇO DESSA EXIGÊNCIA está medido e é aceito: perde sigla legítima, como `eds.org.br` para
   ASSOCIAÇÃO EXPEDICIONÁRIOS DA SAÚDE, e domínio com o nome escrito errado pela própria empresa,
   como `funerariafratrelli.com.br` para FUNERÁRIA FRATELLI. São 2.686 sites a menos e nenhum site
   errado. Vazio é recuperável por quem pesquisa; errado e convincente não é.

   NÃO CONFIRMA QUE O SITE EXISTE. Continua sendo palpite, agora com duas condições em vez de uma.
   Quem confirma é quem abrir, ou uma checagem de HTTP depois. */

/* Termos genéricos do setor e da razão social que aparecem em quase todo nome e casariam com
   quase todo domínio. Sem tirá-los, `clinicavet.com.br` casaria com qualquer clínica do país. */
const GENERICAS = new Set([
  "LTDA", "EIRELI", "COMERCIO", "SERVICOS", "SERVICO", "CENTRO", "CLINICA", "LABORATORIO",
  "LABORATORIOS", "VETERINARIO", "VETERINARIA", "VETERINARIOS", "ANIMAL", "ANIMAIS",
  "DIAGNOSTICO", "DIAGNOSTICOS", "ASSISTENCIA", "PLANO", "SAUDE", "ADMINISTRACAO",
  "ADMINISTRADORA", "PARTICIPACOES", "EMPREENDIMENTOS", "CEMITERIO", "CEMITERIOS", "FUNERARIA",
  "FUNERARIOS", "HOSPITAL", "ANALISES", "ANALISE", "MEDICINA", "MEDICOS", "BRASIL", "GRUPO",
  "GESTORA", "CONSULTORIA", "PATOLOGIA", "INDUSTRIA", "COLEGIO", "ESCOLA", "ASSOCIACAO",
]);

/** Sufixos de domínio brasileiros e genéricos, para comparar só a parte que carrega o nome. */
const SUFIXO = /\.(com|net|org|info|io|app|co|vet|eng|adv|med|cnt|arq|bio|odo|psc|nom|ind|srv|tur|agr)?(\.br)?$/;

function tokensDoNome(...nomes: (string | null | undefined)[]): string[] {
  return nomes
    .flatMap((n) =>
      String(n ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        .split(/[^A-Z0-9]+/),
    )
    .filter((t) => t.length >= 4 && !GENERICAS.has(t));
}

export function siteDeEmail(
  email: string | null | undefined,
  procedencia: ProcedenciaEmail | null,
  nomes?: { razao_social?: string | null; nome_fantasia?: string | null },
): string | null {
  if (procedencia !== "empresa" || !email) return null;
  const dominio = (email.trim().toLowerCase().split("@")[1] ?? "").replace(/[.\s]+$/, "");
  if (!dominio || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(dominio)) return null;

  /* Sem nome para comparar, não deriva. Chamar sem os nomes é o caso em que não dá para checar,
     e a resposta certa aí é "não sei", não "vai que dá". */
  if (!nomes) return null;
  const raiz = dominio.replace(SUFIXO, "").replace(/[^a-z0-9]/g, "");
  if (!raiz) return null;
  const casa = tokensDoNome(nomes.razao_social, nomes.nome_fantasia).some((t) => {
    const min = t.toLowerCase();
    return raiz.includes(min) || min.includes(raiz);
  });
  return casa ? `https://${dominio}` : null;
}
