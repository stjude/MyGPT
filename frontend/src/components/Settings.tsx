import { useState, useEffect } from 'react'
// import Workflow from './Workflow'
// import { DropdownOptions } from './DropDownMenu'
import LLMSettings from './LLMSettings'
import EmbeddingSettings from './EmbeddingSettings'
import RelevanceScoreSettings from './RelevanceScoresSettings'
import {
	// MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, ChevronUpIcon, ChevronDownIcon, 
	InformationCircleIcon,
	ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'
import MCPClient from './MCPClient'
import FlowSettings from './FlowSettings'
import DeveloperAPISettings from './DeveloperAPISettings'

const Settings = (props: {
	closeSettings: any,
	openUpload?: any,
	defaultSettings: any,
	currentSettings: any,
	settingsCallback: any,
	user?: any,
	djangoLogin?: any
}) => {
	const [activeTab, setActiveTab] = useState(props.currentSettings.selectedPanel || props.defaultSettings.selectedPanel)
	// const [workflowZoomedIn, setWorkflowZoomedIn] = useState(false)
	// const [workflowCollapsed, setWorkflowCollapsed] = useState(false)

	// Deep-clone only serialisable primitives; non-serialisable objects (e.g.
	// the MCP Client instance) are stripped to avoid circular-reference crashes.
	const safeClone = (obj: any) => {
		try {
			return JSON.parse(JSON.stringify(obj))
		} catch {
			const stripped: any = {}
			for (const key of Object.keys(obj || {})) {
				try {
					stripped[key] = JSON.parse(JSON.stringify(obj[key]))
				} catch {
					// skip non-serialisable keys (e.g. MCPClient)
				}
			}
			return stripped
		}
	}
	const currentSettings = safeClone(props.currentSettings || props.defaultSettings)
	const [datasets, setDatasets]: [any, any] = useState([])
	const [selectedDataset, setSelectedDataset] = useState(props.currentSettings.selectedDataset || props.defaultSettings.selectedDataset)
	const [deleteDataset, setDeleteDataset] = useState('')

	const [addEmbeddingForDataset, setAddEmbeddingForDataset] = useState('')

	const [llms, setLlms] = useState<any[]>(props.currentSettings.llms || props.defaultSettings.llms)
	const [llm, setLlm] = useState(props.currentSettings.selectedLlm || props.defaultSettings.selectedLlm)

	const [editPrompt, setEditPrompt] = useState(false)

	const [settingMode] = useState<'classic' | 'new'>('new');

	useEffect(() => {
		const requestOptions = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `${props.user && props.djangoLogin ?
					'Bearer ' + localStorage.getItem('access') :
					import.meta.env.PROD ?
						import.meta.env.VITE_AUTH_TOKEN_PROD
						: import.meta.env.VITE_AUTH_TOKEN_DEV}`
			},
			body: JSON.stringify(props.djangoLogin ? props.user : props.user ? {
				'user_email': props.user.user_email,
				'user_group': props.user.otherRoles && props.user.otherRoles.length ? props.user.otherRoles[0] : ''
			} : {
				'user_email': '',
				'user_group': ''
			})
		}
		if (!datasets.length || props.currentSettings.fetchDatasets)
			fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_datasets/`, requestOptions)
				.then(response => response.json())
				.then(data => {
					const dataset_names = data.map((d: any) => d.dataset_name)
					const dataset_details: any = []
					dataset_names.forEach((dataset: string) => {
						const dataset_detail = {
							'dataset': dataset,
							'embedding_model': data.filter((d: any) => d.dataset_name === dataset)[0].embedding_model,
							'embedding_added': data.filter((d: any) => d.dataset_name === dataset)[0].embedding_added,
							'direct_chat_without_docs': data.filter((d: any) => d.dataset_name === dataset)[0].direct_chat_without_docs,
							'user_group': data.filter((d: any) => d.dataset_name === dataset)[0].user_group,
							'details_open': false,
							'chunking_method': data.filter((d: any) => d.dataset_name === dataset)[0].chunking_method,
							'use_bm25': data.filter((d: any) => d.dataset_name === dataset)[0].use_bm25,
							'chunksize': data.filter((d: any) => d.dataset_name === dataset)[0].chunksize,
							'overlap': data.filter((d: any) => d.dataset_name === dataset)[0].overlap,
							'distance_function': data.filter((d: any) => d.dataset_name === dataset)[0].distance_function,
						}
						dataset_details.push(dataset_detail)
					})
					props.settingsCallback({ ...currentSettings, datasets: dataset_names, fetchDatasets: false })
					if (dataset_names && dataset_names.length && dataset_names.includes(props.defaultSettings.selectedDataset)) {
						dataset_names.splice(dataset_names.indexOf(props.defaultSettings.selectedDataset), 1)
						dataset_names.unshift(props.defaultSettings.selectedDataset)
					} else {
						dataset_names.unshift(props.defaultSettings.selectedDataset)
					}
					setDatasets(dataset_details)
				})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [datasets.length, props.currentSettings.fetchDatasets])

	useEffect(() => {
		setSelectedDataset(props.currentSettings.selectedDataset || props.defaultSettings.selectedDataset)
	}, [props.currentSettings.selectedDataset, props.defaultSettings.selectedDataset])
	useEffect(() => {
		if (deleteDataset) {
			const email = props.user ? props.user.user_email : '-'
			const requestOptions = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `${props.user && props.djangoLogin ?
						'Bearer ' + localStorage.getItem('access') :
						import.meta.env.PROD ?
							import.meta.env.VITE_AUTH_TOKEN_PROD
							: import.meta.env.VITE_AUTH_TOKEN_DEV}`
				}
			}
			fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/delete_dataset/?dataset=${deleteDataset}&user_email=${email}`, requestOptions)
				.then(response => response.json())
				.then(data => {
					setDeleteDataset('')
					const dataset_names = currentSettings.datasets.filter((d: string) => d !== deleteDataset)
					props.settingsCallback({ ...currentSettings, datasets: dataset_names, selectedDataset: dataset_names[0], fetchDatasets: true })

				})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [deleteDataset, currentSettings])

	useEffect(() => {
		if (addEmbeddingForDataset) {
			const requestOptions = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			}
			fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/add_dataset_embeddings/?dataset=${addEmbeddingForDataset}`, requestOptions)
				.then(response => response.json())
				.then(() => {
					setAddEmbeddingForDataset('')
					const dataset_details = datasets.map((dataset: any) => {
						if (dataset.dataset === addEmbeddingForDataset) dataset.embedding_added = true
						return dataset
					})
					setDatasets(dataset_details)
				})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [addEmbeddingForDataset, datasets])

	// get llms from backend
	useEffect(() => {

		const postData = async () => {
			const response = await fetch(`${window.mygptRuntimeConfig.ollamaApiUrl}api/tags`, { method: 'GET' })
			const data = await response.json()

			// set models
			const llms = data.models
				.filter((model: any) => model.details.quantization_level !== 'F16')
				.map((model: any) => model.name)
			const llm = llms[0]
			setLlms(llms)
			setLlm(llm)
			props.settingsCallback({
				...currentSettings,
				llms,
				selectedLlm: llms.includes(currentSettings.selectedLlm) ? currentSettings.selectedLlm : (llm || ''),
			})

			// add new model to backend API
			let llms_object: any = []
			data.models.forEach((model: any) => {
				// let llm_name = model.name.split(':')[0]
				let llm_name = model.name
				let llm_size = model.size * 1e-9
				let llm_size_gb = llm_size.toFixed(2)
				llms_object.push({ name: llm_name, size: llm_size_gb })
			})

			// const requestOptions = {
			// 	method: 'POST',
			// 	headers: {
			// 		'Content-Type': 'application/json',
			// 		'Authorization': `${props.user && props.djangoLogin ?
			// 			'Bearer ' + localStorage.getItem('access') :
			// 			import.meta.env.PROD ?
			// 				import.meta.env.VITE_AUTH_TOKEN_PROD
			// 				: import.meta.env.VITE_AUTH_TOKEN_DEV}`
			// 	},
			// 	setConnection: 'keep-alive',
			// 	keepalive: true,
			// 	setTimeout: 10000,
			// 	body: JSON.stringify({ 'llms': llms_object })
			// }
			// const response2 = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/add_ollama_models/`, requestOptions)
			// const data2 = await response2.json()

		}
		postData().catch(error => {
			console.warn('Unable to refresh Ollama models:', error)
			setLlms([])
			setLlm('')
			props.settingsCallback({ ...currentSettings, llms: [], selectedLlm: '' })
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.user, props.djangoLogin, props.currentSettings.runtimeRevision])

	const settingProps = {
		defaultSettings: props.defaultSettings,
		currentSettings: currentSettings,
		settingsCallback: props.settingsCallback,
		user: props.user,
		djangoLogin: props.djangoLogin
	}

	return (
		// create floating panel with opque background
		<div className='fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center' onClick={props.closeSettings}>
			<div className={'bg-panel1 dark:bg-panel4-dark w-3/4 max-h-[1100px] max-w-[1200px] rounded-lg ' + (window.screen.availHeight < 1000 ? 'h-[95vh]' : 'h-[85vh]')} onClick={(event) => event.stopPropagation()}>
				<div className='flex justify-between'>
					<div className='text-2xl font-bold text-white mt-8 mx-8'>Settings
						{/* <div className='gap-2 ml-4 inline-flex text-sm font-normal'>
							<div className='text-gray-400'>(</div>
							<div
								className={`cursor-pointer ${settingMode === 'classic' ? 'text-white underline' : 'text-gray-400'}`}
								onClick={() => setSettingMode('classic')}
							>
								Classic
							</div>
							<div className='text-gray-400'>|</div>
							
							<div
								className={`cursor-pointer ${settingMode === 'new' ? 'text-white underline' : 'text-gray-400'}`}
								onClick={() => setSettingMode('new')}
							>
								New
							</div>
							<div className='text-gray-400'>)</div>
						</div> */}

					</div>
					<div className='text-2xl font-bold text-white mt-8 mr-8 cursor-pointer' onClick={props.closeSettings}>x</div>
				</div>

				<div style={{ 'display': settingMode === 'classic' ? 'block' : 'none' }}>
					<div className={'flex justify-between my-6 ' + (window.screen.availHeight < 1000 ? 'h-[78vh]' : 'h-[55vh]')}>
						{/* create left side vericle tabs */}
						<div className={'w-1/4 border-slate-400 border-y-2 ' + (window.screen.availHeight < 1000 ? 'h-[80vh]' : 'h-[55vh]')}>
							<div className='grid grid-cols-1 divide-y'>
								{props.defaultSettings.settingsPanels.map((panel: any, index: number) => {
									const showMCPMenu = import.meta.env.VITE_MCP_SHOW_MCP_MENU === 'false' ? false :
										import.meta.env.VITE_MCP_SHOW_MCP_MENU === 'true' ? true : false
									// console.log('showMCPMenu', showMCPMenu)
									// if MCP menu is not shown, skip the mcp panel
									if (!showMCPMenu && panel.key === 'mcp') return null
									return (
										<div
											key={index}
											data-panel={panel.key}
											className={`text-white text-xl cursor-pointer p-2 ${activeTab === panel.key ? 'font-normal bg-nav' : 'font-light bg-panel1 dark:bg-panel4-dark'}`}
											onClick={() => setActiveTab(panel.key)}
										>
											{panel.text}
										</div>
									)

								})}
							</div>
						</div>
						{/* create right side list of settings */}
						<div className={'w-3/4 bg-panel2 dark:bg-panel2-dark overflow-y-auto ' + (window.screen.availHeight < 1000 ? 'h-[80vh]' : 'h-[55vh]')}>
							{/* <div className={'mx-4 my-4 px-4 bg-gray-300 rounded-md ' + (workflowZoomedIn ? 'h-[45vh]' : workflowCollapsed ? 'h-8' : 'h-[29vh]')}>
							<div className='flex justify-between m-1'>
								<div className='text-panel1 text-lg font-bold'>MyGPT Workflow</div>
								<div className='flex flex-row justify-between'>
									{ window.screen.availHeight < 1000 ? 
										<div className='flex m-1'>
											<div className='text-panel1 text-lg font-bold cursor-pointer p-1 hover:bg-panel1 hover:text-white rounded-md' onClick={()=>setWorkflowZoomedIn(!workflowZoomedIn)}>
												{workflowZoomedIn ? <MagnifyingGlassMinusIcon className='h-5 w-5'/> : <MagnifyingGlassPlusIcon className='h-5 w-5'/>}
											</div>
										</div> : <></>
									}
									<div className='flex m-1'>
										<div className='text-panel1 text-lg font-bold cursor-pointer p-1 hover:bg-panel1 hover:text-white rounded-md' onClick={()=>setWorkflowCollapsed(!workflowCollapsed)}>
											{workflowCollapsed ? <ChevronUpIcon className='h-5 w-5'/> : <ChevronDownIcon className='h-5 w-5'/>}
										</div>
									</div>
								</div>
							</div>
							<Workflow focusComponent={activeTab} zoomedIn={workflowZoomedIn} collapsed={workflowCollapsed}/>
						</div> */}
							{activeTab === 'datasets' ?
								// <div className={'px-8 py-2 flex flex-col divide-y ' + (workflowCollapsed ? ' h-[60vh] max-h-[770px]' : ' h-[40vh] max-h-[470px]')}>
								<div className={'px-8 py-2 flex flex-col divide-y h-[40vh] max-h-[470px]'}>
									{/* new library button */}
									{props.openUpload &&
										<div className='flex justify-start items-center gap-2 py-3'>
											<button
												className='flex items-center gap-2 bg-panel1 dark:bg-panel3-dark text-white text-sm px-4 py-2 rounded-md hover:bg-nav transition ease-in-out'
												onClick={() => { props.closeSettings(); props.openUpload(); }}
											>
												Add New Library
												<ArrowTopRightOnSquareIcon className='h-4 w-4' />
											</button>
										</div>
									}
									{/* list of available libraries */}
									<div className='flex flex-col justify-start mb-8'>
										<div className='text-nav dark:text-nav-dark px-2 flex justify-start mt-2 text-lg font-semibold'> Available libraries </div>
										<div className='text-nav dark:text-nav-dark px-4 flex justify-start'>
											<ul className='list-disc'>
												{datasets.filter((d: any) => d !== 'None').map((dataset: any, index: number) => {
													return (
														<li key={index} className='ml-4'>
															<div className='flex justify-between m-1'>
																{dataset.dataset.split('_').join(' ')}
																<div>
																	<button className={'ml-1 px-1 rounded-md' + (dataset.details_open ? ' bg-gray-300 text-nav' : ' bg-panel1 text-white dark:bg-panel3-dark dark:text-nav-dark')}
																		onClick={() => {
																			const dataset_details = datasets.map((d: any) => {
																				if (d.dataset === dataset.dataset) d.details_open = !d.details_open
																				return d
																			})
																			setDatasets(dataset_details)
																		}
																		}>
																		<InformationCircleIcon className='h-5 w-5 inline-block' />
																	</button>
																	<button className={'ml-2 px-2 rounded-md w-24'
																		+ (dataset.dataset === currentSettings.selectedDataset ? ' bg-gray-300 text-nav' : ' bg-panel1 text-white dark:bg-panel3-dark dark:text-nav-dark')}
																		onClick={() => {
																			setSelectedDataset(dataset.dataset)
																			props.settingsCallback({
																				...currentSettings,
																				selectedDataset: dataset.dataset,
																				answerWithoutContext: dataset.direct_chat_without_docs,
																				fetchPapers: !dataset.direct_chat_without_docs,
																				use_default_qrs: true,
																				use_default_ars: true,
																				use_default_hi: true,
																			})
																		}}
																		disabled={dataset.dataset === currentSettings.selectedDataset ? true : false}
																	>{dataset.dataset === currentSettings.selectedDataset ? 'Selected' : 'Select'}</button>

																	{/* <button className={'ml-2 text-white px-2 rounded-md w-48' + (dataset['embedding_added'] ? ' bg-gray-300' : ' bg-panel1' )}
																	disabled={dataset['embedding_added'] ? true : false}
																	onClick={()=>{
																		setAddEmbeddingForDataset(dataset.dataset)
																	}}
																>
																	{ dataset['embedding_added'] ? 'added in vector space' : 'add to vector space'}
																</button> */}
																	{
																		(props.currentSettings.restriction_without_login && props.user && dataset.user_group === 'user') || !props.currentSettings.restriction_without_login ?
																			<button className='ml-2 bg-red-900 text-white px-2 rounded-md'
																				onClick={() => { setDeleteDataset(dataset.dataset) }}
																			>Delete</button>
																			: <></>
																	}
																</div>
															</div>
															{dataset.details_open ?
																<div className='flex flex-col rounded-md bg-gray-300 dark:bg-panel3-dark p-2'>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Embedding Model:</b> {dataset.embedding_model}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Chunking method:</b> {dataset.chunking_method}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Chunksize:</b> {dataset.chunksize}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Overlap:</b> {dataset.overlap === false ? 'No' : 'Yes'}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Distance Function:</b> {dataset.distance_function}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>BM25:</b> {dataset.use_bm25 ? 'Yes' : 'No'}
																	</div>
																</div> : <></>
															}
														</li>
													)
												})}
											</ul>
										</div>
										<div className='flex justify-start text-sm text-nav dark:text-nav-dark my-4'>
											<p>
												<b>Note:</b> Deleting a library is irreversible action and will remove all papers and annotations associated with it.
											</p>
										</div>
									</div>
								</div> : <></>
							}
							{activeTab === 'llms' ?
								<LLMSettings
									llms={llms}
									llm={llm}
									selectedLlm={currentSettings.selectedLlm}
									currentSettings={currentSettings}
									settingsCallback={props.settingsCallback}
								/> : <></>
							}
							{activeTab === 'llm_parameters' ?
								<div className='px-8 py-2 flex flex-col'>
									<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-lg font-semibold'>System Prompt</div>
									<div className='mx-4'>
										<textarea
											rows={5}
											cols={30}
											placeholder='System prompt'
											className='rounded-md w-80 p-1 dark:text-white dark:bg-gray-500 dark:placeholder:text-nav-dark'
											value={currentSettings.system_prompt}
											onChange={(e) => props.settingsCallback({ ...currentSettings, system_prompt: e.target.value })}
											disabled={editPrompt ? false : true}
										/>
									</div>
									<div>
										<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={() => setEditPrompt(!editPrompt)}>{editPrompt ? 'Save' : 'Edit'}</button>
										{
											props.defaultSettings.system_prompt !== currentSettings.system_prompt ?
												<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={() => {
													props.settingsCallback({ ...currentSettings, system_prompt: props.defaultSettings.system_prompt })
												}}>Reset</button> : <></>
										}

									</div>
									<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-lg font-semibold'>Context Parameters</div>
									<div className='flex flex-row my-4'>
										<div className='w-[500px]'>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>Maximum Chunks</div>
												{/* slider from value 1 to 20 in increament of 1 */}
												<div className='mx-4'>
													<input type='range' min='1' max='30' step='1' value={currentSettings.maximum_chunks_count}
														onChange={(e) => props.settingsCallback({ ...currentSettings, maximum_chunks_count: parseInt(e.target.value) })}
														className='w-80 p-1 accent-panel1 dark:accent-panel3-dark'
													/>
													<div className='flex flex-row justify-between'>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>1</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center font-semibold'>{currentSettings.maximum_chunks_count}</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>30</div>
													</div>
												</div>
											</div>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>No Chunk Cutoff</div>
												{/* checkbox */}
												<div className='mx-4'>
													<input type='checkbox' checked={currentSettings.no_chunk_cutoff}
														onChange={(e) => props.settingsCallback({ ...currentSettings, no_chunk_cutoff: e.target.checked })}
														className='p-1 accent-panel1 dark:accent-panel3-dark'
													/>
												</div>
											</div>
										</div>
									</div>
									<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-lg font-semibold'>LLM Parameters</div>
									<div className='flex flex-row my-4'>
										<div className='h-[20px] text-nav dark:text-nav-dark inline-block px-2 mx-4 my-auto text-lg -rotate-90'>Precise</div>
										<div className='w-[500px]'>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>Temperature</div>
												{/* slider from value 0 to 1 in increament of 0.1 */}
												<div className='mx-4'>
													<input type='range' min='0' max='1' step='0.1' value={currentSettings.temperature}
														onChange={(e) => props.settingsCallback({ ...currentSettings, temperature: parseFloat(e.target.value) })}
														className='w-80 p-1 accent-panel1 dark:accent-panel3-dark'
													/>
													<div className='flex flex-row justify-between'>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>0</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center font-semibold'>{currentSettings.temperature}</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>1</div>
													</div>
												</div>
											</div>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>Top K</div>
												{/* slider from value 0 to 1000 in increament of 50 */}
												<div className='mx-4'>
													<input type='range' min='5' max='100' step='5' value={currentSettings.top_k}
														onChange={(e) => props.settingsCallback({ ...currentSettings, top_k: parseInt(e.target.value) })}
														className='w-80 p-1 accent-panel1 dark:accent-panel3-dark'
													/>
													<div className='flex flex-row justify-between'>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>5</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center font-semibold'>{currentSettings.top_k}</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>100</div>
													</div>
												</div>
											</div>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>Top P</div>
												{/* slider from value 0 to 1 in increament of 0.1 */}
												<div className='mx-4'>
													<input type='range' min='0.4' max='1.0' step='0.05' value={currentSettings.top_p}
														onChange={(e) => props.settingsCallback({ ...currentSettings, top_p: parseFloat(e.target.value) })}
														className='w-80 p-1 accent-panel1 dark:accent-panel3-dark'
													/>
													<div className='flex flex-row justify-between'>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>0.4</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center font-semibold'>{currentSettings.top_p}</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>1.0</div>
													</div>
												</div>
											</div>
										</div>
										<div className='h-[20px] text-nav dark:text-nav-dark inline-block px-2 mx-4 my-auto text-lg -rotate-90'>Creative</div>
									</div>
									{
										props.defaultSettings.temperature !== currentSettings.temperature ||
											props.defaultSettings.top_k !== currentSettings.top_k ||
											props.defaultSettings.top_p !== currentSettings.top_p
											?
											<button className='bg-panel1 text-white px-4 py-1 rounded-md mx-auto w-32' onClick={() => {
												props.settingsCallback({ ...currentSettings, temperature: props.defaultSettings.temperature, top_k: props.defaultSettings.top_k, top_p: props.defaultSettings.top_p })
											}}>Reset</button> : <></>
									}
								</div> : <></>
							}
							{
								activeTab === 'embedding_models' ?
									<EmbeddingSettings
										embeddingModels={props.defaultSettings.embedding_models}
										embeddingModel={currentSettings.embeddingModel}
										selectedEmbeddingModel={props.currentSettings.selectedEmbeddingModel}
										currentSettings={currentSettings}
										settingsCallback={props.settingsCallback}
										djangoLogin={props.djangoLogin}
										user={props.user}
									/> : <></>
								// <div className='px-8 py-2 flex flex-col divide-y'>
								// 	<div className='m-2'>
								// 		<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-lg font-semibold'>Current Sentence Transformer</div>
								// 		<div className='mx-4 px-2'>
								// 			<DropdownOptions
								// 				width={'180px'}
								// 				optionsList={props.defaultSettings.embedding_models}
								// 				defaultOption={currentSettings.sentence_transformer}
								// 				dropDownCallback={(option:string)=>{
								// 					props.settingsCallback({...currentSettings, selected_sentence_transformer: option})
								// 				}}
								// 			/>
								// 		</div>
								// 	</div>
								// 	<div className='m-2'>
								// 		<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-lg font-semibold'>Available Sentence Transformer</div>
								// 		<div className='mx-4'>
								// 			<ul className='list-disc ml-4'>
								// 				{props.defaultSettings.embedding_models.map((st:string, index:number) => {
								// 					return(
								// 						<li key={index} className='ml-4 text-nav dark:text-nav-dark text-sm'>
								// 								{st + (st === props.defaultSettings.default_sentence_transformer ? ' (default)' : '')}
								// 						</li>
								// 					)
								// 				})}
								// 			</ul>
								// 		</div>
								// 	</div>
								// 	<div className='m-2'>
								// 		<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-lg font-semibold'>
								// 			<div className='text-nav dark:text-nav-dark p-1 my-1'>Add other Sentence Transformers</div>
								// 			<p className='text-sm ml-4'> You can choose any Sentence Transformer from this list: <a className='underline' href='https://www.sbert.net/docs/pretrained_models.html'>SBERT.net</a></p>
								// 			<input type='text' placeholder='Sentence Transformer' className='rounded-md w-60 p-1 ml-4'/>
								// 			<button className='bg-panel1 text-white px-4 py-1 rounded-md m-2'>Add</button>
								// 		</div>
								// 	</div>
								// </div> 
								// : <></>
							}
							{
								activeTab === 'relevance_score' ?
									<RelevanceScoreSettings
										selectedDataset={selectedDataset}
										currentSettings={currentSettings}
										settingsCallback={props.settingsCallback}
										djangoLogin={props.djangoLogin}
										user={props.user}
									/> : <></>
							}
							{
								activeTab === 'mcp' ?
									<MCPClient
										currentSettings={currentSettings}
										settingsCallback={props.settingsCallback}
									/> : <></>
							}
							{
								activeTab === 'developer_api' ?
									<DeveloperAPISettings
										currentSettings={currentSettings}
										settingsCallback={props.settingsCallback}
										djangoLogin={props.djangoLogin}
										user={props.user}
									/> : <></>
							}
						</div>
					</div>

				</div>{/*  div for classic */}
				{/* <div className='mygptcol2 flex-1 divide-y'
					style={{ 'display': settingMode === 'graphical' ? 'block' : 'none' }}
				>
					<div className={'flex justify-between my-6 pl-4 pr-4 pt-4 overflow-y-auto bg-panel2 dark:bg-panel2-dark  rounded-b-lg ' + (window.screen.availHeight < 1000 ? 'h-[80vh]' : 'h-[78vh]')}>
						<FlowSettings {...settingProps} />
					</div>

				</div> */}

				{/* NewSettings */}

				<div className='mygptcol2 flex-1 divide-y'
					style={{ 'display': settingMode === 'new' ? 'block' : 'none' }}
				>
					<div className={'flex justify-between my-6 ' + (window.screen.availHeight < 1000 ? 'h-[78vh]' : 'h-[55vh]')}>
						{/* create left side vericle tabs */}
						<div className={'w-1/4 border-slate-400 border-y-2 ' + (window.screen.availHeight < 1000 ? 'h-[80vh]' : 'h-[55vh]')}>
							<div className='grid grid-cols-1 divide-y'>
								{props.defaultSettings.settingsPanels.map((panel: any, index: number) => {
									const showMCPMenu = import.meta.env.VITE_MCP_SHOW_MCP_MENU === 'false' ? false :
										import.meta.env.VITE_MCP_SHOW_MCP_MENU === 'true' ? true : false
									// if MCP menu is not shown, skip the mcp panel
									if (!showMCPMenu && panel.key === 'mcp') return null
									return (
										<div
											key={index}
											data-panel={panel.key}
											className={`text-white text-xl cursor-pointer p-2 ${activeTab === panel.key ? 'font-normal bg-nav' : 'font-light bg-panel1 dark:bg-panel4-dark'}`}
											onClick={() => setActiveTab(panel.key)}
										>
											{panel.text}
										</div>
									)

								})}
							</div>
						</div>
						{/* create right side list of settings */}
						<div className={'w-3/4 bg-panel2 dark:bg-panel2-dark overflow-y-auto ' + (window.screen.availHeight < 1000 ? 'h-[80vh]' : 'h-[55vh]')}>
							{activeTab === 'datasets' ?
								// <div className={'px-8 py-2 flex flex-col divide-y ' + (workflowCollapsed ? ' h-[60vh] max-h-[770px]' : ' h-[40vh] max-h-[470px]')}>
								<div className={'px-8 py-2 flex flex-col divide-y h-[40vh] max-h-[470px]'}>
									{/* new library button */}
									{props.openUpload &&
										<div className='flex justify-start items-center gap-2 py-3'>
											<button
												className='flex items-center gap-2 bg-panel1 dark:bg-panel3-dark text-white text-sm px-4 py-2 rounded-md hover:bg-nav transition ease-in-out'
												onClick={() => { props.closeSettings(); props.openUpload(); }}
											>
												Add New Library
												<ArrowTopRightOnSquareIcon className='h-4 w-4' />
											</button>
										</div>
									}
									{/* list of available libraries */}
									<div className='flex flex-col justify-start mb-8'>
										<div className='text-nav dark:text-nav-dark px-2 flex justify-start mt-2 text-lg font-semibold'> Available libraries </div>
										<div className='text-nav dark:text-nav-dark px-4 flex justify-start'>
											<ul className='list-disc'>
												{datasets.filter((d: any) => d !== 'None').map((dataset: any, index: number) => {
													return (
														<li key={index} className='ml-4'>
															<div className='flex justify-between m-1'>
																{dataset.dataset.split('_').join(' ')}
																<div>
																	<button className={'ml-1 px-1 rounded-md' + (dataset.details_open ? ' bg-gray-300 text-nav' : ' bg-panel1 text-white dark:bg-panel3-dark dark:text-nav-dark')}
																		onClick={() => {
																			const dataset_details = datasets.map((d: any) => {
																				if (d.dataset === dataset.dataset) d.details_open = !d.details_open
																				return d
																			})
																			setDatasets(dataset_details)
																		}
																		}>
																		<InformationCircleIcon className='h-5 w-5 inline-block' />
																	</button>
																	<button className={'ml-2 px-2 rounded-md w-24'
																		+ (dataset.dataset === currentSettings.selectedDataset ? ' bg-gray-300 text-nav' : ' bg-panel1 text-white dark:bg-panel3-dark dark:text-nav-dark')}
																		onClick={() => {
																			setSelectedDataset(dataset.dataset)
																			props.settingsCallback({
																				...currentSettings,
																				selectedDataset: dataset.dataset,
																				answerWithoutContext: dataset.direct_chat_without_docs,
																				fetchPapers: !dataset.direct_chat_without_docs,
																				use_default_qrs: true,
																				use_default_ars: true,
																				use_default_hi: true,
																			})
																		}}
																		disabled={dataset.dataset === currentSettings.selectedDataset ? true : false}
																	>{dataset.dataset === currentSettings.selectedDataset ? 'Selected' : 'Select'}</button>

																	{/* <button className={'ml-2 text-white px-2 rounded-md w-48' + (dataset['embedding_added'] ? ' bg-gray-300' : ' bg-panel1' )}
																	disabled={dataset['embedding_added'] ? true : false}
																	onClick={()=>{
																		setAddEmbeddingForDataset(dataset.dataset)
																	}}
																>
																	{ dataset['embedding_added'] ? 'added in vector space' : 'add to vector space'}
																</button> */}
																	{
																		(props.currentSettings.restriction_without_login && props.user && dataset.user_group === 'user') || !props.currentSettings.restriction_without_login ?
																			<button className='ml-2 bg-red-900 text-white px-2 rounded-md'
																				onClick={() => { setDeleteDataset(dataset.dataset) }}
																			>Delete</button>
																			: <></>
																	}
																</div>
															</div>
															{dataset.details_open ?
																<div className='flex flex-col rounded-md bg-gray-300 dark:bg-panel3-dark p-2'>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Embedding Model:</b> {dataset.embedding_model}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Chunking method:</b> {dataset.chunking_method}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Chunksize:</b> {dataset.chunksize}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Overlap:</b> {dataset.overlap === false ? 'No' : 'Yes'}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>Distance Function:</b> {dataset.distance_function}
																	</div>
																	<div className='text-nav dark:text-nav-dark text-sm'>
																		<b>BM25:</b> {dataset.use_bm25 ? 'Yes' : 'No'}
																	</div>
																</div> : <></>
															}
														</li>
													)
												})}
											</ul>
										</div>
										<div className='flex justify-start text-sm text-nav dark:text-nav-dark my-4'>
											<p>
												<b>Note:</b> Deleting a library is irreversible action and will remove all papers and annotations associated with it.
											</p>
										</div>
									</div>
								</div> : <></>
							}

							{activeTab === 'chatsettings' ?
								<div className={'flex justify-between my-6 pl-4 pr-4 pt-4 overflow-y-auto bg-panel2 dark:bg-panel2-dark rounded-b-lg ' + (window.screen.availHeight < 1000 ? 'h-[70vh]' : 'h-[48vh]')}>
									<FlowSettings {...settingProps} />
								</div> : <></>
							}

							{activeTab === 'llms' ?
								<LLMSettings
									llms={llms}
									llm={llm}
									selectedLlm={currentSettings.selectedLlm}
									currentSettings={currentSettings}
									settingsCallback={props.settingsCallback}
								/> : <></>
							}
							{activeTab === 'llm_parameters' ?
								<div className='px-8 py-2 flex flex-col'>
									<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-lg font-semibold'>System Prompt</div>
									<div className='mx-4'>
										<textarea
											rows={5}
											cols={30}
											placeholder='System prompt'
											className='rounded-md w-80 p-1 dark:text-white dark:bg-gray-500 dark:placeholder:text-nav-dark'
											value={currentSettings.system_prompt}
											onChange={(e) => props.settingsCallback({ ...currentSettings, system_prompt: e.target.value })}
											disabled={editPrompt ? false : true}
										/>
									</div>
									<div>
										<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={() => setEditPrompt(!editPrompt)}>{editPrompt ? 'Save' : 'Edit'}</button>
										{
											props.defaultSettings.system_prompt !== currentSettings.system_prompt ?
												<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={() => {
													props.settingsCallback({ ...currentSettings, system_prompt: props.defaultSettings.system_prompt })
												}}>Reset</button> : <></>
										}

									</div>
									<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-lg font-semibold'>Context Parameters</div>
									<div className='flex flex-row my-4'>
										<div className='w-[500px]'>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>Maximum Chunks</div>
												{/* slider from value 1 to 20 in increament of 1 */}
												<div className='mx-4'>
													<input type='range' min='1' max='30' step='1' value={currentSettings.maximum_chunks_count}
														onChange={(e) => props.settingsCallback({ ...currentSettings, maximum_chunks_count: parseInt(e.target.value) })}
														className='w-80 p-1 accent-panel1 dark:accent-panel3-dark'
													/>
													<div className='flex flex-row justify-between'>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>1</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center font-semibold'>{currentSettings.maximum_chunks_count}</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>30</div>
													</div>
												</div>
											</div>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>No Chunk Cutoff</div>
												{/* checkbox */}
												<div className='mx-4'>
													<input type='checkbox' checked={currentSettings.no_chunk_cutoff}
														onChange={(e) => props.settingsCallback({ ...currentSettings, no_chunk_cutoff: e.target.checked })}
														className='p-1 accent-panel1 dark:accent-panel3-dark'
													/>
												</div>
											</div>
										</div>
									</div>
									<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-lg font-semibold'>LLM Parameters</div>
									<div className='flex flex-row my-4'>
										<div className='h-[20px] text-nav dark:text-nav-dark inline-block px-2 mx-4 my-auto text-lg -rotate-90'>Precise</div>
										<div className='w-[500px]'>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>Temperature</div>
												{/* slider from value 0 to 1 in increament of 0.1 */}
												<div className='mx-4'>
													<input type='range' min='0' max='1' step='0.1' value={currentSettings.temperature}
														onChange={(e) => props.settingsCallback({ ...currentSettings, temperature: parseFloat(e.target.value) })}
														className='w-80 p-1 accent-panel1 dark:accent-panel3-dark'
													/>
													<div className='flex flex-row justify-between'>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>0</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center font-semibold'>{currentSettings.temperature}</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>1</div>
													</div>
												</div>
											</div>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>Top K</div>
												{/* slider from value 0 to 1000 in increament of 50 */}
												<div className='mx-4'>
													<input type='range' min='5' max='100' step='5' value={currentSettings.top_k}
														onChange={(e) => props.settingsCallback({ ...currentSettings, top_k: parseInt(e.target.value) })}
														className='w-80 p-1 accent-panel1 dark:accent-panel3-dark'
													/>
													<div className='flex flex-row justify-between'>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>5</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center font-semibold'>{currentSettings.top_k}</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>100</div>
													</div>
												</div>
											</div>
											<div className='flex flex-column mt-2'>
												<div className='text-nav dark:text-nav-dark inline-block px-2 mx-4 my-2 text-md w-[100px]'>Top P</div>
												{/* slider from value 0 to 1 in increament of 0.1 */}
												<div className='mx-4'>
													<input type='range' min='0.4' max='1.0' step='0.05' value={currentSettings.top_p}
														onChange={(e) => props.settingsCallback({ ...currentSettings, top_p: parseFloat(e.target.value) })}
														className='w-80 p-1 accent-panel1 dark:accent-panel3-dark'
													/>
													<div className='flex flex-row justify-between'>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>0.4</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center font-semibold'>{currentSettings.top_p}</div>
														<div className='text-nav dark:text-nav-dark text-sm text-center'>1.0</div>
													</div>
												</div>
											</div>
										</div>
										<div className='h-[20px] text-nav dark:text-nav-dark inline-block px-2 mx-4 my-auto text-lg -rotate-90'>Creative</div>
									</div>
									{
										props.defaultSettings.temperature !== currentSettings.temperature ||
											props.defaultSettings.top_k !== currentSettings.top_k ||
											props.defaultSettings.top_p !== currentSettings.top_p
											?
											<button className='bg-panel1 text-white px-4 py-1 rounded-md mx-auto w-32' onClick={() => {
												props.settingsCallback({ ...currentSettings, temperature: props.defaultSettings.temperature, top_k: props.defaultSettings.top_k, top_p: props.defaultSettings.top_p })
											}}>Reset</button> : <></>
									}
								</div> : <></>
							}
							{
								activeTab === 'embedding_models' ?
									<EmbeddingSettings
										embeddingModels={props.defaultSettings.embedding_models}
										embeddingModel={currentSettings.embeddingModel}
										selectedEmbeddingModel={props.currentSettings.selectedEmbeddingModel}
										currentSettings={currentSettings}
										settingsCallback={props.settingsCallback}
										djangoLogin={props.djangoLogin}
										user={props.user}
									/> : <></>
							}
							{
								activeTab === 'relevance_score' ?
									<RelevanceScoreSettings
										selectedDataset={selectedDataset}
										currentSettings={currentSettings}
										settingsCallback={props.settingsCallback}
										djangoLogin={props.djangoLogin}
										user={props.user}
									/> : <></>
							}
							{
								activeTab === 'mcp' ?
									<MCPClient
										currentSettings={currentSettings}
										settingsCallback={props.settingsCallback}
									/> : <></>
							}
							{
								activeTab === 'developer_api' ?
									<DeveloperAPISettings
										currentSettings={currentSettings}
										settingsCallback={props.settingsCallback}
										djangoLogin={props.djangoLogin}
										user={props.user}
									/> : <></>
							}
						</div>
					</div>

				</div>

			</div>
		</div>
	);
};

export default Settings