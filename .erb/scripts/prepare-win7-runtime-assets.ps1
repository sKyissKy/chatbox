<#
.SYNOPSIS
    Prepares the offline workstation runtime assets for Chatbox Windows 7 packaging.
.DESCRIPTION
    Ensures that ../runtime-assets/ contains python, node, browser, git, and bin.
    Can be used locally or in CI (e.g. GitHub Actions).
#>

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $scriptDir "..\..")
$targetRuntimeDir = Resolve-Path (Join-Path $projectDir "..\runtime-assets") -ErrorAction SilentlyContinue

if (-not $targetRuntimeDir) {
    $targetRuntimeDir = Join-Path (Split-Path -Parent $projectDir) "runtime-assets"
    New-Item -ItemType Directory -Path $targetRuntimeDir -Force | Out-Null
}

$pyExe = Join-Path $targetRuntimeDir "python\python.exe"
$nodeExe = Join-Path $targetRuntimeDir "node\node.exe"
$gitExe = Join-Path $targetRuntimeDir "git\cmd\git.exe"
$browserExe = Join-Path $targetRuntimeDir "browser\chrome.exe"
$binExe = Join-Path $targetRuntimeDir "bin\ffmpeg.exe"
$scipyPkg = Join-Path $targetRuntimeDir "python\Lib\site-packages\scipy"
$wsPkg = Join-Path $targetRuntimeDir "node\node_modules\ws"

if ((Test-Path $pyExe) -and (Test-Path $nodeExe) -and (Test-Path $gitExe) -and (Test-Path $browserExe) -and (Test-Path $binExe) -and (Test-Path $scipyPkg) -and (Test-Path $wsPkg)) {
    Write-Host "[prepare-runtime-assets] All required runtime assets are already present at $targetRuntimeDir" -ForegroundColor Green
    exit 0
}

Write-Host "[prepare-runtime-assets] Preparing runtime assets in: $targetRuntimeDir" -ForegroundColor Cyan

# Check if a custom zip URL is provided
if ($env:RUNTIME_ASSETS_ZIP_URL) {
    Write-Host "[prepare-runtime-assets] Downloading prebuilt runtime assets from $env:RUNTIME_ASSETS_ZIP_URL ..." -ForegroundColor Yellow
    $zipPath = Join-Path $targetRuntimeDir "runtime-assets.zip"
    Invoke-WebRequest -Uri $env:RUNTIME_ASSETS_ZIP_URL -OutFile $zipPath -UseBasicParsing
    Write-Host "[prepare-runtime-assets] Extracting runtime-assets.zip ..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath (Split-Path -Parent $targetRuntimeDir) -Force
    Remove-Item -Path $zipPath -Force
    if (Test-Path $pyExe) {
        Write-Host "[prepare-runtime-assets] Successfully extracted custom runtime assets." -ForegroundColor Green
        exit 0
    }
}

$downloadsDir = Join-Path $targetRuntimeDir "downloads"
New-Item -ItemType Directory -Path $downloadsDir -Force | Out-Null

function Download-And-Extract {
    param(
        [string]$Url,
        [string]$ZipName,
        [string]$DestDir,
        [string]$SubFolderToExtract = ""
    )
    $zipPath = Join-Path $downloadsDir $ZipName
    if (-not (Test-Path $zipPath)) {
        Write-Host "[prepare-runtime-assets] Downloading $Url ..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $Url -OutFile $zipPath -UseBasicParsing
    }
    Write-Host "[prepare-runtime-assets] Extracting to $DestDir ..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    Expand-Archive -Path $zipPath -DestinationPath $DestDir -Force
    if ($SubFolderToExtract -and (Test-Path (Join-Path $DestDir $SubFolderToExtract))) {
        Get-ChildItem (Join-Path $DestDir $SubFolderToExtract) | Move-Item -Destination $DestDir -Force
        Remove-Item (Join-Path $DestDir $SubFolderToExtract) -Recurse -Force
    }
}

# 1. Python 3.8.10 Embed
$pyDir = Join-Path $targetRuntimeDir "python"
$scipyPkg = Join-Path $pyDir "Lib\site-packages\scipy"
if (-not (Test-Path $pyExe)) {
    Download-And-Extract -Url "https://www.python.org/ftp/python/3.8.10/python-3.8.10-embed-amd64.zip" -ZipName "python-3.8.10-embed-amd64.zip" -DestDir $pyDir
    
    # Configure python38._pth (must be ASCII without UTF-8 BOM, otherwise Python embed fails to load encodings)
    $pth = Join-Path $pyDir "python38._pth"
    "python38.zip`r`n.`r`nLib/site-packages`r`nimport site`r`n" | Set-Content -Path $pth -Encoding ascii
    
    # Verify Python runtime boots
    & $pyExe -c "import sys; print('Python embed initialized:', sys.version)"
    if ($LASTEXITCODE -ne 0) {
        throw "[prepare-runtime-assets] Python failed to boot!"
    }
}

