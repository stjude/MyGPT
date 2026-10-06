import { useState, useEffect } from 'react'

const LLMSettings = (props: {
	llms:any, 
	llm:string,
	selectedLlm:string,
	currentSettings:any,
	settingsCallback:any
}) => {
	
	let currentSettings = props.currentSettings
	let llmsDownload = ['llama3.1:latest', 'llama3:latest', 'Mistral:latest', 'Vicuna:latest', 'Orca-mini:latest', 'Gemma2:latest', 'Tinyllama:latest', 'Llama2:13b', 'Llama3:70b']
		.filter((llm:string) => !props.llms.includes(llm.toLowerCase()))
	const [llmToLoad, setLlmToLoad] = useState('')
	const [message, setMessage] = useState('')
	const [modelLoaded, setModelLoaded] = useState(false)
	const [progressPercent, setProgressPercent] = useState<number>(0)

	// add new model by calling Ollama API
	const addOllamaModel = (model_name:string) => {
		
		if(model_name !== ''){
			const model = model_name.toLowerCase()
			setLlmToLoad(model)
			setProgressPercent(0)
			setModelLoaded(false)

			const body = JSON.stringify({
				'name': model
			})

			// fetch using async await
			const postData = async () => {
				const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/ollama_pull_model/`, {body, method: 'POST'})
				const reader:any = response.body?.getReader()
				if (!reader) {
					setMessage('No streaming response from server')
					return
				}

				const decoder = new TextDecoder()
				let buffer = ''

				const markDownloadSuccess = () => {
					let new_llms = props.llms
					new_llms.push(model_name)
					currentSettings.selectedLlm = model_name
					setMessage('success')
					setProgressPercent(100)
					setModelLoaded(true)
					llmsDownload = llmsDownload.filter((llm:string) => llm !== model_name)
				}

				const handleEvent = (json:any) => {
					if (json.error) {
						setProgressPercent(0)
						setMessage(json.error_message || 'Pull failed')
						return 'error'
					}

					if (json.type === 'progress' && typeof json.percent === 'number') {
						setProgressPercent(Math.max(0, Math.min(100, json.percent)))
					}

					const status = json.status || ''
					if (status) {
						setMessage(status)
					}

					if (json.done === true) {
						markDownloadSuccess()
						return 'done'
					}

					return 'continue'
				}

				while (true) {
					const { done, value } = await reader.read()
					if (done) {
						break
					} else {
						buffer += decoder.decode(value, { stream: true })
						// Handle both NDJSON and concatenated JSON objects like `}{`
						buffer = buffer.replace(/}\s*{/g, '}\n{')
						const parts = buffer.split('\n')
						buffer = parts.pop() || ''

						for (const part of parts) {
							if (!part.trim()) continue
							try {
								const json = JSON.parse(part)
								const result = handleEvent(json)
								if (result === 'done' || result === 'error') {
									return
								}
							} catch {
								buffer = part + '\n' + buffer
								break
							}
						}
					}
				}

				if (buffer.trim().length) {
					try {
						const json = JSON.parse(buffer)
						handleEvent(json)
					} catch {
						// ignore incomplete trailing fragments
					}
				}
			}

			// check if the api is available
			const check = async () => {
				try {
					const r = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_ollama_models/`, { method: 'POST' })
					const data = await r.json()
					const hasModelList = Array.isArray(data?.models)
					if (!hasModelList) {
						throw new Error('Invalid response structure')
					}
					console.log('API is available')
					postData()
				} catch {
					console.log('API is not available')
					setMessage('API is not available (Ollama Server unavailable)')
				}
			}
			check()
		}
	}

	useEffect(() => {
		if (message === 'success' && modelLoaded) {
			const timer = setTimeout(() => {
				setMessage('')
				setModelLoaded(false)
				setProgressPercent(0)
			}, 10000)
			return () => clearTimeout(timer)
		}
	}, [message, modelLoaded])

	// add new model to backend API
	useEffect(() => {
		if(message === 'success' && llmToLoad !== '' && currentSettings.selectedLlm !== ''){
			// const model = currentSettings.selectedLlm.toLowerCase()
			const postData = async () => {
				const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_ollama_models/`, {method: 'POST'})
				const data = await response.json()
				// const llm = data.models.filter((model:any) => model.name.split(':')[0] === currentSettings.selectedLlm.toLowerCase())[0]
				const llm = data.models.filter((model:any) => model.name === currentSettings.selectedLlm.toLowerCase())[0]
				// convert bytes to GB
				const llm_size = llm.size* 1e-9
				const llm_size_gb = llm_size.toFixed(2)
				console.log(llm_size_gb, llm)

				// add new model to backend API
				const requestOptions = {
					method: 'POST',
					headers: { 
						'Content-Type': 'application/json',
						'Authorization': `${import.meta.env.PROD ? import.meta.env.VITE_AUTH_TOKEN_PROD : import.meta.env.VITE_AUTH_TOKEN_DEV}`
					},
					setConnection: 'keep-alive',
					keepalive: true,
					setTimeout: 10000,
					body: JSON.stringify({
						'llms': [{ 
							'name': llm.name,
							'size': llm_size_gb,
						}]})
				}
				let llm_endpoint = 'add_ollama_models'
				fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/${llm_endpoint}/?format=json`, requestOptions)
					.then(response => response.json())
					.then((data:any) => {
						props.settingsCallback({...currentSettings, llms:llm.name})
						setLlmToLoad('')
						console.log('Success:', data)
					})
			}
			postData()
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [message, currentSettings.selectedLlm])


	  return (
		<div className='px-8 py-2 divide-y'>
			<div className='flex flex-col justify-start my-4'>
				<div className='text-nav dark:text-nav-dark px-2 flex justify-start my-2 text-lg font-semibold'> Available LLMs on system </div>
				<div className='text-nav dark:text-nav-dark px-4 flex justify-start'>
					<ul className='list-disc'>
						{props.llms.map((llm:string, index:number) => {
							return(
								<li key={index} className='ml-4'>
									<div className='flex justify-between m-1 text-nav dark:text-nav-dark'>
										{llm}
										<div>
											<button className={'ml-2 px-2 rounded-md w-24' 
												+ (llm === props.selectedLlm ? ' bg-gray-300 text-nav' : ' bg-panel1 dark:bg-panel3-dark text-white')}
												onClick={()=>{
													currentSettings.selectedLlm = llm
													props.settingsCallback(currentSettings)
												}}
												disabled={llm === props.selectedLlm ? true : false}
											>{ llm === props.selectedLlm ? 'Selected' : 'Select'}</button>
											
											{/* <button className='ml-2 bg-red-900 text-white px-2 rounded-md'
												onClick={()=>{setDeleteDataset(dataset)}}
											>Delete</button> */}
										</div>
									</div>
								</li>
							)
						})}
					</ul>
				</div>
			</div>
			{ 
				currentSettings.restriction_without_login ? <></> :
				<div className='flex flex-col justify-start my-4'>
					<div className='text-nav dark:text-nav-dark px-2 flex justify-start my-2 text-lg font-semibold'> LLMs ready to download </div>
					{ 
						message === '' ? <></> :
						<div className={'ml-2 text-nav dark:text-nav-dark px-2 py-2 rounded-md' + (modelLoaded ? ' bg-green-200' : ' bg-orange-200')}>
							<div className='flex items-center justify-between gap-2'>
								<span>{message}</span>
								{modelLoaded ? (
									<button
										onClick={() => {
											setMessage('')
											setModelLoaded(false)
											setProgressPercent(0)
										}}
										className='px-2 rounded bg-white/80 hover:bg-white text-nav'
									>
										x
									</button>
								) : <span />}
							</div>
							{!modelLoaded && progressPercent > 0 ? (
								<div className='mt-2'>
									<div className='w-full h-2 bg-white/60 rounded overflow-hidden'>
										<div
											className='h-2 bg-[#2A4759]'
											style={{ width: `${progressPercent}%` }}
										/>
									</div>
									<div className='text-xs mt-1 opacity-80'>{progressPercent.toFixed(2)}%</div>
								</div>
							) : <></>}
						</div>
					}
					<div className='text-nav dark:text-nav-dark px-4 flex justify-start'>
						<ul className='list-disc'>
							{llmsDownload.map((llm:string, index:number) => {
								return(
									<li key={index} className='ml-4'>
										<div className='flex justify-between m-1 text-nav dark:text-nav-dark'>
											<div className='w-32'>
												{llm}
											</div>
											<div>
												<button className={'ml-2 text-white px-2 rounded-md' + (message.length ? ' bg-gray-300' : ' bg-panel1 dark-bg-nav dark:bg-panel3-dark text-white')} 
													onClick={()=>{addOllamaModel(llm)}}
													disabled={message.length && !modelLoaded ? true : false}
												>{'Download'}</button>
											</div>
										</div>
									</li>
								)
							})}
						</ul>
					</div>
				</div>
	}
	</div>
  );
}

export default LLMSettings