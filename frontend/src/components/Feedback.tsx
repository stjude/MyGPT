import { useState } from 'react'
import { HandThumbUpIcon, HandThumbDownIcon, PaperAirplaneIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'

function Feedback(props:{
	answer: any,
	copyText: string,
	feedbackReceived: boolean,
	feedbackCallback: any
}){
	const [rating, setRating] = useState<number | null>(null)
	const [comment, setComment] = useState('')
	const [commentSent, setCommentSent] = useState(false)
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(props.copyText)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error('Failed to copy answer', error)
		}
	}

	const handleRating = (value: number) => {
		setRating(value)
		props.feedbackCallback({
			'answer': props.answer,
			'rating': value,
		})
	}

	return (
		<div className='mt-4 p-4'>
			{
				props.feedbackReceived || commentSent ?
				(<div className='flex justify-center text-sm italic'>
					<p className='text-sm text-white'>Thanks for your feedback!</p>
				</div>) :
				rating !== null ?
				(<>
					<div className='flex justify-center mb-2'>
						<p className='text-sm text-white italic'>Rating received! Feel free to add a comment below.</p>
					</div>
					<div className='flex justify-center my-2'>
						<textarea
							id='submitter'
							rows={2}
							className='text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 mr-2 shadow-md w-full'
							placeholder={`add optional comment &\nclick send to submit`}
							value={comment}
							onChange={(e:any)=>{
								setComment(e.target.value.replace(/\n/g, ''))
							}}>
						</textarea>
						<button onClick={()=>{
							if (comment.trim()) {
								props.feedbackCallback({
									'answer': props.answer,
									'user_comment': comment,
								})
							}
							setCommentSent(true)
						}}>
							<PaperAirplaneIcon className={'w-8 h-8 inline-block p-1 rounded-md text-white bg-slate-600 hover:text-white hover:border-transparent hover:bg-bsk_dark_blue'}/>
						</button>
					</div>
				</>) :
				(<div className='flex justify-start'>
					<button onClick={() => handleRating(-1)}>
						<HandThumbDownIcon className={'w-8 h-8 inline-block mr-2 p-1 rounded-md text-white bg-slate-600 hover:text-white hover:border-transparent hover:bg-bsk_dark_blue'}/>
					</button>
					<button onClick={() => handleRating(1)}>
						<HandThumbUpIcon className={'w-8 h-8 inline-block mr-2 p-1 rounded-md text-white bg-slate-600 hover:text-white hover:border-transparent hover:bg-bsk_dark_blue'}/>
					</button>
					<button type='button' onClick={handleCopy} title={copied ? 'Answer copied' : 'Copy answer'} aria-label={copied ? 'Answer copied' : 'Copy answer'}>
						{copied
							? <CheckIcon className='w-8 h-8 inline-block mr-2 p-1 rounded-md text-white bg-green-700' />
							: <ClipboardDocumentIcon className='w-8 h-8 inline-block mr-2 p-1 rounded-md text-white bg-slate-600 hover:text-white hover:border-transparent hover:bg-bsk_dark_blue' />}
					</button>
				</div>)
			}
		</div>
	)
}

export default Feedback