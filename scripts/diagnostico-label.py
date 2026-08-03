# -*- coding: utf-8 -*-
"""
O label "aquisicao" e uma DEFINICAO, nao um dado. Este script mede o quanto cada
definicao esta contaminada pela propria mecanica de contagem de socios.

    python scripts/diagnostico-label.py

POR QUE ELE EXISTE: a primeira rodada de calibracao (2026-08-02) devolveu
`quadro_plural = [0, 41, 58]`, ou seja, o numero de socios PF virando 58 dos 100
pontos do score, com idade do dono colapsando pra 4. Isso nao e o score aprendendo
sucessao, e o score aprendendo a definicao do label:

    label basico = "entra socio PJ E sai socio PF"

Uma empresa com 5 socios PF tem cinco chances de alguem sair. Uma com 1 socio precisa
que aquele exato socio saia. A probabilidade do label sobe com o numero de socios por
aritmetica, nao por propensao a vender. Ajustar peso contra esse label ensina o modelo
a contar socios e a chamar isso de risco sucessorio.

O QUE O SCRIPT MEDE, por definicao de label:
  1. prevalencia por faixa de nº de socios PF  (a inclinacao E o artefato)
  2. razao entre a faixa 5+ e a faixa 1        (1,0 = definicao limpa nesse eixo)
  3. quanto sobra de sinal nos eixos que interessam depois de condicionar em nº de socios

Saida: scripts/data/diagnostico-label.tsv + relatorio no terminal.
"""
import gzip, io, os, sys, json
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATRIZ = os.path.join(ROOT, "scripts", "data", "matriz-score.tsv.gz")
SAIDA = os.path.join(ROOT, "scripts", "data", "diagnostico-label.tsv")

print("carregando...")
with gzip.open(MATRIZ, "rt", encoding="utf-8") as f:
    header = f.readline().rstrip("\n").split("\t")
    dados = np.loadtxt(f, delimiter="\t", dtype=object, ndmin=2)
col = {c: i for i, c in enumerate(header)}
g = lambda c, t=np.int32: dados[:, col[c]].astype(t)

vert = dados[:, col["vertical"]].astype(str)
mf, menor = g("mf"), g("menor")
n_pf, n_pj = g("n_pf"), g("n_pj")
anos_ult, anos_emp = g("anos_ult"), g("anos_emp")
cap_pct = g("cap_pct", np.float32)
n_estab = g("n_estab")
pf_novo, pj_novo = g("pf_novo"), g("pj_novo")
N = len(mf)

existe = pf_novo >= 0          # empresa ainda tem quadro no snapshot de desfecho
perfil = (mf >= 7) & (anos_emp >= 25)

# ── definicoes candidatas de "aquisicao" ────────────────────────────────────────
LABELS = {
    "basica":      ("entra PJ e sai PF (a de hoje)",
                    existe & (pj_novo > n_pj) & (pf_novo < n_pf)),
    "sem_holding": ("basica, mas so quem NAO tinha socio PJ no corte",
                    existe & (pj_novo > n_pj) & (pf_novo < n_pf) & (n_pj == 0)),
    "maioria":     ("entra PJ e sai METADE OU MAIS dos socios PF",
                    existe & (pj_novo > n_pj) & (pf_novo <= n_pf / 2)),
    "total":       ("entra PJ e TODOS os socios PF sairam",
                    existe & (pj_novo > n_pj) & (pf_novo == 0) & (n_pf > 0)),
    "pf_zerou":    ("todos os PF sairam, com ou sem PJ entrando",
                    existe & (pf_novo == 0) & (n_pf > 0)),
}

FAIXAS_PF = [("1", n_pf <= 1), ("2", n_pf == 2), ("3-4", (n_pf >= 3) & (n_pf <= 4)),
             ("5+", n_pf >= 5)]

linhas = [("label", "faixa_pf", "n", "n_adq", "prevalencia_pct")]

print("\n" + "=" * 92)
print("1. PREVALENCIA DO LABEL POR NUMERO DE SOCIOS PF")
print("   Se a definicao fosse limpa nesse eixo, a linha seria plana.")
print("=" * 92)
print(f"{'definicao':14} {'n total':>10} {'n adq':>8} {'taxa':>8}   " +
      "".join(f"{f[0]:>10}" for f in FAIXAS_PF) + f"{'5+ / 1':>10}")

