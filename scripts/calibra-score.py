# -*- coding: utf-8 -*-
"""
Loop de calibracao do score v0, contra aquisicoes reais e com o artefato do label neutralizado.

    python scripts/calibra-score.py                  # busca no desenvolvimento
    python scripts/calibra-score.py --iters=800      # busca mais longa
    python scripts/calibra-score.py --com-simples    # inclui um eixo que exige mudar o ingest
    python scripts/calibra-score.py --holdout        # SO no fim: abre o holdout, uma vez

Entrada:  scripts/data/matriz-score.tsv.gz   (extrai-matriz-score.mjs)
Saidas:   src/lib/calibracao-v2.json         (proposta + numeros)
          scripts/data/calibra-log.tsv       (uma linha por avaliacao)

──────────────────────────────────────────────────────────────────────────────────
O QUE A PRIMEIRA RODADA ENSINOU, E QUE MUDOU ESTE SCRIPT INTEIRO

Rodando ingenuamente contra o label de hoje, o ajuste devolveu quadro_plural = [0,41,58]:
o numero de socios PF virando 58 dos 100 pontos, com a idade do dono colapsando pra 4.
Investigando, o label e que estava contaminado:

  · label = "entra socio PJ E sai socio PF" entre os dois snapshots
  · empresas com 1 socio PF: 292.499 delas, ZERO aquisicoes detectadas
  · sair de 1 socio PF pra 0 acontece 1 vez em 292 mil no registro
  · prevalencia por nº de socios: 0,000% (1) · 0,152% (2) · 0,601% (3-4) · 1,600% (5+)

O label so enxerga aquisicao PARCIAL, em que um PJ entra e sobra socio PF. Empresa de
socio unico e ESTRUTURALMENTE inclassificavel: nao e que ela nao venda, e que a venda dela
nao deixa essa assinatura. Calibrar contra isso ensina o modelo a contar socios e a chamar
o resultado de risco sucessorio.

DUAS CORRECOES, e sao elas que fazem este script diferente de uma busca ingenua:

  1. UNIVERSO ELEGIVEL. So entra quem o label consegue classificar (n_pf >= 2). Ranquear
     empresa inclassificavel infla o recall de graca: ela nunca conta como acerto perdido,
     e ainda libera vaga no decil de cima.

  2. METRICA ESTRATIFICADA por nº de socios. Dentro de uma faixa de nº de socios, a parte
     mecanica do label e constante, entao o que sobra e sinal de verdade. E a pergunta certa:
     "entre empresas do mesmo tamanho de quadro, o score poe as adquiridas em cima?"

Consequencia direta: quadro_plural NAO E AVALIAVEL pela metrica estratificada (ele e quase
constante dentro de cada estrato). Por isso ele nao entra na busca, e a decisao sobre ele e
tomada a parte, explicitamente, no fim do relatorio.

──────────────────────────────────────────────────────────────────────────────────
RODADA DE 11/08/2026: `porte` entra, e um candidato foi barrado por vazamento

Motivo de reabrir: `escala_capital` vale 34 dos 100 pontos e e o eixo mais forte do v0, e a
sondagem de 11/08 mediu que `capital_social` e IDENTICO entre 2023 e 2025 em 91% a 95% das
empresas. O eixo mais forte estava construido num campo declarado na fundacao e quase nunca
atualizado. `src/lib/dossier.ts` ja proibia o LLM de usar capital como tamanho; o score fazia
exatamente isso.

Dois candidatos foram testados (`scripts/diagnostico-porte.py`):

  · `porte` da Receita (1=ME, 3=EPP, 5=DEMAIS). ENTRA na busca. Ja esta no ingest e na tabela
    `empresa` do Supabase (ingest-empresas.mjs), entao e usavel em runtime hoje, sem obra.
    As faixas NAO sao monotonicas no tamanho: ME 0,72x · DEMAIS ~1,00x · EPP 2,67x. Por isso a
    ordem dos bins e ME, DEMAIS, EPP e nao a ordem natural. Leitura: EPP e a faixa de mid-market
    de dono unico que a boutique procura, e DEMAIS mistura empresa grande com empresa inelegivel
    ao regime por natureza juridica, inclusive as que ja tem socio PJ.

  · `saiu_simples` (excluida do Simples ANTES do corte, ou seja, estourou o teto de R$4,8 mi de
    receita). Lift 2,15x. So entra com --com-simples, porque a tabela `simples` NAO esta no
    ingest: e medicao do que valeria mudar o ingest, igual ao tratamento dado a `n_estab`.

BARRADO POR VAZAMENTO: a flag `opcao_simples` ("ainda no Simples") dava lift 0,00x com z=11,4,
o que parecia o melhor sinal ja medido e era o desfecho disfarcado. A Lei Complementar 123 proibe
socio PJ no Simples, e o label de aquisicao E "entra socio PJ", entao toda adquirida foi obrigada
a sair. Como a tabela nao tem particao por data, a flag e o estado de 2026. Prova em
`scripts/check-vazamento-simples.mjs`. O campo foi removido da extracao e ha uma guarda abaixo
pra que ele nao volte por acidente numa matriz antiga.
──────────────────────────────────────────────────────────────────────────────────
"""
import gzip, io, json, math, os, sys, time
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATRIZ = os.path.join(ROOT, "scripts", "data", "matriz-score.tsv.gz")
LOG = os.path.join(ROOT, "scripts", "data", "calibra-log.tsv")
SAIDA = os.path.join(ROOT, "src", "lib", "calibracao-v2.json")

