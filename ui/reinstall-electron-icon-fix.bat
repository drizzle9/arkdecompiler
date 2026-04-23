@echo off
setlocal
cd /d "%~dp0"

set "APP_NAME=arkdecompiler"
set "INSTALL_DIR=%LocalAppData%\Programs\%APP_NAME%"
set "DESKTOP_LNK=%UserProfile%\Desktop\%APP_NAME%.lnk"
set "STARTMENU_LNK=%AppData%\Microsoft\Windows\Start Menu\Programs\%APP_NAME%.lnk"
set "SETUP_EXE=target\electron\%APP_NAME% Setup 0.1.0.exe"

echo ==============================
echo Reinstall Electron (Icon Fix)
echo ==============================
echo.
echo This will:
echo 1) close running app
echo 2) remove old install directory
echo 3) delete old shortcuts
echo 4) launch latest installer
echo.
pause

taskkill /f /im "%APP_NAME%.exe" >nul 2>&1

if exist "%INSTALL_DIR%" (
  rmdir /s /q "%INSTALL_DIR%"
)

if exist "%DESKTOP_LNK%" del /f /q "%DESKTOP_LNK%"
if exist "%STARTMENU_LNK%" del /f /q "%STARTMENU_LNK%"

if not exist "%SETUP_EXE%" (
  echo [ERROR] Setup file not found: %SETUP_EXE%
  echo Build first with build-electron.bat
  pause
  exit /b 1
)

echo Launching installer...
start "" "%SETUP_EXE%"

echo.
echo After install completes:
echo - run refresh-icon-cache.bat once if icon still stale
echo.
pause
