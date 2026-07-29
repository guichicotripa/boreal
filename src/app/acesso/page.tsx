"use client";

import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { supabaseNoBrowser } from "@/lib/supabase-browser";

/* Entrada por magic link. Substituiu a senha única compartilhada do piloto.
 *
 * Sem senha de propósito: senha compartilhada tornava os originadores
 * indistinguíveis (quem descartou? quem falou com o fundador?), e senha por
 * pessoa criaria um segredo pra cada um guardar, esquecer e pedir de volta. O
 * link some em 1h e a sessão renova sozinha.
 *
 * Não há auto-cadastro: autenticar não dá acesso. O acesso vem de uma linha em
 * `membro`, criada por script (ato administrativo). Quem cair aqui sem convite
 * autentica e continua sem ver nada — a mensagem abaixo explica isso em vez de
 * deixar a pessoa achando que o sistema quebrou. */
export default function Acesso() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "erro">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setErro(null);
    try {
      /* SEM query string no emailRedirectTo, de propósito. A allowlist de Redirect
         URLs do Supabase casa a URL INTEIRA: com `?next=/` anexado, o destino
         cadastrado deixa de casar e o Supabase troca silenciosamente pelo Site URL.
         Medido em produção — o link do email apontava pra http://localhost:3000, e
         nenhum testador conseguiria entrar. Só o allowlist com wildcard salvaria,
         o que é dependência invisível de painel.

         O preço é perder o "volta pra página que você tentou abrir": quem clica no
         link cai no Radar. Barato, e o Radar é onde se começa mesmo. */
      const { error } = await supabaseNoBrowser().auth.signInWithOtp({
        email: email.trim(),
        options: {
          // shouldCreateUser false: só entra quem já foi cadastrado. Sem isto,
          // qualquer email do mundo cria conta (e trava depois em `membro`).
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setEstado("enviado");
    } catch (err) {
      setErro((err as Error).message);
      setEstado("erro");
    }
  }

  if (estado === "enviado") {
    return (
      <main className="flex min-h-[calc(100dvh-65px)] items-center justify-center px-6">
        <div className="w-full max-w-xs text-center">
          <div className="mb-6 flex justify-center">
            <Logo className="h-6 w-auto text-ink" />
          </div>
          <p className="font-data text-sm text-ink-soft">Link enviado para {email}.</p>
          <p className="mt-2 font-data text-[11px] text-ink-muted">
            Abra o email e clique no link para entrar. Ele vale por 1 hora.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-65px)] items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-xs">
        <div className="mb-6 flex justify-center">
          <Logo className="h-6 w-auto text-ink" />
        </div>
        <label className="mb-1.5 block font-data text-[10px] uppercase tracking-wider text-ink-muted">
          Acesso restrito
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
          placeholder="seu email"
          className="w-full rounded-md border border-hairline bg-transparent px-3 py-2 font-data text-sm text-ink-soft outline-none placeholder:text-ink-muted focus-visible:border-ink/50"
        />
        {estado === "erro" && (
          <p className="mt-2 font-data text-[11px] text-risk-high">
            {erro?.toLowerCase().includes("signups not allowed")
              ? "Este email não tem acesso. Fale com quem administra a conta."
              : "Não consegui enviar o link. Tente de novo."}
          </p>
        )}
        <button
          type="submit"
          disabled={estado === "enviando" || !email.trim()}
          className="mt-3 w-full rounded-md bg-ink px-3 py-2 font-data text-[11px] uppercase tracking-wider text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {estado === "enviando" ? "Enviando…" : "Receber link de acesso"}
        </button>
      </form>
    </main>
  );
}
