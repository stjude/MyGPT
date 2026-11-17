import { readModelResponse } from './ModelResponse'

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
	
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_generate/`, {body, method: 'POST'})
	return (await readModelResponse(response, true, setAnswer, setThought)).answerReceived
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
	
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_generate/`, {body, method: 'POST'})
	return (await readModelResponse(response, false, setAnswer, setThought)).answerReceived
}


// Which are the top 3 kinases curated from Kinase curation project. Is there any information about them in this paper? If yes, then list all the mutations that were used in the substrate phosphorylation assay, activity assay or catalytic activity assay.