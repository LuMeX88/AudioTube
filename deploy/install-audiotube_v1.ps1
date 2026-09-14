<#
.SYNOPSIS
    AudioTube — one-click installer for a fresh Windows 11 PC.

.DESCRIPTION
    Installs everything needed to run AudioTube locally and starts it:
      1. Git            (via winget)
      2. Docker Desktop (via winget)
      3. Clones the AudioTube repository
      4. Builds & starts the Docker stack (Home Assistant + proxy)

    After it finishes, open http://localhost:8123 and use the "AudioTube"
    panel in the sidebar. Login: admin / admin1234.

.NOTES
    Run this in an ELEVATED PowerShell (Run as Administrator):

        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
        .\install-audiotube_v1.ps1

    Docker Desktop may require a reboot on first install (WSL2 / virtualization).
    If prompted to reboot, do so, then re-run this script — it will resume.
#>

[CmdletBinding()]
param(
    [string]$RepoUrl     = 'https://github.com/LuMeX88/AudioTube.git',
    [string]$InstallRoot = "$env:USERPROFILE\AudioTube"
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "    !   $msg" -ForegroundColor Yellow }

# ── 0. Preconditions ────────────────────────────────────────────────────────
Write-Step 'Checking prerequisites'

$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw 'Please run this script in an ELEVATED PowerShell (Run as Administrator).'
}
Write-Ok 'Running as Administrator'

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'winget not found. Install "App Installer" from the Microsoft Store, then re-run.'
}
Write-Ok 'winget available'

# ── Helper: is a command available on PATH? ─────────────────────────────────
function Test-Cmd($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Install-WingetPackage($id, $friendly) {
    Write-Step "Installing $friendly"
    $installed = winget list --id $id --exact 2>$null | Select-String $id
    if ($installed) {
        Write-Ok "$friendly already installed"
        return
    }
    winget install --id $id --exact --silent `
        --accept-package-agreements --accept-source-agreements
    Write-Ok "$friendly installed"
}

# ── 1. Git ──────────────────────────────────────────────────────────────────
Install-WingetPackage 'Git.Git' 'Git'

# Refresh PATH so git is usable in this same session.
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path','User')

# ── 2. Docker Desktop ───────────────────────────────────────────────────────
Install-WingetPackage 'Docker.DockerDesktop' 'Docker Desktop'

$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path','User')

# ── 3. Ensure Docker is running ─────────────────────────────────────────────
Write-Step 'Starting Docker Desktop'

$dockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if (Test-Path $dockerExe) {
    if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
        Start-Process $dockerExe | Out-Null
        Write-Ok 'Launched Docker Desktop'
    } else {
        Write-Ok 'Docker Desktop already running'
    }
} else {
    Write-Warn 'Docker Desktop.exe not found at the default path.'
    Write-Warn 'If Docker was just installed, a REBOOT may be required.'
    Write-Warn 'Reboot, ensure Docker Desktop is running, then re-run this script.'
}

# Wait for the Docker engine to accept commands (up to ~3 minutes).
Write-Step 'Waiting for the Docker engine (this can take a minute on first launch)'
$deadline = (Get-Date).AddMinutes(3)
$engineReady = $false
while ((Get-Date) -lt $deadline) {
    if (Test-Cmd 'docker') {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { $engineReady = $true; break }
    }
    Start-Sleep -Seconds 5
}
if (-not $engineReady) {
    throw @'
Docker engine did not become ready in time.
This usually means a reboot is needed to finish Docker Desktop / WSL2 setup.
Please REBOOT, start Docker Desktop manually, wait until it says "Engine running",
then re-run this script.
'@
}
Write-Ok 'Docker engine is ready'

# ── 4. Clone (or update) the repository ─────────────────────────────────────
Write-Step 'Fetching AudioTube source'
if (Test-Path (Join-Path $InstallRoot '.git')) {
    Write-Ok "Repo already present at $InstallRoot — pulling latest"
    git -C $InstallRoot pull --ff-only
} else {
    git clone $RepoUrl $InstallRoot
    Write-Ok "Cloned into $InstallRoot"
}

# ── 5. Build & start the stack ──────────────────────────────────────────────
Write-Step 'Building and starting containers (first build downloads images)'
Push-Location $InstallRoot
try {
    docker compose up -d --build
} finally {
    Pop-Location
}
Write-Ok 'Containers are up'

# ── 6. Done ─────────────────────────────────────────────────────────────────
Write-Host "`n===================================================================" -ForegroundColor Green
Write-Host ' AudioTube is running!' -ForegroundColor Green
Write-Host '===================================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Home Assistant : http://localhost:8123'
Write-Host '  Proxy health   : http://localhost:3001/api/health'
Write-Host ''
Write-Host '  On first HA launch you will create an account, or use the'
Write-Host '  pre-seeded test login if the config is already onboarded:'
Write-Host '      username: admin'
Write-Host '      password: admin1234'
Write-Host ''
Write-Host '  Then open the "AudioTube" panel in the HA sidebar.'
Write-Host ''
Write-Host '  Manage the stack from: ' -NoNewline; Write-Host $InstallRoot -ForegroundColor Cyan
Write-Host '      docker compose logs -f      # view logs'
Write-Host '      docker compose down         # stop'
Write-Host '      docker compose up -d        # start again'
Write-Host ''

Start-Process 'http://localhost:8123'
