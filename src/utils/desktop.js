export const getElectronBridge = () => {
  if (typeof window === 'undefined') return null
  return window.electronAPI || null
}

export const getRuntimeApiBase = () => {
  const bridge = getElectronBridge()
  const apiBase = bridge?.runtimeConfig?.apiBase
  return String(apiBase || '/api').trim() || '/api'
}

export const chooseLocalDirectory = async () => {
  const bridge = getElectronBridge()
  if (!bridge?.chooseDirectory) return ''
  try {
    return String((await bridge.chooseDirectory()) || '').trim()
  } catch {
    return ''
  }
}

export const isElectronRuntime = () => !!getElectronBridge()
