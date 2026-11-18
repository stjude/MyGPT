import { readModelResponse } from './ModelResponse'

export const  OllamaDirectChatStream = async (body:any, setAnswer:any, setThought:any) => {
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_chat/`, {body, method: 'POST'})
	return readModelResponse(response, true, setAnswer, setThought)
}

const OllamaDirectChatNoStream = async (body:any, setAnswer:any, setThought:any) => {
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_chat/`, {body, method: 'POST'})
	return readModelResponse(response, false, setAnswer, setThought)
}

export const OllamaChatStreamWithToolSupport = async (body:any, setAnswer:any, MCPTools:any, MCPClient:any, stream:boolean, returnToolResponse:boolean, setThought:any) => {
	let answerReceived
	let content = ''
	let toolResponse = ''
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_chat/`, {body, method: 'POST'})
	const data = await response.json()
	if (!response.ok || data.error) throw new Error(data.error_message || 'Model tool request failed')

	const toolCalls = Array.isArray(data.tool_calls)
		? data.tool_calls
		: (data.tool_calls ? [data.tool_calls] : [])
	if (toolCalls.length > 0){
		let body_json = JSON.parse(body)
		body_json.stream = false
		let messages = body_json.messages || []
		messages.push({
			role: 'assistant', content: data.content || '', tool_calls: toolCalls,
			...(data.openai_output ? { openai_output: data.openai_output } : {}),
		})
		// handle tool calls here
		for (const call of toolCalls){
			const callName = call?.function?.name || call?.name
			const rawCallArgs = call?.function?.arguments || call?.arguments || {}
			let callArgs = rawCallArgs
			if (typeof rawCallArgs === 'string') {
				try {
					callArgs = JSON.parse(rawCallArgs)
				} catch {
					callArgs = {}
				}
			}
			if (!callName){
				continue
			}

			const toolExists = MCPTools?.some((tool:any) => tool?.name === callName)
			if (!toolExists){
				messages.push({
					role: 'tool',
					tool_call_id: call.id,
					tool_name: callName,
					content: JSON.stringify({ error: `Tool not found: ${callName}` })
				})
				toolResponse += JSON.stringify({ error: `Tool not found: ${callName}` })
				continue
			}

			const result = await MCPClient.callTool({
				name: callName,
				arguments: callArgs,
			})
			messages.push({
				role: 'tool',
				tool_call_id: call.id,
				tool_name: callName,
				content: JSON.stringify(result.content || [])
			})
			toolResponse += JSON.stringify(result.content || [])
		}
		const body_2 = {
			model: body_json.model,
			new_conversation: false,
			options: body_json.options,
			messages: messages,
			stream: stream
		}
		if (returnToolResponse){
			content = toolResponse
			answerReceived = true
		}
		else if (!returnToolResponse && stream){
			const data = await OllamaDirectChatStream(JSON.stringify(body_2), setAnswer, setThought)
			answerReceived = data.answerReceived
			content = data.content
		} else {
			const data = await OllamaDirectChatNoStream(JSON.stringify(body_2), setAnswer, setThought)
			answerReceived = data.answerReceived
			content = data.content
		}
	} else {
		content = data.content || ''
		setAnswer(content)
		answerReceived = content.length > 0
	}
	
	return {content, answerReceived}
}
