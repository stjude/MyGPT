import React, { useEffect, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import MathMarkdown from './MathMarkdown'

export type AnswerReferenceScore = {
	label: string
	value: number | string
}

export type AnswerReferenceScoreGroup = {
	label: string
	scores: AnswerReferenceScore[]
}

export type CompositeRelevanceDetails = {
	semantic?: number
	keyword?: number
	rerank?: number
}

export type AnswerReference = {
	title: string
	detail: string
	groupKey: string
	colorClass?: string
	selected?: boolean
	context?: string
	scores?: AnswerReferenceScoreGroup[]
	defaultExpanded?: boolean
	onSelect: () => void
}

type QuestionBubbleProps = {
	question: string
	relevance?: number
	relevancePending?: boolean
	relevanceDetails?: CompositeRelevanceDetails
	darkMode: boolean
	scoreColor: (score: number) => string
}

function RelevanceScoreDetails({ kind, details, scoreColor }: { kind: 'QRS' | 'ARS'; details?: CompositeRelevanceDetails; scoreColor: (score: number) => string }) {
	const [expanded, setExpanded] = useState(false)
	const scores = kind === 'QRS'
		? [{ label: 'Qsem', value: details?.semantic }, { label: 'Qkey', value: details?.keyword }, { label: 'Qrerank', value: details?.rerank }]
		: [{ label: 'Asem', value: details?.semantic }, { label: 'Akey', value: details?.keyword }, { label: 'Arerank', value: details?.rerank }]
	const availableScores = scores.filter((score): score is { label: string; value: number } => score.value !== undefined && score.value !== null)

	if (!availableScores.length) return null

	return (
		<div className='relative mt-1 text-right'>
			<button
				type='button'
				className='inline-flex items-center gap-1 text-[10px] font-normal text-white/80 hover:text-white'
				aria-expanded={expanded}
				onClick={() => setExpanded(!expanded)}
			>
				{kind} details
				{expanded ? <ChevronUpIcon className='h-3 w-3' /> : <ChevronDownIcon className='h-3 w-3' />}
			</button>
			{expanded && (
				<div className='absolute right-0 top-full z-20 mt-1 w-36 rounded bg-slate-800/70 p-2 text-left text-[10px] font-normal text-white shadow-lg'>
					{availableScores.map(score => (
						<div key={score.label} className='flex items-center justify-between gap-2 py-0.5'>
							<span className='text-white/70'>{score.label}</span>
							<span style={{ backgroundColor: scoreColor(score.value) }} className={'rounded-full px-2 py-0.5 font-semibold' + (score.value > 80 || score.value < 20 ? ' text-white' : ' text-nav')}>
								{Math.round(score.value)}%
							</span>
						</div>
					))}
				</div>
			)}
		</div>
 	)
}

export function QuestionBubble({ question, relevance, relevancePending = false, relevanceDetails, darkMode, scoreColor }: QuestionBubbleProps) {
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
						<RelevanceScoreDetails kind='QRS' details={relevanceDetails} scoreColor={scoreColor} />
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
	relevanceDetails?: CompositeRelevanceDetails
	hallucination?: number
	showMetrics?: boolean
	scoreColor: (score: number) => string
	references?: AnswerReference[]
	feedback?: React.ReactNode
	children?: React.ReactNode
}

function AnswerReferenceItem({ reference, expanded, onToggle, scoreColor }: { reference: AnswerReference; expanded: boolean; onToggle: () => void; scoreColor: (score: number) => string }) {

	return (
		<div className={'bg-slate-600 dark:bg-slate-700'}>
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
						<div className='mt-1 space-y-2 px-2 py-1 text-xs text-white'>
							{reference.scores?.map(group => (
								<div key={group.label}>
									<div className='mb-1 font-semibold text-slate-300'>{group.label}</div>
									<dl className='grid grid-cols-3 gap-2'>
										{group.scores.map(score => (
											<div key={score.label} className='flex min-w-0 flex-col items-center text-center'>
												<dt className='mb-1 text-slate-300'>{score.label}</dt>
												<dd>
													{typeof score.value === 'number' ? (
														<span style={{ backgroundColor: scoreColor(score.value) }} className={'inline-block py-1 px-2 rounded-full font-semibold' + (score.value > 80 || score.value < 20 ? ' text-white' : ' text-nav')}>
															{score.value.toFixed(2)}%
														</span>
													) : (
														<span className={'inline-block rounded-full px-2 py-1 font-semibold ' + (score.value.toLowerCase() === 'entailment' ? 'bg-green-700 text-white' : score.value.toLowerCase() === 'contradiction' ? 'bg-red-700 text-white' : score.value.toLowerCase() === 'neutral' ? 'bg-yellow-500 text-slate-900' : 'bg-slate-600 text-white')}>
															{score.value}
														</span>
													)}
												</dd>
											</div>
										))}
									</dl>
								</div>
							))}
						</div>
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
	relevanceDetails,
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
								<RelevanceScoreDetails kind='ARS' details={relevanceDetails} scoreColor={scoreColor} />
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