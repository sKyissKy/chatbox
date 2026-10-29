#!/usr/bin/env node

/**
 * Prepares offline runtime assets for Chatbox Linux packaging (x64 / arm64).
 * Ensures that ../runtime-assets/ contains:
 *   - python: Standalone portable CPython 3.12+ with full scientific, ML, data & office packages
 *   - node: Portable Node.js 22 LTS with playwright-core and full toolchain
 *   - browser: Headless Chromium engine
 *   - bin: Static binaries (ripgrep, ffmpeg, ffprobe)
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

function hasPythonPackage(pkgName) {
  const libDir = path.join(pythonDir, 'lib')
  if (!fs.existsSync(libDir)) return false
  try {
    const pyDirs = fs.readdirSync(libDir).filter((d) => d.startsWith('python3.'))
    for (const d of pyDirs) {
      const pkgPath = path.join(libDir, d, 'site-packages', pkgName)
      if (fs.existsSync(pkgPath)) return true
    }
  } catch {}
  return false
}

const nodeExe = path.join(nodeDir, 'bin', 'node')
const pyExe = path.join(pythonDir, 'bin', 'python3')
const wsPkg = path.join(nodeDir, 'node_modules', 'ws')
const rgDest = path.join(binDir, 'rg')
const ffmpegDest = path.join(binDir, 'ffmpeg')
const ffprobeDest = path.join(binDir, 'ffprobe')

const browserCandidates = [
  path.join(browserDir, 'chrome'),
  path.join(browserDir, 'chromium'),
  path.join(browserDir, 'chrome-linux', 'chrome'),
]
const hasBrowser = () => browserCandidates.some((c) => fs.existsSync(c))

if (
  fs.existsSync(nodeExe) &&
  fs.existsSync(wsPkg) &&
  fs.existsSync(pyExe) &&
  hasPythonPackage('scipy') &&
  hasBrowser() &&
  fs.existsSync(rgDest) &&
  fs.existsSync(ffmpegDest)
) {
  console.log('[prepare-linux-runtime] All required runtime assets and packages are already present.')
  process.exit(0)
}

// 1. Static Binaries: ripgrep & ffmpeg
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

if (!fs.existsSync(ffmpegDest)) {
  if (fs.existsSync('/usr/bin/ffmpeg')) {
    console.log('[prepare-linux-runtime] Copying system ffmpeg...')
    try {
      fs.copyFileSync('/usr/bin/ffmpeg', ffmpegDest)
      fs.chmodSync(ffmpegDest, 0o755)
    } catch (e) {
      console.warn(`[prepare-linux-runtime] Could not copy ffmpeg: ${e.message}`)
    }
  } else {
    try {
      console.log('[prepare-linux-runtime] /usr/bin/ffmpeg not found, attempting package install...')
      run('which sudo >/dev/null 2>&1 && sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg')
      if (fs.existsSync('/usr/bin/ffmpeg')) {
        fs.copyFileSync('/usr/bin/ffmpeg', ffmpegDest)
        fs.chmodSync(ffmpegDest, 0o755)
      }
    } catch (e) {
      console.warn(`[prepare-linux-runtime] Could not install system ffmpeg: ${e.message}`)
    }
  }
}

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
    if (fs.existsSync(pyExe) && hasPythonPackage('scipy') && fs.existsSync(nodeExe) && fs.existsSync(wsPkg)) {
      process.exit(0)
    }
  } catch (error) {
    console.warn(`[prepare-linux-runtime] Failed to download prebuilt bundle: ${error.message}. Falling back to component preparation.`)
  }
}

// 3. Standalone Node.js 22 LTS + full offline Node.js toolchain
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
    }
  } catch (err) {
    console.error(`[prepare-linux-runtime] Failed to install Node.js: ${err.message}`)
  }
}

if (fs.existsSync(nodeExe) && !fs.existsSync(wsPkg)) {
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
  try {
    run(`"${nodeExe}" "${path.join(nodeDir, 'bin', 'npm')}" install ${nodePackages.join(' ')} --prefix "${nodeDir}" --no-audit --no-fund`)
  } catch (err) {
    console.error(`[prepare-linux-runtime] Failed to install Node packages: ${err.message}`)
  }
}

// 4. Standalone CPython 3.12 + full scientific, data, ML, office & multimedia toolset
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
    }
  } catch (err) {
    console.error(`[prepare-linux-runtime] Failed to install CPython: ${err.message}`)
  }
}

if (fs.existsSync(pyExe) && !hasPythonPackage('scipy')) {
  console.log('[prepare-linux-runtime] Installing full scientific, ML, office & multimedia suite into portable Python (24 packages)...')
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
  try {
    run(`"${pyExe}" -m pip install ${pyPackages.join(' ')} --no-warn-script-location`)
  } catch (err) {
    console.error(`[prepare-linux-runtime] Failed to install Python packages: ${err.message}`)
  }
}

// 5. Standalone Chromium 90 (Snapshot build 869685 matching Win7)
if (!hasBrowser()) {
  if (targetArch === 'x64') {
    console.log('[prepare-linux-runtime] Downloading Chromium 90 (build 869685) for linux-x64...')
    const chromeUrl = 'https://npmmirror.com/mirrors/chromium-browser-snapshots/Linux_x64/869685/chrome-linux.zip'
    const tmpChromeArchive = path.join(targetRuntimeDir, 'chrome-linux.zip')
    try {
      run(`curl -fsSL "${chromeUrl}" -o "${tmpChromeArchive}"`)
      run(`unzip -q -o "${tmpChromeArchive}" -d "${browserDir}"`)
      fs.rmSync(tmpChromeArchive, { force: true })

      const chromeBin = path.join(browserDir, 'chrome-linux', 'chrome')
      if (fs.existsSync(chromeBin)) {
        fs.chmodSync(chromeBin, 0o755)
        const rootChromeBin = path.join(browserDir, 'chrome')
        if (!fs.existsSync(rootChromeBin)) {
          try {
            fs.symlinkSync(path.join('chrome-linux', 'chrome'), rootChromeBin)
          } catch {
            fs.copyFileSync(chromeBin, rootChromeBin)
            fs.chmodSync(rootChromeBin, 0o755)
          }
        }
        console.log('[prepare-linux-runtime] Chromium 90 extracted and configured successfully.')
      }
    } catch (err) {
      console.error(`[prepare-linux-runtime] Failed to download Chromium 90: ${err.message}`)
    }
  } else {
    // arm64 fallback: use bundled playwright-core cli without npx
    console.log(`[prepare-linux-runtime] Installing standalone Chromium for linux-${targetArch}...`)
    const playwrightCli = path.join(nodeDir, 'node_modules', 'playwright-core', 'cli.js')
    try {
      if (fs.existsSync(playwrightCli) && fs.existsSync(nodeExe)) {
        run(`"${nodeExe}" "${playwrightCli}" install chromium`, {
          env: {
            ...process.env,
            PLAYWRIGHT_BROWSERS_PATH: browserDir,
          },
        })
      } else {
        run(`npx --yes playwright-core install chromium`, {
          env: {
            ...process.env,
            PLAYWRIGHT_BROWSERS_PATH: browserDir,
          },
        })
      }

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
      console.warn(`[prepare-linux-runtime] Failed to download Chromium: ${err.message}`)
    }
  }
}

// Final runtime integrity verification
if (!hasBrowser()) {
  console.error('[prepare-linux-runtime] Fatal: Chromium binary is missing!')
  process.exit(1)
}
if (!hasPythonPackage('scipy')) {
  console.error('[prepare-linux-runtime] Fatal: Python packages (scipy) are missing!')
  process.exit(1)
}
if (!fs.existsSync(wsPkg)) {
  console.error('[prepare-linux-runtime] Fatal: Node packages (ws) are missing!')
  process.exit(1)
}

console.log('[prepare-linux-runtime] Offline workstation runtime assets setup completed successfully!')
