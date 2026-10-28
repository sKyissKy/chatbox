import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'

let isDebugInitialized = false
let debugLogFilePath: string | null = null
let fallbackLogFilePath: string | null = null

/**
 * 判断是否开启 Debug 日志记录模式：
 * 1. 命令行参数包含 --debug / -d / --enable-logging
 * 2. 环境变量 CHATBOX_DEBUG=1 或 CHATBOX_DEBUG=true
 * 3. 应用程序安装目录（与 exe 同级）存在 debug.enabled / debug.flag / debug.log
 * 4. resources 目录下存在 debug.enabled
 */
export function isDebugMode(): boolean {
  if (process.argv.some((arg) => ['--debug', '-d', '--enable-logging'].includes(arg))) {
    return true
  }
  if (process.env.CHATBOX_DEBUG === '1' || process.env.CHATBOX_DEBUG === 'true') {
    return true
  }

  try {
    const installDir = path.dirname(process.execPath)
    if (
      fs.existsSync(path.join(installDir, 'debug.enabled')) ||
      fs.existsSync(path.join(installDir, 'debug.flag')) ||
      fs.existsSync(path.join(installDir, 'debug.log'))
    ) {
      return true
    }
  } catch {
    // 忽略路径检测异常
  }

  try {
    if (typeof process.resourcesPath === 'string') {
      if (fs.existsSync(path.join(process.resourcesPath, 'debug.enabled'))) {
        return true
      }
    }
  } catch {
    // 忽略路径检测异常
  }

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
 * 实时同步将日志行追加写入 debug.log
 */
export function writeDebugLine(level: string, message: string): void {
  if (!debugLogFilePath) return
  const line = `[${formatTimestamp()}] [${level.toUpperCase()}] ${message}\n`

  try {
    fs.appendFileSync(debugLogFilePath, line, 'utf8')
  } catch (err: any) {
    // 若在 Program Files 目录下遭遇只读权限错误，自动降级并写入 userData 目录
    if (fallbackLogFilePath && (err.code === 'EACCES' || err.code === 'EPERM')) {
      try {
        fs.appendFileSync(fallbackLogFilePath, line, 'utf8')
      } catch {
        // 忽略二次异常
      }
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

  const installDir = path.dirname(process.execPath)
  debugLogFilePath = path.join(installDir, 'debug.log')

  try {
    const userDataPath = app.getPath('userData')
    fallbackLogFilePath = path.join(userDataPath, 'debug.log')
  } catch {
    fallbackLogFilePath = path.join(os.tmpdir(), 'chatbox-debug.log')
  }

  // 写入启动诊断横幅
  const banner = [
    '================================================================================',
    `Chatbox Debug Log Started at ${formatTimestamp()}`,
    `App Version:     ${app.isPackaged ? app.getVersion() : 'Development'}`,
    `Platform:        ${process.platform} (${os.arch()})`,
    `OS Release:      ${os.release()} (${os.type()})`,
    `Executable:      ${process.execPath}`,
    `Install Dir:     ${installDir}`,
    `Log Target:      ${debugLogFilePath}`,
    `Node Version:    ${process.versions.node}`,
    `Electron:        ${process.versions.electron}`,
    `Chrome:          ${process.versions.chrome}`,
    `Command Line:    ${process.argv.join(' ')}`,
    '================================================================================',
  ].join('\n')

  try {
    fs.appendFileSync(debugLogFilePath, `${banner}\n`, 'utf8')
  } catch (err: any) {
    if (fallbackLogFilePath) {
      try {
        fs.appendFileSync(fallbackLogFilePath, `${banner}\n[WARN] Failed to write to install dir (${err.code}), using fallback.\n`, 'utf8')
        debugLogFilePath = fallbackLogFilePath
      } catch {
        // 忽略
      }
    }
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
              return (item as any).stack || (item as any).message || String(item)
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
        writeDebugLine(message.level || 'INFO', text)
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
