import sql from 'mssql'

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

const toList = (value) => (Array.isArray(value) ? value : [])

const LEGACY_UPSTREAM_URL = String(
  process.env.HEALTH_CONSULT_UPSTREAM_URL || 'http://85.31.61.242:3002/api/health-consult'
).trim()
const LEGACY_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.HEALTH_CONSULT_PROXY_TIMEOUT_MS || 45000)
)
const SQL_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.HEALTH_CONSULT_SQL_TIMEOUT_MS || 15000)
)

const toBool = (value, fallback = false) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw)
}

const formatDateTime = (value) => {
  if (!value) return null
  const dt = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(dt.getTime())) return null
  const pad = (n) => String(n).padStart(2, '0')
  return [
    dt.getFullYear(),
    pad(dt.getMonth() + 1),
    pad(dt.getDate()),
  ].join('-') + ' ' + [
    pad(dt.getHours()),
    pad(dt.getMinutes()),
    pad(dt.getSeconds()),
  ].join(':')
}

const parseDate = (value) => {
  if (!value) return null
  const dt = value instanceof Date ? value : new Date(value)
  return Number.isNaN(dt.getTime()) ? null : dt
}

const diffHours = (from, to) => {
  const a = parseDate(from)
  const b = parseDate(to)
  if (!a || !b || b < a) return null
  return Math.round(((b.getTime() - a.getTime()) / 3600000) * 100) / 100
}

const querySummaryWindow = async (pool, whereSql) => {
  const query = `
    SELECT
      MIN(bs.backup_start_date) AS first_start,
      MAX(bs.backup_finish_date) AS last_finish,
      COUNT(*) AS quantity
    FROM msdb.dbo.backupset bs
    WHERE bs.type = 'D'
      AND ${whereSql}
  `
  const result = await pool.request().query(query)
  const row = result?.recordset?.[0] || {}
  const first = formatDateTime(row.first_start)
  const last = formatDateTime(row.last_finish)
  return {
    timer_hours: diffHours(row.first_start, row.last_finish),
    quantity: Number(row.quantity || 0),
    first_start: first,
    last_finish: last,
  }
}

const queryDistinctDatabasesWindow = async (pool, whereSql) => {
  const query = `
    SELECT DISTINCT bs.database_name
    FROM msdb.dbo.backupset bs
    WHERE bs.type = 'D'
      AND ${whereSql}
      AND bs.database_name IS NOT NULL
      AND bs.database_name <> ''
    ORDER BY bs.database_name
  `
  const result = await pool.request().query(query)
  return (result?.recordset || [])
    .map((row) => String(row.database_name || '').trim())
    .filter(Boolean)
}

