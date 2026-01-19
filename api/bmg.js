export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
}

const ALLOWED_METHODS = ['POST', 'OPTIONS']
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': ALLOWED_METHODS.join(','),
  'Access-Control-Allow-Headers': 'Content-Type, SOAPAction, X-Requested-With',
  'Access-Control-Max-Age': '86400',
}

const normalizeUpstreamUrl = (value) => {
  if (!value) return ''
  const trimmed = value.trim()
  return trimmed.replace(/\?wsdl$/i, '')
}

const getUpstreamUrl = () => normalizeUpstreamUrl(
  process.env.BMG_SOAP_URL ||
  process.env.VITE_BMG_SOAP_URL ||
  process.env.BMG_SOAP_ENDPOINT ||
  ''
)

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
  if (!upstreamUrl) {
    res.status(500)
    res.setHeader('Access-Control-Allow-Origin', origin)
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.end('BMG_SOAP_URL nao configurada no serverless.')
    return
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks)

  const headers = {
    'Content-Type': req.headers['content-type'] || 'text/xml;charset=UTF-8',
  }
  const soapActionHeader = req.headers.soapaction || req.headers.SOAPAction
  const envSoapAction = process.env.BMG_SOAP_ACTION || process.env.VITE_BMG_SOAP_ACTION || 'inserirSolicitacao'
  if (soapActionHeader) headers.SOAPAction = soapActionHeader
  if (!headers.SOAPAction && envSoapAction) headers.SOAPAction = envSoapAction

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

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
  const contentType = upstream.headers.get('content-type') || 'text/xml;charset=UTF-8'
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Length', buffer.length)
  res.setHeader('Access-Control-Allow-Origin', origin)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
  res.end(buffer)
}
