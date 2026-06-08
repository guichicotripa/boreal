# Product

## Register

product

## Users

**Primário (externo):** analistas de M&A / Private Equity fazendo deal origination no middle market brasileiro. Contexto: sentados numa mesa, varrendo listas longas de empresas-alvo, decidindo rápido "salvo ou pulo". Hoje gastam 2–6 semanas por setor mapeando alvos à mão (Google, Receita Federal empresa-a-empresa, LinkedIn dos sócios, feiras). Querem encontrar fundadores receptivos antes dos concorrentes. Estado de espírito: focado, sob pressão de tempo, cético a hype.

**Construtores:** Maguto (UI, copy, dados, vídeo) + Guilherme (arquitetura, prompts, scoring, LLM). Fronteira de domínio: Maguto é dono de `page.tsx`/`components/`/`globals.css`/`brand/`; Guilherme é dono de `lib/`/`scripts/`/`api/`; `types.ts` é a fronteira.

**Contexto de competição:** o produto também é submissão de um clube de programação (Loom de 1 min, julgamento que pesa progresso pessoal). O espectador do Loom é audiência secundária — o produto serve o analista, mas a demo precisa contar a jornada.

## Product Purpose

**Boreal** é um research agent AI-native para deal sourcing em PE/M&A no middle market brasileiro, focado em **risco sucessório**: empresas familiares com sócios envelhecendo (70–80+ anos), sem plano de sucessão evidente, sem mudança societária recente — o "Silver Tsunami" do middle market.

Nicho inicial: metalmecânica / indústria média no interior de SP (CNAEs 24, 25, 28). Fluxo: busca em linguagem natural → ~30s depois → lista priorizada de empresas reais (CNPJ, site, sócios) com **score de risco sucessório** + one-liner por IA + dossiê curto + pipeline.

**Sucesso:** o analista encontra empresas com janela sucessória aberta antes dos concorrentes; o gargalo de triagem colapsa de 2 semanas para 30 segundos. Tagline: *"o gargalo do deal sourcing colapsado de 2 semanas pra 30 segundos."*

## Brand Personality

Quente, editorial e sóbria — **"firma de inteligência privada", não startup de IA**. Voz direta, sem hedging, sem "ótima pergunta!", autoridade por contenção. Quatro princípios:

1. **Engineered, not decorated** — cada elemento ganha seu lugar; precisão acima de ornamento.
2. **Warm, not cold** — a paleta carrega calor no subtom; capital sério, com pulso.
3. **Editorial, not corporate** — diário de pesquisa, não deck de vendas.
4. **Private, not loud** — sussurramos onde a categoria grita.

## Anti-references

- **A categoria inteira de deal sourcing** (Grata, Harmonic, Cyndx, Sourcescrub, DealCloud): azul/navy sobre branco, light mode, sans corporativo. Todos parecem iguais. Boreal recusa a fórmula.
- **DNA "tech startup"** (Linear, Vercel, Notion, Framer): Space Grotesk foi explicitamente descartada por carregar essa estética; inadequada para ferramenta institucional de PE/M&A.
- **Sem** azul/navy/qualquer tom frio. **Sem** gradientes, sombras elaboradas, glassmorphism. **Sem** branco puro `#FFFFFF` (destoa da paleta quente). **Sem** fabricar métricas (EBITDA/faturamento falsos) — porte e capital social são os únicos sinais honestos de tamanho.

## Design Principles

1. **Honestidade de dados acima de impressão.** Nunca inventar faturamento/EBITDA. Mostrar só o que a Receita expõe (porte, capital). Cor de risco comunica *apenas* score — nunca decoração.
2. **Superfície de triagem, profundidade sob demanda.** A home varre rápido (salvo/pulo); investigação/memo/similares/trajetória vivem na página da empresa. Cada tela tem uma tarefa primária.
3. **Contenção lida como confiança.** Espaço generoso, tipo forte, um gesto por seção. O analista cético confia na ferramenta que não grita.
4. **Mostrar a prova, não afirmar.** Score com breakdown e fonte; sinais com origem rastreável. Autoridade vem da transparência do método, não de adjetivos.
5. **A ferramenta desaparece na tarefa.** Familiaridade é feature; affordances padrão (não reinventar busca, tabela, pipeline). Delight em momentos, não em páginas.

## Accessibility & Inclusion

WCAG AA é o piso. Corpo de texto ≥4.5:1 (por isso Olive `#565449` é proibido em texto de corpo — só ~2.5:1 sobre o fundo). Dark mode é nativo (não toggle). Focus ring visível em todo elemento interativo (`focus-visible:ring-1 ring-floral/50`). `aria-live` em estados assíncronos/loading; `aria-pressed` em toggles. `scope="col"` em todo `<th>`. Toda animação precisa de alternativa `prefers-reduced-motion`. Cor de risco nunca é o único portador de significado (acompanha rótulo/número).
