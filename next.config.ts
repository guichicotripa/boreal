import type { NextConfig } from "next";
import { config as dotenvConfig } from "dotenv";
import path from "path";

// Garante que .env.local é carregado mesmo se a variável já existe no sistema.
// Necessário quando ANTHROPIC_API_KEY estava vazia no sistema antes de receber o valor real.
dotenvConfig({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
