const trimTrailingSlash = (value = '') => {
  if (typeof value !== 'string') return ''
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const ensureLeadingSlash = (value = '') => {
  if (!value) return ''
  return value.startsWith('/') ? value : `/${value}`
}

const BASE = 'https://n8n.apivieiracred.store'

export const n8nUrl = (path = '') => {
  const cleanPath = ensureLeadingSlash(path)
  return `${BASE}${cleanPath}`
}

export const fetchN8n = (path, options = {}) => fetch(n8nUrl(path), options)
