# Boreal — Projeto e Sistema de Marca

> Documento de referência para implementação do brandkit no código.
> Fonte de verdade para estilo: esta pasta (`brand/`).
> Fonte de verdade para produto: `CLAUDE.md` + `brain/`.

---

## O produto

**Boreal** é um research agent AI-native para deal sourcing em PE/M&A no middle market brasileiro.

**O que faz:** usuário digita uma busca em linguagem natural → recebe em ~30s uma lista priorizada de empresas reais com **score de risco sucessório** + one-liner gerado por IA.

**Nicho:** metalmecânica / indústria média no interior de SP (CNAEs 24, 25, 28). Foco em empresas familiares com sócios envelhecendo (70–80+ anos) e sem plano sucessório evidente — o "Silver Tsunami" do middle market brasileiro.

**Tagline:** *"o gargalo do deal sourcing colapsado de 2 semanas pra 30 segundos."*

---

## Posicionamento visual

Todo o nicho de deal sourcing (Grata, Harmonic, Cyndx, SourceScrub, DealCloud) usa a mesma fórmula: azul/navy sobre branco, light mode, sans-serif corporativo. Todos parecem iguais.

Boreal recusa essa fórmula. A marca é **quente, editorial e sóbria** — "firma de inteligência privada", não startup de IA.

**Quatro princípios:**
1. **Engineered, not decorated** — cada elemento ganha seu lugar. Precisão acima de ornamento.
2. **Warm, not cold** — a paleta carrega calor no subtom. Capital sério, com pulso.
3. **Editorial, not corporate** — diário de pesquisa, não deck de vendas. Tipo forte, espaço generoso, autoridade silenciosa.
4. **Private, not loud** — contenção lida como confiança. Sussurramos onde a categoria grita.

---

## Paleta de cores

Quatro cores-base. Sem azul. Sem navy. O calor vive em cada subtom.

| Nome | Hex | Uso |
|------|-----|-----|
| **Smoky Black** | `#11120D` | Fundo primário — preto quente com subtom esverdeado |
| **Olive Drab** | `#565449` | **Só decoração** — divisores, labels uppercase, indicadores sutis. Nunca texto de corpo (contraste ~2.5:1, insuficiente para leitura). |
| **Bone** | `#D8CFBC` | Texto secundário legível — metadados, CNPJ, sócios, info que precisa ser lida |
| **Floral White** | `#FFFBF4` | Texto primário — headlines, wordmark, CTA. Nunca usar `#FFFFFF` puro — destoa da paleta quente. |

### Cores de risco (score de sucessão)

Cores funcionais dentro da família quente — sinalizam risco sem quebrar a paleta.

| Tier | Hex | Nome |
|------|-----|------|
| Alto risco | `#C8623E` | Terracota / rust — ~4:1 de contraste sobre Smoky |
| Risco moderado | `#C99B3D` | Ocre / âmbar quente |
| Risco baixo | `#D8CFBC` | Bone — neutro, sem alarme |

### Superfícies e bordas (dark mode)

Derivadas de Floral White em alpha — mantêm o calor sem adicionar cor.

| Token | Valor |
|-------|-------|
| `surface` | `rgba(255, 251, 244, 0.03)` |
| `surface-hover` | `rgba(255, 251, 244, 0.05)` |
| `border` (hairline) | `rgba(255, 251, 244, 0.07)` |
| `border-hover` | `rgba(255, 251, 244, 0.12)` |

---

## Tipografia

| Família | Variável CSS | Uso |
|---------|-------------|-----|
| **Newsreader** (serif editorial) | `--font-newsreader` / `font-display` | Headlines, statements, nomes de empresa nos cards, títulos de dossier. Carrega a voz editorial. |
| **IBM Plex Sans** (humanist sans) | `--font-plex-sans` / `font-sans` | Interface — body, botões, labels de UI, inputs, subtítulos. Mesma família do Plex Mono; tom institucional, não "tech startup". |
| **IBM Plex Mono** | `--font-plex-mono` / `font-data` | Dados técnicos — score, CNPJ, faixas etárias, labels mono uppercase. O subtom de terminal. |

**Wordmark:** Archivo Medium, `uppercase`, `letter-spacing: 0.10em` (papel exclusivo — não usar Archivo fora do lockup do logo).

