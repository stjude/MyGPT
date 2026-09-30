export interface RuntimeConfig {
	backendUrl: string
	ollamaUrl: string
	autoStartBackend: boolean
}

const withTrailingSlash = (value: string): string => `${value.replace(/\/+$/, '')}/`

const defaults: RuntimeConfig = {
	backendUrl: (import.meta.env.VITE_BACKEND_API || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
	ollamaUrl: (import.meta.env.VITE_OLLAMA_API || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
	autoStartBackend: true,
}

window.mygptRuntimeConfig = {
	backendApiUrl: withTrailingSlash(defaults.backendUrl),
	ollamaApiUrl: withTrailingSlash(defaults.ollamaUrl),
	autoStartBackend: defaults.autoStartBackend,
}

export const applyRuntimeConfig = (config: RuntimeConfig): void => {
	window.mygptRuntimeConfig = {
		backendApiUrl: withTrailingSlash(config.backendUrl),
		ollamaApiUrl: withTrailingSlash(config.ollamaUrl),
		autoStartBackend: config.autoStartBackend,
	}
}

export const initializeRuntimeConfig = async (): Promise<void> => {
	if (!window.electronAPI?.getRuntimeConfig) return
	try {
		const config = await window.electronAPI.getRuntimeConfig()
		applyRuntimeConfig(config)
	} catch (error) {
		console.error('Failed to load desktop runtime configuration:', error)
	}
}

export const getRuntimeConfig = (): RuntimeConfig => ({
	backendUrl: window.mygptRuntimeConfig.backendApiUrl.replace(/\/+$/, ''),
	ollamaUrl: window.mygptRuntimeConfig.ollamaApiUrl.replace(/\/+$/, ''),
	autoStartBackend: window.mygptRuntimeConfig.autoStartBackend,
})
