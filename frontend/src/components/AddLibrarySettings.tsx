import { useState, useEffect, useRef } from 'react'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { DropdownOptions } from './DropDownMenu'
import defaultSettings from '../utils/DefaultState'

const AddLibrarySettings = (props: {
	currentSettings: any,
	settingsCallback: any, 
	user?: any,
	djangoLogin?: any
}) => {
	const stateKey = 'upUploadNodeState';
	const emptyUploadDocs:any = Array.from(Array(40).keys()).map((x: any) => { return { title: '', file: null } })
	const safeCurrentSettings = props.currentSettings || {}
	const getInitialUploadNodeData = () => {
		if (safeCurrentSettings.libraryName || safeCurrentSettings.docs || safeCurrentSettings.languageOfDocs) {
			           return {
                libraryName: safeCurrentSettings.libraryName || '',
                docs: safeCurrentSettings.docs || emptyUploadDocs,
                languageOfDocs: safeCurrentSettings.DatasetLanguage || 'English',
            }
		}

		try {
			const saved = localStorage.getItem(stateKey)
			if (saved) {
				return JSON.parse(saved)
			}
		} catch (error) {
			console.error('Failed to parse uploadNodeData from localStorage:', error)
		}

        return {
            libraryName: '',
            docs: emptyUploadDocs,
            languageOfDocs: 'English',
        }
    }

	const initialData = getInitialUploadNodeData()
	const [apiKey, setApiKey] = useState('')
	const [showAPIHelp, setShowAPIHelp] = useState(false)
	const [libraryId, setLibraryId] = useState('')
	const [libraryIdType, setLibraryIdType] = useState('user') // ['user', 'group']
	const [showLibraryIDHelp, setShowLibraryIDHelp] = useState(false)
	const [collectionId, setCollectionId] = useState('')
	const [showCollectionIDHelp, setShowCollectionIDHelp] = useState(false)
	const [addLibrary, setAddLibrary] = useState(false)
	const [showSuccess, setShowSuccess] = useState(false)
	const [showError, setShowError] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')

	const [uploadPanel, setUploadPanel] = useState(true)
	const [zoteroPanel, setZoteroPanel] = useState(false)
	const [videoPanel, setVideoPanel] = useState(false)

	const [UploadLibraryName, setUploadLibraryName] = useState(initialData.libraryName)
	const [uploadDocCount, setUploadDocCount] = useState(5)
	const [uploadDocs, setUploadDocs] = useState(initialData.docs)
	const [uploadLibrary, setUploadLibrary] = useState(false)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [uploadStage, setUploadStage] = useState('')
	const [uploadProgressMessage, setUploadProgressMessage] = useState('')
	const [uploadSettingsMode, setUploadSettingsMode] = useState('Default settings')

	const safeClone = (obj: any) => {
		if (!obj) return {}
		try {
			return JSON.parse(JSON.stringify(obj))
		} catch {
			const stripped: any = {}
			for (const key of Object.keys(obj)) {
				try {
					stripped[key] = JSON.parse(JSON.stringify(obj[key]))
				} catch {
					stripped[key] = obj[key]
				}
			}
			return stripped
		}
	}
	const currentSettings = safeClone(props.currentSettings || defaultSettings)

	const [videoLibraryName, setVideoLibraryName] = useState('')
	const [videoLibrary, setVideoLibrary] = useState(false)
	const [videoPlaylistURL, setVideoPlaylistURL] = useState('')
	const [videoDocURLs, setVideoDocURLs] = useState([''])

	const [chunkingMethod, setChunkingMethod] = useState('fixed_chunk_size') // ['fixed_chunk_size', 'structure_preserving']
	const [chunkSizeActive, setChunkSizeActive] = useState(true)
	const [useOverlap, setUseOverlap] = useState('Yes')
	const [chunkSize, setChunkSize] = useState('1000')
	const [useBM25, setUseBM25] = useState('Yes')
	const [Reranker, setReranker] = useState('qnli-electra-base (default)')
	const [distanceFn, setDistanceFn] = useState('l2')
	const [languageOfDocs, setLanguageOfDocs] = useState(initialData.languageOfDocs || 'English')
	const uploadFileInputRef = useRef<HTMLInputElement | null>(null)
	const [hasStoredLibraryData, setHasStoredLibraryData] = useState(false)
	const selectedUploadDocsCount = (uploadDocs || []).filter((doc:any) => {
		const hasFile = doc?.file !== null && doc?.file !== undefined
		const hasTitle = typeof doc?.title === 'string' && doc.title.trim() !== ''
		return hasFile || hasTitle
	}).length

	const hasMeaningfulLibraryData = (state: any) => {
		const savedLibraryName = typeof state?.libraryName === 'string' ? state.libraryName.trim() : ''
		const savedDocs = Array.isArray(state?.docs) ? state.docs : []
		const savedDocsCount = savedDocs.filter((doc:any) => {
			const hasFile = doc?.file !== null && doc?.file !== undefined
			const hasTitle = typeof doc?.title === 'string' && doc.title.trim() !== ''
			return hasFile || hasTitle
		}).length

		return savedLibraryName.length > 0 || savedDocsCount > 0
	}

	const refreshStoredLibraryDataState = () => {
		try {
			const saved = localStorage.getItem(stateKey)
			if (!saved) {
				setHasStoredLibraryData(false)
				return
			}

			const parsed = JSON.parse(saved)
			setHasStoredLibraryData(hasMeaningfulLibraryData(parsed))
		} catch (error) {
			console.error('Failed to read uploadNodeData from localStorage:', error)
			setHasStoredLibraryData(false)
		}
	}

	const clearUploadLibraryForm = () => {
		try {
			localStorage.removeItem(stateKey)
		} catch (error) {
			console.error('Failed to clear uploadNodeData from localStorage:', error)
		}

		if (uploadFileInputRef.current) {
			uploadFileInputRef.current.value = ''
		}

		setUploadLibraryName('')
		setUploadDocs(emptyUploadDocs)
		setLanguageOfDocs('English')
		setShowError(false)
		setErrorMessage('')
		setHasStoredLibraryData(false)

		props.settingsCallback({
			...currentSettings,
			libraryName: '',
			docs: emptyUploadDocs,
			languageOfDocs: 'English',
		})
	}

	useEffect(() => {
		refreshStoredLibraryDataState()
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		// Only sync from props if not currently processing an upload
		if (!uploadLibrary && uploadPanel) {
			const nextLibraryName = props.currentSettings?.libraryName
			const nextDocs = props.currentSettings?.docs
			const nextLanguage = props.currentSettings?.languageOfDocs

			if (typeof nextLibraryName === 'string' && nextLibraryName !== UploadLibraryName) {
				setUploadLibraryName(nextLibraryName)
			}

			if (Array.isArray(nextDocs) && nextDocs !== uploadDocs) {
				setUploadDocs(nextDocs)
			}

			if (typeof nextLanguage === 'string' && nextLanguage !== languageOfDocs) {
				setLanguageOfDocs(nextLanguage)
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.currentSettings?.libraryName, props.currentSettings?.docs, props.currentSettings?.languageOfDocs, uploadLibrary, uploadPanel])

	useEffect(() => {
		try {
			localStorage.setItem(
				stateKey,
				JSON.stringify({
					libraryName: UploadLibraryName,
					docs: uploadDocs,
					languageOfDocs: languageOfDocs,
				})
			)
		} catch (error) {
			console.error('Failed to save uploadNodeData to localStorage:', error)
		}

		setHasStoredLibraryData(UploadLibraryName.trim().length > 0 || selectedUploadDocsCount > 0)

		props.settingsCallback({
			...currentSettings,
			libraryName: UploadLibraryName,
			docs: uploadDocs,
			languageOfDocs: languageOfDocs,
		})
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [UploadLibraryName, uploadDocs, languageOfDocs])

  useEffect(() => {
	if (addLibrary){
		const formData = new FormData()

		formData.append('api_key', apiKey)
		formData.append('library_id', libraryId)
		formData.append('library_id_type', libraryIdType)
		formData.append('collection_id', collectionId)
		formData.append('embedding_model', currentSettings.selectedEmbeddingModel)
		formData.append('use_overlap', useOverlap)
		formData.append('chunking_method', chunkingMethod)
		formData.append('chunk_size', chunkSize)
		formData.append('use_bm25', useBM25)
		formData.append('reranker', Reranker)
		formData.append('distance_function', distanceFn)
		formData.append('user', props.user ? props.user.user.replace(', ','_'): '-')
		formData.append('user_email', props.user ? props.user.user_email : '-')
		formData.append('user_group', props.user && props.user.isAdmin ? 'admin' : 'user')
		formData.append('documents_language', languageOfDocs)

		const requestOptions = {
			method: 'POST',
			headers: {
				'Authorization': `${
				props.user && props.djangoLogin ?
				'Bearer ' + localStorage.getItem('access') :
					import.meta.env.PROD ? 
					import.meta.env.VITE_AUTH_TOKEN_PROD 
					: import.meta.env.VITE_AUTH_TOKEN_DEV}`
				},
			body: formData
		}

		fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/add_zotero_collection/`, requestOptions)
		.then(response => response.json())
		.then(data => {
			props.settingsCallback({...currentSettings, fetchDatasets: true, datasetsUpdated: true})
			setAddLibrary(false)
			setApiKey('')
			setLibraryId('')
			setCollectionId('')
			if (data.added){
				setShowSuccess(true)
			}else{
				setShowError(true)
			}
		})
	}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLibrary, apiKey, libraryId, collectionId, libraryIdType])

 	useEffect(() => {
		if (uploadLibrary){
			const formData = new FormData()
			
			formData.append('dataset_name', UploadLibraryName)
			formData.append('embedding_model', currentSettings.selectedEmbeddingModel)
			formData.append('user', props.user ? props.user.user.replace(', ','_'): '-')
			formData.append('user_email', props.user ? props.user.user_email : '-')
			formData.append('user_group', props.user && props.user.isAdmin ? 'admin' : 'user')
			formData.append('chunking_method', chunkingMethod)
			formData.append('use_overlap', useOverlap)
			formData.append('chunk_size', chunkSize)
			formData.append('use_bm25', useBM25)
			formData.append('reranker', Reranker)
			formData.append('distance_function', distanceFn)
			formData.append('documents_language', languageOfDocs)
			formData.append('stream_progress', 'true')

			// show error if dataset name is empty
			if (UploadLibraryName === ''){
				setShowError(true)
				setErrorMessage('Library name can not be empty')
				setUploadLibrary(false)
				setUploadLibraryName('')
				setUploadDocs(emptyUploadDocs)
				return
			}

			// show error if no file is selected
			if (uploadDocs.filter((d:any)=> d.file !== null && d.title !== '').length === 0){
				setShowError(true)
				setErrorMessage('No file selected')
				setUploadLibrary(false)
				setUploadLibraryName('')
				setUploadDocs(emptyUploadDocs)
				return
			} else {
				setShowError(false)
				setErrorMessage('')
			}

			uploadDocs.filter((d:any)=> d.file !== null && d.title !== '').forEach((doc:any) => {
				if (doc.title && doc.file){
					formData.append('paper_title', doc.title)
					formData.append('paper_attachment', doc.file)
				}
			})
			const requestOptions = {
				method: 'POST',
				headers: {
					'Authorization': `${
					props.user && props.djangoLogin ?
					'Bearer ' + localStorage.getItem('access') :
						import.meta.env.PROD ? 
						import.meta.env.VITE_AUTH_TOKEN_PROD 
						: import.meta.env.VITE_AUTH_TOKEN_DEV}`
					},
				body: formData
			}

			// Reset progress state
			setUploadProgress(0)
			setUploadStage('uploading')
			setUploadProgressMessage('Starting upload...')

			fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/upload_documents/`, requestOptions)
			.then(response => {
				// Handle streaming response
				if (!response.ok) {
					throw new Error('Upload failed')
				}
				
				const reader = response.body?.getReader()
				const decoder = new TextDecoder()
				let buffer = ''

				const processStream = async () => {
					try {
						while (reader) {
							const { done, value } = await reader.read()
							if (done) break

							buffer += decoder.decode(value, { stream: true })
							const lines = buffer.split('\n')
							buffer = lines.pop() || ''

							for (const line of lines) {
								if (line.trim()) {
									try {
										const update = JSON.parse(line)

										if (update.type === 'progress') {
											setUploadProgress(update.progress)
											setUploadStage(update.stage)
											setUploadProgressMessage(update.message)
										} else if (update.type === 'done') {
											setUploadProgress(100)
											setUploadStage('completed')
											props.settingsCallback({...currentSettings, libraryName: '', docs: emptyUploadDocs, fetchDatasets: true, datasetsUpdated: true})
											setUploadLibrary(false)
											setUploadLibraryName('')
											setUploadDocs(emptyUploadDocs)
											setShowSuccess(true)
										} else if (update.type === 'error') {
											setShowError(true)
											setErrorMessage(update.error_message || 'Error uploading documents')
											setUploadLibrary(false)
										}
									} catch (parseError) {
										console.error('Failed to parse update:', parseError)
									}
								}
							}
						}
					} catch (error) {
						console.error('Stream processing error:', error)
						setShowError(true)
						setErrorMessage('Error processing upload')
						setUploadLibrary(false)
					}
				}

				if (reader) {
					processStream()
				}
			})
			.catch(error => {
				console.error('Upload error:', error)
				setShowError(true)
				setErrorMessage('Error uploading documents')
				setUploadLibrary(false)
			})
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [uploadLibrary, UploadLibraryName, uploadDocs])

	useEffect(() => {
		if (videoLibrary){
			const formData = new FormData()
			
			formData.append('dataset_name', videoLibraryName)
			formData.append('embedding_model', currentSettings.selectedEmbeddingModel)
			formData.append('user', props.user ? props.user.user: '')
			formData.append('user_email', props.user ? props.user.user_email : '')
			formData.append('user_group', props.user && props.user.isAdmin ? 'admin' : 'user')
			formData.append('documents_language', languageOfDocs)

			formData.append('video_urls', videoDocURLs.join(',') )
			formData.append('playlist_url', videoPlaylistURL)

			const requestOptions = {
				method: 'POST',
				headers: {
					'Authorization': `${
					props.user && props.djangoLogin ?
					'Bearer ' + localStorage.getItem('access') :
						import.meta.env.PROD ? 
						import.meta.env.VITE_AUTH_TOKEN_PROD 
						: import.meta.env.VITE_AUTH_TOKEN_DEV}`
					},
				body: formData
			}
			fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/add_video_library/`, requestOptions)
			.then(response => response.json())
			.then(data => {
				props.settingsCallback({...currentSettings, fetchDatasets: true, datasetsUpdated: true})
				setVideoLibrary(false)
				setVideoLibraryName('')
				setVideoDocURLs([])
				if (data.added){
					setShowSuccess(true)
				}
			})
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [videoLibrary, videoLibraryName, videoDocURLs])

  return (
	<div>
		<div className='text-nav dark:text-nav-dark p-2 mt-2 flex justify-start text-lg font-semibold'> Add new library </div>
		{ currentSettings.restriction_without_login && !props.user ?
			<div className='text-nav dark:text-nav-dark p-2 mb-2 flex justify-start text-lg font-semibold'> Note: Please login to add library </div> : <></>
		}
		{/*  add choice button with 3 options */}
		<div className='flex justify-start'>
			<div className={'inline-block px-4 py-1 shadow rounded-l-lg border-2 border-panel1 ' + 
				(uploadPanel ? 'bg-panel1 dark:bg-panel3-dark text-white cursor-default ' : 'text-panel1 bg-white dark:bg-nav-dark dark:text-nav cursor-pointer')}
				onClick={() => {
					setZoteroPanel(false)
					setUploadPanel(true)
					setVideoPanel(false)
					setUploadSettingsMode('Default settings')
				}}
			>
				Upload documents
			</div>
			<div className={'inline-block px-4 py-1 shadow rounded-r-lg border-2 border-panel1 ' + 
				(zoteroPanel ? 'bg-panel1 dark:bg-panel3-dark text-white cursor-default ' : 'text-panel1 bg-white dark:bg-nav-dark dark:text-nav cursor-pointer')}
				onClick={() => {
					setZoteroPanel(true)
					setUploadPanel(false)
					setVideoPanel(false)
					setUploadSettingsMode('Default settings')
				}}
			>
				Add Zotero library
			</div>
			{/* <div className={'inline-block px-4 py-1 shadow rounded-r-lg border-2 border-panel1 ' + 
				(videoPanel ? 'bg-panel1 dark:bg-panel3-dark text-white cursor-default ' : 'text-panel1 bg-white dark:bg-nav-dark dark:text-nav cursor-pointer')}
				onClick={() => {
					setZoteroPanel(false)
					setUploadPanel(false)
					setVideoPanel(true)
				}}
			>
				Youtube video library
			</div> */}
		</div>
		{ zoteroPanel ?
			<div className='flex justify-start'>
				<div className='flex flex-col mt-4'>
					{ showSuccess ?
						<div className='flex justify-start'>
							<div className='text-nav dark:text-nav-dark p-1 text-lg bg-green-200 rounded-md'>Library uploaded successfully</div>
						</div> : 
						addLibrary && !showSuccess ?
						<div className='flex justify-start'>
							<div className='text-nav dark:text-nav-dark p-1 text-lg bg-orange-200 rounded-md'>Uploading documents...</div>
						</div> :
						<></>
					}
					{ showError ?
						<div className='flex justify-start'>
							<div className='text-nav dark:text-nav-dark p-1 text-lg bg-red-200 rounded-md'>Error uploading documents</div>
						</div> : <></>	
					}
					<div className='flex py-2'>
						<div className='text-nav dark:text-nav-dark w-48 p-1'>Zotero API key*</div>
						<input type='text' disabled={currentSettings.restriction_without_login && !props.user} placeholder=' Zotero API key' className='rounded-md w-72 p-1 text-nav dark:bg-gray-500 dark:text-white dark:placeholder:text-white' value={apiKey} onChange={(e) => setApiKey(e.target.value)}/>
						<div className='text-white text-lg font-bold cursor-pointer mx-1 p-1 hover:bg-panel1 dark:bg-panel3-dark rounded-md' onClick={()=>{setShowAPIHelp(!showAPIHelp)}}>
							<QuestionMarkCircleIcon className='h-6 w-6 text-white cursor-pointer'/>
						</div>
						{ showAPIHelp ?
						<>
						<div className="border-solid border-r-slate-200 border-r-[4px] border-y-transparent border-y-[16px] border-l-0"></div>
						<div className='text-nav dark:text-nav-dark text-xs bg-slate-200 rounded-sm p-2'>
							<span>Get your API key from</span>
							<a href='https://www.zotero.org/settings/keys' target='_blank' rel='noreferrer' className='text-panel1 hover:text-blue-500'> Zotero settings</a>
						</div>
						</>: <></>}
					</div>
					{/* <div className='flex justify-center'>
						<div className='text-nav dark:text-nav-dark p-1 text-lg'>+</div>
					</div> */}
					<div className='flex pb-2'>
						<div className='text-nav dark:text-nav-dark w-48 p-1'>Zotero User ID* / Group ID*</div>
						<input type='text' disabled={currentSettings.restriction_without_login && !props.user} placeholder='Zotero user ID or group ID e.g. 1234567' className='rounded-md w-72 p-1 text-nav dark:bg-gray-500 dark:text-white dark:placeholder:text-white h-8' value={libraryId} onChange={(e) => setLibraryId(e.target.value)}/>
						<div className='text-white text-lg font-bold cursor-pointer mx-1 p-1 hover:bg-panel1 dark:bg-panel3-dark rounded-md h-8' onClick={()=>{setShowLibraryIDHelp(!showLibraryIDHelp)}}>
							<QuestionMarkCircleIcon className='h-6 w-6 text-white cursor-pointer'/>
						</div>
						{ showLibraryIDHelp ?
						<>
						<div className="border-solid border-r-slate-200 border-r-[12px] border-y-transparent border-y-[28px] border-l-0"></div>
						<div className='text-nav dark:text-nav-dark text-xs bg-slate-200 rounded-sm p-1 w-[280px]'>
							<span>Get your User ID from</span>
							<a href='https://www.zotero.org/settings/keys' target='_blank' rel='noreferrer' className='text-panel1 hover:text-blue-500'> Zotero settings</a>
							<span>. <br/> Or your Group ID is the 7-8 digit integer after <code>/groups/</code> in zotero library URL</span>
						</div>
						</>: <></>}
					</div>
					{/* add switch to indicate user ID or group UD */}
					<div className='flex pb-2 ml-48'>
						{/* add toggle button switch */}
						<div className='flex items-center'>
							<div className='text-nav dark:text-nav-dark p-1'>User ID</div>
							<div className={'w-12 h-6 rounded-full bg-white flex items-center ' + (libraryIdType === 'user' ? 'justify-start' : 'justify-end')}
							onClick={() => setLibraryIdType(libraryIdType === 'user' ? 'group' : 'user')}
							>
								<div className={'w-4 h-4 rounded-full bg-panel1 dark:bg-panel3-dark m-1'}></div>
							</div>
							<div className='text-nav dark:text-nav-dark p-1'>Group ID</div>
							</div>
					</div>
					<div className='flex pb-2'>
						<div className='text-nav dark:text-nav-dark w-48 p-1'>Zotero collection ID*</div>	
						<input type='text' disabled={currentSettings.restriction_without_login && !props.user} placeholder='Zotero collection ID e.g. ABC12DEF' className='rounded-md w-72 p-1 text-nav dark:bg-gray-500 dark:text-white dark:placeholder:text-white h-8' value={collectionId} onChange={(e) => setCollectionId(e.target.value)}/>
						<div className='text-white text-lg font-bold cursor-pointer mx-1 p-1 hover:bg-panel1 dark:bg-panel3-dark rounded-md h-8' onClick={()=>{setShowCollectionIDHelp(!showCollectionIDHelp)}}>
							<QuestionMarkCircleIcon className='h-6 w-6 text-white cursor-pointer'/>
						</div>
						{ showCollectionIDHelp ?
						<>
						<div className="border-solid border-r-slate-200 border-r-[12px] border-y-transparent border-y-[20px] border-l-0"></div>
						<div className='text-nav dark:text-nav-dark text-xs bg-slate-200 rounded-sm p-1 w-[280px]'>
							<span>Your collection ID is alpha-numeric key after <code>/collections/</code> in zotero collection url</span>
							
						</div>
						</>: <></>}
					
					</div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Language of Documents</div>
						<DropdownOptions
							width={'280px'}
							optionsList={['English', 'French', 'Spanish', 'Portuguese', 'German', 'Italian', 'Dutch', 'Arabic', 'Hindi', 'Hungarian', 'Unknown']}
							defaultOption={'English'}
							dropDownCallback={(option:string)=>{
								setLanguageOfDocs(option)
							}}
						/>
					</div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark w-48 p-1'>Embedding Model*</div>
						<DropdownOptions
							width={'280px'}
							optionsList={props.currentSettings?.embedding_models || defaultSettings.embedding_models}
							defaultOption={currentSettings.selectedEmbeddingModel}
							dropDownCallback={(option:string)=>{
								props.settingsCallback({...currentSettings, selectedEmbeddingModel: option})
							}}
						/>
					</div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Chunking Method</div>
						<DropdownOptions
							width={'280px'}
							optionsList={['Fixed Chunk size', 'Structure preserving']}
							defaultOption={'Fixed Chunk size'}
							dropDownCallback={(option:string)=>{
								setChunkingMethod(option)
								if (option === 'Fixed Chunk size'){
									setChunkingMethod('fixed_chunk_size')
									setChunkSizeActive(true)
									setChunkSize('500')
								} else {
									setChunkingMethod('structure_preserving')
									setChunkSizeActive(false)
								}
							}}
						/>
					</div>
					<div className='flex justify-start mx-6 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Chunk Size</div>
						<DropdownOptions
							width={'200px'}
							disabled={!chunkSizeActive}
							optionsList={['500', '750', '1000', '1200']}
							defaultOption={'1000'}
							dropDownCallback={(option:string)=>{
								setChunkSize(option)
							}}
						/>
					</div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Use Overlap</div>
						<DropdownOptions
							width={'280px'}
							optionsList={['Yes', 'No']}
							defaultOption={'Yes'}
							dropDownCallback={(option:string)=>{
								setUseOverlap(option)
							}}
						/>
					</div>
					<div className='flex justify-start m-2'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Use BM25</div>
						<DropdownOptions
							width={'280px'}
							optionsList={['Yes', 'No']}
							defaultOption={'Yes'}
							dropDownCallback={(option:string)=>{
								setUseBM25(option)
							}}
						/>
					</div>
					<div className='flex justify-start m-2'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Reranker</div>
						<DropdownOptions
							width={'280px'}
							optionsList={['qnli-electra-base (default)', 'zerank-2', 'gte-multilingual-reranker', 'mmarco-mMiniLMv2-L12-H384-v1', 'None']}
							defaultOption={'qnli-electra-base (default)'}
							dropDownCallback={(option:string)=>{
								setReranker(option)
							}}
						/>
					</div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Distance Function</div>
						<DropdownOptions
							width={'280px'}
							optionsList={['Squared L2', 'Cosine similarity', 'Inner product']}
							defaultOption={'Squared L2'}
							dropDownCallback={(option:string)=>{
								let request_option = option === 'Cosine similarity' ? 'cosine' : 
									option === 'Inner product' ? 'inner' : 
									'l2'
								setDistanceFn(request_option)
							}}
						/>
					</div>
					<div className='flex justify-start'>
						<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-2 rounded-md my-2' onClick={()=>setAddLibrary(true)}>Add library</button>
					</div>
				</div>
			</div>
			: <></>
		}
		{ uploadPanel ?
			<div className='flex justify-start'>
				<div className='flex flex-col mt-4'>
					{ showSuccess ?
						<div className='flex justify-start'>
							<div className='text-nav dark:text-nav-dark p-1 text-lg bg-green-200 rounded-md'>Library uploaded successfully</div>
						</div> : 
						uploadLibrary && !showSuccess ?
						<div className='flex flex-col justify-start w-full'>
							<div className='text-nav dark:text-nav-dark p-2 text-lg font-semibold bg-orange-100 dark:bg-orange-900 rounded-md mb-3'>
								Uploading Documents
							</div>
							<div className='flex flex-col gap-2 mb-4'>
								<div className='flex justify-between'>
									<div className='text-nav dark:text-nav-dark p-1'>
										<span className='font-semibold'>Stage:</span> {uploadStage.charAt(0).toUpperCase() + uploadStage.slice(1).replace(/_/g, ' ')}
									</div>
									<div className='text-nav dark:text-nav-dark p-1 font-semibold'>
										{uploadProgress}%
									</div>
								</div>
								<div className='w-full bg-gray-300 dark:bg-gray-600 rounded-full h-3 overflow-hidden'>
									<div 
										className='bg-blue-500 dark:bg-blue-600 h-full transition-all duration-300 flex items-center justify-center'
										style={{ width: `${uploadProgress}%` }}
									>
										{uploadProgress > 10 && (
											<span className='text-white text-xs font-bold'>{uploadProgress}%</span>
										)}
									</div>
								</div>
								{uploadProgressMessage && (
									<div className='text-nav dark:text-nav-dark text-sm italic'>
										{uploadProgressMessage}
									</div>
								)}
							</div>
						</div> :
						<></>
					}
					{ showError ?
						<div className='flex justify-start'>
							<div className='text-nav dark:text-nav-dark p-1 text-lg bg-red-200 rounded-md'>{ errorMessage.length ? errorMessage : 'Error uploading documents'}</div>
						</div> : <></>	
					}
					{/* <div className='text-nav dark:text-nav-dark p-1 my-2'> Note: Because of limited resources on the hosting server, upload up to 7-10 PDFs per library. It may take 3-4 minutes to see a success message.</div> */}
					<div className='flex justify-start m-2'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Library Name</div>
						<input type='text' placeholder=' Library Name' disabled={(currentSettings.restriction_without_login && !props.user) || uploadLibrary} className='rounded-md w-[270px] px-2 py-1 dark:bg-gray-500 dark:text-white dark:placeholder:text-white text-nav' value={UploadLibraryName}
							onChange={(e) => setUploadLibraryName(e.target.value)}
						/>
					</div>
					<div className='flex justify-start m-2'>
						{/* multiple documents upload */}
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Select Documents</div>
						<div className='flex flex-col'>
							<input
								ref={uploadFileInputRef}
								type='file'
								disabled={currentSettings.restriction_without_login && !props.user}
								multiple
								className='hidden'
								onChange={(e) => {
									const files = e.target.files
									if (files){
										const docs = Array.from(files).map((file:any) => {return {title: file.name.split('.pdf')[0], file: file}})
										setUploadDocs(docs)
									}
								}}
							/>
							<button
								type='button'
								disabled={(currentSettings.restriction_without_login && !props.user) || uploadLibrary}
								className='rounded-md w-32 px-3 py-1 border border-gray-300 bg-gray-100 text-nav dark:text-nav-dark disabled:opacity-50'
								onClick={() => uploadFileInputRef.current?.click()}
							>
								Choose Files
							</button>
							<div className='text-xs text-nav dark:text-nav-dark mt-1'>
								{selectedUploadDocsCount === 0
									? 'No files selected'
									: `${selectedUploadDocsCount} file${selectedUploadDocsCount === 1 ? '' : 's'} selected`}
							</div>
						</div>
					</div>

					{/* <div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Settings Mode</div>
						<DropdownOptions
							width={'270px'}
							optionsList={['Default settings', 'Advanced settings']}
							defaultOption={'Default settings'}
							dropDownCallback={(option:string)=>{
								setUploadSettingsMode(option)
							}}
						/>
					</div> */}

					{uploadSettingsMode === 'Advanced settings' ?
						<div className='mt-3 pt-2 border-t border-panel1'>
							<div className='flex justify-start mx-2 my-1'>
								<div className='text-nav dark:text-nav-dark p-1 w-48'>Language of Documents</div>
								<DropdownOptions
									width={'270px'}
									optionsList={['English', 'French', 'Spanish', 'Portuguese', 'Unknown']}
									defaultOption={'English'}
									dropDownCallback={(option:string)=>{
										setLanguageOfDocs(option)
									}}
								/>
							</div>
							<div className='flex justify-start m-2'>
								<div className='text-nav dark:text-nav-dark p-1 w-48'>Embedding model</div>
								<DropdownOptions
									width={'270px'}
									optionsList={props.currentSettings?.embedding_models || defaultSettings.embedding_models}
									defaultOption={currentSettings.selectedEmbeddingModel}
									dropDownCallback={(option:string)=>{
										props.settingsCallback({...currentSettings, selectedEmbeddingModel: option})
									}}
								/>
							</div>
							<div className='flex justify-start mx-2 my-1'>
								<div className='text-nav dark:text-nav-dark p-1 w-48'>Chunking Method</div>
								<DropdownOptions
									width={'270px'}
									optionsList={['Fixed Chunk size', 'Structure preserving']}
									defaultOption={'Fixed Chunk size'}
									dropDownCallback={(option:string)=>{
										setChunkingMethod(option)
										if (option === 'Fixed Chunk size'){
											setChunkingMethod('fixed_chunk_size')
											setChunkSizeActive(true)
											setChunkSize('500')
										} else {
											setChunkingMethod('structure_preserving')
											setChunkSizeActive(false)
										}
									}}
								/>
							</div>
							<div className='flex justify-start mx-6 my-1'>
								<div className='text-nav dark:text-nav-dark p-1 w-48'>Chunk Size</div>
								<DropdownOptions
									width={'200px'}
									disabled={!chunkSizeActive}
									optionsList={['500', '750', '1000', '1200']}
									defaultOption={'1000'}
									dropDownCallback={(option:string)=>{
										setChunkSize(option)
									}}
								/>
							</div>
							<div className='flex justify-start m-2'>
								<div className='text-nav dark:text-nav-dark p-1 w-48'>Use Overlap</div>
								<DropdownOptions
									width={'270px'}
									optionsList={['Yes', 'No']}
									defaultOption={'Yes'}
									dropDownCallback={(option:string)=>{
										setUseOverlap(option)
									}}
								/>
							</div>
							<div className='flex justify-start m-2'>
								<div className='text-nav dark:text-nav-dark p-1 w-48'>Use BM25</div>
								<DropdownOptions
									width={'270px'}
									optionsList={['Yes', 'No']}
									defaultOption={'Yes'}
									dropDownCallback={(option:string)=>{
										setUseBM25(option)
									}}
								/>
							</div>
							<div className='flex justify-start m-2'>
								<div className='text-nav dark:text-nav-dark p-1 w-48'>Reranker</div>
								<DropdownOptions
									width={'270px'}
									optionsList={['qnli-electra-base (default)', 'zerank-2', 'gte-multilingual-reranker', 'mmarco-mMiniLMv2-L12-H384-v1', 'None']}
									defaultOption={'qnli-electra-base (default)'}
									dropDownCallback={(option:string)=>{
										setReranker(option)
									}}
								/>
							</div>
							<div className='flex justify-start m-2'>
								<div className='text-nav dark:text-nav-dark p-1 w-48'>Distance Function</div>
								<DropdownOptions
									width={'270px'}
									optionsList={['Squared L2', 'Cosine similarity', 'Inner product']}
									defaultOption={'Squared L2'}
									dropDownCallback={(option:string)=>{
										let request_option = option === 'Cosine similarity' ? 'cosine' :
											option === 'Inner product' ? 'inner' :
											'l2'
										setDistanceFn(request_option)
									}}
								/>
							</div>
						</div>
					: <></>}

					<div className='flex justify-center mt-2'>
						<button 
							disabled={uploadLibrary}
							className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-2 rounded-md m-2 disabled:opacity-50 disabled:cursor-not-allowed'
							onClick={() => {
								try {
									localStorage.removeItem(stateKey)
								} catch (error) {
									console.error('Failed to clear uploadNodeData from localStorage:', error)
								}
								setUploadLibrary(true)
							}}
						>Upload documents</button>
						{hasStoredLibraryData ? (
							<button
								type='button'
								disabled={uploadLibrary}
								className='bg-white text-panel1 border border-panel1 dark:bg-nav-dark dark:text-nav-dark px-4 py-2 rounded-md m-2 disabled:opacity-50 disabled:cursor-not-allowed'
								onClick={clearUploadLibraryForm}
							>
								Clear form
							</button>
						) : null}
					</div>
				</div>
			</div>
			: <></>
		}
		{ videoPanel ?
			<div className='flex justify-start'>
				<div className='flex flex-col mt-4'>
					{ showSuccess ?
						<div className='flex justify-start'>
							<div className='text-nav dark:text-nav-dark p-1 text-lg bg-green-200 dark:bg-green-700 rounded-md'>Library uploaded successfully</div>
						</div> : 
						videoLibrary && !showSuccess ?
						<div className='flex justify-start'>
							<div className='text-nav dark:text-nav-dark p-1 text-lg bg-orange-200 dark:bg-orange-700 rounded-md'>Uploading documents...</div>
						</div> :
						<></>
					}
					<div className='flex justify-start p-2'>
						<div className='text-nav dark:text-nav-dark w-40 p-1 my-2'>Library Name</div>
						<input 
							disabled={currentSettings.restriction_without_login && !props.user ? true : false} 
							// disabled={true}
							type='text' placeholder=' Library Name' className='rounded-md w-60 px-2 py-1 m-2 text-nav dark:text-white dark:bg-gray-500 dark:placeholder:text-white' value={videoLibraryName}
							onChange={(e) => setVideoLibraryName(e.target.value)}
						/>
					</div>
					{/* <div className='text-nav dark:text-nav-dark p-1 my-2'> Note: MyGPT currently supports YouTube videos with closed captions only. <br/> Because of restrictions on hosting server, YouTube upload has been disabled.
						To test the feature, we recommand installing it on your local machine.
					</div> */}
					<div className='flex justify-start p-2 flex-col'>
						<div>
							<div className='text-nav dark:text-nav-dark w-40 p-1 my-2'>YouTube Playlist link</div>
							<input 
								disabled={currentSettings.restriction_without_login && !props.user ? true : false} 
								// disabled={true}
								type='text' placeholder=' YouTube playlist link' className='rounded-md w-72 px-2 py-1 m-2 text-nav dark:text-white dark:bg-gray-500 dark:placeholder:text-white' value={videoPlaylistURL}
								onChange={(e) => setVideoPlaylistURL(e.target.value)}
							/>
						</div>
						<div className='flex justify-start text-nav dark:text-nav-dark font-bold p-1 my-2 mx-auto w-72'> OR </div>
						<div className='w-72'>
							<div className='text-nav dark:text-nav-dark p-1 my-2'>YouTube vidoe links</div>
							<div className='flex flex-col justify-start'>
								{/* for loop for uploaddoccount */}
								{[...Array(uploadDocCount)].map((_x:any, i:any) => (
									<div key={i} className='m-2'>
										<input 
										disabled={currentSettings.restriction_without_login && !props.user ? true : false} 
										// disabled={true}
										type='text' placeholder=' Youtube video link' className='rounded-md w-72 px-2 py-1 text-nav dark:text-white dark:bg-gray-500 dark:placeholder:text-white'
											value={videoDocURLs[i]} onChange={(e) =>{
												const temp = [...videoDocURLs]
												temp[i] = e.target.value
												setVideoDocURLs(temp)
											}}
										/>
									</div>
								))}
							</div>
							{uploadDocCount < 41 ? <button className='text-panel1 bg-white dark:bg-panel3-dark dark:text-nav-dark px-4 py-2 rounded-md mx-2' 
							// disabled={true} 
							onClick={()=>setUploadDocCount(uploadDocCount+5)}>+5</button> : <></>}
						</div>
					</div>
					<div className='flex justify-start text-nav dark:text-nav-dark font-bold p-1 my-2 mx-auto w-72'> AND </div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Embedding Model</div>
						<DropdownOptions
							width={'280px'}
							optionsList={props.currentSettings.embedding_models}
							defaultOption={currentSettings.sentence_transformer}
							dropDownCallback={(option:string)=>{
								props.settingsCallback({...currentSettings, selectedEmbeddingModel: option})
							}}
						/>
					</div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Use Overlap</div>
						<DropdownOptions
							width={'280px'}
							optionsList={['Yes', 'No']}
							defaultOption={'Yes'}
							dropDownCallback={(option:string)=>{
								setUseOverlap(option)
							}}
						/>
					</div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Chunking Method</div>
						<DropdownOptions
							width={'280px'}
							optionsList={['Fixed Chunk size', 'Structure preserving']}
							defaultOption={'Fixed Chunk size'}
							dropDownCallback={(option:string)=>{
								setChunkingMethod(option)
								if (option === 'Fixed Chunk size'){
									setChunkingMethod('fixed_chunk_size')
									setChunkSizeActive(true)
									setChunkSize('500')
								} else {
									setChunkingMethod('structure_preserving')
									setChunkSizeActive(false)
								}
							}}
						/>
					</div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Chunk Size</div>
						<DropdownOptions
							width={'280px'}
							disabled={!chunkSizeActive}
							optionsList={['500', '750', '1000', '1200']}
							defaultOption={'1000'}
							dropDownCallback={(option:string)=>{
								setChunkSize(option)
							}}
						/>
					</div>
					<div className='flex justify-start mx-2 my-1'>
						<div className='text-nav dark:text-nav-dark p-1 w-48'>Distance Function</div>
						<DropdownOptions
							width={'280px'}
							optionsList={['Squared L2', 'Cosine similarity', 'Inner product']}
							defaultOption={'Squared L2'}
							dropDownCallback={(option:string)=>{
								let request_option = option === 'Cosine similarity' ? 'cosine' : 
									option === 'Inner product' ? 'inner' : 
									'l2'
								setDistanceFn(request_option)
							}}
						/>
					</div>
					<div className='flex justify-start'>
						<button className='bg-panel1 text-white dark:bg-panel3-dark dark:text-nav-dark px-4 py-2 rounded-md m-2' disabled={currentSettings.restriction_without_login && !props.user ? true : false}
							onClick={() => setVideoLibrary(true)}
						>Add videos</button>
					</div>
				</div>
			</div>
			: <></>
		}
	</div>
  )
}

export default AddLibrarySettings