args = sys.argv[1:]
def flag(n, p):
    a = next((x for x in args if x.startswith(f"--{n}=")), None)
    return a.split("=", 1)[1] if a else p
ITERS = int(flag("iters", "400"))
LABEL = flag("label", "basica")
ABRIR_HOLDOUT = "--holdout" in args
COM_SIMPLES = "--com-simples" in args
SEED = int(flag("seed", "7"))
N_FOLDS = 5
rng = np.random.default_rng(SEED)

# ────────────────────────────────────────────────────────────────── carga
t0 = time.time()
print("carregando a matriz...")
with gzip.open(MATRIZ, "rt", encoding="utf-8") as f:
    header = f.readline().rstrip("\n").split("\t")
    raw = np.loadtxt(f, delimiter="\t", dtype=object, ndmin=2)
col = {c: i for i, c in enumerate(header)}
gi = lambda c, t=np.int32: raw[:, col[c]].astype(t)

vert_txt = raw[:, col["vertical"]].astype(str)
metade, mf, menor = gi("metade"), gi("mf"), gi("menor")
n_pf, n_pj = gi("n_pf"), gi("n_pj")
anos_ult, anos_emp = gi("anos_ult"), gi("anos_emp")
cap_pct = gi("cap_pct", np.float32)
n_estab = gi("n_estab")
pf_novo, pj_novo = gi("pf_novo"), gi("pj_novo")
porte = gi("porte") if "porte" in col else np.zeros(len(raw), dtype=np.int32)
saiu_simples = gi("saiu_simples") if "saiu_simples" in col else np.zeros(len(raw), dtype=np.int32)
N = len(mf)

# Guarda contra matriz contaminada: estas colunas LEEM O DESFECHO (ver o cabecalho). Se
# aparecerem, a matriz tem que ser reextraida, porque deixar o campo disponivel e esperar
# disciplina e como o erro volta.
#
# `no_simples` e `mei` existiram por algumas horas em 11/08/2026.
#
# `opcao_simples` e `data_exclusao_simples` entraram na tabela `empresa` em 26/08/2026 (migration
# 0015) para FILTRAR a lista e MOSTRAR o regime na tela, a pedido da Setter. Esses usos sao
# legitimos; treinar com eles NAO e, pelo mesmo motivo de sempre: a LC 123 proibe socio PJ no
# Simples e o rotulo de aquisicao E "entra socio PJ", entao toda adquirida foi obrigada a sair.
# Agora que as colunas estao no banco, o caminho para elas chegarem aqui por acidente e MAIS
# curto que antes, e por isso os nomes entram nesta lista explicitamente.
_proibidas = [c for c in ("no_simples", "mei", "opcao_simples", "data_exclusao_simples") if c in col]
if _proibidas:
    sys.exit(f"ABORTADO: a matriz tem coluna contaminada {_proibidas}. "
             "Rode `node --env-file=.env.local scripts/extrai-matriz-score.mjs` de novo.")
