@echo off
echo.
echo This computer uses:
powershell.exe -NoProfile -Command "[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture"
echo.
echo Download the Windows x64 Node.js installer for X64.
echo Download the Windows ARM64 Node.js installer for Arm64.
echo.
pause
