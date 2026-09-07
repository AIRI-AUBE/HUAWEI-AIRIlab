@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

where node.exe >nul 2>&1
if errorlevel 1 (
    echo.
    echo Node.js is not installed or Windows has not refreshed PATH yet.
    echo Node.js 未安装，或 Windows 尚未刷新 PATH。
    echo Install Node.js 24 LTS, restart Windows, then try again.
    echo 请安装 Node.js 24 LTS，重启电脑后再试。
    echo.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-display.ps1" %*
set "launcher_exit=%errorlevel%"

if not "%launcher_exit%"=="0" (
    echo.
    echo AIRI Display did not start. Please send a photo of this window.
    echo AIRI Display 启动失败。请拍照并发送此窗口。
    echo.
    pause
)

exit /b %launcher_exit%
