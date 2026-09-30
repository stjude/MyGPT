import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface RuntimeConfig {
  backendUrl: string
  ollamaUrl: string
  autoStartBackend: boolean
}

const DEFAULT_CONFIG: RuntimeConfig = {
  backendUrl: 'http://127.0.0.1:8000',
  ollamaUrl: 'http://127.0.0.1:11434',
  autoStartBackend: true,
}

function normalizeUrl(value: string, fieldName: string): string {
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new Error(`${fieldName} must be a valid HTTP or HTTPS URL.`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${fieldName} must use HTTP or HTTPS.`)
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${fieldName} cannot contain credentials, query parameters, or fragments.`)
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  return parsed.toString().replace(/\/$/, '')
}

export function isLocalUrl(value: string): boolean {
  const hostname = new URL(value).hostname.toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function canManageDockerBackend(value: string): boolean {
  const endpoint = new URL(value)
  return endpoint.protocol === 'http:' &&
    isLocalUrl(value) &&
    (endpoint.pathname === '/' || endpoint.pathname === '')
}

export class RuntimeConfigStore {
  private config: RuntimeConfig = { ...DEFAULT_CONFIG }
  private loaded = false

  private get configPath(): string {
    return path.join(app.getPath('userData'), 'runtime-config.json')
  }

  public load(): RuntimeConfig {
    if (this.loaded) return this.get()
    this.loaded = true
    try {
      if (fs.existsSync(this.configPath)) {
        const saved = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
        this.config = this.validate({ ...DEFAULT_CONFIG, ...saved })
      }
    } catch (error) {
      console.error('[RuntimeConfig] Failed to load saved configuration:', error)
      this.config = { ...DEFAULT_CONFIG }
    }
    return this.get()
  }

  public get(): RuntimeConfig {
    return { ...this.config }
  }

  public save(value: RuntimeConfig): RuntimeConfig {
    this.config = this.validate(value)
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true })
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    })
    return this.get()
  }

  private validate(value: RuntimeConfig): RuntimeConfig {
    const backendUrl = normalizeUrl(value.backendUrl, 'Backend URL')
    const ollamaUrl = normalizeUrl(value.ollamaUrl, 'Ollama URL')
    return {
      backendUrl,
      ollamaUrl,
      autoStartBackend: Boolean(value.autoStartBackend) && canManageDockerBackend(backendUrl),
    }
  }
}
