@echo off
echo ============================================
echo  Nexus — Subindo para o GitHub
echo ============================================
echo.

cd /d D:\NExuscall\nexus

echo [1/3] Adicionando todos os arquivos...
git add .

echo [2/3] Fazendo commit...
git commit -m "feat: DMs, real-time chat, live video, deploy configs"

echo [3/3] Enviando para o GitHub...
git push origin main

echo.
echo ============================================
echo  Pronto! Agora acesse:
echo  - https://railway.app (deploy do backend)
echo  - https://vercel.com (deploy do frontend)
echo ============================================
pause
