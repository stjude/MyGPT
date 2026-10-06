export const  OllamaDirectChatStream = async (body:any, setAnswer:any, setThought:any) => {
	let content = ''
	let thought = ''
	let answerReceived = false
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_chat/`, {body, method: 'POST'})
	const reader:any = response.body?.getReader()
	const decoder = new TextDecoder()
	let leftover = ''

	while (true) {
		const { done, value } = await reader.read()
		if (done) {
			break;
		}

		const rawjson = leftover + decoder.decode(value, { stream: true })
		const lines = rawjson.split('\n')
		leftover = lines.pop() || ''

		for (const j of lines) {
			if (!j.trim()) {
				continue
			}

			try {
				const json = JSON.parse(j)
				if (json.done === true) {
					answerReceived = true
					continue
				}

				const chunk = json.content || ''
				if (!chunk.length) {
					continue
				}

				if (json.type === 'thinking') {
					if (setThought) {
						thought += chunk
						setThought(thought)
					}
				} else {
					content += chunk
				}
			} catch {
				// Skip lines that fail to parse
				continue
			}
		}
		setAnswer(content)
	}

	if (leftover.trim().length) {
		try {
			const lastJson = JSON.parse(leftover)
			if (lastJson.done === true) {
				answerReceived = true
			} else {
				const chunk = lastJson.content || ''
				if (lastJson.type === 'thinking') {
					if (setThought && chunk.length) {
						thought += chunk
						setThought(thought)
					}
				} else if (chunk.length) {
					content += chunk
					setAnswer(content)
				}
			}
		} catch {
			// Ignore trailing incomplete JSON if stream ended unexpectedly.
		}
	}

	return {content, answerReceived, thought}
}

const OllamaDirectChatNoStream = async (body:any, setAnswer:any, setThought:any) => {
	let content = ''
	let thought = ''
	let answerReceived = false
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_chat/`, {body, method: 'POST'})
	const data = await response.json()
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

	const toolCalls = Array.isArray(data.tool_calls)
		? data.tool_calls
		: (data.tool_calls ? [data.tool_calls] : [])
	if (toolCalls.length > 0){
		let body_json = JSON.parse(body)
		body_json.stream = false
		let messages = body_json.messages || []
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
					content: JSON.stringify(result.content)
				})
				toolResponse += JSON.stringify(result.content)
			}
		}
		const body_2 = {
			model: body_json.model,
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
	}
	
	return {content, answerReceived}
}