if (-not (Test-Path $scipyPkg)) {
    # Install pip and comprehensive data analysis, science, office, ML and multimedia packages
    $pipPy = Join-Path $downloadsDir "get-pip.py"
    if (-not (Test-Path $pipPy)) {
        Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $pipPy -UseBasicParsing
    }
    & $pyExe $pipPy --no-warn-script-location
    if ($LASTEXITCODE -ne 0) {
        throw "[prepare-runtime-assets] Failed to execute get-pip.py!"
    }
    $pipExe = Join-Path $pyDir "Scripts\pip.exe"
    if (-not (Test-Path $pipExe)) {
        throw "[prepare-runtime-assets] pip.exe not found at $pipExe after get-pip.py!"
    }
    Write-Host "[prepare-runtime-assets] Installing full Python suite (24 packages: numpy, scipy, pandas, matplotlib, seaborn, scikit-learn, statsmodels, openpyxl, xlsxwriter, python-docx, python-pptx, pypdf, pdfplumber, reportlab, pillow, qrcode, imageio, pefile, pycryptodome, requests, beautifulsoup4, lxml, pyyaml, tqdm)..." -ForegroundColor Cyan
    & $pipExe install numpy scipy pandas matplotlib seaborn scikit-learn statsmodels openpyxl xlsxwriter python-docx python-pptx pypdf pdfplumber reportlab pillow qrcode imageio pefile pycryptodome requests beautifulsoup4 lxml pyyaml tqdm --no-warn-script-location
    if ($LASTEXITCODE -ne 0) {
        throw "[prepare-runtime-assets] pip install packages failed!"
    }
}

# 2. Node.js 16.20.2 + full offline Node.js toolchain (pinned for Node 16 / Win7 compatibility)
$nodeDir = Join-Path $targetRuntimeDir "node"
$wsPkg = Join-Path $nodeDir "node_modules\ws"
if (-not (Test-Path $nodeExe)) {
    Download-And-Extract -Url "https://nodejs.org/dist/v16.20.2/node-v16.20.2-win-x64.zip" -ZipName "node-v16.20.2-win-x64.zip" -DestDir $nodeDir -SubFolderToExtract "node-v16.20.2-win-x64"
}

if (-not (Test-Path $wsPkg)) {
    $npmCmd = Join-Path $nodeDir "npm.cmd"
    if (Test-Path $npmCmd) {
        Write-Host "[prepare-runtime-assets] Installing full offline Node.js toolchain for Node 16 (playwright-core@1.35.1, xlsx@0.18.5, tsx@3.14.0, cheerio@1.0.0-rc.12, axios@1.6.8, pdf-parse@1.1.1, adm-zip@0.5.10, glob@10.4.5, ws@8.14.2, chrome-remote-interface@0.32.1)..." -ForegroundColor Cyan
        & $npmCmd install playwright-core@1.35.1 xlsx@0.18.5 tsx@3.14.0 cheerio@1.0.0-rc.12 axios@1.6.8 pdf-parse@1.1.1 adm-zip@0.5.10 glob@10.4.5 ws@8.14.2 chrome-remote-interface@0.32.1 --prefix $nodeDir --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "[prepare-runtime-assets] npm install packages failed!"
        }
    }
}

# 3. Chromium 90 (Win x64 snapshot)
if (-not (Test-Path $browserExe)) {
    $browserDir = Join-Path $targetRuntimeDir "browser"
    Download-And-Extract -Url "https://npmmirror.com/mirrors/chromium-browser-snapshots/Win_x64/869685/chrome-win.zip" -ZipName "chrome-win.zip" -DestDir $browserDir -SubFolderToExtract "chrome-win"
}

# 4. MinGit 2.45.2
if (-not (Test-Path $gitExe)) {
    $gitDir = Join-Path $targetRuntimeDir "git"
    Download-And-Extract -Url "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/MinGit-2.45.2-64-bit.zip" -ZipName "MinGit-2.45.2-64-bit.zip" -DestDir $gitDir
}

# 5. FFmpeg 6.0
if (-not (Test-Path $binExe)) {
    $binDir = Join-Path $targetRuntimeDir "bin"
    Download-And-Extract -Url "https://github.com/GyanD/codexffmpeg/releases/download/6.0/ffmpeg-6.0-essentials_build.zip" -ZipName "ffmpeg-6.0-essentials_build.zip" -DestDir $binDir
    $ffmpegExtractedBin = Get-ChildItem -Path $binDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
    if ($ffmpegExtractedBin) {
        $parentBin = $ffmpegExtractedBin.DirectoryName
        Get-ChildItem $parentBin | Move-Item -Destination $binDir -Force
        # cleanup root folder if needed
        Get-ChildItem $binDir -Directory | Where-Object { $_.Name -like "ffmpeg-*" } | Remove-Item -Recurse -Force
    }
}

# Clean downloads cache
Remove-Item -Path $downloadsDir -Recurse -Force -ErrorAction SilentlyContinue

# Final verification
$missing = @()
if (-not (Test-Path $pyExe)) { $missing += "python.exe" }
if (-not (Test-Path $scipyPkg)) { $missing += "scipy in python site-packages" }
if (-not (Test-Path $nodeExe)) { $missing += "node.exe" }
if (-not (Test-Path $wsPkg)) { $missing += "ws in node_modules" }
if (-not (Test-Path $browserExe)) { $missing += "chrome.exe" }
if (-not (Test-Path $gitExe)) { $missing += "git.exe" }
if (-not (Test-Path $binExe)) { $missing += "ffmpeg.exe" }

if ($missing.Count -gt 0) {
    throw "[prepare-runtime-assets] Fatal: The following required components were not installed properly: $($missing -join ', ')"
}

Write-Host "[prepare-runtime-assets] Win7 runtime assets setup completed successfully!" -ForegroundColor Green
