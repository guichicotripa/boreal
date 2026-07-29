/* Versão do que está no ar.
 *
 * Existe por um motivo prático: durante o piloto, "isso já subiu?" é pergunta
 * que se responde olhando a tela, não perguntando pra mim. Sem isso, a Vercel
 * ficou com o build de 24/07 por dias sem ninguém notar.
 *
 * VERSAO sai do package.json (fonte única, sem número escrito à mão numa segunda
 * pasta) e COMMIT vem do build. Na Vercel, `VERCEL_GIT_COMMIT_SHA` é injetada
 * automaticamente; local, o next.config resolve pelo git. Sem nenhum dos dois,
 * mostra só a versão em vez de inventar hash.
 */
import { version } from "../../package.json";

export const VERSAO = version;

const sha = process.env.NEXT_PUBLIC_COMMIT ?? "";
export const COMMIT = sha ? sha.slice(0, 7) : null;

/** "v0.2.0 · a31ab4a" ou só "v0.2.0" quando não há commit conhecido. */
export const VERSAO_COMPLETA = COMMIT ? `v${VERSAO} · ${COMMIT}` : `v${VERSAO}`;
