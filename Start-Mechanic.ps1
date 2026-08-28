$ErrorActionPreference = "Stop"

# Put this script in the Mechanic-tracker repository root.
$Root = $PSScriptRoot

$ApiPort = 3001
$WebPort = 5173
$WebUrl = "http://localhost:$WebPort"

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
    param(
        [string]$Command
    )

    $Bytes = [System.Text.Encoding]::Unicode.GetBytes($Command)
    $Encoded = [Convert]::ToBase64String($Bytes)

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-EncodedCommand",
        $Encoded
    )
}

Write-Host "Starting Mechanic Tracker..." -ForegroundColor Cyan

# API
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
if (-not (Test-Port -Port $WebPort)) {
    $WebCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Mechanic Tracker Desktop'
Set-Location -LiteralPath '$($Root.Replace("'", "''"))'
`$env:PORT = '5173'
`$env:BASE_PATH = '/'
`$env:API_TARGET = 'http://localhost:3001'
pnpm --filter @workspace/mechanic-desktop run dev
"@

    Start-ServerWindow -Command $WebCommand
    Write-Host "Desktop server starting..."
}
else {
    Write-Host "Desktop server is already running."
}

# Wait for Vite's TCP port rather than making an HTTP request.
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
    Write-Host "Opening Mechanic Tracker..." -ForegroundColor Green

    # explorer.exe reliably hands URLs to the Windows default browser.
    Start-Process explorer.exe -ArgumentList $WebUrl
}
else {
    Write-Warning "Vite did not start on port $WebPort. Check the Desktop PowerShell window for errors."
    Read-Host "Press Enter to close this window"
}
