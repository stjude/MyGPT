type TextSetter = ((text: string) => void) | null | false

export const readModelResponse = async (
	response: Response,
	stream: boolean,
	setAnswer: (text: string) => void,
	setThought: TextSetter
) => {
	if (!response.ok || !stream) {
		const data = await response.json()
		if (!response.ok || data.error) {
			throw new Error(data.error_message || `Model request failed (HTTP ${response.status})`)
		}
		const content = data.response ?? data.content ?? ''
		const thought = data.thinking || ''
		setAnswer(content)
		if (setThought) setThought(thought)
		return { content, thought, answerReceived: content.length > 0 }
	}

	const reader = response.body?.getReader()
	if (!reader) throw new Error('Model response has no readable stream')
	const decoder = new TextDecoder()
	let buffer = ''
	let content = ''
	let thought = ''
	let completed = false
	const consume = (line: string) => {
		if (!line.trim()) return
		const event = JSON.parse(line)
		if (event.error) throw new Error(event.error_message || 'Model generation failed')
		if (event.done) {
			completed = true
		} else if (event.type === 'thinking') {
			thought += event.content || ''
			if (setThought) setThought(thought)
		} else {
			content += event.content || ''
			setAnswer(content)
		}
	}
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			buffer += decoder.decode(value, { stream: true })
			const lines = buffer.split('\n')
			buffer = lines.pop() || ''
			lines.forEach(consume)
		}
		buffer += decoder.decode()
		consume(buffer)
		if (!completed) throw new Error('Model stream ended before completion')
		return { content, thought, answerReceived: completed && content.length > 0 }
	} finally {
		await reader.cancel()
		reader.releaseLock()
	}
}