verticais = sorted(set(vert_txt))
vert = np.searchsorted(np.array(verticais), vert_txt)

presente = pf_novo >= 0
LABELS = {
    "basica":  presente & (pj_novo > n_pj) & (pf_novo < n_pf),
    "maioria": presente & (pj_novo > n_pj) & (pf_novo <= n_pf / 2),
    "limpa":   presente & (pj_novo > n_pj) & (pf_novo < n_pf) & (n_pj == 0),
}
y = LABELS[LABEL].astype(np.int8)

# Universo elegivel: onde o label consegue classificar.
elegivel = presente & (n_pf >= 2)
perfil = (mf >= 7) & (anos_emp >= 25)

# Estratos de nº de socios: dentro deles a parte mecanica do label e constante.
estrato = np.select([n_pf >= 5, n_pf >= 3], [2, 1], 0)   # 0: 2 socios · 1: 3-4 · 2: 5+

dev, hol = (metade == 0) & elegivel, (metade == 1) & elegivel
fold = rng.integers(0, N_FOLDS, size=N)
# Desempate vem da MATRIZ (hash do CNPJ), nao de sorteio por posicao de linha. Antes de 11/08 era
# `rng.random(N)`, que depende da ordem das linhas, e o BigQuery nao garante ordem entre extracoes:
# o mesmo baseline deu 31,74% e 31,86% em duas rodadas. Ver --ruido pra magnitude do efeito.
desempate = (gi("desempate", np.float32) if "desempate" in col
             else rng.random(N).astype(np.float32))

print(f"  {N:,} linhas · elegiveis {int(elegivel.sum()):,} ({elegivel.sum()/N*100:.1f}%)")
print(f"  label '{LABEL}': {int(y[elegivel].sum()):,} aquisicoes"
      f" · dev {int(y[dev].sum()):,} · holdout {int(y[hol].sum()):,}")
print(f"  perfil sucessorio elegivel: {int((perfil&elegivel).sum()):,}"
      f" · aquisicoes {int(y[perfil&elegivel].sum()):,} · {time.time()-t0:.0f}s")

# ────────────────────────────────────────────────────────── eixos
def bins_de(faixas, x):
    idx = np.zeros(len(x), dtype=np.int8)
    for i, (_, teste) in enumerate(faixas):
        idx[teste(x)] = i
    return idx

EIXOS = {
    "escala_capital": (cap_pct, [("<p50", lambda v: v < .50), ("p50", lambda v: v >= .50),
                                 ("p70", lambda v: v >= .70), ("p85", lambda v: v >= .85),
                                 ("p95", lambda v: v >= .95)]),
    "idade_controle": (mf, [("<6", lambda v: v < 6), ("6", lambda v: v == 6), ("7", lambda v: v == 7),
                            ("8", lambda v: v == 8), ("9", lambda v: v == 9)]),
    "sucessor_aparente": (menor, [("sem", lambda v: (v > 5) | (v == 0)),
                                  ("<=5", lambda v: (v <= 5) & (v > 0))]),
    "movimento_societario": (anos_ult, [("10+/sem", lambda v: (v >= 10) | (v < 0)),
                                        ("<10", lambda v: (v >= 5) & (v < 10)),
                                        ("<5", lambda v: (v >= 0) & (v < 5))]),
    # Ordem dos bins NAO e o tamanho, e o lift medido: ME 0,72x · DEMAIS 1,00x · EPP 2,67x.
    # `escala_para` impoe monotonicidade na ordem dos bins, entao a ordem E a hipotese.
    "porte_receita": (porte, [("ME/ausente", lambda v: (v == 1) | (v == 0)),
                              ("DEMAIS", lambda v: v == 5),
                              ("EPP", lambda v: v == 3)]),
}
if COM_SIMPLES:
    # Fora do ingest hoje. Entra so pra medir quanto valeria trazer a tabela `simples`.
    EIXOS["saiu_simples"] = (saiu_simples, [("nao", lambda v: v == 0), ("sim", lambda v: v == 1)])
