import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GPTHome from '../components/GPTHome'
import defaultSettings from '../utils/DefaultState'
import * as GPTHomeAPI from '../utils/GPTHomeAPI'
import '../__mocks__/intersectObserverMock'

vi.mock('../utils/GPTHomeAPI', () => ({
  fetchAndRegisterOllamaModels: vi.fn().mockResolvedValue(['llama3:latest']),
  fetchDatasetDetails: vi.fn().mockResolvedValue({ documents_language: 'english' }),
  fetchDocuments: vi.fn().mockResolvedValue({ dataset_type: 'papers', documents: [] }),
  fetchSections: vi.fn().mockResolvedValue({ sections: [] }),
  addDemoLibraryRequest: vi.fn().mockResolvedValue({}),
  fetchContext: vi.fn().mockResolvedValue({ relevance_score: 0, context: '', sources: [] }),
  saveAnswer: vi.fn().mockResolvedValue({ relevance_score: 0, hallucination_index_by_ml: 0 }),
}))

vi.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess }) => {
    onLoadSuccess?.({ numPages: 3 })
    return <div data-testid="pdf-document">{children}</div>
  },
  Page: ({ pageNumber }) => <div data-testid="pdf-page">{pageNumber}</div>,
  pdfjs: { GlobalWorkerOptions: {} },
}))

const default_frontend_settings = {
  'show_no_context_switch': true,
  'azure_login': false, 
  'django_login': false,
  'restriction_without_login': false,
  'disable_chat_without_login': false,
}

describe('GPTHome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    GPTHomeAPI.fetchAndRegisterOllamaModels.mockResolvedValue(['llama3:latest'])
    GPTHomeAPI.fetchDatasetDetails.mockResolvedValue({ documents_language: 'english' })
    GPTHomeAPI.fetchDocuments.mockResolvedValue({ dataset_type: 'papers', documents: [] })
    GPTHomeAPI.fetchSections.mockResolvedValue({ sections: [] })
    GPTHomeAPI.addDemoLibraryRequest.mockResolvedValue({})
    GPTHomeAPI.fetchContext.mockResolvedValue({ relevance_score: 0, context: '', sources: [] })
    GPTHomeAPI.saveAnswer.mockResolvedValue({ relevance_score: 0, hallucination_index_by_ml: 0 })
  })

  const renderGPTHome = (overrides = {}, frontendOverrides = {}) => {
    const currentSettings = {
      ...defaultSettings,
      ...overrides,
    }

    const frontendSettings = {
      ...default_frontend_settings,
      ...frontendOverrides,
    }

    return render(
      <GPTHome
        currentSettings={currentSettings}
        settingsCallback={vi.fn()}
        frontendSettings={frontendSettings}
        user={{ user_email: '', otherRoles: [] }}
      />
    )
  }

  it('renders "Ask a Question" section', () => {
    renderGPTHome()
    const element = screen.getByText(/Ask a question about a paper or a topic from your publication library. We will try to answer it using the GPT models./i)
    expect(element).toBeInTheDocument()
  })

  it('renders current library controls', () => {
    renderGPTHome()
    expect(screen.getByText(/Current library/i)).toBeInTheDocument()
  })

  it('renders question input with default placeholder', () => {
    renderGPTHome()
    expect(screen.getByPlaceholderText(/Type your question here/i)).toBeInTheDocument()
  })

  it('shows login prompt in question area when chat requires login', () => {
    renderGPTHome(
      { loggedin: false },
      { disable_chat_without_login: true }
    )

    expect(screen.getByText(/Login to chat/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Type your question here/i)).not.toBeInTheDocument()
  })

  it('shows library login message when there are no documents and user is not logged in', () => {
    renderGPTHome({ loggedin: false })
    expect(screen.getByText(/Login to view document library/i)).toBeInTheDocument()
  })

  it('loads desktop models through Electron instead of fetching Ollama from the renderer', async () => {
    const { fetchAndRegisterOllamaModels } = await vi.importActual('../utils/GPTHomeAPI')
    const electronAPI = window.electronAPI
    const fetch = globalThis.fetch
    window.electronAPI = {
      isDesktop: true,
      getOllamaStatus: vi.fn().mockResolvedValue({
        isRunning: true,
        models: [
          { name: 'llama3:latest', size: 1000, details: { family: 'llama', quantization_level: 'Q4_K_M' } },
          { name: 'embedding:latest', size: 1000, details: { family: 'bert', quantization_level: 'F16' } },
        ],
      }),
    }
    globalThis.fetch = vi.fn()

    try {
      expect(await fetchAndRegisterOllamaModels(null)).toEqual(['llama3:latest'])
      expect(window.electronAPI.getOllamaStatus).toHaveBeenCalledOnce()
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      window.electronAPI = electronAPI
      globalThis.fetch = fetch
    }
  })

  it('keeps discovered desktop models when backend registration fails', async () => {
    const { fetchAndRegisterOllamaModels } = await vi.importActual('../utils/GPTHomeAPI')
    const electronAPI = window.electronAPI
    const fetch = globalThis.fetch
    window.electronAPI = {
      isDesktop: true,
      getOllamaStatus: vi.fn().mockResolvedValue({
        isRunning: true,
        models: [{ name: 'llama3:latest', size: 1000, details: { family: 'llama', quantization_level: 'Q4_K_M' } }],
      }),
    }
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Backend unavailable'))

    try {
      expect(await fetchAndRegisterOllamaModels({ django_login: false })).toEqual(['llama3:latest'])
    } finally {
      window.electronAPI = electronAPI
      globalThis.fetch = fetch
    }
  })
})
