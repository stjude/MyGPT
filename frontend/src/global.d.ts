declare module '*.css'

interface MyGPTRuntimeConfig {
	backendApiUrl: string
	ollamaApiUrl: string
	autoStartBackend: boolean
}

interface MyGPTElectronAPI {
	isDesktop: boolean
	openExternalUrl: (url: string) => Promise<void>
	getApiBaseUrl: () => Promise<string>
	getRuntimeConfig: () => Promise<{
		backendUrl: string
		ollamaUrl: string
		autoStartBackend: boolean
	}>
	saveRuntimeConfig: (config: {
		backendUrl: string
		ollamaUrl: string
		autoStartBackend: boolean
	}) => Promise<{
		success: boolean
		config?: {
			backendUrl: string
			ollamaUrl: string
			autoStartBackend: boolean
		}
		error?: string
		warning?: string
	}>
	getServicesStatus: () => Promise<{
		backendRunning: boolean
		ollamaRunning: boolean
	}>
	startBackendContainers: () => Promise<{ success: boolean; error?: string }>
	getOllamaStatus: () => Promise<{ isRunning: boolean; models: any[] }>
	pullOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
}

interface Window {
	mygptRuntimeConfig: MyGPTRuntimeConfig
	electronAPI?: MyGPTElectronAPI
}
