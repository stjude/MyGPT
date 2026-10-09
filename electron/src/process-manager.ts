import { ChildProcess, spawn, execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
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
  private lastStartError: string | null = null

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

  public getLastStartError(): string | null {
    return this.lastStartError
  }

  private getDockerEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, ...extra }
    if (process.platform === 'darwin') {
      // Apps launched from Finder get a minimal PATH that omits Docker Desktop's CLI locations.
      const dockerDirs = [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/Applications/Docker.app/Contents/Resources/bin',
        path.join(os.homedir(), '.docker', 'bin'),
      ]
      env.PATH = [env.PATH, ...dockerDirs].filter(Boolean).join(path.delimiter)
    }
    return env
  }

  /** Returns a user-facing problem description, or null when Docker is installed and running. */
  private checkDocker(): string | null {
    const env = this.getDockerEnv()
    try {
      execSync('docker --version', { stdio: 'ignore', env })
    } catch {
      return 'Docker was not found. Install Docker Desktop, start it, and then restart MyGPT.'
    }
    try {
      execSync('docker info', { stdio: 'ignore', env, timeout: 15000 })
    } catch {
      return 'Docker Desktop is not running. Start Docker Desktop, wait until it is ready, and then start the MyGPT services.'
    }
    return null
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
      this.lastStartError = 'The bundled Docker Compose file is missing. Reinstall MyGPT.'
      return false
    }

    console.log('[ProcessManager] Attempting to start backend containers via Docker Compose...')
    const dockerProblem = this.checkDocker()
    if (dockerProblem) {
      console.warn(`[ProcessManager] ${dockerProblem}`)
      this.lastStartError = dockerProblem
      return false
    }

    return new Promise((resolve) => {
      const upArgs = ['up', '-d']
      if (forceRecreate) upArgs.push('--force-recreate')
      upArgs.push('db', 'backend', 'grobid')
      const backendEndpoint = new URL(this.apiBaseUrl)
      const dockerEnv = this.getDockerEnv({
        BACKEND_PORT: backendEndpoint.port || '8000',
        OLLAMA_SERVER: this.getDockerOllamaUrl(),
      })

      let settled = false
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        this.spawnedDocker = ok
        this.lastStartError = ok
          ? null
          : 'Docker could not start the MyGPT services. Check that you are online (the first start downloads several GB of images) and that Docker Desktop has enough disk space.'
        resolve(ok)
      }

      let legacyStarted = false
      const runLegacyCompose = () => {
        if (legacyStarted) return
        legacyStarted = true
        const legacyProc = spawn('docker-compose', upArgs, {
          cwd: this.projectRoot,
          stdio: 'inherit',
          env: dockerEnv,
        })
        legacyProc.on('error', () => finish(false))
        legacyProc.on('close', (code) => finish(code === 0))
      }

      const dockerProc = spawn('docker', ['compose', ...upArgs], {
        cwd: this.projectRoot,
        stdio: 'inherit',
        env: dockerEnv,
      })

      dockerProc.on('error', (err) => {
        console.warn('[ProcessManager] docker compose failed:', err.message)
        runLegacyCompose()
      })

      dockerProc.on('close', (code) => {
        if (code === 0) {
          console.log('[ProcessManager] Docker backend containers started successfully.')
          finish(true)
          return
        }
        console.warn(`[ProcessManager] docker compose exited with code ${code}. Trying legacy docker-compose...`)
        runLegacyCompose()
      })
    })
  }

  /**
   * Starts the Django backend process (via Docker or local fallback)
   */
  public async startBackend(): Promise<boolean> {
    const alreadyRunning = await this.isBackendRunning()
    if (alreadyRunning) {
      console.log(`[ProcessManager] Backend server is already running and healthy on ${this.getApiBaseUrl()}`)
      this.lastStartError = null
      return true
    }

    // 1. Primary Strategy: Docker Compose
    console.log('[ProcessManager] Backend is not active. Trying Docker backend...')
    const startedDocker = await this.startDockerBackend()
    if (startedDocker) {
      const ready = await this.waitForBackendReady(120000)
      if (ready) return true
      this.lastStartError = 'The MyGPT containers started, but the backend did not respond in time. It may still be initializing; check the footer status in a minute.'
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
        if (await this.waitForBackendReady(30000)) {
          this.lastStartError = null
          return true
        }
      }
    }
    return false
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
