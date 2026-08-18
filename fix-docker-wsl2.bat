@echo off
chcp 65001 >nul
title Corrigindo Docker - WSL2 Backend

echo ============================================
echo   Corrigindo Docker para usar WSL 2
echo ============================================
echo.

echo [1/4] Fechando Docker Desktop...
taskkill /f /im "Docker Desktop.exe" >nul 2>&1
taskkill /f /im "dockerd.exe" >nul 2>&1
timeout /t 3 /nobreak >nul

echo [2/4] Baixando e instalando atualizacao do kernel WSL 2...
curl -L -o "%TEMP%\wsl_update_x64.msi" "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
msiexec /i "%TEMP%\wsl_update_x64.msi" /quiet /norestart
echo [OK] Kernel WSL 2 atualizado

echo [3/4] Configurando Docker para usar WSL 2...
set DOCKER_CONFIG=%APPDATA%\Docker
if not exist "%DOCKER_CONFIG%" mkdir "%DOCKER_CONFIG%"

(
echo {
echo   "wslEngineEnabled": true,
echo   "displayedTutorial": true,
echo   "analyticsEnabled": false
echo }
) > "%DOCKER_CONFIG%\settings.json"
echo [OK] Configuracoes salvas

echo [4/4] Procurando e iniciando Docker Desktop...
set DOCKER_PATH1=%LOCALAPPDATA%\Programs\Docker\Docker\Docker Desktop.exe
set DOCKER_PATH2=%ProgramFiles%\Docker\Docker\Docker Desktop.exe
set DOCKER_PATH3=%LOCALAPPDATA%\Docker\Docker Desktop.exe

if exist "%DOCKER_PATH1%" (
    echo Encontrado em: %DOCKER_PATH1%
    start "" "%DOCKER_PATH1%"
    goto :done
)
if exist "%DOCKER_PATH2%" (
    echo Encontrado em: %DOCKER_PATH2%
    start "" "%DOCKER_PATH2%"
    goto :done
)
if exist "%DOCKER_PATH3%" (
    echo Encontrado em: %DOCKER_PATH3%
    start "" "%DOCKER_PATH3%"
    goto :done
)

echo [AVISO] Nao encontrei o Docker. Abrindo manualmente...
explorer "%LOCALAPPDATA%\Programs\Docker"

:done
echo.
echo ============================================
echo   Aguarde o Docker iniciar (1-2 minutos)
echo   Me mande um print quando abrir!
echo ============================================
pause
