param(
    [string]$ReportPath = (Join-Path $PSScriptRoot 'AIRI-Diagnostic-Report.txt'),
    [string]$LocalUrl = 'http://localhost:3000',
    [string]$ApiHost = 'aigc.airilab.net',
    [int]$ApiPort = 58013,
    [string]$UploadUrl = 'https://aigc.airilab.net:58013/api/GenerateWorkflow/UploadMedia',
    [string]$Origin = 'http://localhost:3000'
)

$lines = New-Object 'System.Collections.Generic.List[string]'
$allPassed = $true
$localWebsitePassed = $false

function Add-ReportLine {
    param([string]$Text)
    $script:lines.Add($Text)
    Write-Host $Text
}

function Add-Pass {
    param([string]$Text)
    Add-ReportLine "[PASS] $Text"
}

function Add-Fail {
    param([string]$Text)
    $script:allPassed = $false
    Add-ReportLine "[FAIL] $Text"
}

Add-ReportLine 'AIRI Display Upload Diagnostic Report'
Add-ReportLine 'AIRI 展示端上传诊断报告'
Add-ReportLine ('Generated / 生成时间: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
Add-ReportLine ''
Add-ReportLine 'This check does not upload a file and does not read or print authorization tokens.'
Add-ReportLine '此检查不会上传文件，也不会读取或显示身份验证令牌。'
Add-ReportLine ''

$osArchitecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
Add-ReportLine "Windows architecture / Windows 系统架构: $osArchitecture"

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
    Add-Fail 'Node.js: not found / 未找到 Node.js'
} else {
    try {
        $nodeVersion = (& node.exe --version 2>&1 | Out-String).Trim()
        $nodeArchitecture = (& node.exe -p 'process.arch' 2>&1 | Out-String).Trim()
        Add-Pass "Node.js: $nodeVersion; architecture=$nodeArchitecture / 架构=$nodeArchitecture"
    } catch {
        Add-Fail "Node.js: could not run / 无法运行 Node.js: $($_.Exception.Message)"
    }
}

try {
    $localResponse = Invoke-WebRequest -Uri $LocalUrl -UseBasicParsing -TimeoutSec 5
    if ($localResponse.StatusCode -eq 200) {
        $localWebsitePassed = $true
        Add-Pass 'Local website: HTTP 200 / 本地网站正常'
    } else {
        Add-Fail "Local website: HTTP $($localResponse.StatusCode) / 本地网站状态异常"
    }
} catch {
    Add-Fail "Local website: unreachable / 无法访问本地网站: $($_.Exception.Message)"
}

try {
    $addresses = [System.Net.Dns]::GetHostAddresses($ApiHost)
    $addressText = (($addresses | ForEach-Object IPAddressToString) -join ', ')
    if ([string]::IsNullOrWhiteSpace($addressText)) {
        Add-Fail "API DNS: no address returned for $ApiHost / 未返回地址"
    } else {
        Add-Pass "API DNS: $ApiHost -> $addressText"
    }
} catch {
    Add-Fail "API DNS: cannot resolve $ApiHost / 无法解析域名: $($_.Exception.Message)"
}

$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $connectResult = $tcpClient.BeginConnect($ApiHost, $ApiPort, $null, $null)
    if (-not $connectResult.AsyncWaitHandle.WaitOne(5000)) {
        throw "connection timed out after 5 seconds"
    }
    $tcpClient.EndConnect($connectResult)
    Add-Pass "API port: $ApiHost`:$ApiPort reachable / API 端口可连接"
} catch {
    Add-Fail "API port: $ApiHost`:$ApiPort unreachable / API 端口无法连接: $($_.Exception.Message)"
} finally {
    $tcpClient.Close()
}

try {
    $corsHeaders = @{
        Origin = $Origin
        'Access-Control-Request-Method' = 'POST'
        'Access-Control-Request-Headers' = 'authorization'
    }
    $corsResponse = Invoke-WebRequest `
        -Uri $UploadUrl `
        -Method Options `
        -Headers $corsHeaders `
        -UseBasicParsing `
        -TimeoutSec 15
    $allowedOrigin = [string]$corsResponse.Headers['Access-Control-Allow-Origin']
    if ($corsResponse.StatusCode -eq 204 -and $allowedOrigin -eq $Origin) {
        Add-Pass 'API CORS: HTTP 204; localhost origin allowed / 跨域检查正常'
    } else {
        Add-Fail "API CORS: HTTP $($corsResponse.StatusCode); allowed-origin='$allowedOrigin' / 跨域检查失败"
    }
} catch {
    Add-Fail "API TLS/CORS: request failed / TLS 或跨域请求失败: $($_.Exception.Message)"
}

Add-ReportLine ''
if ($allPassed) {
    Add-ReportLine 'OVERALL RESULT: PASS'
    Add-ReportLine 'NEXT ACTION: CHECK_BROWSER_UPLOAD'
    Add-ReportLine '总体结果：基础连接检查通过。'
    Add-ReportLine 'If image upload still fails, send this report and a browser Network screenshot to technical support.'
    Add-ReportLine '如果图片仍然上传失败，请把此报告和浏览器 Network（网络）截图发送给技术人员。'
} else {
    Add-ReportLine 'OVERALL RESULT: FAIL'
    if (-not $localWebsitePassed) {
        Add-ReportLine 'NEXT ACTION: START_LOCAL_SERVER'
    } else {
        Add-ReportLine 'NEXT ACTION: CHECK_API_NETWORK'
    }
    Add-ReportLine '总体结果：检查失败。请把此报告发送给技术人员。'
}

$reportDirectory = Split-Path -Parent $ReportPath
if (-not [string]::IsNullOrWhiteSpace($reportDirectory)) {
    New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
}
$lines | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Host ''
Write-Host "Report saved / 报告已保存: $ReportPath"

if ($allPassed) {
    exit 0
}
exit 1
