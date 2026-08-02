# -*- coding: utf-8 -*-
"""
Rasteriza brain/fluxo-de-dados.excalidraw em docs/fluxo-de-dados.png (o que o README embute).

    python scripts/render-fluxo-png.py            (da raiz do repo)
    python scripts/render-fluxo-png.py --scale=3

Existe porque o GitHub nao renderiza .excalidraw. O par de scripts mantem uma so
fonte de verdade: gen-fluxo-excalidraw.py escreve o diagrama, este aqui exporta a
imagem. Mudou o pipeline -> roda os dois -> o README nao envelhece em silencio.

Nao e um renderizador de Excalidraw de uso geral: cobre exatamente os tres tipos
que o gerador emite (rectangle, arrow, text) e ignora o estilo "rough".
"""
import json, io, math, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "brain", "fluxo-de-dados.excalidraw")
OUT = os.path.join(ROOT, "docs", "fluxo-de-dados.png")

S = 2.0
for a in sys.argv[1:]:
    if a.startswith("--scale="):
        S = float(a.split("=", 1)[1])

els = json.load(io.open(SRC, encoding="utf-8"))["elements"]

# moldura a partir do conteudo, com margem, em vez de tamanho fixo
# Numa seta, x/y e o PRIMEIRO ponto e width/height e so o span dos pontos, entao
# x + width nao e a borda direita (setas que vao pra esquerda estouram a moldura em
# centenas de px). Caixa e texto usam x+width; seta usa os pontos de verdade.
xs, ys = [], []
for e in els:
    if e["type"] == "arrow":
        xs += [e["x"] + p[0] for p in e["points"]]
        ys += [e["y"] + p[1] for p in e["points"]]
    else:
        xs += [e["x"], e["x"] + e["width"]]
        ys += [e["y"], e["y"] + e["height"]]
M = 40
X0, Y0 = min(xs) - M, min(ys) - M
W = int((max(xs) - X0 + M) * S)
H = int((max(ys) - Y0 + M) * S)

img = Image.new("RGB", (W, H), "white")
dr = ImageDraw.Draw(img)

def P(x, y):
    return ((x - X0) * S, (y - Y0) * S)

_fonts = {}
def fnt(sz, bold=False):
    k = (round(sz * S), bold)
    if k not in _fonts:
        path = r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"
        _fonts[k] = ImageFont.truetype(path, max(1, k[0]))
    return _fonts[k]

def dashed(p0, p1, col, w, dash=9, gap=6):
    x0, y0 = p0; x1, y1 = p1
    L = math.hypot(x1 - x0, y1 - y0)
    if L == 0:
        return
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    t = 0.0
    while t < L:
        e = min(t + dash * S, L)
        dr.line([x0 + ux * t, y0 + uy * t, x0 + ux * e, y0 + uy * e], fill=col, width=w)
        t = e + gap * S

for e in els:
    if e["type"] != "rectangle":
        continue
    a = P(e["x"], e["y"]); b = P(e["x"] + e["width"], e["y"] + e["height"])
    box = [a[0], a[1], b[0], b[1]]
    w = max(1, int(e["strokeWidth"] * S))
    if e["strokeStyle"] == "dashed":
        dr.rounded_rectangle(box, radius=8 * S, fill=e["backgroundColor"])
        corners = [(box[0], box[1]), (box[2], box[1]), (box[2], box[3]), (box[0], box[3])]
        for i in range(4):
            dashed(corners[i], corners[(i + 1) % 4], e["strokeColor"], w)
    else:
        dr.rounded_rectangle(box, radius=8 * S, fill=e["backgroundColor"],
                             outline=e["strokeColor"], width=w)

for e in els:
    if e["type"] != "arrow":
        continue
    pts = [P(e["x"] + p[0], e["y"] + p[1]) for p in e["points"]]
    w = max(1, int(e["strokeWidth"] * S))
    for p, q in zip(pts, pts[1:]):
        if e["strokeStyle"] == "dashed":
            dashed(p, q, e["strokeColor"], w)
        else:
            dr.line([p, q], fill=e["strokeColor"], width=w)
    (ax, ay), (bx, by) = pts[-2], pts[-1]
    ang = math.atan2(by - ay, bx - ax)
    for s in (0.42, -0.42):
        dr.line([bx, by, bx - 12 * S * math.cos(ang + s), by - 12 * S * math.sin(ang + s)],
                fill=e["strokeColor"], width=w)

for e in els:
    if e["type"] != "text":
        continue
    fs = e["fontSize"]; lh = fs * 1.25
    f = fnt(fs, fs >= 20)
    for i, line in enumerate(e["text"].split("\n")):
        x, y = P(e["x"], e["y"] + lh * i)
        if e["textAlign"] == "center":
            x = P(e["x"] + e["width"] / 2, 0)[0] - dr.textlength(line, font=f) / 2
        dr.text((x, y), line, fill=e["strokeColor"], font=f)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT, optimize=True)
print(f"ok: {OUT}  {W}x{H}  (scale {S})")