# Fora da busca de proposito: quase constante dentro de cada estrato, entao a metrica
# estratificada nao consegue julga-lo. Decisao a parte, no fim.
QUADRO = (n_pf, [("1", lambda v: v < 2), ("2-4", lambda v: v >= 2), ("5+", lambda v: v >= 5)])

NOMES = list(EIXOS)
IDX = {k: bins_de(EIXOS[k][1], EIXOS[k][0]) for k in NOMES}
IDX_QUADRO = bins_de(QUADRO[1], QUADRO[0])
NB = {k: len(EIXOS[k][1]) for k in NOMES}

BASE_FULL = {"escala_capital": [0, 11, 19, 27, 34], "idade_controle": [0, 10, 19, 25, 28],
             "sucessor_aparente": [0, 14], "quadro_plural": [0, 7, 13],
             "movimento_societario": [0, 6, 11]}
# Eixo novo entra no baseline valendo ZERO, pra que "baseline" continue sendo exatamente o
# scoring.ts de hoje e o TETO nao mude. Sem isso a comparacao com a rodada de 02/08 quebra.
BASE = {k: list(BASE_FULL.get(k, [0] * NB[k])) for k in NOMES}

def pontua(pesos, quadro=None):
    s = np.zeros(N, dtype=np.float32)
    for k in NOMES:
        s += np.asarray(pesos[k], dtype=np.float32)[IDX[k]]
    if quadro is not None:
        s += np.asarray(quadro, dtype=np.float32)[IDX_QUADRO]
    return s

# ────────────────────────────────────────────────────────── metricas
def recall_estratificado(score, sel):
    """recall@top10% dentro de (vertical, estrato de nº de socios). Neutraliza o artefato."""
    ac, tot = 0.0, 0
    for v in range(len(verticais)):
        for e in range(3):
            m = sel & (vert == v) & (estrato == e)
            nv = int(m.sum())
            if nv == 0:
                continue
            yv = y[m]
            naq = int(yv.sum())
            if naq == 0:
                continue
            topo = nv // 10 + (1 if nv % 10 else 0)
            o = np.lexsort((desempate[m], -score[m]))[:topo]
            ac += float(yv[o].sum()); tot += naq
    return (ac / tot * 100 if tot else float("nan")), tot

def recall_simples(score, sel):
    """recall@top10% so por vertical. Comparavel ao numero historico, mas contaminado."""
    ac, tot = 0.0, 0
    for v in range(len(verticais)):
        m = sel & (vert == v)
        nv = int(m.sum())
        if nv == 0:
            continue
        yv = y[m]; naq = int(yv.sum())
        if naq == 0:
            continue
        topo = nv // 10 + (1 if nv % 10 else 0)
        o = np.lexsort((desempate[m], -score[m]))[:topo]
        ac += float(yv[o].sum()); tot += naq
    return (ac / tot * 100 if tot else float("nan")), tot

def cv(pesos, quadro=None):
    s = pontua(pesos, quadro)
    rs = [recall_estratificado(s, dev & (fold == f))[0] for f in range(N_FOLDS)]
    rs = [r for r in rs if not math.isnan(r)]
    return float(np.mean(rs)), float(np.std(rs))

