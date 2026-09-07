[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 3000,
    [switch]$NoBrowser,
    [string]$ServerScript,
    [string]$DistPath
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ServerScript) {
    $ServerScript = Join-Path $scriptRoot 'display-server.mjs'
}
if (-not $DistPath) {
    $DistPath = Join-Path $scriptRoot 'dist'
}

$healthUri = "http://127.0.0.1:$Port/__airi_display_health"
$displayUri = "http://localhost:$Port"

function Test-AiriDisplayHealth {
    try {
        $health = Invoke-RestMethod -Uri $healthUri -Method Get -TimeoutSec 1
        return $health.service -eq 'airi-display' -and $health.status -eq 'ok'
    }
    catch {
        return $false
    }
}

if (Test-AiriDisplayHealth) {
    Write-Output 'AIRI_DISPLAY_ALREADY_RUNNING=1'
    if (-not $NoBrowser) {
        Start-Process $displayUri
    }
    exit 0
}

$portProbe = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback,
    $Port
)
try {
    $portProbe.Start()
}
catch {
    Write-Error "Port $Port is already used by another program."
    exit 2
}
finally {
    $portProbe.Stop()
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    Write-Error 'Node.js was not found.'
    exit 1
}
if (-not (Test-Path -LiteralPath $ServerScript -PathType Leaf)) {
    Write-Error "Missing display-server.mjs: $ServerScript"
    exit 1
}
if (-not (Test-Path -LiteralPath (Join-Path $DistPath 'index.html') -PathType Leaf)) {
    Write-Error "Missing dist\index.html: $DistPath"
    exit 1
}

$quotedServerScript = '"{0}"' -f $ServerScript.Replace('"', '\"')
$quotedDistPath = '"{0}"' -f $DistPath.Replace('"', '\"')
$serverArguments = @(
    $quotedServerScript,
    '--root',
    $quotedDistPath,
    '--host',
    '127.0.0.1',
    '--port',
    [string]$Port
)
$serverProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList $serverArguments -WindowStyle Hidden -PassThru

$deadline = (Get-Date).AddSeconds(15)
do {
    if ($serverProcess.HasExited) {
        Write-Error "AIRI Display server exited with code $($serverProcess.ExitCode)."
        exit 1
    }
    if (Test-AiriDisplayHealth) {
        Write-Output "AIRI_DISPLAY_PROCESS_ID=$($serverProcess.Id)"
        if (-not $NoBrowser) {
            Start-Process $displayUri
        }
        exit 0
    }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)

if (-not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
}
Write-Error 'AIRI Display did not become healthy within 15 seconds.'
exit 1
