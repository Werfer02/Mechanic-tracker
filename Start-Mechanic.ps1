$ErrorActionPreference = "Stop"

# Mechanic Tracker native Windows launcher
# Matches the README's native development defaults:
#   API:     3001
#   Desktop: 5173
# Docker uses 8080 for the desktop, but this script does not use Docker.

$Root = $PSScriptRoot

$ApiPort = 3001
$DesktopPort = 5173

function Get-LanIPv4 {
    $ip = Get-NetIPConfiguration |
        Where-Object {
            $_.NetAdapter.Status -eq "Up" -and
            $_.IPv4DefaultGateway -ne $null -and
            $_.IPv4Address -ne $null
        } |
        ForEach-Object { $_.IPv4Address.IPAddress } |
        Where-Object {
            $_ -notlike "127.*" -and
            $_ -notlike "169.254.*"
        } |
        Select-Object -First 1

    if (-not $ip) {
        throw "Could not determine the local network IPv4 address."
    }

    return $ip
}

function Test-Port {
    param(
        [string]$ComputerName = "127.0.0.1",
        [int]$Port
    )

    try {
        $Client = New-Object System.Net.Sockets.TcpClient
        $Async = $Client.BeginConnect($ComputerName, $Port, $null, $null)
        $Connected = $Async.AsyncWaitHandle.WaitOne(500)

        if ($Connected -and $Client.Connected) {
            $Client.EndConnect($Async)
            $Client.Close()
            return $true
        }

        $Client.Close()
        return $false
    }
    catch {
        return $false
    }
}

function Start-ServerWindow {
    param([string]$Command)

    $Bytes = [System.Text.Encoding]::Unicode.GetBytes($Command)
    $Encoded = [Convert]::ToBase64String($Bytes)

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-EncodedCommand",
        $Encoded
    )
}

$LanIp = Get-LanIPv4

# README-native URLs
$ApiLocalUrl = "http://localhost:$ApiPort"
$ApiLanUrl = "http://${LanIp}:$ApiPort"
$DesktopUrl = "http://${LanIp}:$DesktopPort"

Write-Host "Starting Mechanic Tracker..." -ForegroundColor Cyan
Write-Host ""
Write-Host "LAN IP:        $LanIp" -ForegroundColor Green
Write-Host "Desktop:       $DesktopUrl"
Write-Host "API local:     $ApiLocalUrl"
Write-Host "API for phone: $ApiLanUrl"
Write-Host ""

# API server
# PostgreSQL is on this same machine, so DATABASE_URL correctly stays localhost.
if (-not (Test-Port -Port $ApiPort)) {
    $ApiCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Mechanic Tracker API'
Set-Location -LiteralPath '$($Root.Replace("'", "''"))'

`$env:PORT = '$ApiPort'
`$env:DATABASE_URL = 'postgresql://mechanic:mechanic@localhost:5432/mechanic'
`$env:SESSION_SECRET = 'local-mechanic-secret'
`$env:NODE_ENV = 'development'

pnpm --filter @workspace/api-server run start
"@

    Start-ServerWindow -Command $ApiCommand
    Write-Host "API starting on port $ApiPort..."
}
else {
    Write-Host "API already running on port $ApiPort."
}

# Desktop Vite dev server
# The Vite proxy talks to the API locally on the PC, exactly as described in README.
if (-not (Test-Port -Port $DesktopPort)) {
    $DesktopCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Mechanic Tracker Desktop'
Set-Location -LiteralPath '$($Root.Replace("'", "''"))'

`$env:PORT = '$DesktopPort'
`$env:BASE_PATH = '/'
`$env:API_TARGET = 'http://localhost:$ApiPort'

# These are available to frontend code for QR/mobile sync if needed.
`$env:VITE_LAN_IP = '$LanIp'
`$env:VITE_API_URL = 'http://${LanIp}:$ApiPort'

pnpm --filter @workspace/mechanic-desktop run dev
"@

    Start-ServerWindow -Command $DesktopCommand
    Write-Host "Desktop starting on port $DesktopPort..."
}
else {
    Write-Host "Desktop already running on port $DesktopPort."
}

Write-Host "Waiting for desktop..."

$Ready = $false
for ($i = 0; $i -lt 40; $i++) {
    if (Test-Port -Port $DesktopPort) {
        $Ready = $true
        break
    }

    Start-Sleep -Milliseconds 500
}

if ($Ready) {
    Write-Host "Opening $DesktopUrl" -ForegroundColor Green
    Start-Process explorer.exe -ArgumentList $DesktopUrl
}
else {
    Write-Warning "Desktop did not start on port $DesktopPort."
    Read-Host "Press Enter to close this window"
}