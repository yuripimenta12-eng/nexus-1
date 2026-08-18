@echo off
chcp 65001 >nul
title Nexus Setup

echo ============================================
echo    NEXUS - Configuracao Automatica
echo ============================================
echo.

REM Verificar se esta rodando como admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Execute este script como Administrador!
    echo Clique com botao direito no arquivo e escolha "Executar como administrador"
    pause
    exit /b 1
)

echo [1/6] Instalando WSL 2...
wsl --install --no-distribution
if %errorLevel% neq 0 (
    echo [AVISO] WSL pode precisar de reinicializacao. Continuando...
)

echo.
echo [2/6] Atualizando WSL para versao 2...
wsl --set-default-version 2 >nul 2>&1

echo.
echo [3/6] Copiando arquivo de configuracao .env...
cd /d D:\NExuscall\nexus
if not exist .env (
    copy .env.example .env
    echo [OK] .env criado com sucesso
) else (
    echo [OK] .env ja existe
)

echo.
echo [4/6] Instalando dependencias do backend...
cd D:\NExuscall\nexus\apps\server
call npm install
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias do backend
    pause
    exit /b 1
)
echo [OK] Dependencias do backend instaladas

echo.
echo [5/6] Instalando dependencias do frontend...
cd D:\NExuscall\nexus\apps\web
call npm install
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias do frontend
    pause
    exit /b 1
)
echo [OK] Dependencias do frontend instaladas

echo.
echo ============================================
echo    IMPORTANTE: Proximos passos
echo ============================================
echo.
echo 1. REINICIE o computador se o WSL pediu
echo 2. Apos reiniciar, abra o Docker Desktop
echo 3. Espere a baleia ficar verde (pronto)
echo 4. Execute o arquivo: iniciar-nexus.bat
echo.
echo ============================================
pause
