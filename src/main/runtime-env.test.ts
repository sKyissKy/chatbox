import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  augmentRuntimeEnvironment,
  clearRuntimePathsCache,
  getRuntimePaths,
} from './runtime-env'

describe('runtime-env cross-platform manager', () => {
  beforeEach(() => {
    clearRuntimePathsCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    clearRuntimePathsCache()
    vi.restoreAllMocks()
  })

  it('correctly resolves fallback paths on Linux when no bundled runtime exists', () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
      const pathStr = String(p)
      if (pathStr === '/usr/bin/python3') return true
      if (pathStr === '/usr/bin/node') return true
      if (pathStr === '/usr/bin/chromium-browser') return true
      if (pathStr === '/usr/bin/git') return true
      return false
    })

    const paths = getRuntimePaths()
    expect(paths.pythonExe).toBe('/usr/bin/python3')
    expect(paths.nodeExe).toBe('/usr/bin/node')
    expect(paths.browserExe).toBe('/usr/bin/chromium-browser')
    expect(paths.gitExe).toBe('/usr/bin/git')

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
  })

  it('augments environment with PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH and NODE_PATH', () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
      const pathStr = String(p)
      if (pathStr === '/usr/bin/chromium-browser') return true
      return false
    })

    const env = augmentRuntimeEnvironment({ PATH: '/usr/bin' })
    expect(env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH).toBe('/usr/bin/chromium-browser')
    expect(env.CHROME_PATH).toBe('/usr/bin/chromium-browser')
    expect(env.BROWSER_EXECUTABLE_PATH).toBe('/usr/bin/chromium-browser')
    expect(env.PATH).toContain('/usr/bin')

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
  })
})
