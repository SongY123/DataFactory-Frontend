import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'

import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FRONTEND_ROOT = path.resolve(__dirname, '..')
const BACKEND_ROOT = path.resolve(FRONTEND_ROOT, '..', 'DataFactory')
const APP_ICON_PATH = path.resolve(FRONTEND_ROOT, 'src', 'assets', 'img', 'icon.svg')

const API_HOST = process.env.DATAFACTORY_API_HOST || '127.0.0.1'
const API_PORT = Number(process.env.DATAFACTORY_API_PORT || '8888') || 8888
const API_BASE = process.env.DATAFACTORY_API_BASE || `http://${API_HOST}:${API_PORT}/api`
const HEALTH_URL = process.env.DATAFACTORY_HEALTH_URL || `http://${API_HOST}:${API_PORT}/health`
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:8001'
const USE_DEV_SERVER = process.env.DATAFACTORY_ELECTRON_DEV === '1'

let mainWindow = null
let backendProcess = null
let backendShutdownTimer = null
let appIcon = null

const listCondaPythonCandidates = () => {
  const envRoots = [
    '/opt/anaconda3/envs',
    '/opt/miniconda3/envs',
    path.join(os.homedir(), '.conda', 'envs')
  ]

  const candidates = []
  for (const envRoot of envRoots) {
    if (!existsSync(envRoot)) continue
    try {
      for (const name of readdirSync(envRoot)) {
        const pythonPath = path.join(envRoot, name, 'bin', 'python')
        if (existsSync(pythonPath)) {
          candidates.push(pythonPath)
        }
      }
    } catch {
      // continue
    }
  }
  return candidates
}

const canRunBackend = (candidate) => {
  if (!candidate) return false
  try {
    const result = spawnSync(
      candidate,
      ['-c', 'import fastapi,uvicorn,sqlalchemy,pandas,huggingface_hub,dashscope'],
      { stdio: 'ignore' }
    )
    return result.status === 0
  } catch {
    return false
  }
}

const isRunnablePython = (candidate) => {
  if (!candidate) return false
  try {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' })
    return result.status === 0
  } catch {
    return false
  }
}

const resolvePythonCommand = () => {
  const projectCandidates = [
    path.join(BACKEND_ROOT, '.venv', 'bin', 'python'),
    path.join(BACKEND_ROOT, 'venv', 'bin', 'python'),
    path.join(path.dirname(BACKEND_ROOT), '.venv', 'bin', 'python')
  ]
  const candidates = [
    process.env.DATAFACTORY_PYTHON,
    process.env.PYTHON,
    process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, 'bin', 'python') : '',
    ...projectCandidates,
    ...listCondaPythonCandidates(),
    'python3',
    'python'
  ].filter(Boolean)

  const seen = new Set()
  const uniqueCandidates = candidates.filter((candidate) => {
    if (seen.has(candidate)) return false
    seen.add(candidate)
    return true
  })

  for (const candidate of uniqueCandidates) {
    if (canRunBackend(candidate)) return candidate
  }

  for (const candidate of uniqueCandidates) {
    if (isRunnablePython(candidate)) return candidate
  }

  throw new Error('Unable to find a runnable Python executable. Set DATAFACTORY_PYTHON to your backend Python path.')
}

const pingUrl = (url) =>
  new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume()
      resolve(response.statusCode && response.statusCode >= 200 && response.statusCode < 500)
    })
    request.on('error', () => resolve(false))
    request.setTimeout(1500, () => {
      request.destroy()
      resolve(false)
    })
  })

const waitForBackend = async (timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const healthy = await pingUrl(HEALTH_URL)
    if (healthy) return
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Backend did not become ready within ${timeoutMs}ms: ${HEALTH_URL}`)
}

const startBackend = () => {
  if (backendProcess && !backendProcess.killed) return
  if (!existsSync(BACKEND_ROOT)) {
    throw new Error(`Backend directory not found: ${BACKEND_ROOT}`)
  }

  const pythonCommand = resolvePythonCommand()
  backendProcess = spawn(pythonCommand, ['-m', 'web.app'], {
    cwd: BACKEND_ROOT,
    env: {
      ...process.env,
      PYTHONPATH: 'src',
      DATAFACTORY_DESKTOP: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  backendProcess.stdout?.on('data', (chunk) => {
    const text = String(chunk || '').trim()
    if (text) console.log(`[datafactory-backend] ${text}`)
  })

  backendProcess.stderr?.on('data', (chunk) => {
    const text = String(chunk || '').trim()
    if (text) console.error(`[datafactory-backend] ${text}`)
  })

  backendProcess.on('exit', (code, signal) => {
    console.log(`[datafactory-backend] exited code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    backendProcess = null
  })
}

const stopBackend = () => {
  if (!backendProcess || backendProcess.killed) return
  backendProcess.kill('SIGTERM')
  if (backendShutdownTimer) clearTimeout(backendShutdownTimer)
  backendShutdownTimer = setTimeout(() => {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill('SIGKILL')
    }
  }, 2000)
}

const registerIpc = () => {
  ipcMain.handle('dialog:choose-directory', async () => {
    const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow || BrowserWindow.getAllWindows()[0] || undefined
    const options = {
      properties: ['openDirectory', 'createDirectory']
    }
    const result = targetWindow
      ? await dialog.showOpenDialog(targetWindow, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? '' : String(result.filePaths?.[0] || '')
  })
}

const resolveRendererEntry = () => {
  if (app.isPackaged) {
    return path.resolve(app.getAppPath(), 'dist', 'index.html')
  }
  return path.resolve(FRONTEND_ROOT, 'dist', 'index.html')
}

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f4f6f8',
    icon: existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error(
      `[datafactory-desktop] renderer failed to load code=${errorCode} description=${errorDescription} url=${validatedURL} mainFrame=${isMainFrame}`
    )
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[datafactory-desktop] renderer process gone', details)
  })

  if (USE_DEV_SERVER) {
    await mainWindow.loadURL(DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const rendererEntry = resolveRendererEntry()
    if (!existsSync(rendererEntry)) {
      throw new Error(`Renderer build not found: ${rendererEntry}. Run npm run build first.`)
    }
    await mainWindow.loadFile(rendererEntry)
  }
}

app.whenReady().then(async () => {
  process.env.DATAFACTORY_API_BASE = API_BASE
  if (existsSync(APP_ICON_PATH)) {
    const loadedIcon = nativeImage.createFromPath(APP_ICON_PATH)
    if (!loadedIcon.isEmpty()) {
      appIcon = loadedIcon
      if (process.platform === 'darwin') {
        app.dock.setIcon(appIcon)
      }
    }
  }
  startBackend()
  await waitForBackend()
  registerIpc()
  await createMainWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
}).catch((error) => {
  console.error('[datafactory-desktop] startup failed', error)
  stopBackend()
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackend()
})