resumo = {}
for nome, (desc, lab) in LABELS.items():
    tot, nadq = int(existe.sum()), int(lab.sum())
    prevs = []
    for fnome, fm in FAIXAS_PF:
        sel = existe & fm
        p = lab[sel].sum() / max(sel.sum(), 1) * 100
        prevs.append(p)
        linhas.append((nome, fnome, str(int(sel.sum())), str(int(lab[sel].sum())), f"{p:.4f}"))
    razao = prevs[-1] / prevs[0] if prevs[0] > 0 else float("nan")
    resumo[nome] = {"n_adq": nadq, "razao_5mais_sobre_1": razao, "prev": prevs, "desc": desc}
    print(f"{nome:14} {tot:>10,} {nadq:>8,} {nadq/tot*100:>7.3f}%   " +
          "".join(f"{p:>9.3f}%" for p in prevs) + f"{razao:>9.1f}x")

print("\n  Leitura: a coluna final e o fator de contaminacao. 1,0x seria uma definicao que")
print("  nao premia empresa com muitos socios so pela aritmetica de 'alguem saiu'.")

# ── 2. o sinal que interessa sobrevive condicionando em nº de socios? ───────────
print("\n" + "=" * 92)
print("2. LIFT DA IDADE DO DONO, DENTRO DE CADA FAIXA DE Nº DE SOCIOS")
print("   Condicionar em nº de socios neutraliza o artefato. Se o lift da idade")
print("   sobreviver aqui, a idade e sinal de verdade e nao carona do artefato.")
print("=" * 92)
print(f"{'definicao':14} " + "".join(f"{f[0]:>12}" for f in FAIXAS_PF) + f"{'global':>12}")
for nome, (desc, lab) in LABELS.items():
    saida = []
    for fnome, fm in FAIXAS_PF:
        base = existe & fm
        velho = base & (mf >= 7)
        p_velho = lab[velho].sum() / max(velho.sum(), 1)
        p_base = lab[base].sum() / max(base.sum(), 1)
        saida.append(p_velho / p_base if p_base > 0 else float("nan"))
    velho_g = existe & (mf >= 7)
    lift_g = (lab[velho_g].sum() / max(velho_g.sum(), 1)) / (lab[existe].sum() / max(existe.sum(), 1))
    resumo[nome]["lift_idade_por_faixa"] = saida
    resumo[nome]["lift_idade_global"] = lift_g
    print(f"{nome:14} " + "".join(f"{v:>11.2f}x" for v in saida) + f"{lift_g:>11.2f}x")

# ── 3. mesma coisa pro eixo contraintuitivo ────────────────────────────────────
print("\n" + "=" * 92)
print("3. LIFT DO SUCESSOR APARENTE (socio ate 50 anos), POR FAIXA DE Nº DE SOCIOS")
print("=" * 92)
print(f"{'definicao':14} " + "".join(f"{f[0]:>12}" for f in FAIXAS_PF) + f"{'global':>12}")
for nome, (desc, lab) in LABELS.items():
    saida = []
    for fnome, fm in FAIXAS_PF:
        base = existe & fm
        jovem = base & (menor <= 5) & (menor > 0)
        p_j = lab[jovem].sum() / max(jovem.sum(), 1)
        p_b = lab[base].sum() / max(base.sum(), 1)
        saida.append(p_j / p_b if p_b > 0 else float("nan"))
    jg = existe & (menor <= 5) & (menor > 0)
    lg = (lab[jg].sum() / max(jg.sum(), 1)) / (lab[existe].sum() / max(existe.sum(), 1))
    resumo[nome]["lift_sucessor_por_faixa"] = saida
    resumo[nome]["lift_sucessor_global"] = lg
    print(f"{nome:14} " + "".join(f"{v:>11.2f}x" for v in saida) + f"{lg:>11.2f}x")

# ── 4. tamanho da amostra que sobra no universo do produto ─────────────────────
print("\n" + "=" * 92)
print("4. QUANTAS AQUISICOES SOBRAM NO PERFIL SUCESSORIO (o universo do produto)")
print("=" * 92)
for nome, (desc, lab) in LABELS.items():
    n_perf = int((lab & perfil).sum())
    print(f"  {nome:14} {int(lab.sum()):>6,} no universo   {n_perf:>5,} no perfil   {desc}")

with io.open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
    for l in linhas:
        f.write("\t".join(l) + "\n")

print(f"\nok: {SAIDA}")
print(json.dumps({k: {"n_adq": v["n_adq"], "contaminacao_5mais_sobre_1": round(v["razao_5mais_sobre_1"], 2),
                      "lift_idade_global": round(v["lift_idade_global"], 2),
                      "lift_sucessor_global": round(v["lift_sucessor_global"], 2)}
                  for k, v in resumo.items()}, ensure_ascii=False, indent=2))
