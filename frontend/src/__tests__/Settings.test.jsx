import { vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Settings from '../components/Settings'
import { DeveloperAPISettings } from '../components/DeveloperAPISettings'
import defaultSettings from '../utils/DefaultState'
import { applyRuntimeConfig, getRuntimeConfig } from '../utils/runtimeConfig'

vi.mock('../components/LLMSettings', () => ({
  default: () => <div data-testid='llm-settings'>LLM Settings</div>
}))
vi.mock('../components/EmbeddingSettings', () => ({
  default: () => <div data-testid='embedding-settings'>Embedding Settings</div>
}))
vi.mock('../components/RelevanceScoresSettings', () => ({
  default: () => <div data-testid='relevance-settings'>Relevance Settings</div>
}))
vi.mock('../components/MCPClient', () => ({
  default: () => <div data-testid='mcp-client'>MCP Client</div>
}))

describe('Settings', () => {
  const baseProps = {
    closeSettings: vi.fn(),
    defaultSettings,
    currentSettings: defaultSettings,
    settingsCallback: vi.fn(),
    djangoLogin: false,
    user: { user_email: 'abc@xyz.com', otherRoles: [] }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})

    global.fetch = vi.fn((url) => {
      const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : String(url))

      if (urlStr.includes('get_datasets')) {
        return Promise.resolve({
          json: () => Promise.resolve([])
        })
      }

      if (urlStr.includes('api/tags') || urlStr.includes('/tags')) {
        return Promise.resolve({
          json: () => Promise.resolve({ models: [] })
        })
      }

      if (urlStr.includes('add_ollama_models')) {
        return Promise.resolve({
          json: () => Promise.resolve({ added: true })
        })
      }

      return Promise.resolve({ json: () => Promise.resolve({}) })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Settings header', () => {
    render(<Settings {...baseProps} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders expected panel tabs', () => {
    const { container } = render(<Settings {...baseProps} />)

    const datasetsPanels = container.querySelectorAll('div[data-panel="datasets"]')
    const chatSettingsPanels = container.querySelectorAll('div[data-panel="chatsettings"]')
    const llmsPanels = container.querySelectorAll('div[data-panel="llms"]')

    expect(datasetsPanels.length).toBeGreaterThan(0)
    expect(chatSettingsPanels.length).toBeGreaterThan(0)
    expect(llmsPanels.length).toBeGreaterThan(0)
    expect(screen.queryByText('Prompt and LLM parameters')).not.toBeInTheDocument()
    expect(screen.queryByText('Embedding Models')).not.toBeInTheDocument()
    expect(screen.queryByText('Relevance score parameters')).not.toBeInTheDocument()
  })

  it('shows Add New Library button when openUpload is provided', () => {
    render(<Settings {...baseProps} openUpload={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /Add New Library/i }).length).toBeGreaterThan(0)
  })

  it('triggers close and upload open on Add New Library click', () => {
    const closeSettings = vi.fn()
    const openUpload = vi.fn()

    render(
      <Settings
        {...baseProps}
        closeSettings={closeSettings}
        openUpload={openUpload}
      />
    )

    const addButtons = screen.getAllByRole('button', { name: /Add New Library/i })
    const visibleButton = addButtons.find((button) => !button.closest('div[style="display: none;"]')) || addButtons[0]
    fireEvent.click(visibleButton)

    expect(closeSettings).toHaveBeenCalledTimes(1)
    expect(openUpload).toHaveBeenCalledTimes(1)
  })

  it('links to HTTP(S) backend docs but never renders non-HTTP links', () => {
    const original = getRuntimeConfig()
    try {
      applyRuntimeConfig({ ...original, backendUrl: 'https://example.org/backend' })
      const { unmount } = render(<DeveloperAPISettings currentSettings={defaultSettings} settingsCallback={vi.fn()} />)
      expect(screen.getByRole('link', { name: /Swagger UI/i })).toHaveAttribute('href', 'https://example.org/backend/api/docs/')
      expect(screen.getByRole('link', { name: /OpenAPI JSON/i })).toHaveAttribute('href', 'https://example.org/backend/api/schema/')
      unmount()

      applyRuntimeConfig({ ...original, backendUrl: 'javascript:alert(1)' })
      render(<DeveloperAPISettings currentSettings={defaultSettings} settingsCallback={vi.fn()} />)
      expect(screen.queryByRole('link', { name: /Swagger UI/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /OpenAPI JSON/i })).not.toBeInTheDocument()
    } finally {
      applyRuntimeConfig(original)
    }
  })
})