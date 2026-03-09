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

export const fetchProcessingJobs = () => request('/processing/jobs')

export const createProcessingJob = (payload) =>
  request('/processing/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const fetchTrainingJobs = () => request('/training/jobs')

export const createTrainingJob = (payload) =>
  request('/training/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const fetchEvaluationReports = () => request('/evaluation/reports')

export const createEvaluationTask = (payload) =>
  request('/evaluation/tasks', {
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
