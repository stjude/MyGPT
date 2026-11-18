import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ReactFlowProvider } from '@xyflow/react'
import AddLibrarySettings from '../components/AddLibrarySettings'
import EmbeddingModelNode from '../components/Flow/StageOne/EmbeddingModelNode'
import defaultSettings, { openAIEmbeddingModels, applyModelProvider } from '../utils/DefaultState'

describe('OpenAI embedding selection', () => {
	it('keeps the local default without OpenAI models until OpenAI is enabled', () => {
		expect(defaultSettings.selectedEmbeddingModel).toBe('nomic-embed-text:latest')
		for (const model of openAIEmbeddingModels) {
			expect(defaultSettings.embedding_models).not.toContain(model)
		}
	})

	it('offers OpenAI models for Zotero with an existing list and saves the selected name', () => {
		localStorage.clear()
		const settingsCallback = vi.fn()
		render(
			<AddLibrarySettings
				currentSettings={{
					...defaultSettings,
					model_provider: 'openai',
					embedding_models: ['nomic-embed-text:latest', 'text-embedding-3-small'],
				}}
				settingsCallback={settingsCallback}
			/>
		)

		fireEvent.click(screen.getByText('Add Zotero library'))
		const options = screen.getAllByRole('option', { name: 'text-embedding-3-large' })
		const select = options[0].closest('select')
		if (!select) throw new Error('Embedding model selector not found')
		expect(Array.from(select.options).filter(option => option.value === 'text-embedding-3-small')).toHaveLength(1)
		expect(Array.from(select.options).map(option => option.value)).toEqual([
			...openAIEmbeddingModels,
		])

		fireEvent.change(select, { target: { value: 'text-embedding-3-large' } })
		expect(settingsCallback).toHaveBeenLastCalledWith(expect.objectContaining({
			selectedEmbeddingModel: 'text-embedding-3-large',
		}))
	})

	it('offers OpenAI models in the advanced document upload node', () => {
		localStorage.clear()
		const settingsCallback = vi.fn()
		render(
			<ReactFlowProvider>
				<EmbeddingModelNode data={{
					title: 'Embedding Model',
					currentSettings: applyModelProvider(defaultSettings, 'openai'),
					settingsCallback,
				}} />
			</ReactFlowProvider>
		)
		const select = screen.getByRole('option', { name: 'text-embedding-3-small' }).closest('select')
		if (!select) throw new Error('Embedding model selector not found')
		fireEvent.change(select, { target: { value: 'text-embedding-3-small' } })
		expect(settingsCallback).toHaveBeenLastCalledWith(expect.objectContaining({
			selectedEmbeddingModel: 'text-embedding-3-small',
		}))
	})
})
