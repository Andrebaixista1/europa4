import sql from 'mssql'

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

const BASE_URL = process.env.CONSULTA_PRESENCA_BASE_URL || 'http://85.31.61.242:3002/api/consulta-presenca'
const UPSTREAM_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.CONSULTA_PRESENCA_PROXY_TIMEOUT_MS || 45000)
)
const SQL_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.CONSULTA_PRESENCA_SQL_TIMEOUT_MS || 30000)
)

let cachedPoolPromise

const toPositiveInt = (value) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const getSqlPool = async () => {
  if (!cachedPoolPromise) {
    const server = process.env.host_king || process.env.DB_HOST || process.env.SQL_HOST
    const user = process.env.user_king || process.env.DB_USER || process.env.SQL_USER
    const password = process.env.pass_king || process.env.DB_PASSWORD || process.env.SQL_PASSWORD
    const database = process.env.database_king || process.env.DB_DATABASE || process.env.SQL_DATABASE || 'consultas_presenca'

    if (!server || !user || !password) {
      throw new Error('Config SQL ausente (host/user/pass).')
    }

    cachedPoolPromise = new sql.ConnectionPool({
      server,
      user,
      password,
      database,
      port: Number(process.env.DB_PORT || process.env.SQL_PORT || 1433),
      connectionTimeout: SQL_TIMEOUT_MS,
      requestTimeout: SQL_TIMEOUT_MS,
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt: String(process.env.DB_ENCRYPT ?? process.env.SQL_ENCRYPT ?? 'false') === 'true',
        trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERT ?? process.env.SQL_TRUST_SERVER_CERT ?? 'true') !== 'false',
      },
    }).connect()
  }
  return cachedPoolPromise
}

const sendJson = (res, status, payload, origin) => {
  res.status(status)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
  res.end(JSON.stringify(payload))
}

const handleDeleteConsultas = async (req, res, origin) => {
  const idUser = toPositiveInt(req.query.id_user)
  const equipeId = toPositiveInt(req.query.equipe_id ?? req.query.id_equipe)
  const idConsultaPresencaRaw = String(req.query.id_consulta_presenca ?? '').trim()
  const tipoConsulta = String(req.query.tipoConsulta ?? '').trim()

  if (!idUser) return sendJson(res, 422, { ok: false, message: 'id_user invalido.' }, origin)
  if (!equipeId) return sendJson(res, 422, { ok: false, message: 'equipe_id invalido.' }, origin)
  if (!idConsultaPresencaRaw || !/^\d+$/.test(idConsultaPresencaRaw)) {
    return sendJson(res, 422, { ok: false, message: 'id_consulta_presenca invalido.' }, origin)
  }
  if (!tipoConsulta) return sendJson(res, 422, { ok: false, message: 'tipoConsulta invalido.' }, origin)

  const pool = await getSqlPool()
  let deleted = 0

  // Delete in batches to avoid long-running single statements.
  while (true) {
    const request = pool.request()
    request.input('idUser', sql.Int, idUser)
    request.input('equipeId', sql.Int, equipeId)
    request.input('idConsultaPresenca', sql.BigInt, idConsultaPresencaRaw)
    request.input('tipoConsulta', sql.NVarChar(255), tipoConsulta)

    const result = await request.query(`
      DELETE TOP (1000)
      FROM [consultas_presenca].[dbo].[consulta_presenca]
      WHERE [id_user] = @idUser
        AND [equipe_id] = @equipeId
        AND [id_consulta_presenca] = @idConsultaPresenca
        AND [tipoConsulta] = @tipoConsulta
    `)

    const deletedBatch = Number(Array.isArray(result?.rowsAffected) ? result.rowsAffected[0] : 0) || 0
    deleted += deletedBatch
    if (deletedBatch <= 0) break
  }

  return sendJson(res, 200, {
    ok: true,
    message: deleted > 0 ? 'Lote removido com sucesso.' : 'Nenhum registro encontrado para os filtros informados.',
    deleted_count: deleted,
    filters: {
      id_user: idUser,
      equipe_id: equipeId,
      id_consulta_presenca: idConsultaPresencaRaw,
      tipoConsulta,
    },
    via: 'vercel-sql',
  }, origin)
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

  const pathParam = req.query.path
  const pathSegments = Array.isArray(pathParam) ? pathParam : (pathParam ? [pathParam] : [])
  const extraPath = pathSegments.join('/')

  if (extraPath === 'consultas' && (req.method === 'POST' || req.method === 'DELETE')) {
    try {
      await handleDeleteConsultas(req, res, origin)
      return
    } catch (err) {
      return sendJson(res, 500, { ok: false, message: err?.message || String(err), via: 'vercel-sql' }, origin)
    }
  }

  const target = new URL(`${BASE_URL}${extraPath ? `/${extraPath}` : ''}`)
  const query = { ...(req.query || {}) }
  delete query.path
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) target.searchParams.append(key, String(item))
    } else if (value !== undefined) {
      target.searchParams.set(key, String(value))
    }
  }
  const targetUrl = target.toString()

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
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

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
