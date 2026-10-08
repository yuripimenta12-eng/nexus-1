#!/bin/sh
# Atualiza o backend do Nexus no VPS a partir do GitHub, com segurança:
#   1. baixa o código novo (repositório público, sem senha)
#   2. monta a imagem nova sem tocar na que está no ar
#   3. sobe uma cópia de teste (porta 3005) e roda TODOS os testes de ponta a ponta
#   4. só troca a versão no ar se os testes passarem
#   5. se a versão nova não ficar saudável, volta sozinha para a anterior
#
# Uso:  sh /opt/api/atualizar.sh            (só atualiza se houver mudança no backend)
#       sh /opt/api/atualizar.sh --forcar   (atualiza mesmo com gente em chamada)
#
# Arquivos no servidor: /opt/api/run.sh (sobe o container), /root/nexus-api.teste.env
# (variáveis da cópia de teste, PORT=3005), /opt/backups/em-chamada.sh.
set -u
REPO=https://github.com/yuripimenta12-eng/nexus-1.git
DIR=/opt/api
CODIGO=$DIR/repo
LOG=$DIR/atualizar.log
FORCAR=${1:-}

exec 9>"$DIR/atualizar.lock"
flock -n 9 || { echo "Já tem uma atualização rodando."; exit 0; }

log() { echo "$(date '+%d/%m %H:%M:%S') $*" | tee -a "$LOG"; }

# 1. Código
if [ ! -d "$CODIGO/.git" ]; then
  git clone --quiet --depth 50 "$REPO" "$CODIGO" || { log "ERRO: não consegui baixar o repositório"; exit 1; }
fi
git -C "$CODIGO" fetch --quiet --depth 50 origin main || { log "ERRO: não consegui buscar atualizações"; exit 1; }
NOVO=$(git -C "$CODIGO" rev-parse origin/main:apps/server)
ATUAL=$(cat "$DIR/versao-no-ar.txt" 2>/dev/null || echo nenhuma)
if [ "$NOVO" = "$ATUAL" ]; then
  echo "Backend já está na versão mais nova."
  exit 0
fi
COMMIT=$(git -C "$CODIGO" rev-parse --short origin/main)
log "Versão nova do backend encontrada (commit $COMMIT)."

# Não derruba chamadas em andamento (a não ser com --forcar)
if [ "$FORCAR" != "--forcar" ]; then
  EM_CHAMADA=$(sh /opt/backups/em-chamada.sh 2>/dev/null || echo 0)
  if [ "${EM_CHAMADA:-0}" -gt 0 ]; then
    log "Adiado: $EM_CHAMADA pessoa(s) em chamada. Tenta de novo depois."
    exit 0
  fi
fi

# 2. Montagem (processo de baixa prioridade, para não pesar no que está no ar)
rm -rf "$DIR/src" && mkdir -p "$DIR/src"
git -C "$CODIGO" archive origin/main:apps/server | tar -x -C "$DIR/src"
log "Montando a imagem nova..."
if ! DOCKER_BUILDKIT=0 nice -n 19 docker build --cpu-period=100000 --cpu-quota=60000 \
     -t nexus-api:novo "$DIR/src" > "$DIR/build.log" 2>&1; then
  log "ERRO na montagem — nada foi trocado. Detalhes em $DIR/build.log"
  exit 1
fi

# 3. Cópia de teste + testes de ponta a ponta
docker rm -f nexus-api-teste >/dev/null 2>&1
docker run -d --name nexus-api-teste --network host --env-file /root/nexus-api.teste.env nexus-api:novo >/dev/null
i=0
until curl -fs -o /dev/null http://127.0.0.1:3005/api/health; do
  i=$((i+1))
  if [ $i -ge 60 ]; then
    log "ERRO: a cópia de teste não subiu — nada foi trocado."
    docker logs --tail 30 nexus-api-teste >> "$LOG" 2>&1
    docker rm -f nexus-api-teste >/dev/null 2>&1
    exit 1
  fi
  sleep 2
done
log "Rodando os testes..."
if ! sh "$DIR/src/test/e2e/rodar.sh" nexus-api-teste > "$DIR/testes.log" 2>&1; then
  log "TESTES FALHARAM — nada foi trocado. Detalhes em $DIR/testes.log"
  docker rm -f nexus-api-teste >/dev/null 2>&1
  exit 1
fi
docker rm -f nexus-api-teste >/dev/null 2>&1
log "Testes ok: $(grep -c '✔' "$DIR/testes.log") verificações passaram."

# 4. Troca (guarda a anterior para voltar se precisar)
docker tag nexus-api:latest nexus-api:anterior 2>/dev/null
if sh "$DIR/run.sh" nexus-api:novo >> "$LOG" 2>&1 && curl -fs -o /dev/null https://api.nexuslink.art/api/health; then
  docker tag nexus-api:novo nexus-api:latest
  echo "$NOVO" > "$DIR/versao-no-ar.txt"
  log "Atualizado com sucesso para o commit $COMMIT."
else
  # 5. Volta para a anterior
  log "ERRO: a versão nova não ficou saudável — voltando para a anterior."
  sh "$DIR/run.sh" nexus-api:anterior >> "$LOG" 2>&1
  exit 1
fi
docker image prune -f >/dev/null 2>&1
exit 0
