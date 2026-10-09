import { app, BrowserWindow, dialog, ipcMain } from 'electron'
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

const STARTUP_SCREEN_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>MyGPT Desktop</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>
  html,body{height:100%;margin:0}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;text-align:center}
  h1{font-size:22px;font-weight:600;margin:0}
  p{font-size:14px;margin:0;max-width:420px;line-height:1.5;color:#64748b}
  .spinner{width:36px;height:36px;border:4px solid #cbd5e1;border-top-color:#2a4759;border-radius:50%;animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  @media (prefers-color-scheme:dark){body{background:#0f172a;color:#e2e8f0}p{color:#94a3b8}.spinner{border-color:#334155;border-top-color:#94a3b8}}
</style></head>
<body><div class="spinner"></div><h1>Starting services…</h1>
<p>MyGPT is starting its backend containers. The first launch downloads images and can take several minutes.</p></body></html>`
const STARTUP_SCREEN_URL = `data:text/html;charset=utf-8,${encodeURIComponent(STARTUP_SCREEN_HTML)}`

async function createWindow(showStartupScreen = false) {
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

  if (showStartupScreen) {
    void mainWindow.loadURL(STARTUP_SCREEN_URL)
  } else {
    loadAppContent(mainWindow)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function loadAppContent(win: BrowserWindow) {
  // In development, load Vite dev server; in production, load packaged build
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000'
    console.log(`[Main] Loading dev server from ${devUrl}`)
    win.loadURL(devUrl).catch(() => {
      console.warn(`[Main] Dev server not reachable at ${devUrl}, loading packaged frontend fallback.`)
      loadFrontendFile(win)
    })
  } else {
    loadFrontendFile(win)
  }
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
      error: ready ? undefined : processManager.getLastStartError() ?? 'Docker started, but the backend did not become ready.',
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

  const shouldStartBackend = runtimeConfig.autoStartBackend && processManager.canManageDockerBackend()

  // 1. Setup Application Menu with Developer API links
  setupApplicationMenu(processManager.getApiBaseUrl())

  // 2. Open the window now; the app UI loads once the backend start attempt finishes
  await createWindow(shouldStartBackend)

  // 3. Start Django backend
  let backendStartError: string | null = null
  if (shouldStartBackend) {
    try {
      const ready = await processManager.startBackend()
      if (!ready) {
        backendStartError = processManager.getLastStartError() ?? 'The MyGPT backend did not start.'
      }
    } catch (err) {
      console.error('[Main] Failed to start Django backend:', err)
      backendStartError = err instanceof Error ? err.message : String(err)
    }
    if (mainWindow) loadAppContent(mainWindow)
  }

  if (backendStartError && mainWindow) {
    void dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'MyGPT backend is not running',
      message: 'The MyGPT backend could not be started.',
      detail: `${backendStartError}\n\nOnce this is resolved, open Settings > Developer / API > Runtime services and choose "Start backend containers".`,
      buttons: ['OK'],
    })
  }

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
