param(
    [string]$ReportPath = (Join-Path $PSScriptRoot 'AIRI-Diagnostic-Report.txt'),
    [string]$LocalUrl = 'http://localhost:3000',
    [string]$ConfigPath,
    [string]$ApiHost,
    [int]$ApiPort = 0,
    [string]$UploadUrl,
    [string]$Origin = 'http://localhost:3000',
    [string]$NodeExecutable = 'node.exe'
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

$configurationPassed = $true
if ([string]::IsNullOrWhiteSpace($UploadUrl)) {
    try {
        if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
            $ConfigPath = Join-Path $PSScriptRoot 'display-config.json'
        }
        $displayConfig = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
        $apiBaseUrl = ([string]$displayConfig.apiBaseUrl).TrimEnd('/')
        $uploadPath = [string]$displayConfig.uploadPath
        $apiBaseUri = $null
        if (-not [System.Uri]::TryCreate($apiBaseUrl, [System.UriKind]::Absolute, [ref]$apiBaseUri) -or
            $apiBaseUri.Scheme -ne 'https') {
            throw 'apiBaseUrl must be an absolute HTTPS URL'
        }
        if ([string]::IsNullOrWhiteSpace($uploadPath) -or -not $uploadPath.StartsWith('/')) {
            throw 'uploadPath must begin with /'
        }
        $UploadUrl = $apiBaseUrl + $uploadPath
        Add-Pass "API configuration: loaded token-free deployment settings from $ConfigPath"
    }
    catch {
        $configurationPassed = $false
        Add-Fail "API configuration: invalid or missing display-config.json: $($_.Exception.Message)"
    }
}

$uploadUri = $null
if ($configurationPassed) {
    if (-not [System.Uri]::TryCreate($UploadUrl, [System.UriKind]::Absolute, [ref]$uploadUri)) {
        $configurationPassed = $false
        Add-Fail "API configuration: UploadUrl is not an absolute URL: $UploadUrl"
    }
    else {
        if ([string]::IsNullOrWhiteSpace($ApiHost)) {
            $ApiHost = $uploadUri.DnsSafeHost
        }
        if ($ApiPort -le 0) {
            $ApiPort = $uploadUri.Port
        }
    }
}

$osArchitecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
Add-ReportLine "Windows architecture / Windows 系统架构: $osArchitecture"

$nodeCommand = Get-Command $NodeExecutable -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
    Add-Fail 'Node.js: not found / 未找到 Node.js'
} else {
    try {
        $nodeExecutablePath = $nodeCommand.Path
        $nodeVersion = (& $nodeExecutablePath --version 2>&1 | Out-String).Trim()
        $nodeArchitecture = (& $nodeExecutablePath -p 'process.arch' 2>&1 | Out-String).Trim()
        $expectedNodeArchitecture = switch ($osArchitecture.ToUpperInvariant()) {
            'X64' { 'x64' }
            'X86' { 'ia32' }
            'ARM64' { 'arm64' }
            default { $null }
        }
        if ($null -eq $expectedNodeArchitecture) {
            Add-Fail "Node.js architecture: unsupported Windows architecture $osArchitecture"
        }
        elseif ($nodeArchitecture -ine $expectedNodeArchitecture) {
            Add-Fail "Node.js architecture mismatch: Windows=$osArchitecture; Node=$nodeArchitecture; expected=$expectedNodeArchitecture"
        }
        else {
            Add-Pass "Node.js: $nodeVersion; architecture=$nodeArchitecture / 架构=$nodeArchitecture"
        }
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

if ($configurationPassed) {
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
        $allowedMethods = @(([string]$corsResponse.Headers['Access-Control-Allow-Methods']).Split(',') |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $allowedHeaders = @(([string]$corsResponse.Headers['Access-Control-Allow-Headers']).Split(',') |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $statusAllowed = $corsResponse.StatusCode -ge 200 -and $corsResponse.StatusCode -lt 300
        $originAllowed = $allowedOrigin -eq $Origin
        $postAllowed = @($allowedMethods | Where-Object { $_ -ieq 'POST' }).Count -gt 0
        $authorizationAllowed = @($allowedHeaders | Where-Object { $_ -ieq 'authorization' }).Count -gt 0
        $corsSummary = "HTTP $($corsResponse.StatusCode); origin allowed=$originAllowed; POST allowed=$postAllowed; authorization allowed=$authorizationAllowed"
        if ($statusAllowed -and $originAllowed -and $postAllowed -and $authorizationAllowed) {
            Add-Pass "API CORS: HTTP $($corsResponse.StatusCode); localhost origin allowed; POST allowed=True; authorization allowed=True / 跨域检查正常"
        } else {
            Add-Fail "API CORS: $corsSummary / 跨域检查失败"
        }
    } catch {
        Add-Fail "API TLS/CORS: request failed / TLS 或跨域请求失败: $($_.Exception.Message)"
    }
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
