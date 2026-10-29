import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'

let isDebugInitialized = false
let debugLogFilePath: string | null = null
let fallbackLogPaths: string[] = []

/**
 * 校验给定目录是否真实存在且具备写入权限
 */
export function isDirectoryWritable(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      return false
    }
    const stat = fs.statSync(dirPath)
    if (!stat.isDirectory()) {
      return false
    }
    fs.accessSync(dirPath, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

/**
 * 确保目录存在并检查是否可写
 */
export function ensureDirWritable(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    return isDirectoryWritable(dirPath)
  } catch {
    return false
  }
}

/**
 * 判断是否开启 Debug 日志记录模式：
 * 1. 命令行参数包含 --debug / -d / --enable-logging / --verbose
 * 2. 环境变量 CHATBOX_DEBUG 或 DEBUG 为 1/true/chatbox
 * 3. AppImage 宿主目录存在 debug.enabled / debug.flag / debug.log
 * 4. 当前工作目录存在 debug.enabled / debug.flag / debug.log
 * 5. 应用程序安装目录（与 exe/binary 同级）存在 debug.enabled / debug.flag / debug.log
 * 6. resources 目录下存在 debug.enabled
 * 7. userData 目录下存在 debug.enabled
 */
export function isDebugMode(): boolean {
  if (process.argv.some((arg) => ['--debug', '-d', '--enable-logging', '--verbose'].includes(arg))) {
    return true
  }

  const chatboxDebug = (process.env.CHATBOX_DEBUG || '').trim().toLowerCase()
  if (chatboxDebug === '1' || chatboxDebug === 'true') {
    return true
  }

  const debugEnv = (process.env.DEBUG || '').trim().toLowerCase()
  if (debugEnv === '1' || debugEnv === 'true' || debugEnv === 'chatbox' || debugEnv.startsWith('chatbox:')) {
    return true
  }

  const checkFlagFiles = (dir: string): boolean => {
    try {
      return (
        fs.existsSync(path.join(dir, 'debug.enabled')) ||
        fs.existsSync(path.join(dir, 'debug.flag')) ||
        fs.existsSync(path.join(dir, 'debug.log'))
      )
    } catch {
      return false
    }
  }

  // 1. AppImage 宿主文件所在目录
  if (process.env.APPIMAGE) {
    try {
      const appImageDir = path.dirname(process.env.APPIMAGE)
      if (checkFlagFiles(appImageDir)) return true
    } catch {}
  }

  // 2. 当前工作目录（用户在终端启动时的路径）
  try {
    const cwd = process.cwd()
    if (cwd && checkFlagFiles(cwd)) return true
  } catch {}

  // 3. 安装目录（与可执行文件同级）
  try {
    const installDir = path.dirname(process.execPath)
    if (checkFlagFiles(installDir)) return true
  } catch {}

  // 4. resources 目录
  try {
    if (typeof process.resourcesPath === 'string') {
      if (fs.existsSync(path.join(process.resourcesPath, 'debug.enabled'))) {
        return true
      }
    }
  } catch {}

  // 5. 用户数据目录 (userData)
  try {
    const userDataPath = app.getPath('userData')
    if (userDataPath && fs.existsSync(path.join(userDataPath, 'debug.enabled'))) {
      return true
    }
  } catch {}

  return false
}

function formatTimestamp(): string {
  const now = new Date()
  const Y = now.getFullYear()
  const M = String(now.getMonth() + 1).padStart(2, '0')
  const D = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `${Y}-${M}-${D} ${h}:${m}:${s}.${ms}`
}

/**
 * 智能解析可写入的目标日志路径列表
 * 优先级：
 * 1. AppImage 宿主目录（Linux AppImage 独立运行场景，用户最直观看到的目录）
 * 2. 应用程序安装目录（如 Windows 便携版或普通可写目录，自动排除 Linux 只读 SquashFS 挂载点）
 * 3. 当前终端工作目录（终端调试运行时直接在当前终端目录生成 debug.log）
 * 4. 用户数据目录（如 ~/.config/Chatbox/debug.log 或 %APPDATA%\Chatbox\debug.log）
 * 5. 系统临时目录（/tmp/chatbox-debug.log）
 */
