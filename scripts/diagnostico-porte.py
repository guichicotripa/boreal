# -*- coding: utf-8 -*-
"""
`porte` e `saiu do Simples` valem alguma coisa como eixo, ou sao redundantes com capital social?

    python scripts/diagnostico-porte.py

POR QUE ELE EXISTE: capital social e o eixo mais forte do score v0 (34 dos 100 pontos), e a
sondagem de 11/08/2026 mostrou que o campo e IDENTICO entre 2023 e 2025 em 91% a 95% das empresas.
Ou seja, o eixo mais forte do modelo esta construido em cima de um numero declarado na fundacao e
quase nunca atualizado. Existem dois substitutos de graca na mesma base:

  · `porte`        faixa da Receita (1=ME, 3=EPP, 5=DEMAIS). Tem consequencia tributaria, entao a
                   empresa e obrigada a manter.
  · `saiu_simples` a empresa foi excluida do Simples ANTES do corte, ou seja, estourou o teto de
                   receita de R$4,8 mi. E um sinal de tamanho com data, nao um numero declarado.

A pergunta que decide nao e "porte tem lift" (tem, e obvio, e proxy de tamanho). E:

    depois de condicionar em capital, sobra lift no porte?   (porte agrega)
    depois de condicionar em porte, sobra lift no capital?   (capital ainda serve)

Se so o primeiro sobrar, capital e o eixo que deve sair. Se os dois sobrarem, os dois medem coisas
diferentes e o score ganha em ter os dois.

METODO: tudo no universo ELEGIVEL (n_pf >= 2) e estratificado por faixa de nº de socios, pelo mesmo
motivo da rodada de 02/08 (`brain/modelo-de-score.md` §13): o label "entra PJ e sai PF" premia
empresa com muitos socios por aritmetica, entao lift global mente. So DEV: o holdout fica fechado.
"""
import gzip, math, os, sys
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATRIZ = os.path.join(ROOT, "scripts", "data", "matriz-score.tsv.gz")

print("carregando...")
with gzip.open(MATRIZ, "rt", encoding="utf-8") as f:
    header = f.readline().rstrip("\n").split("\t")
    raw = np.loadtxt(f, delimiter="\t", dtype=object, ndmin=2)
col = {c: i for i, c in enumerate(header)}
g = lambda c, t=np.int32: raw[:, col[c]].astype(t)

metade, mf, n_pf, n_pj = g("metade"), g("mf"), g("n_pf"), g("n_pj")
anos_emp, anos_ult = g("anos_emp"), g("anos_ult")
cap_pct = g("cap_pct", np.float32)
pf_novo, pj_novo = g("pf_novo"), g("pj_novo")
porte = g("porte")
saiu_simples, no_simples, mei = g("saiu_simples"), g("no_simples"), g("mei")
N = len(mf)

presente = pf_novo >= 0
y = (presente & (pj_novo > n_pj) & (pf_novo < n_pf))
elegivel = presente & (n_pf >= 2)
dev = (metade == 0) & elegivel
estrato = np.select([n_pf >= 5, n_pf >= 3], [2, 1], 0)
NOME_ESTRATO = {0: "2 socios", 1: "3-4", 2: "5+"}

print(f"  {N:,} linhas · dev elegivel {int(dev.sum()):,} · aquisicoes no dev {int(y[dev].sum()):,}")

print("\n" + "=" * 96)
print("0. COBERTURA DOS CAMPOS NOVOS (dev elegivel)")
print("=" * 96)
for nome, v in [("porte=1 ME", porte == 1), ("porte=3 EPP", porte == 3), ("porte=5 DEMAIS", porte == 5),
                ("porte ausente", porte == 0), ("saiu do Simples antes do corte", saiu_simples == 1),
                ("no Simples no corte", no_simples == 1), ("MEI no corte", mei == 1)]:
    n = int((dev & v).sum())
    print(f"  {nome:34} {n:>9,}  ({n/max(int(dev.sum()),1)*100:5.1f}%)")


def z_prop(p_a, n_a, p_u, n_u):
    """z da diferenca de proporcoes. Sem isto, lift alto em celula pequena parece descoberta."""
    if n_a == 0 or n_u == 0:
        return float("nan")
    se = math.sqrt(p_u * (1 - p_u) / n_u + p_a * (1 - p_a) / max(n_a, 1))
    return abs(p_a - p_u) / se if se > 0 else float("nan")


