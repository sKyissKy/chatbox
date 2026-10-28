const fs = require('fs')
const path = require('path')
const patchLibsql = require('./patch-libsql.cjs')
const runtimeDeps = require('./runtime-deps.cjs')
const copyRipgrep = require('./copy-ripgrep.cjs')

function copyNodeRuntimeModules(context) {
  const resourcesDir = context.packager?.getResourcesDir?.(context.appOutDir) || path.join(context.appOutDir, 'resources')
  const targetDir = path.join(resourcesDir, 'runtime', 'node', 'node_modules')
  const sourceDir = path.resolve(__dirname, '..', '..', '..', 'runtime-assets', 'node', 'node_modules')

  if (fs.existsSync(sourceDir)) {
    if (!fs.existsSync(targetDir)) {
      console.log(`[after-pack] copying offline node_modules from ${sourceDir} to ${targetDir}...`)
      fs.mkdirSync(path.dirname(targetDir), { recursive: true })
      fs.cpSync(sourceDir, targetDir, { recursive: true, dereference: true })
      console.log('[after-pack] offline node_modules successfully copied.')
    } else {
      console.log('[after-pack] offline node_modules already exists in target.')
    }
  }
}

exports.default = async function afterPack(context) {
  await copyRipgrep.default(context)
  try {
    await patchLibsql.default(context)
  } catch (err) {
    console.log('[after-pack] patchLibsql skipped:', err?.message)
  }
  runtimeDeps.ensureUnpackedRuntimeDeps(context)
  await runtimeDeps.default(context)
  copyNodeRuntimeModules(context)
}

