# Boreal — Sistema de Uso: Tipografia, Cor e Opacidade

> Receitas de aplicação. Complementa o `BRAND.md` (que define a paleta e as fontes)
> dizendo **qual combinação fonte + peso + cor + opacidade + tamanho usar para cada papel**.
> Fonte de verdade de estilo: `brand/`. Em conflito, este doc + `BRAND.md` vencem implementações.
>
> Status: **v3 — padrões de contraste, statement de seção e figura editorial** (validada em sandbox 2026-06-05).

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
| **/70** | atenuado — **labels de seção/coluna**, estado secundário, **dados de-emphasizados** (ex: sinais descartados em tabela) |
| **/60** | nuance honesta — texto contextual que é secundário ao claim principal mas ainda carrega informação (passa WCAG AA ≈4,7:1) |
| **/45** | mínimo — placeholder, divisor sutil, desabilitado |

Regra: troque de cor antes de empilhar opacidade. Surfaces/bordas têm alpha próprio (`BRAND.md`) — é fill, não texto.

---

## 4. Escala tipográfica — papel por papel

| Papel | Fonte | Peso | Cor | Tamanho | Notas |
|-------|-------|------|-----|---------|-------|
| **Overline / eyebrow** (topo de página) | mono | 400 | Olive | `text-[10px]`–`[11px]` uppercase, `tracking-[0.2em]` | **um por página**, decoração de abertura |
| **Label de seção** (h2 estrutural) | mono | 400 | **Bone/70** | `text-[11px]` uppercase, `tracking-wider` | rótulo repetível de seção — NÃO Olive |
| **Statement de seção** (h2 editorial) | display | normal | **Floral** | `text-[22px]` | só quando a seção tem argumento central (ex: "O score não é chutado…"); exige eyebrow Bone/70 acima |
| **H1 / headline** | display | normal | Floral | `text-3xl md:text-[44px]` | título de página/hero |
| **Número-herói** | display | normal | Floral¹ | `text-[56px]`–`[88px]` | métrica de destaque |
| **Figura editorial** (número que lidera frase) | display | normal | Floral | `text-[64px]`–`[84px]` | float left, corpo flui ao redor; `display:flow-root` no pai (não `overflow:hidden`) |
| **Síntese / impacto** (curto) | display ou sans | normal/400 | **Floral** | `text-sm`–`base` | one-liner, overview, tese, statement, próximo passo |
| **Lead / subheadline** | sans | 400 | **Bone** | `text-[15px]` | linha de credencial |
| **Body / leitura longa** | sans | 400 | **Bone** | **`text-[15px]`** | parágrafo de argumentação |
| **Ênfase no body** | sans | **600** | = cor do corpo (Bone) | = body | dado/termo importante (`<strong>`) |
| **Metadados / listas densas / célula** | sans/mono | 400 | Bone | `text-xs`–`sm` | scan, não leitura corrida |
| **Caption informativa** (carrega dado) | sans | 400 | **Bone/60** | `text-xs`–`[13px]` | nota que o leitor precisa ler (ex: "67% contando todas…") |
| **Caption de rodapé** (assinatura) | sans | 400 | Olive | `text-xs` | fonte do dado, data de geração — tertiary puro |
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
| **Bone/70** | labels de seção/coluna; dados de-emphasizados (ex: sinais descartados em tabela) |
| **Bone/60** | caption informativa — texto secundário que ainda carrega informação |
| **Olive** `#565449` | overline de topo (um por página), divisores (·, —), caption de rodapé/assinatura |
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
| abrir uma página (eyebrow único) | mono uppercase Olive |
| rotular uma seção (h2 estrutural) | mono uppercase **Bone/70** (não Olive) |
| criar um h2 que é argumento/statement | eyebrow Bone/70 + display Floral `text-[22px]` |
| uma nota que o leitor precisa ler | sans **Bone/60** `text-xs`–`[13px]` |
| uma assinatura de rodapé (data, fonte) | sans Olive `text-xs` |
| de-emphasizar linhas numa tabela | mesmas cores da tabela em **/70** (não trocar pra Olive) |
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

## Decisões registradas (crítica impeccable 2026-06-05)

8. **Eyebrow de topo = único por página, em Olive.** Labels de seção repetíveis (h2) = Bone/70 — não Olive. Confundir os dois cria excesso de Olive e reprova contraste WCAG.
9. **Caption split em dois tiers.** Caption informativa (dado que importa) = Bone/60. Assinatura/rodapé puro = Olive. Olive em caption informativa reprova contraste (2,5:1).
10. **Statement de seção (h2 editorial).** Quando uma seção tem argumento central e não é só rótulo estrutural, usa eyebrow Bone/70 + h2 display Floral 22px. Máximo um por página.
11. **De-ênfase em tabela = mesmas cores em /70.** Linhas descartadas/secundárias mantêm a linguagem de cor da tabela (Floral nome, Bone números, Floral lift) em /70 — não trocam para Olive. Olive é uma cor diferente, não uma versão rebaixada das cores ativas.
12. **Figura editorial (número que lidera frase).** Padrão para número-herói que faz parte da frase: float left com `display:flow-root` no pai (nunca `overflow:hidden` — corta o glifo). Tamanho 64–84px. O texto flui ao redor e lê "97% das vendas… estavam no top 10%".
13. **Stats block pós-figura.** Separado por `border-t border-hairline`: valor em `font-data text-[22px] font-medium text-floral`, caption em `font-data text-[11px] text-bone/70`. Usado pra credenciais (lift, confirmação nacional) que saem da prosa.
14. **Focus ring em links.** Todo `<a>` interativo deve ter `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-floral/50 rounded-sm`.
15. **`scope="col"` em `<th>`.** Todas as células de cabeçalho de tabela precisam de `scope="col"` para leitores de tela.

---

*v3 — 2026-06-05. Atualizado após restyle completo de /validacao + crítica impeccable.*