def lift_estratificado(mascara, rotulo, base_extra=None):
    """Lift de `mascara` dentro de cada estrato de nº de socios, no dev.
       `base_extra` restringe o universo de comparacao (para o teste condicional)."""
    linhas = []
    for e in (0, 1, 2):
        base = dev & (estrato == e)
        if base_extra is not None:
            base = base & base_extra
        alvo = base & mascara
        n_u, n_a = int(base.sum()), int(alvo.sum())
        if n_a < 30 or n_u == 0:
            linhas.append((NOME_ESTRATO[e], n_a, float("nan"), float("nan")))
            continue
        p_u = y[base].sum() / n_u
        p_a = y[alvo].sum() / n_a
        lift = p_a / p_u if p_u > 0 else float("nan")
        linhas.append((NOME_ESTRATO[e], n_a, lift, z_prop(p_a, n_a, p_u, n_u)))
    txt = "  ".join(f"{r[0]}: {r[2]:.2f}x (z{r[3]:4.1f}, n{r[1]:,})" if not math.isnan(r[2])
                    else f"{r[0]}: n<30" for r in linhas)
    print(f"  {rotulo:32} {txt}")
    return linhas


print("\n" + "=" * 96)
print("1. LIFT BRUTO DOS CANDIDATOS (dev, estratificado por nº de socios)")
print("=" * 96)
lift_estratificado(porte == 5, "porte = DEMAIS")
lift_estratificado(porte == 3, "porte = EPP")
lift_estratificado(porte == 1, "porte = ME")
lift_estratificado(saiu_simples == 1, "saiu do Simples antes do corte")
lift_estratificado(no_simples == 1, "estava no Simples no corte")
lift_estratificado(cap_pct >= 0.85, "capital >= p85 (referencia)")
lift_estratificado(cap_pct >= 0.95, "capital >= p95 (referencia)")

print("\n" + "=" * 96)
print("2. O TESTE QUE DECIDE: cada um sobrevive depois de condicionar no outro?")
print("=" * 96)
print("\n  2a. PORTE dentro de cada faixa de capital. Se sobrar lift, porte agrega ao que ja temos.")
for lo, hi, rot in [(0.0, 0.50, "capital < p50"), (0.50, 0.85, "capital p50-p85"),
                    (0.85, 1.01, "capital >= p85")]:
    faixa = (cap_pct >= lo) & (cap_pct < hi)
    print(f"\n    dentro de {rot}:")
    lift_estratificado(porte == 5, "  porte = DEMAIS", base_extra=faixa)
    lift_estratificado(saiu_simples == 1, "  saiu do Simples", base_extra=faixa)

print("\n  2b. CAPITAL dentro de cada faixa de porte. Se sobrar lift, capital ainda serve.")
for pv, rot in [(1, "porte = ME"), (3, "porte = EPP"), (5, "porte = DEMAIS")]:
    faixa = porte == pv
    print(f"\n    dentro de {rot}:")
    lift_estratificado(cap_pct >= 0.85, "  capital >= p85", base_extra=faixa)

print("\n  2c. `no Simples` e sinal proprio ou e so 'empresa pequena' com outro nome?")
for lo, hi, rot in [(0.0, 0.50, "capital < p50"), (0.50, 0.85, "capital p50-p85"),
                    (0.85, 1.01, "capital >= p85")]:
    faixa = (cap_pct >= lo) & (cap_pct < hi)
    print(f"\n    dentro de {rot}:")
    lift_estratificado(no_simples == 1, "  estava no Simples", base_extra=faixa)

print("\n  2d. A COMBINACAO vale mais que capital sozinho? (celula vs faixa de capital)")
alto = cap_pct >= 0.85
for m, rot in [(alto, "capital >= p85 (sozinho)"),
               (alto & (porte == 5), "capital >= p85 E porte DEMAIS"),
               (alto & (no_simples == 0), "capital >= p85 E fora do Simples"),
               (alto & (porte == 5) & (no_simples == 0), "p85 E DEMAIS E fora do Simples")]:
    lift_estratificado(m, rot)

print("\n" + "=" * 96)
print("3. CONCORDANCIA: quanto porte e capital discordam de fato (dev elegivel)")
print("=" * 96)
print(f"  {'':16} {'cap<p50':>12} {'p50-p85':>12} {'>=p85':>12}")
for pv, rot in [(1, "ME"), (3, "EPP"), (5, "DEMAIS"), (0, "ausente")]:
    linha = []
    for lo, hi in [(0.0, 0.50), (0.50, 0.85), (0.85, 1.01)]:
        n = int((dev & (porte == pv) & (cap_pct >= lo) & (cap_pct < hi)).sum())
        linha.append(f"{n:,}")
    print(f"  {rot:16} " + "".join(f"{c:>12}" for c in linha))
print("\n  Celulas fora da diagonal sao onde os dois discordam. Se elas fossem vazias, porte")
print("  seria so uma versao grossa de capital e nao teria o que acrescentar.")
