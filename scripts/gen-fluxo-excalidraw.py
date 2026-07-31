# -*- coding: utf-8 -*-
"""
Gera brain/fluxo-de-dados.excalidraw a partir da spec de nos e setas abaixo.

    python scripts/gen-fluxo-excalidraw.py     (da raiz do repo)

O DESENHO E GERADO, NAO DESENHADO A MAO. Motivo: diagrama de arquitetura
editado no Excalidraw e depois abandonado vira mentira em duas semanas, e uma
mentira desenhada convence mais que um paragrafo desatualizado. Mudou o pipeline,
edita a spec aqui e roda de novo. O .excalidraw continua editavel no app pra
rabiscar por cima numa call, mas a versao commitada e sempre a gerada.

Layout em 6 colunas com corredores de 120px entre elas; as setas longas usam os
corredores como faixa livre. Se mexer nas coordenadas, rode o check de geometria
(colisao texto/caixa e seta cruzando caixa) antes de commitar.
"""
import json, random, io

random.seed(20260731)
ALPH = "abcdefghijklmnopqrstuvwxyz0123456789"

def rid(): return "".join(random.choice(ALPH) for _ in range(16))
def nz():  return random.randint(1, 2**31 - 1)

FONT = 2          # 1 = mao livre, 2 = normal (Helvetica), 3 = mono
FS   = 14         # corpo
CHAR = 0.585      # largura media de caractere / fontSize
LH   = 1.25

elements = []

def dims(txt, fs):
    lines = txt.split("\n")
    return max(len(l) for l in lines) * fs * CHAR, len(lines) * fs * LH

def base(t, x, y, w, h, stroke="#1e1e1e", bg="transparent", fill="solid",
         sw=2, ss="solid", rough=1, op=100, round_=None, dash=False):
    return {
        "id": rid(), "type": t, "x": x, "y": y, "width": w, "height": h, "angle": 0,
        "strokeColor": stroke, "backgroundColor": bg, "fillStyle": fill,
        "strokeWidth": sw, "strokeStyle": "dashed" if dash else ss,
        "roughness": rough, "opacity": op, "groupIds": [], "frameId": None,
        "roundness": round_, "seed": nz(), "version": 1, "versionNonce": nz(),
        "isDeleted": False, "boundElements": [], "updated": 1, "link": None, "locked": False,
    }

def box(x, y, w, text, bg, stroke, fs=FS, pad=14, minh=0, dash=False):
    tw, th = dims(text, fs)
    h = max(th + pad * 2, minh)
    r = base("rectangle", x, y, w, h, stroke=stroke, bg=bg, round_={"type": 3}, dash=dash)
    t = base("text", x + (w - tw) / 2, y + (h - th) / 2, tw, th, stroke="#1e1e1e")
    t.update({"text": text, "fontSize": fs, "fontFamily": FONT, "textAlign": "center",
              "verticalAlign": "middle", "containerId": r["id"], "originalText": text,
              "lineHeight": LH, "autoResize": True})
    r["boundElements"] = [{"id": t["id"], "type": "text"}]
    elements.append(r); elements.append(t)
    return {"x": x, "y": y, "w": w, "h": h}

def label(x, y, text, fs=20, color="#1e1e1e", align="left"):
    tw, th = dims(text, fs)
    t = base("text", x, y, tw, th, stroke=color)
    t.update({"text": text, "fontSize": fs, "fontFamily": FONT, "textAlign": align,
              "verticalAlign": "top", "containerId": None, "originalText": text,
              "lineHeight": LH, "autoResize": True})
    elements.append(t)

def arrow(pts, text=None, color="#1e1e1e", dash=False, lab_dx=0, lab_dy=0, sw=2, lab_at=None):
    x0, y0 = pts[0]
    rel = [[p[0] - x0, p[1] - y0] for p in pts]
    w = max(p[0] for p in rel) - min(p[0] for p in rel)
    h = max(p[1] for p in rel) - min(p[1] for p in rel)
    a = base("arrow", x0, y0, w, h, stroke=color, sw=sw, dash=dash, round_={"type": 2})
    a.update({"points": rel, "lastCommittedPoint": None, "startBinding": None,
              "endBinding": None, "startArrowhead": None, "endArrowhead": "arrow",
              "elbowed": False})
    elements.append(a)
    if text:
        tw, th = dims(text, 12)
        if lab_at:
            lx, ly = lab_at
        else:
            # rotulo no segmento MAIS LONGO (o trecho livre), nao no do meio
            segs = list(zip(pts, pts[1:]))
            (ax, ay), (bx, by) = max(segs, key=lambda s: abs(s[1][0]-s[0][0]) + abs(s[1][1]-s[0][1]))
            mx, my = (ax + bx) / 2, (ay + by) / 2
            if abs(bx - ax) >= abs(by - ay):       # segmento horizontal
                lx, ly = mx - tw / 2, my - th - 7
            else:                                   # segmento vertical
                lx, ly = mx + 10, my - th / 2
        label(lx + lab_dx, ly + lab_dy, text, fs=12, color="#5c5f66")

