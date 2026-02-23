export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
}

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': ALLOWED_METHODS.join(','),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
}

const BASE_URL = 'http://85.31.61.242:3002/api/consulta-v8'

export default async function handler(req, res) {
  const origin = req.headers.origin || '*'

  if (req.method === 'OPTIONS') {
    res.status(204)
    res.setHeader('Access-Control-Allow-Origin', origin)
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.end()
    return
  }

  if (!ALLOWED_METHODS.includes(req.method)) {
    res.status(405).setHeader('Allow', ALLOWED_METHODS.join(','))
    res.setHeader('Access-Control-Allow-Origin', origin)
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.end('Method Not Allowed')
    return
  }

  const pathParam = req.query.path
  const pathSegments = Array.isArray(pathParam) ? pathParam : (pathParam ? [pathParam] : [])
  const extraPath = pathSegments.join('/')

  const searchIndex = req.url.indexOf('?')
  const search = searchIndex >= 0 ? req.url.slice(searchIndex) : ''
  const targetUrl = `${BASE_URL}${extraPath ? `/${extraPath}` : ''}${search}`

  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase()
    if (['host', 'connection', 'content-length'].includes(lower)) continue
    headers[key] = value
  }

  let body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    body = Buffer.concat(chunks)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  let upstream
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    const status = err.name === 'AbortError' ? 504 : 502
    res.status(status)
    res.setHeader('Access-Control-Allow-Origin', origin)
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.end(`Upstream error: ${err.message || err.toString()}`)
    return
  } finally {
    clearTimeout(timeout)
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())

  res.status(upstream.status)
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-length') return
    res.setHeader(key, value)
  })
  res.setHeader('Content-Length', buffer.length)
  res.setHeader('Access-Control-Allow-Origin', origin)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
  res.end(buffer)
}
