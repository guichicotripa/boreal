import type { NextConfig } from "next";
import { config as dotenvConfig } from "dotenv";
import path from "path";
import { execSync } from "child_process";

// Garante que .env.local é carregado mesmo se a variável já existe no sistema.
// Necessário quando ANTHROPIC_API_KEY estava vazia no sistema antes de receber o valor real.
dotenvConfig({ path: path.resolve(process.cwd(), ".env.local"), override: true });

/* Commit do build, pro rodapé responder "isso já subiu?" sem depender de mim.
   Na Vercel vem pronto em VERCEL_GIT_COMMIT_SHA; local, pergunta ao git. Se as
   duas falharem (tarball sem .git, por exemplo), fica vazio e o rodapé mostra só
   a versão — melhor que quebrar o build por causa de um rótulo. */
function commitDoBuild(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_COMMIT: commitDoBuild() },
};

export default nextConfig;
