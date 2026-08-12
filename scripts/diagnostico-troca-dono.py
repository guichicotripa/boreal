# -*- coding: utf-8 -*-
"""
O score funciona na METADE do universo que o label antigo nunca conseguiu medir?

    python scripts/diagnostico-troca-dono.py

CONTEXTO. O label "entra socio PJ e sai socio PF" nao dispara em empresa de socio unico: sair de 1
socio PF pra 0 acontece 1 vez em 292 mil. Sao 292 mil empresas que estavam no denominador de todo
numero publicado e que NUNCA podiam contar como acerto perdido. O produto nunca soube se funciona
nelas, e elas sao o caso central da tese sucessoria.

O LABEL NOVO. Trocar a IDENTIDADE do dono, e nao a contagem. Separado em dois pelo sobrenome,
porque senao o modelo aprende mortalidade em vez de propensao a vender:
  · transacao = trocou de dono e NENHUM sobrenome em comum
  · familiar  = trocou de dono e ALGUM sobrenome em comum (heranca, doacao, reorganizacao)

O QUE ESTE SCRIPT RESPONDE:
  1. tamanho de cada label, e quanto ele amplia o que da pra medir
  2. lift dos eixos do score contra `transacao`, na populacao de dono unico
  3. RECALL@TOP10% DO SCORE ATUAL contra `transacao` — o numero que nunca existiu
  4. o mesmo, separado por setor
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

vert_txt = raw[:, col["vertical"]].astype(str)
verticais = sorted(set(vert_txt))
vert = np.searchsorted(np.array(verticais), vert_txt)
mf, menor, n_pf, n_pj = g("mf"), g("menor"), g("n_pf"), g("n_pj")
anos_ult, anos_emp = g("anos_ult"), g("anos_emp")
cap_pct = g("cap_pct", np.float32)
porte = g("porte")
pf_novo, pj_novo = g("pf_novo"), g("pj_novo")
pf_saiu, pf_entrou, nome_comum = g("pf_saiu"), g("pf_entrou"), g("nome_em_comum")
desempate = g("desempate", np.float32)
metade = g("metade")
N = len(mf)

presente = pf_novo >= 0
dono_unico = presente & (n_pf == 1) & (pf_novo == 1)
trocou = dono_unico & (pf_saiu >= 1) & (pf_entrou >= 1)
transacao = trocou & (nome_comum == 0)
familiar = trocou & (nome_comum == 1)
aquisicao = presente & (pj_novo > n_pj) & (pf_novo < n_pf)   # o label antigo

print("\n" + "=" * 92)
print("1. TAMANHO DOS LABELS")
print("=" * 92)
for rot, m, base in [
    ("aquisicao (label de hoje)", aquisicao, presente),
    ("dono unico, os dois snapshots", dono_unico, presente),
    ("  trocou de dono", trocou, dono_unico),
    ("    transacao (sobrenome diferente)", transacao, trocou),
    ("    familiar (sobrenome em comum)", familiar, trocou),
]:
    n = int(m.sum())
    print(f"  {rot:38} {n:>9,}  ({n/max(int(base.sum()),1)*100:6.2f}% da linha de referencia)")
print(f"\n  Eventos mensuraveis: {int(aquisicao.sum()):,} antes · "
      f"{int(aquisicao.sum() + transacao.sum()):,} somando transacao "
      f"({(aquisicao.sum()+transacao.sum())/max(int(aquisicao.sum()),1):.1f}x)")


def z_prop(p_a, n_a, p_u, n_u):
    if n_a == 0 or n_u == 0:
        return float("nan")
    se = math.sqrt(p_u * (1 - p_u) / n_u + p_a * (1 - p_a) / max(n_a, 1))
    return abs(p_a - p_u) / se if se > 0 else float("nan")


def lift(mask_feature, y, universo, rotulo):
    base = universo
    alvo = base & mask_feature
    n_u, n_a = int(base.sum()), int(alvo.sum())
    if n_a < 100:
        print(f"  {rotulo:34} n<100"); return
    p_u, p_a = y[base].sum() / n_u, y[alvo].sum() / n_a
    l = p_a / p_u if p_u > 0 else float("nan")
    print(f"  {rotulo:34} {l:5.2f}x  (z {z_prop(p_a, n_a, p_u, n_u):5.1f}, n {n_a:,})")


print("\n" + "=" * 92)
print("2. LIFT DOS EIXOS CONTRA `transacao`, na populacao de dono unico")
print("   Esta e a populacao que o label antigo NAO conseguia classificar.")
print("=" * 92)
print("\n  contra TRANSACAO (venda pra terceiro):")
for m, r in [((mf >= 7), "dono 61+"), ((mf >= 8), "dono 71+"), ((mf == 6), "dono 51-60"),
             ((cap_pct >= 0.85), "capital >= p85"), ((cap_pct >= 0.95), "capital >= p95"),
             ((anos_emp >= 25), "empresa 25+ anos"), ((porte == 3), "porte EPP"),
             ((porte == 5), "porte DEMAIS"), ((anos_ult >= 0) & (anos_ult < 5), "quadro mexeu <5 anos")]:
    lift(m, transacao.astype(np.int8), dono_unico, r)
print("\n  contra FAMILIAR (heranca), pra comparar:")
for m, r in [((mf >= 7), "dono 61+"), ((mf >= 8), "dono 71+"), ((cap_pct >= 0.85), "capital >= p85")]:
    lift(m, familiar.astype(np.int8), dono_unico, r)

# ── 3. recall do score ATUAL contra o label novo ────────────────────────────────
PESOS = {"escala_capital": [0, 11, 19, 27, 34], "idade_controle": [0, 10, 19, 25, 28],
         "sucessor_aparente": [0, 14], "quadro_plural": [0, 7, 13], "movimento_societario": [0, 6, 11]}
i_cap = np.select([cap_pct >= .95, cap_pct >= .85, cap_pct >= .70, cap_pct >= .50], [4, 3, 2, 1], 0)
i_ida = np.select([mf >= 9, mf == 8, mf == 7, mf == 6], [4, 3, 2, 1], 0)
i_suc = ((menor <= 5) & (menor > 0)).astype(np.int8)
i_qua = np.select([n_pf >= 5, n_pf >= 2], [2, 1], 0)
i_mov = np.select([(anos_ult >= 0) & (anos_ult < 5), (anos_ult >= 5) & (anos_ult < 10)], [2, 1], 0)
score = (np.array(PESOS["escala_capital"])[i_cap] + np.array(PESOS["idade_controle"])[i_ida]
         + np.array(PESOS["sucessor_aparente"])[i_suc] + np.array(PESOS["quadro_plural"])[i_qua]
         + np.array(PESOS["movimento_societario"])[i_mov]).astype(np.float32)


def recall_top10(y, sel, por_vertical=True):
    ac, tot = 0.0, 0
    grupos = range(len(verticais)) if por_vertical else [None]
    for v in grupos:
        m = sel & (vert == v) if v is not None else sel
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


print("\n" + "=" * 92)
print("3. RECALL@TOP10% DO SCORE ATUAL, contra cada label")
print("   Sorteio daria 10%. Este numero nunca existiu pra empresa de dono unico.")
print("=" * 92)
print(f"  {'label':40} {'universo':>22} {'recall':>9} {'n':>7} {'vs sorteio':>12}")
for rot, y, uni in [
    ("aquisicao (o numero publicado hoje)", aquisicao, presente & (n_pf >= 2)),
    ("transacao (venda de dono unico)", transacao, dono_unico),
    ("familiar (heranca de dono unico)", familiar, dono_unico),
    ("transacao, so empresa 25+ anos", transacao, dono_unico & (anos_emp >= 25)),
]:
    r, n = recall_top10(y.astype(np.int8), uni)
    print(f"  {rot:40} {int(uni.sum()):>22,} {r:>8.1f}% {n:>7,} {r/10:>11.1f}x")

print("\n" + "=" * 92)
print("4. RECALL CONTRA `transacao` POR SETOR")
print("=" * 92)
print(f"  {'setor':14} {'dono unico':>12} {'transacoes':>12} {'recall':>9} {'vs sorteio':>12}")
for v, nome in enumerate(verticais):
    sel = dono_unico & (vert == v)
    r, n = recall_top10(transacao.astype(np.int8), sel, por_vertical=False)
    print(f"  {nome:14} {int(sel.sum()):>12,} {n:>12,} {r:>8.1f}% {r/10:>11.1f}x")

# ── 5. o label novo e VENDA DE NEGOCIO ou ROTATIVIDADE CADASTRAL? ───────────────
# A taxa de 3,9% em 2,4 anos e alta demais pra "vender uma empresa", e o capital aparece como
# ANTI-sinal (0,80x em p85). As duas coisas juntas levantam a hipotese de que boa parte das
# "transacoes" e troca de titularidade de microempresa, e nao M&A. Se for isso, calibrar contra
# este label ensina o modelo a achar empresa pequena que muda de dono, que e o oposto do produto.
# Teste: a taxa de transacao sobe ou cai com o tamanho? M&A sobe. Rotatividade cai.
print("\n" + "=" * 92)
print("5. A TRANSACAO SOBE OU CAI COM O TAMANHO DA EMPRESA?")
print("   M&A sobe com tamanho. Rotatividade cadastral de microempresa cai.")
print("=" * 92)
print(f"  {'faixa de capital':22} {'n':>10} {'transacoes':>12} {'taxa':>9} {'lift':>8}")
base_t = transacao[dono_unico].sum() / max(int(dono_unico.sum()), 1)
for lo, hi, rot in [(0.0, .50, "< p50"), (.50, .70, "p50-p70"), (.70, .85, "p70-p85"),
                    (.85, .95, "p85-p95"), (.95, 1.01, ">= p95")]:
    m = dono_unico & (cap_pct >= lo) & (cap_pct < hi)
    n = int(m.sum())
    if n == 0:
        continue
    t = int(transacao[m].sum())
    print(f"  {rot:22} {n:>10,} {t:>12,} {t/n*100:>8.2f}% {(t/n)/base_t:>7.2f}x")

print(f"\n  {'porte':22} {'n':>10} {'transacoes':>12} {'taxa':>9} {'lift':>8}")
for pv, rot in [(1, "ME"), (3, "EPP"), (5, "DEMAIS")]:
    m = dono_unico & (porte == pv)
    n = int(m.sum())
    if n == 0:
        continue
    t = int(transacao[m].sum())
    print(f"  {rot:22} {n:>10,} {t:>12,} {t/n*100:>8.2f}% {(t/n)/base_t:>7.2f}x")

# Cruzamento com o label ANTIGO: onde os dois conseguem opinar, eles concordam?
# Empresa com 2+ socios PF onde TODOS os PF trocaram e entrou PJ deveria ser aquisicao pelos dois.
amb = presente & (n_pf >= 2) & (pf_saiu >= 1) & (pf_entrou >= 1)
print(f"\n  empresas 2+ socios com entrada E saida de PF: {int(amb.sum()):,}")
print(f"    destas, marcadas como aquisicao pelo label antigo: {int((amb & aquisicao).sum()):,} "
      f"({(amb & aquisicao).sum()/max(int(amb.sum()),1)*100:.1f}%)")
