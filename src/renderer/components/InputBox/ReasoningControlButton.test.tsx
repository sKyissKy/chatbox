// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import { TestId } from '@shared/automation/testids'
import { ModelProviderEnum, type ProviderModelInfo, type ProviderOptions } from '@shared/types'
import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import ReasoningControlButton from './ReasoningControlButton'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(
    (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })
  ),
})

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (key: string, values?: { level?: string }) => (values?.level ? key.replace('{{level}}', values.level) : key),
  }),
}))

const model: ProviderModelInfo = { modelId: 'gpt-5.1' }

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <TooltipProvider>
      <MantineProvider>{ui}</MantineProvider>
    </TooltipProvider>
  )
}

function renderButton(reasoningEffort: 'low' | 'medium' | 'high' = 'high') {
  const providerOptions: ProviderOptions = { openai: { reasoningEffort } }
  return renderWithProviders(
    <ReasoningControlButton
      provider={ModelProviderEnum.OpenAIResponses}
      model={model}
      providerOptions={providerOptions}
      iconSize={22}
      onChange={vi.fn()}
    />
  )
}

describe('ReasoningControlButton', () => {
  test('shows Astra thinking controls and lets the user choose high effort', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <ReasoningControlButton
        provider={ModelProviderEnum.OpenAIResponses}
        model={{ modelId: 'gpt-6-astra' }}
        iconSize={22}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Thinking: Default' }))
    await waitFor(() => expect(screen.getByTestId(TestId.reasoning.level('high'))).toBeTruthy())
    fireEvent.click(screen.getByTestId(TestId.reasoning.level('high')))
    expect(onChange).toHaveBeenCalledWith('high')
    expect(screen.queryByTestId(TestId.reasoning.level('off'))).toBeNull()
  })

  test('shows a state icon instead of the level text', () => {
    const view = renderButton()

    expect(screen.getByRole('button', { name: 'Thinking: High' })).toBeTruthy()
    expect(view.container.querySelector('[data-reasoning-level="high"]')).toBeTruthy()
    expect(view.container.querySelector('button')?.textContent).toBe('')
  })

  test.each([
    ['low', 1],
    ['medium', 2],
    ['high', 3],
  ] as const)('shows %s effort with %i active dots', (level, activeDotCount) => {
    const view = renderButton(level)
    const status = view.container.querySelector(`[data-reasoning-status="${level}"]`)

    expect(status?.querySelectorAll('[data-reasoning-dot="active"]')).toHaveLength(activeDotCount)
    expect(status?.querySelectorAll('[data-reasoning-dot="inactive"]')).toHaveLength(3 - activeDotCount)
  })

  test('opens the effort menu with level labels when the trigger is clicked', async () => {
    renderButton()

    fireEvent.click(screen.getByRole('button', { name: 'Thinking: High' }))

    await waitFor(() => expect(screen.getByTestId(TestId.reasoning.menu)).toBeTruthy())
    expect(screen.getByTestId(TestId.reasoning.level('default'))).toBeTruthy()
    // The level text lives in the menu items now that the trigger is icon-only.
    expect(screen.getByTestId(TestId.reasoning.level('high')).textContent).toContain('High')
  })

  test('supports reasoning control for Qwen models on the OpenAI interface', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <ReasoningControlButton
        provider={ModelProviderEnum.OpenAI}
        model={{ modelId: 'qwen-plus' }}
        iconSize={22}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Thinking: Default' }))
    await waitFor(() => expect(screen.getByTestId(TestId.reasoning.menu)).toBeTruthy())
    expect(screen.getByTestId(TestId.reasoning.level('off'))).toBeTruthy()
    expect(screen.getByTestId(TestId.reasoning.level('high'))).toBeTruthy()

    fireEvent.click(screen.getByTestId(TestId.reasoning.level('high')))
    expect(onChange).toHaveBeenCalledWith('high')
  })

  test('supports reasoning control for DeepSeek models on the OpenAI interface', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <ReasoningControlButton
        provider={ModelProviderEnum.OpenAI}
        model={{ modelId: 'deepseek-r1' }}
        iconSize={22}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Thinking: Default' }))
    await waitFor(() => expect(screen.getByTestId(TestId.reasoning.menu)).toBeTruthy())
    expect(screen.getByTestId(TestId.reasoning.level('off'))).toBeTruthy()

    fireEvent.click(screen.getByTestId(TestId.reasoning.level('off')))
    expect(onChange).toHaveBeenCalledWith('off')
  })
})
