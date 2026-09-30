import React, { useState, useEffect } from 'react'
import {
	CodeBracketSquareIcon,
	DocumentTextIcon,
	ArrowTopRightOnSquareIcon,
	ClipboardDocumentCheckIcon,
	ClipboardDocumentIcon,
	ArrowDownTrayIcon,
	CheckCircleIcon,
	XCircleIcon,
	ArrowPathIcon,
	KeyIcon,
	ShieldCheckIcon,
	QrCodeIcon,
	UserPlusIcon,
	LockClosedIcon,
	FingerPrintIcon
} from '@heroicons/react/24/outline'
import { applyRuntimeConfig, getRuntimeConfig, RuntimeConfig } from '../utils/runtimeConfig'

interface DeveloperAPISettingsProps {
	currentSettings: any
	settingsCallback: any
	user?: any
	djangoLogin?: boolean
}

const RECOMMENDED_MODELS = [
	{ name: 'llama3.2:latest', type: 'LLM', desc: 'Fast, lightweight general reasoning model (3B)' },
	{ name: 'llama3.1:8b', type: 'LLM', desc: 'High capability reasoning and RAG model (8B)' },
	{ name: 'nomic-embed-text:latest', type: 'Embedding', desc: 'Standard high-speed text embedding model' },
	{ name: 'bge-m3:latest', type: 'Embedding', desc: 'Multilingual multi-functionality embedding model' },
]

