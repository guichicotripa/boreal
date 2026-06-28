# -*- coding: utf-8 -*-
# Coleta o SITE OFICIAL das empresas e grava o texto extraido em src/lib/site-cache.json.
# Esse cache alimenta o research hibrido (research.ts aceita `contextoSite`): o perfil_negocio
# sai do site real (mais profundo, ~15x mais barato que web_search) e o research gasta menos buscas.
#
# Descoberta em 2 passos (conserta o elo fraco medido no proto):
#   1. acha dominios candidatos via SERP (DuckDuckGo) + filtro de agregadores
#   2. VERIFICA via RDAP do registro.br: o CNPJ do titular do dominio .br bate com o da empresa?
#      (a ideia CNPJ->dominio do Guilherme: o reverso nao e publico, mas a verificacao e, e e o que
#       transforma "chute do SERP" em "site oficial confirmado")
#
# Browser stealth roda LOCAL (nao no Vercel). Uso:
#   python scripts/scrape-sites.py <setorId-ou-tese> [topN=10]
#   python scripts/scrape-sites.py --ids id1,id2,id3
import sys, os, re, json, time, urllib.request
from urllib.parse import unquote

sys.stdout.reconfigure(encoding="utf-8")
from scrapling.fetchers import StealthyFetcher

DEMO = r"C:\boreal\src\lib\demo-cache.json"
OUT = r"C:\boreal\src\lib\site-cache.json"

AGREGADORES = ("linkedin", "facebook", "instagram", "econodata", "cnpj", "jusbrasil", "bing.",
               "microsoft", "youtube", "google", "twitter", "reclameaqui", "consultasocio",
               "empresascnpj", "guiamais", "apontador", "solut", "cylex", "telelistas", "hotfrog",
               "kekanto", "encontra", "tudoempresas", "informecadastral", "doctoralia", "boaconsulta",
               "saudecidade", "guiadasemana", "mercadolivre", "olx", "wikipedia", "dnb.com", "eguias")

# Provedores genericos (email nao revela site) e dominios de terceiros (contador/advogado que
# registrou o email da empresa) — nao sao o site da empresa.
GENERICOS = ("gmail", "hotmail", "outlook", "yahoo", "bol.", "uol.", "terra.", "live.", "icloud",
             "globo.", "msn.", "ig.com", "r7.", "zipmail", "oi.com")
TERCEIRO = ("contab", "contabil", "assessor", "advoc", "escritorio", "consultor")


def dominio_do_email(email):
    """Email de dominio proprio da Receita = site oficial, custo zero, ~100% preciso. None se
    generico (gmail) ou de terceiro (contador)."""
    if not email or "@" not in email:
        return None
    dom = email.split("@")[-1].strip().lower()
    if "." not in dom or any(g in dom for g in GENERICOS) or any(t in dom for t in TERCEIRO):
        return None
    return dom


def so_digitos(s):
    return re.sub(r"\D", "", s or "")


