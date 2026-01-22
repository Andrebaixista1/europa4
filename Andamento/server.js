import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sql from 'mssql'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const loadEnvFile = (filePath) => {
  const env = {}
  if (!fs.existsSync(filePath)) return env
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf('=')
    if (idx === -1) return
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  })
  return env
}

const envFromFile = loadEnvFile(path.resolve(__dirname, '..', '.env'))
const env = { ...envFromFile, ...process.env }

const requireEnv = (key) => {
  const value = env[key]
  if (!value) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

const apiToken = requireEnv('API_TOKEN')

const sqlConfig = {
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  server: requireEnv('DB_HOST'),
  port: Number(env.DB_PORT || 1433),
  database: env.DB_NAME || 'vieira_online',
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
}

const API_QUERY = `
USE vieira_online;

WITH x AS (
  SELECT
    c.*,

    CASE
      -- força o nome pela empresa (independente do que vier em franquia_nome)
      WHEN c.empresa = 'abbcred'        THEN 'PARCEIRO ADAPTA'
      WHEN c.empresa = 'gmpromotora'    THEN 'Expande'
      WHEN c.empresa = 'diascredsolucoes' THEN 'Dias Cred'

      -- se for impacto, mantém o que veio; se vier nulo/vazio, preenche
      WHEN c.empresa = 'impacto'
        THEN COALESCE(NULLIF(LTRIM(RTRIM(c.franquia_nome)), ''), 'Inpacto')

      -- regra específica da vieira: só quando franquia_nome estiver nulo/vazio
      WHEN c.empresa = 'vieira'
        AND NULLIF(LTRIM(RTRIM(c.franquia_nome)), '') IS NULL
        THEN 'Matriz'

      -- caso geral: mantém o que veio (normalizado)
      ELSE NULLIF(LTRIM(RTRIM(c.franquia_nome)), '')
    END AS franquia_nome_tratada,

    ROW_NUMBER() OVER (
      PARTITION BY c.proposta_id_banco
      ORDER BY c.data_status_api DESC
    ) AS rn

  FROM cadastrados c
  WHERE c.data_status_api >= @startDate
    AND c.data_status_api < DATEADD(DAY, 1, @finalDate)
    AND c.empresa IN ('vieira','abbcred','gmpromotora','impacto','diascredsolucoes')
    AND (
      c.status_api  IN ('ANDAMENTO','AGUARDANDO CIP','CONTRATO ASSINADO','BENEFICIO BLOQUEADO')
      OR c.status_nome IN ('ANDAMENTO','AGUARDANDO CIP','CONTRATO ASSINADO','BENEFICIO BLOQUEADO')
    )
)
SELECT *
FROM x
WHERE rn = 1;

`

const pad = (value) => String(value).padStart(2, '0')
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const defaultRange = () => {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  return { startDate: formatDate(start), finalDate: formatDate(end) }
}

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

let poolPromise
const getPool = () => {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig)
  }
  return poolPromise
}

const corsOrigin = env.CORS_ORIGIN || '*'

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

const logRequest = (req, status, extra = '') => {
  const time = new Date().toISOString()
  const line = `[andamento] ${time} ${req.method} ${req.url} ${status}${extra ? ` ${extra}` : ''}`
  console.log(line)
}

const sendJson = (req, res, status, payload, extraLog = '') => {
  setCors(res)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
  logRequest(req, status, extraLog)
}

const isAuthorized = (req) => {
  const header = String(req.headers.authorization || '')
  const [type, token] = header.split(' ')
  if (type !== 'Bearer' || !token) return false
  return token === apiToken
}

const server = http.createServer(async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const base = `http://${req.headers.host || 'localhost'}`
  const url = new URL(req.url, base)

  if (req.method === 'GET' && (url.pathname === '/api/get-andamento' || url.pathname === '/get-andamento')) {
    if (!isAuthorized(req)) {
      res.setHeader('WWW-Authenticate', 'Bearer')
      sendJson(req, res, 401, { error: 'Unauthorized.' })
      return
    }
    const startDateParam = url.searchParams.get('startDate')
    const finalDateParam = url.searchParams.get('finalDate')
    const fallback = defaultRange()
    const startDate = startDateParam || fallback.startDate
    const finalDate = finalDateParam || fallback.finalDate

    if ((startDateParam && !isValidDate(startDateParam)) || (finalDateParam && !isValidDate(finalDateParam))) {
      sendJson(req, res, 400, { error: 'Invalid date format. Use YYYY-MM-DD.' })
      return
    }

    try {
      const startedAt = Date.now()
      const pool = await getPool()
      const request = pool.request()
      request.input('startDate', sql.Date, startDate)
      request.input('finalDate', sql.Date, finalDate)
      const result = await request.query(API_QUERY)
      const rows = result.recordset || []
      const duration = Date.now() - startedAt
      sendJson(req, res, 200, rows, `rows=${rows.length} ${duration}ms`)
    } catch (err) {
      sendJson(req, res, 500, { error: 'Failed to query database.' })
    }
    return
  }

  sendJson(req, res, 404, { error: 'Not found.' })
})

const port = Number(env.PORT || 7171)
server.listen(port, () => {
  console.log(`[andamento] listening on http://localhost:${port}`)
})
