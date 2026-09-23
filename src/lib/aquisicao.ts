/* "Esta empresa provavelmente já tem dono?", a partir SÓ do quadro societário público.
 *
 * ORIGEM: é a pergunta que a Fernanda (Setter) fazia à mão, uma empresa por vez, no CNPJ.biz:
 * "entro nela para olhar, para entender se ela não foi adquirida" (áudio de 24/08/2026). Nasceu
 * como `scripts/detecta-aquisicao.mjs` em 20/09 e mudou para cá em 23/09 para a tela e o script
 * usarem a MESMA regra. Duas cópias divergiriam na primeira correção.
 *
 * VALIDADO contra o que a Fernanda já sabia de cabeça: acertou PROVET comprada pela Petlove, NEW
 * PROVET comprada pela PROVET e TECSA pela Pet Care. Errou a TOMOVET, onde o vínculo está nas
 * pessoas e não numa holding. Três de quatro, com a falha explicada.
 *
 * COMO RECONHECE PESSOA JURÍDICA: `cpf_cnpj_mascarado` com 14 dígitos, ou `faixa_etaria = '0'`, que
 * a Receita usa para PJ. É cadastro, não regex de nome. Regex erraria com "LLC", "INC" e com pessoa
 * física cujo sobrenome parece razão social; errou de fato em 20/09 com PHAGELAB LLC.
 *
 * A DISTINÇÃO QUE IMPEDE O DETECTOR DE MENTIR: sócio PJ entrando pode ser (a) comprador de fora ou
 * (b) holding da própria família, que é organização patrimonial e não venda. Exemplo real: SÃO
 * FRANCISCO SERVIÇOS FUNERÁRIOS tem VILA PARTICIPAÇÕES no quadro, e os sócios pessoa física se
 * chamam Vila. Sem separar, o detector chamaria de vendida uma empresa que segue com a família. A
 * web confirmou a leitura de forma independente em 21/09: é o Grupo Morada da Paz, dos Vila.
 *
 * O `cpf_cnpj_mascarado` NUNCA VAI PARA O NAVEGADOR. A regra roda no servidor e a tela recebe só o
 * veredito. Minimização de dado pessoal: a tela precisa saber se há comprador, não o CPF de ninguém.
 *
 * PURO: sem banco, sem request. Testável sozinho. */

export type SocioParaControle = {
  nome: string;
  cpf_cnpj_mascarado?: string | null;
  faixa_etaria?: string | null;
  data_entrada_sociedade?: string | null;
};

export type VereditoControle =
  | "provavelmente comprada"
  | "reorganização familiar"
  | "não sei, mas o quadro mudou"
  | "sem sinal de venda";

export type SinalControle = {
  veredito: VereditoControle;
  confianca: "alta" | "média" | "baixa";
  porque: string;
  /** Nome da sócia PJ que motivou o veredito, quando há. Razão social de PJ não é dado pessoal. */
  holding: string | null;
  holdingDesde: number | null;
};

/* Partículas e termos de razão social que NÃO servem para casar família: aparecem em qualquer nome
   e criariam parentesco falso entre coisas sem relação. SANTOS, SILVA, SOUZA e OLIVEIRA estão aqui
   porque são comuns demais para provar parentesco. */
const VAZIAS = new Set(["DE", "DA", "DO", "DAS", "DOS", "LTDA", "EIRELI", "PARTICIPACOES", "PARTICIPACAO",
  "HOLDING", "ADMINISTRACAO", "ADMINISTRADORA", "EMPREENDIMENTOS", "EMPREENDIMENTO", "INVESTIMENTOS",
  "INVESTIMENTO", "COMERCIO", "SERVICOS", "SERVICO", "GESTAO", "GESTORA", "CONSULTORIA", "IMOBILIARIA",
  "AGROPECUARIA", "BRASIL", "GRUPO", "IRMAOS", "FILHOS", "COMPANHIA", "JUNIOR", "NETO", "FILHO",
  "SOBRINHO", "SANTOS", "SILVA", "SOUZA", "OLIVEIRA"]);

const semAcento = (s: string | null | undefined) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const tokens = (nome: string | null | undefined) =>
  semAcento(nome).split(/[^A-Z0-9]+/).filter((t) => t.length >= 4 && !VAZIAS.has(t));
