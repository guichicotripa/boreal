# -*- coding: utf-8 -*-
"""Converte um markdown do brain/ em PDF apresentável, para mandar a cliente.

    python scripts/md-para-pdf.py brain/setter/proposta-setter-b-c.md saida.pdf
    python scripts/md-para-pdf.py brain/setter/lista-ja-compradas-setter.md saida.pdf --autor "Guilherme Augusto"

POR QUE UM CONVERSOR, E NÃO UM SCRIPT POR DOCUMENTO: já existe `gen-onepager-pdf.py`, que tem o
texto do one-pager escrito dentro do próprio script. Isso significa que editar o documento é
editar código, e que o markdown do brain/ e o PDF entregue vivem separados e divergem. Aqui a
fonte é o markdown, sempre, e o PDF é derivado. Documento novo não pede script novo.

POR QUE REPORTLAB E NÃO PANDOC OU WEASYPRINT: é o que está instalado nesta máquina, e o único que
não exige adicionar dependência nova (regra do CLAUDE.md). O preço é escrever o parser de
markdown, que é o corpo deste arquivo.

O QUE O PARSER COBRE, porque é o que os documentos do brain/ usam: título de 1 a 3 níveis,
parágrafo, negrito, itálico, código inline, lista com marcador, lista numerada, tabela com
alinhamento, citação, regra horizontal. Não cobre bloco de código, imagem e link, que nenhum
documento de cliente usa até agora. Se algum passar a usar, o parser avisa em vez de engolir.
"""
import html
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

VERDE = colors.HexColor("#1f5c3d")
TINTA = colors.HexColor("#2b2b2b")
APAGADO = colors.HexColor("#6b6b6b")
FIO = colors.HexColor("#d4d4d4")
FUNDO_CAB = colors.HexColor("#f2f4f2")
DESTAQUE = colors.HexColor("#f7f5ef")

_s = getSampleStyleSheet()
E = {
    "h1": ParagraphStyle("h1", parent=_s["Heading1"], fontName="Helvetica-Bold", fontSize=16,
                         textColor=VERDE, spaceBefore=14, spaceAfter=5, leading=19),
    "h2": ParagraphStyle("h2", parent=_s["Heading2"], fontName="Helvetica-Bold", fontSize=11.5,
                         textColor=VERDE, spaceBefore=11, spaceAfter=4, leading=14),
    "h3": ParagraphStyle("h3", parent=_s["Heading3"], fontName="Helvetica-Bold", fontSize=9.8,
                         textColor=TINTA, spaceBefore=8, spaceAfter=3, leading=12),
    "corpo": ParagraphStyle("corpo", parent=_s["Normal"], fontName="Helvetica", fontSize=9.2,
                            leading=12.6, textColor=TINTA, alignment=TA_JUSTIFY, spaceAfter=5),
    "item": ParagraphStyle("item", parent=_s["Normal"], fontName="Helvetica", fontSize=9.2,
                           leading=12.6, textColor=TINTA, leftIndent=11, bulletIndent=2,
                           spaceAfter=2.5),
    "citacao": ParagraphStyle("citacao", parent=_s["Normal"], fontName="Helvetica-Oblique",
                              fontSize=9, leading=12.4, textColor=TINTA, leftIndent=9,
                              rightIndent=6, spaceAfter=4),
    "celula": ParagraphStyle("celula", parent=_s["Normal"], fontName="Helvetica", fontSize=8,
                             leading=10.2, textColor=TINTA),
    "cabecalho": ParagraphStyle("cabecalho", parent=_s["Normal"], fontName="Helvetica-Bold",
                                fontSize=8, leading=10.2, textColor=VERDE),
    "rodape": ParagraphStyle("rodape", parent=_s["Normal"], fontName="Helvetica", fontSize=7.4,
                             textColor=APAGADO),
}


def inline(txt: str) -> str:
    """Marcação inline do markdown para as tags que o reportlab entende.

    A ordem importa: escapar o HTML PRIMEIRO, senão um `<` do texto vira tag e o parágrafo
    inteiro estoura. Depois `**` antes de `*`, senão o negrito vira itálico duplo.
    """
    t = html.escape(txt)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![\w*])\*([^*]+?)\*(?![\w*])", r"<i>\1</i>", t)
    t = re.sub(r"`(.+?)`", r'<font face="Courier" size="8">\1</font>', t)
    # Link markdown: fica só o texto. Documento de cliente é lido no papel ou no leitor, e URL
    # crua no meio da frase atrapalha mais do que ajuda.
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    return t


