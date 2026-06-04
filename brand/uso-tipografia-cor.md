# Boreal — Sistema de Uso: Tipografia, Cor e Opacidade

> Receitas de aplicação. Complementa o `BRAND.md` (que define a paleta e as fontes)
> dizendo **qual combinação fonte + peso + cor + opacidade + tamanho usar para cada papel**.
> Fonte de verdade de estilo: `brand/`. Em conflito, este doc + `BRAND.md` vencem implementações.
>
> Status: **v2 — hierarquia de corpo fechada** (validada em sandbox 2026-06-03).

---

## Princípio mestre

Três níveis de hierarquia, cada um com seu recurso:

1. **Entre papéis** (headline vs. body vs. label) → **cor**: Floral > Bone > Olive.
2. **Impacto vs. leitura** (a regra híbrida) → **Floral pra texto curto de impacto**
   (síntese, one-liner, statement, número, tese), **Bone pra leitura longa** (argumentação,
   parágrafos, tabelas, listas). Quanto mais longo o texto, mais pende pra Bone.
   **Exceção — painéis compactos (card/memo):** corpo em **Floral**. O contexto é denso e curto
   por seção; bone "apaga" o painel. A regra híbrida (bone-pra-leitura) vale pra **páginas de prosa**
   (/validação, /mercado, hero), não pra cards.
3. **Dentro de uma frase** (destacar um dado) → **peso 600**, na mesma cor do corpo.

Regras de ouro (validadas em sandbox):
- **Floral e Bone não convivem na mesma frase como ênfase.** Ênfase salta por peso (600), não por cor.
  Convivem **entre blocos** (síntese Floral + corpo Bone) — isso é hierarquia, não poluição.
- **Corpo longo = Bone em 15px.** Quase-branco (Floral) em volume causa *halation* e cansa; o cansaço
  do Bone era tamanho (14px), não cor.
- **Cor funcional (risco) nunca vira decorativa.** Ocre/terracota só comunicam score. Link/ação = Floral.

---

## 1. As três fontes — quando usar cada uma

| Fonte | Classe | Papel | Onde aparece |
|-------|--------|-------|--------------|
| **Newsreader** (serif) | `font-display` | Voz editorial | Headlines (H1/H2), números-herói, nomes de empresa, statements de tese |
| **IBM Plex Sans** | `font-sans` | Interface / leitura | Body, subheadline, botões, inputs, parágrafos, captions |
| **IBM Plex Mono** | `font-data` | Dados / estrutura | Overlines, labels uppercase, scores, CNPJ, faixas, números em tabela |

Regra rápida: **prosa → sans · frase com voz → display · número/rótulo técnico → mono.**

---

## 2. Pesos

| Fonte | Pesos | Notas |
|-------|-------|-------|
| Newsreader | variable (normal + italic) | usa peso natural; ênfase por tamanho |
| IBM Plex Sans | **400 · 500 · 600** | 400 body · 500 medium UI · 600 ênfase. 300 removido |
| IBM Plex Mono | 400 · 500 | mantém |

- **Ênfase = peso 600, mesma cor do corpo.** `<strong>` redefinido global (`globals.css`): `strong { font-weight: 600 }`, sem cor.
- **Sem 700** (o do browser é sintetizado/borrado).

---

## 3. Escala de opacidade (3 steps fixos)

| Step | Uso |
|------|-----|
| **/100** (default) | padrão de qualquer cor |
| **/70** | atenuado — **labels de seção/coluna**, estado secundário |
| **/45** | mínimo — placeholder, divisor sutil, desabilitado |

Regra: troque de cor antes de empilhar opacidade. Surfaces/bordas têm alpha próprio (`BRAND.md`) — é fill, não texto.

---

## 4. Escala tipográfica — papel por papel

