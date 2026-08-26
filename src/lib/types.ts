// Tipos compartilhados do pipeline de busca.

/** Filtros estruturados extraídos da query em linguagem natural. */
export type SearchFilters = {
  cnaePrefixes: string[];        // prefixos CNAE, ex: ["24","25","28"]
  minFaixaEtaria: number | null; // faixa etária mínima dos sócios (código 1–9)
  maxAnoFundacao: number | null; // empresa fundada ATÉ este ano (= empresa antiga)
  /* Valores de `empresa.porte` que passam (ME | EPP | DEMAIS). null/vazio = todos.
     É filtro de FATURAMENTO disfarçado: o porte da Receita é definido por receita bruta
     (LC 123/2006), e é o único proxy de tamanho que a base tem. Opcional porque os caches
     estáticos foram gerados antes deste campo existir. Ver src/lib/filtro-padrao.ts. */
  portes?: string[] | null;
  /* Tira da lista quem e optante pelo Simples Nacional (fatura < R$ 4,8 MM/ano). Existe porque
     `porte = DEMAIS` sozinho MENTE: 28% do universo qualificado do Foco A estava em DEMAIS e no
     Simples ao mesmo tempo. Ver src/lib/filtro-padrao.ts. */
  excluirSimples?: boolean;
  // Praça: siglas de UF, ou null se a tese não restringir. Opcional porque os
  // caches estáticos foram gerados antes deste campo existir.
  ufs?: string[] | null;
  // Setor que a consulta pediu e a base NÃO cobre (ex: "construção"). Quando
  // preenchido, a busca devolve zero de propósito — melhor que entregar outro
  // setor calado, que era o comportamento antigo.
  setorForaDaBase?: string | null;
  limit: number;
};

export type Socio = {
  id: string;
  nome: string;
  qualificacao: string | null;
  faixa_etaria: string | null;
  data_entrada_sociedade: string | null;
};

export type CnaeSecundario = { codigo: string; descricao: string | null };

export type Empresa = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_principal: string | null;
  cnae_principal_desc: string | null;     // descrição legível do CNAE (enrichment N0)
  cnaes_secundarios: CnaeSecundario[] | null;
  natureza_juridica: string | null;       // descrição (ex: "Sociedade Empresária Limitada")
  municipio: string | null;               // nome da cidade (resolvido do código IBGE)
  uf: string | null;
  data_inicio_atividade: string | null;
  capital_social: number | null;
  porte: string | null;
  /* Regime tributário (migration 0015). `opcao_simples` NULL = não verificado, diferente de false.
     `data_exclusao_simples` tem DUAS causas opostas: estourou o teto de R$ 4,8 MM (cresceu) ou
     entrou sócio PJ, que a LC 123 proíbe (foi adquirida). Ver regimeTributario() em
     filtro-padrao.ts. PROIBIDOS como feature de treino do score. */
  opcao_simples?: boolean | null;
  data_exclusao_simples?: string | null;
  telefone: string | null;                // contato — output mais valioso pra deal sourcing
  email: string | null;
  socio?: Socio[];
  // Adicionados em runtime pelo /api/search (não vêm do banco):
  score?: import("./scoring").ScoreResult;
  insight?: {
    one_liner: string;
    flags: string[];
  };
  // Investigação v1 já persistida (score_run). Presente só quando a empresa JÁ foi
  // investigada — a busca usa isto pra reordenar e a linha pra mostrar o delta.
  score_v1?: ScoreV1;
};

/** Resultado persistido da investigação — o que a busca precisa saber sem carregar o research inteiro. */
export type ScoreV1 = {
  score: number;
  delta: number;
  investigado_em: string; // ISO — quando a investigação rodou
  /* Soma dos pesos dos sinais ANTES do teto de 100. O score satura e a evidência
     não: sem isto, uma empresa com quatro achados e outra com um só empatam em 100
     e a lista perde a ordem justamente onde o originador começa a trabalhar. */
  ajuste_bruto?: number;
};

// Research-agent — sinais qualitativos da web que elevam score v0 → v1.
export type SinalQualitativo = {
  tipo: string;
  rotulo: string;
  descricao: string;
  fonte_url: string | null;
  peso: number;
};