const safeQuery = async (fn, fallback) => {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

const buildServerConfigs = () => {
  const fallbackHost = process.env.host_king || ''
  const fallbackUser = process.env.user_king || ''
  const fallbackPass = process.env.pass_king || ''
  const fallbackDb = process.env.database_king || 'master'

  const rows = [
    {
      name_database: 'Local',
      connection: {
        server: String(process.env.PLANEJAMENTO_DB_HOST || '').trim(),
        port: Number(process.env.PLANEJAMENTO_DB_PORT || 1433),
        user: String(process.env.PLANEJAMENTO_DB_USERNAME || '').trim(),
        password: String(process.env.PLANEJAMENTO_DB_PASSWORD || '').trim(),
        database: String(process.env.PLANEJAMENTO_DB_DATABASE || 'master').trim(),
        options: {
          encrypt: toBool(process.env.PLANEJAMENTO_DB_ENCRYPT, false),
          trustServerCertificate: toBool(process.env.PLANEJAMENTO_DB_TRUST_SERVER_CERTIFICATE, true),
        },
      },
    },
    {
      name_database: 'Hostinger',
      connection: {
        server: String(process.env.HOSTINGER_DB_HOST || fallbackHost).trim(),
        port: Number(process.env.HOSTINGER_DB_PORT || 1433),
        user: String(process.env.HOSTINGER_DB_USERNAME || fallbackUser).trim(),
        password: String(process.env.HOSTINGER_DB_PASSWORD || fallbackPass).trim(),
        database: String(process.env.HOSTINGER_DB_DATABASE || fallbackDb).trim(),
        options: {
          encrypt: toBool(process.env.HOSTINGER_DB_ENCRYPT, false),
          trustServerCertificate: toBool(process.env.HOSTINGER_DB_TRUST_SERVER_CERTIFICATE, true),
        },
      },
    },
    {
      name_database: 'Kinghost',
      connection: {
        server: String(process.env.KINGHOST_DB_HOST || '').trim(),
        port: Number(process.env.KINGHOST_DB_PORT || 1433),
        user: String(process.env.KINGHOST_DB_USERNAME || '').trim(),
        password: String(process.env.KINGHOST_DB_PASSWORD || '').trim(),
        database: String(process.env.KINGHOST_DB_DATABASE || 'master').trim(),
        options: {
          encrypt: toBool(process.env.KINGHOST_DB_ENCRYPT, false),
          trustServerCertificate: toBool(process.env.KINGHOST_DB_TRUST_SERVER_CERTIFICATE, true),
        },
      },
    },
  ]

  return rows.map((row) => ({
    ...row,
    enabled: Boolean(
      row.connection.server &&
      row.connection.user &&
      row.connection.password
    ),
  }))
}

const buildDisabledServerResponse = (name_database) => ({
  name_database,
  lastead_backup: null,
  latest_backup: null,
  quantity_databases: 0,
  backed_up_databases: [],
  backed_up_databases_by_type: {
    daily: [],
    weekly: [],
    monthly: [],
  },
  databases_last_backup: [],
  pending: [],
  daily: { timer_hours: null, quantity: 0, first_start: null, last_finish: null },
  weekly: { timer_hours: null, quantity: 0, first_start: null, last_finish: null },
  monthly: { timer_hours: null, quantity: 0, first_start: null, last_finish: null },
  errors: [
    {
      database: null,
      datetime: formatDateTime(new Date()),
      type: 'config',
      message: 'Configuração ausente para conexão SQL deste servidor.',
    },
  ],
  running_backup_count: null,
  collected_at: formatDateTime(new Date()),
})

const buildHealthForServer = async ({ name_database, connection, enabled }) => {
  if (!enabled) return buildDisabledServerResponse(name_database)

  const pool = new sql.ConnectionPool({
    ...connection,
    connectionTimeout: SQL_TIMEOUT_MS,
    requestTimeout: SQL_TIMEOUT_MS,
    pool: {
      max: 3,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  })

  try {
    await pool.connect()

    const serverNowRow = await pool.request().query('SELECT GETDATE() AS server_now')
    const serverNow = parseDate(serverNowRow?.recordset?.[0]?.server_now) || new Date()

    const onlineRows = await safeQuery(
      async () => {
        const result = await pool.request().query(
          "SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE'"
        )
        return result?.recordset || []
      },
      []
    )
    const onlineDatabases = onlineRows
      .map((row) => String(row.name || '').trim())
      .filter(Boolean)

    const lastBackupRows = await safeQuery(
      async () => {
        const result = await pool.request().query(`
          SELECT database_name, MAX(backup_finish_date) AS last_backup
          FROM msdb.dbo.backupset
          WHERE type = 'D'
          GROUP BY database_name
        `)
        return result?.recordset || []
      },
      []
    )

    const lastBackupByDb = new Map()
    lastBackupRows.forEach((row) => {
      const name = String(row.database_name || '').trim()
      const backupDate = parseDate(row.last_backup)
      if (name && backupDate) lastBackupByDb.set(name, backupDate)
    })

    const daily = await safeQuery(
      () => querySummaryWindow(pool, 'bs.backup_start_date >= CONVERT(date, GETDATE())'),
      { timer_hours: null, quantity: 0, first_start: null, last_finish: null }
    )
    const weekly = await safeQuery(
      () => querySummaryWindow(pool, 'bs.backup_start_date >= DATEADD(day, -7, GETDATE())'),
      { timer_hours: null, quantity: 0, first_start: null, last_finish: null }
    )
    const monthly = await safeQuery(
      () => querySummaryWindow(pool, 'bs.backup_start_date >= DATEADD(day, -30, GETDATE())'),
      { timer_hours: null, quantity: 0, first_start: null, last_finish: null }
    )

    const dailyDb = await safeQuery(
      () => queryDistinctDatabasesWindow(pool, 'bs.backup_start_date >= CONVERT(date, GETDATE())'),
      []
    )
    const weeklyDb = await safeQuery(
      () => queryDistinctDatabasesWindow(pool, 'bs.backup_start_date >= DATEADD(day, -7, GETDATE())'),
      []
    )
    const monthlyDb = await safeQuery(
      () => queryDistinctDatabasesWindow(pool, 'bs.backup_start_date >= DATEADD(day, -30, GETDATE())'),
      []
    )

    const runningRow = await safeQuery(
      async () => {
        const result = await pool.request().query(`
          SELECT COUNT(*) AS running_count
          FROM sys.dm_exec_requests
          WHERE command LIKE 'BACKUP%'
             OR command LIKE 'RESTORE%'
        `)
        return result?.recordset?.[0] || {}
      },
      { running_count: null }
    )

    let latestBackup = null
    const pending = []
    const errors = []
    const databases_last_backup = []

    onlineDatabases.forEach((databaseName) => {
      const lastBackup = lastBackupByDb.get(databaseName) || null
      const lastBackupFmt = formatDateTime(lastBackup)
      databases_last_backup.push({
        database: databaseName,
        last_backup: lastBackupFmt,
      })

      if (!lastBackup) {
        pending.push(databaseName)
        errors.push({
          database: databaseName,
          datetime: null,
          type: 'month',
        })
        return
      }

      if (!latestBackup || lastBackup > latestBackup) latestBackup = lastBackup

      const ageMs = serverNow.getTime() - lastBackup.getTime()
      const ageDays = ageMs / 86400000
      if (ageDays > 30) {
        pending.push(databaseName)
        errors.push({
          database: databaseName,
          datetime: lastBackupFmt,
          type: 'month',
        })
      } else if (ageDays > 7) {
        pending.push(databaseName)
        errors.push({
          database: databaseName,
          datetime: lastBackupFmt,
          type: 'week',
        })
      } else if (formatDateTime(lastBackup)?.slice(0, 10) !== formatDateTime(serverNow)?.slice(0, 10)) {
        pending.push(databaseName)
        errors.push({
          database: databaseName,
          datetime: lastBackupFmt,
          type: 'daily',
        })
      }
    })

    return {
      name_database,
      lastead_backup: formatDateTime(latestBackup),
      latest_backup: formatDateTime(latestBackup),
      quantity_databases: onlineDatabases.length,
      backed_up_databases: dailyDb,
      backed_up_databases_by_type: {
        daily: dailyDb,
        weekly: weeklyDb,
        monthly: monthlyDb,
      },
      databases_last_backup,
      pending,
      daily,
      weekly,
      monthly,
      errors,
      running_backup_count: Number(runningRow.running_count ?? 0),
      collected_at: formatDateTime(serverNow),
    }
  } catch (err) {
    return {
      name_database,
      lastead_backup: null,
      latest_backup: null,
      quantity_databases: 0,
      backed_up_databases: [],
      backed_up_databases_by_type: {
        daily: [],
        weekly: [],
        monthly: [],
      },
      databases_last_backup: [],
      pending: [],
      daily: { timer_hours: null, quantity: 0, first_start: null, last_finish: null },
      weekly: { timer_hours: null, quantity: 0, first_start: null, last_finish: null },
      monthly: { timer_hours: null, quantity: 0, first_start: null, last_finish: null },
      errors: [
        {
          database: null,
          datetime: formatDateTime(new Date()),
          type: 'connection',
          message: String(err?.message || err || 'Erro de conexão'),
        },
      ],
      running_backup_count: null,
      collected_at: formatDateTime(new Date()),
    }
  } finally {
    try {
      await pool.close()
    } catch {
      // noop
    }
  }
}

const proxyLegacy = async (req, res, origin) => {
  const searchIndex = req.url.indexOf('?')
  const search = searchIndex >= 0 ? req.url.slice(searchIndex) : ''
  const targetUrl = `${LEGACY_UPSTREAM_URL}${search}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LEGACY_TIMEOUT_MS)

  let upstream
  try {
    upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' },
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 502
    res.status(status)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', origin)
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.end(JSON.stringify({
      message: 'Upstream indisponível',
      error: String(err?.message || err || 'erro'),
      source: 'legacy-proxy',
    }))
    return
  } finally {
    clearTimeout(timeout)
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
  res.setHeader('Content-Length', buffer.length)
  res.setHeader('Access-Control-Allow-Origin', origin)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
  res.end(buffer)
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

  const serversConfig = buildServerConfigs()
  const enabledServers = serversConfig.filter((row) => row.enabled)

  // Fallback automático para proxy legado se não houver nenhuma conexão SQL configurada.
  if (enabledServers.length === 0) {
    await proxyLegacy(req, res, origin)
    return
  }

  const servers = await Promise.all(serversConfig.map((server) => buildHealthForServer(server)))
  const payload = {
    generated_at: formatDateTime(new Date()),
    servers,
    meta: {
      source: 'direct-sql',
      configured_servers: enabledServers.length,
      total_servers: serversConfig.length,
      partial: servers.some((item) => toList(item?.errors).length > 0),
    },
  }

  res.status(200)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', origin)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
  res.end(JSON.stringify(payload))
}
