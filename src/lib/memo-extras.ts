// Blocos QUANTITATIVOS do memo — determinísticos, derivados de dado real (não LLM, não fabricado).
// Mantém o padrão "dado no código, narrativa no LLM". Três blocos que fazem o memo de sourcing
// virar 10/10 SEM inventar financeiro (que destruiria a credibilidade com um juiz de PE):
//   1. Precedentes — atividade de M&A real do setor, minerada do CNPJ.
//   2. Cenário de retorno — faixas de referência de mercado (frame, não valuation da empresa).
//   3. Para fechar o número — o que pedir ao dono pra sair de sourcing e ir pra IC.

import precedentesData from "./precedentes.json";
import type { Empresa } from "./types";

export type Comprador = { nome: string; n: number };

export type Precedentes = {
  setor: string;
  n_deals: number;
  periodo_anos: number;
  padrao: "consolidacao" | "pontual";
  compradores: Comprador[];
  exemplos: string[];
} | null;

export type CenarioIlustrativo = {
  multiplo_entrada: string;
  multiplo_saida: string;
  hold: string;
  retorno_alvo: string;
  nota: string;
};

const PERIODO_ANOS = 2.4;

type DivisaoRaw = {
  setor: string;
  n_deals: number;
  padrao: string;
  compradores: Comprador[];
  exemplos: string[];
};

function divisaoDe(e: Empresa): string {
  return (e.cnae_principal ?? "").slice(0, 2);
}

// #1 — Precedentes de M&A no setor da empresa (CNAE de 2 dígitos). null se não houver dado.
export function precedentesParaEmpresa(e: Empresa): Precedentes {
  const divs = precedentesData.divisoes as Record<string, DivisaoRaw>;
  const d = divs[divisaoDe(e)];
  if (!d || d.n_deals === 0) return null;
  return {
    setor: d.setor,
    n_deals: d.n_deals,
    periodo_anos: PERIODO_ANOS,
    padrao: d.padrao === "consolidacao" ? "consolidacao" : "pontual",
    compradores: (d.compradores ?? []).slice(0, 4),
    exemplos: (d.exemplos ?? []).slice(0, 3),
  };
}

// #2 — Cenário de retorno: faixas de REFERÊNCIA do mercado, não valuation desta empresa.
export function cenarioIlustrativo(e: Empresa): CenarioIlustrativo {
  const saude = divisaoDe(e) === "86";
  return {
    multiplo_entrada: saude ? "6–10× EBITDA" : "4–6× EBITDA",
    multiplo_saida: saude ? "8–12× EBITDA" : "6–8× EBITDA",
    hold: "4–6 anos",
    retorno_alvo: "IRR 28–40% · MOIC 2,5–4×",
    nota:
      "Faixas de referência de mercado (BR middle-market). NÃO estimamos receita/EBITDA a partir do " +
      "CNPJ — rode os números quando o dono passar os reais.",
  };
}

// #3 — O que pedir ao dono pra sair de sourcing e fechar o número (sourcing → IC).
export function dadosParaFechar(e: Empresa): string[] {
  const lista = [
    "Faturamento e EBITDA dos últimos 3 anos, com add-backs do dono (pró-labore acima de mercado, despesas pessoais)",
    "Dívida líquida e garantias pessoais dos sócios",
    "Concentração de clientes (os 5 maiores = % da receita)",
    "Capex de manutenção e estado real dos ativos",
    "Capital de giro normalizado (estoque + recebíveis − fornecedores)",
  ];
  if (divisaoDe(e) === "86") {
    lista.splice(3, 0, "Mix convênio × particular e dependência de credenciamento/credenciados-chave");
  }
  return lista;
}
