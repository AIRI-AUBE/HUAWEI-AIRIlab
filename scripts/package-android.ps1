param(
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$SdkRoot = $env:ANDROID_HOME,
    [string]$GradleHome,
    [string]$WorkingRoot = (Join-Path $env:LOCALAPPDATA 'AIRI-Android-Builds'),
    [switch]$SkipWebBuild,
    [switch]$AllowEmbeddedCredentials
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
if (-not $AllowEmbeddedCredentials) {
    throw 'This internal display build may embed API credentials. Pass -AllowEmbeddedCredentials for an authorized test package.'
}
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { throw 'Set JAVA_HOME to a JDK 21 installation.' }
if (-not (Test-Path -LiteralPath (Join-Path $SdkRoot 'platforms/android-36/android.jar'))) { throw 'Install Android SDK platform 36 and set ANDROID_HOME.' }
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $SdkRoot

Push-Location $repo
try {
    if (-not $SkipWebBuild) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    }
    if (-not (Test-Path 'dist/index.html')) { throw 'Missing dist; run npm run build.' }

    # Java/Gradle compile on a fresh local copy, never on the shared UNC checkout.
    $stage = Join-Path ([IO.Path]::GetFullPath($WorkingRoot)) ([guid]::NewGuid().ToString('N'))
    if ($stage.StartsWith('\\')) { throw 'WorkingRoot must be on a local drive.' }
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo 'android') -Destination (Join-Path $stage 'android') -Recurse
    $capacitorModules = Join-Path $stage 'node_modules/@capacitor'
    New-Item -ItemType Directory -Path $capacitorModules -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo 'node_modules/@capacitor/android') -Destination $capacitorModules -Recurse
    Copy-Item -LiteralPath (Join-Path $repo 'node_modules/@capacitor/core') -Destination $capacitorModules -Recurse
    Copy-Item -LiteralPath (Join-Path $repo 'dist') -Destination $stage -Recurse
    Copy-Item -LiteralPath (Join-Path $repo 'package.json'), (Join-Path $repo 'capacitor.config.json') -Destination $stage
    Push-Location $stage
    try {
        & node (Join-Path $repo 'node_modules/@capacitor/cli/bin/capacitor') sync android
        if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    } finally { Pop-Location }
    $sdkProperty = 'sdk.dir=' + ([IO.Path]::GetFullPath($SdkRoot)).Replace('\', '/').Replace(':', '\:')
    [IO.File]::WriteAllText((Join-Path $stage 'android/local.properties'), $sdkProperty + "`n")

    Push-Location (Join-Path $stage 'android')
    try {
        if ($GradleHome) {
            & (Join-Path $GradleHome 'bin/gradle.bat') --no-daemon --console=plain assembleDebug :app:lintDebug
        } else {
            & .\gradlew.bat --no-daemon --console=plain assembleDebug :app:lintDebug
        }
        if ($LASTEXITCODE -ne 0) { throw "Android build failed. Local build: $stage" }
    } finally { Pop-Location }

    $output = Join-Path $repo ('AIRI-Android-{0}-TEST' -f (Get-Date -Format 'yyyy-MM-dd'))
    New-Item -ItemType Directory -Path $output -Force | Out-Null
    $apk = Join-Path $output ('Huawei-AIRI-{0}-test.apk' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Copy-Item -LiteralPath (Join-Path $stage 'android/app/build/outputs/apk/debug/app-debug.apk') -Destination $apk
    Copy-Item -LiteralPath (Join-Path $repo 'docs/android-install-zh.md') -Destination (Join-Path $output '安装说明.md')
    $hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
    "$hash  $([IO.Path]::GetFileName($apk))" | Set-Content -LiteralPath "$apk.sha256" -Encoding ascii
    Write-Output "APK=$apk"
    Write-Output "BUILD_DIRECTORY=$stage"
} finally { Pop-Location }
