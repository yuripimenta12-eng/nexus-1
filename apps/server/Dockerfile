FROM node:20-slim

# Install build tools and OpenSSL (required for Prisma and native modules)
RUN apt-get update && apt-get install -y python3 make g++ openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies including devDeps (needed for nest build)
RUN npm install

COPY . .

# Generate Prisma client and compile TypeScript
# Verification step: build FAILS if dist/main.js not created
RUN npx prisma generate && npm run build && echo "=== BUILD OK ===" && ls -la /app/dist/ && ls -la /app/dist/main.js

EXPOSE 3001

# Boot resiliente ao cold start do banco (Neon Free suspende o compute após
# inatividade; a 1ª conexão precisa "acordar" o banco e pode estourar o
# timeout de uma tentativa única, derrubando o boot). Tentamos a migração em
# loop (até 20x, 5s de intervalo) — a própria tentativa dispara o wake — e só
# então iniciamos o app. Inline no CMD para não depender de BuildKit/heredoc.
CMD ["sh", "-c", "i=0; until npx prisma migrate deploy; do i=$((i+1)); [ \"$i\" -ge 20 ] && echo 'Banco indisponivel apos 20 tentativas' && exit 1; echo \"Banco frio (tentativa $i), retry em 5s...\"; sleep 5; done; echo 'Migracoes aplicadas, iniciando servidor'; exec node dist/main"]
