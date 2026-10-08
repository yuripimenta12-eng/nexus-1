#!/bin/sh
# Roda todos os testes de ponta a ponta dentro de um container do backend.
# Uso (no servidor):  sh rodar.sh [container]   — padrão: nexus-api-teste
# Os testes criam contas/servidores temporários e apagam tudo no final.
C=${1:-nexus-api-teste}
falhou=0
for t in $(docker exec "$C" sh -c 'ls test/e2e/[0-9]-*.js'); do
  echo "=== $t"
  saida=$(docker exec -w /app "$C" node "$t" 2>/dev/null)
  [ $? -ne 0 ] && falhou=1
  echo "$saida"
  # pausa: o limite de tentativas de login vale por minuto
  sleep 25
done
[ $falhou -eq 0 ] && echo "TODOS OS TESTES PASSARAM" || echo "ALGUM TESTE FALHOU"
exit $falhou