def relatorio(pesos, sel, quadro=None):
    s = pontua(pesos, quadro)
    re_, n1 = recall_estratificado(s, sel)
    rs_, _ = recall_simples(s, sel)
    rp_, n2 = recall_estratificado(s, sel & perfil)
    sv = s[sel]
    return {"estratificado": re_, "simples": rs_, "perfil": rp_, "n": n1, "n_perfil": n2,
            "distintos": int(len(np.unique(sv))), "no_teto": float((sv == sv.max()).mean() * 100)}

log_f = io.open(LOG, "w", encoding="utf-8", newline="\n")
log_f.write("iter\tmetodo\tcv\tcv_dp\tdev_estrat\tdev_simples\tdev_perfil\tdistintos\tpesos\n")
_it = [0]
def registra(metodo, pesos, quadro=None):
    m, dp = cv(pesos, quadro)
    a = relatorio(pesos, dev, quadro)
    _it[0] += 1
    log_f.write(f"{_it[0]}\t{metodo}\t{m:.3f}\t{dp:.3f}\t{a['estratificado']:.2f}\t{a['simples']:.2f}"
                f"\t{a['perfil']:.2f}\t{a['distintos']}\t{json.dumps(pesos)}\n")
    log_f.flush()
    return m, dp, a

def escala_para(bruto, teto):
    """Pior faixa de cada eixo = 0, soma dos tetos = `teto`, inteiros, monotonico."""
    desl = {k: [v - min(bruto[k]) for v in bruto[k]] for k in bruto}
    tot = sum(max(v) for v in desl.values())
    if tot <= 0:
        return {k: [0] * len(v) for k, v in desl.items()}
    out = {}
    for k, v in desl.items():
        r, ult = [], 0
        for x in v:
            p = max(int(round(x * teto / tot)), ult)
            r.append(p); ult = p
        out[k] = r
    return out

TETO = sum(max(v) for v in BASE.values())   # mantem a escala dos 4 eixos comparavel

print(f"\n=== baseline (os 4 eixos de scoring.ts, sem quadro_plural) · teto {TETO} ===")
m0, dp0, a0 = registra("baseline", BASE)
print(f"  cv {m0:.2f}% (dp {dp0:.2f}) · estratificado {a0['estratificado']:.1f}%"
      f" · simples {a0['simples']:.1f}% · perfil {a0['perfil']:.1f}%")

# ────────────────────────────────────────────── metodo 1: WoE
def woe():
    out = {}
    for k in NOMES:
        idx, yy = IDX[k][dev], y[dev]
        w = []
        for b in range(NB[k]):
            p1 = max(int(((idx == b) & (yy == 1)).sum()), 1) / max(int((yy == 1).sum()), 1)
            p0 = max(int(((idx == b) & (yy == 0)).sum()), 1) / max(int((yy == 0).sum()), 1)
            w.append(math.log(p1 / p0))
        out[k] = w
    return escala_para(out, TETO)

W = woe()
mW, dpW, aW = registra("woe", W)
print(f"\n=== metodo 1: Weight of Evidence ===")
print(f"  cv {mW:.2f}% (dp {dpW:.2f}) · {json.dumps(W, ensure_ascii=False)}")

# ────────────────────────────────────────────── metodo 2: logistica
def logistica():
    d = np.where(dev)[0]
    cols, nomes_col = [], []
    for k in NOMES:
        for b in range(1, NB[k]):
            cols.append((IDX[k][d] == b).astype(np.float32)); nomes_col.append((k, b))
    X = np.column_stack([np.ones(len(d), dtype=np.float32)] + cols)
    yy = y[d].astype(np.float64)
    beta = np.zeros(X.shape[1]); lam = 1.0
    for it in range(30):
        eta = np.clip(X @ beta, -30, 30)
        p = 1 / (1 + np.exp(-eta))
        w = np.maximum(p * (1 - p), 1e-9)
        passo = np.linalg.solve((X * w[:, None]).T @ X + lam * np.eye(X.shape[1]),
                                X.T @ (yy - p) - lam * beta)
        beta += passo
        if np.max(np.abs(passo)) < 1e-8:
            break
    bruto = {k: [0.0] * NB[k] for k in NOMES}
    for (k, b), c in zip(nomes_col, beta[1:]):
        bruto[k][b] = float(c)
    return escala_para(bruto, TETO), it

