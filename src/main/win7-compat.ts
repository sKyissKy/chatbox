import os from 'node:os'
import v8 from 'node:v8'
import crypto from 'node:crypto'
import { app } from 'electron'
import { getLogger } from './util'

const log = getLogger('win7-compat')

/**
 * 检查当前运行环境是否为 Windows 7 / 8 / 8.1 或老旧 Windows (内核版本 < 10.0)
 */
export function isWindows7(): boolean {
  if (process.platform !== 'win32') return false
  const release = os.release()
  return release.startsWith('6.') || parseFloat(release) < 10.0
}

/**
 * 是否属于 Win7 兼容构建或环境。在本 Win7 专属客户端构建中，默认全面启用纯 WASM 向量数据库和兼容运行策略
 */
export const isWin7Build = true

/**
 * 在主进程启动最早期注入 Node 16 / Electron 22 缺失的现代运行时 API
 */
export function installWin7Polyfills(): void {
  // 1. globalThis.structuredClone Polyfill (Node 17+ 原生支持，Node 16 缺失)
  if (typeof globalThis.structuredClone === 'undefined') {
    globalThis.structuredClone = function <T>(value: T): T {
      if (value === undefined) return undefined as unknown as T
      try {
        return v8.deserialize(v8.serialize(value))
      } catch {
        return JSON.parse(JSON.stringify(value))
      }
    }
    log.info('[Win7Compat] Installed structuredClone polyfill via v8 serializer')
  }

  // 2. Array.prototype.findLast / findLastIndex Polyfill (Node 18+ 原生支持)
  if (!Array.prototype.findLast) {
    Array.prototype.findLast = function <T>(
      predicate: (value: T, index: number, obj: T[]) => boolean,
      thisArg?: unknown
    ): T | undefined {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) {
          return this[i]
        }
      }
      return undefined
    }
  }

  if (!Array.prototype.findLastIndex) {
    Array.prototype.findLastIndex = function <T>(
      predicate: (value: T, index: number, obj: T[]) => boolean,
      thisArg?: unknown
    ): number {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) {
          return i
        }
      }
      return -1
    }
  }

  // 3. globalThis.crypto & randomUUID
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
    const originalCrypto = globalThis.crypto || {}
    globalThis.crypto = {
      ...originalCrypto,
      randomUUID: () => crypto.randomUUID(),
      subtle: (originalCrypto as any).subtle || (crypto as any).webcrypto?.subtle,
      getRandomValues: (array: any) => crypto.getRandomValues(array),
    } as unknown as Crypto
    log.info('[Win7Compat] Installed crypto.randomUUID polyfill')
  }
}

/**
 * 在 app.whenReady 之前配置 Windows 7 平台专属参数，增强老旧系统稳定性
 */
export function applyWin7EarlyChromiumFlags(): void {
  if (!isWin7Build) return

  // 避免 Chromium 在旧显卡驱动（如 Intel HD Graphics 3000/4000）下 GPU 进程反复崩溃导致白屏
  app.commandLine.appendSwitch('disable-gpu-process-crash-limit')
  // 忽略已废弃的 Win7 系统原生沙箱阻碍
  app.commandLine.appendSwitch('no-sandbox')

  log.info('[Win7Compat] Applied Windows 7 early Chromium flags')
}

/**
 * 配置证书容错，解决老旧 Windows 7 根证书库过期（如 Let's Encrypt / ISRG Root X1 证书过期）
 * 导致所有大模型 HTTPS API 无法访问的问题
 */
export function setupWin7CertificateHandling(): void {
  if (!isWin7Build) return

  app.on('certificate-error', (event, _webContents, url, error, _certificate, callback) => {
    // Windows 7 经常出现 CERT_DATE_INVALID 或 CERT_AUTHORITY_INVALID
    // 在老旧系统环境下，为保证大模型服务通讯畅通，对常见 API 请求允许信任连接
    log.warn(`[Win7Compat] Certificate error ${error} for ${url}, granting exception for Win7 compatibility`)
    event.preventDefault()
    callback(true)
  })
}
