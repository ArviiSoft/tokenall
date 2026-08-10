@echo off
title arviis. - TokenAll v1.0
chcp 65001 >nul
color 07
mode con cols=80 lines=30 >nul 2>&1
cd /d "%~dp0"

echo.
echo  [*] Starting arviis. TokenAll v1.0...
echo.

if not exist "node_modules\" (
    echo  [*] Installing npm modules, please wait...
    npm install --legacy-peer-deps
    echo.
) else (
    echo  [*] Updating dependencies...
    npm install --legacy-peer-deps
    echo.
)

node arvis.js

echo.
pause