L, nit = logistica()
mL, dpL, aL = registra("logistica", L)
print(f"\n=== metodo 2: regressao logistica ({nit+1} iteracoes de Newton) ===")
print(f"  cv {mL:.2f}% (dp {dpL:.2f}) · {json.dumps(L, ensure_ascii=False)}")

# ────────────────────────────────────────────── metodo 3: subida na metrica
def subida(inicio, iters, rotulo):
    atual = {k: list(v) for k, v in inicio.items()}
    melhor, _ = cv(atual)
    it = 0
    for passo in (6, 3, 1):
        houve = True
        while houve and it < iters:
            houve = False
            for k in NOMES:
                for b in range(1, NB[k]):
                    for d in (passo, -passo):
                        cand = {kk: list(vv) for kk, vv in atual.items()}
                        novo = cand[k][b] + d
                        piso = cand[k][b - 1]
                        teto = cand[k][b + 1] if b + 1 < NB[k] else 10**6
                        if novo < piso or novo > teto or novo < 0:
                            continue
                        cand[k][b] = novo
                        cand = escala_para(cand, TETO)
                        it += 1
                        m, _ = cv(cand)
                        if m > melhor + 1e-9:
                            melhor, atual, houve = m, cand, True
                            registra(f"{rotulo}:p{passo}", atual)
                        if it >= iters: break
                    if it >= iters: break
                if it >= iters: break
    return atual, melhor, it

print(f"\n=== metodo 3: subida de encosta na metrica estratificada ===")
cands = {"baseline": (BASE, m0, a0), "woe": (W, mW, aW), "logistica": (L, mL, aL)}
for rot, ini in [("de_logistica", L), ("de_woe", W), ("de_base", BASE)]:
    p, m, it = subida(ini, ITERS, rot)
    a = relatorio(p, dev)
    cands[rot] = (p, m, a)
    print(f"  {rot:14} cv {m:.2f}% em {it} avaliacoes · estrat {a['estratificado']:.1f}%"
          f" · perfil {a['perfil']:.1f}% · {a['distintos']} distintos")

vencedor = max(cands, key=lambda k: cands[k][1])
P, mP, aP = cands[vencedor]

print("\n" + "=" * 84)
print(f"VENCEDOR no desenvolvimento: {vencedor}   cv {mP:.2f}%   (baseline {m0:.2f}%)")
print("=" * 84)
for k in NOMES:
    faixas = " ".join(f[0] for f in EIXOS[k][1])
    print(f"  {k:22} {str(BASE[k]):>22}  ->  {str(P[k]):<22}  [{faixas}]")

# ────────────────────────────────────────────── quadro_plural, a parte
print("\n" + "=" * 84)
print("QUADRO_PLURAL: julgado a parte, porque a metrica estratificada nao o enxerga")
print("=" * 84)
print(f"  {'pontos 2-4 / 5+':22} {'estratificado':>15} {'simples':>10} {'perfil':>10}")
for q in ([0, 0, 0], [0, 4, 7], [0, 7, 13], [0, 14, 26]):
    a = relatorio(P, dev, q)
    print(f"  {str(q):22} {a['estratificado']:>14.2f}% {a['simples']:>9.1f}% {a['perfil']:>9.1f}%")
print("\n  O eixo nao move a metrica estratificada (esperado: ele e quase constante dentro do")
print("  estrato). O que ele move e a metrica SIMPLES, que e justamente a contaminada.")
print("  Evidencia de que os 13 pontos de hoje compram numero de validacao, nao ordenacao real.")

