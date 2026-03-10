import { config } from '../config/global.js'

const parseError = async (res) => {
  const text = await res.text()
  if (!text) return `Request failed (${res.status})`
  try {
    const body = JSON.parse(text)
    return body?.detail || body?.message || text
  } catch {
    return text
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

export const createDataset = (payload) =>
  request('/datasets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const fetchDatasetDetail = (datasetId) => request(`/datasets/${datasetId}`)

export const uploadDataset = (formData) =>
  request('/datasets/upload', {
    method: 'POST',
    body: formData
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

export const fetchAgenticSynthesisTasks = (limit = 20) =>
  request(`/agentic-synthesis/tasks?limit=${encodeURIComponent(limit)}`)

export const fetchAgenticSynthesisTask = (taskId) =>
  request(`/agentic-synthesis/tasks/${encodeURIComponent(taskId)}`)

export const createAgenticSynthesisTask = (payload) =>
  request('/agentic-synthesis/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
