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

const getUpstreamUrl = () => {
  const fromEnv = String(process.env.V8_IMPORT_STATUS_UPSTREAM_URL || '').trim()
  if (fromEnv) return fromEnv
  return 'http://85.31.61.242:3002/api/clientes-v8/import-status'
}

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

  const jobId = String(req.query?.jobId ?? req.query?.job_id ?? '').trim()
  const params = new URLSearchParams()
  if (jobId) params.set('jobId', jobId)

  const upstreamUrl = getUpstreamUrl()
  const targetUrl = params.toString() ? `${upstreamUrl}?${params.toString()}` : upstreamUrl

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