const ano = (d: string | null | undefined) => (d ? Number(String(d).slice(0, 4)) : null);

export function ehSocioPJ(s: SocioParaControle): boolean {
  return s.faixa_etaria === "0" || String(s.cpf_cnpj_mascarado ?? "").replace(/\D/g, "").length === 14;
}

export function classificaControle(
  socios: SocioParaControle[],
  dataInicioAtividade: string | null | undefined,
): SinalControle {
  const pjs = socios.filter(ehSocioPJ);
  const pfs = socios.filter((s) => !ehSocioPJ(s));
  const sobrenomesPF = new Set(pfs.flatMap((s) => tokens(s.nome)));

  const daFamilia = (pj: SocioParaControle) => tokens(pj.nome).some((t) => sobrenomesPF.has(t));
  const deTerceiro = pjs.filter((pj) => !daFamilia(pj));
  const familiares = pjs.filter(daFamilia);

  const anoFund = ano(dataInicioAtividade);
  const entradas = socios.map((s) => ano(s.data_entrada_sociedade)).filter((x): x is number => x != null);
  /* Quadro inteiro entrou anos depois da fundação: ninguém que abriu a empresa continua nela. É
     troca de controle mesmo sem PJ no quadro, porque pode ter sido compra por pessoas físicas. */
  const primeira = entradas.length ? Math.min(...entradas) : null;
  const quadroTrocado = primeira != null && anoFund != null && primeira >= anoFund + 3;

  if (deTerceiro.length) {
    const recente = [...deTerceiro].sort((a, b) =>
      String(b.data_entrada_sociedade ?? "").localeCompare(String(a.data_entrada_sociedade ?? "")),
    )[0];
    const desde = ano(recente.data_entrada_sociedade);
    return {
      veredito: "provavelmente comprada",
      confianca: desde != null && desde >= 2018 ? "alta" : "média",
      porque: `sócia ${recente.nome}, sem sobrenome em comum com o quadro${desde ? `, entrou em ${desde}` : ""}`,
      holding: recente.nome,
      holdingDesde: desde,
    };
  }
  if (familiares.length) {
    const h = familiares[0];
    return {
      veredito: "reorganização familiar",
      confianca: "média",
      porque: `sócia ${h.nome} divide sobrenome com os sócios pessoa física, então parece holding da própria família`,
      holding: h.nome,
      holdingDesde: ano(h.data_entrada_sociedade),
    };
  }
  if (quadroTrocado) {
    return {
      veredito: "não sei, mas o quadro mudou",
      confianca: "baixa",
      porque: `nenhum sócio atual estava na empresa na fundação (${anoFund}); o primeiro entrou em ${primeira}`,
      holding: null,
      holdingDesde: null,
    };
  }
  return {
    veredito: "sem sinal de venda",
    confianca: "alta",
    porque: "só sócios pessoa física, e pelo menos um desde a fundação",
    holding: null,
    holdingDesde: null,
  };
}

/* Calcula o veredito e APAGA o CPF mascarado dos sócios, na mesma operação.
 *
 * Juntas de propósito: se fossem duas funções, alguém chamaria a primeira e esqueceria a segunda,
 * e o `cpf_cnpj_mascarado` sairia na resposta da API. Aqui não tem como obter o veredito sem limpar.
 * Muta o objeto porque as rotas já trabalham com os objetos que o PostgREST devolveu. */
export function anexaControle<
  T extends { socio?: SocioParaControle[] | null; data_inicio_atividade?: string | null },
>(empresa: T): T & { controle: SinalControle } {
  const controle = classificaControle(empresa.socio ?? [], empresa.data_inicio_atividade);
  for (const s of empresa.socio ?? []) delete (s as { cpf_cnpj_mascarado?: unknown }).cpf_cnpj_mascarado;
  return Object.assign(empresa, { controle });
}

/** Linha de `verificacao_aquisicao` (migrations 0017 e 0018), como a tela a consome. */
export type VerificacaoWeb = {
  veredito: "comprada" | "independente" | "inconclusivo";
  comprador: string | null;
  quando: string | null;
  confianca: "alta" | "media" | "baixa";
  resumo: string | null;
  fontes: { url: string; titulo?: string }[];
  eventos: { tipo: string; quando: string | null; quem: string | null; url: string }[];
  criado_em: string;
};
