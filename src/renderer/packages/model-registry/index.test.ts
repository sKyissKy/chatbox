import { describe, expect, it, vi } from 'vitest'

const registry = {
  openai: {
    'gpt-4o': {
      modelId: 'gpt-4o',
      type: 'chat' as const,
      capabilities: [],
      contextWindow: 400_000,
      maxOutput: 128_000,
    },
  },
  'github-copilot': {
    'gpt-4o': {
      modelId: 'gpt-4o',
      type: 'chat' as const,
      capabilities: [],
      contextWindow: 128_000,
      maxOutput: 4_096,
    },
  },
}

vi.mock('./fetch', () => ({
  fetchAndUpdateRegistry: vi.fn(),
  forceRefreshRegistry: vi.fn(),
  getRegistry: vi.fn(async () => registry),
  getRegistrySync: vi.fn(() => registry),
  getRegistryVersion: vi.fn(() => 0),
  prefetchModelRegistry: vi.fn(),
  subscribeRegistry: vi.fn(() => () => {}),
}))

describe('provider-aware model-registry lookups', () => {
  it('prefers the selected provider registry when model ids overlap', async () => {
    const { getProviderModelContextWindow, getProviderModelContextWindowSync } = await import('./index')

    expect(getProviderModelContextWindowSync('openai', 'gpt-4o')).toBe(400_000)
    expect(getProviderModelContextWindowSync('github-copilot', 'gpt-4o')).toBe(128_000)
    await expect(getProviderModelContextWindow('github-copilot', 'gpt-4o')).resolves.toBe(128_000)
  })

  it('supports provider-scoped prefix matches for fine-tuned model ids', async () => {
    const { getProviderModelContextWindowSync } = await import('./index')

    expect(getProviderModelContextWindowSync('openai', 'gpt-4o:ft-team')).toBe(400_000)
    expect(getProviderModelContextWindowSync('github-copilot', 'gpt-4o:ft-team')).toBe(128_000)
  })

  it('preserves user customized contextWindow and maxOutput while enriching empty fields', async () => {
    const { enrichModelsFromRegistry } = await import('./index')

    const models = [
      {
        modelId: 'gpt-4o',
        type: 'chat' as const,
        contextWindow: 32_000,
        maxOutput: 2_048,
      },
      {
        modelId: 'gpt-4o',
        type: 'chat' as const,
      },
    ]

    const enriched = enrichModelsFromRegistry(models, 'openai')
    expect(enriched[0].contextWindow).toBe(32_000)
    expect(enriched[0].maxOutput).toBe(2_048)
    expect(enriched[1].contextWindow).toBe(400_000)
    expect(enriched[1].maxOutput).toBe(128_000)
  })
})