> ⚠️ **Divergência do guidelines de referência (brand/guidelines/)**
>
> O brandkit visual exportado do Canva (`Boreal Brand Guidelines.pdf` e `.html`) especifica
> **Space Grotesk** como fonte sans de interface. O código **não usa Space Grotesk**.
>
> **Decisão registrada em 2026-05-30 (sessão restyle-brandkit):** Space Grotesk foi descartada
> por carregar o DNA visual da era "tech startup" (Linear, Vercel, Notion, Framer) — inadequado
> para um produto que precisa soar como ferramenta institucional de PE/M&A. Substituída por
> **IBM Plex Sans**, que (a) pertence à mesma família do Plex Mono já em uso, formando um
> sistema tipográfico unificado, e (b) foi desenhada pelo IBM para contextos enterprise/institucional.
>
> O guidelines PDF/HTML **não foi atualizado** — é um artefato de Canva, imutável sem reabrir
> o projeto original. Esta nota é o registro canônico da decisão. Em caso de conflito, o código
> e este BRAND.md vencem o PDF.

---

## Logo

Três configurações oficiais. Nunca recompor fora destes arranjos.

| Configuração | Uso |
|---|---|
| **Horizontal** (`lockup-horizontal-*.svg`) | Navbar, header — aplicação primária |
| **Empilhada** (`lockup-stacked-*.svg`) | Contextos quadrados — avatar, app icon |
| **Símbolo isolado** (`mark-*.svg`) | Favicon, ícone standalone |

**Variações de cor disponíveis:**
- `mark-floral.svg` / `lockup-horizontal-floral.svg` — Floral sobre Smoky (dark, **primário**)
- `mark-smoky.svg` / `lockup-horizontal-smoky.svg` — Smoky sobre Floral (light)
- `mark-bone.svg` — Bone sobre Smoky (secundário)
- `mark-black.svg` / `mark-white.svg` — P&B absoluto

**Clear space:** mínimo de 1× a altura da faixa grossa do mark em todos os lados.
**Tamanho mínimo:** símbolo 16px, lockup 96px de largura.

### Geometria do mark

Duas curvas horizontais, pesos distintos, com desfasagem horizontal leve:
- Faixa superior: `stroke-width 7`, posicionada acima
- Faixa inferior: `stroke-width 13`, posicionada abaixo e levemente à direita

```svg
<!-- stroke-thin -->
<path stroke-width="7" d="M8 60 C 30 42 46 42 60 60 C 74 78 90 78 112 60" />
<!-- stroke-thick -->
<path stroke-width="13" d="M8 60 C 30 42 46 42 60 60 C 74 78 90 78 112 60" />
```

---

## Tokens disponíveis no código

Definidos em `src/app/globals.css` (`@theme`). Usáveis diretamente como classes Tailwind:

```
Fundo:        bg-smoky
Texto:        text-floral  text-bone  text-olive
Superfície:   bg-surface   bg-surface-hover
Borda:        border-hairline  border-hairline-hover
Risco:        text-risk-high  text-risk-mid  text-risk-low
Fontes:       font-display (Newsreader)  font-sans (Space Grotesk)  font-data (IBM Plex Mono)
```
Nota: Archivo só é usado no lockup do logo (`<Logo />`), não como utility class de fonte.

**Componentes de marca disponíveis:**
- `@/components/brand/Mark` — SVG do mark, cor via `currentColor`
- `@/components/brand/Logo` — lockup horizontal (mark + wordmark)

---

## Do's & Don'ts

**Fazer:**
- Floral White como texto primário, nunca `#FFFFFF`
- Olive só em elementos decorativos (divisores, labels uppercase tiny)
- Surfaces e bordas em Floral White com alpha baixo
- Cores de risco warm (terracota/ocre), não o vermelho/âmbar frios padrão
- Uma cor por aplicação do logo

**Não fazer:**
- Azul, navy ou qualquer tom frio na paleta
- Olive como texto de corpo — contraste insuficiente
- Rotacionar, esticar ou recolorir o logo fora da paleta oficial
- Gradientes, sombras elaboradas, glassmorphism pesado
- Fundo branco puro (`#FFFFFF`) — destoa da paleta quente
