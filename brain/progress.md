# Progress — Log de Construção

> Append-only. Uma entrada por sessão de trabalho. Formato: `## [YYYY-MM-DD] quem | título`.
> Este log alimenta o roteiro do Loom no fim — registra a **jornada**, não só o resultado.
> Anota o que foi feito, o que travou, o que aprendeu. Screenshots/links bem-vindos.

---

## [2026-05-27] Guilherme | Setup inicial — scaffold + brain

Primeira sessão pós-reunião 1 do Clube. Montado o esqueleto do repo:

- `create-next-app` → Next.js 16.2.6 + React 19 + TypeScript + Tailwind v4 + App Router + `src/`
- `shadcn/ui` inicializado (preset base-nova) — `button.tsx` + `lib/utils.ts` criados
- Brain do projeto criado: `CLAUDE.md` + `brain/{progress,decisions,pending}.md`
- Nome do projeto fechado: **Boreal**

**Aprendizado:** create-next-app instalou Next **16**, não 15. Next 16 tem breaking changes —
gerou um `AGENTS.md` avisando pra consultar `node_modules/next/dist/docs/` antes de codar
framework. Mantido esse aviso.

**Pendente desta sessão:** Supabase (.env + client), primeira pull de CNPJs via BrasilAPI,
criar repo GitHub privado + push + adicionar Maguto.

---

*(append novas entradas abaixo desta linha)*
