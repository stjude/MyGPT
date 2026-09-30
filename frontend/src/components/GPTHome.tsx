import React, { useState, useEffect, useRef, useMemo } from 'react'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { PaperAirplaneIcon, Cog6ToothIcon, PaperClipIcon, XMarkIcon, CheckIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon, ChatBubbleLeftRightIcon, DocumentChartBarIcon, BookmarkIcon as BookmarkIconMyGPT, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon, ArrowDownTrayIcon, Squares2X2Icon, Bars3Icon } from '@heroicons/react/24/outline'
import { scaleSequential, interpolateRdYlGn } from 'd3'
import MathMarkdown from './MathMarkdown'
// import Feedback from './Feedback'
import { OllamaDirectChatStream, OllamaChatStreamWithToolSupport } from '../utils/OllamaChat'
import { OllamaDirectGenerateStream, OllamaDirectGenerateNoStream } from '../utils/OllamaGenerate'
import { SJRayDirectGenerateStream } from '../utils/SJRayGenerate'
import { fetchAndRegisterOllamaModels, fetchDatasetDetails, fetchDocuments, fetchSections, addDemoLibraryRequest, fetchContext, saveAnswer, fetchProtectedMediaBlobUrl } from '../utils/GPTHomeAPI'
import FocusOnDocumentSelect from './DocumentFocusSelect'
import Feedback from './Feedback'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

