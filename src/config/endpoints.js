const N8N_BASE = 'https://n8n.apivieiracred.store'

const normalizePath = (path = '') => {
  if (!path) return '/webhook'
  const withSlash = path.startsWith('/') ? path : `/${path}`
  return withSlash.startsWith('/webhook') ? withSlash : `/webhook${withSlash}`
}

export const n8nWebhookUrl = (path = '') => `${N8N_BASE}${normalizePath(path)}`

export const AUTH_ENDPOINTS = Object.freeze({
  login: n8nWebhookUrl('/login'),
  alterPass: n8nWebhookUrl('/alter-pass'),
})

export const PERMISSIONS_ENDPOINTS = Object.freeze({
  equipes: n8nWebhookUrl('/api/getequipes'),
  usuarios: n8nWebhookUrl('/api/getusuarios'),
  paginasCatalogo: n8nWebhookUrl('/api/getpagcat'),
  regrasPaginas: n8nWebhookUrl('/api/getregraspag'),
  regras: n8nWebhookUrl('/api/getregras'),
  addEquipe: n8nWebhookUrl('/api/addequipes2'),
})