const canManageDockerBackend = (value: string): boolean => {
	try {
		const endpoint = new URL(value)
		return endpoint.protocol === 'http:' &&
			['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname.toLowerCase()) &&
			(endpoint.pathname === '/' || endpoint.pathname === '')
	} catch {
		return false
	}
}

export const DeveloperAPISettings: React.FC<DeveloperAPISettingsProps> = ({
	currentSettings,
	djangoLogin
}) => {
	const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(getRuntimeConfig())
	const [runtimeDraft, setRuntimeDraft] = useState<RuntimeConfig>(runtimeConfig)
	const [runtimeMessage, setRuntimeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
	const [isSavingRuntime, setIsSavingRuntime] = useState(false)
	const [isStartingBackend, setIsStartingBackend] = useState(false)
	const backendUrl = runtimeConfig.backendUrl
	const ollamaUrl = runtimeConfig.ollamaUrl
	const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
	const [copiedToken, setCopiedToken] = useState(false)
	const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
	const [activeSnippetTab, setActiveSnippetTab] = useState<'rag' | 'datasets' | 'chat' | 'upload'>('rag')
	
	// Superuser & Token Generation Form State
	const [loginUsername, setLoginUsername] = useState('')
	const [loginPassword, setLoginPassword] = useState('')
	const [loginOtpCode, setLoginOtpCode] = useState('')
	const [isAuthenticating, setIsAuthenticating] = useState(false)
	const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
	const [testTokenStatus, setTestTokenStatus] = useState<string | null>(null)
	const [isTestingToken, setIsTestingToken] = useState(false)

	// Ollama model downloader state
	const [pullModelName, setPullModelName] = useState('')
	const [pullStatus, setPullStatus] = useState<string | null>(null)
	const [isPulling, setIsPulling] = useState(false)
	const [installedModels, setInstalledModels] = useState<string[]>([])
	const [isCheckingOllama, setIsCheckingOllama] = useState(false)
	const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null)
	const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

	const [jwtAccessToken, setJwtAccessToken] = useState<string>(localStorage.getItem('access') || '')

	const saveRuntimeSettings = async () => {
		setIsSavingRuntime(true)
		setRuntimeMessage(null)
		try {
			let saved = runtimeDraft
			let warning: string | undefined
			if (window.electronAPI?.saveRuntimeConfig) {
				const result = await window.electronAPI.saveRuntimeConfig(runtimeDraft)
				if (!result.success || !result.config) {
					throw new Error(result.error || 'Unable to save runtime settings.')
				}
				saved = result.config
				warning = result.warning
			} else {
				for (const [label, value] of [['Backend URL', runtimeDraft.backendUrl], ['Ollama URL', runtimeDraft.ollamaUrl]]) {
					const parsed = new URL(value)
					if (!['http:', 'https:'].includes(parsed.protocol)) {
						throw new Error(`${label} must use HTTP or HTTPS.`)
					}
				}
			}
			applyRuntimeConfig(saved)
			setRuntimeConfig(saved)
			setRuntimeDraft(saved)
			setRuntimeMessage({
				type: warning ? 'error' : 'success',
				text: warning || 'Runtime endpoints saved and applied.',
			})
			setTimeout(checkOllamaStatus, 0)
		} catch (error: any) {
			setRuntimeMessage({ type: 'error', text: error.message })
		} finally {
			setIsSavingRuntime(false)
		}
	}

	const startBackendContainers = async () => {
		if (!window.electronAPI?.startBackendContainers) return
		setIsStartingBackend(true)
		setRuntimeMessage(null)
		try {
			const result = await window.electronAPI.startBackendContainers()
			if (!result.success) throw new Error(result.error || 'Unable to start backend containers.')
			setRuntimeMessage({ type: 'success', text: 'Backend containers started successfully.' })
			await checkOllamaStatus()
		} catch (error: any) {
			setRuntimeMessage({ type: 'error', text: error.message })
		} finally {
			setIsStartingBackend(false)
		}
	}

	const copyToClipboard = (text: string, id: string) => {
		navigator.clipboard.writeText(text)
		if (id === 'token') {
			setCopiedToken(true)
			setTimeout(() => setCopiedToken(false), 2000)
		} else if (id.startsWith('cmd_')) {
			setCopiedCommand(id)
			setTimeout(() => setCopiedCommand(null), 2000)
		} else {
			setCopiedSnippet(id)
			setTimeout(() => setCopiedSnippet(null), 2000)
		}
	}

	const handleGenerateToken = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!loginUsername.trim() || !loginPassword) {
			setAuthMessage({ type: 'error', text: 'Please provide both username and password.' })
			return
		}

		setIsAuthenticating(true)
		setAuthMessage(null)

		try {
			const res = await fetch(`${backendUrl}/token/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: loginUsername.trim(),
					password: loginPassword
				})
			})

			const data = await res.json()
			if (res.ok && data.access) {
				localStorage.setItem('access', data.access)
				if (data.refresh) localStorage.setItem('refresh', data.refresh)
				setJwtAccessToken(data.access)
				setAuthMessage({
					type: 'success',
					text: 'Authentication successful! JWT access token obtained and stored.'
				})
				setLoginPassword('')
				setLoginOtpCode('')
			} else {
				setAuthMessage({
					type: 'error',
					text: data.detail || 'Authentication failed. Verify that your superuser account exists and the password is correct.'
				})
			}
		} catch (err: any) {
			setAuthMessage({
				type: 'error',
				text: `Connection error: Could not reach ${backendUrl}. Ensure the backend is running.`
			})
		} finally {
			setIsAuthenticating(false)
		}
	}

	const handleTestToken = async () => {
		if (!jwtAccessToken) return
		setIsTestingToken(true)
		setTestTokenStatus('Testing token...')
		try {
			const res = await fetch(`${backendUrl}/api/get_datasets/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${jwtAccessToken}`
				},
				body: JSON.stringify({ user_email: '', user_group: '' })
			})
			if (res.ok) {
				const datasets = await res.json()
				setTestTokenStatus(`Valid! Access verified with ${datasets.length || 0} dataset(s) found.`)
			} else {
				setTestTokenStatus(`Error: Server responded with status ${res.status} (${res.statusText})`)
			}
		} catch (err: any) {
			setTestTokenStatus(`Network error: ${err.message}`)
		} finally {
			setIsTestingToken(false)
		}
	}

	const handleClearToken = () => {
		localStorage.removeItem('access')
		localStorage.removeItem('refresh')
		setJwtAccessToken('')
		setTestTokenStatus(null)
		setAuthMessage(null)
	}

	const checkOllamaStatus = async () => {
		setIsCheckingOllama(true)
		try {
			// Check backend
			try {
				const bRes = await fetch(`${backendUrl}/api/frontend_settings/?format=json`, { method: 'GET' })
				setBackendOnline(bRes.ok)
			} catch {
				setBackendOnline(false)
			}

			// Check Ollama
			const res = await fetch(`${backendUrl}/api/get_ollama_models/`, { method: 'POST' })
			if (res.ok) {
				const data = await res.json()
				const modelNames = (data.models || []).map((m: any) => m.name)
				setInstalledModels(modelNames)
				setOllamaOnline(modelNames.length > 0 || Boolean(data.models))
			} else {
				// Fallback to direct local Ollama check
				try {
					const directRes = await fetch(`${ollamaUrl}/api/tags`)
					if (directRes.ok) {
						const directData = await directRes.json()
						const names = (directData.models || []).map((m: any) => m.name)
						setInstalledModels(names)
						setOllamaOnline(true)
					} else {
						setOllamaOnline(false)
					}
				} catch {
					setOllamaOnline(false)
				}
			}
		} catch {
			setOllamaOnline(false)
		} finally {
			setIsCheckingOllama(false)
		}
	}

	useEffect(() => {
		checkOllamaStatus()
		// Recheck after a saved endpoint changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [backendUrl, ollamaUrl])

	const handlePullModel = async (modelName: string) => {
		if (!modelName.trim()) return
		setIsPulling(true)
		setPullStatus(`Pulling ${modelName}... Please wait.`)
		try {
			const res = await fetch(`${backendUrl}/api/ollama_pull_model/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ model_name: modelName.trim() })
			})
			const data = await res.json()
			if (res.ok) {
				setPullStatus(`Successfully downloaded ${modelName}!`)
				checkOllamaStatus()
			} else {
				setPullStatus(`Error: ${data.message || data.error || 'Failed to download model'}`)
			}
		} catch (err: any) {
			setPullStatus(`Network error: ${err.message}`)
		} finally {
			setIsPulling(false)
		}
	}

	const pythonSnippets = {
		rag: `import requests

# 1. Base URL for your running MyGPT backend
BASE_URL = "${backendUrl}"

# 2. JWT Access Token (generated via Developer / API menu or POST /token/)
access_token = "${jwtAccessToken || 'YOUR_JWT_ACCESS_TOKEN'}"

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# 3. Retrieve relevant context chunks (RAG) for your research question
dataset_name = "${currentSettings.selectedDataset || 'MyGPT'}"
question = "What are the key findings of the study?"

context_res = requests.post(f"{BASE_URL}/api/get_context/", json={
    "text": question,
    "dataset": dataset_name,
    "model_type": "${currentSettings.selectedLlm || 'llama3.2:latest'}",
    "use_default_qrs": True,
    "maximum_chunks_count": 5,
    "selected_embedding_model": "${currentSettings.selectedEmbeddingModel || 'nomic-embed-text:latest'}"
}, headers=headers)

res_json = context_res.json()
print("Relevance Score:", res_json.get("relevance_score"))
sources = res_json.get("sources", [])
print(f"Top Context Sources ({len(sources)}):")
for i, src in enumerate(sources[:3]):
    print(f"[{i+1}] Doc: {src.get('document')} | Page: {src.get('page')}")
    print(f"    {src.get('context', '')[:200]}...\\n")`,

		chat: `import requests

BASE_URL = "${backendUrl}"

# Generate answer directly using MyGPT's Ollama LLM endpoint
response = requests.post(f"{BASE_URL}/api/ollama_generate/", json={
    "model": "${currentSettings.selectedLlm || 'llama3.2:latest'}",
    "prompt": "Summarize the mechanism of action in 3 concise bullet points.",
    "temperature": 0.3
})

print("LLM Response:")
print(response.json().get("response"))`,

		datasets: `import requests

BASE_URL = "${backendUrl}"
access_token = "${jwtAccessToken || 'YOUR_JWT_ACCESS_TOKEN'}"

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# List all available document libraries and their embedding configurations
res = requests.post(f"{BASE_URL}/api/get_datasets/", json={
    "user_email": "",
    "user_group": ""
}, headers=headers)

datasets = res.json()
print(f"Found {len(datasets)} dataset(s):")
for d in datasets:
    print(f" - {d.get('dataset_name')} (Embedding: {d.get('embedding_model')})")`,

		upload: `import requests

BASE_URL = "${backendUrl}"
access_token = "${jwtAccessToken || 'YOUR_JWT_ACCESS_TOKEN'}"

headers = {
    "Authorization": f"Bearer {access_token}"
}

# Upload a research PDF or document to an existing or new dataset
files = {
    'file': open('paper.pdf', 'rb')
}
data = {
    'dataset': 'Cancer_Research_2026',
    'embedding_model': 'nomic-embed-text:latest'
}

res = requests.post(f"{BASE_URL}/api/upload_documents/", data=data, files=files, headers=headers)
print("Upload status:", res.json())`
	}

	const dockerSuperuserCmd = 'docker compose exec backend python manage.py create_superuser_with_otp'
	const localSuperuserCmd = 'python manage.py create_superuser_with_otp'

	return (
		<div className="p-6 flex flex-col space-y-6 text-nav dark:text-nav-dark">
			{/* Header */}
			<div className="flex items-center justify-between border-b pb-4 border-gray-300 dark:border-gray-700">
				<div>
					<h2 className="text-xl font-bold flex items-center gap-2">
						<CodeBracketSquareIcon className="h-6 w-6 text-panel1 dark:text-panel3-dark" />
						Developer API & Authentication Suite
					</h2>
					<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
						Create superusers, enroll Authenticator 2FA, generate JWT tokens, and run automated Python scripts.
					</p>
				</div>
				<div className="flex gap-2">
					<a
						href={`${backendUrl}/api/docs/`}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1.5 bg-panel1 hover:bg-nav text-white px-3 py-1.5 rounded-md text-sm font-medium transition shadow-sm"
					>
						<DocumentTextIcon className="h-4 w-4" />
						Swagger UI
						<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
					</a>
					<a
						href={`${backendUrl}/api/schema/`}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-md text-sm font-medium transition"
					>
						OpenAPI JSON
						<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
					</a>
				</div>
			</div>

			{window.electronAPI?.isDesktop && (
				<div className="bg-white dark:bg-panel3-dark/40 border border-gray-200 dark:border-gray-700 p-4 rounded-lg shadow-sm space-y-4">
					<div>
						<h3 className="text-base font-bold">Runtime services</h3>
						<p className="text-xs text-gray-500 dark:text-gray-400">
							Configure the API endpoints used by the app. A local Ollama change restarts the managed backend containers so the backend receives the new endpoint.
						</p>
					</div>
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<label className="text-xs font-semibold">
							Backend API URL
							<input
								type="url"
								value={runtimeDraft.backendUrl}
								onChange={(event) => setRuntimeDraft({ ...runtimeDraft, backendUrl: event.target.value })}
								className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-black/40 font-mono font-normal"
								placeholder="http://127.0.0.1:8000"
							/>
						</label>
						<label className="text-xs font-semibold">
							Ollama API URL
							<input
								type="url"
								value={runtimeDraft.ollamaUrl}
								onChange={(event) => setRuntimeDraft({ ...runtimeDraft, ollamaUrl: event.target.value })}
								className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-black/40 font-mono font-normal"
								placeholder="http://127.0.0.1:11434"
							/>
						</label>
					</div>
					<label className="flex items-center gap-2 text-xs">
						<input
							type="checkbox"
							checked={runtimeDraft.autoStartBackend}
							disabled={!canManageDockerBackend(runtimeDraft.backendUrl)}
							onChange={(event) => setRuntimeDraft({ ...runtimeDraft, autoStartBackend: event.target.checked })}
						/>
						Start local backend containers automatically when the desktop app launches
					</label>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={saveRuntimeSettings}
							disabled={isSavingRuntime}
							className="bg-panel1 hover:bg-nav disabled:opacity-50 text-white px-3 py-2 rounded-md text-xs font-semibold"
						>
							{isSavingRuntime ? 'Saving and applying...' : 'Save endpoints'}
						</button>
						<button
							type="button"
							onClick={startBackendContainers}
							disabled={isStartingBackend || !canManageDockerBackend(runtimeConfig.backendUrl)}
							className="bg-gray-200 dark:bg-gray-700 disabled:opacity-50 px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5"
						>
							<ArrowPathIcon className={`h-4 w-4 ${isStartingBackend ? 'animate-spin' : ''}`} />
							{isStartingBackend ? 'Starting...' : 'Start backend containers'}
						</button>
						{runtimeMessage && (
							<span className={`text-xs ${runtimeMessage.type === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
								{runtimeMessage.text}
							</span>
						)}
					</div>
				</div>
			)}

			<div className="bg-white dark:bg-panel3-dark/40 border border-gray-200 dark:border-gray-700 p-4 rounded-lg shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-3">
						<div>
							<div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
								Backend API Base URL
							</div>
							<div className="font-mono text-sm font-semibold">{backendUrl}</div>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{backendOnline === true ? (
							<span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
								<CheckCircleIcon className="h-3.5 w-3.5" /> Backend Online
							</span>
						) : backendOnline === false ? (
							<span className="text-xs bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
								<XCircleIcon className="h-3.5 w-3.5" /> Backend Offline ({backendUrl})
							</span>
						) : (
							<span className="text-xs bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full font-semibold">
								Checking...
							</span>
						)}

						{ollamaOnline === true ? (
							<span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
								<CheckCircleIcon className="h-3.5 w-3.5" /> Ollama Ready ({installedModels.length} models)
							</span>
						) : ollamaOnline === false ? (
							<span className="text-xs bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
								<XCircleIcon className="h-3.5 w-3.5" /> Ollama Offline
							</span>
						) : null}
					</div>
				</div>
			</div>

			{/* Step 1: Create Superuser with TOTP Authenticator (Instructional Card) */}
			<div className="bg-white dark:bg-panel3-dark/40 border border-gray-200 dark:border-gray-700 p-5 rounded-lg shadow-sm">
				<div className="flex items-center gap-2 mb-3">
					<div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md">
						<UserPlusIcon className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-base font-bold">Step 1: Create Django Superuser & Enroll OTP</h3>
						<p className="text-xs text-gray-500 dark:text-gray-400">
							Follow this one-time terminal command to initialize your administrator credentials and scan your Authenticator QR code.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
					{/* Terminal Execution */}
					<div className="bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-gray-700/80 p-3.5 rounded-lg flex flex-col justify-between">
						<div>
							<div className="flex items-center justify-between mb-2">
								<span className="text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
									A. Run Management Command
								</span>
								<button
									onClick={() => copyToClipboard(dockerSuperuserCmd, 'cmd_docker')}
									className="text-xs flex items-center gap-1 text-panel1 hover:underline font-medium"
								>
									{copiedCommand === 'cmd_docker' ? (
										<>
											<CheckCircleIcon className="h-3.5 w-3.5 text-green-600" /> Copied
										</>
									) : (
										<>
											<ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy Command
										</>
									)}
								</button>
							</div>
							<div className="bg-gray-900 text-gray-100 p-2.5 rounded font-mono text-xs overflow-x-auto select-all">
								{dockerSuperuserCmd}
							</div>
							<p className="text-[11px] text-gray-500 mt-2">
								For local non-Docker installations, run: <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-[10px] font-mono">{localSuperuserCmd}</code>
							</p>
						</div>
					</div>

					{/* Step-by-Step Instructions */}
					<div className="bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-gray-700/80 p-3.5 rounded-lg text-xs space-y-2">
						<span className="font-semibold uppercase text-gray-600 dark:text-gray-400 block mb-1">
							B. Walkthrough Steps
						</span>
						<div className="flex items-start gap-2">
							<span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
							<span>Enter your desired <b>Username</b>, <b>Email</b>, and <b>Password</b> when prompted in the terminal.</span>
						</div>
						<div className="flex items-start gap-2">
							<span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
							<span>A visual <b>QR Code</b> will print directly in your terminal window.</span>
						</div>
						<div className="flex items-start gap-2">
							<span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
							<span>Scan the QR code with <b>Google Authenticator</b>, <b>Microsoft Authenticator</b>, <b>Apple Passwords</b>, or <b>1Password</b>.</span>
						</div>
						<div className="flex items-start gap-2">
							<span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">4</span>
							<span>Type the current 6-digit verification code in the terminal to confirm OTP enrollment.</span>
						</div>
					</div>
				</div>
			</div>

			{/* Step 2: In-App JWT Token Generator */}
			<div className="bg-white dark:bg-panel3-dark/40 border border-gray-200 dark:border-gray-700 p-5 rounded-lg shadow-sm">
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-md">
							<KeyIcon className="h-5 w-5" />
						</div>
						<div>
							<h3 className="text-base font-bold">Step 2: Generate JWT Access Token</h3>
							<p className="text-xs text-gray-500 dark:text-gray-400">
								Authenticate with your superuser credentials to generate a valid JWT token for Python scripts and REST clients.
							</p>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
					{/* Credentials Form */}
					<form onSubmit={handleGenerateToken} className="space-y-3 bg-gray-50 dark:bg-black/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700/80">
						<div>
							<label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
								Superuser Username
							</label>
							<div className="relative">
								<input
									type="text"
									required
									placeholder="e.g. admin"
									value={loginUsername}
									onChange={(e) => setLoginUsername(e.target.value)}
									className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-black/40 text-nav dark:text-nav-dark focus:outline-none focus:ring-1 focus:ring-panel1"
								/>
							</div>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
								Superuser Password
							</label>
							<div className="relative">
								<input
									type="password"
									required
									placeholder="••••••••"
									value={loginPassword}
									onChange={(e) => setLoginPassword(e.target.value)}
									className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-black/40 text-nav dark:text-nav-dark focus:outline-none focus:ring-1 focus:ring-panel1"
								/>
							</div>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
								Authenticator 6-Digit Code (Optional verification)
							</label>
							<div className="relative">
								<input
									type="text"
									maxLength={6}
									placeholder="e.g. 123456"
									value={loginOtpCode}
									onChange={(e) => setLoginOtpCode(e.target.value)}
									className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-black/40 text-nav dark:text-nav-dark focus:outline-none focus:ring-1 focus:ring-panel1 font-mono tracking-wider"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={isAuthenticating}
							className="w-full bg-panel1 hover:bg-nav text-white text-xs font-semibold py-2 px-4 rounded-md transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
						>
							<KeyIcon className="h-4 w-4" />
							{isAuthenticating ? 'Authenticating...' : 'Generate JWT Access Token'}
						</button>

						{authMessage && (
							<div
								className={`text-xs p-2.5 rounded-md border flex items-start gap-1.5 ${
									authMessage.type === 'success'
										? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
										: 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
								}`}
							>
								{authMessage.type === 'success' ? (
									<CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
								) : (
									<XCircleIcon className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
								)}
								<span>{authMessage.text}</span>
							</div>
						)}
					</form>

					{/* Active Token Display & Verification */}
					<div className="flex flex-col justify-between bg-gray-50 dark:bg-black/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700/80">
						<div>
							<div className="flex items-center justify-between mb-2">
								<span className="text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 flex items-center gap-1">
									<ShieldCheckIcon className="h-4 w-4 text-emerald-600" /> Active Session Token
								</span>
								{jwtAccessToken && (
									<div className="flex items-center gap-2">
										<button
											onClick={() => copyToClipboard(jwtAccessToken, 'token')}
											className="text-xs flex items-center gap-1 text-panel1 hover:underline font-medium"
										>
											{copiedToken ? (
												<>
													<CheckCircleIcon className="h-3.5 w-3.5 text-green-600" /> Copied
												</>
											) : (
												<>
													<ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy Token
												</>
											)}
										</button>
										<span className="text-gray-400">|</span>
										<button
											onClick={handleClearToken}
											className="text-xs text-rose-600 hover:underline font-medium"
										>
											Clear
										</button>
									</div>
								)}
							</div>

							<div className="bg-gray-100 dark:bg-black/50 p-2.5 rounded font-mono text-xs break-all text-gray-800 dark:text-gray-200 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-800">
								{jwtAccessToken ? (
									jwtAccessToken
								) : (
									<span className="text-gray-400 italic">
										No active JWT token stored. Enter credentials on the left to generate one.
									</span>
								)}
							</div>

							<p className="text-[11px] text-gray-500 mt-2">
								Include in HTTP headers as: <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-[10px]">Authorization: Bearer &lt;token&gt;</code>
							</p>
						</div>

						{jwtAccessToken && (
							<div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
								<button
									onClick={handleTestToken}
									disabled={isTestingToken}
									className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded font-medium transition flex items-center gap-1"
								>
									<ArrowPathIcon className={`h-3.5 w-3.5 ${isTestingToken ? 'animate-spin' : ''}`} />
									Test Token with API Endpoint
								</button>
								{testTokenStatus && (
									<p className={`text-xs mt-1.5 font-medium ${testTokenStatus.startsWith('Valid') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
										{testTokenStatus}
									</p>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Python Snippets Section */}
			<div className="bg-white dark:bg-panel3-dark/40 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
				<div className="bg-gray-100 dark:bg-black/40 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between">
					<div className="flex space-x-2">
						<button
							onClick={() => setActiveSnippetTab('rag')}
							className={`text-xs font-semibold px-3 py-1 rounded-md transition ${
								activeSnippetTab === 'rag'
									? 'bg-panel1 text-white'
									: 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
							}`}
						>
							1. Query Context (RAG)
						</button>
						<button
							onClick={() => setActiveSnippetTab('chat')}
							className={`text-xs font-semibold px-3 py-1 rounded-md transition ${
								activeSnippetTab === 'chat'
									? 'bg-panel1 text-white'
									: 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
							}`}
						>
							2. Ollama Generation
						</button>
						<button
							onClick={() => setActiveSnippetTab('datasets')}
							className={`text-xs font-semibold px-3 py-1 rounded-md transition ${
								activeSnippetTab === 'datasets'
									? 'bg-panel1 text-white'
									: 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
							}`}
						>
							3. List Datasets
						</button>
						<button
							onClick={() => setActiveSnippetTab('upload')}
							className={`text-xs font-semibold px-3 py-1 rounded-md transition ${
								activeSnippetTab === 'upload'
									? 'bg-panel1 text-white'
									: 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
							}`}
						>
							4. Upload Publication PDF
						</button>
					</div>

					<button
						onClick={() => copyToClipboard(pythonSnippets[activeSnippetTab], activeSnippetTab)}
						className="flex items-center gap-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-800 dark:text-gray-200 px-2.5 py-1 rounded font-medium transition"
					>
						{copiedSnippet === activeSnippetTab ? (
							<>
								<ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-green-600" />
								Copied!
							</>
						) : (
							<>
								<ClipboardDocumentIcon className="h-3.5 w-3.5" />
								Copy Python Script
							</>
						)}
					</button>
				</div>

				<div className="p-4 bg-gray-900 text-gray-100 font-mono text-xs overflow-x-auto max-h-96">
					<pre>{pythonSnippets[activeSnippetTab]}</pre>
				</div>
			</div>

			{/* Ollama Models Management & Download Card */}
			<div className="bg-white dark:bg-panel3-dark/40 border border-gray-200 dark:border-gray-700 p-4 rounded-lg shadow-sm">
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<h3 className="text-base font-semibold">Ollama LLM & Embedding Models</h3>
						{ollamaOnline === true ? (
							<span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 px-2 py-0.5 rounded-full font-medium">
								<CheckCircleIcon className="h-3.5 w-3.5" /> Connected ({installedModels.length} models)
							</span>
						) : ollamaOnline === false ? (
							<span className="flex items-center gap-1 text-xs bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 px-2 py-0.5 rounded-full font-medium">
								<XCircleIcon className="h-3.5 w-3.5" /> Not Detected (localhost:11434)
							</span>
						) : null}
					</div>
					<button
						onClick={checkOllamaStatus}
						disabled={isCheckingOllama}
						className="text-xs flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-panel1 font-medium"
					>
						<ArrowPathIcon className={`h-3.5 w-3.5 ${isCheckingOllama ? 'animate-spin' : ''}`} /> Refresh
					</button>
				</div>

				<p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
					Download essential models for local inference without leaving the application.
				</p>

				{/* Recommended Models Quick Pull */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
					{RECOMMENDED_MODELS.map((model) => {
						const isInstalled = installedModels.some(m => m.startsWith(model.name.split(':')[0]))
						return (
							<div
								key={model.name}
								className="flex items-center justify-between border border-gray-200 dark:border-gray-700/60 p-2.5 rounded-md bg-gray-50 dark:bg-gray-800/40"
							>
								<div className="truncate mr-2">
									<div className="font-semibold text-xs flex items-center gap-1.5">
										{model.name}
										<span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.2 rounded text-gray-600 dark:text-gray-300">
											{model.type}
										</span>
									</div>
									<div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{model.desc}</div>
								</div>
								{isInstalled ? (
									<span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 flex-shrink-0">
										<CheckCircleIcon className="h-4 w-4" /> Ready
									</span>
								) : (
									<button
										disabled={isPulling}
										onClick={() => handlePullModel(model.name)}
										className="text-xs bg-panel1 hover:bg-nav text-white px-2.5 py-1 rounded flex items-center gap-1 font-medium transition flex-shrink-0 disabled:opacity-50"
									>
										<ArrowDownTrayIcon className="h-3.5 w-3.5" /> Pull
									</button>
								)}
							</div>
						)
					})}
				</div>

				{/* Custom Pull Input */}
				<div className="flex gap-2">
					<input
						type="text"
						placeholder="Pull custom model from Ollama library (e.g. qwen2.5:7b, mistral:latest)"
						value={pullModelName}
						onChange={(e) => setPullModelName(e.target.value)}
						className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-black/30 text-nav dark:text-nav-dark focus:outline-none focus:ring-1 focus:ring-panel1"
					/>
					<button
						disabled={isPulling || !pullModelName.trim()}
						onClick={() => handlePullModel(pullModelName)}
						className="text-xs bg-panel1 hover:bg-nav text-white px-3 py-1.5 rounded font-medium transition disabled:opacity-50 flex items-center gap-1"
					>
						<ArrowDownTrayIcon className="h-3.5 w-3.5" /> Download
					</button>
				</div>

				{pullStatus && (
					<div className="mt-2 text-xs p-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded">
						{pullStatus}
					</div>
				)}
			</div>
		</div>
	)
}

export default DeveloperAPISettings
