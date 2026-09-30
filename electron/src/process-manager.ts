import { ChildProcess, spawn, execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import * as https from 'https'
import { randomBytes } from 'crypto'
import { app } from 'electron'
import { isLocalUrl } from './runtime-config'

export class ProcessManager {
  private backendProcess: ChildProcess | null = null
  private spawnedDocker: boolean = false
  private apiBaseUrl: string
  private ollamaUrl: string = 'http://127.0.0.1:11434'
  private projectRoot: string

  constructor(host: string = '127.0.0.1', port: number = 8000) {
    this.apiBaseUrl = `http://${host}:${port}`
    if (app.isPackaged) {
      this.projectRoot = path.join(app.getPath('userData'), 'docker')
      this.preparePackagedDockerWorkspace()
    } else {
      this.projectRoot = path.resolve(app.getAppPath(), '..')
      if (!fs.existsSync(path.join(this.projectRoot, 'docker-compose.yml'))) {
        this.projectRoot = path.resolve(__dirname, '../../')
      }
    }
  }

  private preparePackagedDockerWorkspace(): void {
    const bundledCompose = path.join(process.resourcesPath, 'docker', 'docker-compose.yml')
    if (!fs.existsSync(bundledCompose)) return
    fs.mkdirSync(this.projectRoot, { recursive: true })
    fs.copyFileSync(bundledCompose, path.join(this.projectRoot, 'docker-compose.yml'))
    const envPath = path.join(this.projectRoot, '.env_backend')
    if (!fs.existsSync(envPath)) {
      const secret = randomBytes(48).toString('base64url')
      fs.writeFileSync(
        envPath,
        [
          `SECRET_KEY=${secret}`,
          'POSTGRES_DB=postgres',
          'POSTGRES_USER=postgres',
          'POSTGRES_PASSWORD=postgres',
          'OLLAMA_SERVER=http://host.docker.internal:11434',
          '',
        ].join('\n'),
        { encoding: 'utf8', mode: 0o600 }
      )
    }
  }

  public getApiBaseUrl(): string {
    return this.apiBaseUrl
  }

  public setApiBaseUrl(value: string): void {
    this.apiBaseUrl = value.replace(/\/+$/, '')
  }

  public setOllamaUrl(value: string): void {
    this.ollamaUrl = value.replace(/\/+$/, '')
  }

  public isLocalBackend(): boolean {
    return isLocalUrl(this.apiBaseUrl)
  }

  public canManageDockerBackend(): boolean {
    const endpoint = new URL(this.apiBaseUrl)
    return endpoint.protocol === 'http:' &&
      this.isLocalBackend() &&
      (endpoint.pathname === '/' || endpoint.pathname === '')
  }

  /**
   * Checks whether the backend server is already reachable
   */
  public async isBackendRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const client = this.apiBaseUrl.startsWith('https:') ? https : http
      const req = client.get(`${this.getApiBaseUrl()}/api/frontend_settings/`, (res) => {
        resolve(res.statusCode !== undefined && res.statusCode < 500)
      })
      req.on('error', () => resolve(false))
      req.setTimeout(2000, () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  /**
   * Attempts to launch backend services using Docker Compose
   */
  public async startDockerBackend(forceRecreate: boolean = false): Promise<boolean> {
    if (!this.canManageDockerBackend()) {
      throw new Error('Docker containers require a local HTTP backend URL without a path.')
    }
    const composeFile = path.join(this.projectRoot, 'docker-compose.yml')
    if (!fs.existsSync(composeFile)) {
      console.log('[ProcessManager] docker-compose.yml not found at:', composeFile)
      return false
    }

    console.log('[ProcessManager] Attempting to start backend containers via Docker Compose...')
    try {
      // Check if docker is available
      execSync('docker --version', { stdio: 'ignore' })
    } catch {
      console.warn('[ProcessManager] Docker CLI not found on system.')
      return false
    }

    return new Promise((resolve) => {
      const composeArgs = ['compose', 'up', '-d']
      if (forceRecreate) composeArgs.push('--force-recreate')
      composeArgs.push('db', 'backend', 'grobid')
      const backendEndpoint = new URL(this.apiBaseUrl)
      const dockerEnv = {
        ...process.env,
        BACKEND_PORT: backendEndpoint.port || '8000',
        OLLAMA_SERVER: this.getDockerOllamaUrl(),
      }
      const dockerProc = spawn('docker', composeArgs, {
        cwd: this.projectRoot,
        stdio: 'inherit',
        env: dockerEnv,
      })

      dockerProc.on('error', (err) => {
        console.warn('[ProcessManager] docker compose failed:', err.message)
        // Try fallback to legacy docker-compose
        const legacyArgs = ['up', '-d']
        if (forceRecreate) legacyArgs.push('--force-recreate')
        legacyArgs.push('db', 'backend', 'grobid')
        const legacyProc = spawn('docker-compose', legacyArgs, {
          cwd: this.projectRoot,
          stdio: 'inherit',
          env: dockerEnv,
        })
        legacyProc.on('close', (code) => {
          this.spawnedDocker = code === 0
          resolve(code === 0)
        })
      })

      dockerProc.on('close', (code) => {
        if (code === 0) {
          this.spawnedDocker = true
          console.log('[ProcessManager] Docker backend containers started successfully.')
          resolve(true)
          return
        }

        console.warn(`[ProcessManager] docker compose exited with code ${code}. Trying legacy docker-compose...`)
        const legacyProc = spawn('docker-compose', ['up', '-d', 'db', 'backend', 'grobid'], {
          cwd: this.projectRoot,
          stdio: 'inherit',
        })
        legacyProc.on('close', (legacyCode) => {
          this.spawnedDocker = legacyCode === 0
          resolve(legacyCode === 0)
        })
      })
    })
  }

  /**
   * Starts the Django backend process (via Docker or local fallback)
   */
  public async startBackend(): Promise<void> {
    const alreadyRunning = await this.isBackendRunning()
    if (alreadyRunning) {
      console.log(`[ProcessManager] Backend server is already running and healthy on ${this.getApiBaseUrl()}`)
      return
    }

    // 1. Primary Strategy: Docker Compose
    console.log('[ProcessManager] Backend is not active. Trying Docker backend...')
    const startedDocker = await this.startDockerBackend()
    if (startedDocker) {
      const ready = await this.waitForBackendReady(45000)
      if (ready) return
    }

    // 2. Fallback Strategy: Standalone packaged binary (if present)
    const isPackaged = app.isPackaged
    if (isPackaged) {
      const resourcePath = process.resourcesPath
      const binaryFolder = path.join(resourcePath, 'backend_binary')
      const binaryName = process.platform === 'win32' ? 'mygpt-backend.exe' : 'mygpt-backend'
      const executablePath = path.join(binaryFolder, binaryName)

      if (fs.existsSync(executablePath)) {
        console.log(`[ProcessManager] Launching packaged binary: ${executablePath}`)
        const endpoint = new URL(this.apiBaseUrl)
        this.backendProcess = spawn(executablePath, ['--host', endpoint.hostname, '--port', endpoint.port || '8000'], {
          cwd: binaryFolder,
          env: {
            ...process.env,
            DJANGO_SETTINGS_MODULE: 'django_app.settings',
            PYTHONUNBUFFERED: '1',
            OLLAMA_SERVER: this.ollamaUrl,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        await this.waitForBackendReady(30000)
      }
    }
  }

  private getDockerOllamaUrl(): string {
    const endpoint = new URL(this.ollamaUrl)
    if (['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname)) {
      endpoint.hostname = 'host.docker.internal'
    }
    return endpoint.toString().replace(/\/$/, '')
  }

  /**
   * Polls the backend endpoint until it responds or timeouts
   */
  public async waitForBackendReady(timeoutMs: number = 45000): Promise<boolean> {
    const startTime = Date.now()
    const checkInterval = 1000

    console.log(`[ProcessManager] Waiting for backend at ${this.getApiBaseUrl()} to become ready...`)
    while (Date.now() - startTime < timeoutMs) {
      const isUp = await this.isBackendRunning()
      if (isUp) {
        console.log(`[ProcessManager] Backend is UP and READY on ${this.getApiBaseUrl()}!`)
        return true
      }
      await new Promise((r) => setTimeout(r, checkInterval))
    }

    console.warn(`[ProcessManager] Backend did not respond within ${timeoutMs}ms.`)
    return false
  }

  /**
   * Terminates backend child processes cleanly
   */
  public stopBackend(): void {
    if (this.backendProcess && !this.backendProcess.killed) {
      console.log('[ProcessManager] Terminating local backend process...')
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', this.backendProcess.pid!.toString(), '/f', '/t'])
        } else {
          this.backendProcess.kill('SIGTERM')
        }
      } catch (err) {
        console.error('[ProcessManager] Error terminating backend process:', err)
      }
      this.backendProcess = null
    }
  }
}
