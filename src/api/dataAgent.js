import { config } from '../config/global.js'

const sanitizeErrorMessage = (message, fallback = 'Request failed') => {
  const text = String(message || '').trim()
  return text || fallback
}

const parseError = async (res) => {
  const fallback = `Request failed (${res.status})`
  const text = await res.text()
  if (!text) return fallback
  try {
    const body = JSON.parse(text)
    return sanitizeErrorMessage(body?.detail || body?.message || text, fallback)
  } catch {
    return sanitizeErrorMessage(text, fallback)
  }
}

const request = async (path, options = {}) => {
  const res = await fetch(`${config.apiBase}${path}`, {
    credentials: 'include',
    ...options
  })

  if (!res.ok) {
    throw new Error(await parseError(res))
  }

  const text = await res.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const fetchDatasets = () => request('/datasets')

export const searchDatasets = (payload = {}) =>
  request('/datasets/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  })

export const fetchCurrentSession = () => request('/auth/session')

export const fetchUserPreference = (preferenceKey) =>
  request(`/preferences/${encodeURIComponent(preferenceKey)}`)

export const saveUserPreference = (preferenceKey, value) =>
  request(`/preferences/${encodeURIComponent(preferenceKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  })

export const postWorkflowAssistantChat = (payload) =>
  request('/workflow-assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  })

export const streamWorkflowAssistantChat = async (
  payload,
  { onOpened, onDelta, onDone, onError, signal } = {}
) => {
  const res = await fetch(`${config.apiBase}/workflow-assistant/chat/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
    signal
  })

  if (!res.ok) {
    throw new Error(await parseError(res))
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('Unable to read SSE response stream')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let blockEnd = buffer.indexOf('\n\n')
    while (blockEnd >= 0) {
      const block = buffer.slice(0, blockEnd)
      buffer = buffer.slice(blockEnd + 2)

      const lines = block.split('\n')
      let eventName = 'message'
      let dataText = ''

      lines.forEach((line) => {
        if (line.startsWith('event: ')) {
          eventName = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          dataText += (dataText ? '\n' : '') + line.slice(6)
        }
      })

      if (dataText) {
        try {
          const data = JSON.parse(dataText)
          if (eventName === 'opened') {
            onOpened?.(data)
          } else if (eventName === 'delta') {
            onDelta?.(data)
          } else if (eventName === 'done') {
            onDone?.(data)
          } else if (eventName === 'error') {
            onError?.(new Error(data?.message || 'Chat stream failed'))
          }
        } catch {
          // ignore malformed event payloads
        }
      }

      blockEnd = buffer.indexOf('\n\n')
    }
  }
}

