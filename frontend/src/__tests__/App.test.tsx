import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import App from '../App'
import GPTHome from '../components/GPTHome'
import RelevanceScoreSettings from '../components/RelevanceScoresSettings'
import defaultSettings from '../utils/DefaultState'

vi.mock('@azure/msal-browser', () => ({ PublicClientApplication: class {} }))
vi.mock('../components/GPTHome', () => ({ default: vi.fn(() => null) }))
vi.mock('../components/TopNav', () => ({ default: () => null }))
vi.mock('../components/Settings', () => ({ default: () => null }))
vi.mock('../components/UploadMenu', () => ({ default: () => null }))
vi.mock('../components/ChatHistory', () => ({ default: () => null }))
vi.mock('../components/Disclaimer', () => ({ default: () => null }))
vi.mock('../components/FAQ', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
vi.mock('better-react-mathjax', () => ({
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const latestProps = () => vi.mocked(GPTHome).mock.calls.at(-1)![0]

describe('App settings callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const renderApp = async (provider: string) => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes('frontend_settings')
        ? { settings: { model_provider: provider, restriction_without_login: true } }
        : url.includes('get_embedding_model_details')
          ? { embedding_model: {
            best_distance_q: 0.2, worst_distance_q: 1.7,
            best_distance_ac: 0.12, worst_distance_ac: 1.42,
          } }
          : [],
    })))
    render(<App />)
    await waitFor(() => expect(latestProps().currentSettings.model_provider).toBe(provider))
    await waitFor(() => expect(latestProps().currentSettings.fetchDatasets).toBe(false))
  }

  it.each(['ollama', 'openai'])('resolves batched functional updates against current state in %s mode', async provider => {
    await renderApp(provider)
    const { settingsCallback, currentSettings } = latestProps()
    const increment = (settings: typeof defaultSettings) => ({
      ...settings,
      maximum_chunks_count: settings.maximum_chunks_count + 1,
      restriction_without_login: false,
      selectedLlm: provider === 'openai' ? 'llama3:latest' : 'gpt-6-luna',
    })

    act(() => {
      settingsCallback(increment)
      settingsCallback(increment)
    })

    expect(latestProps().currentSettings).toMatchObject({
      maximum_chunks_count: currentSettings.maximum_chunks_count + 2,
      restriction_without_login: true,
      selectedLlm: currentSettings.defaultLlm,
      model_provider: provider,
    })

    const replacement = { ...latestProps().currentSettings, restriction_without_login: false }
    act(() => settingsCallback(replacement))
    expect(latestProps().currentSettings.restriction_without_login).toBe(true)
    expect(replacement.restriction_without_login).toBe(false)
  })

  describe.each(['ollama', 'openai'])('%s relevance resets', provider => {
    it.each([
      [0, 'use_default_qrs'],
      [1, 'use_default_ars'],
      [2, 'use_default_hi'],
    ] as const)('handles Reset button %i', async (index, flag) => {
      await renderApp(provider)
      act(() => latestProps().settingsCallback({
        ...latestProps().currentSettings,
        [flag]: false,
      }))
      const { currentSettings, settingsCallback } = latestProps()
      render(<RelevanceScoreSettings
        currentSettings={currentSettings}
        settingsCallback={settingsCallback}
        selectedDataset="None"
      />)
      await waitFor(() => expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('get_embedding_model_details'), expect.any(Object),
      ))

      fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[index])

      expect(latestProps().currentSettings[flag]).toBe(true)
      expect(latestProps().currentSettings.model_provider).toBe(provider)
      expect(latestProps().currentSettings.restriction_without_login).toBe(true)
    })
  })
})
