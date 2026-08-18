@echo off
chcp 65001 >nul
title Nexus - Iniciando...

echo ============================================
echo    NEXUS - Iniciando Plataforma
echo ============================================
echo.

REM Verificar Docker
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Docker Desktop nao esta rodando!
    echo Abra o Docker Desktop e espere a baleia ficar verde, depois execute novamente.
    pause
    exit /b 1
)
echo [OK] Docker esta rodando

echo.
echo [1/4] Subindo banco de dados e servicos...
cd /d D:\NExuscall\nexus
docker compose up -d
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao subir os servicos Docker
    pause
    exit /b 1
)
echo [OK] Servicos Docker iniciados

echo.
echo [2/4] Configurando banco de dados (aguarde ~30s para o PostgreSQL iniciar)...
timeout /t 30 /nobreak
cd D:\NExuscall\nexus\apps\server
call npx prisma generate
call npx prisma migrate dev --name init
if %errorLevel% neq 0 (
    echo [AVISO] Migracao pode ja ter sido executada. Continuando...
)
call npm run seed
echo [OK] Banco de dados configurado

echo.
echo [3/4] Iniciando backend (porta 4000)...
start "Nexus Backend" cmd /k "cd /d D:\NExuscall\nexus\apps\server && npm run start:dev"

echo.
echo [4/4] Aguardando backend iniciar (20s)...
timeout /t 20 /nobreak

echo.
echo [OK] Iniciando frontend (porta 3000)...
start "Nexus Frontend" cmd /k "cd /d D:\NExuscall\nexus\apps\web && npm run dev"

echo.
echo ============================================
echo    Nexus esta sendo iniciado!
echo ============================================
echo.
echo   Frontend: http://localhost:3000
echo   API Docs: http://localhost:4000/api/docs
echo   Email:    http://localhost:8025
echo.
echo   Login admin:  admin@nexus.local / Admin@123456
echo   Login demo:   demo@nexus.local  / Demo@123456
echo.
echo Aguarde ~30 segundos e acesse http://localhost:3000
echo.
timeout /t 5
start "" "http://localhost:3000"
