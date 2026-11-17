import { afterEach, describe, expect, it, vi } from 'vitest'
import { readModelResponse } from '../utils/ModelResponse'
import { fetchAndRegisterOllamaModels } from '../utils/GPTHomeAPI'
import { fetchAndRegisterOllamaModels as fetchSettingsModels } from '../utils/SettingsAPI'
import { OllamaChatStreamWithToolSupport } from '../utils/OllamaChat'
import { isOpenAIModel } from '../utils/DefaultState'

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const streamResponse = (chunks: string[]) => new Response(new ReadableStream({
	start(controller) {
		const encoder = new TextEncoder()
		chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)))
		controller.close()
	},
}))

describe('OpenAI model responses', () => {
	it('keeps gpt-oss on Ollama and recognizes explicit OpenAI names', () => {
		expect(isOpenAIModel('gpt-6-luna')).toBe(true)
		expect(isOpenAIModel('openai:gpt-custom')).toBe(true)
		expect(isOpenAIModel('gpt-oss:20b')).toBe(false)
	})

	it('reads deltas split across network chunks and accepts a final line without a newline', async () => {
		const setAnswer = vi.fn()
		const setThought = vi.fn()
		const response = streamResponse([
			'{"type":"thinking","content":"Reasoning"}\n{"type":"res',
			'ponse","content":"Hello "}\n{"type":"response","content":"world"}\n',
			'{"type":"done","done":true}',
		])
		const result = await readModelResponse(response, true, setAnswer, setThought)
		expect(result).toEqual({ content: 'Hello world', thought: 'Reasoning', answerReceived: true })
		expect(setAnswer).toHaveBeenLastCalledWith('Hello world')
		expect(setThought).toHaveBeenCalledWith('Reasoning')
	})

	it('does not interpret an error with done=true as successful completion', async () => {
		const response = streamResponse(['{"error":true,"error_message":"Model not found","done":true}\n'])
		await expect(readModelResponse(response, true, vi.fn(), null)).rejects.toThrow('Model not found')
	})

	it('rejects a truncated stream even if a partial answer was received', async () => {
		const response = streamResponse(['{"type":"response","content":"partial"}\n'])
		await expect(readModelResponse(response, true, vi.fn(), null)).rejects.toThrow('before completion')
	})

	it('surfaces missing credentials before attempting to read a stream', async () => {
		const response = Response.json({ error: true, error_message: 'Configure OPENAI_API_KEY' }, { status: 400 })
		await expect(readModelResponse(response, true, vi.fn(), null)).rejects.toThrow('OPENAI_API_KEY')
	})

	it('keeps non-streaming generate and chat response shapes compatible', async () => {
		for (const payload of [{ response: 'Answer', thinking: '' }, { content: 'Answer', thinking: '' }]) {
			const setAnswer = vi.fn()
			const result = await readModelResponse(Response.json(payload), false, setAnswer, null)
			expect(result.answerReceived).toBe(true)
			expect(setAnswer).toHaveBeenCalledWith('Answer')
		}
	})

	it('keeps the cloud default selectable when Ollama cannot be reached', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Ollama offline')))
		expect(await fetchAndRegisterOllamaModels(null)).toEqual(['gpt-6-luna'])
		expect(await fetchSettingsModels(null, false)).toEqual({
			llms: ['gpt-6-luna'], llm: 'gpt-6-luna',
		})
	})

	it('preserves function call IDs and encrypted output through the tool follow-up', async () => {
		const output = [
			{ type: 'reasoning', encrypted_content: 'opaque' },
			{ type: 'function_call', name: 'lookup', arguments: '{"q":"GPCR"}', call_id: 'call_1' },
		]
		const fetch = vi.fn()
			.mockResolvedValueOnce(Response.json({
				content: '', openai_output: output,
				tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{"q":"GPCR"}' } }],
			}))
			.mockResolvedValueOnce(streamResponse([
				'{"type":"response","content":"Final answer"}\n{"type":"done","done":true}\n',
			]))
		vi.stubGlobal('fetch', fetch)
		const client = { callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Found' }] }) }
		const result = await OllamaChatStreamWithToolSupport(
			JSON.stringify({ model: 'gpt-6-luna', messages: [{ role: 'user', content: 'Question' }] }),
			vi.fn(), [{ name: 'lookup' }], client, true, false, null,
		)
		expect(result).toEqual({ content: 'Final answer', answerReceived: true })
		const followUp = JSON.parse(fetch.mock.calls[1][1].body)
		expect(followUp.new_conversation).toBe(false)
		expect(followUp.messages[1].openai_output).toEqual(output)
		expect(followUp.messages[2].tool_call_id).toBe('call_1')
		expect(client.callTool).toHaveBeenCalledWith({ name: 'lookup', arguments: { q: 'GPCR' } })
	})

	it('displays a normal model answer when no tool call is needed', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ content: 'No tool needed', tool_calls: [] })))
		const setAnswer = vi.fn()
		const result = await OllamaChatStreamWithToolSupport('{}', setAnswer, [], {}, true, false, null)
		expect(result).toEqual({ content: 'No tool needed', answerReceived: true })
		expect(setAnswer).toHaveBeenCalledWith('No tool needed')
	})
})
