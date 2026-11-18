import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ReactFlowProvider } from '@xyflow/react'
import LLMSettings from '../components/LLMSettings'
import EmbeddingSettings from '../components/EmbeddingSettings'
import EmbeddingModelNode from '../components/Flow/StageOne/EmbeddingModelNode'
import defaultSettings, { applyModelProvider, openAIEmbeddingModels } from '../utils/DefaultState'

describe('Provider-specific model controls', () => {
	it.each(['openai', 'ollama'])('filters stale LLM choices and download controls in %s mode', provider => {
		const settings = applyModelProvider(defaultSettings, provider)
		render(<LLMSettings
			llms={['gpt-6-luna', 'llama3:latest']}
			llm={settings.selectedLlm}
			selectedLlm={settings.selectedLlm}
			currentSettings={settings}
			settingsCallback={vi.fn()}
		/>)
		if (provider === 'openai') {
			expect(screen.getByText('gpt-6-luna')).toBeInTheDocument()
			expect(screen.queryByText('llama3:latest')).not.toBeInTheDocument()
			expect(screen.queryByText(/ready to download/i)).not.toBeInTheDocument()
		} else {
			expect(screen.queryByText('gpt-6-luna')).not.toBeInTheDocument()
			expect(screen.getByText('llama3:latest')).toBeInTheDocument()
		}
	})

	it('shows only OpenAI embedding models and no local download controls', () => {
		const settings = applyModelProvider(defaultSettings, 'openai')
		render(<EmbeddingSettings
			embeddingModels={['nomic-embed-text:latest', ...openAIEmbeddingModels]}
			embeddingModel={settings.selectedEmbeddingModel}
			selectedEmbeddingModel={settings.selectedEmbeddingModel}
			currentSettings={settings}
			settingsCallback={vi.fn()}
		/>)
		for (const model of openAIEmbeddingModels) expect(screen.getByText(model)).toBeInTheDocument()
		expect(screen.queryByText('nomic-embed-text:latest')).not.toBeInTheDocument()
		expect(screen.queryByText(/ready to download/i)).not.toBeInTheDocument()
	})

	it('replaces a stale saved Ollama embedding with the OpenAI default', () => {
		localStorage.setItem('upEmbeddingModelNodeState', JSON.stringify({
			selectedEmbeddingModel: 'nomic-embed-text:latest', distanceFn: 'l2',
		}))
		const settingsCallback = vi.fn()
		render(<ReactFlowProvider>
			<EmbeddingModelNode data={{
				title: 'Embedding Model',
				currentSettings: applyModelProvider(defaultSettings, 'openai'),
				settingsCallback,
			}} />
		</ReactFlowProvider>)
		expect(screen.queryByRole('option', { name: 'nomic-embed-text:latest' })).not.toBeInTheDocument()
		expect(settingsCallback).toHaveBeenLastCalledWith(expect.objectContaining({
			selectedEmbeddingModel: 'text-embedding-3-small',
		}))
		localStorage.removeItem('upEmbeddingModelNodeState')
	})
})
