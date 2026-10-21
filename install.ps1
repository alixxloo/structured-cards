# Structured Cards - one-line Obsidian vault installer for Windows.
#
# One line install (pass the vault path):
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/alixxloo/structured-cards/main/install.ps1))) -VaultPath "C:\Path\To\Your\Vault"
#
# One line install (env var form, plain irm | iex):
#   $env:VAULT="C:\Path\To\Your\Vault"; irm https://raw.githubusercontent.com/alixxloo/structured-cards/main/install.ps1 | iex
#
# Saved copy:
#   .\install.ps1 -VaultPath "C:\Path\To\Your\Vault"
#
# Downloads main.js, manifest.json and styles.css from the latest GitHub
# Release into <Vault>\.obsidian\plugins\structured-cards\, enables the plugin
# in community-plugins.json when that file already exists (Obsidian writes it
# itself once community plugins are enabled), and never rewrites a file it
# cannot parse. Needs no dependencies beyond Windows PowerShell 5.1+.

param(
  [string]$VaultPath = ""
)

$Repo     = "alixxloo/structured-cards"
$PluginId = "structured-cards"
$Base     = "https://github.com/$Repo/releases/latest/download"

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

function Step($msg)    { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Done($msg)    { Write-Host "[ OK ]  $msg" -ForegroundColor Green }
function Warn($msg)    { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Fail1($msg) {
  Write-Host "[FAIL]  $msg" -ForegroundColor Red
  exit 1
}

# --- resolve the vault ------------------------------------------------------
if (-not $VaultPath) { $VaultPath = $env:VAULT }
if ($VaultPath) {
  Done "Vault taken from the given path: $VaultPath"
} elseif (Test-Path ".obsidian") {
  $VaultPath = (Get-Location).Path
  Done "Vault detected from the current directory: $VaultPath"
} elseif ($Host.Name -eq "ConsoleHost" -and [Environment]::UserInteractive) {
  Step "You are inside an Obsidian vault and the path was not passed."
  $VaultPath = Read-Host "Type your Obsidian vault path"
} else {
  Fail1 "No vault path. Re-run with -VaultPath `"C:\Path\To\Your\Vault`" or set `$env:VAULT first."
}

if ([string]::IsNullOrWhiteSpace($VaultPath)) {
  Fail1 "No vault path given."
}
if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
  Fail1 "Vault directory not found: $VaultPath"
}
$VaultPath = (Resolve-Path -LiteralPath $VaultPath).Path

$PluginDir = Join-Path $VaultPath ".obsidian\plugins\$PluginId"
Step "Installing $PluginId into: $PluginDir"
New-Item -ItemType Directory -Force -Path $PluginDir | Out-Null

# --- download the three release assets --------------------------------------
function Get-Remote($url, $dest) {
  if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    & curl.exe -fsSL --retry 2 -o "$dest" "$url" 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $dest) -and (Get-Item $dest).Length -gt 0) { return $true }
  }
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 60
    return (Test-Path $dest) -and (Get-Item $dest).Length -gt 0
  } catch {
    return $false
  }
}

$assets = @("main.js", "manifest.json", "styles.css")
foreach ($f in $assets) {
  $dest = Join-Path $PluginDir $f
  if (Get-Remote "$Base/$f" "$dest") {
    Done "Downloaded $f"
  } else {
    Warn "Release asset missing: $f"
    Fail1 "Could not download the plugin files. Build them from source (docs: https://github.com/$Repo#from-source) or install via the BRAT plugin."
  }
}
if (-not (Get-Item (Join-Path $PluginDir "main.js")).Length -gt 0) {
  Fail1 "main.js ended up empty - aborting."
}

# --- enable in community-plugins.json when the file already exists ----------
$Config = Join-Path $VaultPath ".obsidian\community-plugins.json"
if (-not (Test-Path $Config)) {
  Warn "No community-plugins.json in this vault (community plugins were never enabled)."
  Warn "After the files are in place: Obsidian Settings -> General -> Enable 'Community plugins',"
  Warn "then Settings -> Community plugins -> enable 'Structured Cards'."
} else {
  $added = $false
  $already = $false
  try {
    $raw  = [IO.File]::ReadAllText($Config)
    $list = $raw | ConvertFrom-Json
    if ($null -eq $list) { throw "empty" }
    $ids = @($list)
    if ($ids -contains $PluginId) {
      $already = $true
    } else {
      $ids = @($ids) + $PluginId
      $json = ConvertTo-Json -InputObject @($ids) -Depth 5
      [IO.File]::WriteAllText($Config, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))
      $added = $true
    }
  } catch {
    Warn "community-plugins.json could not be parsed or written safely - leaving it untouched."
    Warn "Enable the plugin manually: Obsidian Settings -> Community plugins -> 'Structured Cards'."
    $already = $false; $added = $false
  }
  if ($already) { Done "Already enabled in community-plugins.json." }
  elseif ($added) { Done "Enabled in community-plugins.json." }
}

# --- done -------------------------------------------------------------------
Write-Host ""
Done "Installed '$PluginId' successfully."
Step "Next steps:"
Step "  1. Restart Obsidian (or reload with Ctrl+R) for this vault."
Step "  2. Obsidian Settings -> Community plugins -> enable 'Structured Cards'."
Step "  3. In any note: Command palette -> 'Structured Cards: Insert field'."
Step "Docs & examples: https://github.com/$Repo#readme"
