"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Certificado } from "@/lib/proveniencia";

// Certificado de proveniência — o artefato que prova, pro parceiro (Setter), que o lead veio do Boreal.
// Origem + data + score no momento + "novo pro CRM deles" + hash assinado. Imprimível/compartilhável.
export default function ProvenienciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cert, setCert] = useState<Certificado | null>(null);
  const [estado, setEstado] = useState<"carregando" | "nao_selado" | "erro" | "ok">("carregando");

  useEffect(() => {
    fetch(`/api/proveniencia?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) return setEstado("erro");
        if (j.selado === false) return setEstado("nao_selado");
        setCert(j.certificado);
        setEstado("ok");
      })
      .catch(() => setEstado("erro"));
  }, [id]);

  const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <Logo className="h-5 w-auto" />
        <Link href="/pipeline" className="font-data text-[11px] uppercase tracking-wider text-floral hover:opacity-70">
          ← Pipeline
        </Link>
      </div>

      {estado === "carregando" && <p className="font-data text-sm text-bone/50">Carregando…</p>}
      {estado === "erro" && <p className="font-data text-sm text-risk-high">Oportunidade não encontrada.</p>}
      {estado === "nao_selado" && (
        <p className="font-data text-sm text-bone/60">
          Esta oportunidade ainda não foi selada. Emita o selo no momento da entrega ao parceiro.
        </p>
      )}

      {estado === "ok" && cert && (
        <div className="rounded-lg border border-hairline p-6">
          <div className="mb-5 flex items-center justify-between border-b border-hairline pb-4">
            <span className="font-data text-[10px] uppercase tracking-[0.15em] text-bone/50">
              Certificado de proveniência
            </span>
            <span
              className={`font-data text-[10px] uppercase tracking-wider ${cert.valido ? "text-floral" : "text-risk-high"}`}
            >
              {cert.valido ? "✓ assinado" : "✗ inválido"}
            </span>
          </div>

          <h1 className="font-display text-xl text-floral">{cert.razao_social}</h1>
          <p className="mt-0.5 font-data text-xs tracking-wide text-bone/50">
            CNPJ {cert.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-y-4">
            <Campo rotulo="Origem" valor={cert.origem === "boreal" ? "Boreal" : cert.origem} />
            <Campo rotulo="Entrou no pipeline" valor={dataBR(cert.data_origem)} />
            <Campo rotulo="Score no momento" valor={cert.score_origem != null ? `${cert.score_origem}/100` : "—"} />
            <Campo
              rotulo="Situação no CRM do parceiro"
              valor={cert.novo_para_setter == null ? "Não verificado" : cert.novo_para_setter ? "Novo (não estava)" : "Já constava"}
              destaque={cert.novo_para_setter === true}
            />
          </dl>

          <div className="mt-6 border-t border-hairline pt-4">
            <span className="font-data text-[9px] uppercase tracking-wider text-bone/40">Assinatura (HMAC-SHA256)</span>
            <p className="mt-1 break-all font-data text-[10px] leading-relaxed text-bone/55">{cert.hash}</p>
            <p className="mt-2 font-data text-[9px] text-bone/40">
              Selado em {new Date(cert.selado_em).toLocaleString("pt-BR")}. O hash é reproduzível a partir de
              CNPJ + data + score, e só o Boreal consegue emiti-lo, então prova origem e data sem poder ser retroagido.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function Campo({ rotulo, valor, destaque }: { rotulo: string; valor: string | null; destaque?: boolean }) {
  return (
    <div>
      <dt className="font-data text-[9px] uppercase tracking-wider text-bone/40">{rotulo}</dt>
      <dd className={`mt-0.5 font-display text-sm ${destaque ? "text-floral" : "text-bone"}`}>{valor ?? "—"}</dd>
    </div>
  );
}
