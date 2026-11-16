import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ChatHistory from '../components/ChatHistory'

describe('ChatHistory hallucination mode', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    [true, 0, 42, '0%'],
    [false, 31, 0, '0%'],
    [true, 31, 42, '31%'],
    [false, 31, 42, '42%'],
  ])('uses the selected library mode (equation=%s)', async (mode, equation, ml, expected) => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      json: async () => url.includes('get_conversation_history')
        ? { conversations: [{ questions_answers: [{ question_id: 1, question: 'Question' }] }] }
        : {
          question: 'Question',
          llm: 'llama3',
          HI_by_equation: mode,
          answers: [
            { answer: 'First answer', relevance_score: 80, hallucination_index_by_equation: equation, hallucination_index_by_ml: ml },
            { answer: 'Second answer', relevance_score: 80, hallucination_index_by_equation: 12, hallucination_index_by_ml: 34 },
          ],
          sources: [],
        },
    })))
    render(<ChatHistory dataset="library" datasets={['library']} closeChatHistory={vi.fn()} darkMode={false} />)

    await waitFor(() => expect(screen.getByText('Hallucination')).toHaveTextContent(expected))
    fireEvent.click(screen.getByText('Answer 1 / 2').parentElement.querySelectorAll('button')[1])
    await waitFor(() => expect(screen.getByText('Hallucination')).toHaveTextContent(mode ? '12%' : '34%'))
  })
})
