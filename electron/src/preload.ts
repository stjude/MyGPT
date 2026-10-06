import { contextBridge, ipcRenderer, shell } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  openExternalUrl: (url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return shell.openExternal(url)
      }
    } catch {
      // ignore invalid URLs
    }
  },
  getApiBaseUrl: () => ipcRenderer.invoke('get-api-base-url'),
  getRuntimeConfig: () => ipcRenderer.invoke('get-runtime-config'),
  saveRuntimeConfig: (config: {
    backendUrl: string
    ollamaUrl: string
    autoStartBackend: boolean
  }) => ipcRenderer.invoke('save-runtime-config', config),
  getServicesStatus: () => ipcRenderer.invoke('get-services-status'),
  startBackendContainers: () => ipcRenderer.invoke('start-backend-containers'),
  getOllamaStatus: () => ipcRenderer.invoke('get-ollama-status'),
  pullOllamaModel: (modelName: string) => ipcRenderer.invoke('pull-ollama-model', modelName),
})
