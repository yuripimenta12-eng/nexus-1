@echo off
chcp 65001 >nul
title Nexus - Iniciar (sem Docker)

echo =========================================
echo   NEXUS - Iniciando com banco na nuvem
echo =========================================
echo.

cd /d "D:\NExuscall\nexus"

echo [0/5] Atualizando .env com credenciais cloud...
if exist "env-novo.txt" (
    copy /Y "env-novo.txt" ".env" >nul
    echo   .env atualizado com Neon + Upstash!
) else (
    echo   .env ja existe, pulando...
)

echo.
echo [1/5] Copiando .env para o backend e frontend...
copy /Y ".env" "apps\server\.env" >nul
copy /Y ".env" "apps\web\.env.local" >nul
echo   OK!

echo.
echo [2/5] Gerando Prisma Client...
cd apps\server
call npx prisma generate
if %errorLevel% neq 0 (
    echo   ERRO no prisma generate!
    pause
    exit /b 1
)
echo   OK!

echo.
echo [3/5] Sincronizando schema com o banco (db push)...
call npx prisma db push
if %errorLevel% neq 0 (
    echo   AVISO: db push falhou, continuando...
)
echo   OK!

echo.
echo [4/5] Rodando seed (dados iniciais)...
call npx ts-node prisma/seed.ts
echo   OK (ignorar erros de seed se ja existirem dados)

cd /d "D:\NExuscall\nexus"

echo.
echo [5/5] Verificando LiveKit Server (voz)...
set LIVEKIT_DIR=%USERPROFILE%\nexus-livekit
set LIVEKIT_EXE=%LIVEKIT_DIR%\livekit-server.exe

if not exist "%LIVEKIT_EXE%" (
    echo   Baixando LiveKit Server para voz local...
    if not exist "%LIVEKIT_DIR%" mkdir "%LIVEKIT_DIR%"
    powershell -NoProfile -Command ^
      "try { Invoke-WebRequest -Uri 'https://github.com/livekit/livekit/releases/download/v1.7.2/livekit_windows_amd64.zip' -OutFile '%TEMP%\livekit.zip' -UseBasicParsing; Expand-Archive -Path '%TEMP%\livekit.zip' -DestinationPath '%LIVEKIT_DIR%' -Force; Write-Host 'LiveKit baixado!' } catch { Write-Host 'Erro ao baixar LiveKit: ' $_.Exception.Message }"
) else (
    echo   LiveKit ja instalado!
)

if exist "%LIVEKIT_EXE%" (
    echo   Iniciando LiveKit Server na porta 7880...
    start "LiveKit Server" cmd /k "%LIVEKIT_EXE% --bind 0.0.0.0 --keys devkey:devsecret_muito_longa_minimo_32_chars"
    timeout /t 2 /nobreak >nul
    echo   LiveKit OK!
) else (
    echo.
    echo   *** LiveKit nao encontrado ***
    echo   Para ativar voz: acesse https://cloud.livekit.io (gratis)
    echo   Crie um projeto, copie URL/Key/Secret e edite apps\server\.env
    echo   LIVEKIT_URL=wss://seu-projeto.livekit.cloud
    echo   LIVEKIT_API_KEY=APIsua_chave
    echo   LIVEKIT_API_SECRET=seu_secret
    echo.
)

echo.
echo =========================================
echo   Iniciando backend (porta 4000)...
echo =========================================
start "Nexus Backend" cmd /k "cd /d D:\NExuscall\nexus\apps\server && npx nest start --watch"

echo Aguardando 10 segundos para o backend iniciar...
timeout /t 10 /nobreak >nul

echo.
echo =========================================
echo   Iniciando frontend (porta 3000)...
echo =========================================
start "Nexus Frontend" cmd /k "cd /d D:\NExuscall\nexus\apps\web && npm run dev"

echo.
echo =========================================
echo   Nexus iniciado!
echo   Backend:  http://localhost:4000
echo   Frontend: http://localhost:3000
echo   LiveKit:  ws://localhost:7880
echo =========================================
echo.
echo Aguarde ~30 segundos para tudo subir...
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"
pause
