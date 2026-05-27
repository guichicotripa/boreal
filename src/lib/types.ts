// Tipos compartilhados do pipeline de busca.

/** Filtros estruturados extraídos da query em linguagem natural. */
export type SearchFilters = {
  cnaePrefixes: string[];        // prefixos CNAE, ex: ["24","25","28"]
  minFaixaEtaria: number | null; // faixa etária mínima dos sócios (código 1–9)
  maxAnoFundacao: number | null; // empresa fundada ATÉ este ano (= empresa antiga)
  limit: number;
};

export type Socio = {
  id: string;
  nome: string;
  qualificacao: string | null;
  faixa_etaria: string | null;
  data_entrada_sociedade: string | null;
};

export type Empresa = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_principal: string | null;
  municipio: string | null;
  uf: string | null;
  data_inicio_atividade: string | null;
  capital_social: number | null;
  porte: string | null;
  socio?: Socio[];
};

export type SearchResponse = {
  filters: SearchFilters;
  parsedBy: "llm" | "heuristic";
  count: number;
  empresas: Empresa[];
};
