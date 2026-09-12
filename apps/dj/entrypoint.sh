#!/bin/sh
# Tenta atualizar o yt-dlp (sem travar o boot se estiver sem internet)
( timeout 90 pip3 install -q --no-cache-dir --break-system-packages -U yt-dlp bgutil-ytdlp-pot-provider >/dev/null 2>&1 && echo "[dj] yt-dlp $(yt-dlp --version)" ) || echo "[dj] yt-dlp: sem atualizacao ($(yt-dlp --version 2>/dev/null))"
exec "$@"