# ancoras
def R(n): return (n["x"] + n["w"], n["y"] + n["h"] / 2)
def L(n): return (n["x"], n["y"] + n["h"] / 2)
def T(n): return (n["x"] + n["w"] / 2, n["y"])
def B(n): return (n["x"] + n["w"] / 2, n["y"] + n["h"])

# paleta
FONTE  = ("#fff9db", "#f08c00")   # origem externa
SCRIPT = ("#e5dbff", "#6741d9")   # pipeline / script
BANCO  = ("#ebfbee", "#2f9e44")   # persistencia
IA     = ("#ffe3e3", "#e03131")   # LLM
PROD   = ("#e7f5ff", "#1971c2")   # produto / UI
ART    = ("#fff4e6", "#f08c00")   # artefato versionado
NEUTRO = ("#f1f3f5", "#868e96")   # regra / doc

# ─────────────────────────────────────────────────────────── colunas
C1, C2, C3, C4, C5, C6 = 60, 560, 1060, 1600, 2120, 2660
W1, W2, W3, W4, W5, W6 = 380, 380, 420, 400, 420, 340

label(60, 8, "BOREAL  ·  FLUXO DE DADOS", fs=32)
label(60, 52, "laço de runtime: do CNPJ bruto à lista ordenada na tela", fs=17, color="#5c5f66")

# col 1 — origem e ingestao
label(C1, 96, "INGESTÃO  ·  offline, roda ao abrir praça ou setor", fs=15, color="#6741d9")
bq = box(C1, 130, W1,
 "BIGQUERY\nbasedosdados.br_me_cnpj\nsnapshot 2025-11-09\nempresa · socio · estabelecimento · CNAE", *FONTE)
ing = box(C1, 300, W1,
 "scripts/ingest-setor.mjs\nfiltro CNAE do registry (setores.json)\n+ UF + faixa-min (sócio 61+) + idade-min\nordena por risco sucessório DESC, corta no limit", *SCRIPT)
enr = box(C1, 480, W1,
 "scripts/enrich-empresas.mjs\ncódigo → nome legível (IBGE, CNAE, nat. jurídica)\nlê do payload raw, idempotente", *SCRIPT)

# col 2 — supabase
label(C2, 96, "SUPABASE  ·  Postgres + RLS", fs=15, color="#2f9e44")
tb_emp = box(C2, 130, W2, "empresa (+ raw jsonb)  ·  socio\nupsert por CNPJ, lotes de 100", *BANCO)
tb_run = box(C2, 250, W2, "score_run\nv1 persistido: score, sinais, fontes, modelo", *BANCO)
tb_app = box(C2, 370, W2,
 "oportunidade · interacao · empresa_memo\nempresa_descartada\norg · membro · org_setor / org_uf / org_modulo\nevento", *BANCO)

# col 3 — busca em runtime
label(C3, 96, "BUSCA  ·  runtime, a cada request", fs=15, color="#1971c2")
ui  = box(C3, 130, W3, "UI: busca em linguagem natural\n\"metalúrgicas em SP com dono acima de 70\"", *PROD)
par = box(C3, 240, W3, "parseQueryLLM()\nfallback determinístico: parseQueryHeuristic()\n→ filtros estruturados", *IA)
esc = box(C3, 380, W3, "escopoAtual() + permissoesAtuais()\nsetor / UF liberados da org  ·  RLS no banco", *NEUTRO)
rot = box(C3, 500, W3,
 "/api/search/route.ts\n\n1.  query no Supabase dentro do escopo\n2.  comOverlays():\n      · score SEMPRE recalculado (calcScore)\n      · remove as descartadas\n      · aplica o v1 e reordena\n3.  reasonAboutEmpresas() → insight", *PROD)
