export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
}

const ALLOWED_METHODS = ['POST', 'OPTIONS']
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': ALLOWED_METHODS.join(','),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
}

const UPSTREAM_URL = String(
  process.env.HEALTH_CONSULT_FORCE_UPSTREAM_URL || 'http://85.31.61.242:3002/api/health-consult/force-backup'
).trim()

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

  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase()
    if (['host', 'connection', 'content-length'].includes(lower)) continue
    headers[key] = value
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks)

  let upstream
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
    })
  } catch (err) {
    res.status(502)
    res.setHeader('Access-Control-Allow-Origin', origin)
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.end(`Upstream error: ${err.message || err.toString()}`)
    return
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

