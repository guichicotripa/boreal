# Design

> Resumo do sistema visual do Boreal para a skill impeccable. Fonte de verdade canônica: `brand/BRAND.md` + `brand/uso-tipografia-cor.md` (v3). Em conflito, aqueles vencem. Tokens reais em `src/app/globals.css` (`@theme`).

## Theme

Dark mode nativo, quente, editorial. Fundo preto-quente com subtom esverdeado, texto creme. A cena: um analista de PE lendo um diário de pesquisa privado numa sala com pouca luz, à noite, focado e sem pressa de ser impressionado. Estratégia de cor: **Restrained** — neutros quentes + cor funcional de risco usada com parcimônia. Nunca light mode, nunca azul.

## Color Palette

Quatro cores-base. Sem azul, sem navy. O calor vive no subtom.

| Token | Hex | Papel |
|---|---|---|
| `smoky` (bg) | `#11120D` | Fundo primário — preto quente subtom esverdeado |
| `floral` (ink) | `#FFFBF4` | Texto primário — headlines, wordmark, CTA, síntese/impacto curto, links. **Nunca `#FFFFFF`.** |
| `bone` | `#D8CFBC` | Texto secundário legível — corpo de leitura longa (15px), metadados, CNPJ, sócios, tabelas |
| `olive` | `#565449` | **Só decoração** — divisores (·, —), eyebrow de topo (um por página), assinatura de rodapé. **Nunca corpo** (contraste ~2.5:1, reprova AA). |

**Cores de risco (funcionais — só score de sucessão, nunca decoração/link/CTA):**

| Tier | Hex | Token |
|---|---|---|
| Alto | `#C8623E` | `risk-high` — terracota/rust, ~4:1 sobre smoky |
| Moderado | `#C99B3D` | `risk-mid` — ocre/âmbar quente |
| Baixo | `#D8CFBC` | `risk-low` — bone, neutro sem alarme |

**Superfícies e bordas** (Floral em alpha — calor sem cor):

| Token | Valor |
|---|---|
| `surface` | `rgba(255,251,244,0.03)` |
| `surface-hover` | `rgba(255,251,244,0.05)` |
| `border-hairline` | `rgba(255,251,244,0.07)` |
| `border-hairline-hover` | `rgba(255,251,244,0.12)` |

**Escala de opacidade de texto (3 steps):** `/100` default · `/70` labels de seção/coluna, dados de-emphasizados · `/60` caption informativa (carrega dado, passa AA ~4.7:1) · `/45` placeholder, divisor sutil, desabilitado. Regra: trocar de cor antes de empilhar opacidade.

## Typography

Três famílias. **Prosa → sans · frase com voz → display · número/rótulo técnico → mono.**

| Família | Classe | Papel |
|---|---|---|
| **Newsreader** (serif editorial) | `font-display` | Headlines (H1/H2), números-herói, nomes de empresa, statements de tese |
| **IBM Plex Sans** (humanist) | `font-sans` | Body, subheadline, botões, inputs, captions |
| **IBM Plex Mono** | `font-data` | Overlines, labels uppercase, score, CNPJ, faixas, números em tabela |
| Archivo Medium | (só logo) | Wordmark uppercase `letter-spacing 0.10em` — exclusivo do lockup, não usar como utility |

> Space Grotesk foi descartada (2026-05-30): carrega DNA "tech startup". `font-sans` = IBM Plex Sans. O guidelines PDF do Canva está desatualizado; este doc + BRAND.md vencem.

**Pesos:** Newsreader variable (ênfase por tamanho); Plex Sans 400/500/600 (sem 300, sem 700); Plex Mono 400/500. **Ênfase = peso 600 na mesma cor do corpo** (`strong { font-weight: 600 }` global, sem cor). Floral e Bone nunca se misturam como ênfase na mesma frase — saltam entre blocos (síntese Floral + corpo Bone), não dentro da frase.

**Escala de papéis (principais):**

| Papel | Fonte | Cor | Tamanho |
|---|---|---|---|
| Eyebrow de topo (1 por página) | mono uppercase | Olive | 10–11px `tracking-[0.2em]` |
| Label de seção/coluna | mono uppercase | Bone/70 | 10–11px |
| Statement de seção (h2 editorial) | display | Floral | 22px (exige eyebrow Bone/70 acima) |
| H1 / headline | display | Floral | `text-3xl md:text-[44px]` |
| Número-herói | display | Floral¹ | 56–88px |
| Síntese / impacto (curto) | display/sans | Floral | sm–base |
| Body / leitura longa | sans 400 | Bone | **15px** |
| Caption informativa | sans 400 | Bone/60 | xs–13px |
| Caption de rodapé (assinatura) | sans 400 | Olive | xs |
| Link / ação | 600 | Floral | + seta `→` que anda 2px, `hover:underline` |

¹ Número-herói usa cor de risco **só** quando É um score. Métrica neutra/positiva = Floral.

## Layout & Spacing

- Escala rem fixa (não fluida) — UI de produto, DPI consistente. Ratio de escala apertado (~1.125–1.2).
- Responsivo é estrutural (colapsar sidebar, tabela responsiva), não tipografia fluida.
- Espaço generoso, ritmo variado. Linha de prosa 65–75ch; tabelas densas podem correr mais.
- Hairlines (`border-hairline`) separam seções — não cards aninhados, não sombras.

## Components

Todo componente interativo tem: default, hover, focus, active, disabled, loading, error. Padrões já estabelecidos:
- **Score badge** — número + tier (única casa da cor de risco).
- **EmpresaCard** — nome (display), stats strip (porte/capital/fundada/sócio+), one-liner itálico, score badge.
- **SalvarButton** — 3 estados + rollback otimista.
- **Estados de erro** — variante monocromática (bone + botão `border-hairline`), **sem cor de alarme**. Loading = skeleton em `bone/70`, não spinner.
- **Empty states** que ensinam a interface, não "nada aqui".

## Motion

150–250ms na maioria das transições. Motion comunica estado (mudança, feedback, loading, reveal), nunca decoração. Sem sequências orquestradas de page-load. Ease-out exponencial, sem bounce. Toda animação com alternativa `prefers-reduced-motion`.

## Absolute bans (específicos do Boreal, além dos bans gerais)

- **Azul / navy / qualquer tom frio.** A categoria inteira faz isso.
- **Cor de risco como decoração** — ocre/terracota só comunicam score. Link/ação/passo/positivo = Floral.
- **`border-left`/side-stripe como acento** — usar borda completa, fundo tinto, ou número/ícone líder.
- **Olive em texto de corpo** (reprova AA). **Branco puro `#FFFFFF`.**
- **Gradientes, sombras elaboradas, glassmorphism, gradient-text.**
- **Eyebrow uppercase em toda seção** — eyebrow de topo é um por página, em Olive; labels de seção repetíveis = Bone/70.
