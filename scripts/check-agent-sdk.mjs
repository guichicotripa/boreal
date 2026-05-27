/**
 * Smoke test do Claude Agent SDK usando a assinatura do Claude Code (sem API key).
 * Roda SEM --env-file pra garantir que não há ANTHROPIC_API_KEY no ambiente —
 * assim o SDK cai na autenticação do Claude Code (assinatura).
 *
 * Roda: node scripts/check-agent-sdk.mjs
 */
import { query } from "@anthropic-ai/claude-agent-sdk";

console.log("ANTHROPIC_API_KEY no ambiente:", process.env.ANTHROPIC_API_KEY ? "SIM" : "não (bom)");
console.log("Chamando o Claude via Agent SDK…\n");

const t0 = Date.now();
let finalResult = null;

try {
  for await (const message of query({
    prompt: 'Responda APENAS com este JSON, nada mais: {"ok": true, "soma": 4}',
    options: { maxTurns: 1 },
  })) {
    if (message.type === "system") {
      console.log("· system:", message.subtype, "| model:", message.model ?? "?");
    } else if (message.type === "assistant") {
      const text = message.message?.content?.map((c) => c.text ?? "").join("") ?? "";
      console.log("· assistant:", text.slice(0, 200));
    } else if (message.type === "result") {
      finalResult = message;
      console.log("· result.subtype:", message.subtype);
    }
  }
} catch (err) {
  console.error("\nFAIL:", err.message);
  process.exit(1);
}

const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n✓ SDK respondeu em ${dt}s`);
if (finalResult) {
  console.log("  result:", finalResult.result ?? "(sem campo result)");
  if (finalResult.total_cost_usd != null) {
    console.log("  custo reportado: US$", finalResult.total_cost_usd, "(0 = coberto pela assinatura)");
  }
}
