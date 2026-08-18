@echo off
title LiveKit Server - Voz
echo Iniciando LiveKit Server na porta 7880...
echo.

set LIVEKIT_DIR=%USERPROFILE%\nexus-livekit
set LIVEKIT_EXE=%LIVEKIT_DIR%\livekit-server.exe

if exist "%LIVEKIT_EXE%" (
    echo LiveKit encontrado! Iniciando...
    goto :start
)

echo LiveKit nao encontrado. Baixando...
if not exist "%LIVEKIT_DIR%" mkdir "%LIVEKIT_DIR%"

echo Tentando versao 1.7.2...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://github.com/livekit/livekit/releases/download/v1.7.2/livekit_1.7.2_windows_amd64.zip' -OutFile '%TEMP%\livekit.zip' -UseBasicParsing; Write-Host 'OK' } catch { Write-Host 'FALHOU' }"

if not exist "%TEMP%\livekit.zip" (
    echo Tentando versao 1.6.0...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/livekit/livekit/releases/download/v1.6.0/livekit_1.6.0_windows_amd64.zip' -OutFile '%TEMP%\livekit.zip' -UseBasicParsing"
)

echo Extraindo...
powershell -NoProfile -Command "Expand-Archive -Path '%TEMP%\livekit.zip' -DestinationPath '%LIVEKIT_DIR%' -Force"

REM Procura o exe dentro das subpastas
for /r "%LIVEKIT_DIR%" %%f in (livekit-server.exe) do copy "%%f" "%LIVEKIT_EXE%" >nul 2>&1

if not exist "%LIVEKIT_EXE%" (
    REM Tenta nome alternativo
    for /r "%LIVEKIT_DIR%" %%f in (livekit.exe) do copy "%%f" "%LIVEKIT_EXE%" >nul 2>&1
)

if not exist "%LIVEKIT_EXE%" (
    echo.
    echo ERRO: nao foi possivel baixar o LiveKit automaticamente.
    echo.
    echo Baixe manualmente em: https://github.com/livekit/livekit/releases
    echo Procure o arquivo Windows AMD64, extraia e coloque o .exe em:
    echo %LIVEKIT_DIR%\livekit-server.exe
    echo.
    pause
    exit /b 1
)

:start
echo.
echo LiveKit iniciando em ws://localhost:7880
echo Pressione CTRL+C para parar.
echo.
"%LIVEKIT_EXE%" --bind 0.0.0.0 --keys "devkey: devsecret_muito_longa_minimo_32_chars"
pause
