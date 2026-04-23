@echo off
setlocal
echo ==============================
echo Refreshing Windows icon cache
echo ==============================
echo.
echo This will restart Explorer.
echo Save your work before continuing.
echo.
pause

taskkill /f /im explorer.exe >nul 2>&1

del /a /f /q "%LocalAppData%\IconCache.db" >nul 2>&1
del /a /f /q "%LocalAppData%\Microsoft\Windows\Explorer\iconcache*" >nul 2>&1
del /a /f /q "%LocalAppData%\Microsoft\Windows\Explorer\thumbcache*" >nul 2>&1

start explorer.exe

echo.
echo Icon cache refreshed.
echo If desktop icon still old:
echo 1) delete old desktop shortcut
echo 2) re-run installer and create shortcut again
echo.
pause
