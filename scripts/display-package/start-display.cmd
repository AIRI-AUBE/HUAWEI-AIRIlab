@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 (
    echo.
    echo Node.js is not installed or Windows has not refreshed PATH yet.
    echo Install Node.js 24 LTS, then restart this computer and try again.
    echo.
    pause
    exit /b 1
)

start "AIRI Display Server" /min cmd /c node.exe "%~dp0display-server.mjs"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds(15); do { try { $r = Invoke-WebRequest 'http://localhost:3000' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 300 } while ((Get-Date) -lt $deadline); exit 1"

if errorlevel 1 (
    echo.
    echo AIRI Display did not start on port 3000.
    echo Check whether another program is using that port, then try again.
    echo.
    pause
    exit /b 1
)

start "" "http://localhost:3000"
exit /b 0
