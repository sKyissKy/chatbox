const fs = require('fs')
const path = require('path')

const targetType = process.argv[2] || 'all'
const projectDir = path.resolve(__dirname, '..', '..')
const releaseDir = path.join(projectDir, 'release')

function resolveOutputsDir() {
  if (process.env.CHATBOX_OUTPUTS_DIR) {
    return path.resolve(process.env.CHATBOX_OUTPUTS_DIR)
  }
  const customWorkspaceOutputs = path.resolve(projectDir, '..', '..', 'outputs')
  if (fs.existsSync(customWorkspaceOutputs)) {
    return customWorkspaceOutputs
  }
  return null
}

const optionalExternalOutputsDir = resolveOutputsDir()

function exportAndClean(buildSubdir) {
  const buildDir = path.join(releaseDir, buildSubdir)
  if (!fs.existsSync(buildDir)) return

  fs.mkdirSync(releaseDir, { recursive: true })
  if (optionalExternalOutputsDir) {
    fs.mkdirSync(optionalExternalOutputsDir, { recursive: true })
  }

  const files = fs.readdirSync(buildDir)
  for (const file of files) {
    if (file.endsWith('.exe') || file.endsWith('.blockmap')) {
      const srcPath = path.join(buildDir, file)
      const dstReleasePath = path.join(releaseDir, file)
      console.log(`[export-outputs] saving ${file} -> release/`)
      fs.copyFileSync(srcPath, dstReleasePath)

      // Mirror to external outputs dir if configured or existing
      if (optionalExternalOutputsDir) {
        fs.copyFileSync(srcPath, path.join(optionalExternalOutputsDir, file))
      }
    }
  }

  console.log(`[export-outputs] cleaning up intermediate build dir: ${buildSubdir}...`)
  fs.rmSync(buildDir, { recursive: true, force: true })
  console.log(`[export-outputs] ${buildSubdir} cleaned.`)
}

if (targetType === 'release' || targetType === 'all') {
  exportAndClean('build-win7')
}
if (targetType === 'debug' || targetType === 'all') {
  exportAndClean('build-win7-debug')
}

// Clean up heavy intermediate node_modules
const appNodeModules = path.join(releaseDir, 'app', 'node_modules')
if (fs.existsSync(appNodeModules)) {
  fs.rmSync(appNodeModules, { recursive: true, force: true })
}

// Only remove compiled dist on explicit full clean
if (targetType === 'all' || targetType === 'clean') {
  const appDist = path.join(releaseDir, 'app', 'dist')
  if (fs.existsSync(appDist)) {
    fs.rmSync(appDist, { recursive: true, force: true })
  }
}
console.log('[export-outputs] done.')
