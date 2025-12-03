const trimTrailingSlash = (value = '') => {
  if (typeof value !== 'string') return ''
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const ensureLeadingSlash = (value = '') => {
  if (!value) return ''
  return value.startsWith('/') ? value : `/${value}`
}

const proxyBaseEnv = (import.meta.env.VITE_N8N_PROXY_BASE || import.meta.env.REACT_APP_N8N_PROXY_BASE || '/api/n8n').trim()
const directHttpEnv = (import.meta.env.VITE_N8N_DIRECT_HTTP || import.meta.env.REACT_APP_N8N_DIRECT_HTTP || '').trim()

const resolveBase = () => {
  const isHttp = typeof window !== 'undefined' && window.location?.protocol === 'http:'
  if (isHttp && directHttpEnv) return trimTrailingSlash(directHttpEnv)
  return trimTrailingSlash(proxyBaseEnv || '/api/n8n') || '/api/n8n'
}

const BASE = resolveBase()

export const n8nUrl = (path = '') => {
  const cleanPath = ensureLeadingSlash(path)
  return `${BASE}${cleanPath}`
}

export const fetchN8n = (path, options = {}) => fetch(n8nUrl(path), options)
