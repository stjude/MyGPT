// Shared auth header helper (mirrors SettingsAPI.tsx)
export const getAuthHeader = (frontendSettings: any): string => {
	const jwtAccessToken = localStorage.getItem('access')
	if (jwtAccessToken?.length) {
		return 'Bearer ' + jwtAccessToken
	}
	const staticToken = import.meta.env.PROD
		? import.meta.env.VITE_AUTH_TOKEN_PROD ?? ''
		: import.meta.env.VITE_AUTH_TOKEN_DEV ?? ''

	// Fall back to static token when JWT is not available.
	return staticToken
}

// GET Ollama api/tags  +  POST api/add_ollama_models/  +  POST api/add_embedding_models/
// Returns filtered LLM names (non-F16 models).
export const fetchAndRegisterOllamaModels = async (
	frontendSettings: any,
	signal?: AbortSignal
): Promise<string[]> => {
	try {
		const response = await fetch(`${window.mygptRuntimeConfig.ollamaApiUrl}api/tags`, {
			method: 'GET',
			signal,
		})
		if (!response.ok) {
			return []
		}
		const data = await response.json()

		const llms: string[] = data.models
			.filter((model: any) => model.quantization_level !== 'F16')
			.map((model: any) => model.name)

		const llms_object = data.models.map((model: any) => ({
			name: model.name,
			size: (model.size * 1e-9).toFixed(2),
		}))

		const authHeader = getAuthHeader(frontendSettings)

		if (frontendSettings && frontendSettings.django_login && localStorage.getItem('access')?.length) {
			const registerOptions: RequestInit = {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
				keepalive: true,
				body: JSON.stringify({ llms: llms_object }),
				signal,
			}
			const response2 = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/add_ollama_models/`, registerOptions)
			if (response2.ok) {
				const data2 = await response2.json()
				console.log(data2)
			}
		}

		const embeddingModels = data.models.filter(
			(model: any) =>
				(model.quantization_level === 'F16' && model.family.includes('bert')) ||
				model.family.includes('nomic-bert')
		)
		const embedding_models_object = embeddingModels.map((model: any) => ({
			name: model.name,
			size: (model.size * 1e-9).toFixed(2),
			source: 'ollama',
		}))

		if (frontendSettings) {
			const embeddingOptions: RequestInit = {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
				keepalive: true,
				body: JSON.stringify({ embedding_models: embedding_models_object }),
				signal,
			}
			const response3 = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/add_embedding_models/`, embeddingOptions)
			if (response3.ok) {
				const data3 = await response3.json()
				console.log(data3)
			}
		}

		return llms
	} catch (err: any) {
		if (err?.name !== 'AbortError') {
			console.warn('fetchAndRegisterOllamaModels: backend unreachable', err)
		}
		return []
	}
}

// POST api/get_dataset_details/
export const fetchDatasetDetails = async (
	dataset: string,
	user: any,
	frontendSettings: any,
	signal?: AbortSignal
): Promise<any> => {
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_dataset_details/?format=json`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': getAuthHeader(frontendSettings),
		},
		body: JSON.stringify({
			dataset,
			user_email: user?.user_email ?? '',
			user_group: user?.otherRoles?.length ? user.otherRoles[0] : '',
		}),
		signal,
	})
	return response.json()
}

// POST api/get_documents/
export const fetchDocuments = async (
	dataset: string,
	user: any,
	frontendSettings: any,
	signal?: AbortSignal
): Promise<any> => {
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_documents/?format=json`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': getAuthHeader(frontendSettings),
		},
		body: JSON.stringify({
			dataset,
			user_email: user?.user_email ?? '',
			user_group: user?.otherRoles?.length ? user.otherRoles[0] : '',
		}),
		signal,
	})
	return response.json()
}

// POST api/get_sections/
export const fetchSections = async (
	datasetName: string,
	frontendSettings: any,
	signal?: AbortSignal
): Promise<any> => {
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_sections/?format=json`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': getAuthHeader(frontendSettings),
		},
		body: JSON.stringify({ dataset_name: datasetName }),
		signal,
	})
	return response.json()
}

// GET api/add_demo_library/
export const addDemoLibraryRequest = async (
	sentenceTransformer: string,
	frontendSettings: any,
	signal?: AbortSignal
): Promise<any> => {
	const params = new URLSearchParams({
		format: 'json',
		embedding_model: sentenceTransformer,
	})
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/add_demo_library/?${params.toString()}`, {
		method: 'GET',
		headers: {
			'Authorization': getAuthHeader(frontendSettings),
		},
		signal,
	})
	return response.json()
}

// POST api/get_context/
export const fetchContext = async (
	requestBody: Record<string, any>,
	frontendSettings: any,
	signal?: AbortSignal
): Promise<any> => {
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_context/?format=json`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': getAuthHeader(frontendSettings),
		},
		keepalive: true,
		body: JSON.stringify(requestBody),
		signal,
	})
	return response.json()
}

// POST api/save_answer/
export const saveAnswer = async (
	requestBody: Record<string, any>,
	frontendSettings: any,
	signal?: AbortSignal
): Promise<any> => {
	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/save_answer/?format=json`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': getAuthHeader(frontendSettings),
		},
		body: JSON.stringify(requestBody),
		signal,
	})
	return response.json()
}

// GET protected media through authenticated request and return an object URL.
export const fetchProtectedMediaBlobUrl = async (
	mediaPath: string,
	frontendSettings: any,
	signal?: AbortSignal
): Promise<string> => {
	if (!mediaPath) return ''
	const authHeader = getAuthHeader(frontendSettings)
	const requestHeaders: Record<string, string> = {}
	if (authHeader) {
		requestHeaders['Authorization'] = authHeader
	}

	const response = await fetch(`${window.mygptRuntimeConfig.backendApiUrl}media/${mediaPath}`, {
		method: 'GET',
		headers: requestHeaders,
		signal,
	})

	if (!response.ok) {
		const error = new Error(`Failed to fetch media: ${response.status}`)
		;(error as any).status = response.status
		throw error
	}

	const blob = await response.blob()
	return URL.createObjectURL(blob)
}
