import { useState, useEffect } from 'react'
import stJudeLogo from '../assets/stjude-logo-child.png'

const Footer = (props: {
	frontendSettings: any,
	onDisclaimerClick: () => void,
	onFAQClick: () => void,
}) => {
	const version = import.meta.env.VITE_MYGPT_VERSION || '1.0.2'
	const year = new Date().getFullYear()

	const [backendUp, setBackendUp] = useState<boolean | null>(null)
	const [ollamaUp, setOllamaUp] = useState<boolean | null>(null)

	useEffect(() => {
		let isMounted = true

		const checkConnections = async () => {
			let isOllamaOnline = false
			let isBackendOnline = false

			// 1. Check Ollama via Electron IPC if running in desktop app
			if ((window as any).electronAPI?.getOllamaStatus) {
				try {
					const status = await (window as any).electronAPI.getOllamaStatus()
					if (status?.isRunning) {
						isOllamaOnline = true
					}
				} catch {
					// Fall through to HTTP check
				}
			}

			const backendUrl = (window.mygptRuntimeConfig.backendApiUrl || 'http://localhost:8000/').replace(/\/$/, '')
			const ollamaUrl = (window.mygptRuntimeConfig.ollamaApiUrl || 'http://localhost:11434/').replace(/\/$/, '')

			// 2. Check Backend API health
			try {
				const r = await fetch(`${backendUrl}/api/frontend_settings/?format=json`, { method: 'GET' })
				isBackendOnline = r.ok
			} catch {
				isBackendOnline = false
			}

			// 3. Check Ollama via Backend API or direct localhost:11434
			if (!isOllamaOnline) {
				try {
					const r = await fetch(`${backendUrl}/api/get_ollama_models/`, { method: 'POST' })
					if (r.ok) {
						const data = await r.json()
						isOllamaOnline = Array.isArray(data?.models) && data.models.length > 0
					} else {
						const directRes = await fetch(`${ollamaUrl}/api/tags`)
						isOllamaOnline = directRes.ok
					}
				} catch {
					try {
						const directRes = await fetch(`${ollamaUrl}/api/tags`)
						isOllamaOnline = directRes.ok
					} catch {
						isOllamaOnline = false
					}
				}
			}

			if (isMounted) {
				setBackendUp(isBackendOnline)
				setOllamaUp(isOllamaOnline)
			}
		}

		checkConnections()
		const interval = setInterval(checkConnections, 10000)
		return () => {
			isMounted = false
			clearInterval(interval)
		}
	}, [])

	const StatusPill = ({ up, label, endpoint }: { up: boolean | null; label: string; endpoint: string }) => {
		const isOnline = up === true
		const isOffline = up === false
		const isChecking = up === null

		return (
			<div
				className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-300 ${
					isOnline
						? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/40 shadow-sm'
						: isOffline
						? 'bg-rose-900/60 text-rose-200 border border-rose-500/40 shadow-sm'
						: 'bg-gray-800/60 text-gray-300 border border-gray-600/30'
				}`}
				title={`${label}: ${isOnline ? 'Online & Ready' : isOffline ? `Offline / Unreachable (${endpoint})` : 'Checking connectivity...'}`}
			>
				<span
					className={`w-2 h-2 rounded-full ${
						isOnline
							? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse'
							: isOffline
							? 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]'
							: 'bg-gray-400 animate-spin'
					}`}
				/>
				<span>{label}: {isOnline ? 'Online' : isOffline ? 'Offline' : '...'}</span>
			</div>
		)
	}

	return (
		<footer className='flex justify-between items-center text-nav bg-[#2A4759] px-6 py-2 min-h-[48px] shrink-0 z-30 border-t border-slate-700/40 select-none'>
			{/* Left: Organization Branding */}
			<div className='text-xs text-white/90 flex flex-row items-center gap-2.5'>
				<img src={stJudeLogo} alt='St. Jude logo' className='h-5 w-auto object-contain inline-block' />
				<span className='font-medium'>St. Jude Children's Research Hospital</span>
				<span className='text-white/50'>© {year}</span>
			</div>

			{/* Center: Version & Service Status Badges */}
			<div className='flex flex-row items-center gap-3'>
				{version && <span className='text-xs text-white/60 font-mono'>v{version}</span>}
				<StatusPill up={backendUp} label='Backend' endpoint='127.0.0.1:8000' />
				<StatusPill up={ollamaUp} label='Ollama' endpoint='127.0.0.1:11434' />
			</div>

			{/* Right: Actions / Links */}
			<div className='text-xs text-white/80 flex flex-row items-center gap-4'>
				{props.frontendSettings?.django_login ? (
					<button
						type='button'
						onClick={props.onDisclaimerClick}
						className='hover:text-white transition hover:underline cursor-pointer'
					>
						Disclaimer
					</button>
				) : null}
				<button
					type='button'
					onClick={props.onFAQClick}
					className='hover:text-white transition hover:underline cursor-pointer'
				>
					FAQs
				</button>
			</div>
		</footer>
	)
}

export default Footer
