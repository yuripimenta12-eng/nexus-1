FROM node:20-bookworm-slim

# ffmpeg decodifica o áudio; yt-dlp (python) resolve/baixa do YouTube.
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
 && pip3 install --no-cache-dir --break-system-packages -U yt-dlp bgutil-ytdlp-pot-provider \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src

# Atualiza o yt-dlp a cada início do container (o YouTube muda com frequência).
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.mjs"]
