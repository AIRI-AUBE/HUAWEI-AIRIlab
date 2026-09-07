@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

echo AIRI upload diagnostics are running. Please wait...
echo AIRI 上传诊断正在运行，请稍候……
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnose-upload.ps1"
set "diagnostic_exit=%errorlevel%"

echo.
if exist "%~dp0AIRI-Diagnostic-Report.txt" (
    start "" notepad.exe "%~dp0AIRI-Diagnostic-Report.txt"
    echo Please send AIRI-Diagnostic-Report.txt to technical support.
    echo 请将 AIRI-Diagnostic-Report.txt 发送给技术人员。
) else (
    echo The report could not be created.
    echo 无法创建诊断报告。
)
echo.
pause
exit /b %diagnostic_exit%
