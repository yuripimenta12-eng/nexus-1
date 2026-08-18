@echo off
chcp 65001 >nul
title Ativando Virtualizacao Windows

echo ============================================
echo   Ativando recursos de virtualizacao
echo ============================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Execute como Administrador!
    pause
    exit /b 1
)

echo [1/4] Ativando Hyper-V...
dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart

echo.
echo [2/4] Ativando Virtual Machine Platform...
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

echo.
echo [3/4] Ativando Subsistema Windows para Linux...
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

echo.
echo [4/4] Atualizando WSL para versao 2...
wsl --set-default-version 2

echo.
echo ============================================
echo   PRONTO! Reinicie o computador agora.
echo   Depois abra o Docker Desktop normalmente.
echo ============================================
echo.
pause
shutdown /r /t 10 /c "Reiniciando para ativar virtualizacao (10 segundos)"
