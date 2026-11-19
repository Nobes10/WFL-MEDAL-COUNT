@echo off
setlocal
cd /d "%~dp0"
title WFL Medal Count

set "ELECTRON=%~dp0node_modules\electron\dist\electron.exe"
set "ELECTRON_FALLBACK=%~dp0..\members-draw\node_modules\electron\dist\electron.exe"

where npm >nul 2>&1
if errorlevel 1 goto unpacked

rem Force a rebuild with: MedalCount.run.bat rebuild
set "DO_BUILD="
if /I "%~1"=="rebuild" set "DO_BUILD=1"
if /I "%~1"=="build" set "DO_BUILD=1"
if not exist "%~dp0dist\index.html" set "DO_BUILD=1"
if not exist "%~dp0dist-electron\main.js" set "DO_BUILD=1"

rem Close any already-running copy so we can relaunch cleanly.
set "KILLED="
taskkill /F /IM "WFL Medal Count.exe" >nul 2>&1 && set "KILLED=1"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$procs = Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*wfl-medal-count*' -or $_.CommandLine -like '*wfl-medal-count*' }; if ($procs) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 set "KILLED=1"
if defined KILLED timeout /t 1 /nobreak >nul

if defined DO_BUILD (
  echo Building WFL Medal Count...
  call npm run build
  if errorlevel 1 (
    echo.
    echo Build failed.
    pause
    exit /b 1
  )
) else (
  echo Starting WFL Medal Count...
)

if exist "%ELECTRON%" (
  start "" /D "%~dp0" "%ELECTRON%" .
  exit /b 0
)

if exist "%ELECTRON_FALLBACK%" (
  start "" /D "%~dp0" "%ELECTRON_FALLBACK%" .
  exit /b 0
)

:unpacked
echo.
echo This folder has no Electron, so the old packaged app would open without 4-vote WWFL.
echo In this folder run: npm install
pause
exit /b 1