export const createDataset = (payload) =>
  request('/datasets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const fetchDatasetDetail = (datasetId) => request(`/datasets/${datasetId}`)

export const fetchDatasetReadme = (datasetId) => request(`/datasets/${datasetId}/readme`)

export const fetchDatasetFiles = (datasetId) => request(`/datasets/${datasetId}/files`)

export const fetchDatasetPreview = (datasetId, params = {}) => {
  const query = new URLSearchParams()
  if (params.path) query.set('path', params.path)
  if (params.limit) query.set('limit', String(params.limit))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request(`/datasets/${datasetId}/preview${suffix}`)
}

export const queryDatasetSql = (datasetId, payload) =>
  request(`/datasets/${datasetId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const uploadDataset = (formData) =>
  request('/datasets/upload', {
    method: 'POST',
    body: formData
  })

export const importHuggingFaceDataset = (payload) =>
  request('/datasets/import/huggingface', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const updateDataset = (datasetId, payload) =>
  request(`/datasets/${datasetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const updateDatasetCover = (datasetId, coverFile) => {
  const formData = new FormData()
  formData.append('cover', coverFile)
  return request(`/datasets/${datasetId}/cover`, {
    method: 'PUT',
    body: formData
  })
}

export const deleteDataset = (datasetId) =>
  request(`/datasets/${datasetId}`, {
    method: 'DELETE'
  })

export const fetchAgentModels = () => request('/agent/models')

export const generateAgentReport = (formData) =>
  request('/agent/report', {
    method: 'POST',
    body: formData
  })

export const reviseAgentReport = (payload) =>
  request('/agent/report/revise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const postAgentMessage = (payload) =>
  request('/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const fetchAgentAssetTree = () => request('/assets/tree')

export const fetchSandboxEnvironments = () => request('/sandbox-environments')

export const createSandboxEnvironment = (payload) =>
  request('/sandbox-environments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const deleteSandboxEnvironment = (environmentId) =>
  request(`/sandbox-environments/${encodeURIComponent(environmentId)}`, {
    method: 'DELETE'
  })

export const createAgentAssetFolder = (payload) =>
  request('/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const deleteAgentAssetFolder = (path, force = true) =>
  request(`/folders?path=${encodeURIComponent(path)}&force=${force ? 'true' : 'false'}`, {
    method: 'DELETE'
  })

export const deleteAgentAssetFile = (path) =>
  request(`/files?path=${encodeURIComponent(path)}`, {
    method: 'DELETE'
  })

export const fetchAgentAssetFilePreview = (path, params = {}) => {
  const query = new URLSearchParams()
  query.set('path', String(path || ''))
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  return request(`/files/preview?${query.toString()}`)
}

export const uploadAgentInteractionFile = (file, folderPath = '') => {
  const formData = new FormData()
  formData.append('file', file, file.name)
  formData.append('folder_path', folderPath)
  return request('/upload', {
    method: 'POST',
    body: formData
  })
}

export const importPlatformAsset = (payload) =>
  request('/assets/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const streamAgentInteractionChat = async (
  payload,
  { onOpened, onDelta, onDone, onError, signal } = {}
) => {
  const res = await fetch(`${config.apiBase}/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
    signal
  })

  if (!res.ok) {
    throw new Error(await parseError(res))
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('Unable to read SSE response stream')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let blockEnd = buffer.indexOf('\n\n')
    while (blockEnd >= 0) {
      const block = buffer.slice(0, blockEnd)
      buffer = buffer.slice(blockEnd + 2)

      const lines = block.split('\n')
      let eventName = 'message'
      let dataText = ''

      lines.forEach((line) => {
        if (line.startsWith('event: ')) {
          eventName = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          dataText += (dataText ? '\n' : '') + line.slice(6)
        }
      })

      if (dataText) {
        try {
          const data = JSON.parse(dataText)
          if (eventName === 'opened') {
            onOpened?.(data)
          } else if (eventName === 'delta') {
            onDelta?.(data)
          } else if (eventName === 'done') {
            onDone?.(data)
          } else if (eventName === 'error') {
            onError?.(new Error(data?.message || 'Chat stream failed'))
          }
        } catch {
          // ignore malformed event payloads
        }
      }

      blockEnd = buffer.indexOf('\n\n')
    }
  }
}

export const fetchAgenticSynthesisTasks = (limit = 20) =>
  request(`/agentic-synthesis/tasks?limit=${encodeURIComponent(limit)}`)

export const fetchAgenticSynthesisTask = (taskId) =>
  request(`/agentic-synthesis/tasks/${encodeURIComponent(taskId)}`)

export const fetchAgenticSynthesisTaskResults = (taskId, limit = 200) =>
  request(`/agentic-synthesis/tasks/${encodeURIComponent(taskId)}/results?limit=${encodeURIComponent(limit)}`)

export const fetchAgenticSynthesisResult = (resultId) =>
  request(`/agentic-synthesis/results/${encodeURIComponent(resultId)}`)

export const createAgenticSynthesisTask = (payload) =>
  request('/agentic-synthesis/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const fetchAgenticSynthesisOutputPathOptions = () =>
  request('/agentic-synthesis/output-path-options')

export const fetchReasoningDistillationTasks = (limit = 20) =>
  request(`/reasoning-distillation/tasks?limit=${encodeURIComponent(limit)}`)

export const fetchReasoningDistillationTask = (taskId) =>
  request(`/reasoning-distillation/tasks/${encodeURIComponent(taskId)}`)

export const fetchReasoningDistillationTaskResults = (taskId, limit = 200) =>
  request(`/reasoning-distillation/tasks/${encodeURIComponent(taskId)}/results?limit=${encodeURIComponent(limit)}`)

export const fetchReasoningDistillationResult = (resultId) =>
  request(`/reasoning-distillation/results/${encodeURIComponent(resultId)}`)

export const createReasoningDistillationTask = (payload) =>
  request('/reasoning-distillation/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const fetchReasoningDistillationOutputPathOptions = () =>
  request('/reasoning-distillation/output-path-options')