cch = box(C3, 760, W3,
 "demo-cache.json  ·  setor-cache.json\nguardam o que é CARO: parse da query e insight\nnunca o score (fórmula velha ordenaria errado)", *ART)

# col 4 — score v0
label(C4, 96, "SCORE v0  ·  determinístico, roda em toda resposta", fs=15, color="#1971c2")
sco = box(C4, 130, W4,
 "src/lib/scoring.ts  ·  calcScore()  →  0 a 100\n\nescala_capital           0-34   percentil DO SETOR\nidade_controle           0-28   só o sócio mais velho\nsucessor_aparente        0-14   PREMIA sócio ≤ 50 anos\nquadro_plural            0-13   nº de sócios PF\nmovimento_societario     0-11   última entrada no quadro", *PROD, fs=13)
gat = box(C4, 340, W4,
 "mesmo módulo, mas NÃO somam ponto:\nperfilSucessorio()  →  porta de entrada, filtra\nalertaDeRegistro()  →  ressalva de RJ / falência", *NEUTRO)
inv = box(C4, 470, W4,
 "a tese que o dado inverteu:\nsucessor no quadro tem lift 2,14x POSITIVO\nausência de sucessor é ANTI-sinal (0,58x)\nantiguidade saiu do score e virou filtro", *NEUTRO, dash=True)

# col 5 — score v1
label(C5, 96, "SCORE v1  ·  investigação com LLM", fs=15, color="#e03131")
web = box(C5, 130, W5,
 "WEB PÚBLICA\nLinkedIn · imprensa · site oficial da empresa\nscrape-sites.py + RDAP registro.br (verifica dono)\n→ site-cache.json", *FONTE)
rta = box(C5, 285, W5,
 "/api/research  (1 empresa, sob demanda)\nAnthropic API + web_search server-side\n~US$ 0,04 a 0,22  ·  30 a 60 s", *IA)
lot = box(C5, 415, W5,
 "scripts/precompute-research.ts  (lote)\nAgent SDK pela assinatura, custo zero\n--min / --max de score_v0, foge do teto\nresumível e idempotente", *IA)
prs = box(C5, 570, W5,
 "parseResearch()  ·  o LLM não inventa número\nLLM  identifica sinais de uma lista fechada + cita URL\nCÓDIGO  aplica os pesos:\n      assessor / banco de investimento   +15\n      menção pública a venda             +12\n      sucessor familiar ativo            +12\n      C-suite externo +6 · Big 4 +5 · sem pegada +3\n      herdeiros fora do negócio           -8", *IA, fs=13)
v1c = box(C5, 790, W5,
 "v1 = clamp(v0 + ajusteDeSinais, 0, 100)\najuste_bruto (sem teto) é recalculado na LEITURA\n→ desempata quem colidiu no 100", *IA)

# col 6 — produto
label(C6, 96, "PRODUTO  ·  o que o originador vê", fs=15, color="#1971c2")
pag = box(C6, 130, W6,
 "/empresa/[id]  ·  /pipeline\n/setores · /heat-map · /mercado\n/validacao · /proveniencia", *PROD)
mem = box(C6, 270, W6,
 "precompute-memos.ts → empresa_memo\nSÓ depois do v1: memo sem v1 é cego\ndossier · similar · trajetória", *PROD)
evt = box(C6, 420, W6,
 "evento  ·  grava-tudo\nbusca, investigação, descarte, clique\nnão é uso, é sinal de treino\nbusca não gravada = rótulo perdido", *NEUTRO)

# ─────────────────────────────────────────────────────────── setas do laço de runtime
YRET = 960          # faixa horizontal livre em todas as colunas: usada pelos retornos

arrow([B(bq), (B(bq)[0], ing["y"])], "SQL filtrada")
arrow([B(ing), (B(ing)[0], enr["y"])])
arrow([R(ing), (C2 - 60, R(ing)[1]), (C2 - 60, L(tb_emp)[1]), L(tb_emp)],
      "upsert", lab_at=(C2 - 52, 252))
arrow([R(enr), (C2 - 25, R(enr)[1]), (C2 - 25, tb_emp["y"] + tb_emp["h"] - 14),
       (C2, tb_emp["y"] + tb_emp["h"] - 14)], "enrich", lab_at=(C2 - 60, 330))
