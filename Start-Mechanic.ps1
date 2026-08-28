$ErrorActionPreference = "Stop"

# This script is intended to live in the Mechanic-tracker repository root.
$Root = $PSScriptRoot

$ApiUrl = "http://localhost:3001"
$WebUrl = "http://localhost:5173"

function Start-PowerShellProcess {
    param(
        [string]$Title,
        [string]$Command
    )

    # -EncodedCommand avoids quoting/path problems, including spaces in the repo path.
    $Bytes = [System.Text.Encoding]::Unicode.GetBytes($Command)
    $Encoded = [Convert]::ToBase64String($Bytes)

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-EncodedCommand",
        $Encoded
    )
}

Write-Host "Starting Mechanic Tracker..." -ForegroundColor Cyan

# Start the API only if it is not already listening.
$ApiRunning = $false
try {
    Invoke-WebRequest "$ApiUrl/api/healthz" -UseBasicParsing -TimeoutSec 1 | Out-Null
    $ApiRunning = $true
} catch {}

if (-not $ApiRunning) {
    $ApiCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Mechanic Tracker API'
Set-Location -LiteralPath '$($Root.Replace("'", "''"))'
`$env:DATABASE_URL = 'postgresql://mechanic:mechanic@localhost:5432/mechanic'
`$env:PORT = '3001'
`$env:SESSION_SECRET = 'local-mechanic-secret'
`$env:NODE_ENV = 'development'
pnpm --filter @workspace/api-server run start
"@

    Start-PowerShellProcess -Title "Mechanic Tracker API" -Command $ApiCommand
    Write-Host "API started."
} else {
    Write-Host "API is already running."
}

# Start Vite only if it is not already responding.
$WebRunning = $false
try {
    Invoke-WebRequest $WebUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
    $WebRunning = $true
} catch {}

if (-not $WebRunning) {
    $WebCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Mechanic Tracker Desktop'
Set-Location -LiteralPath '$($Root.Replace("'", "''"))'
`$env:PORT = '5173'
`$env:BASE_PATH = '/'
`$env:API_TARGET = 'http://localhost:3001'
pnpm --filter @workspace/mechanic-desktop run dev
"@

    Start-PowerShellProcess -Title "Mechanic Tracker Desktop" -Command $WebCommand
    Write-Host "Desktop server started."
} else {
    Write-Host "Desktop server is already running."
}

# Wait for Vite before opening the browser.
Write-Host "Waiting for the web app..."

$Ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        Invoke-WebRequest $WebUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
        $Ready = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($Ready) {
    Write-Host "Opening Mechanic Tracker." -ForegroundColor Green
    Start-Process $WebUrl
} else {
    Write-Warning "The web app did not become available. Check the API and Desktop PowerShell windows for errors."
}
