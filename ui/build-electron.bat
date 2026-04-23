@echo off
setlocal
cd /d "%~dp0"
echo ==============================
echo Building arkdecompiler (Electron)
echo ==============================

set NEED_SYNC_DEPS=0
if not exist "node_modules" (
  set NEED_SYNC_DEPS=1
) else if exist "package-lock.json" (
  if not exist "node_modules\.package-lock.json" (
    set NEED_SYNC_DEPS=1
  ) else (
    for %%I in (package-lock.json) do set LOCK_TIME=%%~tI
    for %%I in (node_modules\.package-lock.json) do set NM_LOCK_TIME=%%~tI
    if /I not "%LOCK_TIME%"=="%NM_LOCK_TIME%" (
      set NEED_SYNC_DEPS=1
    )
  )
)

if "%NEED_SYNC_DEPS%"=="1" (
  echo Syncing npm dependencies...
  call npm install
)

call npm run build:web
if %errorlevel% neq 0 (
  echo [ERROR] Web build failed.
  pause
  exit /b 1
)

echo Cleaning previous electron output...
if exist "target\electron" rmdir /s /q "target\electron"

echo Trying default output: target/electron
call npx electron-builder --win
if %errorlevel% equ 0 (
  echo [OK] Electron build completed.
  echo Output: target/electron
  pause
  exit /b 0
)

echo [WARN] Default output directory may be locked.
echo Trying fallback output: target/electron-fallback
call npx electron-builder --win --config.directories.output=target/electron-fallback
if %errorlevel% neq 0 (
  echo [ERROR] Electron build failed on both default and fallback outputs.
  pause
  exit /b 1
)

echo [OK] Electron build completed with fallback output.
echo Output: target/electron-fallback
pause