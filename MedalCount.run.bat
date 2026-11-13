@echo off
setlocal
cd /d "%~dp0"
title WFL Medal Count

set "ELECTRON=%~dp0node_modules\electron\dist\electron.exe"
set "ELECTRON_FALLBACK=%~dp0..\members-draw\node_modules\electron\dist\electron.exe"

where npm >nul 2>&1
if errorlevel 1 goto unpacked

echo Closing old WFL Medal Count...
taskkill /F /IM "WFL Medal Count.exe" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*wfl-medal-count*' -or $_.CommandLine -like '*wfl-medal-count*' } | Stop-Process -Force -ErrorAction SilentlyContinue"
timeout /t 1 /nobreak >nul

echo Building WFL Medal Count...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

if exist "%ELECTRON%" (
  echo Starting WFL Medal Count...
  start "" /D "%~dp0" "%ELECTRON%" .
  exit /b 0
)

if exist "%ELECTRON_FALLBACK%" (
  echo Starting WFL Medal Count...
  start "" /D "%~dp0" "%ELECTRON_FALLBACK%" .
  exit /b 0
)

:unpacked
echo.
echo This folder has no Electron, so the old packaged app would open without 4-vote WWFL.
echo In this folder run: npm install
pause
exit /b 1
