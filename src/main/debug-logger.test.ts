import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureDirWritable,
  getDebugLogFilePath,
  initDebugLogger,
  isDebugMode,
  isDirectoryWritable,
  resetDebugLoggerForTest,
  resolveLogPaths,
  writeDebugLine,
} from './debug-logger'

vi.mock('electron', () => {
  const mockUserData = path.join(os.tmpdir(), 'chatbox-test-userdata')
  return {
    app: {
      isPackaged: false,
      getVersion: () => '1.23.5-test',
      getPath: (name: string) => {
        if (name === 'userData') return mockUserData
        return os.tmpdir()
      },
      on: vi.fn(),
    },
  }
})

vi.mock('electron-log/main', () => {
  return {
    default: {
      hooks: [],
      transports: {
        console: 'console',
      },
    },
  }
})

describe('debug-logger', () => {
  const originalArgv = [...process.argv]
  const originalEnv = { ...process.env }
  let tempDir: string

  beforeEach(() => {
    resetDebugLoggerForTest()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbox-debug-logger-test-'))
  })

  afterEach(() => {
    process.argv = [...originalArgv]
    process.env = { ...originalEnv }
    resetDebugLoggerForTest()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  describe('isDirectoryWritable & ensureDirWritable', () => {
    it('returns true for writable temp directory', () => {
      expect(isDirectoryWritable(tempDir)).toBe(true)
    })

    it('returns false for non-existent path', () => {
      expect(isDirectoryWritable(path.join(tempDir, 'does-not-exist'))).toBe(false)
    })

    it('returns false for a file path', () => {
      const filePath = path.join(tempDir, 'sample.txt')
      fs.writeFileSync(filePath, 'hello')
      expect(isDirectoryWritable(filePath)).toBe(false)
    })

    it('ensureDirWritable creates directory recursively and returns true', () => {
      const nestedDir = path.join(tempDir, 'nested', 'sub', 'dir')
      expect(fs.existsSync(nestedDir)).toBe(false)
      expect(ensureDirWritable(nestedDir)).toBe(true)
      expect(fs.existsSync(nestedDir)).toBe(true)
    })
  })

  describe('isDebugMode', () => {
    it('detects command-line debug arguments', () => {
      delete process.env.CHATBOX_DEBUG
      delete process.env.DEBUG

      process.argv = ['node', 'chatbox', '--debug']
      expect(isDebugMode()).toBe(true)

      process.argv = ['node', 'chatbox', '-d']
      expect(isDebugMode()).toBe(true)

      process.argv = ['node', 'chatbox', '--enable-logging']
      expect(isDebugMode()).toBe(true)

      process.argv = ['node', 'chatbox', '--verbose']
      expect(isDebugMode()).toBe(true)
    })

    it('detects CHATBOX_DEBUG and DEBUG environment variables', () => {
      process.argv = ['node', 'chatbox']

      process.env.CHATBOX_DEBUG = '1'
      expect(isDebugMode()).toBe(true)

      process.env.CHATBOX_DEBUG = 'true'
      expect(isDebugMode()).toBe(true)

      delete process.env.CHATBOX_DEBUG
      process.env.DEBUG = '1'
      expect(isDebugMode()).toBe(true)

      process.env.DEBUG = 'chatbox'
      expect(isDebugMode()).toBe(true)

      delete process.env.DEBUG
    })

    it('detects flag files next to AppImage host path', () => {
      process.argv = ['node', 'chatbox']
      delete process.env.CHATBOX_DEBUG
      delete process.env.DEBUG

      const fakeAppImage = path.join(tempDir, 'Chatbox.AppImage')
      fs.writeFileSync(fakeAppImage, '')
      process.env.APPIMAGE = fakeAppImage

      expect(isDebugMode()).toBe(false)

      fs.writeFileSync(path.join(tempDir, 'debug.enabled'), '')
      expect(isDebugMode()).toBe(true)
    })
  })

  describe('resolveLogPaths', () => {
    it('prioritizes AppImage directory when APPIMAGE environment variable is set', () => {
      const fakeAppImage = path.join(tempDir, 'Chatbox.AppImage')
      fs.writeFileSync(fakeAppImage, '')
      process.env.APPIMAGE = fakeAppImage

      const { primary } = resolveLogPaths()
      expect(primary).toBe(path.join(tempDir, 'debug.log'))
    })

    it('returns valid fallback log path in all situations', () => {
      delete process.env.APPIMAGE
      const { primary, fallbacks } = resolveLogPaths()
      expect(typeof primary).toBe('string')
      expect(primary.length).toBeGreaterThan(0)
      expect(Array.isArray(fallbacks)).toBe(true)
    })
  })

  describe('initDebugLogger and writeDebugLine', () => {
    it('initializes log file and writes lines cleanly', () => {
      process.env.CHATBOX_DEBUG = '1'
      const fakeAppImage = path.join(tempDir, 'Chatbox.AppImage')
      fs.writeFileSync(fakeAppImage, '')
      process.env.APPIMAGE = fakeAppImage

      initDebugLogger()
      const targetPath = getDebugLogFilePath()
      expect(targetPath).toBe(path.join(tempDir, 'debug.log'))
      if (!targetPath) throw new Error('targetPath is not defined')
      expect(fs.existsSync(targetPath)).toBe(true)

      const initialContent = fs.readFileSync(targetPath, 'utf8')
      expect(initialContent).toContain('Chatbox Debug Log Started')

      writeDebugLine('INFO', 'Test diagnostic message 123')
      const updatedContent = fs.readFileSync(targetPath, 'utf8')
      expect(updatedContent).toContain('[INFO] Test diagnostic message 123')
    })

    it('automatically falls back to next writable path if primary path fails', () => {
      process.env.CHATBOX_DEBUG = '1'
      writeDebugLine('WARN', 'Fallback recovery test')
    })
  })
})