resultado = {
    "gerado_em": time.strftime("%Y-%m-%d"),
    "fonte": "scripts/calibra-score.py",
    "label": LABEL,
    "universo": {"n_matriz": int(N), "n_elegivel": int(elegivel.sum()),
                 "criterio_elegivel": "presente no snapshot de desfecho e n_pf >= 2",
                 "aquisicoes": int(y[elegivel].sum())},
    "metrica_primaria": "recall@top10% estratificado por (vertical, faixa de nº de socios)",
    "metodo": vencedor,
    "faixas": {k: [f[0] for f in EIXOS[k][1]] for k in NOMES},
    "pesos_atuais": BASE_FULL,
    "pesos_propostos": P,
    "desenvolvimento": {"cv": round(mP, 3), "baseline_cv": round(m0, 3),
                        "estratificado": round(aP["estratificado"], 2),
                        "simples": round(aP["simples"], 2), "perfil": round(aP["perfil"], 2),
                        "baseline_estratificado": round(a0["estratificado"], 2),
                        "baseline_simples": round(a0["simples"], 2),
                        "baseline_perfil": round(a0["perfil"], 2)},
    "holdout": None,
}

def bloco_de_empate(pesos, rotulo):
    """Quanto do corte do decil e decidido por empate, e nao pelo score.

    O score e uma soma de poucos inteiros, entao ele tem dezenas de valores distintos pra centenas
    de milhares de empresas. A fronteira do top 10% quase sempre cai DENTRO de um bloco de empate,
    e ai quem entra na lista e quem sai dela e decidido por criterio arbitrario. Isso vale tanto
    aqui quanto na producao, que usa NTILE."""
    s = pontua(pesos)
    vagas_disputadas, vagas_totais = 0, 0
    for v in range(len(verticais)):
        for e in range(3):
            m = dev & (vert == v) & (estrato == e)
            nv = int(m.sum())
            if nv == 0:
                continue
            topo = nv // 10 + (1 if nv % 10 else 0)
            sv = np.sort(s[m])[::-1]
            corte = sv[topo - 1]
            n_no_corte = int((sv == corte).sum())            # empatados no valor da fronteira
            acima = int((sv > corte).sum())                  # entram por merito
            vagas_disputadas += min(n_no_corte, topo - acima) if topo > acima else 0
            vagas_totais += topo
    pct = vagas_disputadas / max(vagas_totais, 1) * 100
    print(f"  {rotulo:10} {vagas_totais:>8,} vagas no top 10% · {vagas_disputadas:>8,} preenchidas"
          f" por desempate ({pct:.1f}%)")
    return pct


print("\n" + "=" * 84)
print("GRANULARIDADE: quanto do top 10% e decidido por desempate, e nao pelo score")
print("=" * 84)
bloco_de_empate(BASE, "baseline")
bloco_de_empate(P, "proposto")
print("\n  Score com poucos valores distintos faz a fronteira do decil cair dentro de um bloco de")
print("  empate. Producao tem o mesmo problema, porque o NTILE tambem desempata arbitrariamente.")

