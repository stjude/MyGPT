import * as http from 'http'
import * as https from 'https'

export interface OllamaModelInfo {
  name: string
  size: number
  modified_at?: string
}

export class OllamaManager {
  private baseUrl: string

  constructor(host: string = '127.0.0.1', port: number = 11434) {
    this.baseUrl = `http://${host}:${port}`
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  public setBaseUrl(value: string): void {
    this.baseUrl = value.replace(/\/+$/, '')
  }

  private getClient(): typeof http | typeof https {
    return this.baseUrl.startsWith('https:') ? https : http
  }

  /**
   * Checks if Ollama service is reachable on the local machine
   */
  public async isOllamaRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = this.getClient().get(`${this.getBaseUrl()}/api/tags`, (res) => {
        resolve(res.statusCode === 200)
      })
      req.on('error', () => resolve(false))
      req.setTimeout(2000, () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  /**
   * Retrieves list of locally available Ollama models
   */
  public async getInstalledModels(): Promise<OllamaModelInfo[]> {
    return new Promise((resolve) => {
      const req = this.getClient().get(`${this.getBaseUrl()}/api/tags`, (res) => {
        if (res.statusCode !== 200) {
          resolve([])
          return
        }
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve(parsed.models || [])
          } catch {
            resolve([])
          }
        })
      })
      req.on('error', () => resolve([]))
    })
  }

  /**
   * Checks if the recommended starter models are already present
   */
  public async checkDefaultModelsPresent(
    requiredModels: string[] = ['nomic-embed-text', 'llama3.2']
  ): Promise<{ allPresent: boolean; missing: string[] }> {
    const installed = await this.getInstalledModels()
    const installedNames = installed.map((m) => m.name.toLowerCase())

    const missing: string[] = []
    for (const req of requiredModels) {
      const found = installedNames.some((name) => name.startsWith(req.toLowerCase()))
      if (!found) {
        missing.push(req)
      }
    }

    return {
      allPresent: missing.length === 0,
      missing,
    }
  }

  /**
   * Downloads / pulls an Ollama model asynchronously
   */
  public async pullModel(
    modelName: string,
    onProgress?: (status: string, completed?: number, total?: number) => void
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({ name: modelName, stream: true })
      const req = this.getClient().request(
        `${this.getBaseUrl()}/api/pull`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Ollama responded with status code ${res.statusCode}`))
            return
          }

          res.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter((l: string) => l.trim())
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line)
                if (onProgress) {
                  onProgress(parsed.status, parsed.completed, parsed.total)
                }
              } catch {
                // Ignore parse errors on stream boundary
              }
            }
          })

          res.on('end', () => resolve(true))
        }
      )

      req.on('error', (err) => reject(err))
      req.write(payload)
      req.end()
    })
  }
}
