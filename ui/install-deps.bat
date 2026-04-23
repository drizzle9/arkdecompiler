@echo off
setlocal
cd /d "%~dp0"
echo ==============================
echo Installing arkdecompiler dependencies
echo ==============================

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found. Please install Node.js 18+ first.
  pause
  exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] npm not found. Please reinstall Node.js.
  pause
  exit /b 1
)

echo Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo [OK] npm dependencies installed.
echo If you need Tauri build, also install Rust:
echo   https://rustup.rs/
pause