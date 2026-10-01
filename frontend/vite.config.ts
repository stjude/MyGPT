import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const rootEnvPath = path.resolve(configDir, '../.env_frontend')

export default defineConfig(({ command, mode }) => {
	const modeEnv = loadEnv(mode, configDir, 'VITE_')
	// Root .env_frontend is a local dev fallback, never a source for production builds.
	if (command === 'serve' && fs.existsSync(rootEnvPath)) {
		for (const line of fs.readFileSync(rootEnvPath, 'utf-8').split('\n')) {
			const trimmed = line.trim()
			if (!trimmed || trimmed.startsWith('#')) continue
			const eqIndex = trimmed.indexOf('=')
			if (eqIndex === -1) continue
			const key = trimmed.slice(0, eqIndex).trim()
			const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '')
			if (process.env[key] === undefined && modeEnv[key] === undefined) {
				process.env[key] = value
			}
		}
	}

	if (!process.env.VITE_BACKEND_API && !modeEnv.VITE_BACKEND_API) {
		process.env.VITE_BACKEND_API = 'http://localhost:8000/'
	}

	// Proxies /sjray the same way CRA's src/setupProxy.js used to.
	const sjRayTarget = process.env.VITE_SJ_RAY_API || modeEnv.VITE_SJ_RAY_API

	return {
	plugins: [react()],
	base: './',
	// Keep the VITE_ prefix so existing .env_frontend files and docs don't need renaming.
	envPrefix: ['VITE_', 'VITE_'],
	// Matches CRA's output dir so existing docker-compose bind mounts keep working.
	build: {
		outDir: 'build',
	},
	server: {
		host: true,
		port: 3000,
		proxy: sjRayTarget ? {
			'/sjray': {
				target: sjRayTarget,
				changeOrigin: true,
				secure: false,
				rewrite: (requestPath) => requestPath.replace(/^\/sjray/, ''),
			},
		} : {},
	},
	resolve: {
		alias: [
			{
				find: '@modelcontextprotocol/sdk/client/index',
				replacement: path.resolve(__dirname, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/index'),
			},
			{
				find: '@modelcontextprotocol/sdk/client/sse',
				replacement: path.resolve(__dirname, 'node_modules/@modelcontextprotocol/sdk/dist/esm/server/sse'),
			},
		],
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/setupTests.ts'],
	},
	}
})