RUIDO = int(flag("ruido", "0"))
if RUIDO:
    # POR QUE ISTO EXISTE: em 11/08/2026 o baseline no holdout deu 31,86% quando a rodada de
    # 02/08 tinha dado 31,74%, com o MESMO codigo, os MESMOS pesos e as mesmas 838 aquisicoes.
    # A causa nao e o modelo: o score tem ~60 valores distintos pra 200 mil empresas, entao a
    # fronteira do decil cai no meio de um bloco gigante de empates, e quem entra no top 10%
    # depende do desempate arbitrario. O BigQuery nao garante ordem de linha entre extracoes,
    # entao o desempate muda de empresa. Producao tem o mesmo problema: o NTILE do SQL tambem
    # desempata arbitrariamente.
    # Sem medir isto, qualquer delta menor que o ruido seria lido como ganho.
    print("\n" + "=" * 84)
    print(f"RUIDO DE DESEMPATE: {RUIDO} sorteios do criterio de desempate, mesmos pesos (dev)")
    print("=" * 84)
    guardado = desempate.copy()
    for rot, pesos in [("baseline", BASE), ("proposto", P)]:
        vals_e, vals_p = [], []
        for s in range(RUIDO):
            desempate[:] = np.random.default_rng(1000 + s).random(N).astype(np.float32)
            a = relatorio(pesos, dev)
            vals_e.append(a["estratificado"]); vals_p.append(a["perfil"])
        print(f"  {rot:10} estratificado {np.mean(vals_e):6.2f}% ± {np.std(vals_e):.2f}"
              f"  (min {min(vals_e):.2f} max {max(vals_e):.2f})"
              f"   ·  perfil {np.mean(vals_p):6.2f}% ± {np.std(vals_p):.2f}")
    desempate[:] = guardado
    print("\n  Leitura: qualquer delta menor que ~2x o desvio acima e empate, nao ganho.")

if ABRIR_HOLDOUT:
    print("\n" + "=" * 84)
    print("HOLDOUT (aberto uma vez)")
    print("=" * 84)
    hb, hp = relatorio(BASE, hol), relatorio(P, hol)
    print(f"  {'':22} {'estratificado':>15} {'simples':>10} {'perfil':>10}")
    print(f"  {'baseline (hoje)':22} {hb['estratificado']:>14.2f}% {hb['simples']:>9.1f}% {hb['perfil']:>9.1f}%")
    print(f"  {'proposto':22} {hp['estratificado']:>14.2f}% {hp['simples']:>9.1f}% {hp['perfil']:>9.1f}%")
    print(f"  {'delta':22} {hp['estratificado']-hb['estratificado']:>+14.2f}  "
          f"{hp['simples']-hb['simples']:>+9.1f}  {hp['perfil']-hb['perfil']:>+9.1f}")
    print(f"\n  n aquisicoes no holdout: {hp['n']} (perfil {hp['n_perfil']})")

    # McNemar pareado: os dois rankers veem as MESMAS aquisicoes, entao comparar duas taxas
    # independentes superestima a incerteza. O que importa e so onde eles discordam.
    def pegou(pesos):
        s = pontua(pesos)
        d = np.zeros(N, dtype=bool)
        for v in range(len(verticais)):
            for e in range(3):
                m = hol & (vert == v) & (estrato == e)
                nv = int(m.sum())
                if nv == 0:
                    continue
                idx = np.where(m)[0]
                topo = nv // 10 + (1 if nv % 10 else 0)
                o = np.lexsort((desempate[m], -s[m]))[:topo]
                d[idx[o]] = True
        return d
    da, db = pegou(BASE), pegou(P)
    pos = hol & (y == 1)
    b01 = int((pos & db & ~da).sum())   # so o proposto pegou
    b10 = int((pos & da & ~db).sum())   # so o atual pegou
    zmc = (b01 - b10) / math.sqrt(b01 + b10) if (b01 + b10) else float("nan")
    print(f"  McNemar: so o PROPOSTO pegou {b01} · so o ATUAL pegou {b10} · z = {zmc:.2f}")
    resultado["mcnemar"] = {"so_proposto": b01, "so_atual": b10, "z": round(zmc, 3)}
    resultado["holdout"] = {"n": hp["n"], "n_perfil": hp["n_perfil"],
                            "baseline": {k: round(hb[k], 2) for k in ("estratificado", "simples", "perfil")},
                            "proposto": {k: round(hp[k], 2) for k in ("estratificado", "simples", "perfil")}}
else:
    print("\n  (holdout NAO aberto. rode com --holdout quando a busca encerrar.)")

io.open(SAIDA, "w", encoding="utf-8", newline="\n").write(json.dumps(resultado, ensure_ascii=False, indent=2))
log_f.close()
print(f"\nok: {SAIDA}\nlog: {LOG} ({_it[0]} avaliacoes)")
