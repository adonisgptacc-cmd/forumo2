[CmdletBinding()]
param(
    [string]$Version = "3.1.4",
    [string]$ExpectedSha256 = "b4199c74cfda9e45a8022b912d7220ad5ec87b8a015f7318bb0108b2acc573e2"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$installDir = Join-Path $repoRoot ".tools\cxpak"
$executable = Join-Path $installDir "cxpak.exe"
$archiveName = "cxpak-x86_64-pc-windows-msvc.zip"
$downloadUrl = "https://github.com/Barnett-Studios/cxpak/releases/download/v$Version/$archiveName"
$stagingDir = Join-Path $repoRoot ".tools\cxpak-staging"
$archivePath = Join-Path $stagingDir $archiveName

if (Test-Path -LiteralPath $executable) {
    $installedVersion = & $executable --version
    if ($LASTEXITCODE -eq 0 -and $installedVersion -match [regex]::Escape($Version)) {
        Write-Host "cxpak $Version is already installed at $executable"
        exit 0
    }
}

if (Test-Path -LiteralPath $stagingDir) {
    Remove-Item -LiteralPath $stagingDir -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
    $actualSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()

    if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
        throw "cxpak archive checksum mismatch. Expected $ExpectedSha256, got $actualSha256."
    }

    Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingDir -Force
    if (-not (Test-Path -LiteralPath (Join-Path $stagingDir "cxpak.exe"))) {
        throw "The cxpak release archive did not contain cxpak.exe."
    }

    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $stagingDir "cxpak.exe") -Destination $executable -Force
    & $executable --version
    if ($LASTEXITCODE -ne 0) {
        throw "cxpak was installed but failed its version check."
    }
} finally {
    if (Test-Path -LiteralPath $stagingDir) {
        Remove-Item -LiteralPath $stagingDir -Recurse -Force
    }
}

Write-Host "Installed cxpak $Version at $executable"
