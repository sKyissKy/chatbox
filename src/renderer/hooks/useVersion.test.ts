// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as remote from '../packages/remote'
import platform from '../platform'
import useVersion from './useVersion'

vi.mock('../packages/remote', () => ({
  checkNeedUpdate: vi.fn().mockResolvedValue(false),
}))

vi.mock('../platform', async () => {
  const mod = await import('../platform/test_platform')
  return {
    default: new mod.default(),
  }
})

describe('useVersion offline and win7 behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips remote checkNeedUpdate when autoUpdate is false', async () => {
    vi.spyOn(platform, 'getSettings').mockResolvedValue({ autoUpdate: false } as any)
    vi.spyOn(platform, 'getVersion').mockResolvedValue('1.23.5')
    const { result } = renderHook(() => useVersion())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.version).toBe('1.23.5')
    expect(remote.checkNeedUpdate).not.toHaveBeenCalled()
  })

  it('skips remote checkNeedUpdate when running on Windows 7 userAgent', async () => {
    const originalUserAgent = navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
      configurable: true,
    })

    try {
      vi.spyOn(platform, 'getSettings').mockResolvedValue({ autoUpdate: true } as any)
      vi.spyOn(platform, 'getVersion').mockResolvedValue('1.23.5')
      const { result } = renderHook(() => useVersion())

      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.version).toBe('1.23.5')
      expect(remote.checkNeedUpdate).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      })
    }
  })
})
