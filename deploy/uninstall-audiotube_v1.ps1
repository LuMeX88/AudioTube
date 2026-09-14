<#
.SYNOPSIS
    AudioTube — cleanup / uninstaller.

.DESCRIPTION
    Stops and removes the AudioTube Docker stack. By default it only stops the
    containers and removes them. Use the switches for a deeper cleanup:

      -RemoveImages   Also delete the built/pulled Docker images.
      -RemoveVolumes  Also delete Docker volumes (HA config data etc.).
      -RemoveRepo     Also delete the cloned repository folder.
      -All            Do everything above.

    This script does NOT uninstall Git or Docker Desktop — those are general
    tools you may want to keep. Remove them via "Settings > Apps" if desired.

.NOTES
    Run in an ELEVATED PowerShell (Run as Administrator):

        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
        .\uninstall-audiotube_v1.ps1            # stop & remove containers
        .\uninstall-audiotube_v1.ps1 -All       # full cleanup
#>

[CmdletBinding()]
param(
    [string]$InstallRoot = "$env:USERPROFILE\AudioTube",
    [switch]$RemoveImages,
    [switch]$RemoveVolumes,
    [switch]$RemoveRepo,
    [switch]$All
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "    !   $msg" -ForegroundColor Yellow }

if ($All) { $RemoveImages = $true; $RemoveVolumes = $true; $RemoveRepo = $true }

# ── Preconditions ───────────────────────────────────────────────────────────
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Warn 'Docker not found on PATH — nothing to stop. Continuing with file cleanup only.'
} elseif (-not (Test-Path (Join-Path $InstallRoot 'docker-compose.yml'))) {
    Write-Warn "No docker-compose.yml found in $InstallRoot — skipping compose down."
} else {
    Write-Step 'Stopping and removing containers'
    Push-Location $InstallRoot
    try {
        $downArgs = @('compose', 'down')
        if ($RemoveVolumes) { $downArgs += '--volumes' }
        if ($RemoveImages)  { $downArgs += @('--rmi', 'all') }
        docker @downArgs
        Write-Ok 'Stack stopped'
    } finally {
        Pop-Location
    }
}

# ── Optional: prune leftover named containers (in case compose file was gone) ─
if (Get-Command docker -ErrorAction SilentlyContinue) {
    foreach ($name in @('tube-audio-ha', 'tube-audio-proxy')) {
        $exists = docker ps -a --filter "name=^/$name$" --format '{{.Names}}' 2>$null
        if ($exists) {
            Write-Step "Removing leftover container $name"
            docker rm -f $name *> $null
            Write-Ok "Removed $name"
        }
    }
}

# ── Optional: delete the repository folder ──────────────────────────────────
if ($RemoveRepo) {
    if (Test-Path $InstallRoot) {
        Write-Step "Deleting repository folder $InstallRoot"
        Remove-Item -Recurse -Force $InstallRoot
        Write-Ok 'Repository folder deleted'
    } else {
        Write-Warn "Repository folder $InstallRoot not found — nothing to delete."
    }
}

Write-Host "`n===================================================================" -ForegroundColor Green
Write-Host ' AudioTube cleanup complete.' -ForegroundColor Green
Write-Host '===================================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Git and Docker Desktop were left installed (general-purpose tools).'
Write-Host '  Remove them via Settings > Apps if you no longer need them.'
Write-Host ''
if (-not $RemoveImages)  { Write-Host '  Tip: re-run with -RemoveImages to delete Docker images too.' }
if (-not $RemoveVolumes) { Write-Host '  Tip: re-run with -RemoveVolumes to delete HA config data.' }
if (-not $RemoveRepo)    { Write-Host '  Tip: re-run with -RemoveRepo to delete the cloned folder.' }
Write-Host '  Or use -All to do everything at once.'
Write-Host ''