def alinhamento_da_tabela(separador: str) -> list:
    """Lê `|---|---:|:--:|` e devolve o alinhamento de cada coluna."""
    saida = []
    for c in [x.strip() for x in separador.strip().strip("|").split("|")]:
        if c.endswith(":") and c.startswith(":"):
            saida.append("CENTER")
        elif c.endswith(":"):
            saida.append("RIGHT")
        else:
            saida.append("LEFT")
    return saida


def celulas(linha: str) -> list:
    return [c.strip() for c in linha.strip().strip("|").split("|")]


def monta_tabela(linhas: list, largura: float) -> Table:
    cab = celulas(linhas[0])
    alinha = alinhamento_da_tabela(linhas[1])
    corpo = [celulas(l) for l in linhas[2:]]

    dados = [[Paragraph(inline(c), E["cabecalho"]) for c in cab]]
    for linha in corpo:
        # Linha com menos células que o cabeçalho acontece em markdown escrito à mão; completar
        # com vazio é melhor que estourar, porque o conteúdo continua legível.
        linha = (linha + [""] * len(cab))[: len(cab)]
        dados.append([Paragraph(inline(c), E["celula"]) for c in linha])

    n = len(cab)
    # Primeira coluna mais larga: nos documentos do brain ela quase sempre carrega o nome ou a
    # pergunta, e as outras carregam número ou frase curta.
    if n == 1:
        larguras = [largura]
    else:
        primeira = largura * (0.40 if n <= 3 else 0.30)
        larguras = [primeira] + [(largura - primeira) / (n - 1)] * (n - 1)

    t = Table(dados, colWidths=larguras, repeatRows=1, hAlign="LEFT")
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), FUNDO_CAB),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, FIO),
        ("GRID", (0, 0), (-1, -1), 0.25, FIO),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    for i, a in enumerate(alinha[:n]):
        estilo.append(("ALIGN", (i, 0), (i, -1), a))
    t.setStyle(TableStyle(estilo))
    return t


def converte(md: str, largura: float) -> list:
    flow = []
    linhas = md.split("\n")
    i = 0
    primeiro_h1 = True

    while i < len(linhas):
        l = linhas[i]
        nu = l.strip()

        if not nu:
            i += 1
            continue

        # Regra horizontal
        if re.fullmatch(r"(-{3,}|\*{3,}|_{3,})", nu):
            flow.append(Spacer(1, 3))
            flow.append(HRFlowable(width="100%", thickness=0.6, color=FIO, spaceAfter=6))
            i += 1
            continue

        # Título
        m = re.match(r"^(#{1,6})\s+(.*)$", nu)
        if m:
            nivel = len(m.group(1))
            texto = m.group(2).strip()
            if nivel == 1:
                # `# Opção B` e `# Opção C` abrem seção nova. Quebrar página em todo h1 menos o
                # primeiro deixa a proposta com cada opção começando no alto da folha, que é como
                # ela vai ser lida: uma opção de cada vez.
                if not primeiro_h1:
                    flow.append(PageBreak())
                primeiro_h1 = False
                flow.append(Paragraph(inline(texto), E["h1"]))
                flow.append(HRFlowable(width="100%", thickness=0.8, color=VERDE, spaceAfter=7))
            else:
                flow.append(Paragraph(inline(texto), E["h2" if nivel == 2 else "h3"]))
            i += 1
            continue

        # Tabela
        if nu.startswith("|") and i + 1 < len(linhas) and re.match(r"^\s*\|[\s:|-]+\|\s*$", linhas[i + 1]):
            bloco = []
            while i < len(linhas) and linhas[i].strip().startswith("|"):
                bloco.append(linhas[i])
                i += 1
            t = monta_tabela(bloco, largura)
            flow.append(Spacer(1, 2))
            # Tabela curta não se parte: uma linha sozinha no alto da página seguinte, com o
            # cabeçalho repetido em cima dela, lê como se fosse outra tabela. Acima de 8 linhas
            # a quebra é inevitável e KeepTogether só empurraria a tabela inteira para a frente.
            flow.append(KeepTogether(t) if len(bloco) - 2 <= 8 else t)
            flow.append(Spacer(1, 7))
            continue

        # Citação: vira caixa com fundo, que é como ela lê melhor no papel
        if nu.startswith(">"):
            bloco = []
            while i < len(linhas) and linhas[i].strip().startswith(">"):
                corpo = linhas[i].strip().lstrip(">").strip()
                bloco.append(corpo)
                i += 1
            paras = [Paragraph(inline(p), E["citacao"]) for p in bloco if p]
            if paras:
                cx = Table([[paras]], colWidths=[largura], hAlign="LEFT")
                cx.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), DESTAQUE),
                    ("LINEBEFORE", (0, 0), (0, -1), 2, VERDE),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]))
                flow.append(cx)
                flow.append(Spacer(1, 7))
            continue

        # Lista
        m = re.match(r"^\s*([-*+]|\d+[.)])\s+(.*)$", l)
        if m:
            itens = []
            while i < len(linhas):
                mm_ = re.match(r"^\s*([-*+]|\d+[.)])\s+(.*)$", linhas[i])
                if not mm_:
                    break
                marca = mm_.group(1)
                simbolo = "&bull;" if marca in "-*+" else html.escape(marca)
                itens.append(Paragraph(f"{simbolo}&nbsp;&nbsp;{inline(mm_.group(2))}", E["item"]))
                i += 1
            # KeepTogether em lista curta evita item órfão no pé da página.
            flow.append(KeepTogether(itens) if len(itens) <= 6 else itens)
            flow.append(Spacer(1, 5))
            continue

        # Parágrafo
        flow.append(Paragraph(inline(nu), E["corpo"]))
        i += 1

    # Achata as listas longas, que entraram como lista de flowables
    plano = []
    for f in flow:
        plano.extend(f) if isinstance(f, list) else plano.append(f)
    return plano


