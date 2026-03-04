const AUTH_FLAG_KEY = 'authLoggedIn'
const AUTH_USER_KEY = 'authUsername'
const AUTH_ROLE_KEY = 'authRole'

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

export const isLoggedIn = () => localStorage.getItem(AUTH_FLAG_KEY) === 'true'

export const getStoredUsername = () => localStorage.getItem(AUTH_USER_KEY) || ''

export const getStoredRole = () => String(localStorage.getItem(AUTH_ROLE_KEY) || '').trim().toLowerCase()

export const getPostLoginRoute = () => '/data-preparation'

export const setLocalAuth = (username, role = '') => {
  localStorage.setItem(AUTH_FLAG_KEY, 'true')
  localStorage.setItem(AUTH_USER_KEY, username || '')
  localStorage.setItem(AUTH_ROLE_KEY, String(role || '').trim().toLowerCase())
}

export const clearLocalAuth = () => {
  localStorage.removeItem(AUTH_FLAG_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
  localStorage.removeItem(AUTH_ROLE_KEY)
}

export async function login(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      username,
      password
    })
  })

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
  setLocalAuth(username, role)
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
