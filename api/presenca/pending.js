import sql from 'mssql'

const getEnv = (key) => (
  process.env[key]
  || process.env[key?.toUpperCase?.()]
  || process.env[key?.toLowerCase?.()]
)

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' })
    return
  }

  const host = getEnv('host_king')
  const user = getEnv('user_king')
  const password = getEnv('pass_king')
  const database = getEnv('database_king')

  if (!host || !user || !password || !database) {
    res.status(500).json({ ok: false, error: 'Credenciais do banco (host_king/user_king/pass_king/database_king) não configuradas.' })
    return
  }

  const loginP = String(req.body?.loginP ?? '').trim()
  const tipoConsulta = String(req.body?.tipoConsulta ?? req.body?.fileName ?? '').trim()
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : []

  if (!loginP) {
    res.status(400).json({ ok: false, error: 'loginP obrigatório.' })
    return
  }
  if (!tipoConsulta) {
    res.status(400).json({ ok: false, error: 'tipoConsulta (nome do arquivo) obrigatório.' })
    return
  }
  if (rows.length === 0) {
    res.status(400).json({ ok: false, error: 'rows vazio.' })
    return
  }
  if (rows.length > 2000) {
    res.status(413).json({ ok: false, error: 'Arquivo grande demais. Envie no máximo 2000 linhas por vez.' })
    return
  }

  const now = new Date()
  const pendingStatus = 'Pendente'

  // Prepare sanitized rows (validate here to avoid inserting junk).
  const clean = []
  for (let i = 0; i < rows.length; i += 1) {
    const src = rows[i] || {}
    const cpf = onlyDigits(src.cpf)
    const nome = String(src.nome ?? '').trim()
    const telefone = onlyDigits(src.telefone)

    if (cpf.length !== 11) continue
    if (!nome) continue
    if (telefone.length < 10 || telefone.length > 11) continue
    if (telefone[2] !== '9') continue

    clean.push({ cpf, nome, telefone })
  }

  if (clean.length === 0) {
    res.status(400).json({ ok: false, error: 'Nenhuma linha válida para inserir.' })
    return
  }

  const config = {
    user,
    password,
    server: host,
    database,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: true,
      trustServerCertificate: true
    }
  }

  let pool
  try {
    try {
      pool = await sql.connect(config)
    } catch (err) {
      // Some SQL Server hosts don't support encryption; retry without it.
      const retryCfg = { ...config, options: { ...config.options, encrypt: false } }
      pool = await sql.connect(retryCfg)
    }

    const table = new sql.Table('consulta_presenca')
    table.create = false
    table.schema = 'dbo'

    table.columns.add('cpf', sql.VarChar(20), { nullable: false })
    table.columns.add('nome', sql.NVarChar(255), { nullable: false })
    table.columns.add('telefone', sql.VarChar(30), { nullable: false })
    table.columns.add('loginP', sql.VarChar(255), { nullable: false })
    table.columns.add('created_at', sql.DateTime2, { nullable: false })
    table.columns.add('updated_at', sql.DateTime2, { nullable: false })
    table.columns.add('tipoConsulta', sql.NVarChar(255), { nullable: false })
    table.columns.add('status', sql.NVarChar(50), { nullable: false })

    for (const r of clean) {
      table.rows.add(r.cpf, r.nome, r.telefone, loginP, now, now, tipoConsulta, pendingStatus)
    }

    // Bulk insert. If you need true upsert/merge, implement it server-side in the 85.31.61.242 API.
    await pool.request().bulk(table)

    res.status(200).json({ ok: true, insertedRows: clean.length, createdAt: now.toISOString() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Falha ao inserir no banco.' })
  } finally {
    try { await pool?.close?.() } catch { /* ignore */ }
  }
}
