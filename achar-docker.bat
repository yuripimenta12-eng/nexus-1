@echo off
chcp 65001 >nul
title Procurando Docker...

echo Procurando Docker Desktop no computador...
echo.

where "Docker Desktop.exe" 2>nul
if %errorLevel% equ 0 goto :found

echo Buscando em AppData...
dir /s /b "%LOCALAPPDATA%\Docker Desktop.exe" 2>nul
dir /s /b "%APPDATA%\Docker Desktop.exe" 2>nul
dir /s /b "%USERPROFILE%\Docker Desktop.exe" 2>nul

echo.
echo Buscando em Program Files...
dir /s /b "C:\Program Files\Docker Desktop.exe" 2>nul
dir /s /b "C:\Program Files (x86)\Docker Desktop.exe" 2>nul

:found
echo.
echo ===========================
echo Copie o caminho acima e me mande!
echo ===========================
pause
