#!/usr/bin/env node

/**
 * Prepares offline runtime assets for Chatbox Linux packaging (x64 / arm64).
 * Ensures that ../runtime-assets/ contains:
 *   - python: Standalone portable CPython 3.12+ with numpy, pandas, matplotlib, openpyxl
 *   - node: Portable Node.js 22 LTS with playwright-core
 *   - browser: Headless Chromium engine
 *   - bin: Static binaries (ripgrep, ffmpeg)
 *
 * Can be run locally or in GitHub Actions CI.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectDir = path.resolve(__dirname, '..', '..')

// Determine target architecture from CLI arguments or host process
const archArg = process.argv.find((arg) => arg.startsWith('--arch='))
const targetArch = archArg ? archArg.split('=')[1] : process.arch === 'arm64' ? 'arm64' : 'x64'

console.log(`[prepare-linux-runtime] Target architecture: ${targetArch}`)

// Resolve target runtime-assets directory (sibling of repo, consistent with electron-builder)
let targetRuntimeDir = path.resolve(projectDir, '..', 'runtime-assets')
if (!fs.existsSync(targetRuntimeDir)) {
  const localRuntimeDir = path.resolve(projectDir, 'runtime-assets')
  if (fs.existsSync(localRuntimeDir)) {
    targetRuntimeDir = localRuntimeDir
  } else {
    fs.mkdirSync(targetRuntimeDir, { recursive: true })
  }
}

console.log(`[prepare-linux-runtime] Runtime assets directory: ${targetRuntimeDir}`)

const pythonDir = path.join(targetRuntimeDir, 'python')
const nodeDir = path.join(targetRuntimeDir, 'node')
const browserDir = path.join(targetRuntimeDir, 'browser')
const binDir = path.join(targetRuntimeDir, 'bin')

fs.mkdirSync(pythonDir, { recursive: true })
fs.mkdirSync(nodeDir, { recursive: true })
fs.mkdirSync(browserDir, { recursive: true })
fs.mkdirSync(binDir, { recursive: true })

function run(cmd, options = {}) {
  console.log(`[prepare-linux-runtime] > ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...options })
}

// 1. Static Binaries: ripgrep & ffmpeg
const rgDest = path.join(binDir, 'rg')
const rgSource = path.join(
  projectDir,
  'node_modules',
  '@vscode',
  'ripgrep-universal',
  'bin',
  `linux-${targetArch}`,
  'rg'
)

if (fs.existsSync(rgSource) && !fs.existsSync(rgDest)) {
  console.log(`[prepare-linux-runtime] Copying static ripgrep from ${rgSource}...`)
  fs.copyFileSync(rgSource, rgDest)
  try {
    fs.chmodSync(rgDest, 0o755)
  } catch {}
}

const ffmpegDest = path.join(binDir, 'ffmpeg')
if (!fs.existsSync(ffmpegDest)) {
  if (fs.existsSync('/usr/bin/ffmpeg')) {
    console.log('[prepare-linux-runtime] Copying system ffmpeg...')
    try {
      fs.copyFileSync('/usr/bin/ffmpeg', ffmpegDest)
      fs.chmodSync(ffmpegDest, 0o755)
    } catch (e) {
      console.warn(`[prepare-linux-runtime] Could not copy ffmpeg: ${e.message}`)
    }
  }
}

const ffprobeDest = path.join(binDir, 'ffprobe')
if (!fs.existsSync(ffprobeDest)) {
  if (fs.existsSync('/usr/bin/ffprobe')) {
    console.log('[prepare-linux-runtime] Copying system ffprobe...')
    try {
      fs.copyFileSync('/usr/bin/ffprobe', ffprobeDest)
      fs.chmodSync(ffprobeDest, 0o755)
    } catch (e) {
      console.warn(`[prepare-linux-runtime] Could not copy ffprobe: ${e.message}`)
    }
  }
}

// 2. Optional custom prebuilt tarball from environment variable
if (process.env.RUNTIME_ASSETS_TAR_URL) {
  console.log(`[prepare-linux-runtime] Fetching prebuilt bundle from ${process.env.RUNTIME_ASSETS_TAR_URL}...`)
  try {
    const tmpArchive = path.join(targetRuntimeDir, 'runtime-assets.tar.gz')
    run(`curl -fsSL "${process.env.RUNTIME_ASSETS_TAR_URL}" -o "${tmpArchive}"`)
    run(`tar -xzf "${tmpArchive}" -C "${targetRuntimeDir}"`)
    fs.rmSync(tmpArchive, { force: true })
    console.log('[prepare-linux-runtime] Successfully extracted prebuilt runtime bundle.')
    process.exit(0)
  } catch (error) {
    console.warn(`[prepare-linux-runtime] Failed to download prebuilt bundle: ${error.message}. Falling back to component preparation.`)
  }
}

// 3. Standalone Node.js 22 LTS + playwright-core
const nodeExe = path.join(nodeDir, 'bin', 'node')
if (!fs.existsSync(nodeExe)) {
  console.log(`[prepare-linux-runtime] Downloading Node.js 22 LTS for linux-${targetArch}...`)
  const nodeArch = targetArch === 'arm64' ? 'arm64' : 'x64'
  const nodeUrl = `https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-${nodeArch}.tar.xz`
  const tmpNodeArchive = path.join(targetRuntimeDir, 'node-dist.tar.xz')

  try {
    run(`curl -fsSL "${nodeUrl}" -o "${tmpNodeArchive}"`)
    run(`tar -xJf "${tmpNodeArchive}" -C "${nodeDir}" --strip-components=1`)
    fs.rmSync(tmpNodeArchive, { force: true })
    if (fs.existsSync(nodeExe)) {
      fs.chmodSync(nodeExe, 0o755)
      console.log('[prepare-linux-runtime] Node.js 22 extracted successfully.')
      console.log('[prepare-linux-runtime] Installing full offline Node.js toolchain (playwright, xlsx, tsx, cheerio, axios, pdf-parse, adm-zip, glob, ws, chrome-remote-interface)...')
      const nodePackages = [
        'playwright-core',
        'xlsx',
        'tsx',
        'cheerio',
        'axios',
        'pdf-parse',
        'adm-zip',
        'glob',
        'ws',
        'chrome-remote-interface',
      ]
      run(`"${nodeExe}" "${path.join(nodeDir, 'bin', 'npm')}" install ${nodePackages.join(' ')} --prefix "${nodeDir}" --no-audit --no-fund`)
    }
  } catch (err) {
    console.error(`[prepare-linux-runtime] Failed to install Node.js: ${err.message}`)
  }
}

// 4. Standalone CPython 3.12 + full scientific, data, ML, office & multimedia toolset
const pyExe = path.join(pythonDir, 'bin', 'python3')
if (!fs.existsSync(pyExe)) {
  console.log(`[prepare-linux-runtime] Downloading portable CPython 3.12 for linux-${targetArch}...`)
  const pyArch = targetArch === 'arm64' ? 'aarch64' : 'x86_64'
  const pyUrl = `https://github.com/astral-sh/python-build-standalone/releases/download/20241016/cpython-3.12.7+20241016-${pyArch}-unknown-linux-gnu-install_only.tar.gz`
  const tmpPyArchive = path.join(targetRuntimeDir, 'cpython.tar.gz')

  try {
    run(`curl -fsSL "${pyUrl}" -o "${tmpPyArchive}"`)
    run(`tar -xzf "${tmpPyArchive}" -C "${pythonDir}" --strip-components=1`)
    fs.rmSync(tmpPyArchive, { force: true })
    if (fs.existsSync(pyExe)) {
      fs.chmodSync(pyExe, 0o755)
      console.log('[prepare-linux-runtime] CPython 3.12 extracted successfully.')
      console.log('[prepare-linux-runtime] Installing full scientific, ML, office & multimedia suite into portable Python...')
      const pyPackages = [
        'numpy',
        'scipy',
        'pandas',
        'matplotlib',
        'seaborn',
        'scikit-learn',
        'statsmodels',
        'openpyxl',
        'xlsxwriter',
        'python-docx',
        'python-pptx',
        'pypdf',
        'pdfplumber',
        'reportlab',
        'pillow',
        'qrcode',
        'imageio',
        'pefile',
        'pycryptodome',
        'requests',
        'beautifulsoup4',
        'lxml',
        'pyyaml',
        'tqdm',
      ]
      run(`"${pyExe}" -m pip install ${pyPackages.join(' ')} --no-warn-script-location`)
    }
  } catch (err) {
    console.error(`[prepare-linux-runtime] Failed to install Python packages: ${err.message}`)
  }
}

// 5. Standalone Chromium (Playwright Browser Engine)
const browserCandidates = [
  path.join(browserDir, 'chrome'),
  path.join(browserDir, 'chromium'),
  path.join(browserDir, 'chrome-linux', 'chrome'),
]
const hasBrowser = browserCandidates.some((c) => fs.existsSync(c))

if (!hasBrowser) {
  console.log(`[prepare-linux-runtime] Installing standalone Chromium via playwright-core for linux-${targetArch}...`)
  try {
    run(`npx playwright-core install chromium`, {
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: browserDir,
      },
    })

    function findChrome(dir) {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name)
        if (item.isDirectory()) {
          const found = findChrome(full)
          if (found) return found
        } else if (item.isFile() && item.name === 'chrome') {
          return full
        }
      }
      return null
    }

    const chromeBin = findChrome(browserDir)
    if (chromeBin) {
      console.log(`[prepare-linux-runtime] Found Chromium executable at: ${chromeBin}`)
      const chromeDir = path.dirname(chromeBin)
      const targetChromeLink = path.join(browserDir, 'chrome')
      if (!fs.existsSync(targetChromeLink)) {
        try {
          fs.symlinkSync(chromeBin, targetChromeLink)
        } catch {
          fs.copyFileSync(chromeBin, targetChromeLink)
        }
      }
      const targetChromeLinuxDir = path.join(browserDir, 'chrome-linux')
      if (!fs.existsSync(targetChromeLinuxDir) && chromeDir !== browserDir) {
        try {
          fs.symlinkSync(chromeDir, targetChromeLinuxDir, 'dir')
        } catch {}
      }
    }
  } catch (err) {
    console.warn(`[prepare-linux-runtime] Failed to download Chromium via Playwright: ${err.message}`)
  }
}

console.log('[prepare-linux-runtime] Offline workstation runtime assets setup completed successfully!')
