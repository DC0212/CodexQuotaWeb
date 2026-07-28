@echo off
setlocal
title Codex Meter
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Codex Meter needs Node.js 18 or newer.
  echo Download it from: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

node "%~dp0src\server.js"
if errorlevel 1 (
  echo.
  echo Codex Meter could not start. Please copy the error above when asking for help.
  echo.
  pause
)
