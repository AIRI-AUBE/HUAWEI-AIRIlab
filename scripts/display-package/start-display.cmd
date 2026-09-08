@echo off
setlocal
pushd "%~dp0" || exit /b 1

where node.exe >nul 2>&1
if errorlevel 1 (
    echo.
    echo Node.js is not installed or Windows has not refreshed PATH yet.
    echo Install Node.js 24 LTS, restart Windows, then try again.
    echo.
    pause
    popd
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-display.ps1" %*
set "launcher_exit=%errorlevel%"

if not "%launcher_exit%"=="0" (
    echo.
    echo AIRI Display did not start. Please send a photo of this window.
    echo.
    pause
)

popd
exit /b %launcher_exit%