arrow([(tb_emp["x"] + tb_emp["w"], tb_emp["y"] + tb_emp["h"] - 16),
       (C3 - 55, tb_emp["y"] + tb_emp["h"] - 16), (C3 - 55, 560), (C3, 560)],
      "empresas + sócios", lab_at=(C3 - 118, 214))
arrow([B(ui), (B(ui)[0], par["y"])])
arrow([B(par), (B(par)[0], esc["y"])])
arrow([B(esc), (B(esc)[0], rot["y"])])
arrow([B(rot), (B(rot)[0], cch["y"])], "lê / grava")
arrow([R(rot), (C4 - 60, R(rot)[1]), (C4 - 60, sco["y"] + sco["h"] / 2), L(sco)],
      "calcScore()", lab_at=(C4 - 55, 300))
arrow([B(sco), (B(sco)[0], gat["y"])])
arrow([B(gat), (B(gat)[0], inv["y"])], color="#868e96", dash=True)
arrow([(sco["x"] + sco["w"], sco["y"] + 30), (C5 - 60, sco["y"] + 30),
       (C5 - 60, L(rta)[1]), L(rta)], "v0 de partida", lab_at=(C5 - 55, 250))
arrow([(web["x"] + 70, web["y"] + web["h"]), (web["x"] + 70, rta["y"])], "busca")
arrow([B(rta), (B(rta)[0], lot["y"])], color="#868e96", dash=True)
arrow([B(lot), (B(lot)[0], prs["y"])], "mesmo prompt, mesmo parse")
arrow([B(prs), (B(prs)[0], v1c["y"])])
# v1 grava no score_run (volta pro banco pela faixa livre)
arrow([B(v1c), (B(v1c)[0], YRET), (C2 - 90, YRET), (C2 - 90, tb_run["y"] + 22),
       (C2, tb_run["y"] + 22)],
      "grava a investigação: persiste em score_run e sobrevive a mudança de peso",
      lab_at=(1180, YRET - 26))
# score_run volta pro overlay da busca
arrow([(tb_run["x"] + tb_run["w"], tb_run["y"] + 22), (C3 - 25, tb_run["y"] + 22),
       (C3 - 25, 620), (C3, 620)], "overlay do v1", lab_at=(C3 - 22, 470))
arrow([(rot["x"] + rot["w"], rot["y"] + 24), (C4 - 95, rot["y"] + 24),
       (C4 - 95, YRET - 40), (C6 - 55, YRET - 40), (C6 - 55, L(pag)[1]), L(pag)],
      "lista + insight", lab_at=(C6 - 112, 243))
arrow([B(pag), (B(pag)[0], mem["y"])])
arrow([B(mem), (B(mem)[0], evt["y"])])
arrow([B(evt), (B(evt)[0], YRET + 70), (C2 + W2 / 2, YRET + 70), B(tb_app)],
      "grava evento", sw=1, lab_at=(1180, YRET + 44))

# ─────────────────────────────────────────────────────────── laço de calibração
YB = 1230
label(60, YB - 70, "laço de calibração  ·  offline, é quem define os pesos", fs=22, color="#6741d9")
label(60, YB - 40, "roda fora do produto, contra aquisições que já aconteceram. Nenhum peso do score v0 entra sem passar por aqui.", fs=14, color="#5c5f66")

bq2 = box(C1, YB, W1,
 "BIGQUERY  ·  dois snapshots\ncorte 2023-06-10   →   desfecho 2025-11-09\nzero lookahead: o score só enxerga o passado", *FONTE)
gt  = box(C2, YB, W2,
 "GROUND TRUTH de aquisição\nassinatura do quadro societário entre os snapshots:\nentra sócio PJ  +  sai sócio PF\nproxy medível, não confirmação de deal", *SCRIPT)
lif = box(C3, YB - 20, W3,
 "validacao-lift-coorte.mjs\nlift CONDICIONAL dentro da coorte já bem pontuada\n+ z da diferença de proporções\nforte = lift ≥ 1,3  E  z ≥ 2\n→ lift-coorte.json", *SCRIPT)
hol = box(C3, YB + 145, W3,
 "validacao-score-v1.mjs  [--amplo]\nholdout: MOD(ABS(FARM_FINGERPRINT(cnpj)), 2)\nrecall@top10% dentro de cada divisão de CNAE\n41,5% no perfil sucessório  (n=978, z=2,59, 4,1x sorteio)\n→ validacao-v1.json / validacao-v1-amplo.json", *SCRIPT)