def rodape(canvas, doc, titulo: str):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.4)
    canvas.setFillColor(APAGADO)
    canvas.drawString(17 * mm, 10 * mm, titulo)
    canvas.drawRightString(A4[0] - 17 * mm, 10 * mm, f"{doc.page}")
    canvas.setStrokeColor(FIO)
    canvas.setLineWidth(0.4)
    canvas.line(17 * mm, 13 * mm, A4[0] - 17 * mm, 13 * mm)
    canvas.restoreState()


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    entrada, saida = Path(sys.argv[1]), Path(sys.argv[2])
    autor = "Guilherme Augusto"
    if "--autor" in sys.argv:
        autor = sys.argv[sys.argv.index("--autor") + 1]

    md = entrada.read_text(encoding="utf-8")

    # Avisa em vez de engolir: bloco de código e imagem não são suportados e passariam como texto
    # solto, o que num documento de cliente é pior que um erro.
    if "```" in md:
        print("AVISO: o markdown tem bloco de código, que este conversor não formata.")
    if re.search(r"!\[[^\]]*\]\(", md):
        print("AVISO: o markdown tem imagem, que este conversor ignora.")

    # A primeira linha `# Titulo` vira o título do PDF e some do corpo, para não repetir.
    linhas = md.split("\n")
    titulo = entrada.stem
    if linhas and linhas[0].startswith("# "):
        titulo = linhas[0][2:].strip()
        linhas = linhas[1:]
    # O bloco de citação de abertura costuma ser nota interna ("Gerado em X por script Y").
    # Num documento de cliente ele não entra.
    while linhas and (not linhas[0].strip() or linhas[0].strip().startswith(">")):
        linhas.pop(0)
    md = "\n".join(linhas)

    doc = SimpleDocTemplate(
        str(saida), pagesize=A4,
        leftMargin=17 * mm, rightMargin=17 * mm, topMargin=15 * mm, bottomMargin=17 * mm,
        title=titulo, author=autor, subject=titulo,
    )
    largura = A4[0] - 34 * mm

    flow = [Paragraph(html.escape(titulo), E["h1"]),
            HRFlowable(width="100%", thickness=1, color=VERDE, spaceAfter=9)]
    flow += converte(md, largura)

    doc.build(flow, onFirstPage=lambda c, d: rodape(c, d, titulo),
              onLaterPages=lambda c, d: rodape(c, d, titulo))
    print(f"{saida}  ({saida.stat().st_size // 1024} KB, {doc.page} páginas)")


if __name__ == "__main__":
    main()
