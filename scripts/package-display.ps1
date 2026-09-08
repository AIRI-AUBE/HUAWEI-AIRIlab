param(
    [string]$DistPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'),
    [string]$EnvironmentPath,
    [string]$EnvironmentRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$OutputRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$PackageName = ('AIRI-Display-Windows-{0}' -f (Get-Date -Format 'yyyy-MM-dd')),
    [switch]$AllowEmbeddedCredentials
)

$ErrorActionPreference = 'Stop'
$templateRoot = Join-Path $PSScriptRoot 'display-package'
$resolvedDistPath = [System.IO.Path]::GetFullPath($DistPath)
$resolvedEnvironmentRoot = [System.IO.Path]::GetFullPath($EnvironmentRoot)
$resolvedOutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)

if (-not (Test-Path -LiteralPath (Join-Path $resolvedDistPath 'index.html') -PathType Leaf)) {
    throw "Built site not found at $resolvedDistPath. Run npm run build first."
}
if ([string]::IsNullOrWhiteSpace($PackageName) -or
    [System.IO.Path]::GetFileName($PackageName) -ne $PackageName) {
    throw "PackageName must be a single directory name."
}

if (-not [string]::IsNullOrWhiteSpace($EnvironmentPath)) {
    $environmentFiles = @([System.IO.Path]::GetFullPath($EnvironmentPath))
}
else {
    $environmentFiles = @(
        '.env',
        '.env.local',
        '.env.production',
        '.env.production.local'
    ) | ForEach-Object {
        Join-Path $resolvedEnvironmentRoot $_
    } | Where-Object {
        Test-Path -LiteralPath $_ -PathType Leaf
    }
}
foreach ($environmentFile in $environmentFiles) {
    if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) {
        throw "Environment file not found at $environmentFile."
    }
}

$environment = @{}
foreach ($environmentFile in $environmentFiles) {
    Get-Content -LiteralPath $environmentFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$') {
            $value = $matches[2].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $environment[$matches[1]] = $value
        }
    }
}
foreach ($variableName in @(
    'VITE_AIRI_API_BASE_URL',
    'VITE_AIRI_UPLOAD_PATH',
    'VITE_AIRI_AUTH_TOKEN',
    'VITE_AIRI_API_KEY'
)) {
    $processValue = [System.Environment]::GetEnvironmentVariable($variableName, 'Process')
    if ($null -ne $processValue) {
        $environment[$variableName] = $processValue
    }
}

$apiBaseUrl = ([string]$environment['VITE_AIRI_API_BASE_URL']).TrimEnd('/')
$uploadPath = [string]$environment['VITE_AIRI_UPLOAD_PATH']
if ([string]::IsNullOrWhiteSpace($uploadPath)) {
    $uploadPath = '/api/GenerateWorkflow/UploadMedia'
}
$apiUri = $null
if (-not [System.Uri]::TryCreate($apiBaseUrl, [System.UriKind]::Absolute, [ref]$apiUri) -or
    $apiUri.Scheme -ne 'https') {
    throw 'VITE_AIRI_API_BASE_URL must be a valid HTTPS URL.'
}
if (-not $uploadPath.StartsWith('/')) {
    throw 'VITE_AIRI_UPLOAD_PATH must begin with /.'
}

$embeddedCredentialNames = @(
    'VITE_AIRI_AUTH_TOKEN',
    'VITE_AIRI_API_KEY'
) | Where-Object {
    -not [string]::IsNullOrWhiteSpace([string]$environment[$_])
}
if ($embeddedCredentialNames.Count -gt 0 -and -not $AllowEmbeddedCredentials) {
    throw ('The build uses browser-embedded credentials ({0}). ' +
        'Use the explicitly authorized internal-package command only for trusted recipients.' -f
        ($embeddedCredentialNames -join ', '))
}
if ($embeddedCredentialNames.Count -gt 0) {
    Write-Warning ('AUTHORIZED INTERNAL PACKAGE: browser-embedded credentials are present: {0}' -f
        ($embeddedCredentialNames -join ', '))
}

New-Item -ItemType Directory -Path $resolvedOutputRoot -Force | Out-Null
$packageDirectory = Join-Path $resolvedOutputRoot $PackageName
$zipPath = "$packageDirectory.zip"
if (-not ([System.IO.Path]::GetFullPath($packageDirectory)).StartsWith(
    $resolvedOutputRoot.TrimEnd('\') + '\',
    [System.StringComparison]::OrdinalIgnoreCase
)) {
    throw "Refusing to package outside the selected output directory."
}
if (Test-Path -LiteralPath $packageDirectory) {
    Remove-Item -LiteralPath $packageDirectory -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $packageDirectory | Out-Null
Copy-Item -LiteralPath $resolvedDistPath -Destination (Join-Path $packageDirectory 'dist') -Recurse

$packageFiles = @(
    @{ Source = (Join-Path $PSScriptRoot 'display-server.mjs'); Name = 'display-server.mjs' },
    @{ Source = (Join-Path $templateRoot 'check-windows-architecture.cmd'); Name = 'check-windows-architecture.cmd' },
    @{ Source = (Join-Path $templateRoot 'diagnose-upload.cmd'); Name = 'diagnose-upload.cmd' },
    @{ Source = (Join-Path $templateRoot 'diagnose-upload.ps1'); Name = 'diagnose-upload.ps1' },
    @{ Source = (Join-Path $templateRoot 'README-FIRST.txt'); Name = 'README-FIRST.txt' },
    @{ Source = (Join-Path $templateRoot 'start-display.ps1'); Name = 'start-display.ps1' },
    @{ Source = (Join-Path $templateRoot 'start-display.cmd'); Name = 'start-display.cmd' }
)
foreach ($file in $packageFiles) {
    if (-not (Test-Path -LiteralPath $file.Source -PathType Leaf)) {
        throw "Required package file not found: $($file.Source)"
    }
    $destinationPath = Join-Path $packageDirectory $file.Name
    Copy-Item -LiteralPath $file.Source -Destination $destinationPath
    if ([System.IO.Path]::GetExtension($file.Name) -ieq '.cmd') {
        $commandText = [System.IO.File]::ReadAllText($destinationPath)
        if ($commandText -match '[^\x00-\x7F]') {
            throw "Command launcher must contain ASCII only: $($file.Source)"
        }
        $commandText = $commandText.Replace("`r`n", "`n").Replace("`n", "`r`n")
        [System.IO.File]::WriteAllText(
            $destinationPath,
            $commandText,
            [System.Text.UTF8Encoding]::new($false)
        )
    }
}

$config = [ordered]@{
    apiBaseUrl = $apiBaseUrl
    uploadPath = $uploadPath
}
$config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $packageDirectory 'display-config.json') -Encoding UTF8
Compress-Archive -LiteralPath $packageDirectory -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "Display package directory: $packageDirectory"
Write-Output "Display package ZIP: $zipPath"
