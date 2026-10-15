import React, { useEffect, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import MathMarkdown from './MathMarkdown'

export type AnswerReferenceScore = {
	label: string
	value: number
}

export type AnswerReference = {
	title: string
	detail: string
	groupKey: string
	colorClass?: string
	selected?: boolean
	context?: string
	scores?: AnswerReferenceScore[]
	defaultExpanded?: boolean
	onSelect: () => void
}

type QuestionBubbleProps = {
	question: string
	relevance?: number
	relevancePending?: boolean
	darkMode: boolean
	scoreColor: (score: number) => string
}

export function QuestionBubble({ question, relevance, relevancePending = false, darkMode, scoreColor }: QuestionBubbleProps) {
	return (
		<div className={'py-4 px-6 my-4 bg-panel2 dark:bg-panel3-dark rounded-lg shadow-md box2' + (darkMode ? ' user-chat-dark' : ' user-chat')}>
			<div className='flex flex-row justify-between font-bold'>
				<div className='text-nav dark:text-nav-dark text-sm py-2'>You</div>
				{(relevance !== undefined || relevancePending) && (
					<div className='text-nav dark:text-nav-dark rounded-full text-xs py-2'>
						Relevance
						<span style={relevance === undefined ? undefined : { backgroundColor: scoreColor(relevance) }} className={'py-1 px-2 m-1 rounded-full' + (relevance === undefined ? ' bg-slate-500 text-white' : relevance > 80 || relevance < 20 ? ' text-white' : ' text-nav')}>
							{relevance === undefined ? '...' : relevance + '%'}
						</span>
					</div>
				)}
			</div>
			<div className='text-nav dark:text-nav-dark'>{question}</div>
		</div>
	)
}

type AnswerBubbleProps = {
	darkMode: boolean
	heading: React.ReactNode
	answer: string
	thought?: string
	showThinking?: boolean
	minimizedThinking?: boolean
	onToggleThinking?: () => void
	isGenerating?: boolean
	relevance?: number
	hallucination?: number
	showMetrics?: boolean
	scoreColor: (score: number) => string
	references?: AnswerReference[]
	feedback?: React.ReactNode
	children?: React.ReactNode
}

function AnswerReferenceItem({ reference, expanded, onToggle, scoreColor }: { reference: AnswerReference; expanded: boolean; onToggle: () => void; scoreColor: (score: number) => string }) {

	return (
		<div className={reference.selected ? 'bg-slate-600 dark:bg-slate-700' : ''}>
			<button
				type='button'
				className='flex w-full items-center gap-2 text-left'
				title={expanded ? 'Collapse source' : 'Expand source'}
				aria-expanded={expanded}
				onClick={() => {
					onToggle()
					reference.onSelect()
				}}
			>
				<span className={'flex w-full items-center justify-between text-white text-sm p-2 font-normal italic ' + (reference.colorClass || '')}>
					<span>{reference.detail}</span>
					{expanded ? <ChevronUpIcon className='h-4 w-4 shrink-0' /> : <ChevronDownIcon className='h-4 w-4 shrink-0' />}
				</span>
			</button>
			{expanded && (
				<div>
					{Boolean(reference.scores?.length) && (
						<dl className='mt-1 grid grid-cols-3 gap-2 px-2 py-2 text-xs text-white'>
							{reference.scores?.map(score => (
								<div key={score.label} className='flex min-w-0 flex-col items-center text-center'>
									<dt className='text-slate-300 mb-1'>{score.label}</dt>
									<dd>
										<span style={{ backgroundColor: scoreColor(score.value) }} className={'inline-block py-1 px-2 rounded-full font-semibold' + (score.value > 80 || score.value < 20 ? ' text-white' : ' text-nav')}>
											{score.value.toFixed(2)}%
										</span>
									</dd>
								</div>
							))}
						</dl>
					)}
					{reference.context && <div className='text-white text-sm p-2 bg-slate-600 dark:bg-slate-700'><div className='text-white font-bold'>Context</div>{reference.context}</div>}
				</div>
			)}
		</div>
	)
}

export function AnswerBubble({
	darkMode,
	heading,
	answer,
	thought = '',
	showThinking = false,
	minimizedThinking = false,
	onToggleThinking,
	isGenerating = false,
	relevance,
	hallucination,
	showMetrics = false,
	scoreColor,
	references = [],
	feedback,
	children,
}: AnswerBubbleProps) {
	const hasChildren = children !== undefined
	const [expandedReferenceGroup, setExpandedReferenceGroup] = useState<string | null>(null)
	const [referenceExpansionInitialized, setReferenceExpansionInitialized] = useState(false)
	const initialReferenceGroup = references.find(reference => reference.defaultExpanded)?.groupKey

	useEffect(() => {
		if (referenceExpansionInitialized || !initialReferenceGroup) return
		setExpandedReferenceGroup(initialReferenceGroup)
		setReferenceExpansionInitialized(true)
	}, [initialReferenceGroup, referenceExpansionInitialized])

	return (
		<div className={'py-4 px-6 my-4 bg-panel1 dark:bg-panel4-dark rounded-lg shadow-md box2' + (darkMode ? ' llm-chat-dark' : ' llm-chat')}>
			<div className={'flex flex-row font-bold ' + (heading ? 'justify-between' : 'justify-end')}>
				{heading}
				{showMetrics && (
					<div className='flex flex-col items-end py-2'>
						{(relevance !== undefined || isGenerating) && (
							<div className='text-white rounded-full text-xs py-1'>
								Relevance
								<span style={relevance === undefined ? undefined : { backgroundColor: scoreColor(relevance) }} className={'py-1 px-2 m-1 rounded-full' + (relevance === undefined ? ' bg-slate-500 text-white' : relevance > 80 || relevance < 20 ? ' text-white' : ' text-nav')}>
									{relevance === undefined ? '...' : relevance + '%'}
								</span>
							</div>
						)}
						{(hallucination !== undefined || isGenerating) && (
							<div className='text-white rounded-full text-xs py-1'>
								Hallucination
								<span style={hallucination === undefined ? undefined : { backgroundColor: scoreColor(100 - hallucination) }} className={'py-1 px-2 m-1 rounded-full' + (hallucination === undefined ? ' bg-slate-500 text-white' : hallucination > 80 || hallucination < 20 ? ' text-white' : ' text-nav')}>
									{hallucination === undefined ? '...' : hallucination + '%'}
								</span>
							</div>
						)}
					</div>
				)}
			</div>
			{!hasChildren && thought && (showThinking || isGenerating) && (
				<div className={isGenerating ? 'mb-4 p-4 bg-slate-700 dark:bg-slate-800 rounded-lg border-l-4 border-blue-500' : 'my-2 bg-slate-700 dark:bg-slate-800 rounded-lg border-l-4 border-slate-900 transition-all duration-300 ' + (minimizedThinking ? 'max-h-12 overflow-hidden p-4 opacity-60' : 'max-h-96 p-4')} style={!isGenerating ? { maxHeight: minimizedThinking ? '3.5rem' : '24rem', overflow: 'hidden' } : undefined}>
					<div className={isGenerating ? 'text-blue-300 text-sm font-semibold mb-2' : 'flex items-center justify-between mb-2'}>
						{isGenerating ? '💭 Thinking...' : <div className='text-slate-300 text-sm font-semibold'>💭 Thinking</div>}
						{!isGenerating && onToggleThinking && (
							<button className='text-xs text-slate-200 bg-slate-900 rounded px-2 py-1 ml-2 focus:outline-none border border-slate-400' onClick={onToggleThinking}>
								{minimizedThinking ? 'Expand' : 'Minimize'}
							</button>
						)}
					</div>
					<div className={isGenerating ? 'text-gray-300 text-sm whitespace-pre-wrap' : 'transition-all duration-300 ' + (minimizedThinking ? 'opacity-0 h-0' : 'opacity-100 h-auto')} style={!isGenerating ? { height: minimizedThinking ? 0 : 'auto', overflow: minimizedThinking ? 'hidden' : 'visible' } : undefined}>
						{isGenerating ? <MathMarkdown>{thought}</MathMarkdown> : <div className='text-gray-300 text-sm whitespace-pre-wrap overflow-y-auto max-h-48'><MathMarkdown>{thought}</MathMarkdown></div>}
					</div>
				</div>
			)}
			{!hasChildren && <div className='text-white whitespace-pre-wrap answer-div'><MathMarkdown>{answer}</MathMarkdown></div>}
			{!hasChildren && feedback}
			{children}
			{references.length > 0 && (
				<>
					<div className='text-white text-sm font-bold pt-4'>{references.length > 1 ? 'Sources' : 'Source'}</div>
					{references.map((reference, index) => (
						<AnswerReferenceItem
							key={`${reference.groupKey}-${index}`}
							reference={reference}
							expanded={expandedReferenceGroup === reference.groupKey}
							scoreColor={scoreColor}
							onToggle={() => {
								setReferenceExpansionInitialized(true)
								setExpandedReferenceGroup(current => current === reference.groupKey ? null : reference.groupKey)
							}}
						/>
					))}
				</>
			)}
		</div>
	)
}