function GPTHome(props:{
	currentSettings:any,
	settingsCallback:any,
	frontendSettings: any,
	user: any
}){
	const [llms, setLlms] = useState<any[]>([])
	const [selectedDataset, setSelectedDataset] = useState(props.currentSettings.selectedDataset)
	const [DatasetLanguage, setDatasetLanguage] = useState(props.currentSettings.DatasetLanguage)
	const [translatedQuery, setTranslatedQuery] = useState('')
	const [translatedQueryReceived, setTranslatedQueryReceived] = useState(false)
	const [searchTerm, setSearchTerm] = useState<any>('')
	const [query, setQuery] = useState<any[]>([])
	const [questionRelevancescore, setQuestionRelevancescore] = useState<any[]>([])
	const [answerRelevancescore, setAnswerRelevancescore] = useState<any[]>([])
	const [hallucinationIndex, setHallucinationIndex] = useState<any>([])
	const [context, setContext] = useState<any>('')
	const [relatedQuery, setRelatedQuery] = useState<any>(false)
	const [answer, setAnswer] = useState<any>('')
	const [thinkAllowed, setThinkAllowed] = useState<any>(false)
	const [thought, setThought] = useState<any>('')
	const [answerReceived, setAnswerReceived] = useState<any>(false)
	const [minimizedThinking, setMinimizedThinking] = useState(false)
	const [nullAnswer, setNullAnswer] = useState<any>('')
	const [nullThought, setNullThought] = useState<any>('')
	const [nullAnswerReceived, setNullAnswerReceived] = useState<any>(false)
	const [answers, setAnswers] = useState<any[]>([])
	const [translatedAnswer, setTranslatedAnswer] = useState('')
	const [translatedAnswerReceived, setTranslatedAnswerReceived] = useState(false)
	const [thoughts, setThoughts] = useState<any[]>([])
	const [nullAnswers, setNullAnswers] = useState<any[]>([])
	const [nullThoughts, setNullThoughts] = useState<any[]>([])
	const [showNullAnswerIndexes, setShowNullAnswerIndexes] = useState<any>([])
	const [papers, setPapers] = useState<any[]>([])
	const [focusedPapers, setFocusedPapers] = useState<string[]>([])
	const [sections, setSections] = useState<any[]>([])
	const [focusedSection, setFocusedSection] = useState<any>(null)
	const [videos, setVideos] = useState<any[]>([])
	const [sourcePapers, setSourcePapers] = useState<any[]>([])
	const [sourcePages, setSourcePages] = useState<any[]>([])
	const [sourceContexts, setSourceContexts] = useState<any[]>([])
	const [sourceStarts, setSourceStarts] = useState<any[]>([])
	const [sourceStops, setSourceStops] = useState<any[]>([])
	const [sourceColorCodes, setSourceColorCodes] = useState<any[]>([])
	const [selectedPaperIdx, setselectedPaperIdx] = useState(0)
	const [selectedPage, setSelectedPage] = useState(0)
	const [selectedStart, setSelectedStart] = useState(0)
	const [selectedStop, setSelectedStop] = useState(0)
	const [fileAttachmentType, setFileAttachmentType] = useState('paper_attachment')
	const [viewerFileUrl, setViewerFileUrl] = useState('')
	const [numPages, setNumPages] = useState(0)
	const [viewerPage, setViewerPage] = useState(1)
	const [pdfScale, setPdfScale] = useState(1.0)
	const [showThumbnails, setShowThumbnails] = useState(false)
	const [thumbnailWidth, setThumbnailWidth] = useState(170)
	const isDraggingThumb = useRef(false)
	const [mediaLoading, setMediaLoading] = useState(false)

	// Map page number → context strings for the most recent query, used by customTextRenderer.
	const highlightsByPage = useMemo(() => {
		const map: Record<number, string[]> = {}
		if (!sourcePages.length || !sourceContexts.length) return map
		const latestPages: any[] = sourcePages[sourcePages.length - 1] || []
		const latestContexts: any[] = sourceContexts[sourceContexts.length - 1] || []
		latestPages.forEach((page: any, idx: number) => {
			const ctx: string = latestContexts[idx]
			if (page && ctx) map[page] = [...(map[page] || []), ctx]
		})
		return map
	}, [sourcePages, sourceContexts])

	// Per-page stable renderer functions; recreated only when highlights or page count change.
	const textRenderers = useMemo(() => {
		const renderers: Record<number, (item: { str: string }) => React.ReactNode> = {}
		for (let p = 1; p <= numPages; p++) {
			const contexts = highlightsByPage[p]
			renderers[p] = ({ str }: { str: string }) => {
				if (!contexts || !str?.trim()) return str
				for (const ctx of contexts) {
					if (ctx.includes(str.trim())) {
						return (
							<span style={{ position: 'relative', display: 'inline' }}>
								{str}
								<span aria-hidden="true" style={{ position: 'absolute', top: '-1px', right: 0, bottom: 0, left: 0, background: 'rgba(255,220,0,0.45)', borderRadius: '2px', pointerEvents: 'none', zIndex: 0 }} />
							</span>
						)
					}
				}
				return str
			}
		}
		return renderers
	}, [highlightsByPage, numPages])
	const [mediaLoadError, setMediaLoadError] = useState('')
	const ConfidenceScoreColor = scaleSequential()
		.domain([0, 100])
		.interpolator(interpolateRdYlGn)

	const [answerWithoutContext, setAnswerWithoutContext] = useState(props.currentSettings.answerWithoutContext)

	const [addDemoLibrary, setAddDemoLibrary] = useState(false)
	const [imageAttachment, setImageAttachment] = useState([])
	const [imageBase64, setImageBase64] = useState([])
	const [mcpOllamaTools, setMcpOllamaTools] = useState<any[]>([])
	const [mcpResponse, setMcpResponse] = useState<any>('')
	// console.log(imageAttachment)
	// console.log(props.currentSettings.MCPTools, mcpOllamaTools)

	const llmsWithToolSupport = [
		'llama3.1', 'llama3.2', 'llama3.3', 'gpt-oss', 'gemma4'
	]

	const llmswithThinkStepSupport = [
		'gpt-oss', 'qwen3', 'gemma4'
	]

	const chatModeOptions = [
		{ value: 'chat_with_documents', label: 'Chat with Documents' },
		// { value: 'workflow_for_documents', label: 'Workflow for Documents' },
		{ value: 'direct_chat', label: 'Direct chat with GPTs' },
	]

	const supportedDatasetLanguages: any = {
		english: { language_to_full: 'English', language_to: 'en' },
		spanish: { language_to_full: 'Spanish', language_to: 'es' },
		french: { language_to_full: 'French', language_to: 'fr' },
		portugese: { language_to_full: 'Portuguese', language_to: 'pt' },
		german: { language_to_full: 'German', language_to: 'de' },
		italian: { language_to_full: 'Italian', language_to: 'it' },
		dutch: { language_to_full: 'Dutch', language_to: 'nl' },
		arabic: { language_to_full: 'Arabic', language_to: 'ar' },
		hindi: { language_to_full: 'Hindi', language_to: 'hi' },
		hungarian: { language_to_full: 'Hungarian', language_to: 'hu' },
	}

	const isThinkStepSupported = llmswithThinkStepSupport.includes(props.currentSettings.selectedLlm.split(':')[0])

	// get llms from backend
	useEffect(()=>{
		let isMounted = true
		const controller = new AbortController()
		fetchAndRegisterOllamaModels(props.frontendSettings, controller.signal)
			.then(llms => {
				if (!isMounted) return
				setLlms(llms)
				if (!llms.includes(props.currentSettings.selectedLlm)) {
					props.settingsCallback({
						...props.currentSettings,
						llms,
						selectedLlm: llms[0] || '',
					})
				}
			})
			.catch((error) => { if (error?.name !== 'AbortError') console.error(error) })
		return () => { isMounted = false; controller.abort() }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	},[props.frontendSettings, props.frontendSettings.django_login, props.currentSettings.runtimeRevision])

	// keep dataset language synced with the selected dataset
	useEffect(() => {
		if (props.currentSettings.selectedDataset === 'None') return
		let isMounted = true
		const controller = new AbortController()
		fetchDatasetDetails(props.currentSettings.selectedDataset, props.user, props.frontendSettings, controller.signal)
			.then(data => {
				if (!isMounted) return
				let system_prompt = props.currentSettings.system_prompt
				if (data && data.documents_language && props.currentSettings.DatasetLanguage !== data.documents_language) {
					if (data.dataset_prompt && data.dataset_prompt.system_prompt !== '-') 
						system_prompt = data.dataset_prompt
					props.settingsCallback({ ...props.currentSettings, DatasetLanguage: data.documents_language, system_prompt })
					setDatasetLanguage(data.documents_language)
				}
			})
			.catch((error) => { if (error?.name !== 'AbortError') console.error(error) })
		return () => { isMounted = false; controller.abort() }
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.currentSettings.selectedDataset])
	
	useEffect(()=>{
		const postData = async () => {
			const dataset = props.currentSettings.selectedDataset !== props.currentSettings.defaultDataset
				? props.currentSettings.selectedDataset
				: props.currentSettings.defaultDataset

			if (props.currentSettings.defaultDataset === props.currentSettings.selectedDataset && props.currentSettings.defaultDataset === 'None'){
				return
			}

			if((!props.currentSettings.answerWithoutContext && !papers.length && !videos.length) || (props.currentSettings.fetchPapers === true) ){
				setTimeout(async () => {
					const data = await fetchDocuments(dataset, props.user, props.frontendSettings)
					if (data.dataset_type === 'papers'){ 
						setPapers(data.documents)
						setVideos([])
					}
					else if (data.dataset_type === 'videos'){
						setVideos(data.documents)
						setPapers([])
					}
				}, 500)
			}
			props.settingsCallback({...props.currentSettings, showSettings: false, fetchPapers: false})

			if (props.currentSettings.fetchPapers === true){
				setQuery([])
				setAnswers([])
				setThoughts([])
				setNullAnswers([])
				setShowNullAnswerIndexes([])
				setselectedPaperIdx(0)
				setSelectedPage(0)
				setFileAttachmentType('paper_attachment')
				setSourcePapers([])
				setSourcePages([])
				setSourceColorCodes([])
				setSourceContexts([])
				setFocusedPapers([])
				setFocusedSection(null)
			}
		}
		postData()
	// eslint-disable-next-line react-hooks/exhaustive-deps	
	},[papers, query, props.currentSettings.defaultDataset, props.currentSettings.selectedDataset, props.currentSettings.fetchPapers, props.currentSettings.selectedDataset])

	useEffect(() => {
		const controller = new AbortController()
		let objectUrl = ''

		const loadProtectedMedia = async () => {
			if (!papers.length || !papers[selectedPaperIdx]) {
				setMediaLoading(false)
				setMediaLoadError('')
				setViewerFileUrl('')
				return
			}

			const mediaPath = papers[selectedPaperIdx][fileAttachmentType]
			if (!mediaPath) {
				setMediaLoading(false)
				setMediaLoadError('No file path found for this document')
				setViewerFileUrl('')
				return
			}

			try {
				setMediaLoading(true)
				setMediaLoadError('')
				setViewerFileUrl('')
				objectUrl = await fetchProtectedMediaBlobUrl(mediaPath, props.frontendSettings, controller.signal)
				setViewerFileUrl(objectUrl)
				setMediaLoading(false)
			} catch (error:any) {
				if (error?.name !== 'AbortError') {
					console.error(error)
					setMediaLoading(false)
					if (error?.status === 401 || error?.status === 403) {
						setMediaLoadError('Unable to load document. Authentication is required.')
					} else {
						setMediaLoadError('Unable to load document. Please check login and permissions.')
					}
					setViewerFileUrl('')
				}
			}
		}

		loadProtectedMedia()

		return () => {
			controller.abort()
			if (objectUrl) URL.revokeObjectURL(objectUrl)
			setNumPages(0)
		}
	}, [papers, selectedPaperIdx, fileAttachmentType, props.frontendSettings, props.currentSettings.loggedin])

	// set section by getting form this api/get_sections/ and dataset_name
	useEffect(()=>{
		let isMounted = true
		const controller = new AbortController()
		const datasetName = props.currentSettings.selectedDataset !== props.currentSettings.defaultDataset
			? props.currentSettings.selectedDataset
			: props.currentSettings.defaultDataset

		if (props.currentSettings.selectedDataset !== props.currentSettings.defaultDataset && props.currentSettings.selectedDataset !== 'None'){
			fetchSections(datasetName, props.frontendSettings, controller.signal)
				.then(data => {
					if (!isMounted) return
					setSections(data.sections && data.sections.length ? data.sections : [])
				})
				.catch((error) => { if (error?.name !== 'AbortError') console.error(error) })
		} else {
			setSections([])
		}
		return () => { isMounted = false; controller.abort() }
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[props.currentSettings.selectedDataset, props.currentSettings.defaultDataset])

	// change answer without context 
	useEffect(()=>{
		setAnswerWithoutContext(props.currentSettings.answerWithoutContext)
	},[props.currentSettings.answerWithoutContext])

	// add demo library
	useEffect(()=>{
		let isMounted = true
		const controller = new AbortController()
		if(addDemoLibrary){
			addDemoLibraryRequest(props.currentSettings.selectedEmbeddingModel, props.frontendSettings, controller.signal)
				.then(data => {
					if (!isMounted) return
					// console.log(data)
					setAddDemoLibrary(false)
					props.settingsCallback({...props.currentSettings, selectedDataset: 'MyGPT', showSettings: false, fetchPapers: true})
				})
				.catch((error) => { if (error?.name !== 'AbortError') console.error(error) })
		}
		return () => { isMounted = false; controller.abort() }
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[addDemoLibrary])
	
	// get context from the backend vector database
	useEffect(()=>{
		if (answerWithoutContext) return
		// setAnswers([])
		// setSourceReceived(false)
		const contextRequestBody = { 
			text: query[query.length-1] && query[query.length-1].question ? query[query.length-1].question.replaceAll('"',"'") : '',
			translated_text: translatedQuery ? translatedQuery.replaceAll('"',"'") : '',
			language_of_docs: DatasetLanguage,
			model_type: props.currentSettings.selectedLlm,
			dataset: props.currentSettings.selectedDataset !== props.currentSettings.defaultDataset ? props.currentSettings.selectedDataset : props.currentSettings.defaultDataset,
			new_conversation: query.length === 1 ? true : false,
			focused_document_titles: focusedPapers.length ? focusedPapers : [],
			focused_section: focusedSection ? focusedSection.split(' (')[0] : '',
			maximum_chunks_count: parseInt(props.currentSettings.maximum_chunks_count, 10),
			no_cutoff: props.currentSettings.no_chunk_cutoff,
			related_query: relatedQuery,
			previous_query: query.length > 1 ? query[query.length-2].question.replaceAll('"',"'") : '',
			no_context: answerWithoutContext,
			sentence_transformer: props.currentSettings.selected_sentence_transformer,
			use_default_qrs: props.currentSettings.use_default_qrs,
			question_best_distance: props.currentSettings.relevance_score_cutoff.question_best,
			question_worst_distance: props.currentSettings.relevance_score_cutoff.question_worst,
		}
		const postDataWithTools = async () => {
			const toolsBody:any = {
				'model': props.currentSettings.selectedLlm,
				'messages': [
					{
						'role': 'system',
						'content': props.currentSettings.system_prompt
					},
					{
						'role': 'user',
						'content': query[query.length-1] && query[query.length-1].question ? query[query.length-1].question.replaceAll('"',"'") : ''
					}
				],
				'stream': false,
				'tools': mcpOllamaTools,
				'options': {
					'temperature': parseFloat(props.currentSettings.temperature),
					'top_k': parseInt(props.currentSettings.top_k, 10),
					'top_p': parseFloat(props.currentSettings.top_p),
				}
			}
			const body = JSON.stringify(toolsBody)
			let stream = false
			let returnToolResponse = true
			// fetch using async await and wait for the response and then call the getContext function
			const ollamaData:any = await Promise.resolve(OllamaChatStreamWithToolSupport(body, ()=>{}, props.currentSettings.MCPTools, props.currentSettings.MCPClient, stream, returnToolResponse, isThinkStepSupported ? setThought : null))
			if (ollamaData && ollamaData.answerReceived) {
				setAnswerReceived(ollamaData.answerReceived)
				let answer = ollamaData.content;
				contextRequestBody['text'] = contextRequestBody['text'] + '<tool_response>' + answer + '</tool_response>';
				setMcpResponse(answer)
				getContext();
			}
		}

		const getContext = () => {
			setRelatedQuery(false)
				fetchContext(contextRequestBody, props.frontendSettings)
					.then((data:any) => {
						if (data.relevance_score === 0){
							setQuestionRelevancescore((prevQuestionRelevancescore:any)=>[...prevQuestionRelevancescore, data.relevance_score])
							setContext('None')
							setSourcePapers((prevSourcePapers:any)=>[...prevSourcePapers, []])
							setSourceContexts((prevSourceContexts:any)=>[...prevSourceContexts, []])
							setSourceColorCodes((prevSourceColorCodes:any)=>[...prevSourceColorCodes, []])
							if (papers.length){
								setSourcePages((prevSourcePages:any)=>[...prevSourcePages, []])
							}else if (videos.length){
								setSourceStarts((prevSourceStarts:any)=>[...prevSourceStarts, []])
								setSourceStops((prevSourceStops:any)=>[...prevSourceStops, []])
							}
							setAnswerReceived(false)
							setTranslatedAnswerReceived(false)
						}else{
							setQuestionRelevancescore((prevQuestionRelevancescore:any)=>[...prevQuestionRelevancescore, data.relevance_score])
							setContext(data.context)
							setSourcePapers((prevSourcePapers:any)=>[...prevSourcePapers, data.sources.map((s:any)=>s.document)])
							setSourceContexts((prevSourceContexts:any)=>[...prevSourceContexts, data.sources.map((s:any)=>s.context)])
							setSourceColorCodes((prevSourceColorCodes:any)=>[...prevSourceColorCodes, data.sources.map((s:any)=> s.color_code)]);
							if (data.sources[0].page !== ''){
								setSourcePages((prevSourcePages:any)=>[...prevSourcePages, data.sources.map((s:any)=>s.page)])
								setSelectedPage(data.sources[0].page)
								const paperIndex:number = papers.findIndex((p:any)=>p.paper_title === data.sources[0].document)
								setselectedPaperIdx(paperIndex)
								setFileAttachmentType('highlighted_attachment')
								setPapers([])
							} else if (data.sources[0].start !== 0){
								setSourceStarts((prevSourceStarts:any)=>[...prevSourceStarts, data.sources.map((s:any)=>s.start)])
								setSourceStops((prevSourceStops:any)=>[...prevSourceStops, data.sources.map((s:any)=>s.stop)])
								const videoIndex:number = videos.findIndex((v:any)=>v.video_title === data.sources[0].document)
								setselectedPaperIdx(videoIndex)
							}
							setAnswerReceived(false)
							setTranslatedAnswerReceived(false)
						}
					})
					.catch((error) => { console.error(error) })
				}

			if(query.length && query.length !== answers.length){
				// setSelectedPage(0)
				// setselectedPaperIdx(0)
				if (llmsWithToolSupport.includes(props.currentSettings.selectedLlm.split(':')[0]) && mcpOllamaTools.length > 0){
					postDataWithTools()
				}
				else {
					if (DatasetLanguage !== 'english' && translatedQueryReceived){
						getContext()
					} else if (DatasetLanguage === 'english'){
						getContext()
					}
				}

				if (llmswithThinkStepSupport.includes(props.currentSettings.selectedLlm.split(':')[0])){
					setThinkAllowed(true)
				} else {
					setThinkAllowed(false)
				}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[query, translatedQueryReceived])

	// get answer from the ollama
	useEffect(()=>{
		if (answerWithoutContext) return
		const question =  query[query.length-1] && query[query.length-1].question ? query[query.length-1].question.replaceAll('"',"'") : ''
		const systemPrompt = props.currentSettings.system_prompt + context
		
		let addToolsPromt: boolean = false
		if (llmsWithToolSupport.includes(props.currentSettings.selectedLlm.split(':')[0]) && mcpOllamaTools.length > 0){
			addToolsPromt = true
		}
		
		if(context.length > 1 && question.length > 1){
			const postData = async () => {
				let answerReceived:any = null
				if (props.currentSettings.LLM_server_API_specs === 'ollama'){
					answerReceived = await OllamaDirectGenerateStream(
						props.currentSettings.selectedLlm, 
						question, systemPrompt, addToolsPromt, mcpResponse,
						props.currentSettings.temperature, props.currentSettings.top_k, props.currentSettings.top_p, 
						setAnswer, isThinkStepSupported ? setThought : null
					)
				} else if (props.currentSettings.LLM_server_API_specs === 'sjray'){
					answerReceived = await SJRayDirectGenerateStream(
						props.currentSettings.selectedLlm, 
						question, systemPrompt, addToolsPromt, mcpResponse,
						props.currentSettings.temperature, props.currentSettings.top_k, props.currentSettings.top_p, 
						setAnswer
					)
				} else if (props.currentSettings.LLM_server_API_specs === 'openai'){
					
				}
				setAnswerReceived(answerReceived)
			}
			postData()
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[query, context, props.currentSettings.selectedLlm])

	// get null answer from ollama without context 
	useEffect(()=>{
		if (answerWithoutContext) return
		const question =  query[query.length-1] && query[query.length-1].question ? query[query.length-1].question.replaceAll('"',"'") : ''
		const systemPrompt = props.currentSettings.direct_chat_system_prompt
		
		if(context.length > 1 && question.length > 1 && nullAnswer === ''){

			const postData = async () => {
				let nullAnswerReceived:any = null
				if (props.currentSettings.LLM_server_API_specs === 'ollama'){
					nullAnswerReceived = await OllamaDirectGenerateStream(
						props.currentSettings.selectedLlm, 
						question, systemPrompt, false, '',
						props.currentSettings.temperature, props.currentSettings.top_k, props.currentSettings.top_p, 
						setNullAnswer, isThinkStepSupported ? setNullThought : null
					)
				} else if (props.currentSettings.LLM_server_API_specs === 'sjray'){
					nullAnswerReceived = await SJRayDirectGenerateStream(
						props.currentSettings.selectedLlm, 
						question, systemPrompt, false, '',
						props.currentSettings.temperature, props.currentSettings.top_k, props.currentSettings.top_p, 
						setNullAnswer
					)
				}
				setNullAnswerReceived(nullAnswerReceived)
			}
			postData()
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[query, context, props.currentSettings.selectedLlm, nullAnswer])

	// get translated query if dataset language is different than english
	useEffect(()=>{
		if (answerWithoutContext) return
		if (DatasetLanguage === 'english' || DatasetLanguage === '') {
			setTranslatedQuery('')
			return
		}
		const postData = async () => {
			if (props.currentSettings.LLM_server_API_specs === 'ollama'){
				let language_from_full = 'English'
				let language_from = 'en'
				let language_to_full = DatasetLanguage !== '-' ? supportedDatasetLanguages[DatasetLanguage].language_to_full : ''
				let language_to = DatasetLanguage !== '-' ? supportedDatasetLanguages[DatasetLanguage].language_to : ''
				let systemPrompt = `You are a professional ${language_from_full} (${language_from}) to ${language_to_full} (${language_to}) translator. Your goal is to accurately convey the meaning and nuances of the original ${language_from_full} text while adhering to ${language_to_full} grammar, vocabulary, and cultural sensitivities. Produce only the ${language_to_full} translation, without any additional explanations or commentary. Please translate the following ${language_from_full} text into ${language_to_full}: `
				const translatedQueryReceived = await OllamaDirectGenerateNoStream(
					'translategemma:latest', 
					query[query.length-1] && query[query.length-1].question ? query[query.length-1].question.replaceAll('"',"'") : '',
					systemPrompt,
					false,
					'',
					props.currentSettings.temperature, props.currentSettings.top_k, props.currentSettings.top_p, 
					setTranslatedQuery, false
				)
				setTranslatedQueryReceived(translatedQueryReceived)
			}
		}
		postData()
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[query, DatasetLanguage])

	// get translated answer if dataset language is different than english
	useEffect(()=>{
		if (answerWithoutContext) return
		if (!answerReceived || answer.length === 0) return
		if (DatasetLanguage === 'english' || DatasetLanguage === '') {
			setTranslatedAnswer('')
			return
		}
		const postData = async () => {
			if (props.currentSettings.LLM_server_API_specs === 'ollama'){
				let language_from_full = 'English'
				let language_from = 'en'
				let language_to_full = supportedDatasetLanguages[DatasetLanguage].language_to_full
				let language_to = supportedDatasetLanguages[DatasetLanguage].language_to
				let systemPrompt = `You are a professional ${language_from_full} (${language_from}) to ${language_to_full} (${language_to}) translator. Your goal is to accurately convey the meaning and nuances of the original ${language_from_full} text while adhering to ${language_to_full} grammar, vocabulary, and cultural sensitivities. Produce only the ${language_to_full} translation, without any additional explanations or commentary. Please translate the following ${language_from_full} text into ${language_to_full}: `
				const translatedAnswerReceived = await OllamaDirectGenerateNoStream(
					'translategemma:latest', 
					answer,
					systemPrompt,
					false,
					'',
					props.currentSettings.temperature, props.currentSettings.top_k, props.currentSettings.top_p, 
					setTranslatedAnswer, false
				)
				setTranslatedAnswerReceived(translatedAnswerReceived)
			}
		}
		postData()
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[answer, answerReceived, DatasetLanguage])

	useEffect(()=>{
		if (answerReceived && answer.length !== 0){
			setAnswers((prevAnswers:any)=>[...prevAnswers, {'response': answer, 'source': props.currentSettings.selectedLlm}])
			setThoughts((prevThoughts:any)=>[...prevThoughts, thought])
			setThought('')
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[answer, props.currentSettings.selectedLlm, answerReceived])

	useEffect(()=>{
		if (nullAnswerReceived && nullAnswer.length !== 0){
			setNullAnswers((prevNullAnswers:any)=>[...prevNullAnswers, nullAnswer])
			setNullThoughts((prevNullThoughts:any)=>[...prevNullThoughts, nullThought])
			setNullThought('')
			setShowNullAnswerIndexes((prevShowNullAnswerIndexes:any)=>[...prevShowNullAnswerIndexes, false])
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[nullAnswer, nullAnswerReceived])

	// save answer to backend database
	useEffect(()=>{
		if(answers.length && query.length && nullAnswer.length && nullAnswerReceived && answerReceived && query.length === answers.length){
			if (DatasetLanguage !== 'english' && !translatedAnswerReceived) return
			const body = { 
				question_text: query[query.length-1].question.replaceAll('"',"'"),
				answer_text: answers[answers.length-1].response.replaceAll('"',"'"),
				translated_answer_text: translatedAnswer.replaceAll('"',"'"),
				answer_no_context_text: nullAnswer.replaceAll('"',"'"),
				model_type: answers[answers.length-1].source,
				dataset: props.currentSettings.selectedDataset !== props.currentSettings.defaultDataset ? props.currentSettings.selectedDataset : props.currentSettings.defaultDataset,
				sentence_transformer: props.currentSettings.selected_sentence_transformer,
				no_context: answerWithoutContext,
				use_default_ars: props.currentSettings.use_default_ars,
				answer_best_distance: props.currentSettings.relevance_score_cutoff.answer_best,
				answer_worst_distance: props.currentSettings.relevance_score_cutoff.answer_worst,
				use_default_hi: props.currentSettings.use_default_hi,
				QRS_p: props.currentSettings.relevance_score_cutoff.QRS_p,
				ARS_q: props.currentSettings.relevance_score_cutoff.ARS_q,
				HI_by_equation: props.currentSettings.relevance_score_cutoff.HI_by_equation,
				temperature: props.currentSettings.temperature,
				top_k: props.currentSettings.top_k,
				top_p: props.currentSettings.top_p,
			}
			saveAnswer(body, props.frontendSettings)
				.then(data => {
					// console.log(data)
					setAnswerRelevancescore((prevAnswerRelevancescore:any)=>[...prevAnswerRelevancescore, data.relevance_score])
					setHallucinationIndex((prevHallucinationIndex:any)=>[...prevHallucinationIndex, data.hallucination_index_by_ml])
					setContext('')
					setAnswer('')
					setNullAnswer('')
					setNullAnswerReceived(false)
					setAnswerReceived(false)
					setTranslatedAnswer('')
					setTranslatedAnswerReceived(false)
				})
				.catch((error) => console.error(error))
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[answers, nullAnswer, nullAnswerReceived, translatedAnswerReceived, query, props.currentSettings.selectedDataset, props.currentSettings.defaultDataset, props.currentSettings.selected_sentence_transformer, answerWithoutContext])

	// get answer from ollama without context while chatting to LLM without documents
	useEffect(()=>{
		if (!answerWithoutContext) return
		const messages:any = []
		if (query.length && query.length !== answers.length){
			for (let i=0; i<query.length; i++){
				messages.push({
					'role': 'user',
					'content': query[i].question,
					'images': imageBase64.length ? imageBase64 : []
				})
				if (answers.length > i){
					messages.push({
						'role': 'assistant',
						'content': answers[i].response
					})
				}
			}
		}
		
		const body_:any = {
			'model': props.currentSettings.selectedLlm,
			'messages': messages,
			'stream': true,
			'options': {
				'temperature': props.currentSettings.temperature,
				'top_k': props.currentSettings.top_k,
				'top_p': props.currentSettings.top_p,
			},
			'new_conversation': query.length === 1 ? true : false,
		}

		if (llmsWithToolSupport.includes(props.currentSettings.selectedLlm.split(':')[0]) && props.currentSettings.MCPTools && props.currentSettings.MCPTools.length){
			body_['tools'] = mcpOllamaTools
			body_['stream'] = false
		}

		const body = JSON.stringify(body_)
		console.log(props.currentSettings.MCPTools, mcpOllamaTools)
		
		if(messages.length > 0 && answer === '' && !answerReceived && mcpOllamaTools.length === 0){
			// fetch using async await
			const postData = async () => {
				const data = await OllamaDirectChatStream(body, setAnswer, isThinkStepSupported ? setThought : null)
				let answerReceived = data.answerReceived
				setAnswerReceived(answerReceived)
			}
			postData()
		}

		else if (messages.length > 0 && answer === '' && !answerReceived && llmsWithToolSupport.includes(props.currentSettings.selectedLlm.split(':')[0]) && mcpOllamaTools.length){
			
			const postDataWithTools = async () => {
				// fetch using async await
				let stream = true
				let returnToolResponse = false
				const data = await OllamaChatStreamWithToolSupport(body, setAnswer, props.currentSettings.MCPTools, props.currentSettings.MCPClient, stream, returnToolResponse, isThinkStepSupported ? setThought : null)
				setAnswerReceived(data.answerReceived)
			}
			postDataWithTools()
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[query, props.currentSettings.selectedLlm, answerWithoutContext])

	// save answer to backend database without context
	useEffect(()=>{
		if(answers.length && query.length && answer.length !== 0 && answerReceived && query.length === answers.length && answerWithoutContext){
			const body = { 
				question_text: query[query.length-1].question.replaceAll('"',"'"),
				answer_text: answer.replaceAll('"',"'"),
				answer_no_context_text: '',
				model_type: props.currentSettings.selectedLlm,
				dataset: props.currentSettings.selectedDataset !== props.currentSettings.defaultDataset ? props.currentSettings.selectedDataset : props.currentSettings.defaultDataset,
				sentence_transformer: props.currentSettings.selected_sentence_transformer,
				no_context: answerWithoutContext,
				use_default_ars: props.currentSettings.use_default_ars,
				answer_best_distance: props.currentSettings.relevance_score_cutoff.answer_best,
				answer_worst_distance: props.currentSettings.relevance_score_cutoff.answer_worst,
				use_default_hi: props.currentSettings.use_default_hi,
				QRS_p: props.currentSettings.relevance_score_cutoff.QRS_p,
				ARS_q: props.currentSettings.relevance_score_cutoff.ARS_q,
				HI_by_equation: props.currentSettings.relevance_score_cutoff.HI_by_equation,
				temperature: props.currentSettings.temperature,
				top_k: props.currentSettings.top_k,
				top_p: props.currentSettings.top_p,
			}
			saveAnswer(body, props.frontendSettings)
				.then(data => {
					// console.log(data)
					setAnswerRelevancescore((prevAnswerRelevancescore:any)=>[...prevAnswerRelevancescore, data.relevance_score])
					setHallucinationIndex((prevHallucinationIndex:any)=>[...prevHallucinationIndex, data.hallucination_index_by_ml])
					setAnswer('')
					setAnswerReceived(false)
				})
				.catch((error) => console.error(error))
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[answers, query, answerWithoutContext, answerReceived, answer])

	useEffect(() => {
		if (selectedPage > 0) jumpToPage(selectedPage)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedPage])

	// After the PDF finishes loading, re-attempt the scroll; then refine to the highlighted mark element.
	useEffect(() => {
		if (numPages > 0 && selectedPage > 0) {
			requestAnimationFrame(() => {
				jumpToPage(selectedPage)
				// Second RAF: after the page scroll, nudge to the first highlighted mark on that page.
				requestAnimationFrame(() => {
					const pageEl = document.getElementById(`pdf-page-${selectedPage}`)
					const markEl = pageEl?.querySelector('span[aria-hidden="true"]') as HTMLElement | null
					const container = scrollAreaRef.current
					if (markEl && container) {
						const markTop = markEl.getBoundingClientRect().top
						const containerTop = container.getBoundingClientRect().top
						container.scrollTop += (markTop - containerTop) - 40
					}
				})
			})
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [numPages])

	const scrollAreaRef = useRef<HTMLDivElement>(null)

	const jumpToPage = (page: number) => {
		setViewerPage(page)
		const container = scrollAreaRef.current
		const el = document.getElementById(`pdf-page-${page}`)
		if (el && container) container.scrollTop = el.offsetTop - container.offsetTop
	}

	// Update viewerPage indicator as user scrolls
	useEffect(() => {
		const container = scrollAreaRef.current
		if (!container || !numPages) return
		const handleScroll = () => {
			const containerTop = container.getBoundingClientRect().top
			for (let i = numPages; i >= 1; i--) {
				const el = document.getElementById(`pdf-page-${i}`)
				if (el && el.getBoundingClientRect().top <= containerTop + 80) {
					setViewerPage(i)
					break
				}
			}
		}
		container.addEventListener('scroll', handleScroll)
		return () => container.removeEventListener('scroll', handleScroll)
	}, [numPages])

	// Thumbnail panel drag-to-resize
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!isDraggingThumb.current) return
			const row = document.querySelector('.pdf-viewer-row') as HTMLElement
			if (!row) return
			const sidebarWidth = 32
			const newWidth = Math.max(80, Math.min(300, e.clientX - row.getBoundingClientRect().left - sidebarWidth))
			setThumbnailWidth(newWidth)
		}
		const handleMouseUp = () => { isDraggingThumb.current = false }
		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)
		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [])

	useEffect(()=>{
		if (props.currentSettings.MCPTools && props.currentSettings.MCPTools.length){
			const mcpOllamaTools = props.currentSettings.MCP_tools.map((tool:any)=>{
				return {
					type: 'function',
					function: {
						name: tool.name,
						description: tool.description,
						parameters: {
							type: 'object',
							required: tool.inputSchema.required || [],
							properties: Object.entries(tool.inputSchema.properties).reduce((acc:any, property:any) => {
								acc[property[0]] = {
									type: property[1].type,
									description: property[1].title || ''
								};
								return acc;
							}, {})
						}
					},
				}
			})
			setMcpOllamaTools(mcpOllamaTools)
		}
    // eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.currentSettings.MCP_tools])

	// Collapse thinking section after answer is generated
	useEffect(() => {
		if (answers && answers.length && answers[answers.length-1]?.response?.length > 0) {
			setMinimizedThinking(true);
		}
	}, [answers]);



	const resetStates = () => {
		setQuery([])
		setAnswers([])
		setThoughts([])
		setNullAnswers([])
		setNullThoughts([])
		setShowNullAnswerIndexes([])
		setQuestionRelevancescore([])
		setAnswerRelevancescore([])
		setHallucinationIndex([])
		setSourcePapers([])
		setSourcePages([])
		setSourceContexts([])
		setSourceColorCodes([])
		setFocusedSection(null)
		setselectedPaperIdx(0)
		setSelectedPage(0)
		setFileAttachmentType('paper_attachment')
		setContext('')
		setAnswer('')
		setThought('')
		setNullAnswer('')
	}

	const selectedChatMode = answerWithoutContext ? 'direct_chat' : 'with_documents'

	const onChatModeChange = (mode: string) => {
		if (mode === 'chat_with_documents') {
			setAnswerWithoutContext(true)
			resetStates()
			props.settingsCallback({ ...props.currentSettings, selectedDataset: selectedDataset, answerWithoutContext: false, fetchPapers: true })
			return
		} else if (mode === 'direct_chat') {
			setAnswerWithoutContext(false)
			resetStates()
			setSelectedDataset(props.currentSettings.selectedDataset)
			props.settingsCallback({ ...props.currentSettings, selectedDataset: props.currentSettings.selectedLlm + '_direct_chat', answerWithoutContext: true, fetchPapers: false })
			return
		}
		// else if (mode === 'workflow_for_documents') {
		// 	setAnswerWithoutContext(true)
		// 	resetStates()
		// 	props.settingsCallback({ ...props.currentSettings, selectedDataset: selectedDataset, answerWithoutContext: false, fetchPapers: true })
		// 	return
		// }
	}

	const hasFocusedDocuments = focusedPapers.length > 0
	const isFocusedDocument = (title: string) => focusedPapers.includes(title)
	const canLoadDemoLibraryWithoutLogin =
		!props.currentSettings.loggedin &&
		props.frontendSettings &&
		!props.frontendSettings.django_login &&
		!props.frontendSettings.azure_login &&
		props.currentSettings?.datasets?.length === 0

	const [panelWidths, setPanelWidths] = useState({ left: 30, middle: 20, right: 50 })
	const [panelCollapsed, setPanelCollapsed] = useState({ left: false, middle: false, right: false })
	const savedExpandedWidthsRef = useRef({ left: 30, middle: 20, right: 50 })

	const COLLAPSED_WIDTH = 4
	const MIN_WIDTHS = { left: 30, middle: 20, right: 50 }

	const distributeRemaining = (base: any, targetPanel: 'left' | 'middle' | 'right', delta: number) => {
		if (delta <= 0) return base
		const others = (['left', 'middle', 'right'] as const).filter((p) => p !== targetPanel)
		const next = { ...base }
		const openOthers = others.filter((p) => !panelCollapsed[p])
		if (!openOthers.length) return next
		const share = delta / openOthers.length
		openOthers.forEach((p) => {
			next[p] += share
		})
		return next
	}

	const collapsePanel = (panel: 'left' | 'middle' | 'right') => {
		if (panelCollapsed[panel]) return
		savedExpandedWidthsRef.current[panel] = panelWidths[panel]
		const delta = Math.max(panelWidths[panel] - COLLAPSED_WIDTH, 0)
		let next = { ...panelWidths, [panel]: COLLAPSED_WIDTH }
		next = distributeRemaining(next, panel, delta)
		setPanelWidths(next)
		setPanelCollapsed((prev) => ({ ...prev, [panel]: true }))
	}

	const expandPanel = (panel: 'left' | 'middle' | 'right') => {
		if (!panelCollapsed[panel]) return
		const desired = Math.max(savedExpandedWidthsRef.current[panel], MIN_WIDTHS[panel])
		let next = { ...panelWidths }
		next[panel] = desired
		let needed = desired - COLLAPSED_WIDTH
		const donors = (['left', 'middle', 'right'] as const).filter((p) => p !== panel && !panelCollapsed[p])
		for (const donor of donors) {
			if (needed <= 0) break
			const minDonor = MIN_WIDTHS[donor]
			const available = Math.max(next[donor] - minDonor, 0)
			const take = Math.min(available, needed)
			next[donor] -= take
			needed -= take
		}
		setPanelWidths(next)
		setPanelCollapsed((prev) => ({ ...prev, [panel]: false }))
	}

	return (
		<div className='p-4 pt-28 pb-3 bg-gray-200 dark:bg-neutral-800 max-w-[2000px] w-full mx-auto flex-1 min-h-0 flex flex-col overflow-hidden'>
			<div className='flex-1 min-h-0 flex w-full items-stretch overflow-hidden'>
			{/* Panel for Chat */}
			{!answerWithoutContext && panelCollapsed.left ? (
				<div style={{ width: `${panelWidths.left}%` }} className='bg-panel3 mx-2 dark:bg-panel2-dark rounded-lg h-full min-h-0 flex flex-col items-center justify-start relative pt-2'>
					<button
						title='Expand Chat panel'
						className='absolute mx-auto top-2 p-2 rounded-md bg-white dark:bg-stjude dark:text-white text-nav'
						onClick={() => expandPanel('left')}
					>
						<ArrowsPointingOutIcon className='w-4 h-4' />
					</button>
					<ChatBubbleLeftRightIcon className=' w-6 h-6 mt-12 text-nav dark:text-white' />
					<div className='text-xl mt-4 text-nav dark:text-white [writing-mode:vertical-rl] rotate-180'>Chat</div>
				</div>
			) : (
			<div
				style={{ width: answerWithoutContext ? '100%' : `${panelWidths.left}%` }}
				className='p-6 mr-2 bg-panel3 dark:bg-panel2-dark rounded-lg h-full max-h-full min-h-0 overflow-y-auto duration-300 ease-in-out relative flex flex-col'
			>
				{!answerWithoutContext ? (
					<button
						title='Collapse Q&A panel'
						className='absolute right-2 top-2 p-1 rounded-md bg-white dark:bg-stjude dark:text-white text-nav z-10'
						onClick={() => collapsePanel('left')}
					>
						<ArrowsPointingInIcon className='w-4 h-4' />
					</button>
				) : null}
				{/* Chat mode dropdown at the top */}
				<div className="flex justify-center mb-8">
					<select
						className='px-4 py-3 rounded-lg font-semibold text-lg text-white bg-nav dark:bg-gray-500 dark:text-white shadow-md w-72'
						value={selectedChatMode}
						onChange={(e) => onChatModeChange(e.target.value)}
					>
						{chatModeOptions.map((option) => (
							<option key={option.value} value={option.value}>{option.label}</option>
						))}
					</select>
				</div>
				<div className='text-2xl font-bold text-nav dark:text-nav-dark'>Ask a Question</div>
				<div className='text-sm text-nav my-2 dark:text-nav-dark'>
					{ answerWithoutContext ? 'Ask any question to the selected LLM. The LLM will answer based on its pre-existing knowledge.' : 
						'Ask a question about a paper or a topic from your publication library. We will try to answer it using the GPT models.'}</div>
				{ answers.length && answers[answers.length-1].response ?
					<div className='p-1 mx-4 flex justify-center'>
						<button className={'px-2 py-1 mx-4 my-auto bg-white dark:bg-panel3-dark dark:text-nav-dark text-sm hover:bg-bsk_dark_blue text-bsk_dark_blue font-semibold hover:text-white hover:border-transparent rounded-full shadow-md hover:shadow-lg outline-none focus:outline-none' + (answers.length && answers[answers.length-1].response ? '':' opacity-50 cursor-not-allowed')} 
							disabled={answers.length && answers[answers.length-1].response ? false : true}
							onClick={resetStates}>
								<p className='inline-block mx-2'>
									Start a new Chat
								</p>
						</button>
					</div> : <></>
				}
				<div className='mt-4 p-1 mx-4 flex'>
					<div className='text-sm text-nav dark:text-nav-dark my-auto mx-1'>GPT model</div>
					<select 
						className='text-md text-nav bg-panel2 dark:bg-stjude dark:text-white py-1 px-2 mx-2 rounded-md w-32'
						value={props.currentSettings.selectedLlm}
						// defaultValue={props.currentSettings.defaultLlm}
						onChange={(e) => {
							if (answerWithoutContext){
								let temp_dataset = e.target.value + '_direct_chat'
								// setSelectedDataset(temp_dataset)
								props.settingsCallback({...props.currentSettings, selectedLlm: e.target.value, selectedDataset: temp_dataset})
							} else
							props.settingsCallback({...props.currentSettings, selectedLlm: e.target.value})
					}}
					>
						{llms.map((model:any) => {
							return (
								<option key={model} value={model}>{model}</option>
							)
						})}
					</select>
					{ (props.frontendSettings && !props.frontendSettings.restriction_without_login) || (props.frontendSettings.restriction_without_login && props.currentSettings.loggedin) ?
					<div className='mx-1 inline-block px-2 py-1 bg-panel2 dark:bg-stjude dark:text-white rounded-md cursor-pointer hover:bg-slate-200' 
						onClick={()=>{
							props.settingsCallback({...props.currentSettings, selectedPanel: 'chatsettings', showSettings: true})
						}}>
						<Cog6ToothIcon className='w-4 h-4 inline-block'/>
					</div> : <></>}
					
				</div>
				<div className='pt-4 mb-2 flex'>
					{
						props.frontendSettings && props.frontendSettings.disable_chat_without_login && !props.currentSettings.loggedin ?
						<div className='text-sm text-nav my-auto mx-1 bg-white dark:bg-gray-500 dark:text-white rounded-lg w-full h-20 p-2.5 shadow-md'>Login to chat</div> :
						<textarea
							id='submitter' 
							rows={4}
							className='text-gray-900 dark:text-white dark:bg-gray-500 dark:placeholder:text-white text-sm rounded-2xl  block w-5/6 p-2.5 shadow-md' 
							placeholder={props.frontendSettings && props.frontendSettings.disable_chat_without_login && !props.currentSettings.loggedin ? 'Login to chat' : 'Type your question here'}
							value={searchTerm}
							readOnly={props.frontendSettings && props.frontendSettings.disable_chat_without_login && !props.currentSettings.loggedin}
							onChange={(e:any)=>{
								if (!e.target.value.length){
									// setAnswers([])
								}
								setSearchTerm(e.target.value.replace(/\n/g, ''))
							}}
							onKeyUp={
								(e:any)=>{
									if (e.keyCode === 13){
										setThought('')
										setNullThought('')
										setQuery((prevQuery:any)=>[...prevQuery, 
											{'question':searchTerm, 'related': relatedQuery}
										])
										setSearchTerm('')
									}
								}
							}>
						</textarea>
					}
					<button 
						className='p-4 mx-2 my-auto bg-white hover:bg-bsk_dark_blue dark:bg-stjude dark:text-white text-bsk_dark_blue font-semibold hover:text-white py-2 px-3 hover:border-transparent rounded-full shadow-md hover:shadow-lg outline-none focus:outline-none h-12'
						disabled={props.frontendSettings && props.frontendSettings.disable_chat_without_login && !props.currentSettings.loggedin}
						onClick={() => {
							setThought('')
							setNullThought('')
							setQuery((prevQuery:any)=>[...prevQuery, 
									{'question':searchTerm, 'related': relatedQuery}
								])
								setSearchTerm('')
							}
						}
					>
						<p className='inline-block ml-2'><PaperAirplaneIcon className='w-6 h-6 inline-block'/></p>
					</button>
				</div>
				{ props.currentSettings && props.currentSettings.answerWithoutContext && (props.currentSettings.selectedLlm === 'llama3.2-vision:latest' || props.currentSettings.selectedLlm.toLowerCase() === 'gemma3:27b') ?
					<div className='flex flex-row w-40 mx-4'>
					{/* attachment button for images */}
					<label htmlFor="file-upload" className="relative cursor-pointer flex justify-center items-center bg-white dark:bg-gray-500 dark:text-white shadow-md rounded-lg w-8 h-8 p-2 my-auto">
						<PaperClipIcon className='w-6 h-6 text-bsk_dark_blue'/>
					</label>
					<input id="file-upload" type="file" className="hidden" accept="image/*" multiple
						onChange={(e:any)=>{
							const files = Array.from(e.target.files);
							let images:any = []
							let imageBase64 = []
							files.forEach((file:any) => {
								let reader = new FileReader();
								reader.readAsDataURL(file);
								reader.onloadend = () => {
									images.push(reader.result);
									if (images.length === files.length) {
										setImageAttachment(images);
										imageBase64 = images.map((img:any) => img.split(',')[1]);
										setImageBase64(imageBase64);
									}
								};
							});
						}}
					/>
					<div className='text-nav my-auto mx-2'>Upload images</div>

					</div> :<></>}
				{ imageAttachment && imageAttachment.length > 0 ?
				// show images
				<div className='flex flex-col dark:text-white rounded-lg mx-4'>
					{imageAttachment.map((img:any, idx:any) => (
						<div key={idx} className='flex flex-row items-center mb-4'>
							<img src={img} alt={`attachment-${idx}`} className='px-4 h-80'/>
							<button 
								className='px-4 mx-2 bg-bsk_dark_blue dark:bg-stjude dark:text-white text-bsk_dark_blue font-semibold hover:text-white hover:border-transparent rounded-full shadow-md hover:shadow-lg outline-none focus:outline-none h-8'
								onClick={()=>{
									setImageAttachment(imageAttachment.filter((_, i) => i !== idx));
									setImageBase64(prev => prev.filter((_, i) => i !== idx));
								}}
							>
								<p className='text-white my-auto'><XMarkIcon className='w-8 h-8 inline-block'/></p>
							</button>
						</div>
					))}
				</div> : <></>}
				{/* { answers.length && answers[answers.length-1].response && searchTerm.length ?
					<div className='p-1 mx-4 flex'>
						<input type='checkbox' className="mr-2 mt-[0.3rem] h-3.5 w-8 appearance-none rounded-[0.4375rem] bg-neutral-300 before:pointer-events-none before:absolute before:h-3.5 before:w-3.5 before:rounded-full before:bg-transparent before:content-[''] after:absolute after:z-[2] after:-mt-[0.1875rem] after:h-5 after:w-5 after:rounded-full after:border-none after:bg-neutral-100 after:shadow-[0_0px_3px_0_rgb(0_0_0_/_7%),_0_2px_2px_0_rgb(0_0_0_/_4%)] after:transition-[background-color_0.2s,transform_0.2s] after:content-[''] checked:bg-primary checked:after:absolute checked:after:z-[2] checked:after:-mt-[3px] checked:after:ml-[1.0625rem] checked:after:h-5 checked:after:w-5 checked:after:rounded-full checked:after:border-none checked:after:bg-primary checked:after:shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),_0_2px_2px_0_rgba(0,0,0,0.14),_0_1px_5px_0_rgba(0,0,0,0.12)] checked:after:transition-[background-color_0.2s,transform_0.2s] checked:after:content-[''] hover:cursor-pointer focus:outline-none focus:ring-0 focus:before:scale-100 focus:before:opacity-[0.12] focus:before:shadow-[3px_-1px_0px_13px_rgba(0,0,0,0.6)] focus:before:transition-[box-shadow_0.2s,transform_0.2s] focus:after:absolute focus:after:z-[1] focus:after:block focus:after:h-5 focus:after:w-5 focus:after:rounded-full focus:after:content-[''] checked:focus:border-primary checked:focus:bg-primary checked:focus:before:ml-[1.0625rem] checked:focus:before:scale-100 checked:focus:before:shadow-[3px_-1px_0px_13px_#3b71ca] checked:focus:before:transition-[box-shadow_0.2s,transform_0.2s] dark:bg-neutral-600 dark:after:bg-neutral-400 dark:checked:bg-primary dark:checked:after:bg-primary dark:focus:before:shadow-[3px_-1px_0px_13px_rgba(255,255,255,0.4)] dark:checked:focus:before:shadow-[3px_-1px_0px_13px_#3b71ca]"
						role={'switch'}
							onChange={
								(e:any)=>{
									if (e.target.checked){
										setRelatedQuery(true)
									}
								}
							}
						/>
						<p className='inline-block mx-2 text-sm'>
							related to previous question
						</p>
					</div>
					 : null } */}
				{/* show MCP tool name in tags if llm is llama3.1 */}
				{ llmsWithToolSupport.includes(props.currentSettings.selectedLlm.split(':')[0]) && props.currentSettings.MCPTools && props.currentSettings.MCPTools.length > 0 ?
					<div className='flex flex-row flex-wrap'>
						<div className='text-sm text-nav dark:text-nav-dark my-auto mx-1'>MCP Tools:</div>
						{props.currentSettings.MCPTools.map((tool:any, idx:any) => (
							<div key={idx} className='bg-panel2 dark:bg-panel3-dark text-nav dark:text-nav-dark rounded-full px-2 py-1 m-1 text-sm'>
								{tool.name}
							</div>
						))}
					</div>
					: <></>
				}

				{/* { props.frontendSettings && props.frontendSettings.show_no_context_switch ? 
					<div className='p-1 mx-2 flex'>
						<label className='relative flex justify-between items-center group p-2 text-md text-nav dark:text-nav-dark'>
						<input 
							type='checkbox' 
							className='absolute left-1/2 -translate-x-1/2 w-full h-full peer appearance-none rounded-md'
							role={'switch'}
							checked={answerWithoutContext}
							onChange={
								(e:any)=>{
									setAnswerWithoutContext(e.target.checked)
									if (e.target.checked){
										resetStates()
										setSelectedDataset(props.currentSettings.selectedDataset)
										props.settingsCallback({...props.currentSettings, selectedDataset: props.currentSettings.selectedLlm + '_direct_chat', answerWithoutContext: true, fetchPapers: false})
									} else {
										resetStates()
										props.settingsCallback({...props.currentSettings, selectedDataset: selectedDataset, answerWithoutContext: false, fetchPapers: true})
									}
								}
							}
						/>
						<span className='w-10 h-4 flex items-center flex-shrink-0 mx-2 p-0 bg-gray-300 rounded-full duration-300 ease-in-out peer-checked:bg-panel1 dark:peer-checked:bg-stjude after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-md after:duration-300 peer-checked:after:translate-x-6 group-hover:after:translate-x-1'></span>
							Chat to LLM without documents
						</label>
						{/* <input type='checkbox' 
						// className="mr-2 mt-[0.3rem] h-3.5 w-8 appearance-none rounded-[0.4375rem] bg-neutral-300 before:pointer-events-none before:absolute before:h-3.5 before:w-3.5 before:rounded-full before:bg-transparent before:content-[''] after:absolute after:z-[2] after:-mt-[0.1875rem] after:h-5 after:w-5 after:rounded-full after:border-none after:bg-neutral-100 after:shadow-[0_0px_3px_0_rgb(0_0_0_/_7%),_0_2px_2px_0_rgb(0_0_0_/_4%)] after:transition-[background-color_0.2s,transform_0.2s] after:content-[''] checked:bg-primary checked:after:absolute checked:after:z-[2] checked:after:-mt-[3px] checked:after:ml-[1.0625rem] checked:after:h-5 checked:after:w-5 checked:after:rounded-full checked:after:border-none checked:after:bg-primary checked:after:shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),_0_2px_2px_0_rgba(0,0,0,0.14),_0_1px_5px_0_rgba(0,0,0,0.12)] checked:after:transition-[background-color_0.2s,transform_0.2s] checked:after:content-[''] hover:cursor-pointer focus:outline-none focus:ring-0 focus:before:scale-100 focus:before:opacity-[0.12] focus:before:shadow-[3px_-1px_0px_13px_rgba(0,0,0,0.6)] focus:before:transition-[box-shadow_0.2s,transform_0.2s] focus:after:absolute focus:after:z-[1] focus:after:block focus:after:h-5 focus:after:w-5 focus:after:rounded-full focus:after:content-[''] checked:focus:border-primary checked:focus:bg-primary checked:focus:before:ml-[1.0625rem] checked:focus:before:scale-100 checked:focus:before:shadow-[3px_-1px_0px_13px_#3b71ca] checked:focus:before:transition-[box-shadow_0.2s,transform_0.2s] dark:bg-neutral-600 dark:after:bg-neutral-400 dark:checked:bg-primary dark:checked:after:bg-primary dark:focus:before:shadow-[3px_-1px_0px_13px_rgba(255,255,255,0.4)] dark:checked:focus:before:shadow-[3px_-1px_0px_13px_#3b71ca]"
							role={'switch'}
							checked={answerWithoutContext}
							onChange={
								(e:any)=>{
									setAnswerWithoutContext(e.target.checked)
								}
							}
						/>
						<p className='inline-block mx-2 text-sm text-nav'>
							Answer without context
						</p>
					</div>
					 : null } 
					 */}
				{
					query.length ? 
					<>{ query.map((_q:any, i:any)=>(
						<div key={i}>
							<div className={'py-4 px-6 my-4 bg-panel2 dark:bg-panel3-dark rounded-lg shadow-md box2' + (props.currentSettings.darkMode ? ' user-chat-dark' : ' user-chat') }>
								<div className='flex flex-row justify-between font-bold'>
									<div className='text-nav dark:text-nav-dark text-sm py-2'>You</div>
									{
										questionRelevancescore[query.length-i-1] !== undefined  && !answerWithoutContext ? 
										(
											<div className='text-nav dark:text-nav-dark rounded-full text-xs py-2'>
												Relevance 
												<span style={{ backgroundColor: ConfidenceScoreColor(questionRelevancescore[query.length-i-1])}} 
													className= {'py-1 px-2 m-1 rounded-full' + (questionRelevancescore[query.length-i-1] > 80 || questionRelevancescore[query.length-i-1] < 20 ? ' text-white' : ' text-nav')}>
													{questionRelevancescore[query.length-i-1] + '%'}
												</span>
											</div>
										) : ''
									}
									{/* <div className='text-nav text-xs py-2'>{query[query.length-i-1].related ? <LinkIcon className='w-4 h-4 inline-block'/> : null}</div> */}
								</div>
								<div className='text-nav dark:text-nav-dark'>{query[query.length-i-1].question}</div>
							</div>
							{	answers[query.length-i-1] && answers[query.length-i-1].response ?
								// when full answers is ready to display
								<div className={'py-4 px-6 my-4 bg-panel1 dark:bg-panel4-dark rounded-lg shadow-md box2' +  (props.currentSettings.darkMode ? ' llm-chat-dark' : ' llm-chat')}>
								<div className='flex flex-row justify-between font-bold'>
									{/* <div className='text-white text-sm py-2'>
										{answers[query.length-i-1].source.split(':')[0] + ' + MyGPT'}
									</div> */}
									{!answerWithoutContext  ?  
									(
									<div>
										<select 
										className='text-sm text-nav bg-panel3 dark:bg-panel2-dark dark:text-nav-dark p-1 rounded-md inline-block'
										value={showNullAnswerIndexes[query.length-i-1] === true ? 'without_context' : 'with_context'}
										onChange={(e)=>{
											if (e.target.value === 'without_context'){
												setShowNullAnswerIndexes((prevShowNullAnswerIndexes:any)=>[...prevShowNullAnswerIndexes.slice(0, query.length-i-1), true, ...prevShowNullAnswerIndexes.slice(query.length-i)])
											}else{
												setShowNullAnswerIndexes((prevShowNullAnswerIndexes:any)=>[...prevShowNullAnswerIndexes.slice(0, query.length-i-1), false, ...prevShowNullAnswerIndexes.slice(query.length-i)])
											}
										}}
										>
											<option value={'with_context'}>{answers[query.length-i-1].source.split(':')[0] + ' + MyGPT'}</option>
											<option value={'without_context'}>{answers[query.length-i-1].source.split(':')[0]}</option>
										</select>
									</div>
									): (<div className='text-white dark:text-nav-dark text-sm py-2'>{props.currentSettings.selectedLlm}</div>)}
									<div className='flex flex-col items-end py-2'>
									{showNullAnswerIndexes[query.length - i - 1] === false && (
										<div className='text-white text-xs pb-1'>
										{
											answerRelevancescore[query.length-i-1] !== undefined && !answerWithoutContext ? 
											(
												<div className='text-white rounded-full text-xs py-1'>
													Relevance 
													<span style={{ backgroundColor: ConfidenceScoreColor(answerRelevancescore[query.length-i-1])}} 
														className= {'py-1 px-2 m-1 rounded-full' + (answerRelevancescore[query.length-i-1] > 80 || answerRelevancescore[query.length-i-1] < 20 ? ' text-white' : ' text-nav')}>
														{answerRelevancescore[query.length-i-1] + '%'}
													</span>
												</div>
											) : ''
										}
										</div>
										 )}
										{showNullAnswerIndexes[query.length - i - 1] === false && ( 
										<div className='text-white text-xs'>
											{
												hallucinationIndex[query.length-i-1] !== undefined && !answerWithoutContext ? 
												(
													<div className='text-white rounded-full text-xs py-1'>
														Hallucination
														<span style={{ backgroundColor: ConfidenceScoreColor(100 - hallucinationIndex[query.length-i-1])}} 
															className= {'py-1 px-2 m-1 rounded-full' + (hallucinationIndex[query.length-i-1] > 80 || hallucinationIndex[query.length-i-1] < 20 ? ' text-white' : ' text-nav')}>
															{hallucinationIndex[query.length-i-1] + '%'}
														</span>
													</div>
												) : ''
											}
										</div>
										 )}
									</div>
								</div>
								<div className='text-white whitespace-pre-wrap answer-div'>
									{thinkAllowed && thoughts.length > 0 && (
										<div 
											className={'my-2 bg-slate-700 dark:bg-slate-800 rounded-lg border-l-4 border-slate-900 transition-all duration-300 ' + (minimizedThinking ? 'max-h-12 overflow-hidden p-4 opacity-60' : 'max-h-96 p-4')}
											style={{ maxHeight: minimizedThinking ? '3.5rem' : '24rem', overflow: 'hidden' }}
										>
											<div className='flex items-center justify-between mb-2'>
												<div className='text-slate-300 text-sm font-semibold'>💭 Thinking</div>
												<button
													className='text-xs text-slate-200 bg-slate-900 rounded px-2 py-1 ml-2 focus:outline-none border border-slate-400'
													onClick={e => { e.stopPropagation(); setMinimizedThinking(!minimizedThinking); }}
												>
													{minimizedThinking ? 'Expand' : 'Minimize'}
												</button>
											</div>
											<div className={'transition-all duration-300 ' + (minimizedThinking ? 'opacity-0 h-0' : 'opacity-100 h-auto')}
												style={{ height: minimizedThinking ? 0 : 'auto', overflow: minimizedThinking ? 'hidden' : 'visible' }}
											>
												<div className='text-gray-300 text-sm whitespace-pre-wrap overflow-y-auto max-h-48'>
													<MathMarkdown>
														{showNullAnswerIndexes[query.length-i-1] === true? nullThoughts[query.length-i-1] ?? '' : thoughts[query.length-i-1] ?? ''}
													</MathMarkdown>
												</div>
											</div>
										</div>
									)}
									<MathMarkdown>
										{showNullAnswerIndexes[query.length-i-1] === true? nullAnswers[query.length-i-1] ?? '' : answers[query.length-i-1].response ?? ''}
									</MathMarkdown>
								</div>
								<Feedback
									answer={JSON.parse(JSON.stringify(answers[query.length-i-1]))}
									feedbackReceived={(answers[query.length-i-1].rating && answers[query.length-i-1].rating !== 0) ? true : false}
									feedbackCallback={(feedback:any)=>{
										const requestOptions = {
											method: 'POST',
											headers: { 
												'Content-Type': 'application/json',
										'Authorization': `${import.meta.env.PROD ? import.meta.env.VITE_AUTH_TOKEN_PROD : import.meta.env.VITE_AUTH_TOKEN_DEV}`
											},
											body: JSON.stringify({ 
												answer_text: answers[query.length-i-1].response,
												dataset: selectedDataset, 
												rating: feedback.rating,
												user_comment: feedback.user_comment,
											})
										}
										fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/feedback/?format=json`, requestOptions)
											.then(response => response.json())
											.then(data => {
												console.log(data)
											})
									}}
								/>
								{
								showNullAnswerIndexes[query.length - i - 1] === false && questionRelevancescore[query.length-1] > 0 && sourcePapers.length && sourcePages.length && sourcePapers[query.length-i-1] && sourcePages[query.length-i-1] ?
									<>
										<div className='text-white text-sm font-bold pt-4'>
											{sourcePapers[query.length-i-1].length > 1 ? 'Sources' : 'Source'}
										</div>
										{sourcePapers[query.length-i-1].map((paper:any, index:number)=>(
											<div 
												className={ 
													selectedPaperIdx === (papers.findIndex((p:any)=>p.paper_title===paper)) && selectedPage === sourcePages[query.length-i-1][index] ? 
													'bg-slate-600 dark:bg-slate-700':''} 
												key={index} onClick={
												()=>{
													// setSourceIdx(index)
													setselectedPaperIdx(papers.findIndex((p:any)=>p.paper_title===paper))
													setSelectedPage(sourcePages[query.length-i-1][index])
													setFileAttachmentType('highlighted_attachment')
												}}
											>
											<div className='border border-gray-400'></div>
												<div className={'text-white text-sm p-2 font-normal italic ' + (sourceColorCodes[query.length-i-1][index] === 'green' ? 'bg-green-600' : sourceColorCodes[query.length-i-1][index] === 'yellow' ? 'bg-yellow-600' :  sourceColorCodes[query.length-i-1][index] === 'red' ? 'bg-amber-600' : '')}>{'Page ' + (sourcePages[query.length-i-1][index]) + ' of "' + paper + '"'}</div>
												{selectedPaperIdx === (papers.findIndex((p:any)=>p.paper_title===paper)) && selectedPage === sourcePages[query.length-i-1][index] ? 
													<div className='text-white text-sm p-2 bg-slate-600 dark:bg-slate-700'>
														<div className='text-white font-bold'>Context</div>
														{sourceContexts[query.length-i-1][index]}
													</div> : <></>
												}
											</div>
										))}
									</>
									:
									questionRelevancescore[query.length-1] > 0 && sourcePapers.length && sourceStarts.length && sourcePapers[query.length-1] && sourceStarts[query.length-1] && sourceStops.length && sourceStops[query.length-1] ?
									<>
									<div className='text-white text-sm font-bold pt-4'>
											{sourcePapers[query.length-i-1].length > 1 ? 'Sources' : 'Source'}
										</div>
										{sourcePapers[query.length-i-1].map((paper:any, index:number)=>(
											<div 
												className={ 
													selectedPaperIdx === (videos.findIndex((p:any)=>p.video_title===paper)) && 
													selectedStart === parseInt(sourceStarts[query.length-i-1][index].split(':')[0])*3600 + parseInt(sourceStarts[query.length-i-1][index].split(':')[1])*60 + parseInt(sourceStarts[query.length-i-1][index].split(':')[2]) ? 
													'bg-slate-500':''} 
												key={index} onClick={
												()=>{
													// setSourceIdx(index)
													setselectedPaperIdx(videos.findIndex((p:any)=>p.video_title===paper))
													const start = sourceStarts[query.length-i-1][index].split(':')
													const stop = sourceStops[query.length-i-1][index].split(':')
													// convert hhmmss to seconds
													let start_time = parseInt(start[0])*3600 + parseInt(start[1])*60 + parseInt(start[2])
													let stop_time = parseInt(stop[0])*3600 + parseInt(stop[1])*60 + parseInt(stop[2])
													setSelectedStart(start_time)
													setSelectedStop(stop_time)
												}}
											>
											<div className='border border-gray-400'></div>
												<div className='text-white text-sm p-2 font-normal italic'>{sourceStarts[query.length-i-1][index] + ' to ' + sourceStops[query.length-i-1][index] + ' of "' + paper + '"'}</div>
												{selectedPaperIdx === (papers.findIndex((p:any)=>p.paper_title===paper)) && selectedPage === sourcePages[query.length-i-1][index] ? 
													<div className='text-white text-sm p-2 bg-slate-500 dark:bg-slate-700'>
														<div className='text-white font-bold'>Context</div>
														{sourceContexts[query.length-i-1][index]}
													</div> : <></>
												}
											</div>
										))}
									</>
									: <></>
									}
								</div> 
								: (
								// when answer is being generated
								<div className={'py-4 px-6 my-4 bg-panel1 dark:bg-panel4-dark rounded-lg shadow-md box2' + (props.currentSettings.darkMode ? ' llm-chat-dark' : ' llm-chat')}>
									<div className='flex flex-row justify-between font-bold'>
										{!answerWithoutContext ?
											(<div className='text-white text-sm py-1'>{props.currentSettings.selectedLlm + ' + MyGPT'}</div>)
											:(<div className='text-white dark:text-nav-dark text-sm py-2'>{props.currentSettings.selectedLlm}</div>)
										} 
									</div>
									{thought.length > 0 && (
										<div className='mb-4 p-4 bg-slate-700 dark:bg-slate-800 rounded-lg border-l-4 border-blue-500'>
											<div className='text-blue-300 text-sm font-semibold mb-2'>💭 Thinking...</div>
											<div className='text-gray-300 text-sm whitespace-pre-wrap'>
												<MathMarkdown>
													{thought}
												</MathMarkdown>
											</div>
										</div>
									)}
									<div className='text-white whitespace-pre-wrap answer-div'>
										<MathMarkdown>
											{answer.length ? answer: 'Generating answer...'}
										</MathMarkdown>
									</div>
									{
									questionRelevancescore[query.length-1] > 0 && sourcePapers.length && sourcePages.length && sourcePages[query.length-1] && sourcePapers[query.length-1] ?
									<>
										<div className='text-white text-sm font-bold pt-4'>
											{sourcePapers[query.length-1].length > 1 ? 'Sources' : 'Source'}
										</div>
										{sourcePapers[query.length-1].map((paper:any, index:number)=>(
											<div 
												className={ 
													selectedPaperIdx === (videos.findIndex((p:any)=>p.video_title===paper)) && 
													selectedStart === parseInt(sourceStarts[query.length-i-1][index].split(':')[0])*3600 + parseInt(sourceStarts[query.length-i-1][index].split(':')[1])*60 + parseInt(sourceStarts[query.length-i-1][index].split(':')[2]) ? 
													'bg-slate-500':''} 
												key={index} onClick={
												()=>{
													// setSourceIdx(index)
													setselectedPaperIdx(papers.findIndex((p:any)=>p.paper_title===paper))
													setSelectedPage(sourcePages[query.length-1][index])
													setFileAttachmentType('highlighted_attachment')
												}}
											>
												<div className='border border-gray-400'></div>
												<div className={'text-white text-sm p-2 font-normal italic ' + (sourceColorCodes[query.length-i-1][index] === 'green' ? 'bg-green-600' : sourceColorCodes[query.length-i-1][index] === 'yellow' ? 'bg-yellow-600' :  sourceColorCodes[query.length-i-1][index] === 'red' ? 'bg-amber-600' : '')}>{'Page ' + (sourcePages[query.length-i-1][index]) + ' of "' + paper + '"'}</div>
											</div>
										))}
									</>:
									questionRelevancescore[query.length-1] > 0 && sourcePapers.length && sourceStarts.length && sourceStarts[query.length-1] && sourcePapers[query.length-1] && sourceStops.length && sourceStops[query.length-1] ?
									<>
									<div className='text-white text-sm font-bold pt-4'>
											{sourcePapers[query.length-i-1].length > 1 ? 'Sources' : 'Source'}
										</div>
										{sourcePapers[query.length-i-1].map((paper:any, index:number)=>(
											<div 
												// className={ 
												// 	selectedPaperIdx === (papers.findIndex((p:any)=>p.paper_title===paper)) && selectedPage === sourcePages[query.length-i-1][index] ? 
												// 	'bg-slate-500':''} 
												key={index} onClick={
												()=>{
													// setSourceIdx(index)
													setselectedPaperIdx(videos.findIndex((p:any)=>p.video_title===paper))
													const start = sourceStarts[query.length-i-1][index].split(':')
													const stop = sourceStops[query.length-i-1][index].split(':')
													// convert hhmmss to seconds
													let start_time = parseInt(start[0])*3600 + parseInt(start[1])*60 + parseInt(start[2])
													let stop_time = parseInt(stop[0])*3600 + parseInt(stop[1])*60 + parseInt(stop[2])
													setSelectedStart(start_time)
													setSelectedStop(stop_time)
												}}
											>
											<div className='border border-gray-400'></div>
												<div className='text-white text-sm p-2 font-normal italic'>{sourceStarts[query.length-i-1][index] + ' to ' + sourceStops[query.length-i-1][index] + ' of "' + paper + '"'}</div>
											</div>
										))}
									</>
									: <></>
									}
								</div>
								)
							}
						</div>
				))}</> : query.length && !answers.length ?
						<div className='inline-block mx-2 my-1 text-center font-bold w-full text-nav'>Loading...</div> :
						null
				}
			</div>
			)}

			{ !answerWithoutContext ? 
			<>
			{/* Panel for list of documents for the selected library */}				
			{panelCollapsed.middle ? (
				<div style={{ width: `${panelWidths.middle}%` }} className='bg-panel1 dark:bg-panel4-dark rounded-l-lg h-full min-h-0 flex flex-col items-center justify-start relative pt-2'>
					<button
						title='Expand library panel'
						className='absolute mx-auto top-2 p-2 rounded-md bg-white dark:bg-stjude dark:text-white text-nav'
						onClick={() => expandPanel('middle')}
					>
						<ArrowsPointingOutIcon className='w-4 h-4' />
					</button>
					<BookmarkIconMyGPT className='w-6 h-6 mt-12 text-white' />
					<div className='text-xl mt-4 text-white [writing-mode:vertical-rl] rotate-180'>Library</div>
				</div>
			) : (
			<div style={{ width: `${panelWidths.middle}%` }} className='bg-panel1 dark:bg-panel4-dark rounded-l-lg h-full max-h-full min-h-0 overflow-y-auto duration-300 ease-in-out relative flex flex-col'>
				<button
					title='Collapse library panel'
					className='absolute right-2 top-2 p-1 rounded-md bg-white dark:bg-stjude dark:text-white text-nav z-10'
					onClick={() => collapsePanel('middle')}
				>
					<ArrowsPointingInIcon className='w-4 h-4' />
				</button>
				<div className=' p-6 text-2xl font-bold text-white'>{papers.length ? 'Your document library' : 'Your video library'}</div>
				
				<div className='p-2 text-sm border-slate-400 border-y'>
					<div className='text-white inline-block px-2'> Current library </div>
					{/* <div className='inline-block px-2 py-1 bg-panel3 rounded-md cursor-default'>{props.currentSettings.selectedDataset.split('_').join(' ')}</div> */}
					<select 
						className='text-md text-nav bg-panel3 dark:bg-stjude dark:text-white py-1 px-2 mx-1 rounded-md w-28 inline-block'
						value={props.currentSettings.selectedDataset}
						onChange={
							(e) => {
								props.settingsCallback({
									...props.currentSettings, 
									selectedDataset: e.target.value, 
									fetchPapers: true,
									use_default_qrs: true,
									use_default_ars: true,
									use_default_hi: true,
								})
								// setSelectedDataset(e.target.value)
								props.currentSettings.selectedDataset = e.target.value
								resetStates()
							}
						}
					>
						{props.currentSettings.datasets.map((dataset:any) => {
							return (
								<option key={dataset} value={dataset}>{dataset.split('_').join(' ')}</option>
							)
						})}
					</select>
					{ (props.frontendSettings && !props.frontendSettings.restriction_without_login) || (props.frontendSettings.restriction_without_login && props.currentSettings.loggedin) ?
					<div className='mx-1 inline-block px-2 py-1 bg-white dark:bg-stjude dark:text-white rounded-md cursor-pointer hover:bg-slate-200' 
						onClick={()=>{
							props.settingsCallback({...props.currentSettings, selectedPanel: 'datasets', showSettings: true, showUpload: false})
						}}>
						<Cog6ToothIcon className='w-4 h-4 inline-block'/>
					</div> : <></>}
				</div>
				{/* add filter column for documents */}
				{ papers.length > 1 ?
					<FocusOnDocumentSelect
						papers={papers}
						videos={videos}
						focusedPapers={focusedPapers}
						setFocusedPapers={setFocusedPapers}
						setSelectedPaperIdx={setselectedPaperIdx}
					/>	: <></>
				}
				{ sections.length ?
					<div className='p-2 text-sm border-slate-400 border-b'>
						<div className='text-white inline-block px-2 w-full'> Focus on section (#documents) </div>
						<select 
							className={'text-md text-nav dark:bg-stjude dark:text-white py-1 px-2 mx-1 rounded-md w-40 inline-block' + (focusedSection !== null ? ' bg-panel3' : ' bg-panel2 dark:bg-panel4-dark')}
							value={focusedSection}
							onChange={
								(e) => {
									if (e.target.value === 'None'){
										setFocusedSection(null)
									} else {
										setFocusedSection(e.target.value)
									}
								}
							}
						>
							<option value={'None'}>None</option>
							{papers.length && sections.length ?
								sections.map(s=>s['section_title'] + ' (' +s['section_count']+')').map((st:any, index:number) => {
									return (
										<option key={index} value={st}>{st}</option>
									)
								}) : <></>
							}

						</select>
					</div> : <></>
				}
				
				<div className='mb-4 divide-y'>
					{/* list all the papers */}
					{ papers.length ?
						papers.map((p:any, index:number)=>
							<div key={index} className={'p-2 ' + (selectedPaperIdx === index ? ' bg-nav': ' bg-panel1 dark:bg-panel4-dark') + (hasFocusedDocuments && !isFocusedDocument(p['paper_title']) ? ' opacity-40 cursor-not-allowed' : selectedPaperIdx === index ? ' cursor-default' : ' cursor-pointer')}>
								<div className='text-white text-sm flex items-center gap-1'
									onClick={()=> {
										if (hasFocusedDocuments && !isFocusedDocument(p['paper_title'])) return
										setselectedPaperIdx(index)
										setSelectedPage(0)
										setFileAttachmentType('paper_attachment')
									}}	
								>
									{hasFocusedDocuments && isFocusedDocument(p['paper_title']) ? <CheckIcon className='w-4 h-4 text-green-300 flex-shrink-0' /> : null}
									{p['paper_title']}
								</div>
							</div>
						) :
						videos.length ?
						videos.map((v:any, index:number)=>
							<div key={index} className={'p-2 ' + (selectedPaperIdx === index ? ' bg-nav': ' bg-panel1 dark:bg-panel4-dark') + (hasFocusedDocuments && !isFocusedDocument(v['video_title']) ? ' opacity-40 cursor-not-allowed' : selectedPaperIdx === index ? ' cursor-default' : ' cursor-pointer')}>
								<div className='text-white text-sm flex items-center gap-1'
									onClick={()=> {
										if (hasFocusedDocuments && !isFocusedDocument(v['video_title'])) return
										setselectedPaperIdx(index)
										setSelectedPage(0)
										setFileAttachmentType('paper_attachment')
									}}	
								>
									{hasFocusedDocuments && isFocusedDocument(v['video_title']) ? <CheckIcon className='w-4 h-4 text-green-300 flex-shrink-0' /> : null}
									{v['video_title']}
								</div>
							</div>
						) : <></>
					}
				</div>
			</div>
			)}
			
			{/* Panel for PDF viewer */}
			{panelCollapsed.right ? (
				<div style={{ width: `${panelWidths.right}%` }} className='bg-panel2 dark:bg-panel3-dark rounded-r-lg h-full flex flex-col items-center justify-start relative pt-2'>
					<button
						title='Expand viewer panel'
						className='absolute mx-auto top-2 p-2 rounded-md bg-white dark:bg-stjude dark:text-white text-nav'
						onClick={() => expandPanel('right')}
					>
						<ArrowsPointingOutIcon className='w-4 h-4' />
					</button>
					<DocumentChartBarIcon className='w-6 h-6 mt-12 text-nav dark:text-white' />
					<div className='text-xl mt-4 text-nav dark:text-white [writing-mode:vertical-rl] rotate-180'>Document Viewer</div>
				</div>
			) : (
			<div style={{ width: `${panelWidths.right}%` }} className='bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-r-lg h-full max-h-full min-h-0 overflow-hidden duration-300 ease-in-out relative flex flex-col shadow-sm'>
				<div className='flex-1 min-h-0 h-full overflow-hidden flex flex-row w-full pdf-viewer-row bg-gray-100 dark:bg-gray-900'>
					{/* Left icon sidebar */}
					<div className='flex flex-col items-center gap-1 py-2 px-0.5 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shrink-0'>
						<button
							title='Page thumbnails'
							onClick={() => setShowThumbnails(v => !v)}
							className={`p-1.5 rounded ${showThumbnails ? 'bg-gray-200 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-gray-600 dark:text-gray-300`}
						>
							<Squares2X2Icon className='w-5 h-5' />
						</button>
						<button title='Outline' className='p-1.5 rounded opacity-30 cursor-not-allowed text-gray-600 dark:text-gray-300'>
							<Bars3Icon className='w-5 h-5' />
						</button>
					</div>
					{/* Thumbnail panel */}
					{showThumbnails && numPages > 0 && (
						<div style={{ width: thumbnailWidth }} className='overflow-y-auto bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shrink-0 select-none'>
							<Document file={viewerFileUrl}>
								{Array.from({ length: numPages }, (_, i) => (
									<div
										key={i + 1}
										onClick={() => jumpToPage(i + 1)}
										className='group flex justify-center py-2 px-1.5 cursor-pointer'
									>
										<div className='shrink-0 flex flex-col items-center'>
											<div className={`shadow-md ${viewerPage === i + 1 ? 'ring-[3px] ring-gray-500 dark:ring-gray-300' : 'ring-1 ring-transparent group-hover:ring-[3px] group-hover:ring-gray-400 dark:group-hover:ring-gray-400'}`}>
												<Page pageNumber={i + 1} scale={0.18} renderTextLayer={false} renderAnnotationLayer={false} />
											</div>
											<p className='text-xs mt-1.5 text-gray-500 dark:text-gray-400'>{i + 1}</p>
										</div>
									</div>
								))}
							</Document>
						</div>
					)}
					{/* Drag handle — only shown when thumbnail panel is open */}
					{showThumbnails && numPages > 0 && (
						<div
							className='w-1 cursor-col-resize shrink-0 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors'
							onMouseDown={e => { isDraggingThumb.current = true; e.preventDefault() }}
						/>
					)}
					{/* Main content: toolbar + document */}
					<div className='flex flex-col flex-1 min-h-0 h-full overflow-hidden'>
						{papers.length && viewerFileUrl ?
							<>
								{/* Toolbar matching original layout: search | zoom | page nav | fullscreen | download */}
								<div className='flex items-center gap-0.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs shrink-0'>
									<button className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700' title='Search'><MagnifyingGlassIcon className='w-4 h-4' /></button>
									<span className='mx-1 w-px h-4 bg-gray-300 dark:bg-gray-600 shrink-0' />
									<button className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700' title='Zoom out' onClick={() => setPdfScale(s => Math.max(0.25, +(s - 0.25).toFixed(2)))}><span className='text-sm font-bold'>−</span></button>
									<select value={pdfScale} onChange={e => setPdfScale(Number(e.target.value))} className='mx-0.5 px-1 py-0.5 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-xs cursor-pointer'>
										{[0.25,0.5,0.75,1,1.25,1.5,2,3].map(v => <option key={v} value={v}>{Math.round(v*100)}%</option>)}
									</select>
									<button className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700' title='Zoom in' onClick={() => setPdfScale(s => Math.min(3, +(s + 0.25).toFixed(2)))}><span className='text-sm font-bold'>+</span></button>
									<div className='ml-auto flex items-center gap-0.5'>
										<button className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40' title='Previous page' onClick={() => jumpToPage(Math.max(1, viewerPage - 1))} disabled={viewerPage <= 1}><ChevronUpIcon className='w-4 h-4' /></button>
										<input type='number' min={1} max={numPages || 1} value={viewerPage} onChange={e => jumpToPage(Math.min(numPages, Math.max(1, Number(e.target.value))))} className='w-8 text-center border border-gray-300 dark:border-gray-500 rounded px-0.5 bg-white dark:bg-gray-700' />
										<span className='whitespace-nowrap'>of {numPages || '—'}</span>
										<button className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40' title='Next page' onClick={() => jumpToPage(Math.min(numPages, viewerPage + 1))} disabled={viewerPage >= numPages}><ChevronDownIcon className='w-4 h-4' /></button>
										<span className='mx-1 w-px h-4 bg-gray-300 dark:bg-gray-600 shrink-0' />
										<button className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700' title='Fullscreen' onClick={() => (document.querySelector('.pdf-scroll-area') as HTMLElement)?.requestFullscreen?.()}><ArrowsPointingOutIcon className='w-4 h-4' /></button>
										<a href={viewerFileUrl} download className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer' title='Download'><ArrowDownTrayIcon className='w-4 h-4' /></a>
										<span className='mx-1 w-px h-4 bg-gray-300 dark:bg-gray-600 shrink-0' />
										<button className='p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700' title='Collapse viewer panel' onClick={() => collapsePanel('right')}><ArrowsPointingInIcon className='w-4 h-4' /></button>
									</div>
								</div>
								<div ref={scrollAreaRef} className='overflow-auto flex-1 min-h-0 h-full pdf-scroll-area bg-[#bfbcba] dark:bg-[#033f52]'>
									<div className='flex flex-col items-center py-4 gap-3'>
										<Document key={viewerFileUrl} file={viewerFileUrl} onLoadSuccess={({ numPages }: { numPages: number }) => setNumPages(numPages)} onLoadError={() => setNumPages(0)}>
											{numPages > 0 && Array.from({ length: numPages }, (_, i) => (
												<div key={i + 1} id={`pdf-page-${i + 1}`} className='shadow-lg border border-gray-300 dark:border-gray-600'>
													<Page pageNumber={i + 1} scale={pdfScale} customTextRenderer={textRenderers[i + 1] as any} />
												</div>
											))}
										</Document>
									</div>
								</div>
							</>							: papers.length ?
								<div className='text-center text-nav'>
									{mediaLoading ? 'Loading document...' : mediaLoadError || 'Preparing document...'}
								</div>
								: videos.length && videos[selectedPaperIdx] && videos[selectedPaperIdx]['video_link'] ?
								// show embedded youtube videos
									<div className='p-2'>
										{(() => {
											let baseUrl = '';
											try {
												const rawVideoLink = String(videos[selectedPaperIdx]['video_link'] || '');
												const parsed = new URL(rawVideoLink);
												const hostname = parsed.hostname.toLowerCase();
												const allowedHosts = new Set([
													'youtube.com',
													'www.youtube.com',
													'm.youtube.com',
													'youtu.be',
													'www.youtu.be'
												]);

												if (!allowedHosts.has(hostname)) {
													return <div className='text-center text-red-500'>Invalid video source</div>;
												}

												let videoId = '';
												if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
													videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0];
												} else if (parsed.pathname.startsWith('/embed/')) {
													videoId = parsed.pathname.replace(/^\/embed\/+/, '').split('/')[0];
												} else {
													videoId = parsed.searchParams.get('v') || '';
												}

												if (!videoId) {
													return <div className='text-center text-red-500'>Invalid video source</div>;
												}

												baseUrl = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
											} catch (e) {
												return <div className='text-center text-red-500'>Invalid video source</div>;
											}

											const params = new URLSearchParams();
											const start = Math.max(0, parseInt(String(selectedStart)) || 0);
											const end = Math.max(0, parseInt(String(selectedStop)) || 0);
											if (start > 0) {
												params.set('start', String(start));
												params.set('autoplay', '1');
												params.set('cc_load_policy', '1');
											}
											if (end > 0) {
												params.set('end', String(end));
											}
											const videoUrl = `${baseUrl}?${params.toString()}`;
											return (
												<iframe 
													className='w-full h-[40vh]' 
													src={videoUrl}
													title={videos[selectedPaperIdx]['video_title']}
											allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
											allowFullScreen
											referrerPolicy='no-referrer'
										>
										</iframe>
											);
										})()}
										</div>
								:
								!props.currentSettings.loggedin && !canLoadDemoLibraryWithoutLogin ?
								<div>
									<div className='text-center text-nav'>
										Login to view document library
									</div>
								</div> 
								:
								<div>
									<div className='text-center text-nav'>
										No papers available.
									</div>
									<div className='text-center text-nav mb-2'>
										You can load demo dataset by clicking on the following button.
									</div>
									<div className='text-center'>
										<button 
											className='p-2 mx-2 my-auto bg-white hover:bg-bsk_dark_blue text-bsk_dark_blue font-semibold hover:text-white py-2 px-3 hover:border-transparent rounded-full shadow-md hover:shadow-lg outline-none focus:outline-none'
											onClick={()=>{
												setAddDemoLibrary(true)
											}}
										>
											<p className='inline-block ml-2'>
												Load "MyGPT" meta library as demo
											</p>
										</button>
									</div>
									<div className='text-center text-nav mt-2'>
										Or you can add your own library from Upload menu.
									</div>
								</div>
						}
					</div>
				</div>
			</div>
			)}
			</>	:
			<></>
			}
			</div>
		</div>
	)
}

export default GPTHome