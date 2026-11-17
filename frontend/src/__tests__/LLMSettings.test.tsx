import {render, screen} from '@testing-library/react'
import {it, expect, vi} from 'vitest'
import LLMSettings from '../components/LLMSettings'

it.each(['openai', 'vllm'])('shows %s and hides unsupported model downloads', async (provider) => {
  const oldFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({provider, supports_pull: false})})
  try {
    render(<LLMSettings llms={['Qwen/model']} llm="Qwen/model" selectedLlm="Qwen/model" currentSettings={{}} settingsCallback={vi.fn()}/>)
    expect(await screen.findByText(new RegExp(`Provider: ${provider}`))).toBeInTheDocument()
    expect(screen.queryByText('LLMs ready to download')).not.toBeInTheDocument()
  } finally { globalThis.fetch = oldFetch }
})

it('retains Ollama model download controls', async () => {
  const oldFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({provider: 'ollama', supports_pull: true})})
  try {
    render(<LLMSettings llms={[]} llm="" selectedLlm="" currentSettings={{}} settingsCallback={vi.fn()}/>)
    expect(await screen.findByText('LLMs ready to download')).toBeInTheDocument()
  } finally { globalThis.fetch = oldFetch }
})
