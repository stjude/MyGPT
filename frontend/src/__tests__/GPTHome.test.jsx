import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GPTHome from '../components/GPTHome'
import defaultSettings from '../utils/DefaultState'
import * as GPTHomeAPI from '../utils/GPTHomeAPI'
import { OllamaDirectGenerateStream } from '../utils/OllamaGenerate'
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

vi.mock('../utils/OllamaGenerate', () => ({
  OllamaDirectGenerateStream: vi.fn(),
  OllamaDirectGenerateNoStream: vi.fn(),
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
    OllamaDirectGenerateStream.mockImplementation(async (_model, question, _prompt, _tools, _response, _temperature, _topK, _topP, setAnswer) => {
      setAnswer(`Answer to ${question}`)
      return true
    })
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

  it.each(['openai', 'vllm'])('routes document answers through the configured %s provider', async (provider) => {
    GPTHomeAPI.fetchContext.mockResolvedValue({context: 'The lighthouse is violet', relevance_score: 90, sources: []})
    renderGPTHome({selectedLlm: 'Qwen/Test-Model', LLM_server_API_specs: provider})
    const input = screen.getByPlaceholderText(/Type your question here/i)
    fireEvent.change(input, {target: {value: 'What color is the lighthouse?'}})
    fireEvent.keyUp(input, {key: 'Enter', keyCode: 13})
    await waitFor(() => expect(GPTHomeAPI.saveAnswer).toHaveBeenCalled())
    expect(OllamaDirectGenerateStream).toHaveBeenCalledWith(
      'Qwen/Test-Model', 'What color is the lighthouse?', expect.stringContaining('violet'),
      false, '', expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Function), null
    )
  })

  it('shows endpoint errors without saving an unsuccessful answer', async () => {
    OllamaDirectGenerateStream.mockRejectedValue(new Error('Model generation failed'))
    renderGPTHome({selectedLlm: 'Qwen/Test-Model', LLM_server_API_specs: 'openai'})
    const input = screen.getByPlaceholderText(/Type your question here/i)
    fireEvent.change(input, {target: {value: 'A question'}})
    fireEvent.keyUp(input, {key: 'Enter', keyCode: 13})
    expect(await screen.findByRole('alert')).toHaveTextContent('Model generation failed')
    expect(GPTHomeAPI.saveAnswer).not.toHaveBeenCalled()
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

  it.each([
    [true, 0, 42, '0%'],
    [false, 31, 0, '0%'],
    [true, 31, 42, '31%'],
    [false, 31, 42, '42%'],
  ])('shows the selected hallucination metric (equation=%s)', async (mode, equation, ml, expected) => {
    GPTHomeAPI.saveAnswer.mockResolvedValue({
      relevance_score: 78,
      hallucination_index_by_equation: equation,
      hallucination_index_by_ml: ml,
    })
    renderGPTHome({
      selectedLlm: 'llama3:latest',
      relevance_score_cutoff: { ...defaultSettings.relevance_score_cutoff, HI_by_equation: mode },
    })
    const input = screen.getByPlaceholderText(/Type your question here/i)
    fireEvent.change(input, { target: { value: 'A question' } })
    fireEvent.keyUp(input, { key: 'Enter', keyCode: 13 })

    await waitFor(() => expect(GPTHomeAPI.saveAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ HI_by_equation: mode }), expect.anything()
    ))
    await waitFor(() => expect(screen.getByText('Hallucination')).toHaveTextContent(expected))
  })

  it('answers an empty context and keeps later paper and video references aligned', async () => {
    GPTHomeAPI.fetchContext
      .mockResolvedValueOnce({ context: '', relevance_score: 64, semantic_score: 0, keyword_score: 0, rerank_score: 0, sources: [] })
      .mockResolvedValueOnce({
        context: 'Paper context', relevance_score: 80, semantic_score: 80, keyword_score: 0, rerank_score: 0,
        sources: [{ document: 'Paper title', page: 2, start: '', stop: '', context: 'Paper context', color_code: 'green' }],
      })
      .mockResolvedValueOnce({
        context: 'Video context', relevance_score: 75, semantic_score: 75, keyword_score: 0, rerank_score: 0,
        sources: [{ document: 'Video title', page: '', start: '00:01:00', stop: '00:02:00', context: 'Video context', color_code: 'green' }],
      })
    renderGPTHome({ selectedLlm: 'llama3:latest' })
    const input = screen.getByPlaceholderText(/Type your question here/i)
    const ask = (question) => {
      fireEvent.change(input, { target: { value: question } })
      fireEvent.keyUp(input, { key: 'Enter', keyCode: 13 })
    }

    ask('First question')
    await waitFor(() => expect(GPTHomeAPI.saveAnswer).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Answer to First question')).toBeInTheDocument()
    expect(screen.getByText('64%')).toBeInTheDocument()
    expect(OllamaDirectGenerateStream).toHaveBeenCalledWith(
      'llama3:latest', 'First question', defaultSettings.system_prompt + 'None',
      false, '', defaultSettings.temperature, defaultSettings.top_k, defaultSettings.top_p, expect.any(Function), null
    )

    ask('Second question')
    await waitFor(() => expect(GPTHomeAPI.saveAnswer).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Page 2 of "Paper title"')).toBeInTheDocument()

    ask('Third question')
    await waitFor(() => expect(GPTHomeAPI.saveAnswer).toHaveBeenCalledTimes(3))
    expect(await screen.findByText('00:01:00 to 00:02:00 of "Video title"')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of "Paper title"')).toBeInTheDocument()
  })

  it('discovers namespaced models through the backend even in Electron', async () => {
    const { fetchAndRegisterOllamaModels } = await vi.importActual('../utils/GPTHomeAPI')
    const electronAPI = window.electronAPI
    const fetch = globalThis.fetch
    window.electronAPI = {isDesktop: true, getOllamaStatus: vi.fn()}
    globalThis.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({
      models: [{name: 'Qwen/Test-Model', size: 0, quantization_level: 'unknown'}],
      provider: 'vllm', supports_pull: false,
    })})
    try {
      expect(await fetchAndRegisterOllamaModels(null)).toEqual(['Qwen/Test-Model'])
      expect(window.electronAPI.getOllamaStatus).not.toHaveBeenCalled()
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/get_ollama_models/'), expect.objectContaining({method: 'POST'}))
    } finally { window.electronAPI = electronAPI; globalThis.fetch = fetch }
  })

  it('does not fall back to another server when configured model discovery fails', async () => {
    const { fetchAndRegisterOllamaModels } = await vi.importActual('../utils/GPTHomeAPI')
    const fetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({ok: false})
    try {
      expect(await fetchAndRegisterOllamaModels(null)).toEqual([])
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    } finally { globalThis.fetch = fetch }
  })
})
