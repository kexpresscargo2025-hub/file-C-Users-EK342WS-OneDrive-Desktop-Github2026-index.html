@echo off
title Vehicle Service Planner
echo.
echo  Vehicle Service Planner - Mobile Install Server
echo  ================================================
echo.
echo  Starting server on port 3000...
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set IP=%%a
  goto :found
)
:found
set IP=%IP:~1%
echo  On your phone (same Wi-Fi), open:
echo.
echo    http://%IP%:3000
echo.
echo  For INSTALL on Android, use HTTPS (see README) or GitHub Pages.
echo  Press Ctrl+C to stop.
echo.
npm run start:mobile