pct = box(C3, YB + 315, W3,
 "build-capital-percentis.mjs\nlê a tabela empresa do Supabase, não o BigQuery\np50 / p70 / p85 / p95 por vertical\n→ capital-percentis.json", *SCRIPT)
art = box(C4, YB + 90, W4,
 "ARTEFATOS DE CALIBRAÇÃO\n(versionados no repo, regerados de propósito)\n\ncapital-percentis.json   cortes por setor\nlift-coorte.json         o que merece virar eixo\nvalidacao-v1*.json       a prova\nsetores.json             recall por setor", *ART)
sql = box(C5, YB, W5,
 "scripts/lib/score-sql.mjs\nespelho SQL da fórmula, fonte ÚNICA\nmexeu em scoring.ts  →  mexe aqui  →  revalida", *NEUTRO)
snc = box(C5, YB + 120, W5,
 "validacao-nacional.mjs  +  build-setores.mjs\nrecall por setor  →  setores.json\ncuidado: build-setores carrega o bloco nacional\ndo run anterior sem recalcular", *SCRIPT)
doc = box(C5, YB + 280, W5,
 "brain/modelo-de-score.md\nprotocolo §10: nenhum peso por intuição\ndocumento vivo, revisado quando entra dado novo", *NEUTRO)

arrow([R(bq2), L(gt)])
arrow([R(gt), (C3 - 60, R(gt)[1]), (C3 - 60, L(lif)[1]), L(lif)])
arrow([R(gt), (C3 - 60, R(gt)[1]), (C3 - 60, L(hol)[1]), L(hol)])
arrow([R(lif), (C4 - 55, R(lif)[1]), (C4 - 55, art["y"] + 40), (C4, art["y"] + 40)])
arrow([R(hol), (C4 - 55, R(hol)[1]), (C4 - 55, art["y"] + 75), (C4, art["y"] + 75)])
arrow([R(pct), (C4 - 55, R(pct)[1]), (C4 - 55, art["y"] + 110), (C4, art["y"] + 110)])
arrow([R(art), (C5 - 60, R(art)[1]), (C5 - 60, L(snc)[1]), L(snc)])
arrow([B(sql), (B(sql)[0], snc["y"])], color="#868e96", dash=True)

# a subida: artefatos -> scoring.ts (o unico laco que muda a formula)
YRISE = 1090
arrow([T(art), (T(art)[0], YRISE), (C4 - 25, YRISE),
       (C4 - 25, sco["y"] + sco["h"] - 26), (C4, sco["y"] + sco["h"] - 26)],
      color="#6741d9", sw=3)
label(C4 - 470, YRISE - 30, "define os pesos dos 5 eixos e os cortes de capital  →", fs=15, color="#6741d9")

# rodape
label(60, YB + 520,
 "Duas coisas que este desenho torna óbvias:\n"
 "1.  o score nunca vem de cache. É recalculado em toda resposta, porque cache de score ordena a lista pela fórmula morta.\n"
 "2.  o v1 não substitui o v0, ele soma por cima e persiste no score_run. O ajuste bruto é guardado sem teto para desempatar o 100.",
 fs=15, color="#343a40")

# legenda
LEG = [("fonte externa", FONTE), ("script / pipeline", SCRIPT), ("persistência", BANCO),
       ("LLM", IA), ("produto", PROD), ("artefato versionado", ART), ("regra / doc", NEUTRO)]
lx, ly = C4 + 100, YB + 520
label(lx, ly - 30, "legenda", fs=14, color="#5c5f66")
for i, (nome, (bg, st)) in enumerate(LEG):
    y = ly + i * 30
    r = base("rectangle", lx, y, 26, 18, stroke=st, bg=bg, round_={"type": 3})
    elements.append(r)
    label(lx + 38, y + 1, nome, fs=14, color="#343a40")

doc_json = {
    "type": "excalidraw",
    "version": 2,
    "source": "boreal/scripts",
    "elements": elements,
    "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
    "files": {},
}

import os
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "brain", "fluxo-de-dados.excalidraw")
with io.open(out, "w", encoding="utf-8") as f:
    json.dump(doc_json, f, ensure_ascii=False, indent=2)
print("ok:", out, len(elements), "elementos")
