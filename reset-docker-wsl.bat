@echo off
chcp 65001 >nul
title Reset Docker WSL

echo Resetando integracao WSL do Docker...
echo.

echo [1/5] Fechando Docker Desktop completamente...
taskkill /f /im "Docker Desktop.exe" >nul 2>&1
taskkill /f /im "dockerd.exe" >nul 2>&1
taskkill /f /im "com.docker.backend.exe" >nul 2>&1
taskkill /f /im "com.docker.proxy.exe" >nul 2>&1
timeout /t 5 /nobreak >nul

echo [2/5] Removendo distros WSL do Docker (reset)...
wsl --unregister docker-desktop >nul 2>&1
wsl --unregister docker-desktop-data >nul 2>&1

echo [3/5] Reiniciando servico WSL...
wsl --shutdown
timeout /t 3 /nobreak >nul

echo [4/5] Verificando WSL...
wsl --status
wsl --list --verbose 2>nul

echo.
echo [5/5] Iniciando Docker Desktop...
start "" "%LOCALAPPDATA%\Programs\DockerDesktop\frontend\Docker Desktop.exe"

echo.
echo ============================================
echo   Aguarde 2-3 minutos para o Docker iniciar
echo   Ele vai recriar as distros WSL
echo ============================================
pause
