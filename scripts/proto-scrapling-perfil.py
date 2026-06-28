# -*- coding: utf-8 -*-
# PROTOTIPO (medicao, nao producao): mede o ganho de qualidade/custo de gerar o
# `perfil_negocio` da empresa LENDO O SITE DELA com Scrapling, vs. o web_search atual.
#
# Pipeline por empresa:
#   1. descobre o site oficial (SERP do Bing via StealthyFetcher, heuristica de link)
#   2. le home + 1-2 paginas internas (sobre/produtos) com StealthyFetcher (anti-bot)
#   3. manda o texto extraido pro Claude -> perfil_negocio v2 (captura tokens/custo)
#   4. compara com o perfil_v1 do research-cache.json (gerado pelo web_search)
#
# Roda LOCAL. Uso: python scripts/proto-scrapling-perfil.py
import sys, os, re, json, time
from urllib.parse import unquote

sys.stdout.reconfigure(encoding="utf-8")

# --- carrega ANTHROPIC_API_KEY do .env.local (plaintext) -------------------
def load_key():
    p = r"C:\boreal\.env.local"
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY=") and not os.environ.get("ANTHROPIC_API_KEY"):
                os.environ["ANTHROPIC_API_KEY"] = line.split("=", 1)[1].strip().strip('"')
load_key()

from scrapling.fetchers import StealthyFetcher
import anthropic

# Preco Sonnet 4.6 (ordem de grandeza): input $3/Mtok, output $15/Mtok. USD->BRL ~5.5.
PRECO_IN, PRECO_OUT, USDBRL = 3.0 / 1e6, 15.0 / 1e6, 5.5
RESEARCH_CACHE = r"C:\boreal\src\lib\research-cache.json"

# Empresas reais (nome p/ busca + id pra cruzar o perfil_v1 do cache).
EMPRESAS = [
    {"id": "6849dfd9-a629-4b41-b0c5-447dea74f9ec", "busca": "Prensa Jundiai S/A prensas mecanicas"},
    {"id": "d20b27e5-ebb9-4c4c-a111-f4495de4b3a3", "busca": "Alpina Equipamentos Industriais Sao Bernardo do Campo"},
    {"id": "4fba9c6a-cfd1-461f-bb3e-419ccacb428f", "busca": "IMUNE clinica vacinacao Indianopolis Sao Paulo"},
]

AGREGADORES = ("linkedin", "facebook", "instagram", "econodata", "cnpj", "jusbrasil",
               "bing.", "microsoft", "youtube", "google", "twitter", "reclameaqui",
               "consultasocio", "empresascnpj", "guiamais", "apontador", "solut",
               "cylex", "telelistas", "hotfrog", "kekanto", "guiamais", "encontra",
               "tudoempresas", "informecadastral", "doctoralia", "boaconsulta")

def perfil_v1(empresa_id):
    cache = json.load(open(RESEARCH_CACHE, encoding="utf-8"))
    return (cache.get(empresa_id) or {}).get("perfil_negocio")

def descobrir_site(busca):
    """SERP do DuckDuckGo via stealth; decoda o redirect uddg= e pega o 1o
    dominio organico que nao e agregador."""
    url = "https://html.duckduckgo.com/html/?q=" + busca.replace(" ", "+")
    page = StealthyFetcher.fetch(url, headless=True, network_idle=True)
    for h in page.css("a::attr(href)"):
        m = re.search(r"uddg=([^&]+)", str(h))
        if not m:
            continue
        dest = unquote(m.group(1))
        dom = re.sub(r"^https?://(www\.)?", "", dest).split("/")[0].lower()
        if any(a in dom for a in AGREGADORES):
            continue
        return "https://" + dom
    return None

def ler_site(site):
    """Le a home + tenta 1 pagina interna (sobre/empresa/produtos). Texto limpo."""
    textos = []
    paginas = [site]
    page = StealthyFetcher.fetch(site, headless=True, network_idle=True, timeout=40000, solve_cloudflare=True)
    textos.append(page.get_all_text(ignore_tags=("script", "style", "noscript")))
    # acha link interno relevante
    for h in page.css("a::attr(href)"):
        h = str(h).lower()
        if any(k in h for k in ("sobre", "quem-somos", "empresa", "produtos", "about")):
            interna = h if h.startswith("http") else site.rstrip("/") + "/" + h.lstrip("/")
            if interna not in paginas:
                paginas.append(interna)
                try:
                    p2 = StealthyFetcher.fetch(interna, headless=True, timeout=40000)
                    textos.append(p2.get_all_text(ignore_tags=("script", "style", "noscript")))
                except Exception as e:
                    print("   (pagina interna falhou:", str(e)[:60], ")")
                break
    txt = "\n\n".join(t for t in textos if t)
    txt = re.sub(r"\n{3,}", "\n\n", txt).strip()
    return txt[:18000], paginas  # corta pra nao estourar token

SYS = ("Voce e um analista de M&A. A partir do TEXTO DO SITE da empresa, escreva o "
       "perfil do negocio em 2-3 frases: o que faz na pratica (produtos/servicos), "
       "modelo de negocio (como ganha dinheiro) e tipo de cliente (B2B/B2C, setores). "
       "Baseie-se SO no texto; nao invente nem estime faturamento. Responda so o perfil.")

def gerar_perfil_v2(texto_site):
    cli = anthropic.Anthropic()
    msg = cli.messages.create(
        model="claude-sonnet-4-6", max_tokens=400, system=SYS,
        messages=[{"role": "user", "content": "TEXTO DO SITE:\n\n" + texto_site}],
    )
    perfil = "".join(b.text for b in msg.content if b.type == "text").strip()
    u = msg.usage
    custo = u.input_tokens * PRECO_IN + u.output_tokens * PRECO_OUT
    return perfil, u.input_tokens, u.output_tokens, custo

def main():
    print("=" * 70)
    print("PROTOTIPO Scrapling -> perfil_negocio | comparacao vs web_search")
    print("=" * 70)
    for e in EMPRESAS:
        print("\n" + "#" * 70 + "\n# " + e["busca"])
        t0 = time.time()
        try:
            site = descobrir_site(e["busca"])
            print("SITE:", site)
            if not site:
                print("  -> site nao encontrado, pulando."); continue
            texto, paginas = ler_site(site)
            print("PAGINAS lidas:", len(paginas), "| chars extraidos:", len(texto))
            if len(texto) < 200:
                print("  -> conteudo insuficiente, pulando."); continue
            v2, tin, tout, custo = gerar_perfil_v2(texto)
            dt = time.time() - t0
            print("\n--- PERFIL v1 (web_search, do cache) ---")
            print(perfil_v1(e["id"]) or "(vazio no cache)")
            print("\n--- PERFIL v2 (Scrapling le o site) ---")
            print(v2)
            print(f"\nCUSTO v2: {tin} in + {tout} out tok = US$ {custo:.4f} (R$ {custo*USDBRL:.4f}) | {dt:.1f}s")
            print("CUSTO v1 (web_search, medido antes): ~US$ 0.20 (R$ ~1.08) [research completo]")
        except Exception as ex:
            print("  ERRO:", str(ex)[:200])

if __name__ == "__main__":
    main()
