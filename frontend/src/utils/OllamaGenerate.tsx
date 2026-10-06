export const  OllamaDirectGenerateStream = async (
	llm:string, 
	question:string, systemPrompt:string, addToolsPromt:boolean, mcpResponse:string, 
	temperature:number, top_k:number, top_p:number, 
	setAnswer:any, setThought:any
) => {
	const body = JSON.stringify({
		model: llm,
		prompt: question + (addToolsPromt ? '\n\n<tool_response>' + mcpResponse + '</tool_response>' : ''),
		system: systemPrompt,
		stream: true,
		think: setThought ? true : false,
		options: {
			temperature: temperature,
			top_k: top_k,
			top_p: top_p,
		}
	})
	
	let content = ''
	let thought = ''
	let answerReceived = false
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_generate/`, {body, method: 'POST'})
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

		for (const j of lines){
			if (!j.trim()) {
				continue
			}
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
				if (setThought){
					thought += chunk
					setThought(thought)
				}
			} else {
				content += chunk
			}
		}
		setAnswer(content)
	}

	if (leftover.trim().length) {
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
	}
	return answerReceived
}

export const OllamaDirectGenerateNoStream = async (
	llm:string, 
	question:string, systemPrompt:string, addToolsPromt:boolean, mcpResponse:string, 
	temperature:number, top_k:number, top_p:number, 
	setAnswer:any, setThought:any
) => {
	const body = JSON.stringify({
		model: llm,
		prompt: question + (addToolsPromt ? '\n\n<tool_response>' + mcpResponse + '</tool_response>' : ''),
		system: systemPrompt,
		stream: false,
		think: setThought ? true : false,
		options: {
			temperature: temperature,
			top_k: top_k,
			top_p: top_p,
		}
	})
	
	let content = ''
	// let thought = ''
	let answerReceived = false
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_generate/`, {body, method: 'POST'})
	const data = await response.json()
	if (data.response) {
		content = data.response
		answerReceived = true
	}
	if (setThought && data.thinking){
		setThought(data.thinking)
	}
	setAnswer(content)
	return answerReceived
}


// Which are the top 3 kinases curated from Kinase curation project. Is there any information about them in this paper? If yes, then list all the mutations that were used in the substrate phosphorylation assay, activity assay or catalytic activity assay.