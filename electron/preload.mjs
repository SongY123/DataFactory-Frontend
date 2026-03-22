import { contextBridge, ipcRenderer } from 'electron'

const apiBase = String(process.env.DATAFACTORY_API_BASE || 'http://127.0.0.1:8888/api').trim() || 'http://127.0.0.1:8888/api'

contextBridge.exposeInMainWorld('electronAPI', {
  runtimeConfig: {
    apiBase
  },
  chooseDirectory: () => ipcRenderer.invoke('dialog:choose-directory')
})
