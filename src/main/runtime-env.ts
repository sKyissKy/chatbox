import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface RuntimePaths {
  pythonDir?: string
  pythonExe?: string
  pythonScriptsDir?: string
  nodeDir?: string
  nodeExe?: string
  nodeModulesDir?: string
  browserExe?: string
  binDir?: string
  gitDir?: string
  gitExe?: string
  userPythonSitePackages?: string
  userNodeModules?: string
}

let cachedRuntimePaths: RuntimePaths | null = null

/**
 * 获取内置运行时的绝对路径（兼顾打包环境与开发/便携环境）
 */
export function getRuntimePaths(): RuntimePaths {
  if (cachedRuntimePaths) return cachedRuntimePaths

  const candidates: string[] = []

  // 1. 打包后的 resources/runtime 目录
  if (typeof process.resourcesPath === 'string') {
    candidates.push(path.join(process.resourcesPath, 'runtime'))
    candidates.push(path.join(process.resourcesPath, '..', 'runtime'))
  }

  // 2. 应用程序安装路径
  try {
    const installDir = path.dirname(process.execPath)
    candidates.push(path.join(installDir, 'resources', 'runtime'))
    candidates.push(path.join(installDir, 'runtime'))
  } catch {}

  // 3. 源码工程目录与相对目录
  candidates.push(path.join(process.cwd(), '..', 'runtime-assets'))
  candidates.push(path.join(process.cwd(), 'work', 'runtime-assets'))
  candidates.push(path.join(process.cwd(), 'runtime-assets'))
  try {
    candidates.push(path.resolve(__dirname, '..', '..', 'work', 'runtime-assets'))
  } catch {}

  let runtimeBase: string | null = null
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      runtimeBase = candidate
      break
    }
  }

  const result: RuntimePaths = {}

  if (runtimeBase) {
    // Python 路径
    const pyDir = path.join(runtimeBase, 'python')
    const pyExe = path.join(pyDir, 'python.exe')
    if (fs.existsSync(pyExe)) {
      result.pythonDir = pyDir
      result.pythonExe = pyExe
      result.pythonScriptsDir = path.join(pyDir, 'Scripts')
    }

    // Node.js 路径
    const nodeDir = path.join(runtimeBase, 'node')
    const nodeExe = path.join(nodeDir, 'node.exe')
    if (fs.existsSync(nodeExe)) {
      result.nodeDir = nodeDir
      result.nodeExe = nodeExe
      result.nodeModulesDir = path.join(nodeDir, 'node_modules')
    }

    // Chromium 90 自动化浏览器路径
    const browserExe = path.join(runtimeBase, 'browser', 'chrome.exe')
    if (fs.existsSync(browserExe)) {
      result.browserExe = browserExe
    }

    // Bin 路径 (ffmpeg, dll)
    const binDir = path.join(runtimeBase, 'bin')
    if (fs.existsSync(binDir)) {
      result.binDir = binDir
    }

    // Git (MinGit portable) 路径
    const gitDir = path.join(runtimeBase, 'git')
    const gitExe = path.join(gitDir, 'cmd', 'git.exe')
    if (fs.existsSync(gitExe)) {
      result.gitDir = gitDir
      result.gitExe = gitExe
    }
  }

  // 用户数据目录读写区（用于智能体自主 pip install / npm install 扩充包）
  try {
    const userData = app?.getPath ? app.getPath('userData') : path.join(process.env.APPDATA || '', 'Chatbox')
    const agentEnv = path.join(userData, 'agent_env')
    result.userPythonSitePackages = path.join(agentEnv, 'python', 'site-packages')
    result.userNodeModules = path.join(agentEnv, 'node', 'node_modules')
  } catch {}

  cachedRuntimePaths = result
  return result
}

/**
 * 将内置运行时透明注入到子进程执行环境变量中
 */
export function augmentRuntimeEnvironment(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const paths = getRuntimePaths()
  const env: NodeJS.ProcessEnv = { ...baseEnv }

  const pathSeparator = process.platform === 'win32' ? ';' : ':'
  const prependPathList: string[] = []

  // 1. 注入 Python
  if (paths.pythonDir) {
    prependPathList.push(paths.pythonDir)
    if (paths.pythonScriptsDir && fs.existsSync(paths.pythonScriptsDir)) {
      prependPathList.push(paths.pythonScriptsDir)
    }
  }

  // 2. 注入 Node.js 与全局命令
  if (paths.nodeDir) {
    prependPathList.push(paths.nodeDir)
    const nodeBin = path.join(paths.nodeDir, 'node_modules', '.bin')
    if (fs.existsSync(nodeBin)) {
      prependPathList.push(nodeBin)
    }
  }

  // 3. 注入 Chromium 90
  if (paths.browserExe) {
    const browserDir = path.dirname(paths.browserExe)
    prependPathList.push(browserDir)
    env.CHROME_PATH = paths.browserExe
    env.BROWSER_EXECUTABLE_PATH = paths.browserExe
    env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = paths.browserExe
    env.PUPPETEER_EXECUTABLE_PATH = paths.browserExe
  }

  // 4. 注入 Bin (ffmpeg)
  if (paths.binDir) {
    prependPathList.push(paths.binDir)
  }

  // 5. 注入 Git (MinGit portable)
  if (paths.gitDir) {
    const gitCmdDir = path.join(paths.gitDir, 'cmd')
    prependPathList.push(gitCmdDir)
    const gitBinDir = path.join(paths.gitDir, 'mingw64', 'bin')
    if (fs.existsSync(gitBinDir)) {
      prependPathList.push(gitBinDir)
    }
  }

  // 合并 PATH
  if (prependPathList.length > 0) {
    const currentPath = env.PATH || env.Path || ''
    const newPath = [...prependPathList, currentPath].filter(Boolean).join(pathSeparator)
    env.PATH = newPath
    env.Path = newPath
  }

  // 注入 PYTHONPATH (优先加载用户读写区，再加载内置预置区)
  const pythonPathEntries: string[] = []
  if (paths.userPythonSitePackages) {
    pythonPathEntries.push(paths.userPythonSitePackages)
  }
  if (paths.pythonDir) {
    const builtinSitePackages = path.join(paths.pythonDir, 'Lib', 'site-packages')
    if (fs.existsSync(builtinSitePackages)) {
      pythonPathEntries.push(builtinSitePackages)
    }
    pythonPathEntries.push(paths.pythonDir)
  }
  if (pythonPathEntries.length > 0) {
    const existingPythonPath = env.PYTHONPATH || ''
    env.PYTHONPATH = [...pythonPathEntries, existingPythonPath].filter(Boolean).join(pathSeparator)
  }

  // 注入 NODE_PATH
  const nodePathEntries: string[] = []
  if (paths.userNodeModules) {
    nodePathEntries.push(paths.userNodeModules)
  }
  if (paths.nodeModulesDir && fs.existsSync(paths.nodeModulesDir)) {
    nodePathEntries.push(paths.nodeModulesDir)
  }
  if (nodePathEntries.length > 0) {
    const existingNodePath = env.NODE_PATH || ''
    env.NODE_PATH = [...nodePathEntries, existingNodePath].filter(Boolean).join(pathSeparator)
  }

  return env
}
