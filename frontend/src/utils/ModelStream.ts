// MyGPT's backend normalizes Ollama NDJSON and OpenAI/vLLM SSE to this format.
export async function readModelStream(response: Response, setAnswer: any, setThought: any) {
  if (!response.ok || !response.body) throw new Error('Model request failed. Check the configured endpoint.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', content = '', thought = '', answerReceived = false
  const consume = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line)
    if (event.error) throw new Error(event.error_message || 'Model response failed')
    if (event.done) { answerReceived = true; return }
    if (event.type === 'thinking') {
      thought += event.content || ''
      if (setThought) setThought(thought)
    } else if (event.type === 'response') {
      content += event.content || ''
      setAnswer(content)
    }
  }
  try {
    while (true) {
      const {done, value} = await reader.read()
      buffer += decoder.decode(value, {stream: !done})
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      lines.forEach(consume)
      if (done) break
    }
    consume(buffer)
    if (!answerReceived) throw new Error('Model connection ended before the answer completed')
    return {content, thought, answerReceived}
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
