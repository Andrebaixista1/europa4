export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
}

const ALLOWED_METHODS = ['GET', 'OPTIONS']
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': ALLOWED_METHODS.join(','),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
}

const UPSTREAM_URL = String(process.env.HEALTH_CONSULT_UPSTREAM_URL || 'http://85.31.61.242:3002/api/health-consult').trim()

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

  const searchIndex = req.url.indexOf('?')
  const search = searchIndex >= 0 ? req.url.slice(searchIndex) : ''
  const targetUrl = `${UPSTREAM_URL}${search}`

  let upstream
  try {
    upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' },
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
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
  res.setHeader('Content-Length', buffer.length)
  res.setHeader('Access-Control-Allow-Origin', origin)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
  res.end(buffer)
}
