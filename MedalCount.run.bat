@echo off
cd /d "%~dp0"
if exist "release\win-unpacked\WFL Medal Count.exe" (
  start "" "release\win-unpacked\WFL Medal Count.exe"
  exit /b 0
)
if exist "node_modules\electron\dist\electron.exe" (
  call npm run start
  exit /b %ERRORLEVEL%
)
echo The app build is missing. In this folder run: npm run dist:win
pause
