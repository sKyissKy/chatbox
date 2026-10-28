const fs = require('fs')
const path = require('path')
const patchLibsql = require('./patch-libsql.cjs')
const runtimeDeps = require('./runtime-deps.cjs')
const copyRipgrep = require('./copy-ripgrep.cjs')

function makeRuntimeExecutables(context) {
  if (context.electronPlatformName !== 'linux') return
  const resourcesDir = context.packager?.getResourcesDir?.(context.appOutDir)
  if (!resourcesDir) return
  const runtimeDir = path.join(resourcesDir, 'runtime')
  if (!fs.existsSync(runtimeDir)) return

  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          const isBinDir = dir.endsWith(`${path.sep}bin`) || dir.endsWith('/bin')
          const isExe =
            isBinDir ||
            entry.name === 'node' ||
            entry.name.startsWith('python') ||
            entry.name.includes('chrome') ||
            entry.name === 'rg' ||
            entry.name === 'ffmpeg'
          if (isExe) {
            try {
              fs.chmodSync(fullPath, 0o755)
            } catch {}
          }
        }
      }
    } catch {}
  }
  walk(runtimeDir)
}

exports.default = async function afterPack(context) {
  await copyRipgrep.default(context)
  await patchLibsql.default(context)
  runtimeDeps.ensureUnpackedRuntimeDeps(context)
  await runtimeDeps.default(context)
  makeRuntimeExecutables(context)
}
