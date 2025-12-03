const trimTrailingSlash = (value = '') => {
  if (typeof value !== 'string') return ''
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const ensureLeadingSlash = (value = '') => {
  if (!value) return ''
  return value.startsWith('/') ? value : `/${value}`
}

const N8N_PROD_BASE = 'https://n8n.apivieiracred.store'
const N8N_TEST_BASE = 'https://webhook.apivieiracred.store'

const normalizePath = (path = '') => {
  const clean = ensureLeadingSlash(path)
  if (clean.startsWith('/webhook')) return clean
  return `/webhook${clean}`
}

export const n8nUrl = (path = '') => `${N8N_PROD_BASE}${normalizePath(path)}`
export const n8nTestUrl = (path = '') => `${N8N_TEST_BASE}${normalizePath(path).replace('/webhook', '/webhook-test')}`

export const fetchN8n = (path, options = {}) => fetch(n8nUrl(path), options)
