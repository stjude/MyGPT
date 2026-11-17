import {readModelStream} from './ModelStream'

export const OllamaDirectChatStream = async (body:any, setAnswer:any, setThought:any) => {
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_chat/`, {body, method: 'POST'})
	return readModelStream(response, setAnswer, setThought)

}

const OllamaDirectChatNoStream = async (body:any, setAnswer:any, setThought:any) => {
	let content = ''
	let thought = ''
	let answerReceived = false
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_chat/`, {body, method: 'POST'})
	const data = await response.json()
	if (!response.ok || data.error) throw new Error(data.error_message || 'Model request failed')
	if (data.content) {
		content = data.content
		setAnswer(content)
		answerReceived = true
	}
	if (setThought && data.thinking){
		thought = data.thinking
		setThought(thought)
	}
	return {content, answerReceived, thought}
}

export const OllamaChatStreamWithToolSupport = async (body:any, setAnswer:any, MCPTools:any, MCPClient:any, stream:boolean, returnToolResponse:boolean, setThought:any) => {
	let answerReceived
	let content = ''
	let toolResponse = ''
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_chat/`, {body, method: 'POST'})
	const data = await response.json()
	if (!response.ok || data.error) throw new Error(data.error_message || 'Model request failed')

	const toolCalls = Array.isArray(data.tool_calls)
		? data.tool_calls
		: (data.tool_calls ? [data.tool_calls] : [])
	if (toolCalls.length > 0){
		let body_json = JSON.parse(body)
		body_json.stream = false
		let messages = [...(body_json.messages || [])]
		// OpenAI requires the assistant call and its IDs before the corresponding tool results.
		if (toolCalls.some((call:any) => call.id)) {
			messages.push({role: 'assistant', content: data.content || null, tool_calls: toolCalls})
		}
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
					tool_name: callName,
					...(call.id ? {tool_call_id: call.id} : {}),
					content: JSON.stringify({ error: `Tool not found: ${callName}` })
				})
				toolResponse += JSON.stringify({ error: `Tool not found: ${callName}` })
				continue
			}

			const result = await MCPClient.callTool({
				name: callName,
				arguments: callArgs,
			})
			if (result.content && result.content.length > 0){
				messages.push({
					role: 'tool',
					tool_name: callName,
					...(call.id ? {tool_call_id: call.id} : {}),
					content: JSON.stringify(result.content)
				})
				toolResponse += JSON.stringify(result.content)
			}
		}
		const body_2 = {
			model: body_json.model,
			options: body_json.options,
			new_conversation: false,
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
	}
	
	if (!toolCalls.length) {
		content = data.content || ''
		setAnswer(content)
		if (setThought) setThought(data.thinking || '')
		answerReceived = Boolean(content)
	}
	return {content, answerReceived}
}

