"use client";

import { useState } from "react";
import { Logo } from "@/components/brand/Logo";

// Gate de acesso do piloto. Página minimalista: uma senha compartilhada libera o app por 30 dias.
export default function Acesso() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(false);
    try {
      const r = await fetch("/api/acesso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (r.ok) {
        const params = new URLSearchParams(window.location.search);
        window.location.assign(params.get("next") || "/");
        return;
      }
      setErro(true);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100dvh-65px)] items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-xs">
        <div className="mb-6 flex justify-center">
          <Logo className="h-6 w-auto text-floral" />
        </div>
        <label className="mb-1.5 block font-data text-[10px] uppercase tracking-wider text-bone/55">
          Acesso restrito
        </label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoFocus
          placeholder="senha"
          className="w-full rounded-md border border-hairline bg-transparent px-3 py-2 font-data text-sm text-bone outline-none placeholder:text-bone/30 focus-visible:border-floral/50"
        />
        {erro && <p className="mt-2 font-data text-[11px] text-risk-high">Senha incorreta.</p>}
        <button
          type="submit"
          disabled={carregando || !senha}
          className="mt-3 w-full rounded-md bg-floral px-3 py-2 font-data text-[11px] uppercase tracking-wider text-smoky transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
