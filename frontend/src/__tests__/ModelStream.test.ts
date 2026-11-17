import {describe, it, expect, vi} from 'vitest'
import {readModelStream} from '../utils/ModelStream'
import {OllamaChatStreamWithToolSupport} from '../utils/OllamaChat'
import {ReadableStream} from 'node:stream/web'
import {TextEncoder, TextDecoder} from 'node:util'
import {rememberModelCatalog, directChatDataset, translationModel} from '../utils/ModelCatalog'

Object.assign(globalThis, {TextDecoder})
function response(wire: string) {
  const bytes = new TextEncoder().encode(wire)
  return {ok: true, body: new ReadableStream({start(controller) {
    for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3))
    controller.close()
  }})} as unknown as Response
}
describe('model endpoint streaming', () => {
  it('uses backend-issued conversation identifiers and the correct translation model', () => {
    rememberModelCatalog({provider:'vllm', models:[{name:'Qwen/model', direct_chat_dataset:'safe_model_123_direct_chat'}]})
    expect(directChatDataset('Qwen/model')).toBe('safe_model_123_direct_chat')
    expect(translationModel('Qwen/model')).toBe('Qwen/model')
    rememberModelCatalog({provider:'ollama', models:[]})
    expect(directChatDataset('llama3')).toBe('llama3_direct_chat')
    expect(translationModel('llama3')).toBe('translategemma:latest')
  })
  it('preserves UTF-8, separate reasoning, and the final event across network chunks', async () => {
    const answer = vi.fn(), thought = vi.fn()
    const result = await readModelStream(response(
      '{"type":"thinking","content":"check"}\n{"type":"response","content":"café 🎄"}\n{"done":true}'
    ), answer, thought)
    expect(result).toEqual({content: 'café 🎄', thought: 'check', answerReceived: true})
    expect(answer).toHaveBeenLastCalledWith('café 🎄')
  })
  it('rejects an upstream error even when the event has done=true', async () => {
    await expect(readModelStream(response('{"error":true,"error_message":"Model generation failed","done":true}\n'), vi.fn(), null))
      .rejects.toThrow('Model generation failed')
  })
  it('rejects interrupted streams rather than saving a partial answer as success', async () => {
    await expect(readModelStream(response('{"type":"response","content":"partial"}\n'), vi.fn(), null))
      .rejects.toThrow('before the answer completed')
  })
  it('preserves assistant tool calls and matching IDs in the follow-up', async () => {
    const oldFetch = globalThis.fetch
    const call = {id: 'call_42', type: 'function', function: {name: 'lookup', arguments: '{"id":42}'}}
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ok: true, json: async () => ({content: '', tool_calls: [call]})})
      .mockResolvedValueOnce({ok: true, json: async () => ({content: 'Found it'})})
    const client = {callTool: vi.fn().mockResolvedValue({content: [{type: 'text', text: 'found'}]})}
    try {
      const result = await OllamaChatStreamWithToolSupport(JSON.stringify({model: 'Qwen/model', messages: [{role:'user',content:'lookup'}]}), vi.fn(), [{name:'lookup'}], client, false, false, null)
      const body = JSON.parse((globalThis.fetch as any).mock.calls[1][1].body)
      expect(body.messages[1]).toEqual({role: 'assistant', content: null, tool_calls: [call]})
      expect(body.messages[2].tool_call_id).toBe('call_42')
      expect(body.new_conversation).toBe(false)
      expect(result.content).toBe('Found it')
    } finally { globalThis.fetch = oldFetch }
  })
})
