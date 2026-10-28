// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as remote from '@/packages/remote'
import useChatboxAIModels from './useChatboxAIModels'

vi.mock('@/packages/remote', () => ({
  getModelManifest: vi.fn(),
  getChatboxAIModelList: vi.fn(),
}))

vi.mock('@/stores/settingsStore', () => ({
  useLanguage: () => 'zh-Hans',
  useProviderSettings: () => ({
    providerSettings: {
      models: [{ modelId: 'fallback-local-model', nickname: 'Local Fallback' }],
    },
    setProviderSettings: vi.fn(),
  }),
  useSettingsStore: (selector: any) => selector({ licenseKey: '' }),
}))

describe('useChatboxAIModels offline fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles offline network failures gracefully without throwing and falls back to local models', async () => {
    vi.mocked(remote.getModelManifest).mockRejectedValue(new Error('Network Error: Failed to fetch'))
    vi.mocked(remote.getChatboxAIModelList).mockRejectedValue(new Error('Network Error: Failed to fetch'))

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useChatboxAIModels(), { wrapper })

    await waitFor(() => {
      expect(result.current.allChatboxAIModels).toHaveLength(1)
      expect(result.current.allChatboxAIModels[0].modelId).toBe('fallback-local-model')
    })
  })
})
