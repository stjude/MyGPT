import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { ProcessManager } from './process-manager'
import { OllamaManager } from './ollama-manager'
import { setupApplicationMenu } from './menu'
import { RuntimeConfig, RuntimeConfigStore } from './runtime-config'

if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'MyGPT-desktop-dev'))
}

let mainWindow: BrowserWindow | null = null
const processManager = new ProcessManager('127.0.0.1', 8000)
const ollamaManager = new OllamaManager('127.0.0.1', 11434)
const runtimeConfigStore = new RuntimeConfigStore()

function applyRuntimeConfig(config: RuntimeConfig): void {
  processManager.setApiBaseUrl(config.backendUrl)
  processManager.setOllamaUrl(config.ollamaUrl)
  ollamaManager.setBaseUrl(config.ollamaUrl)
}

// Prevent multiple instances of the app
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function getAppIcon(): string | undefined {
  const possibleIcons = [
    path.join(__dirname, '../build/icon.png'),
    path.resolve(__dirname, '../../frontend/public/logo512.png'),
    path.resolve(__dirname, '../../frontend/public/mygpt_logo_color_dark.png'),
    path.join(app.getAppPath(), 'build/icon.png'),
  ]
  for (const iconPath of possibleIcons) {
    if (fs.existsSync(iconPath)) {
      return iconPath
    }
  }
  return undefined
}

async function createWindow() {
  const appIcon = getAppIcon()

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    title: 'MyGPT Desktop',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (process.platform === 'darwin' && appIcon && app.dock) {
    try {
      app.dock.setIcon(appIcon)
    } catch {
      // Ignore if dock icon set fails
    }
  }

  // In development, load Vite dev server; in production, load packaged build
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000'
    console.log(`[Main] Loading dev server from ${devUrl}`)
    mainWindow.loadURL(devUrl).catch(() => {
      console.warn(`[Main] Dev server not reachable at ${devUrl}, loading packaged frontend fallback.`)
      loadFrontendFile(mainWindow!)
    })
  } else {
    loadFrontendFile(mainWindow)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function loadFrontendFile(win: BrowserWindow) {
  const possiblePaths = [
    path.join(__dirname, '../frontend_build/index.html'),
    path.join(__dirname, '../../frontend/build/index.html'),
    path.join(app.getAppPath(), 'frontend_build/index.html'),
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`[Main] Loading static UI from: ${p}`)
      win.loadFile(p)
      return
    }
  }

  console.error('[Main] Could not find built index.html in any candidate path:', possiblePaths)
}

// IPC Handlers
ipcMain.handle('get-api-base-url', () => {
  return processManager.getApiBaseUrl()
})

ipcMain.handle('get-runtime-config', () => runtimeConfigStore.load())

ipcMain.handle('save-runtime-config', async (_event, config: RuntimeConfig) => {
  try {
    const previous = runtimeConfigStore.load()
    const saved = runtimeConfigStore.save(config)
    applyRuntimeConfig(saved)
    setupApplicationMenu(processManager.getApiBaseUrl())
    const ollamaChanged = previous.ollamaUrl !== saved.ollamaUrl
    if (ollamaChanged && processManager.canManageDockerBackend()) {
      const started = await processManager.startDockerBackend(true)
      if (!started) {
        return {
          success: true,
          config: saved,
          warning: 'Settings were saved, but the backend containers could not be restarted.',
        }
      }
      const ready = await processManager.waitForBackendReady()
      if (!ready) {
        return {
          success: true,
          config: saved,
          warning: 'Settings were saved and containers restarted, but the backend did not become ready.',
        }
      }
    }
    return { success: true, config: saved }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-services-status', async () => {
  const [backendRunning, ollamaRunning] = await Promise.all([
    processManager.isBackendRunning(),
    ollamaManager.isOllamaRunning(),
  ])
  return { backendRunning, ollamaRunning }
})

ipcMain.handle('start-backend-containers', async () => {
  try {
    const started = await processManager.startDockerBackend()
    const ready = started && await processManager.waitForBackendReady()
    return {
      success: ready,
      error: ready ? undefined : 'Docker started, but the backend did not become ready.',
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-ollama-status', async () => {
  const isRunning = await ollamaManager.isOllamaRunning()
  const models = isRunning ? await ollamaManager.getInstalledModels() : []
  return { isRunning, models }
})

ipcMain.handle('pull-ollama-model', async (_event, modelName: string) => {
  try {
    const success = await ollamaManager.pullModel(modelName)
    return { success }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// App Lifecycle
app.whenReady().then(async () => {
  console.log('[Main] Initializing MyGPT Desktop...')
  const runtimeConfig = runtimeConfigStore.load()
  applyRuntimeConfig(runtimeConfig)

  // 1. Start Django backend
  if (runtimeConfig.autoStartBackend && processManager.canManageDockerBackend()) {
    try {
      await processManager.startBackend()
    } catch (err) {
      console.error('[Main] Failed to start Django backend:', err)
    }
  }

  // 2. Setup Application Menu with Developer API links
  setupApplicationMenu(processManager.getApiBaseUrl())

  // 3. Create Main App Window
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Clean process shutdown on quit
app.on('before-quit', () => {
  console.log('[Main] Cleaning up processes before quit...')
  processManager.stopBackend()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
