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

const getUpstreamUrl = () => {
  const fromEnv = String(process.env.V8_IMPORT_CSV_UPSTREAM_URL || '').trim()
  if (fromEnv) return fromEnv
  return 'http://85.31.61.242:3002/api/clientes-v8/import-csv'
}

const getRawBody = async (req) => {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
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

  const upstreamUrl = getUpstreamUrl()
  const body = await getRawBody(req)
  const headers = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  let upstream
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
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
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8'
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Length', buffer.length)
  res.setHeader('Access-Control-Allow-Origin', origin)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
  res.end(buffer)
}