| Papel | Fonte | Peso | Cor | Tamanho | Notas |
|-------|-------|------|-----|---------|-------|
| **Overline / eyebrow** (topo de página) | mono | 400 | Olive (marca em Floral) | `text-[10px]`–`[11px]` uppercase, `tracking-[0.2em]` | decoração de abertura |
| **H1 / headline** | display | normal | Floral | `text-3xl md:text-[44px]` | título de página/hero |
| **H2 / título de bloco** | display | normal | Floral | `text-xl`–`2xl` | abre seção |
| **Número-herói** | display | normal | Floral¹ | `text-[56px]`–`[88px]` | métrica de destaque |
| **Síntese / impacto** (curto) | display ou sans | normal/400 | **Floral** | `text-sm`–`base` | one-liner, overview, tese, statement, próximo passo |
| **Lead / subheadline** | sans | 400 | **Bone** | `text-[15px]` | linha de credencial |
| **Body / leitura longa** | sans | 400 | **Bone** | **`text-[15px]`** | parágrafo de argumentação |
| **Ênfase no body** | sans | **600** | = cor do corpo (Bone) | = body | dado/termo importante (`<strong>`) |
| **Metadados / listas densas / célula** | sans/mono | 400 | Bone | `text-xs`–`sm` | scan, não leitura corrida |
| **Caption / nota / ressalva** | sans | 400 | Olive | `text-xs` | rodapé honesto, fonte do dado |
| **Label de seção / coluna** | mono | 500 | **Bone/70** | `text-[10px]`–`[11px]` uppercase | rótulo de conteúdo |
| **Dado / métrica inline** | mono | 400/600 | Bone (600 se destaque) | `text-xs`–`sm` | número no meio de texto |
| **Link / ação** | conforme contexto | 600 | **Floral** | = contexto | única troca de cor no corpo; `hover:underline` + seta `→` que anda 2px |
| **Empty state / placeholder** | sans | 400 | Olive | `text-xs`–`sm` | coluna vazia, input vazio |

¹ Número-herói usa cor de risco **só** quando É um score. Métrica neutra/positiva = Floral.

---

## 5. Cores de texto — quem é o quê

| Cor | Papéis |
|-----|--------|
| **Floral** `#FFFBF4` | headlines, números-herói, nomes, **síntese/impacto curto**, link/ação |
| **Bone** `#D8CFBC` | **corpo de leitura longa (15px)**, subheadline, metadados, tabelas, ênfase (peso 600) |
| **Bone/70** | labels de seção/coluna |
| **Olive** `#565449` | overline de topo, divisores (·, —), caption/ressalva de rodapé |
| **risk-high/mid/low** | **só** score de risco — nunca link, CTA, número positivo, passo, "já adquiridas", coluna de pipeline |

**Exceção registrada (proposital):** a box "Por que agora" (gatilho de timing) na investigação usa fundo
terracota (`bg-risk-high/10`) — funciona como *alerta de oportunidade quente*, não como score. É intencional.

---

## 6. Mapa rápido — "quero…"

| Quero… | Use |
|--------|-----|
| escrever um parágrafo de leitura | Bone, `text-[15px]` |
| uma frase de síntese/impacto | Floral (curto) |
| destacar um dado no meio do texto | peso **600**, mesma cor do corpo |
| marcar um link | **Floral 600** + seta `→`, `hover:underline` |
| rotular uma seção/coluna | mono uppercase **Bone/70** |
| abrir uma página (eyebrow) | mono uppercase Olive |
| uma ressalva honesta (rodapé) | sans Olive `text-xs` |
| mostrar score de risco | risk-high / risk-mid / risk-low — **só aqui** o ocre vive |

---

## Decisões registradas (sandbox 2026-06-03)

1. **Contraste por peso, não por cor** — ênfase = 600 na mesma cor; Floral/Bone não se misturam na mesma frase.
2. **Corpo de leitura = Bone em 15px** — mais confortável que Floral em volume; o cansaço era o tamanho 14px.
3. **Regra híbrida (site todo)** — síntese/impacto curto em Floral, leitura longa em Bone. Convivem entre blocos.
4. **`strong` = 600 global, sem cor.**
5. **Pesos sans 400/500/600; sem 300.**
6. **Opacidade /100 /70 /45.** Labels de seção = Bone/70.
7. **Ocre/terracota só para score.** Link/ação = Floral. Overline/divisor/ressalva = Olive.

---

*v2 — 2026-06-03. Base para o restyle das páginas alteradas (hero, pipeline, validação, consolidadores, mercado).*
