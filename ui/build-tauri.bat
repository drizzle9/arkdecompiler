@echo off
setlocal
cd /d "%~dp0"
echo ==============================
echo Building arkdecompiler (Tauri)
echo ==============================

where cargo >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Rust/Cargo not found. Please install Rust first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing npm dependencies...
  call npm install
)

echo Cleaning src-tauri/gen directory...
if exist "src-tauri\gen" (
  rmdir /S /Q "src-tauri\gen"
  echo [OK] Cleaned src-tauri/gen
)

set "CARGO_TARGET_DIR=%CD%\target\tauri"

call npm run tauri:build
if %errorlevel% neq 0 (
  echo [ERROR] Tauri build failed.
  pause
  exit /b 1
)

if exist "src-tauri\gen" (
  if not exist "target\tauri\gen" mkdir "target\tauri\gen"
  xcopy /E /I /Y "src-tauri\gen\*" "target\tauri\gen\" >nul
  rmdir /S /Q "src-tauri\gen"
)

if not exist "target\tauri\release\bundle" (
  echo [ERROR] Bundle directory not found: target\tauri\release\bundle
  pause
  exit /b 1
)

echo [OK] Tauri build completed successfully.
echo.
echo Build artifacts are located at:
echo   - Executable: target\tauri\release\arkdecompiler.exe
echo   - NSIS Installer: target\tauri\release\bundle\nsis\arkdecompiler_0.1.0_x64-setup.exe
echo   - Generated schemas: target\tauri\gen
echo.
pause