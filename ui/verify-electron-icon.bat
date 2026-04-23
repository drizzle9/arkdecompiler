@echo off
setlocal
cd /d "%~dp0"

echo ==============================
echo Verify Electron EXE icon
echo ==============================

if not exist "target\electron\win-unpacked\arkdecompiler.exe" (
  echo [ERROR] target\electron\win-unpacked\arkdecompiler.exe not found.
  echo Build Electron first.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { Add-Type -AssemblyName System.Drawing; $exe='target\\electron\\win-unpacked\\arkdecompiler.exe'; $out='target\\electron\\win-unpacked\\exe-icon-preview.png'; $icon=[System.Drawing.Icon]::ExtractAssociatedIcon((Resolve-Path $exe)); $bmp=$icon.ToBitmap(); $bmp.Save((Resolve-Path '.').Path + '\\' + $out,[System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); $icon.Dispose(); Write-Output ('[OK] Preview generated: ' + $out); }"

if %errorlevel% neq 0 (
  echo [ERROR] Failed to extract icon preview.
  pause
  exit /b 1
)

echo Compare files:
echo - src-common\icons\icon.png
echo - target\electron\win-unpacked\exe-icon-preview.png
pause
