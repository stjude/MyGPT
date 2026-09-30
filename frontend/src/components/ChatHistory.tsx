import { useState, useEffect } from 'react'
import { scaleSequential, interpolateRdYlGn } from 'd3'
import { ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import MathMarkdown from './MathMarkdown'

interface ChatHistoryProps {
	dataset: string,
	datasets: string[],
	closeChatHistory: any,
	darkMode: boolean,
}

const ChatHistory = (props: ChatHistoryProps) =>{

	const ConfidenceScoreColor = scaleSequential()
		.domain([0, 100])
		.interpolator(interpolateRdYlGn)

	const [chatHistory, setChatHistory] = useState([])
	const [activeQuestion, setActiveQuestion] = useState(0)
	const [activeQuestionID, setActiveQuestionID] = useState(0)
	const [questionDetails, setQuestionDetails]:[any,any] = useState({})
	const [selectedSource, setSelectedSource] = useState(0)
	const [showNullAnswer, setShowNullAnswer] = useState(false)
	const [activeAnswer, setActiveAnswer] = useState(0)
	const [selectedDataset, setSelectedDataset] = useState(props.dataset)
	const [searchQuery, setSearchQuery] = useState('')
	const [hallucionationIndex, setHallucionationIndex] = useState(0)

	useEffect(() => {
		if (questionDetails.answers && questionDetails.answers[activeAnswer]) {
			const hi = questionDetails.answers[activeAnswer].hallucination_index_by_ml !== 0 ? questionDetails.answers[activeAnswer].hallucination_index_by_ml : questionDetails.answers[activeAnswer].hallucination_index_by_equation
			setHallucionationIndex(hi)
		} else {
			setHallucionationIndex(0)
		}
	}, [questionDetails, activeAnswer])

	useEffect(() => {
		// fetch chat history from API
		fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_conversation_history/?dataset=${selectedDataset}`, {
			method: 'GET',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': `${localStorage.getItem('access') ?'Bearer ' + localStorage.getItem('access'):''}`
			}
		})
			.then(response => response.json())
			.then(data => {
				const questions_array:any = []
				data.conversations.forEach((conversation: any) => {
					conversation.questions_answers.forEach((question: any) => {
						questions_array.push(question)
					})
			})
			if (questions_array.length > 0) {
				setChatHistory(questions_array)
				setActiveQuestionID(questions_array[0].question_id)
			}
		})
	}, [selectedDataset])

	// filter chat history based on search query
	const filteredChatHistory:any = chatHistory.filter((message: any) => 
		message.question.toLowerCase().includes(searchQuery.toLowerCase())
	)

	// fetch answers and sources for selected question
	useEffect(() => {
		if (activeQuestionID === 0) return
		fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_question_details/?question_id=${activeQuestionID}`,{
			method: 'GET',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': `${localStorage.getItem('access') ?'Bearer ' + localStorage.getItem('access'):''}`
			}
		})
			.then(response => response.json())
			.then(data => {
				setQuestionDetails(data)
			})
	}, [activeQuestionID])

	// Function to export chat history with answers as CSV
	const exportToCsv = async () => {
		if (chatHistory.length === 0) {
			alert('No chat history to export')
			return
		}

		try {
			// Show loading state
			const originalText = 'Export CSV'
			const button = document.querySelector('[data-export-btn]') as HTMLButtonElement
			if (button) {
				button.textContent = 'Exporting...'
				button.disabled = true
			}

			// Fetch all question details
			const questionDetails = await Promise.all(
				chatHistory.map(async (item: any) => {
					const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_question_details/?question_id=${item.question_id}`, {
						method: 'GET',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `${localStorage.getItem('access') ? 'Bearer ' + localStorage.getItem('access') : ''}`
						}
					})
					const data = await response.json()
					return { ...item, details: data }
				})
			)

			// Create CSV headers
			const headers = [
				'Question ID',
				'Question',
				'Answer',
				'Answer (No Context)',
				'LLM Model',
				'Question Relevance Score',
				'Answer Relevance Score',
				'Hallucination Index by equation',
				'Hallucination Index by ML',
				'Rating',
				'Rating Comment',
				'Dataset',
				'Number of Sources',
				'Timestamp'
			]

		// Create CSV rows - one row per answer
		const csvData = questionDetails.flatMap((item: any) => {
			if (!item.details.answers || item.details.answers.length === 0) {
				return [[
					item.question_id,
					`"${item.question.replace(/"/g, '""')}"`,
					'N/A',
					'N/A',
					item.details.llm || 'N/A',
					item.details.relevance_score || 'N/A',
					'N/A',
					'N/A',
					'N/A',
					'N/A',
					'N/A',
					selectedDataset,
					item.details.sources ? item.details.sources.length : 0,
					new Date(item.created_at || Date.now()).toLocaleString()
				]]
			}
			return item.details.answers.map((answer: any) => [
				item.question_id,
				`"${item.question.replace(/"/g, '""')}"`,
				`"${answer.answer.replace(/"/g, '""')}"`,
				`"${answer.answer_no_context.replace(/"/g, '""')}"`,
				item.details.llm || 'N/A',
				item.details.relevance_score || 'N/A',
				answer.relevance_score,
				answer.hallucination_index_by_equation,
				answer.hallucination_index_by_ml,
				answer.rating === 1 ? 'Correct' : answer.rating === -1 ? 'Incorrect' : 'N/A',
				`"${answer.user_comment ? answer.user_comment.replace(/"/g, '""') : ''}"`,
				selectedDataset,
				item.details.sources ? item.details.sources.length : 0,
				new Date(item.created_at || Date.now()).toLocaleString()
			])
		})

		// Combine headers and data
		const csvContent = [headers, ...csvData]
			.map(row => row.join(','))
			.join('\n')

		// Create and download the CSV file
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
		const link = document.createElement('a')
		const url = URL.createObjectURL(blob)
		link.setAttribute('href', url)
		link.setAttribute('download', `chat-history-complete-${selectedDataset}-${new Date().toISOString().split('T')[0]}.csv`)
		link.style.visibility = 'hidden'
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)

			// Reset button state
			if (button) {
				button.textContent = originalText
				button.disabled = false
			}
		} catch (error) {
			console.error('Error exporting chat history:', error)
			alert('Error exporting chat history. Please try again.')

			// Reset button state on error
			const button = document.querySelector('[data-export-btn]') as HTMLButtonElement
			if (button) {
				button.textContent = 'Export CSV'
				button.disabled = false
			}
		}
	}

	return (
		// create floating panel with opque background
		<div className='fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center' onClick={props.closeChatHistory}>
			<div className={'bg-panel1 dark:bg-panel4-dark w-3/4 max-w-[1200px] rounded-lg ' + (window.screen.availHeight < 1000 ? 'h-[95vh] max-h-[95vh]' : 'h-[70vh] max-h-[70vh]')} onClick={(event) => event.stopPropagation()}>
				<div className='flex justify-between'>
					<div className='text-2xl font-bold text-white mt-8 mx-8'>Chat History</div>
					<div className='text-2xl font-bold text-white mt-8 mr-8 cursor-pointer' onClick={props.closeChatHistory}>×</div>
				</div>
				<div className={'flex justify-between my-6 '+ (window.screen.availHeight < 1000 ? 'h-[78vh]' : 'h-[62vh]')}>
					{/* create left side panel for questions */}
					<div className={'w-1/3 border-slate-400 border-y-2 overflow-y-auto ' + (window.screen.availHeight < 1000 ? 'h-[80vh]' : 'h-[62vh]')}>
						<div className='grid grid-cols-1 divide-y'>
							<div className='text-white py-2 px-4 mx-auto'>
								<div className='text-lg font-bold inline-block'>
									Library
								</div>
							{/* dropdown for datasets */}
							<select 
								className='text-md text-nav bg-panel2 dark:bg-stjude dark:text-nav-dark py-2 px-4 mx-2 rounded-md'
								value={selectedDataset}
								onChange={(e) => setSelectedDataset(e.target.value)}
							>
								{props.datasets.map((dataset, index) => {
									return (
										<option key={index} value={dataset}>{dataset}</option>
									)
								})}
							</select>
							<div className='flex justify-center'>
								<button
									onClick={exportToCsv}
									data-export-btn
									className='bg-green-800 hover:bg-green-600 text-white font-bold py-1 px-4 mx-2 mt-2 rounded text-sm'
									disabled={chatHistory.length === 0}
								>
									Export CSV
								</button>
							</div>
							</div>
							<div className='py-2 px-4'>
								<input
									type='text'
									placeholder='Search questions...'
									value={searchQuery}
									onChange={(e) => {
										setSearchQuery(e.target.value)
										setActiveQuestion(filteredChatHistory.length > 0 ? chatHistory.findIndex((item: any) => item.question_id === filteredChatHistory[0].question_id) : 0)
										setActiveQuestionID(filteredChatHistory.length > 0 ? filteredChatHistory[0].question_id : 0)
										}
									}
									className='w-full px-3 py-2 text-sm text-nav dark:text-nav-dark bg-white dark:bg-gray-500 rounded-md border border-slate-400 focus:outline-none focus:border-blue-500'
								/>
							</div>
							<div className='text-white text-lg font-bold py-2 px-4'>Questions</div>
							{
								chatHistory && chatHistory.length === 0 ? 
									<div className='text-lg text-white px-4 mx-2'>No chat history available</div> :
								filteredChatHistory.map((message:any) => {
									const originalIndex = chatHistory.findIndex((item: any) => item.question_id === message.question_id)
									return (
										<div 
											key={message.question_id} 
											className={`text-white text-md cursor-pointer py-2 px-4 overflow-y-auto 
												${activeQuestion === originalIndex ? 'font-normal bg-nav' : 'font-light bg-panel1 dark:bg-panel4-dark'}`}
											onClick={() => {
												setActiveQuestion(originalIndex)
												setActiveQuestionID(message.question_id)
												setActiveAnswer(0)
												setShowNullAnswer(false)
											}}
										>
											<MathMarkdown>
												{message.question}
											</MathMarkdown>
										</div>
									)
								})
							}
						</div>
					</div>
					{/* create right side for answers and sources list */}
					<div className={'w-2/3 bg-panel3 dark:bg-neutral-800 overflow-y-auto overflow-x-clip border-slate-400 border-y-2 ' + (window.screen.availHeight < 1000 ? 'h-[80vh] max-h-[80vh]' : 'h-[62vh] max-h-[62vh]')}>
					{ activeQuestionID === 0 ? <div className='px-4 mx-2'> No Q&A to display</div> :
						<>
							<div className={'py-4 px-6 m-4 bg-panel2 dark:bg-panel3-dark rounded-lg shadow-md box2' + (props.darkMode ? ' user-chat-dark' : ' user-chat')}>
								<div className={'flex flex-row justify-between font-bold overflow-x-auto'}>
									<div className='text-nav dark:text-nav-dark text-sm py-2'>You</div>
									<div className='text-nav dark:text-nav-dark rounded-full text-xs py-2'>
										Relevance 
										<span style={{ backgroundColor: ConfidenceScoreColor(questionDetails.relevance_score)}} 
											className= {'py-1 px-2 m-1 rounded-full' + (questionDetails.relevance_score > 80 || questionDetails.relevance_score < 20 ? ' text-white' : ' text-nav')}>
											{questionDetails.relevance_score + '%'}
										</span>
									</div>
								</div>
								<div className='text-nav dark:text-nav-dark'>
									<MathMarkdown>
										{questionDetails.question}
										</MathMarkdown>
									</div>
							</div>
							<div className={'py-4 px-6 m-4 bg-panel1 dark:bg-panel4-dark rounded-lg shadow-md box2' + (props.darkMode ? ' llm-chat-dark' : ' llm-chat')}>
							{ questionDetails.answers && questionDetails.answers.length >= 0 ?
								<>
									<div className='flex flex-row justify-between font-bold'>
											{/* <div className='text-white text-sm py-2'>{questionDetails.llm}</div> */}
										<div className='flex flex-col gap-1'>
											<select
												className='text-sm text-nav bg-panel3 dark:bg-panel2-dark dark:text-nav-dark p-1 rounded-md inline-block'
												value={showNullAnswer ? 'without_context': 'with_context'}
												onChange={(e)=>{
													if (e.target.value === 'without_context'){
														setShowNullAnswer(true)
													}else{
														setShowNullAnswer(false)
													}
												}}
											>
												<option value={'with_context'}>{questionDetails.llm + ' + MyGPT'}</option>
												<option value={'without_context'}>{questionDetails.llm}</option>
											</select>
											{questionDetails.answers.length > 1 && (
												<div className='flex items-center gap-1 text-white text-xs p-2'>
													<button
														onClick={() => setActiveAnswer(a => Math.max(0, a - 1))}
														disabled={activeAnswer === 0}
														className='disabled:opacity-30 hover:text-blue-100'
													>
														<ChevronLeftIcon className='w-4 h-4'/>
													</button>
													<span>Answer {activeAnswer + 1} / {questionDetails.answers.length}</span>
													<button
														onClick={() => setActiveAnswer(a => Math.min(questionDetails.answers.length - 1, a + 1))}
														disabled={activeAnswer === questionDetails.answers.length - 1}
														className='disabled:opacity-30 hover:text-blue-100'
													>
														<ChevronRightIcon className='w-4 h-4'/>
													</button>
												</div>
											)}
										</div>
										<div className='text-white text-xs flex flex-col items-end py-2'>
											<div className='text-white rounded-full text-xs py-1'>
												Relevance 
										<span style={{ backgroundColor: ConfidenceScoreColor(questionDetails.answers[activeAnswer].relevance_score)}} 
											className= {'py-1 px-2 m-1 rounded-full' + (questionDetails.answers[activeAnswer].relevance_score > 80 || questionDetails.answers[activeAnswer].relevance_score < 20 ? ' text-white' : ' text-nav')}>
											{questionDetails.answers[activeAnswer].relevance_score + '%'}
												</span>
											</div>
											<div className='text-white rounded-full text-xs py-1 mt-1'>
												Hallucination
												<span style={{ backgroundColor: ConfidenceScoreColor(100 - hallucionationIndex)}} 
													className= {'py-1 px-2 m-1 rounded-full' + (hallucionationIndex > 80 || hallucionationIndex < 20 ? ' text-white' : ' text-nav')}>
													{hallucionationIndex + '%'}
												</span>
											</div>
										</div>
									</div>
									<div className='text-white whitespace-pre-wrap answer-div'>
									<MathMarkdown>
										{showNullAnswer ? questionDetails.answers[activeAnswer].answer_no_context : questionDetails.answers[activeAnswer].answer}
										</MathMarkdown>
									</div>
									<div className='text-white text-sm font-bold pt-4'>
									{questionDetails.sources.length > 1 ? 'Sources' : questionDetails.sources.length === 1 ? 'Source': ''}
								</div>
								{questionDetails.sources.map((source:any, index:number)=>(
									<div key={index}>
										<div className='border border-gray-400'></div>
										<div 
											// className={'text-white text-sm p-2 font-normal italic' + (selectedSource === index ? ' bg-nav' : '')}
											className={'text-white text-sm p-2 font-normal italic cursor-pointer ' +  (source.color_code === 'green' ? 'bg-green-600' : source.color_code === 'yellow' ? 'bg-yellow-600' : source.color_code === 'red' ? 'bg-amber-600' : '')}
											onClick={() => setSelectedSource(index)}
										>
												{'Page ' + (source.page) + ' of "' + source.paper + '"'}
												{selectedSource === index ? <ChevronUpIcon className='h-4 w-4 float-right'/> : <ChevronDownIcon className='h-4 w-4 float-right'/>}
										</div>
										{selectedSource === index ? 
											<div className='text-white text-sm p-2 bg-slate-600 dark:bg-slate-700'>
												<div className='text-white font-bold'>Context</div>
												{source.context}
											</div> : <></>
										}
									</div>
								))}
								</> : <></>}
							</div>
						</>}
					</div>
				</div>
			</div>
		</div>
	)
};

export default ChatHistory