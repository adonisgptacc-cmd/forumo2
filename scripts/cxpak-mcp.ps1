$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$executable = Join-Path $repoRoot ".tools\cxpak\cxpak.exe"

if (-not (Test-Path -LiteralPath $executable)) {
    [Console]::Error.WriteLine("cxpak is not installed. Run 'pnpm setup:cxpak' from the repository root.")
    exit 1
}

& $executable serve --mcp $repoRoot
exit $LASTEXITCODE
