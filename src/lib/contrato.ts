/* As REGRAS do contrato — puras, sem banco, sem `next/headers`.
 *
 * Separadas de `permissoes.ts` (que é server-only e busca as linhas no Postgres) por um motivo
 * prático: aqui é onde moram as decisões contraintuitivas do modelo de contrato, e decisão
 * contraintuitiva sem teste apodrece. O runner nativo do `node --test` não consegue importar
 * `permissoes.ts`, porque ele puxa `supabase-server` e `sessao`, então a regra ficaria sem
 * cobertura enquanto morasse lá.
 *
 * `permissoes.ts` reexporta tudo daqui: nenhum call-site precisa saber da divisão.
 *
 * AS TRÊS REGRAS, e as duas primeiras se contradizem de propósito:
 *   setor  vazio = TODOS   (universo que existe por padrão; contrato sem recorte de setor)
 *   praça  vazia = TODAS   (idem)
 *   mandato vazio = NENHUM (universo carregado sob encomenda; default de quem não comprou é não ver)
 *   módulo vazio  = NENHUM (superfície vendida à parte)
 *
 * NADA AQUI PROTEGE. Quem recusa é a policy de `empresa` (migrations 0012 e 0014). Isto existe
 * para a aplicação SABER, e explicar: sem isso, pedir um setor fora do contrato devolveria lista
 * vazia e pareceria produto quebrado. Um bug neste arquivo some com um botão; não abre dado.
 */

export type Permissoes = {
  setores: string[];  // ids do registry. [] = todos
  /* ids de src/lib/mandatos.ts. Quarta dimensão, irmã de `setores` (migration 0014), com a regra
     de leitura INVERTIDA — ver `mandatoPermitido` e `universoDaOrg`. */
  mandatos: string[];
  ufs: string[];      // siglas. [] = todas
  modulos: string[];  // superfícies liberadas, ex: "heatmap"
  /* Gente da casa (papel = 'boreal'). Ignora as dimensões do contrato e lê através das orgs. A
     regra REAL vive em `eh_staff()` no Postgres (migration 0013); isto é a cópia que a UI usa
     pra decidir o que desenhar. */
  staff: boolean;
};

export const SEM_ACESSO: Permissoes = { setores: [], mandatos: [], ufs: [], modulos: [], staff: false };

/** Setor está no contrato? Lista vazia = contrato sem restrição de setor. */
export function setorPermitido(p: Permissoes, setorId: string): boolean {
  return p.staff || p.setores.length === 0 || p.setores.includes(setorId);
}

/* Mandato está no contrato? O INVERSO da regra de setor: lista vazia = NENHUM. Mandato é universo
   carregado sob encomenda pra uma firma, então o default de quem não contratou é não ver, igual a
   módulo. Se fosse "vazio = todos", a primeira firma a entrar sem contrato enxergaria o mandato
   que carregamos para a Setter. */
export function mandatoPermitido(p: Permissoes, mandatoId: string): boolean {
  return p.staff || p.mandatos.includes(mandatoId);
}

/** UF está na praça contratada? Lista vazia = sem restrição de praça. */
export function ufPermitida(p: Permissoes, uf: string): boolean {
  return p.staff || p.ufs.length === 0 || p.ufs.includes(uf.toUpperCase());
}

/* Módulo é o oposto de setor e praça: lista vazia significa NENHUM módulo, não todos. Setor e
   praça delimitam um universo que existe por padrão; módulo é superfície vendida à parte, e o
   default de algo vendido à parte é desligado. */
export function temModulo(p: Permissoes, modulo: string): boolean {
  return p.staff || p.modulos.includes(modulo);
}

/* O universo da firma na forma que a TELA precisa: que setores desenhar no switcher e que
   mandatos desenhar na linha de baixo.

   A REGRA QUE NÃO É ÓBVIA: firma COM mandato contratado passa a ler `p.setores` ao pé da letra, e
   vazio ali vira NENHUM setor. É o caso da Setter, que fechou piloto por três mandatos e nada
   mais. Sem esta linha, `setores: []` cairia no "vazio = sem restrição" e o switcher continuaria
   oferecendo os quatro setores validados, que é exatamente o que o contrato não cobre e o que a
   policy da 0014 nega.

   Firma sem mandato nenhum mantém o comportamento antigo, inclusive `[]` = todos. */
/* Com que universo a bancada ABRE, dado o que a firma contratou.
 *
 * Três saídas porque a tela usa três coisas diferentes:
 *   setorDefault   — o setor que manda nos atalhos e na faixa de cobertura quando nada foi clicado
 *   setorInicial   — o estado de `setorAtivo`, onde **null significa metalmecânica**. O sentinela
 *                    existe porque metalmec é a única chave do demo-cache sem prefixo; mandar o id
 *                    explícito faria a home perder o cache instantâneo.
 *   mandatoInicial — preenchido só pra firma SEM setor no contrato.
 *
 * O DEFEITO QUE ISTO CONSERTA. A Setter tem `setores: []`, então `setorDefault` é null e a
 * primeira tela dela era: nenhum switcher, nenhuma lista, e três atalhos de METALMECÂNICA vindos
 * do fallback de `tesesDe(null)`. Um setor que ela não contratou, cujo clique só produz "fora do
 * contrato". Abrir no primeiro mandato resolve as três coisas de uma vez.
 *
 * Firma COM setor continua abrindo na tela em branco, que é deliberada: o originador escreve a
 * tese antes de ver lista. */
export function aberturaDaBancada(
  setores: readonly { id: string }[],
  mandatos: readonly { id: string }[]
): { setorDefault: string | null; setorInicial: string | null; mandatoInicial: string | null } {
  const setorDefault = setores.find((s) => s.id === "metalmec")?.id ?? setores[0]?.id ?? null;
  return {
    setorDefault,
    setorInicial: setorDefault === "metalmec" ? null : setorDefault,
    mandatoInicial: setorDefault === null ? mandatos[0]?.id ?? null : null,
  };
}

export function universoDaOrg(
  p: Permissoes,
  todosSetores: readonly { id: string }[],
  todosMandatos: readonly { id: string }[]
): { setores: string[]; mandatos: string[] } {
  if (p.staff) {
    return { setores: todosSetores.map((s) => s.id), mandatos: todosMandatos.map((m) => m.id) };
  }
  const mandatos = todosMandatos.filter((m) => p.mandatos.includes(m.id)).map((m) => m.id);
  const setores =
    mandatos.length > 0
      ? todosSetores.filter((s) => p.setores.includes(s.id)).map((s) => s.id)
      : todosSetores.filter((s) => setorPermitido(p, s.id)).map((s) => s.id);
  return { setores, mandatos };
}