export function resolveLogPaths(): { primary: string; fallbacks: string[] } {
  const candidates: string[] = []

  // 1. AppImage 宿主目录
  if (process.env.APPIMAGE) {
    try {
      const appImageDir = path.dirname(process.env.APPIMAGE)
      if (isDirectoryWritable(appImageDir)) {
        candidates.push(path.join(appImageDir, 'debug.log'))
      }
    } catch {}
  }

  // 2. 应用程序安装目录（检查可写性，排除只读 SquashFS 或 /opt 等 root 目录）
  try {
    const installDir = path.dirname(process.execPath)
    if (isDirectoryWritable(installDir)) {
      const p = path.join(installDir, 'debug.log')
      if (!candidates.includes(p)) {
        candidates.push(p)
      }
    }
  } catch {}

  // 3. 当前终端工作目录
  try {
    const cwd = process.cwd()
    if (cwd && cwd !== '/' && isDirectoryWritable(cwd)) {
      const p = path.join(cwd, 'debug.log')
      if (!candidates.includes(p)) {
        candidates.push(p)
      }
    }
  } catch {}

  // 4. 用户数据目录
  try {
    const userDataPath = app.getPath('userData')
    if (userDataPath && ensureDirWritable(userDataPath)) {
      const p = path.join(userDataPath, 'debug.log')
      if (!candidates.includes(p)) {
        candidates.push(p)
      }
    }
  } catch {}

  // 5. 系统临时目录兜底
  try {
    const tmpDir = os.tmpdir()
    if (ensureDirWritable(tmpDir)) {
      const p = path.join(tmpDir, 'chatbox-debug.log')
      if (!candidates.includes(p)) {
        candidates.push(p)
      }
    }
  } catch {}

  const defaultTmp = path.join(os.tmpdir(), 'chatbox-debug.log')
  const primary = candidates[0] || defaultTmp
  const fallbacks = candidates.slice(1)
  if (!candidates.includes(defaultTmp) && primary !== defaultTmp) {
    fallbacks.push(defaultTmp)
  }

  return { primary, fallbacks }
}

