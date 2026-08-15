#!/usr/bin/env bash
# Roda `precache-mandatos.ts` em JANELAS, retomando sozinho quando a cota da assinatura reseta.
#
#   bash scripts/precache-loop.sh                 # 100 por mandato, até 24h de tentativa
#   bash scripts/precache-loop.sh 100 12          # limite por mandato, horas máximas
#
# POR QUE UM LAÇO, e não mais processos em paralelo:
# medido em 12/08/2026, o gargalo NÃO é tempo de máquina, é cota da assinatura. Uma janela rendeu
# ~21 empresas; 300 exigem ~14 janelas. Dois processos em paralelo não dobram a vazão, só dividem
# a mesma cota pela metade e complicam o log. Um processo, retomando quando dá, é equivalente em
# vazão e muito mais simples de acompanhar.
#
# SEGURO DE REPETIR: o precache pula empresa que já tem research e memo gravados, então cada volta
# começa de onde a anterior parou. Nada é refeito, nada é perdido.
#
# CÓDIGOS: 0 = acabou tudo · 3 = bateu no limite da assinatura (espera e tenta de novo) · resto =
# erro de verdade, para e mostra.
#
# ATENÇÃO: a cota é COMPARTILHADA com a sessão interativa do Claude Code. Enquanto este laço roda,
# conversar consome a mesma cota que ele.
set -u
cd "$(dirname "$0")/.." || exit 1

LIMITE="${1:-100}"
MAX_HORAS="${2:-24}"
ESPERA_MIN=30                      # entre uma janela esgotada e a próxima tentativa
FIM=$(( $(date +%s) + MAX_HORAS * 3600 ))
VOLTA=0

progresso() {
  node --env-file=.env.local -e "
    const {createClient}=require('@supabase/supabase-js');
    const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
    (async()=>{
      const a=await sb.from('score_run').select('empresa_id',{count:'exact',head:true}).eq('model','agent-sdk/assinatura');
      const b=await sb.from('empresa_memo').select('empresa_id',{count:'exact',head:true}).eq('modelo','agent-sdk/assinatura');
      console.log('   acumulado no banco: ' + a.count + ' research · ' + b.count + ' memos');
    })();" 2>/dev/null
}

while :; do
  VOLTA=$((VOLTA + 1))
  echo ""
  echo "########## volta $VOLTA · $(date '+%H:%M:%S') ##########"
  node --experimental-strip-types --env-file=.env.local scripts/precache-mandatos.ts --limite="$LIMITE"
  CODIGO=$?
  progresso

  if [ "$CODIGO" -eq 0 ]; then
    echo "TERMINOU: todas as empresas do escopo têm research e memo."
    break
  fi
  if [ "$CODIGO" -ne 3 ]; then
    echo "PAROU: código $CODIGO, que não é limite de cota. Erro real, não adianta repetir."
    break
  fi
  if [ "$(date +%s)" -ge "$FIM" ]; then
    echo "PAROU: atingiu o teto de $MAX_HORAS horas. Rodar de novo continua de onde parou."
    break
  fi

  echo "   cota esgotada; nova tentativa em ${ESPERA_MIN} min"
  sleep $((ESPERA_MIN * 60))
done