def cnpj_do_dominio(host):
    """RDAP do registro.br: retorna o CNPJ do titular de um dominio .br (ou None)."""
    if not host.endswith(".br"):
        return None  # so .br esta no registro.br
    try:
        req = urllib.request.Request("https://rdap.registro.br/domain/" + host,
                                     headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        d = json.load(urllib.request.urlopen(req, timeout=15))
        ids = []
        def walk(o):
            if isinstance(o, dict):
                if "identifier" in o:
                    ids.append(o["identifier"])
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(d)
        return ids[0] if ids else None
    except Exception:
        return None


def descobrir_candidatos(busca, n=6):
    """SERP DuckDuckGo via stealth; decoda uddg= e devolve dominios organicos (sem agregador)."""
    url = "https://html.duckduckgo.com/html/?q=" + busca.replace(" ", "+")
    page = StealthyFetcher.fetch(url, headless=True, network_idle=True)
    vistos, doms = set(), []
    for h in page.css("a::attr(href)"):
        m = re.search(r"uddg=([^&]+)", str(h))
        if not m:
            continue
        dest = unquote(m.group(1))
        dom = re.sub(r"^https?://(www\.)?", "", dest).split("/")[0].lower()
        if not dom or dom in vistos or any(a in dom for a in AGREGADORES):
            continue
        vistos.add(dom)
        doms.append(dom)
        if len(doms) >= n:
            break
    return doms


def escolher_site(razao, municipio, cnpj, email):
    """ESCOLHE o site oficial por ordem de confianca. Retorna (url, confianca) com confianca in
    {'email','rdap','heuristica',None}."""
    # 1) email de dominio proprio da Receita = melhor sinal (custo zero, ~100% preciso, ~26% cobertura)
    dom = dominio_do_email(email)
    if dom:
        return "https://" + dom, "email"
    # 2) fallback SERP (fragil): query com nome CURTO (sem LTDA/S.A. que poluem), nao razao social crua
    nome = re.split(r"\s+(s/?a|ltda|eireli|me|epp|sa)\b", razao.lower())[0].strip() or razao
    cands = descobrir_candidatos(f"{nome} {municipio or ''} site oficial")
    if not cands:
        return None, None
    raiz = so_digitos(cnpj)[:8]
    for d in cands:  # RDAP confirma titularidade? (bonus; recall baixo pq dominio costuma ser da holding)
        t = cnpj_do_dominio(d)
        if t and so_digitos(t)[:8] == raiz:
            return "https://" + d, "rdap"
    return "https://" + cands[0], "heuristica"


def ler_site(site):
    """Le home + 1 pagina interna (sobre/produtos). Texto limpo, cortado."""
    textos, paginas = [], [site]
    page = StealthyFetcher.fetch(site, headless=True, network_idle=True, timeout=40000, solve_cloudflare=True)
    textos.append(page.get_all_text(ignore_tags=("script", "style", "noscript")))
    for h in page.css("a::attr(href)"):
        h = str(h).lower()
        if any(k in h for k in ("sobre", "quem-somos", "empresa", "produtos", "about")):
            interna = h if h.startswith("http") else site.rstrip("/") + "/" + h.lstrip("/")
            if interna not in paginas:
                paginas.append(interna)
                try:
                    p2 = StealthyFetcher.fetch(interna, headless=True, timeout=40000)
                    textos.append(p2.get_all_text(ignore_tags=("script", "style", "noscript")))
                except Exception:
                    pass
                break
    txt = re.sub(r"\n{3,}", "\n\n", "\n\n".join(t for t in textos if t)).strip()
    return txt[:16000], paginas


def carregar_alvos(arg):
    demo = json.loads(open(DEMO, encoding="utf-8-sig").read())
    alvos = {}
    if arg.startswith("--ids"):
        ids = set(sys.argv[sys.argv.index("--ids") + 1].split(","))
        for resp in demo.values():
            for e in (resp.get("empresas") or resp.get("resultados") or []):
                if e.get("id") in ids:
                    alvos[e["id"]] = e
    else:
        top = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        for k, resp in demo.items():
            if arg in k:
                for e in (resp.get("empresas") or resp.get("resultados") or [])[:top]:
                    alvos[e["id"]] = e
    return alvos


def main():
    if len(sys.argv) < 2:
        print("uso: python scripts/scrape-sites.py <setor|tese|--ids id1,id2> [topN]"); return
    alvos = carregar_alvos(sys.argv[1])
    cache = json.loads(open(OUT, encoding="utf-8").read()) if os.path.exists(OUT) else {}
    pend = [(i, e) for i, e in alvos.items() if i not in cache]
    print(f"{len(alvos)} alvos; {len(pend)} a coletar, {len(alvos)-len(pend)} ja em cache.\n")
    for n, (eid, e) in enumerate(pend, 1):
        razao = e.get("razao_social", "?")
        print(f"[{n}/{len(pend)}] {razao[:42]} … ", end="", flush=True)
        t0 = time.time()
        try:
            site, conf = escolher_site(razao, e.get("municipio"), e.get("cnpj", ""), e.get("email"))
            if not site:
                print("site nao encontrado"); cache[eid] = {"url": None, "ts": time.time()}
            else:
                texto, pags = ler_site(site)
                ok = len(texto) >= 200
                cache[eid] = {"url": site, "confianca": conf, "alta_confianca": conf in ("email", "rdap"),
                              "texto": texto if ok else None, "chars": len(texto),
                              "paginas": len(pags), "ts": time.time()}
                tag = {"email": "✓email", "rdap": "✓RDAP", "heuristica": "~heur"}.get(conf, conf)
                print(f"{site.replace('https://','')} [{tag}] {len(texto)}ch {(time.time()-t0):.0f}s")
            json.dump(cache, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        except Exception as ex:
            print("ERRO", str(ex)[:90])
    dist = {}
    for v in cache.values():
        dist[v.get("confianca")] = dist.get(v.get("confianca"), 0) + 1
    print(f"\n✓ site-cache: {len(cache)} empresas | confianca: {dist}")


if __name__ == "__main__":
    main()
