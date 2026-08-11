# -*- coding: utf-8 -*-
"""
Saude da base DENTRO dos 4 setores, calculada da matriz local, sem tocar o BigQuery.

    python scripts/stats-matriz.py

Complementa `scripts/stats-universo.mjs`, que traz os totais do Brasil e os campos de contato e
precisa do BigQuery. Este aqui responde a parte que mais importa pro score: de quantas empresas
o modelo tem os campos de que ele depende. Se `faixa_etaria` do socio vier vazia em metade do
universo, o eixo `idade_controle` esta cego em metade das empresas, e isso nao aparece em nenhuma
metrica de recall.

Fonte: scripts/data/matriz-score.tsv.gz, no snapshot de corte (2023-06-10), matriz e ativa.
Saida: src/lib/stats-matriz.json
"""
import gzip, io, json, os, sys
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATRIZ = os.path.join(ROOT, "scripts", "data", "matriz-score.tsv.gz")
SAIDA = os.path.join(ROOT, "src", "lib", "stats-matriz.json")

with gzip.open(MATRIZ, "rt", encoding="utf-8") as f:
    header = f.readline().rstrip("\n").split("\t")
    raw = np.loadtxt(f, delimiter="\t", dtype=object, ndmin=2)
col = {c: i for i, c in enumerate(header)}
g = lambda c, t=np.int32: raw[:, col[c]].astype(t)

vert = raw[:, col["vertical"]].astype(str)
mf, menor, n_pf, n_pj = g("mf"), g("menor"), g("n_pf"), g("n_pj")
anos_ult, anos_emp = g("anos_ult"), g("anos_emp")
cap_pct = g("cap_pct", np.float32)
porte = g("porte")
pf_novo, pj_novo = g("pf_novo"), g("pj_novo")
N = len(mf)

# O label so consegue disparar com 2+ socios PF: sair de 1 socio PF pra 0 acontece 1 vez em 292 mil.
y = (pf_novo >= 0) & (pj_novo > n_pj) & (pf_novo < n_pf)
perfil = (mf >= 7) & (anos_emp >= 25)

campos = {
    "sem_quadro_societario":  int((n_pf + n_pj == 0).sum()),
    "com_socio_pf":           int((n_pf >= 1).sum()),
    "com_2mais_socios_pf":    int((n_pf >= 2).sum()),
    "com_socio_pj":           int((n_pj >= 1).sum()),
    "com_idade_de_socio":     int((mf >= 1).sum()),
    "com_data_entrada_socio": int((anos_ult >= 0).sum()),
    "com_idade_da_empresa":   int((anos_emp >= 0).sum()),
    "com_porte":              int((porte > 0).sum()),
}

por_setor = {}
for v in sorted(set(vert)):
    m = vert == v
    por_setor[v] = {
        "universo": int(m.sum()),
        "com_idade_de_socio": int((m & (mf >= 1)).sum()),
        "perfil_sucessorio": int((m & perfil).sum()),
        "aquisicoes_detectadas": int(y[m].sum()),
    }

saida = {
    "gerado_em": __import__("time").strftime("%Y-%m-%d"),
    "fonte": "scripts/data/matriz-score.tsv.gz",
    "script": "scripts/stats-matriz.py",
    "snapshot_corte": "2023-06-10",
    "snapshot_desfecho": "2025-11-09",
    "criterio": "matriz, situacao ativa, CNAE dos 4 setores",
    "universo": N,
    "campos": campos,
    "perfil_sucessorio": int(perfil.sum()),
    "perfil_e_elegivel": int((perfil & (n_pf >= 2)).sum()),
    "aquisicoes_detectadas": int(y.sum()),
    "aquisicoes_no_perfil": int((y & perfil).sum()),
    "por_setor": por_setor,
}
io.open(SAIDA, "w", encoding="utf-8", newline="\n").write(json.dumps(saida, ensure_ascii=False, indent=2) + "\n")

n = lambda v: f"{v:,}".replace(",", ".")
pct = lambda a, b: f"{a/b*100:.1f}%"

print(f"UNIVERSO (4 setores, matriz, ativa, snapshot 2023-06-10): {n(N)} empresas\n")
print("PREENCHIMENTO DOS CAMPOS DE QUE O SCORE DEPENDE")
print("-" * 70)
rotulos = {
    "sem_quadro_societario":  "SEM quadro societário nenhum",
    "com_socio_pf":           "tem ao menos 1 sócio pessoa física",
    "com_2mais_socios_pf":    "tem 2+ sócios PF (label consegue enxergar)",
    "com_socio_pj":           "tem ao menos 1 sócio pessoa jurídica",
    "com_idade_de_socio":     "tem faixa etária de algum sócio  ← eixo idade",
    "com_data_entrada_socio": "tem data de entrada de sócio     ← eixo movimento",
    "com_idade_da_empresa":   "tem data de início de atividade",
    "com_porte":              "tem porte da Receita             ← eixo novo",
}
for k, rot in rotulos.items():
    print(f"{rot:48}{n(campos[k]):>13}{pct(campos[k], N):>9}")

print("\nO QUE O ALGORITMO SELECIONA")
print("-" * 70)
print(f"{'perfil sucessório (sócio 61+ e empresa 25+)':48}{n(int(perfil.sum())):>13}{pct(int(perfil.sum()), N):>9}")
print(f"{'  destas, com 2+ sócios PF':48}{n(saida['perfil_e_elegivel']):>13}{pct(saida['perfil_e_elegivel'], int(perfil.sum())):>9}")
print(f"{'aquisições detectadas no período':48}{n(int(y.sum())):>13}{pct(int(y.sum()), N):>9}")
print(f"{'  destas, dentro do perfil sucessório':48}{n(saida['aquisicoes_no_perfil']):>13}{pct(saida['aquisicoes_no_perfil'], int(y.sum())):>9}")

print("\nPOR SETOR")
print("-" * 70)
print(f"{'setor':14}{'universo':>12}{'c/ idade':>12}{'% idade':>9}{'perfil':>10}{'aquisições':>12}")
for v, d in sorted(por_setor.items(), key=lambda x: -x[1]["universo"]):
    print(f"{v:14}{n(d['universo']):>12}{n(d['com_idade_de_socio']):>12}"
          f"{pct(d['com_idade_de_socio'], d['universo']):>9}{n(d['perfil_sucessorio']):>10}"
          f"{n(d['aquisicoes_detectadas']):>12}")

print(f"\nok: {SAIDA}")
