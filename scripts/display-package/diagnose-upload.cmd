@echo off
setlocal
pushd "%~dp0" || exit /b 1

echo AIRI upload diagnostics are running. Please wait...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnose-upload.ps1"
set "diagnostic_exit=%errorlevel%"

echo.
if exist "%~dp0AIRI-Diagnostic-Report.txt" (
    start "" notepad.exe "%~dp0AIRI-Diagnostic-Report.txt"
    echo Please send AIRI-Diagnostic-Report.txt to technical support.
) else (
    echo The report could not be created.
)
echo.
pause
popd
exit /b %diagnostic_exit%
