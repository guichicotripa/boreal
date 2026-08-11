# -*- coding: utf-8 -*-
# Gera o PDF do one-pager de follow-up Boreal x Setter (corpo limpo, sem notas internas).
# Saida: C:/segundo-cerebro/raw/onepager-setter-piloto.pdf
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable

OUT = r"C:/segundo-cerebro/raw/onepager-setter-piloto.pdf"
ACCENT = HexColor("#2b2b2b"); GREEN = HexColor("#1f5c3d")
styles = getSampleStyleSheet()
h_title = ParagraphStyle("t", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=15, textColor=GREEN, spaceAfter=1)
h_sub = ParagraphStyle("s", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, textColor=HexColor("#666666"), spaceAfter=5)
h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10.3, textColor=GREEN, spaceBefore=6, spaceAfter=2)
body = ParagraphStyle("b", parent=styles["Normal"], fontName="Helvetica", fontSize=9.3, leading=12, textColor=ACCENT, alignment=TA_JUSTIFY, spaceAfter=3)
bullet = ParagraphStyle("bu", parent=body, leftIndent=10, bulletIndent=2, spaceAfter=2.5, alignment=0)
meta = ParagraphStyle("m", parent=styles["Normal"], fontName="Helvetica", fontSize=9.3, leading=12, textColor=ACCENT, spaceAfter=1)
sig = ParagraphStyle("sig", parent=body, fontName="Helvetica-Bold", spaceBefore=6)

def b(txt): return Paragraph("&bull;&nbsp;&nbsp;" + txt, bullet)

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=17*mm, rightMargin=17*mm, topMargin=13*mm, bottomMargin=13*mm,
                        title="Boreal x Setter - Proposta de Piloto", author="Guilherme Augusto")
S = []
S += [Paragraph("Boreal x Setter", h_title), Paragraph("Proposta de piloto", h_sub)]
S += [HRFlowable(width="100%", thickness=0.8, color=HexColor("#cccccc"), spaceAfter=5)]
S += [Paragraph("<b>Para:</b> Henrique (Setter)", meta),
      Paragraph("<b>De:</b> Guilherme Augusto", meta),
      Paragraph("<b>Assunto:</b> Boreal x Setter, proposta de piloto", meta), Spacer(1, 4)]

S += [Paragraph("Henrique, obrigado pela conversa de hoje. Achei muito valiosa, principalmente a leitura de que a maior alavanca de vocês não é cold outbound, e sim ter inteligência sobre quais setores e empresas estão mais quentes pra priorizar o esforço. Foi exatamente isso que tentamos construir. Segue o resumo e a proposta do piloto, pra você circular internamente.", body)]

S += [Paragraph("O que o Boreal entrega pra Setter", h2)]
S += [Paragraph("Um motor que lê o registro público de empresas (CNPJ) do Brasil inteiro e devolve, pro setor e praça que vocês escolherem:", body)]
S += [b("<b>Descoberta e priorização de alvos:</b> uma lista rankeada de empresas, cada uma com um dossiê pronto (sócios, contato, red flags, ângulo de abordagem). Economiza o tempo de garimpo manual."),
      b("<b>Heat-map de setor e lente de consolidação:</b> quais setores e empresas estão no jogo de M&amp;A agora, e quem são os consolidadores ativos. Útil tanto pra outbound quanto pra priorizar o inbound de vocês."),
      b("<b>Sinal de sucessão onde ele se aplica:</b> em setores familiares clássicos, prevemos com alta precisão quem tende a vender. Em setores de consolidação (como saúde e tech), o valor é mais a descoberta e o heat-map do que a previsão de sucessão, e somos honestos sobre isso.")]
S += [Paragraph("Resolve a brecha que Grata e PitchBook não cobrem: o mid-market brasileiro, onde o dado é fragmentado e essas ferramentas (US$12k a 25k por assento ao ano) nem entram.", body)]

S += [Paragraph("A prova", h2)]
S += [b("Nas vendas por sucessão, o modelo já colocava a empresa no top 10% <b>12 meses antes</b> do negócio, com 97% a 100% de acerto (N=240, Brasil), sem espiar o desfecho."),
      b("Geramos nosso próprio ground truth minerando as transições do CNPJ: 340 deals rotulados contra cerca de 5 que a imprensa rende."),
      b("Cada sinal vem com a fonte. Nada de EBITDA fabricado.")]

S += [Paragraph("A proposta de piloto (1 mês)", h2)]
S += [b("<b>Quem usa:</b> 2 originadores de vocês, em 2 setores distintos (a confirmar)."),
      b("<b>Como:</b> eles usam o Boreal nos deals que já caçam; eu sento com o time uma vez por semana pra ajustar a ferramenta ao fluxo real de vocês. A modelagem é rápida, dá pra iterar dentro do mês."),
      b("<b>Custo:</b> R$2.500 no mês, cobrindo o custo operacional. É desconto de piloto."),
      b("<b>Critério de sucesso (proposta, aberto a ajuste):</b> ao fim do mês, o Boreal entregou a cada originador um punhado de alvos qualificados que eles não tinham no radar, e pelo menos 1 ou 2 viraram abordagem real. Como métrica de apoio, o tempo de achar e qualificar uma empresa cai de horas para minutos. Não amarro em fechar deal, porque deal leva quase um ano.")]

S += [Paragraph("O que preciso de vocês pra começar", h2)]
S += [b("Os 2 originadores e os 2 setores (com a praça), pra eu deixar o universo deles carregado antes do dia 1."),
      b("Uma data de início."),
      b("Cerca de 1h por semana do time, comigo, durante o mês.")]

S += [Paragraph("Se o piloto provar o valor", h2)]
S += [Paragraph("Evoluímos pra um modelo contínuo: retainer por assento mais um success fee modesto (na faixa de 10% do fee de vocês) sobre os deals que saírem das listas finais da plataforma, com o escopo dessas listas bem delimitado pra não te amarrar em nada fora delas. Aí sentamos pra desenhar pra firma inteira.", body)]

S += [Paragraph("Próximo passo", h2)]
S += [Paragraph("Você circula internamente e me retorna até dia 8. Se rolar alguma dúvida da equipe antes disso, é só me chamar que a gente resolve. Assim que vocês confirmarem os 2 setores, eu já começo a ingerir o universo deles pra ferramenta estar pronta no dia 1.", body)]
S += [Paragraph("Qualquer coisa, à disposição.", body)]
S += [Paragraph("Guilherme Augusto", sig)]

doc.build(S)
print("PDF gerado:", OUT)