export type ResearchResult = {
  sinais: SinalQualitativo[];
  presenca_digital: "alta" | "media" | "baixa" | "nenhuma";
  resumo: string;
  // Perfil do negócio: o que faz, produtos/serviços, modelo, clientes — descrição
  // editorial achada na web. NÃO afeta o score. null se não houver base pública.
  perfil_negocio?: string | null;
  score_v0: number;
  score_v1: number;
  delta: number;
  // "Por que agora": o gatilho de timing mais acionável (ou null se nada time-sensitive).
  // Transforma um nome numa lead — diz QUANDO/por que abordar, não só em quem.
  gatilho: string | null;
  // Rascunho do 1º contato, citando o gatilho (não-genérico). Ponto de partida pro humano.
  mensagem_abordagem: string | null;
};

// Trajetória societária — o quadro de sócios reconstruído em múltiplos snapshots do CNPJ.
// Captura o que o retrato atual não mostra: SAÍDAS e ENVELHECIMENTO de faixa ao longo do tempo.
export type TrajetoriaPonto = { ano: number; n_pf: number; n_pj: number; faixa_max: string | null };
export type TrajetoriaEvento = { ano: number; texto: string; tipo: "entrou" | "saiu" | "envelheceu" };
export type TrajetoriaResult = { pontos: TrajetoriaPonto[]; eventos: TrajetoriaEvento[] };

// Red flag a investigar antes de avançar o deal (classificado por severidade).
// Não afirma que o passivo existe — lista o risco provável dado o perfil + onde checar.
export type RedFlag = {
  risco: string;
  severidade: "alta" | "media" | "baixa";
  como_verificar: string;
};

// Análise do dossiê gerada por LLM (parte narrativa do memo).
export type DossierAnalise = {
  overview: string;
  analise_sucessoria: string;
  red_flags: RedFlag[];
  perguntas_abordagem: string[];
  tese_aproximacao: string;
  proximo_passo: string;
};

export type DossierResponse = {
  empresa: Empresa;
  analise: DossierAnalise;
};

// Funil de originação (v2): da identificação ao desfecho.
export type EstagioOportunidade =
  | "identificado" | "abordado" | "em_conversa" | "qualificado" | "entregue" | "arquivado";
export type ResultadoOportunidade =
  | "pendente" | "receptivo" | "nao_receptivo" | "deal_fechado" | "perdido";

// Tipos de toque no log de atividade (relationship intel, manual-first).
export type TipoInteracao = "ligacao" | "email" | "reuniao" | "whatsapp" | "nota";

export type Interacao = {
  id: string;
  oportunidade_id: string;
  tipo: TipoInteracao;
  descricao: string;
  autor: string | null;
  criado_em: string;
};

export type Oportunidade = {
  id: string;
  estagio: EstagioOportunidade;
  resultado: ResultadoOportunidade;
  notas: string | null;
  dono: string | null;            // DRI
  proxima_acao: string | null;
  proxima_acao_em: string | null; // YYYY-MM-DD
  score_no_save: number | null;   // "previsto" do loop de outcome
  created_at: string;
  // Selo de proveniência (migration 0005) — prova de origem pro success fee.
  origem?: string | null;
  selado_em?: string | null;
  proveniencia_hash?: string | null;
  novo_para_setter?: boolean | null;
  /** Datas dos toques — para calcular último contato sem query extra. */
  interacoes?: { criado_em: string }[];
  /* Firma dona. Só interessa a quem é staff, que lê através das orgs: para o
     originador esta lista tem uma firma só, sempre a dele. */
  escopo_id?: string;
  firma?: { nome: string } | null;
  empresa: Pick<
    Empresa,
    "id" | "cnpj" | "razao_social" | "nome_fantasia" | "cnae_principal_desc"
    | "municipio" | "uf" | "capital_social" | "porte" | "telefone" | "email"
  > & {
    /** Sócios com nome e faixa etária — para identificar o fundador na row. */
    socio?: Pick<Socio, "nome" | "faixa_etaria">[];
  };
};

export type SearchResponse = {
  filters: SearchFilters;
  parsedBy: "llm" | "heuristic";
  count: number;
  empresas: Empresa[];
  reasoned: boolean;          // se o reasoner LLM rodou e enriqueceu o top N
  reasonedCount?: number;     // quantas empresas receberam insight
  cached?: boolean;           // true quando servido do cache de demos (instantâneo)
  /* Fora do CONTRATO ≠ fora da base: o dado existe, esta firma não comprou.
     `foraDoContrato` = nada do que foi pedido está liberado (count = 0).
     `foraDoContratoParcial` = veio lista, mas menor que a pergunta. */
  foraDoContrato?: string | null;
  foraDoContratoParcial?: string | null;
  /** Página servida (0-based) e se existe próxima. `temMais` vem do banco, antes
   *  do filtro de descartadas: página com menos de 50 ainda pode ter próxima. */
  pagina?: number;
  temMais?: boolean;
};