function appendToFile(filePath: string, text: string): boolean {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.appendFileSync(filePath, text, 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * 实时同步将日志行追加写入 debug.log，并在不可写时自动故障降级
 */
export function writeDebugLine(level: string, message: string, options?: { skipConsole?: boolean }): void {
  const line = `[${formatTimestamp()}] [${level.toUpperCase()}] ${message}\n`

  // 1. 若非测试环境且未要求跳过控制台，输出到 stderr 以供终端用户直接观察
  if (!options?.skipConsole && process.env.NODE_ENV !== 'test') {
    try {
      process.stderr.write(line)
    } catch {}
  }

  // 2. 写入主日志文件
  if (debugLogFilePath && appendToFile(debugLogFilePath, line)) {
    return
  }

  // 3. 遭遇不可写/只读错误（如 EROFS/EACCES/EPERM/ENOENT），按顺序降级写入后备路径
  for (const fallback of fallbackLogPaths) {
    if (appendToFile(fallback, line)) {
      debugLogFilePath = fallback
      return
    }
  }
}

/**
 * 初始化调试日志系统
 * 在应用启动最早期调用
 */
export function initDebugLogger(): void {
  if (isDebugInitialized) return
  if (!isDebugMode()) return

  isDebugInitialized = true

  const { primary, fallbacks } = resolveLogPaths()
  debugLogFilePath = primary
  fallbackLogPaths = fallbacks

  const installDir = path.dirname(process.execPath)

  // 写入启动诊断横幅
  const banner = [
    '================================================================================',
    `Chatbox Debug Log Started at ${formatTimestamp()}`,
    `App Version:     ${app.isPackaged ? app.getVersion() : 'Development'}`,
    `Platform:        ${process.platform} (${os.arch()})`,
    `OS Release:      ${os.release()} (${os.type()})`,
    `Executable:      ${process.execPath}`,
    `Install Dir:     ${installDir}`,
    `AppImage Host:   ${process.env.APPIMAGE || 'N/A'}`,
    `CWD:             ${process.cwd()}`,
    `Log Target:      ${debugLogFilePath}`,
    `Fallbacks:       ${fallbackLogPaths.join('; ') || 'None'}`,
    `Node Version:    ${process.versions.node}`,
    `Electron:        ${process.versions.electron}`,
    `Chrome:          ${process.versions.chrome}`,
    `Command Line:    ${process.argv.join(' ')}`,
    '================================================================================',
  ].join('\n')

  let written = appendToFile(debugLogFilePath, `${banner}\n`)
  if (!written) {
    for (const fallback of fallbackLogPaths) {
      if (
        appendToFile(
          fallback,
          `${banner}\n[WARN] Failed to write to primary path (${debugLogFilePath}), fell back here.\n`
        )
      ) {
        debugLogFilePath = fallback
        written = true
        break
      }
    }
  }

  // Linux 平台额外支持：如果主日志不在 /tmp/chatbox-debug.log，建立便捷软链接方便排查
  if (process.platform === 'linux' && debugLogFilePath && debugLogFilePath !== '/tmp/chatbox-debug.log') {
    try {
      if (fs.existsSync('/tmp/chatbox-debug.log')) {
        fs.unlinkSync('/tmp/chatbox-debug.log')
      }
      fs.symlinkSync(debugLogFilePath, '/tmp/chatbox-debug.log')
    } catch {}
  }

  // 终端启动友好提示
  if (process.env.NODE_ENV !== 'test') {
    try {
      // biome-ignore lint/suspicious/noConsole: intentional user-facing diagnostic notice on CLI startup
      console.log(`[Chatbox Debug] Verbose logging enabled. Diagnostic output -> ${debugLogFilePath}`)
    } catch {}
  }

  // 1. 挂钩 electron-log，截获所有 getLogger 的日志输出
  try {
    log.hooks.push((message, transport) => {
      // 避免重复写入（针对不同 transport 只处理一次）
      if (transport === log.transports.console) {
        const text = message.data
          .map((item) => {
            if (!item) return String(item)
            if (item instanceof Error || (typeof item === 'object' && ('message' in item || 'stack' in item))) {
              const errObj = item as { stack?: string; message?: string }
              return errObj.stack || errObj.message || String(item)
            }
            if (typeof item === 'object') {
              try {
                const s = JSON.stringify(item, null, 2)
                return s === '{}' ? String(item) : s
              } catch {
                return String(item)
              }
            }
            return String(item)
          })
          .join(' ')
        // 来自 console transport 的日志无需再次重复输出到 stderr
        writeDebugLine(message.level || 'INFO', text, { skipConsole: true })
      }
      return message
    })
  } catch {
    // 忽略 electron-log hook 异常
  }

  // 2. 捕获未处理的全局异常和 Promise 拒绝
  process.on('uncaughtException', (error, origin) => {
    writeDebugLine('FATAL', `[uncaughtException] (${origin}) ${error?.stack || error}`)
  })

  process.on('unhandledRejection', (reason) => {
    const detail = reason instanceof Error ? reason.stack || reason.message : String(reason)
    writeDebugLine('ERROR', `[unhandledRejection] ${detail}`)
  })

  // 3. 捕获 Chromium 子进程或渲染进程异常崩溃
  app.on('render-process-gone', (_event, webContents, details) => {
    writeDebugLine(
      'FATAL',
      `[render-process-gone] id=${webContents?.id}, reason=${details.reason}, exitCode=${details.exitCode}`
    )
  })

  app.on('child-process-gone', (_event, details) => {
    writeDebugLine(
      'ERROR',
      `[child-process-gone] type=${details.type}, name=${details.name}, reason=${details.reason}, exitCode=${details.exitCode}`
    )
  })

  // 4. 捕获所有渲染窗口的前端 Console 控制台报错与日志
  app.on('web-contents-created', (_event, contents) => {
    contents.on('console-message', (_event, level, message, line, sourceId) => {
      const levelMap: Record<number, string> = {
        0: 'VERBOSE',
        1: 'INFO',
        2: 'WARN',
        3: 'ERROR',
      }
      const levelName = levelMap[level] || 'INFO'
      writeDebugLine(levelName, `[Renderer] ${message} (${sourceId || 'inline'}:${line})`)
    })
  })

  writeDebugLine('INFO', '[DebugLogger] Debug logger initialized successfully')
}

/**
 * 供单元测试获取当前日志文件目标路径
 */
export function getDebugLogFilePath(): string | null {
  return debugLogFilePath
}

/**
 * 供单元测试重置内部状态
 */
export function resetDebugLoggerForTest(): void {
  isDebugInitialized = false
  debugLogFilePath = null
  fallbackLogPaths = []
}
