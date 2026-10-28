import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface RuntimePaths {
  pythonDir?: string
  pythonExe?: string
  pythonScriptsDir?: string
  pythonLibDir?: string
  nodeDir?: string
  nodeExe?: string
  nodeBinDir?: string
  nodeModulesDir?: string
  browserExe?: string
  binDir?: string
  gitDir?: string
  gitExe?: string
  userPythonSitePackages?: string
  userNodeModules?: string
}

let cachedRuntimePaths: RuntimePaths | null = null

export function clearRuntimePathsCache(): void {
  cachedRuntimePaths = null
}

/**
 * 获取内置运行时的绝对路径（兼容 Windows、Linux 与国产操作系统桌面环境）
 */
export function getRuntimePaths(): RuntimePaths {
  if (cachedRuntimePaths) return cachedRuntimePaths

  const isWindows = process.platform === 'win32'
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
    candidates.push(path.resolve(__dirname, '..', '..', 'runtime-assets'))
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
    // 1. Python 路径解析 (优先内置绿色包，支持 Windows 与 Linux 独立便携版)
    const pyDir = path.join(runtimeBase, 'python')
    if (fs.existsSync(pyDir)) {
      result.pythonDir = pyDir
      if (isWindows) {
        const pyExe = path.join(pyDir, 'python.exe')
        if (fs.existsSync(pyExe)) result.pythonExe = pyExe
        const scriptsDir = path.join(pyDir, 'Scripts')
        if (fs.existsSync(scriptsDir)) result.pythonScriptsDir = scriptsDir
      } else {
        const linuxPyCandidates = [
          path.join(pyDir, 'bin', 'python3'),
          path.join(pyDir, 'bin', 'python'),
          path.join(pyDir, 'python3'),
          path.join(pyDir, 'python'),
        ]
        for (const pyCandidate of linuxPyCandidates) {
          if (fs.existsSync(pyCandidate)) {
            result.pythonExe = pyCandidate
            result.pythonScriptsDir = path.dirname(pyCandidate)
            break
          }
        }
        const linuxLibDir = path.join(pyDir, 'lib')
        if (fs.existsSync(linuxLibDir)) {
          result.pythonLibDir = linuxLibDir
        }
      }
    }

    // 2. Node.js 路径解析 (优先内置便携版)
    const nodeDir = path.join(runtimeBase, 'node')
    if (fs.existsSync(nodeDir)) {
      result.nodeDir = nodeDir
      if (isWindows) {
        const nodeExe = path.join(nodeDir, 'node.exe')
        if (fs.existsSync(nodeExe)) result.nodeExe = nodeExe
        const nodeModules = path.join(nodeDir, 'node_modules')
        if (fs.existsSync(nodeModules)) result.nodeModulesDir = nodeModules
        const nodeBin = path.join(nodeModules, '.bin')
        if (fs.existsSync(nodeBin)) result.nodeBinDir = nodeBin
      } else {
        const linuxNodeCandidates = [
          path.join(nodeDir, 'bin', 'node'),
          path.join(nodeDir, 'node'),
        ]
        for (const nodeCandidate of linuxNodeCandidates) {
          if (fs.existsSync(nodeCandidate)) {
            result.nodeExe = nodeCandidate
            result.nodeBinDir = path.dirname(nodeCandidate)
            break
          }
        }
        const linuxNodeModulesCandidates = [
          path.join(nodeDir, 'lib', 'node_modules'),
          path.join(nodeDir, 'node_modules'),
        ]
        for (const nmCandidate of linuxNodeModulesCandidates) {
          if (fs.existsSync(nmCandidate)) {
            result.nodeModulesDir = nmCandidate
            break
          }
        }
      }
    }

    // 3. Chromium 90 自动化浏览器路径 (无头截图与 Playwright)
    const browserDir = path.join(runtimeBase, 'browser')
    if (fs.existsSync(browserDir)) {
      const browserCandidates = isWindows
        ? [path.join(browserDir, 'chrome.exe'), path.join(browserDir, 'chromium.exe')]
        : [
            path.join(browserDir, 'chrome'),
            path.join(browserDir, 'chromium'),
            path.join(browserDir, 'chrome-linux', 'chrome'),
          ]
      for (const bCandidate of browserCandidates) {
        if (fs.existsSync(bCandidate)) {
          result.browserExe = bCandidate
          break
        }
      }
    }

    // 4. Bin 路径 (ffmpeg 等辅助二进制)
    const binDir = path.join(runtimeBase, 'bin')
    if (fs.existsSync(binDir)) {
      result.binDir = binDir
    }

    // 5. Git 路径解析
    const gitDir = path.join(runtimeBase, 'git')
    if (fs.existsSync(gitDir)) {
      result.gitDir = gitDir
      if (isWindows) {
        const gitExe = path.join(gitDir, 'cmd', 'git.exe')
        if (fs.existsSync(gitExe)) result.gitExe = gitExe
      } else {
        const linuxGitCandidates = [
          path.join(gitDir, 'bin', 'git'),
          path.join(gitDir, 'git'),
        ]
        for (const gitCandidate of linuxGitCandidates) {
          if (fs.existsSync(gitCandidate)) {
            result.gitExe = gitCandidate
            break
          }
        }
      }
    }
  }

  // 兜底回退：若未配置内置组件，在 Linux 下检测系统级命令
  if (!isWindows) {
    if (!result.pythonExe) {
      const sysPyCandidates = ['/usr/bin/python3', '/usr/local/bin/python3', '/usr/bin/python']
      for (const sysPy of sysPyCandidates) {
        if (fs.existsSync(sysPy)) {
          result.pythonExe = sysPy
          break
        }
      }
    }

    if (!result.nodeExe) {
      const sysNodeCandidates = ['/usr/bin/node', '/usr/local/bin/node']
      for (const sysNode of sysNodeCandidates) {
        if (fs.existsSync(sysNode)) {
          result.nodeExe = sysNode
          break
        }
      }
    }

    if (!result.browserExe) {
      const sysBrowserCandidates = [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/kylin-browser',
      ]
      for (const sysB of sysBrowserCandidates) {
        if (fs.existsSync(sysB)) {
          result.browserExe = sysB
          break
        }
      }
    }

    if (!result.gitExe) {
      const sysGitCandidates = ['/usr/bin/git', '/usr/local/bin/git']
      for (const sysGit of sysGitCandidates) {
        if (fs.existsSync(sysGit)) {
          result.gitExe = sysGit
          break
        }
      }
    }
  }

  // 用户数据目录读写区（用于智能体自扩充环境）
  try {
    let userData = ''
    if (app?.getPath) {
      userData = app.getPath('userData')
    } else if (isWindows) {
      userData = path.join(process.env.APPDATA || '', 'Chatbox')
    } else {
      userData = path.join(process.env.HOME || '', '.config', 'Chatbox')
    }
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
  const isWindows = process.platform === 'win32'
  const pathSeparator = isWindows ? ';' : ':'
  const prependPathList: string[] = []

  // 1. 注入 Python
  if (paths.pythonScriptsDir && fs.existsSync(paths.pythonScriptsDir)) {
    prependPathList.push(paths.pythonScriptsDir)
  }
  if (paths.pythonDir) {
    prependPathList.push(paths.pythonDir)
  }

  // 2. 注入 Node.js
  if (paths.nodeBinDir && fs.existsSync(paths.nodeBinDir)) {
    prependPathList.push(paths.nodeBinDir)
  }
  if (paths.nodeDir) {
    prependPathList.push(paths.nodeDir)
  }

  // 3. 注入 Chromium 90 (Playwright / Puppeteer 专用无头浏览器)
  if (paths.browserExe) {
    const browserDir = path.dirname(paths.browserExe)
    prependPathList.push(browserDir)
    env.CHROME_PATH = paths.browserExe
    env.BROWSER_EXECUTABLE_PATH = paths.browserExe
    env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = paths.browserExe
    env.PUPPETEER_EXECUTABLE_PATH = paths.browserExe
  }

  // 4. 注入 Bin
  if (paths.binDir) {
    prependPathList.push(paths.binDir)
  }

  // 5. 注入 Git
  if (paths.gitDir) {
    if (isWindows) {
      const gitCmdDir = path.join(paths.gitDir, 'cmd')
      prependPathList.push(gitCmdDir)
      const gitBinDir = path.join(paths.gitDir, 'mingw64', 'bin')
      if (fs.existsSync(gitBinDir)) prependPathList.push(gitBinDir)
    } else {
      const gitBinDir = path.join(paths.gitDir, 'bin')
      if (fs.existsSync(gitBinDir)) {
        prependPathList.push(gitBinDir)
      } else {
        prependPathList.push(paths.gitDir)
      }
    }
  }

  // 合并 PATH
  if (prependPathList.length > 0) {
    const currentPath = env.PATH || env.Path || ''
    const newPath = [...prependPathList, currentPath].filter(Boolean).join(pathSeparator)
    env.PATH = newPath
    env.Path = newPath
  }

  // 注入 LD_LIBRARY_PATH (Linux 下便携 Python/C 运行库共享对象)
  if (!isWindows && paths.pythonLibDir && fs.existsSync(paths.pythonLibDir)) {
    const currentLdPath = env.LD_LIBRARY_PATH || ''
    env.LD_LIBRARY_PATH = [paths.pythonLibDir, currentLdPath].filter(Boolean).join(':')
  }

  // 注入 PYTHONPATH (优先加载用户读写区，再加载内置预置区)
  const pythonPathEntries: string[] = []
  if (paths.userPythonSitePackages) {
    pythonPathEntries.push(paths.userPythonSitePackages)
  }
  if (paths.pythonDir) {
    const sitePackageCandidates = [
      path.join(paths.pythonDir, 'Lib', 'site-packages'),
      path.join(paths.pythonDir, 'lib', 'site-packages'),
    ]
    const libDir = path.join(paths.pythonDir, 'lib')
    if (fs.existsSync(libDir)) {
      try {
        const subdirs = fs.readdirSync(libDir)
        for (const sub of subdirs) {
          if (sub.startsWith('python')) {
            sitePackageCandidates.push(path.join(libDir, sub, 'site-packages'))
          }
        }
      } catch {}
    }

    for (const sp of sitePackageCandidates) {
      if (fs.existsSync(sp)) {
        pythonPathEntries.push(sp)
      }
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
