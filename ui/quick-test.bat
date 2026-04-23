@echo off
setlocal
cd /d "%~dp0"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=web"

if /I "%MODE%"=="web" goto run_web
if /I "%MODE%"=="electron" goto run_electron
if /I "%MODE%"=="tauri" goto run_tauri

echo [ERROR] Unknown mode: %MODE%
echo Usage: quick-test.bat [web^|electron^|tauri]
pause
exit /b 1

:ensure_deps
if not exist "node_modules" (
  echo node_modules not found, installing dependencies first...
  call install-deps.bat
  if %errorlevel% neq 0 exit /b 1
)
exit /b 0

:run_web
echo [INFO] Quick test (Web): starting Vite dev server...
call npm run web:quick
exit /b %errorlevel%

:run_electron
call :ensure_deps
if %errorlevel% neq 0 exit /b 1

echo [INFO] Quick test (Electron): starting Vite on :1420 ...
start "vite-dev" cmd /c "npm run dev -- --host --port 1420"

timeout /t 3 /nobreak >nul

echo [INFO] Launching Electron...
set "NODE_ENV=development"
call npx electron .
exit /b %errorlevel%

:run_tauri
call :ensure_deps
if %errorlevel% neq 0 exit /b 1

echo [INFO] Quick test (Tauri): starting tauri dev...
call npm run tauri:dev
exit /b %errorlevel%