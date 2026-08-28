$ErrorActionPreference = "Stop"

# Put this script in the Mechanic-tracker repository root.
$Root = $PSScriptRoot

$ApiPort = 3001
$WebPort = 5173

function Get-LanIPv4 {
    # Prefer an active adapter that actually has a default gateway.
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
$WebUrl = "http://${LanIp}:${WebPort}"
$ApiLanUrl = "http://${LanIp}:${ApiPort}"

Write-Host "Starting Mechanic Tracker..." -ForegroundColor Cyan
Write-Host "LAN IP: $LanIp" -ForegroundColor Green
Write-Host "Desktop: $WebUrl"
Write-Host "API for mobile: $ApiLanUrl"

# API
# DATABASE_URL intentionally stays localhost because PostgreSQL is on this PC.
if (-not (Test-Port -Port $ApiPort)) {
    $ApiCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Mechanic Tracker API'
Set-Location -LiteralPath '$($Root.Replace("'", "''"))'
`$env:DATABASE_URL = 'postgresql://mechanic:mechanic@localhost:5432/mechanic'
`$env:PORT = '3001'
`$env:SESSION_SECRET = 'local-mechanic-secret'
`$env:NODE_ENV = 'development'
pnpm --filter @workspace/api-server run start
"@

    Start-ServerWindow -Command $ApiCommand
    Write-Host "API starting..."
}
else {
    Write-Host "API is already running."
}

# Vite
# API_TARGET stays localhost because the Vite proxy and API run on the same PC.
# VITE_LAN_IP / VITE_API_URL are available to browser code if the QR generator needs them.
if (-not (Test-Port -Port $WebPort)) {
    $WebCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Mechanic Tracker Desktop'
Set-Location -LiteralPath '$($Root.Replace("'", "''"))'
`$env:PORT = '5173'
`$env:BASE_PATH = '/'
`$env:API_TARGET = 'http://localhost:3001'
`$env:VITE_LAN_IP = '$LanIp'
`$env:VITE_API_URL = 'http://${LanIp}:3001'
pnpm --filter @workspace/mechanic-desktop run dev
"@

    Start-ServerWindow -Command $WebCommand
    Write-Host "Desktop server starting..."
}
else {
    Write-Host "Desktop server is already running."
}

Write-Host "Waiting for the web app..."

$Ready = $false
for ($i = 0; $i -lt 30; $i++) {
    if (Test-Port -Port $WebPort) {
        $Ready = $true
        break
    }
    Start-Sleep -Milliseconds 500
}

if ($Ready) {
    Write-Host "Opening $WebUrl" -ForegroundColor Green
    Start-Process explorer.exe -ArgumentList $WebUrl
}
else {
    Write-Warning "Vite did not start on port $WebPort."
    Read-Host "Press Enter to close this window"
}