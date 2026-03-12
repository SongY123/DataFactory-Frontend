const AUTH_FLAG_KEY = 'authLoggedIn'
const AUTH_USER_KEY = 'authUsername'
const AUTH_ROLE_KEY = 'authRole'

let sessionCheckPromise = null
let lastSessionValid = null

const parseError = async (res) => {
  const text = await res.text()
  if (!text) return `Request failed (${res.status})`
  try {
    const json = JSON.parse(text)
    return json?.detail || json?.message || text
  } catch {
    return text
  }
}

const backendUnavailableMessage = (action = 'Request') =>
  `${action} failed because the backend service is unavailable. Make sure DataFactory backend is running on http://127.0.0.1:8888.`

const normalizeRoleFromResponse = (body) => {
  const candidates = [
    body?.data?.role,
    body?.data?.rule,
    body?.data?.user?.role,
    body?.role,
    body?.rule
  ]

  for (const value of candidates) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (normalized) return normalized
  }

  return ''
}

const normalizeUsernameFromResponse = (body) => {
  const candidates = [
    body?.data?.username,
    body?.data?.user?.username,
    body?.username
  ]

  for (const value of candidates) {
    const normalized = typeof value === 'string' ? value.trim() : ''
    if (normalized) return normalized
  }

  return ''
}

export const isLoggedIn = () => localStorage.getItem(AUTH_FLAG_KEY) === 'true'

export const getStoredUsername = () => localStorage.getItem(AUTH_USER_KEY) || ''

export const getStoredRole = () => String(localStorage.getItem(AUTH_ROLE_KEY) || '').trim().toLowerCase()

export const getPostLoginRoute = () => '/data-preparation'

export const setLocalAuth = (username, role = '') => {
  localStorage.setItem(AUTH_FLAG_KEY, 'true')
  localStorage.setItem(AUTH_USER_KEY, username || '')
  localStorage.setItem(AUTH_ROLE_KEY, String(role || '').trim().toLowerCase())
  lastSessionValid = true
}

export const clearLocalAuth = () => {
  localStorage.removeItem(AUTH_FLAG_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
  localStorage.removeItem(AUTH_ROLE_KEY)
  lastSessionValid = false
}

export async function syncAuthSession(force = false) {
  if (!force && sessionCheckPromise) {
    return sessionCheckPromise
  }

  if (!force && lastSessionValid === false && !isLoggedIn()) {
    return false
  }

  sessionCheckPromise = (async () => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include'
      })

      if (!res.ok) {
        clearLocalAuth()
        return false
      }

      let body = null
      try {
        body = await res.json()
      } catch {
        body = null
      }

      const username = normalizeUsernameFromResponse(body) || getStoredUsername()
      const role = normalizeRoleFromResponse(body) || getStoredRole()
      setLocalAuth(username, role)
      return true
    } catch {
      if (isLoggedIn()) {
        return true
      }
      clearLocalAuth()
      return false
    } finally {
      sessionCheckPromise = null
    }
  })()

  return sessionCheckPromise
}

export async function login(username, password) {
  let res
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username,
        password
      })
    })
  } catch {
    throw new Error(backendUnavailableMessage('Login'))
  }

  if (!res.ok) {
    throw new Error(await parseError(res))
  }

  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  const role = normalizeRoleFromResponse(body)
  const resolvedUsername = normalizeUsernameFromResponse(body) || username
  setLocalAuth(resolvedUsername, role)
  return body
}

export async function logout() {
  let res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  })

  if (!res.ok && res.status === 405) {
    res = await fetch('/api/auth/logout', {
      method: 'GET',
      credentials: 'include'
    })
  }

  if (!res.ok) {
    throw new Error(await parseError(res))
  }

  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  clearLocalAuth()
  return body
}
