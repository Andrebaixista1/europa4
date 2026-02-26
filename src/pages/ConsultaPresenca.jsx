import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiAlertCircle, FiArrowLeft, FiCheckCircle, FiClock, FiDownload, FiFileText, FiPause, FiPlay, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'
import { Roles, normalizeRole } from '../utils/roles.js'

const PRESENCA_API_BASE = import.meta.env.DEV ? '/api/presenca' : 'http://85.31.61.242:3011'
const resolvePresencaLaravelBasePath = () => {
  const raw = String(import.meta.env.VITE_PRESENCA_LARAVEL_BASE_PATH || '/api/consulta-presenca').trim()
  if (!raw) return '/api/consulta-presenca'

  // Evita mixed content no Vercel/producao quando houver env antiga em http://IP:porta.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && raw.startsWith('http://')) {
    return '/api/consulta-presenca'
  }

  return raw
}

const PRESENCA_LARAVEL_BASE_PATH = resolvePresencaLaravelBasePath()
const CRED_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank/'
const LIMITES_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-limite/'
const INDIVIDUAL_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-individual/'
const NOVO_LOGIN_API_URL = 'https://n8n.apivieiracred.store/webhook/api/novo-login'
const CONSULTA_PAUSE_URL = `${PRESENCA_API_BASE}/api/consulta/pause`
const CONSULTA_RESUME_URL = `${PRESENCA_API_BASE}/api/consulta/resume`
const LOTE_CSV_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-lote'
const LOTE_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-lote/'
const PRESENCA_CONSULTAS_DELETE_API_URL = `${PRESENCA_LARAVEL_BASE_PATH}/consultas`
const PROCESS_CSV_URL = `${PRESENCA_API_BASE}/api/process/csv`
const PRESENCA_DELETE_TIMEOUT_MS = Math.max(
  15000,
  Number(import.meta.env.VITE_PRESENCA_DELETE_TIMEOUT_MS || 60000)
)

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

const formatCpf = (value) => {
  const raw = onlyDigits(value)
  const cpf = raw && raw.length < 11 ? raw.padStart(11, '0') : raw
  if (cpf.length !== 11) return cpf || '-'
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const dateMinuteKey = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).trim()
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const parseDurationToMs = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const str = String(value).trim()
  if (!str) return null
  if (/^\d+(\.\d+)?$/.test(str)) {
    const numeric = Number(str)
    return Number.isFinite(numeric) ? numeric : null
  }

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const parts = str.split(':').map(Number)
    if (parts.some((p) => Number.isNaN(p))) return null
    const [a, b, c] = parts
    const totalSeconds = parts.length === 3 ? (a * 3600 + b * 60 + c) : (a * 60 + b)
    return totalSeconds * 1000
  }

  return null
}

const getRowDurationMs = (row) => {
  const explicit = parseDurationToMs(pick(row, ['tempo_medio', 'tempoMedio', 'tempo_medio_ms', 'avg_duration_ms', 'duracao_ms'], null))
  if (explicit !== null) return explicit

  const createdAt = new Date(row?.created_at || row?.createdAt || 0).getTime()
  const updatedAt = new Date(row?.updated_at || row?.updatedAt || 0).getTime()
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null
  if (updatedAt < createdAt) return null
  return updatedAt - createdAt
}

const formatAvgDuration = (ms) => {
  const durationMs = parseDurationToMs(ms)
  if (durationMs === null) return '-'
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`
  const totalSeconds = Math.round(durationMs / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`

  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (totalMinutes < 60) return `${totalMinutes}m ${String(seconds).padStart(2, '0')}s`

  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalHours < 24) return `${totalHours}h ${String(minutes).padStart(2, '0')}m`

  const totalDays = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return `${totalDays}d ${String(hours).padStart(2, '0')}h`
}

const CSV_COMMA_DECIMAL_COLUMNS = new Set([
  'valormargemdisponivel',
  'valormargembase',
  'valortotaldevido',
  'valorliberado',
  'valorparcela',
  'taxaseguro',
  'valorseguro'
])

const toCsvCommaDecimalValue = (columnName, value) => {
  const col = String(columnName ?? '').trim().toLowerCase()
  if (!CSV_COMMA_DECIMAL_COLUMNS.has(col)) return value
  if (value === null || value === undefined || value === '') return ''

  // Mantem o conteudo original, apenas troca separador decimal final para virgula.
  const txt = String(value).trim()
  if (!txt) return txt
  if (txt.includes(',')) return txt
  if (/^-?\d+(\.\d+)?$/.test(txt)) return txt.replace('.', ',')
  return txt
}

const PRESENCA_EXPORT_COLUMNS = [
  { header: 'cpf', keys: ['cpf', 'cliente_cpf', 'numero_documento', 'documento'] },
  { header: 'nome', keys: ['nome', 'cliente_nome', 'name', 'usuario_nome', 'nome_cliente', 'nome_cliente_consulta'] },
  { header: 'elegivel', keys: ['elegivel', 'isElegivel'] },
  { header: 'status', keys: ['status', 'final_status', 'situacao', 'status_presenca'] },
  { header: 'mensagem', keys: ['mensagem', 'message', 'erro', 'error', 'motivo', 'descricao'] },
  { header: 'tipoConsulta', keys: ['tipoConsulta', 'tipo_consulta', 'tipo'] },
  { header: 'created_at', keys: ['created_at', 'createdAt', 'data', 'data_hora', 'timestamp'] },
  { header: 'updated_at', keys: ['updated_at', 'updatedAt'] },
  { header: 'valorLiberado', keys: ['valorLiberado', 'valor_liberado', 'valor'] },
  { header: 'valorMargemBase', keys: ['valorMargemBase', 'valor_margem_base'] },
  { header: 'valorMargemDisponivel', keys: ['valorMargemDisponivel', 'valor_margem_disponivel'] },
  { header: 'prazo', keys: ['prazo', 'prazo_meses'] },
  { header: 'taxaJuros', keys: ['taxaJuros', 'taxa_juros'] },
  { header: 'valorParcela', keys: ['valorParcela', 'valor_parcela'] },
  { header: 'valorSeguro', keys: ['valorSeguro', 'valor_seguro'] },
  { header: 'valorTotalDevido', keys: ['valorTotalDevido', 'valor_total_devido'] }
]

const parseMoneyValue = (value) => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  let txt = String(value).trim()
  if (!txt) return 0
  txt = txt.replace(/\s+/g, '').replace(/R\$/gi, '')

  if (txt.includes(',') && txt.includes('.')) {
    if (txt.lastIndexOf(',') > txt.lastIndexOf('.')) {
      txt = txt.replace(/\./g, '').replace(',', '.')
    } else {
      txt = txt.replace(/,/g, '')
    }
  } else if (txt.includes(',')) {
    txt = txt.replace(/\./g, '').replace(',', '.')
  } else {
    txt = txt.replace(/,/g, '')
  }

  txt = txt.replace(/[^0-9.-]/g, '')
  const num = Number(txt)
  return Number.isFinite(num) ? num : 0
}

const groupLoteRows = (rows) => {
  const list = Array.isArray(rows) ? rows : []
  const byFile = new Map()

  for (const row of list) {
    const tipo = String(pick(row, ['tipoConsulta', 'tipo_consulta', 'tipo'], '')).trim().toLowerCase()
    if (tipo === 'individual') continue

    const file = String(pick(row, ['nomeArquivo', 'nome_arquivo', 'tipoConsulta', 'name', 'fileName'], '')).trim()
    if (!file) continue

    const created = String(pick(row, ['created_at', 'createdAt', 'data', 'data_hora'], '')).trim()
    const loginP = String(pick(row, ['loginP', 'login', 'usuario_login'], '')).trim()
    const idUser = toNumberOrNull(pick(row, ['id_user', 'idUser', 'user_id'], null))
    const idEquipe = toNumberOrNull(pick(row, ['equipe_id', 'equipeId', 'id_equipe', 'idEquipe'], null))
    const status = String(pick(row, ['status', 'final_status', 'situacao', 'status_presenca'], 'Pendente')).trim()
    const pending = isPendingLoteStatus(status) ? 1 : 0
    const success = isDoneLoteStatus(status) ? 1 : 0
    const error = (pending || success) ? 0 : 1
    const valorLiberado = parseMoneyValue(pick(row, ['valorLiberado', 'valor_liberado', 'valor'], 0))
    const okByValue = valorLiberado > 0 ? 1 : 0
    const durationMs = getRowDurationMs(row)

    const key = `${String(loginP || '').trim().toLowerCase()}|${file.toLowerCase()}`
    const prev = byFile.get(key) || {
      id: key,
      file,
      created: '',
      loginP: '',
      idUser: null,
      idEquipe: null,
      total: 0,
      totalRows: 0,
      pending: 0,
      success: 0,
      error: 0,
      okByValue: 0,
      noValue: 0,
      statusOtherCount: 0,
      durationMsTotal: 0,
      durationCount: 0,
      cpfSet: new Set()
    }

    if (!prev.loginP && loginP) prev.loginP = loginP
    if (prev.idUser === null && idUser !== null) prev.idUser = idUser
    if (prev.idEquipe === null && idEquipe !== null) prev.idEquipe = idEquipe
    const prevTs = new Date(prev.created || 0).getTime()
    const currTs = new Date(created || 0).getTime()
    if (created && (!Number.isFinite(prevTs) || currTs > prevTs)) prev.created = created

    prev.totalRows += 1
    const cpfKey = normalizeCpfBatch(row?.cpf ?? row?.CPF ?? row?.Cpf ?? '')
    if (cpfKey) {
      if (!prev.cpfSet.has(cpfKey)) {
        prev.cpfSet.add(cpfKey)
        prev.total += 1
      }
    } else {
      prev.total += 1
    }

    prev.pending += pending
    prev.success += success
    prev.error += error
    prev.okByValue += okByValue
    prev.noValue += okByValue ? 0 : 1
    prev.statusOtherCount += error
    if (durationMs !== null) {
      prev.durationMsTotal += durationMs
      prev.durationCount += 1
    }

    byFile.set(key, prev)
  }

  return Array.from(byFile.values()).map((entry) => ({
    id: entry.id,
    file: entry.file,
    created: entry.created,
    loginP: entry.loginP,
    idUser: entry.idUser,
    idEquipe: entry.idEquipe,
    total: entry.total,
    totalRows: entry.totalRows,
    pending: entry.pending,
    success: entry.success,
    error: entry.error,
    okByValue: entry.okByValue,
    noValue: entry.noValue,
    statusOtherCount: entry.statusOtherCount,
    avgDurationMs: entry.durationCount > 0 ? (entry.durationMsTotal / entry.durationCount) : null
  }))
}

const toCsvCell = (value) => {
  const s = String(value ?? '')
    .replace(/\r\n/g, ' | ')
    .replace(/[\r\n]+/g, ' | ')
    .replace(/\t/g, ' ')
  if (/[\";\r\n]/.test(s)) return `"${s.replace(/\"/g, '""')}"`
  return s
}

const parseDelimited = (text, delimiter = ';') => {
  const src = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = src.split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return []

  const parseLine = (line) => {
    const out = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
        continue
      }
      if (!inQuotes && ch === delimiter) {
        out.push(cur)
        cur = ''
        continue
      }
      cur += ch
    }
    out.push(cur)
    return out.map((v) => String(v ?? '').trim())
  }

  const headerLine = lines[0].replace(/^\uFEFF/, '')
  const headers = parseLine(headerLine).map((h) => String(h ?? '').trim().toLowerCase())
  const rows = []

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseLine(lines[i])
    if (cols.every((c) => String(c ?? '').trim() === '')) continue
    const obj = {}
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c]
      if (!key) continue
      obj[key] = cols[c] ?? ''
    }
    rows.push(obj)
  }
  return rows
}

const normalizeCpfBatch = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  let digits = onlyDigits(raw)

  // Aceita formatos que o Excel costuma gerar, ex.: 3,03E+10
  if (/[eE]/.test(raw)) {
    const sci = raw
      .replace(/\s+/g, '')
      .replace(',', '.')
    const num = Number(sci)
    if (Number.isFinite(num) && num >= 0) {
      digits = String(Math.trunc(num))
    }
  }

  digits = onlyDigits(digits)
  if (!digits) return ''
  if (digits.length < 11) digits = digits.padStart(11, '0')
  if (digits.length > 11) return ''
  return digits
}

const normalizeBatchRow = (obj, index1Based) => {
  const cpf = normalizeCpfBatch(obj?.cpf ?? obj?.CPF ?? obj?.Cpf ?? '')
  const nome = String(obj?.nome ?? obj?.Nome ?? obj?.NOME ?? '').trim().toLocaleUpperCase('pt-BR')
  const telefoneRaw = onlyDigits(obj?.telefone ?? obj?.Telefone ?? obj?.TELEFONE ?? '')

  if (cpf.length !== 11) return { ok: false, idx: index1Based, error: 'CPF inválido (normalizado precisa ter 11 dígitos).' }
  if (!nome) return { ok: false, idx: index1Based, error: 'Nome obrigatório.' }

  let telefone = telefoneRaw
  let phoneOrigin = 'Arquivo'

  // Se telefone vier em branco ou inválido, padroniza gerando automaticamente.
  const isValidPhone = (t) => {
    if (!t) return false
    if (t.length !== 11) return false
    if (t[2] !== '9') return false
    return true
  }

  if (!isValidPhone(telefone)) {
    telefone = generateRandomPhoneBatch()
    phoneOrigin = 'Gerado automaticamente'
  }

  return { ok: true, idx: index1Based, cpf, nome, telefone, phoneOrigin }
}

const makeJobId = () => {
  try {
    // eslint-disable-next-line no-undef
    return crypto.randomUUID()
  } catch {
    return `job_${Date.now()}_${Math.floor(Math.random() * 1e9)}`
  }
}

const formatDateOnly = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

const formatPhone = (value) => {
  const phone = onlyDigits(value)
  if (phone.length === 11) return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
  if (phone.length === 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`
  return phone || '-'
}

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

const resolveUserEquipeId = (user) => {
  return toNumberOrNull(user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId)
}

const normalizeLoginKey = (value) => String(value ?? '').trim().toLowerCase()

const getSelectedLoginStorageKey = (userId) => `consulta-presenca:selected-login:${String(userId)}`

const loadSelectedLoginFromStorage = (userId) => {
  if (userId === null || userId === undefined) return ''
  if (typeof window === 'undefined' || !window.localStorage) return ''
  try {
    return normalizeLoginKey(window.localStorage.getItem(getSelectedLoginStorageKey(userId)))
  } catch {
    return ''
  }
}

const saveSelectedLoginToStorage = (userId, loginKey) => {
  if (userId === null || userId === undefined) return
  if (typeof window === 'undefined' || !window.localStorage) return
  const storageKey = getSelectedLoginStorageKey(userId)
  try {
    if (!loginKey) {
      window.localStorage.removeItem(storageKey)
      return
    }
    window.localStorage.setItem(storageKey, String(loginKey))
  } catch {
    // ignore storage issues
  }
}

const parseSummaryMetrics = (row) => {
  const total = toNumberOrNull(pick(row, ['total', 'limite'], null))
  let usado = toNumberOrNull(pick(row, ['usado', 'consultados'], null))
  const updatedAtRaw = String(pick(row, ['updated_at', 'updatedAt', 'data_update', 'updated'], '')).trim()
  const updatedAtTs = updatedAtRaw ? new Date(updatedAtRaw).getTime() : Number.NaN
  const twentyFourHoursMs = 24 * 60 * 60 * 1000

  if (
    total !== null
    && usado !== null
    && usado > 0
    && Number.isFinite(updatedAtTs)
    && updatedAtTs <= (Date.now() - twentyFourHoursMs)
  ) {
    usado = 0
  }

  let restantes = toNumberOrNull(pick(row, ['restantes', 'restante', 'saldo'], null))
  if (restantes === null && total !== null && usado !== null) {
    restantes = Math.max(0, total - usado)
  }
  if (restantes !== null && total !== null && usado !== null) {
    restantes = Math.max(0, total - usado)
  }
  return {
    total: total ?? '-',
    usado: usado ?? '-',
    restantes: restantes ?? '-'
  }
}

const formatCurrency = (value) => {
  const num = toNumberOrNull(value)
  if (num === null) return '-'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const generateRandomPhone = () => {
  // Keeps number in the 119XXXXXXXX range and guarantees 3rd digit = 9.
  const suffix = String(Math.floor(Math.random() * 100000000)).padStart(8, '0')
  return `119${suffix}`
}

const generateRandomPhoneBatch = () => {
  // 11 digits between 11111111111 and 99999999999, with 3rd digit fixed as 9.
  const ddd = String(11 + Math.floor(Math.random() * 89)).padStart(2, '0') // 11..99
  const suffix = String(Math.floor(Math.random() * 100000000)).padStart(8, '0')
  return `${ddd}9${suffix}`
}

const maskLogin = (value) => {
  const txt = String(value ?? '')
  if (!txt) return '-'
  if (txt.length <= 3) return '*'.repeat(txt.length)
  return `${txt.slice(0, 3)}${'*'.repeat(txt.length - 3)}`
}

const copyToClipboard = async (text, successMsg = 'Copiado!') => {
  try {
    await navigator.clipboard.writeText(String(text ?? ''))
    notify.success(successMsg, { autoClose: 2000 })
  } catch (_) {
    try {
      const el = document.createElement('textarea')
      el.value = String(text ?? '')
      el.setAttribute('readonly', '')
      el.style.position = 'absolute'
      el.style.left = '-9999px'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      notify.success(successMsg, { autoClose: 2000 })
    } catch { /* ignore */ }
  }
}

const statusClassName = (status) => {
  const token = String(status ?? '').trim().toLowerCase()
  if (token === 'concluído' || token === 'concluido' || token === 'ok' || token === 'presente') return 'text-bg-success'
  if (token.includes('pendente') || token.includes('process')) return 'text-bg-warning'
  if (token.includes('erro') || token === 'error') return 'text-bg-danger'
  if (token === 'ausente') return 'text-bg-danger'
  return 'text-bg-secondary'
}

const batchStatusClassName = (status) => {
  const statusTxt = String(status || 'Pronto')
  if (statusTxt === 'Processando') return 'text-bg-info'
  if (statusTxt === 'Pendente') return 'text-bg-warning'
  if (statusTxt === 'Concluído') return 'text-bg-success'
  if (statusTxt === 'Concluído com erros') return 'text-bg-warning'
  if (statusTxt === 'Erro') return 'text-bg-danger'
  return 'text-bg-secondary'
}

const isDoneLoteStatus = (status) => {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'concluído' || s === 'concluido' || s === 'ok'
}

const isPendingLoteStatus = (status) => {
  const s = String(status ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return s.includes('pendente') || s.includes('process')
}

const isPendingConsultaStatus = (status) => {
  const s = String(status ?? '').trim().toLowerCase()
  return s.includes('pendente') || s.includes('processando')
}

const isDoneIndividualStatus = (status) => {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'concluido' || s === 'concluído'
}

const isFluxoCompletoOkMessage = (message) => {
  const token = String(message ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return token === 'fluxo completo ok'
}

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (payload && typeof payload === 'object') return [payload]
  return []
}

const hasConsultaDisplayData = (row) => {
  const raw = row || {}
  const cpf = onlyDigits(pick(raw, ['cpf', 'cliente_cpf', 'numero_documento', 'documento'], ''))
  const nome = String(pick(raw, ['nome', 'name', 'cliente_nome', 'usuario_nome', 'nome_cliente', 'nome_cliente_consulta'], '')).trim()
  const data = String(pick(raw, ['updated_at', 'data', 'created_at', 'data_hora', 'data_hora_registro', 'timestamp', 'createdAt'], '')).trim()
  const status = String(pick(raw, ['status', 'presenca_status', 'situacao', 'status_presenca'], '')).trim()
  return Boolean(cpf || nome || data || status)
}

const pick = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

const mapPresencaRowToExportShape = (row) => {
  const src = (row && typeof row === 'object') ? row : {}
  const out = {}
  for (const col of PRESENCA_EXPORT_COLUMNS) {
    const value = pick(src, col.keys, '')
    out[col.header] = value
  }
  return out
}

const mapRow = (row, idx) => ({
  id: pick(row, ['id', 'ID', 'id_presenca', 'presenca_id'], idx + 1),
  nome: pick(row, ['nome', 'name', 'cliente_nome', 'usuario_nome', 'nome_cliente', 'nome_cliente_consulta', 'loginP'], '-'),
  cpf: pick(row, ['cpf', 'cliente_cpf', 'numero_documento', 'documento'], ''),
  equipe: pick(row, ['equipe', 'equipe_nome', 'team_name', 'nome_equipe', 'id_user', 'loginP'], '-'),
  data: pick(row, ['updated_at', 'data', 'created_at', 'data_hora', 'data_hora_registro', 'timestamp', 'createdAt'], ''),
  dataNascimento: pick(row, ['dataNascimento', 'data_nascimento', 'nascimento'], ''),
  elegivel: parseNullableBoolean(pick(row, ['elegivel', 'isElegivel'], null)),
  status: pick(row, ['status', 'presenca_status', 'situacao', 'status_presenca'], 'Ativo'),
  origem: pick(row, ['origem', 'fonte', 'source', 'origem_dado'], 'PresencaBank'),
  raw: row
})

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value
  const token = String(value ?? '').trim().toLowerCase()
  if (token === 'true' || token === '1' || token === 'sim') return true
  if (token === 'false' || token === '0' || token === 'nao' || token === 'não') return false
  return false
}

const parseNullableBoolean = (value) => {
  if (value === null || value === undefined) return null
  const token = String(value).trim().toLowerCase()
  if (!token) return null
  if (token === 'true' || token === '1' || token === 'sim') return true
  if (token === 'false' || token === '0' || token === 'nao' || token === 'não') return false
  return null
}

const parsePauseStatusPayload = (rawText) => {
  let payload = {}
  try { payload = rawText ? JSON.parse(rawText) : {} } catch { payload = {} }

  const nested = (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object')
    ? payload.data
    : {}
  const reason = pick(payload, ['reason', 'motivo', 'message'], pick(nested, ['reason', 'motivo', 'message'], ''))
  const pauseKeys = ['paused', 'isPaused', 'pause', 'pausado']
  const readByKeys = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return undefined
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
    }
    return undefined
  }

  const explicitPauseValue = (() => {
    const root = readByKeys(payload, pauseKeys)
    if (root !== undefined) return root
    return readByKeys(nested, pauseKeys)
  })()

  if (explicitPauseValue !== undefined && explicitPauseValue !== null && String(explicitPauseValue).trim() !== '') {
    return {
      known: true,
      paused: parseBoolean(explicitPauseValue),
      reason: String(reason || '')
    }
  }

  const statusToken = String(
    readByKeys(payload, ['status', 'state', 'situacao']) ??
    readByKeys(nested, ['status', 'state', 'situacao']) ??
    ''
  )
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (['paused', 'pausado', 'pausa'].includes(statusToken)) {
    return { known: true, paused: true, reason: String(reason || '') }
  }
  if (['running', 'active', 'ativo', 'resumed', 'retomado'].includes(statusToken)) {
    return { known: true, paused: false, reason: String(reason || '') }
  }

  return { known: false, paused: false, reason: String(reason || '') }
}

const mapTabelaFromFlat = (row) => {
  const src = row || {}
  const nome = pick(src, ['nomeTipo', 'nome_tipo', 'nome', 'tipo_nome'], '')
  const prazo = pick(src, ['prazo', 'prazo_meses'], '')
  const valorLiberado = pick(src, ['valorLiberado', 'valor_liberado', 'valor'], '')
  const valorParcela = pick(src, ['valorParcela', 'valor_parcela'], '')
  const taxaJuros = pick(src, ['taxaJuros', 'taxa_juros'], '')
  const taxaSeguro = pick(src, ['taxaSeguro', 'taxa_seguro'], '')
  const valorSeguro = pick(src, ['valorSeguro', 'valor_seguro'], '')
  const id = pick(src, ['idTipo', 'id_tipo', 'id'], null)

  if (!nome && !prazo && !valorLiberado && !valorParcela && !taxaJuros && !taxaSeguro && !valorSeguro) return null
  return {
    id,
    nome,
    prazo: toNumberOrNull(prazo) ?? prazo,
    taxaJuros: toNumberOrNull(taxaJuros) ?? taxaJuros,
    valorLiberado: toNumberOrNull(valorLiberado) ?? valorLiberado,
    valorParcela: toNumberOrNull(valorParcela) ?? valorParcela,
    tipoCredito: { name: pick(src, ['tipoCreditoNome'], 'Novo') },
    taxaSeguro: toNumberOrNull(taxaSeguro) ?? taxaSeguro,
    valorSeguro: toNumberOrNull(valorSeguro) ?? valorSeguro
  }
}

const hasTabelaDisponivel = (row) => {
  const src = row || {}
  const keys = [
    pick(src, ['idTipo', 'id_tipo'], ''),
    pick(src, ['nomeTipo', 'nome_tipo', 'tipo_nome'], ''),
    pick(src, ['prazo', 'prazo_meses'], ''),
    pick(src, ['valorLiberado', 'valor_liberado', 'valor'], ''),
    pick(src, ['valorParcela', 'valor_parcela'], ''),
    pick(src, ['taxaJuros', 'taxa_juros'], ''),
    pick(src, ['taxaSeguro', 'taxa_seguro'], ''),
    pick(src, ['valorSeguro', 'valor_seguro'], '')
  ]
  return keys.some((value) => String(value ?? '').trim() !== '')
}

export default function ConsultaPresenca() {
  const { user } = useAuth()
  const normalizedUserRole = normalizeRole(user?.role, user?.level ?? user?.nivel_hierarquia ?? user?.NivelHierarquia)
  const canAccessBatchMode = (
    normalizedUserRole === Roles.Supervisor
    || normalizedUserRole === Roles.Master
    || Boolean(user?.is_supervisor)
  )
  const canDeleteLoteByUser = toNumberOrNull(user?.id) === 1
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('') // yyyy-mm-dd
  const [dateTo, setDateTo] = useState('') // yyyy-mm-dd
  const [page, setPage] = useState(1)
  const [lotePage, setLotePage] = useState(1)
  const [lastSyncAt, setLastSyncAt] = useState(null)
  const [summaryRows, setSummaryRows] = useState([])
  const [selectedLoginIndex, setSelectedLoginIndex] = useState(0)
  const [cpfConsulta, setCpfConsulta] = useState('')
  const [telefoneConsulta, setTelefoneConsulta] = useState('')
  const [nomeConsulta, setNomeConsulta] = useState('')
  const [consultaTab, setConsultaTab] = useState('individual') // individual | lote
  const [batchJobs, setBatchJobs] = useState([])
  const [loteGroups, setLoteGroups] = useState([])
  const batchPollers = useRef(new Map())
  const sourceRowsRef = useRef([])
  const lotePollInFlightRef = useRef(false)
  const loteSawPendingRef = useRef(false)
  const loteCsvUploadInFlightRef = useRef(false)
  const [loteAutoPollingEnabled, setLoteAutoPollingEnabled] = useState(false)
  const batchFileInputRef = useRef(null)
  const [selectedBatchUpload, setSelectedBatchUpload] = useState(null)
  const [uploadingBatchFile, setUploadingBatchFile] = useState(false)
  const [deleteLoteModal, setDeleteLoteModal] = useState(null)
  const [lotePreviewModal, setLotePreviewModal] = useState(null)
  const [deletingLote, setDeletingLote] = useState(false)
  const [consultaMsg, setConsultaMsg] = useState('')
  const [consultando, setConsultando] = useState(false)
  const [consultaResultModal, setConsultaResultModal] = useState(null)
  const [showAddLoginModal, setShowAddLoginModal] = useState(false)
  const [novoLogin, setNovoLogin] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [savingNovoLogin, setSavingNovoLogin] = useState(false)
  const [consultaPaused, setConsultaPaused] = useState(false)
  const [consultaPauseReason, setConsultaPauseReason] = useState('')
  const [consultaPauseBusy, setConsultaPauseBusy] = useState(false)
  const selectedLoginKeyRef = useRef('')
  const summaryAutoPollInFlightRef = useRef(false)

  const fetchHistoricoRows = useCallback(async () => {
    // Histórico dedicado desativado: a grade usa os dados do endpoint principal.
    return []
  }, [])

  const fetchLoteRows = useCallback(async ({ loginP, nomeArquivo, signal } = {}) => {
    if (signal?.aborted) {
      const abortErr = new Error('Aborted')
      abortErr.name = 'AbortError'
      throw abortErr
    }

    const targetLogin = normalizeLoginKey(loginP)
    const targetFile = String(nomeArquivo ?? '').trim().toLowerCase()
    const list = Array.isArray(sourceRowsRef.current) ? sourceRowsRef.current : []

    return list.filter((row) => {
      const tipo = String(pick(row, ['tipoConsulta', 'tipo_consulta', 'tipo'], '')).trim().toLowerCase()
      if (tipo === 'individual') return false

      if (targetLogin) {
        const rowLogin = normalizeLoginKey(pick(row, ['loginP', 'login', 'usuario_login'], ''))
        if (rowLogin && rowLogin !== targetLogin) return false
      }

      if (targetFile) {
        const rowFile = String(pick(row, ['nomeArquivo', 'nome_arquivo', 'tipoConsulta', 'name', 'fileName'], '')).trim().toLowerCase()
        if (rowFile && rowFile !== targetFile) return false
      }

      return true
    })
  }, [])

  const fetchSummary = useCallback(async (signal) => {
    const userId = toNumberOrNull(user?.id)
    const equipeId = resolveUserEquipeId(user)
    if (userId === null) {
      sourceRowsRef.current = []
      setRows([])
      setSummaryRows([])
      setLoteGroups([])
      loteSawPendingRef.current = false
      setLoteAutoPollingEnabled(false)
      setSelectedLoginIndex(0)
      selectedLoginKeyRef.current = ''
      setError('Usuário sem ID para consulta.')
      return
    }
    if (equipeId === null) {
      sourceRowsRef.current = []
      setRows([])
      setSummaryRows([])
      setLoteGroups([])
      loteSawPendingRef.current = false
      setLoteAutoPollingEnabled(false)
      setSelectedLoginIndex(0)
      selectedLoginKeyRef.current = ''
      setError('Usuário sem equipe para consulta.')
      return
    }

    setError('')
    try {
      const requestUrl = new URL(CRED_API_URL)
      requestUrl.searchParams.set('id_user', String(userId))
      requestUrl.searchParams.set('equipe_id', String(equipeId))
      const roleLabel = String(user?.role ?? normalizedUserRole ?? '').trim()
      const hierarchyLevel = toNumberOrNull(user?.nivel_hierarquia ?? user?.NivelHierarquia ?? user?.level)
      if (roleLabel) {
        requestUrl.searchParams.set('role', roleLabel)
        requestUrl.searchParams.set('hierarquia', roleLabel)
      }
      if (hierarchyLevel !== null) {
        requestUrl.searchParams.set('nivel_hierarquia', String(hierarchyLevel))
      }

      const limitesUrl = new URL(LIMITES_API_URL)
      limitesUrl.searchParams.set('id_user', String(userId))
      limitesUrl.searchParams.set('equipe_id', String(equipeId))

      const limitesResponse = await fetch(limitesUrl.toString(), { method: 'GET', signal })
      const limitesRawText = await limitesResponse.text()
      if (!limitesResponse.ok) throw new Error(limitesRawText || `HTTP ${limitesResponse.status}`)

      let limitesPayload = null
      try {
        limitesPayload = limitesRawText ? JSON.parse(limitesRawText) : []
      } catch {
        throw new Error('Resposta da API de limites inválida.')
      }

      const limitRows = normalizeRows(limitesPayload).filter((row) => row && Object.keys(row).length > 0)
      const limitCandidates = limitRows
        .map((row) => {
          const id = String(row?.id ?? '').trim()
          const loginP = pick(row, ['loginP', 'login', 'usuario_login'], '')
          const loginKey = normalizeLoginKey(loginP)
          if (!id || id === '0' || !loginKey || loginKey === 'total') return null
          return { id, loginKey }
        })
        .filter(Boolean)

      const storedLoginKeyForCred = loadSelectedLoginFromStorage(userId)
      const preferredLoginKeyFromState = selectedLoginKeyRef.current || storedLoginKeyForCred
      const selectedLimitCandidate = (preferredLoginKeyFromState
        ? limitCandidates.find((row) => row.loginKey === preferredLoginKeyFromState)
        : null) || limitCandidates[0] || null
      const selectedLoginIdForCred = String(selectedLimitCandidate?.id ?? '').trim()
      if (selectedLoginIdForCred) {
        requestUrl.searchParams.set('id_consulta_presenca', selectedLoginIdForCred)
        requestUrl.searchParams.set('id', selectedLoginIdForCred)
      }

      const credResponse = await fetch(requestUrl.toString(), { method: 'GET', signal })
      const credRawText = await credResponse.text()
      if (!credResponse.ok) throw new Error(credRawText || `HTTP ${credResponse.status}`)

      let credPayload = null
      try {
        credPayload = credRawText ? JSON.parse(credRawText) : []
      } catch {
        throw new Error('Resposta da API de consultas inválida.')
      }

      const sourceRows = normalizeRows(credPayload).filter((row) => row && Object.keys(row).length > 0)
      sourceRowsRef.current = sourceRows
      setRows(sourceRows.filter(hasConsultaDisplayData).map(mapRow))

      const sourceByLogin = new Map()
      for (const row of sourceRows) {
        const login = normalizeLoginKey(pick(row, ['loginP', 'login', 'usuario_login'], ''))
        if (!login || login === 'total') continue
        if (!sourceByLogin.has(login)) sourceByLogin.set(login, row)
      }

      const limitByLogin = new Map()
      for (const row of limitRows) {
        const id = String(row?.id ?? '').trim()
        const login = normalizeLoginKey(pick(row, ['loginP', 'login', 'usuario_login'], ''))
        if (!login || login === 'total' || id === '0') continue
        if (!limitByLogin.has(login)) limitByLogin.set(login, row)
      }

      let summaries = Array.from(limitByLogin.entries()).map(([loginKey, limitRow]) => {
        const sourceRow = sourceByLogin.get(loginKey)
        const metrics = parseSummaryMetrics(limitRow)
        const loginId = String(pick(limitRow, ['id'], pick(sourceRow, ['id'], ''))).trim()

        return {
          idConsultaPresenca: loginId && loginId !== '0' ? loginId : '',
          loginP: pick(limitRow, ['loginP', 'login', 'usuario_login'], pick(sourceRow, ['loginP', 'login', 'usuario_login'], '-')),
          senhaP: pick(limitRow, ['senhaP', 'senha', 'password'], pick(sourceRow, ['senhaP', 'senha', 'password'], '')),
          total: metrics.total,
          usado: metrics.usado,
          restantes: metrics.restantes
        }
      })

      if (summaries.length === 0) {
        summaries = sourceRows
          .map((row) => {
            const id = String(row?.id ?? '').trim()
            const loginP = pick(row, ['loginP', 'login', 'usuario_login'], '-')
            const loginKey = normalizeLoginKey(loginP)
            if (!loginKey || loginKey === 'total' || id === '0') return null
            const metrics = parseSummaryMetrics(row)
            return {
              idConsultaPresenca: id && id !== '0' ? id : '',
              loginP,
              senhaP: pick(row, ['senhaP', 'senha', 'password'], ''),
              total: metrics.total,
              usado: metrics.usado,
              restantes: metrics.restantes
            }
          })
          .filter(Boolean)
      }

      const storedLoginKey = loadSelectedLoginFromStorage(userId)
      const preferredLoginKey = selectedLoginKeyRef.current || storedLoginKey
      const preservedIndex = preferredLoginKey
        ? summaries.findIndex((row) => normalizeLoginKey(row?.loginP) === preferredLoginKey)
        : -1
      const nextSelectedIndex = preservedIndex >= 0 ? preservedIndex : 0

      setSummaryRows(summaries)
      setSelectedLoginIndex(nextSelectedIndex)

      const selectedLogin = summaries[nextSelectedIndex]?.loginP
      const nextLoginKey = normalizeLoginKey(selectedLogin)
      selectedLoginKeyRef.current = nextLoginKey
      saveSelectedLoginToStorage(userId, nextLoginKey)

      const firstLogin = selectedLogin
      if (firstLogin && firstLogin !== '-' && !uploadingBatchFile) {
        const loteRows = await fetchLoteRows({ loginP: firstLogin, signal })
        const grouped = groupLoteRows(loteRows)
        setLoteGroups(grouped)
        const hasPending = grouped.some((row) => Number(row?.pending ?? 0) > 0)
        loteSawPendingRef.current = hasPending
        setLoteAutoPollingEnabled(hasPending)
      } else if (!uploadingBatchFile) {
        setLoteGroups([])
        loteSawPendingRef.current = false
        setLoteAutoPollingEnabled(false)
      }

      const updatedCandidates = [...sourceRows, ...limitRows]
        .map((row) => pick(row, ['updated_at', 'updatedAt', 'data_update', 'updated'], ''))
        .filter(Boolean)
      const latestUpdated = updatedCandidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
      setLastSyncAt(latestUpdated)
    } catch (err) {
      if (err?.name === 'AbortError') return
      sourceRowsRef.current = []
      setRows([])
      setSummaryRows([])
      setLoteGroups([])
      loteSawPendingRef.current = false
      setLoteAutoPollingEnabled(false)
      setSelectedLoginIndex(0)
      setError(err?.message || 'Falha ao carregar consulta de presença.')
    }
  }, [fetchLoteRows, normalizedUserRole, uploadingBatchFile, user?.id, user?.equipe_id, user?.team_id, user?.equipeId, user?.teamId, user?.role, user?.level, user?.nivel_hierarquia, user?.NivelHierarquia])

  useEffect(() => {
    const userId = toNumberOrNull(user?.id)
    if (userId === null) {
      selectedLoginKeyRef.current = ''
      return
    }
    selectedLoginKeyRef.current = loadSelectedLoginFromStorage(userId)
  }, [user?.id])

  useEffect(() => {
    const userId = toNumberOrNull(user?.id)
    if (userId === null || summaryRows.length === 0) return
    const currentKey = normalizeLoginKey(summaryRows[selectedLoginIndex]?.loginP)
    if (!currentKey) return
    selectedLoginKeyRef.current = currentKey
    saveSelectedLoginToStorage(userId, currentKey)
  }, [summaryRows, selectedLoginIndex, user?.id])

  useEffect(() => {
    const controller = new AbortController()
    fetchSummary(controller.signal)
    return () => controller.abort()
  }, [fetchSummary])

  useEffect(() => {
    const loginP = summaryRows[selectedLoginIndex]?.loginP
    if (!loginP || loginP === '-') {
      setRows([])
      return undefined
    }
    const controller = new AbortController()
    fetchHistoricoRows(loginP, controller.signal)
    return () => controller.abort()
  }, [summaryRows, selectedLoginIndex, fetchHistoricoRows])

  const selectedLoginToken = String(summaryRows[selectedLoginIndex]?.loginP ?? '').trim().toLowerCase()

  useEffect(() => {
    if (!user?.id) return undefined

    const hasPending = rows.some((row) => {
      const status = String(row?.status ?? '').trim()
      if (!isPendingConsultaStatus(status)) return false

      const rawBase = row?.raw || row || {}
      const rowLogin = String(pick(rawBase, ['loginP', 'login', 'usuario_login'], '')).trim().toLowerCase()
      if (selectedLoginToken && rowLogin && rowLogin !== selectedLoginToken) return false
      return true
    })

    if (!hasPending) return undefined

    let cancelled = false
    const tick = async () => {
      if (cancelled || summaryAutoPollInFlightRef.current) return
      summaryAutoPollInFlightRef.current = true
      try {
        await fetchSummary()
      } finally {
        summaryAutoPollInFlightRef.current = false
      }
    }

    const interval = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [fetchSummary, rows, selectedLoginToken, user?.id])

  const filteredRowsForExport = useMemo(() => {
    const term = search.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null
    const base = rows.filter((row) => {
      const rawBase = row?.raw || row || {}
      const rowLogin = String(pick(rawBase, ['loginP', 'login', 'usuario_login'], '')).trim().toLowerCase()
      if (selectedLoginToken && rowLogin && rowLogin !== selectedLoginToken) return false

      if (fromTs !== null || toTs !== null) {
        const t = new Date(row?.data || '').getTime()
        if (!Number.isFinite(t)) return false
        if (fromTs !== null && t < fromTs) return false
        if (toTs !== null && t > toTs) return false
      }
      if (!term) return true
      return (
        String(row.nome ?? '').toLowerCase().includes(term) ||
        onlyDigits(row.cpf).includes(onlyDigits(term)) ||
        String(row.equipe ?? '').toLowerCase().includes(term)
      )
    })

    const sorted = [...base].sort((a, b) => {
      const ta = new Date(a?.data || 0).getTime()
      const tb = new Date(b?.data || 0).getTime()
      return tb - ta
    })
    return sorted
  }, [rows, search, dateFrom, dateTo, selectedLoginToken])

  const filteredRows = useMemo(() => {
    const seenComposite = new Set()
    return filteredRowsForExport.filter((row) => {
      const nameKey = String(row?.nome ?? '').trim().toLowerCase()
      const rawBase = row?.raw || row || {}
      const createdKey = dateMinuteKey(pick(rawBase, ['created_at', 'createdAt'], ''))
      const dateKey = createdKey || dateMinuteKey(row?.data)
      if (!nameKey || !dateKey) return true
      // Remove duplicados por Nome + Data de atualização (no minuto).
      // Inclui CPF no key para evitar colisões entre homônimos.
      const cpfKey = onlyDigits(row?.cpf) || '-'
      const loginKey = String(pick(rawBase, ['loginP', 'login'], '')).trim().toLowerCase() || '-'
      const key = `${loginKey}__${nameKey}__${dateKey}__${cpfKey}`
      if (seenComposite.has(key)) return false
      seenComposite.add(key)
      return true
    })
  }, [filteredRowsForExport])

  const currentSummary = summaryRows[selectedLoginIndex] || { idConsultaPresenca: '', loginP: '-', senhaP: '', total: '-', usado: '-', restantes: '-' }
  const loteGroupsByLogin = useMemo(() => {
    const list = Array.isArray(loteGroups) ? loteGroups : []
    if (!selectedLoginToken) return list
    return list.filter((item) => {
      const itemLogin = String(item?.loginP ?? item?.login ?? '').trim().toLowerCase()
      return !itemLogin || itemLogin === selectedLoginToken
    })
  }, [loteGroups, selectedLoginToken])
  const batchJobsByLogin = useMemo(() => {
    const list = Array.isArray(batchJobs) ? batchJobs : []
    if (!selectedLoginToken) return list
    return list.filter((item) => {
      const itemLogin = String(item?.loginP ?? item?.login ?? '').trim().toLowerCase()
      return !itemLogin || itemLogin === selectedLoginToken
    })
  }, [batchJobs, selectedLoginToken])
  const loteTableRows = useMemo(() => {
    const normalizeFileKey = (value) => String(value ?? '').trim().toLowerCase()
    const normalizeLogin = (value) => String(value ?? '').trim().toLowerCase()
    const byKey = new Map()

    for (const job of batchJobsByLogin) {
      const fileName = String(job?.fileName ?? job?.file ?? '').trim()
      if (!fileName) continue
      const loginP = String(job?.loginP ?? currentSummary?.loginP ?? '').trim()
      const key = `${normalizeLogin(loginP)}|${normalizeFileKey(fileName)}`
      byKey.set(key, {
        source: 'job',
        key,
        fileName,
        loginP,
        createdAt: String(job?.createdAt ?? job?.finishedAt ?? '').trim(),
        raw: job
      })
    }

    for (const group of loteGroupsByLogin) {
      const fileName = String(group?.file ?? group?.fileName ?? '').trim()
      if (!fileName) continue
      const loginP = String(group?.loginP ?? '').trim()
      const key = `${normalizeLogin(loginP)}|${normalizeFileKey(fileName)}`
      const prev = byKey.get(key)
      const next = {
        source: 'group',
        key,
        fileName,
        loginP,
        createdAt: String(group?.created ?? '').trim(),
        raw: group
      }

      if (!prev) {
        byKey.set(key, next)
        continue
      }

      // Prioriza lote agrupado vindo da API quando ja existir correspondente local.
      if (prev.source === 'job') {
        byKey.set(key, next)
        continue
      }

      const prevTs = new Date(prev.createdAt || 0).getTime()
      const nextTs = new Date(next.createdAt || 0).getTime()
      if ((Number.isFinite(nextTs) ? nextTs : 0) >= (Number.isFinite(prevTs) ? prevTs : 0)) {
        byKey.set(key, next)
      }
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime()
      const tb = new Date(b?.createdAt || 0).getTime()
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })
  }, [batchJobsByLogin, loteGroupsByLogin, currentSummary?.loginP])
  const pageSize = 50
  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pages)
  const startIndex = filteredRows.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1
  const endIndex = Math.min(filteredRows.length, currentPage * pageSize)
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage])
  const loteSourceRows = loteTableRows
  const lotePageSize = 10
  const lotePages = Math.max(1, Math.ceil(loteSourceRows.length / lotePageSize))
  const currentLotePage = Math.min(lotePage, lotePages)
  const loteStartIndex = loteSourceRows.length === 0 ? 0 : ((currentLotePage - 1) * lotePageSize) + 1
  const loteEndIndex = Math.min(loteSourceRows.length, currentLotePage * lotePageSize)
  const pagedLoteRows = useMemo(() => {
    const start = (currentLotePage - 1) * lotePageSize
    return loteSourceRows.slice(start, start + lotePageSize)
  }, [loteSourceRows, currentLotePage])
  const sortedTabelasBody = useMemo(() => {
    const list = Array.isArray(consultaResultModal?.tabelasBody) ? [...consultaResultModal.tabelasBody] : []
    const sorted = list.sort((a, b) => {
      const av = toNumberOrNull(a?.valorLiberado) ?? -Infinity
      const bv = toNumberOrNull(b?.valorLiberado) ?? -Infinity
      return bv - av
    })
    const seen = new Set()
    return sorted.filter((item) => {
      const key = [
        String(item?.nome ?? '').trim().toLowerCase(),
        String(item?.prazo ?? '').trim(),
        String(item?.taxaJuros ?? '').trim(),
        String(item?.valorLiberado ?? '').trim(),
        String(item?.valorParcela ?? '').trim(),
        String(item?.taxaSeguro ?? '').trim(),
        String(item?.valorSeguro ?? '').trim()
      ].join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [consultaResultModal])

  useEffect(() => {
    setPage(1)
  }, [search, dateFrom, dateTo, rows, selectedLoginIndex])

  useEffect(() => {
    if (!canAccessBatchMode && consultaTab === 'lote') {
      setConsultaTab('individual')
    }
  }, [canAccessBatchMode, consultaTab])

  useEffect(() => {
    if (consultaTab !== 'lote') return
    setLotePage(1)
  }, [consultaTab, selectedLoginIndex])

  const refresh = () => {
    fetchSummary()
  }

  const openAddLoginModal = () => {
    setNovoLogin('')
    setNovaSenha('')
    setShowAddLoginModal(true)
  }

  const handleNovoLoginSubmit = async (event) => {
    event.preventDefault()
    if (savingNovoLogin) return

    const login = String(novoLogin ?? '').trim()
    const senha = String(novaSenha ?? '').trim()
    if (!login || !senha) {
      notify.warn('Preencha login e senha.', { autoClose: 2200 })
      return
    }
    if (!user?.id) {
      notify.error('Usuário sem ID para cadastrar login.', { autoClose: 2400 })
      return
    }
    const equipeId = resolveUserEquipeId(user)
    if (equipeId === null) {
      notify.error('Usuário sem equipe para cadastrar login.', { autoClose: 2400 })
      return
    }

    try {
      setSavingNovoLogin(true)
      const response = await fetch(NOVO_LOGIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          senha,
          id_user: user.id,
          equipe_id: equipeId
        })
      })
      const rawText = await response.text()
      if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

      notify.success('Novo login enviado com sucesso.', { autoClose: 2200 })
      setShowAddLoginModal(false)
      setTimeout(() => {
        window.location.reload()
      }, 600)
    } catch (err) {
      notify.error(err?.message || 'Falha ao enviar novo login.', { autoClose: 2800 })
    } finally {
      setSavingNovoLogin(false)
    }
  }

  const downloadFilteredCsv = useCallback(() => {
    if (!filteredRowsForExport.length) {
      notify.info('Nenhum registro para baixar.', { autoClose: 2000 })
      return
    }

    const exportRowsRaw = filteredRowsForExport.map((row) => {
      const raw = row?.raw
      return (raw && typeof raw === 'object') ? raw : row
    })
    const exportRows = exportRowsRaw.map(mapPresencaRowToExportShape)
    const header = PRESENCA_EXPORT_COLUMNS.map((col) => col.header)

    const lines = [header.join(';')]
    for (const row of exportRows) {
      const values = header.map((col) => {
        const rawValue = row?.[col]
        const safeValue = (rawValue && typeof rawValue === 'object')
          ? JSON.stringify(rawValue)
          : toCsvCommaDecimalValue(col, rawValue ?? '')
        return toCsvCell(safeValue)
      })
      lines.push(values.join(';'))
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `consulta-presenca_${stamp}.csv`

    // BOM para Excel manter acentuação em UTF-8.
    const content = `\ufeff${lines.join('\r\n')}\r\n`
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
  }, [filteredRowsForExport])

  const openConsultaResultModalFromSource = useCallback((source, phoneOriginFallback = 'Registro do histórico') => {
    const payload = source && typeof source === 'object' ? source : {}
    const resultData = payload?.result && typeof payload.result === 'object' ? payload.result : payload
    const fallbackOriginal = resultData?.original || {}

    const cpfBase = pick(resultData, ['cpf'], pick(fallbackOriginal, ['cpf'], pick(payload, ['cpf'], '')))
    const nomeBase = pick(resultData, ['nome'], pick(fallbackOriginal, ['nome'], pick(payload, ['nome'], '')))
    const telefoneBase = pick(resultData, ['telefone'], pick(fallbackOriginal, ['telefone'], pick(payload, ['telefone'], '')))
    const loginBase = pick(resultData, ['loginP'], pick(payload, ['loginP'], ''))
    const createdBase = pick(resultData, ['created_at'], pick(payload, ['created_at'], ''))

    let tabelasBody = Array.isArray(resultData?.tabelas_body)
      ? resultData.tabelas_body
      : (Array.isArray(payload?.tabelas_body) ? payload.tabelas_body : [])

    if (tabelasBody.length === 0) {
      const sourceRows = rows.map((r) => r?.raw || r)
      const related = sourceRows.filter((item) => {
        const cpfItem = pick(item, ['cpf'], '')
        if (cpfBase && cpfItem && cpfItem !== cpfBase) return false
        const nomeItem = pick(item, ['nome'], '')
        if (nomeBase && nomeItem && String(nomeItem).trim().toLowerCase() !== String(nomeBase).trim().toLowerCase()) return false
        const telItem = pick(item, ['telefone'], '')
        if (telefoneBase && telItem && telItem !== telefoneBase) return false
        const loginItem = pick(item, ['loginP'], '')
        if (loginBase && loginItem && loginItem !== loginBase) return false
        if (createdBase) {
          const tBase = new Date(createdBase).getTime()
          const tItem = new Date(pick(item, ['created_at'], createdBase)).getTime()
          if (Number.isFinite(tBase) && Number.isFinite(tItem) && Math.abs(tBase - tItem) > (1000 * 60 * 10)) return false
        }
        return true
      })
      tabelasBody = related
        .map(mapTabelaFromFlat)
        .filter(Boolean)
        .filter((item, idx, arr) => arr.findIndex((x) => `${x.id}-${x.nome}-${x.prazo}` === `${item.id}-${item.nome}-${item.prazo}`) === idx)
    }

    const messageValue = pick(
      resultData,
      ['Mensagem', 'mensagem', 'final_message', 'finalMessage', 'msg'],
      pick(payload, ['Mensagem', 'mensagem', 'final_message', 'finalMessage', 'error', 'message'], '')
    )
    const errorMessage = messageValue && !isFluxoCompletoOkMessage(messageValue) ? messageValue : ''

    setConsultaResultModal({
      cpf: cpfBase,
      nome: nomeBase,
      telefone: telefoneBase,
      phoneOrigin: pick(resultData, ['phoneOrigin', 'phone_origin'], phoneOriginFallback),
        vinculo: resultData?.vinculo || payload?.vinculo || {
          matricula: pick(payload, ['matricula'], ''),
          numeroInscricaoEmpregador: pick(payload, ['numeroInscricaoEmpregador'], ''),
          elegivel: parseNullableBoolean(pick(payload, ['elegivel'], null))
        },
      margemData: resultData?.margem_data || payload?.margem_data || {
        valorMargemDisponivel: pick(payload, ['valorMargemDisponivel'], ''),
        valorMargemBase: pick(payload, ['valorMargemBase'], ''),
        valorTotalDevido: pick(payload, ['valorTotalDevido'], ''),
        registroEmpregaticio: pick(payload, ['matricula', 'registroEmpregaticio'], ''),
        cnpjEmpregador: pick(payload, ['numeroInscricaoEmpregador', 'cnpjEmpregador'], ''),
        dataAdmissao: pick(payload, ['dataAdmissao'], ''),
        dataNascimento: pick(payload, ['dataNascimento'], ''),
        nomeMae: pick(payload, ['nomeMae'], ''),
        sexo: pick(payload, ['sexo'], '')
      },
      tabelasBody,
      finalStatus: pick(resultData, ['final_status'], pick(payload, ['final_status'], payload?.ok ? 'OK' : 'ERRO')),
      finalMessage: messageValue,
      errorMessage
    })
  }, [rows])

  const handleConsultarIndividual = useCallback(async (event) => {
    event.preventDefault()
    const cpfDigits = onlyDigits(cpfConsulta)
    const phoneDigitsRaw = onlyDigits(telefoneConsulta)
    const nome = String(nomeConsulta ?? '').trim()

    if (cpfDigits.length !== 11) {
      setConsultaMsg('Informe um CPF válido com 11 dígitos.')
      return
    }
    if (!nome) {
      setConsultaMsg('Informe o nome para consultar.')
      return
    }

    let phoneDigits = phoneDigitsRaw
    let phoneOrigin = 'Digitado manualmente'
    if (!phoneDigits) {
      phoneDigits = generateRandomPhone()
      setTelefoneConsulta(phoneDigits)
      phoneOrigin = 'Gerado automaticamente'
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setConsultaMsg('Telefone inválido. Use 10 ou 11 dígitos.')
      return
    }
    if (phoneDigits[2] !== '9') {
      setConsultaMsg('O 3º dígito do telefone precisa ser 9.')
      return
    }

    if (!currentSummary?.loginP || currentSummary.loginP === '-') {
      setConsultaMsg('Selecione um login válido no card Limites API.')
      return
    }
    if (!currentSummary?.idConsultaPresenca) {
      setConsultaMsg('Não foi possível identificar o ID do login selecionado.')
      return
    }
    if (!user?.id) {
      setConsultaMsg('Usuário sem ID para consulta.')
      return
    }
    const equipeId = resolveUserEquipeId(user)
    if (equipeId === null) {
      setConsultaMsg('Usuário sem equipe para consulta.')
      return
    }

    const nomeUpper = nome.toLocaleUpperCase('pt-BR')

    const payload = {
      id_consulta_presenca: String(currentSummary.idConsultaPresenca),
      id_user: user.id,
      equipe_id: equipeId,
      cpf: cpfDigits,
      telefone: phoneDigits,
      nome: nomeUpper
    }

    setConsultando(true)
    setConsultaMsg('Enviando consulta individual...')
    try {
      const response = await fetch(INDIVIDUAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const raw = await response.text()
      let parsed = raw
      try {
        parsed = raw ? JSON.parse(raw) : {}
      } catch {
        parsed = raw || ''
      }
      const parsedObj = (parsed && typeof parsed === 'object') ? parsed : {}

      if (!response.ok) {
        throw new Error(typeof parsed === 'string' ? parsed : JSON.stringify(parsedObj))
      }

      setConsultaMsg('')
      notify.warn(`Consulta enviada com sucesso | CPF ${formatCpf(cpfDigits)} | Telefone ${formatPhone(phoneDigits)}.`, {
        autoClose: 3200
      })
      await fetchSummary()
    } catch (err) {
      setConsultaMsg(err?.message || 'Falha ao chamar API de consulta individual.')
    } finally {
      setConsultando(false)
    }
  }, [cpfConsulta, telefoneConsulta, nomeConsulta, currentSummary, fetchSummary, user?.id])

  const handleBatchFileChange = useCallback(async (event) => {
    const file = event?.target?.files?.[0] ?? null
    setConsultaMsg('')

    if (!file) {
      setSelectedBatchUpload(null)
      return
    }

    try {
      const name = String(file.name || '').toLowerCase()
      if (!name.endsWith('.csv')) {
        setSelectedBatchUpload(null)
        setConsultaMsg('Formato inválido. Envie apenas CSV separado por ponto e vírgula (;).')
        return
      }

      const text = await file.text()
      const firstLine = String(text ?? '').split(/\r\n|\n|\r/)[0] || ''
      if (!firstLine.includes(';') && firstLine.includes(',')) {
        setSelectedBatchUpload(null)
        setConsultaMsg('CSV inválido para este fluxo. Use separador ponto e vírgula (;).')
        return
      }
      const rawRows = parseDelimited(text, ';')

      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        setConsultaMsg('Arquivo vazio ou inválido.')
        return
      }

      const cols = new Set(Object.keys(rawRows[0] || {}).map((k) => String(k ?? '').trim().toLowerCase()))
      // As colunas precisam existir (telefone pode estar vazio/ inválido, será padronizado).
      const required = ['cpf', 'nome', 'telefone']
      const missing = required.filter((k) => !cols.has(k))
      if (missing.length > 0) {
        setConsultaMsg(`Colunas obrigatórias não encontradas: ${missing.join(', ')}. Use exatamente: CPF, NOME, TELEFONE.`)
        return
      }

      const valid = []
      const invalid = []
      rawRows.forEach((obj, i) => {
        const norm = normalizeBatchRow(obj, i + 1)
        if (norm.ok) valid.push(norm)
        else invalid.push(norm)
      })

      const restantesDigits = onlyDigits(currentSummary?.restantes)
      const restantesLimit = restantesDigits ? Number(restantesDigits) : null
      if (restantesLimit !== null && Number.isFinite(restantesLimit) && valid.length > restantesLimit) {
        const droppedPreview = valid.length - restantesLimit
        notify.warn(
          `Atenção: ${droppedPreview} linha(s) excedente(s) serão ignorada(s) no envio (limite restante: ${restantesLimit}).`,
          { autoClose: 3200 }
        )
      }

      setSelectedBatchUpload({
        id: makeJobId(),
        file,
        fileName: file.name,
        totalRows: rawRows.length,
        validRows: valid.length,
        invalidRows: invalid.length,
        validData: valid.map((row) => ({
          cpf: row.cpf,
          nome: row.nome,
          telefone: row.telefone
        }))
      })
      setConsultaMsg(`Arquivo selecionado: ${valid.length} válido(s), ${invalid.length} inválido(s). Clique em "Carregar arquivo".`)
    } catch (err) {
      setSelectedBatchUpload(null)
      setConsultaMsg(err?.message || 'Falha ao ler arquivo.')
    }
  }, [currentSummary?.restantes])

  const deleteBatchJob = useCallback((jobId) => {
    if (!canDeleteLoteByUser) {
      notify.warn('Somente o usuário Master (ID 1) pode excluir lote.', { autoClose: 2200 })
      return
    }
    setBatchJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [canDeleteLoteByUser])

  const stopBatchPolling = useCallback((jobId) => {
    const timer = batchPollers.current.get(jobId)
    if (timer) {
      clearInterval(timer)
      batchPollers.current.delete(jobId)
    }
  }, [])

  const beginBatchPolling = useCallback((jobId, job) => {
    if (!job || !user?.id || !currentSummary?.loginP) return
    if (batchPollers.current.has(jobId)) return

    const poll = async () => {
      try {
        const rows = await fetchLoteRows({ loginP: currentSummary.loginP, nomeArquivo: job.fileName })
        const scopedRows = (Array.isArray(rows) ? rows : []).filter((r) => {
          const tipo = String(pick(r, ['tipoConsulta', 'tipo_consulta', 'tipo'], '')).trim().toLowerCase()
          return tipo !== 'individual'
        })
        if (!scopedRows.length) return

        const statuses = scopedRows.map((r) => String(r?.status ?? '').toLowerCase())
        const pendingCount = statuses.filter((s) => isPendingLoteStatus(s)).length
        const successCount = statuses.filter((s) => isDoneLoteStatus(s)).length
        const errorCount = statuses.filter((s) => !isPendingLoteStatus(s) && !isDoneLoteStatus(s)).length
        const durationValues = scopedRows
          .map((r) => getRowDurationMs(r))
          .filter((v) => v !== null)
        const avgDurationMs = durationValues.length
          ? (durationValues.reduce((acc, cur) => acc + cur, 0) / durationValues.length)
          : null
        setBatchJobs((prev) =>
          prev.map((item) =>
            item.id === jobId
              ? {
                ...item,
                status: pendingCount ? "Processando" : (errorCount ? "Concluído com erros" : "Concluído"),
                progress: pendingCount ? Math.round(((successCount + errorCount) / scopedRows.length) * 100) : 100,
                okCount: successCount,
                errCount: errorCount,
                avgDurationMs
              }
              : item
          )
        )

        if (pendingCount === 0) {
          stopBatchPolling(jobId)
        }
      } catch {
        stopBatchPolling(jobId)
      }
    }

    poll()
    const timer = setInterval(poll, 5000)
    batchPollers.current.set(jobId, timer)
  }, [currentSummary?.loginP, fetchLoteRows, stopBatchPolling, user?.id])

  const fetchLoteGroups = useCallback(async (signal, forcedLoginP) => {
    const loginP = forcedLoginP || currentSummary?.loginP
    if (!user?.id || !loginP || loginP === '-') {
      loteSawPendingRef.current = false
      setLoteAutoPollingEnabled(false)
      return false
    }
    try {
      const rows = await fetchLoteRows({ loginP, signal })
      const grouped = groupLoteRows(rows)
      const hasPending = grouped.some((row) => Number(row?.pending ?? 0) > 0)
      if (hasPending) loteSawPendingRef.current = true
      if (!hasPending && loteAutoPollingEnabled && loteSawPendingRef.current) {
        notify.success('Consulta em lote concluída.', { autoClose: 2500 })
        loteSawPendingRef.current = false
      }
      setLoteGroups(grouped)
      setLoteAutoPollingEnabled(hasPending)
      return hasPending
    } catch (err) {
      if (err?.name === 'AbortError') return
      /* ignore */
      return true
    }
  }, [currentSummary?.loginP, fetchLoteRows, loteAutoPollingEnabled, user?.id])

  const toggleConsultaPause = useCallback(async () => {
    if (consultaPauseBusy) return
    try {
      setConsultaPauseBusy(true)
      if (consultaPaused) {
        const response = await fetch(CONSULTA_RESUME_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        const rawText = await response.text()
        if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)
        setConsultaPaused(false)
        setConsultaPauseReason('')
        notify.success('Processamento retomado.', { autoClose: 2200 })
        const activeLogin = String(currentSummary?.loginP || '').trim()
        if (activeLogin && activeLogin !== '-') {
          const hasPending = await fetchLoteGroups(undefined, activeLogin)
          setLoteAutoPollingEnabled(Boolean(hasPending))
        }
      } else {
        const response = await fetch(CONSULTA_PAUSE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Pausa manual via tela de lote.' })
        })
        const rawText = await response.text()
        if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)
        const parsed = parsePauseStatusPayload(rawText)
        setConsultaPaused(true)
        setConsultaPauseReason(parsed.reason || 'Pausa manual via tela de lote.')
        setLoteAutoPollingEnabled(false)
        notify.warn('Processamento pausado.', { autoClose: 2200 })
      }
    } catch (err) {
      notify.error(err?.message || 'Falha ao alterar pausa do processamento.', { autoClose: 2800 })
    } finally {
      setConsultaPauseBusy(false)
    }
  }, [consultaPauseBusy, consultaPaused, currentSummary?.loginP, fetchLoteGroups])

  const uploadBatchFile = useCallback(async () => {
    if (uploadingBatchFile || loteCsvUploadInFlightRef.current) return
    if (!selectedBatchUpload) {
      setConsultaMsg('Selecione um arquivo antes de carregar.')
      return
    }
    if (!user?.id) {
      setConsultaMsg('Usuário sem ID para enviar lote.')
      return
    }
    if (!currentSummary?.loginP || currentSummary.loginP === '-') {
      setConsultaMsg('Selecione um login válido no card Limites API.')
      return
    }
    if (!currentSummary?.idConsultaPresenca) {
      setConsultaMsg('Não foi possível identificar o ID do login selecionado.')
      return
    }
    const equipeId = resolveUserEquipeId(user)
    if (equipeId === null) {
      setConsultaMsg('Usuário sem equipe para envio do lote.')
      return
    }

    const validData = Array.isArray(selectedBatchUpload.validData) ? selectedBatchUpload.validData : []
    if (!validData.length) {
      setConsultaMsg('Arquivo sem linhas válidas para envio.')
      return
    }

    const restantesDigits = onlyDigits(currentSummary?.restantes)
    const restantesLimit = restantesDigits ? Number(restantesDigits) : null
    if (restantesLimit !== null && Number.isFinite(restantesLimit) && restantesLimit <= 0) {
      setConsultaMsg('Sem consultas restantes para este login.')
      notify.warn('Sem consultas restantes para este login.', { autoClose: 2500 })
      return
    }

    const rowsToSend = (restantesLimit !== null && Number.isFinite(restantesLimit))
      ? validData.slice(0, restantesLimit)
      : validData

    if (!rowsToSend.length) {
      setConsultaMsg('Nenhuma linha dentro do limite de consultas restantes.')
      return
    }

    try {
      loteCsvUploadInFlightRef.current = true
      setUploadingBatchFile(true)
      setLoteAutoPollingEnabled(false)
      setConsultaMsg('Enviando arquivo em lote...')

      const csvLines = ['cpf;nome;telefone']
      for (const row of rowsToSend) {
        csvLines.push([
          toCsvCell(row?.cpf || ''),
          toCsvCell(row?.nome || ''),
          toCsvCell(row?.telefone || '')
        ].join(';'))
      }
      const csvContent = `\ufeff${csvLines.join('\r\n')}\r\n`
      const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })

      const formData = new FormData()
      formData.append('file', csvBlob, selectedBatchUpload.fileName)
      formData.append('id_user', String(user.id))
      formData.append('equipe_id', String(equipeId))
      formData.append('id_consulta_presenca', String(currentSummary.idConsultaPresenca))

      const response = await fetch(LOTE_CSV_API_URL, {
        method: 'POST',
        body: formData
      })

      const rawText = await response.text()
      if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

      setSelectedBatchUpload(null)
      if (batchFileInputRef.current) batchFileInputRef.current.value = ''
      if (rowsToSend.length < validData.length) {
        const dropped = validData.length - rowsToSend.length
        setConsultaMsg(`Arquivo carregado: ${rowsToSend.length} linha(s) enviada(s); ${dropped} excedente(s) ignorada(s) pelo limite restante.`)
        notify.info(`${dropped} linha(s) excedente(s) ignorada(s) pelo limite restante.`, { autoClose: 2600 })
      } else {
        setConsultaMsg('Arquivo carregado com sucesso.')
        notify.success('Arquivo carregado com sucesso.', { autoClose: 2000 })
      }
      const hasPending = await fetchLoteGroups(undefined, currentSummary.loginP)
      setLoteAutoPollingEnabled(Boolean(hasPending))
    } catch (err) {
      setConsultaMsg(err?.message || 'Falha ao carregar arquivo.')
      notify.error(err?.message || 'Falha ao carregar arquivo.', { autoClose: 2500 })
    } finally {
      setUploadingBatchFile(false)
      loteCsvUploadInFlightRef.current = false
    }
  }, [batchFileInputRef, currentSummary?.loginP, currentSummary?.restantes, fetchLoteGroups, selectedBatchUpload, uploadingBatchFile, user?.id])

  useEffect(() => {
    const login = summaryRows[selectedLoginIndex]?.loginP
    if (uploadingBatchFile || !user?.id || !login || login === '-') return undefined
    const controller = new AbortController()
    fetchLoteGroups(controller.signal)
    return () => controller.abort()
  }, [fetchLoteGroups, summaryRows, selectedLoginIndex, uploadingBatchFile, user?.id])

  useEffect(() => {
    const login = summaryRows[selectedLoginIndex]?.loginP
    if (uploadingBatchFile || consultaPaused || !loteAutoPollingEnabled || !user?.id || !login || login === '-') return undefined

    let cancelled = false
    const tick = async () => {
      if (cancelled || lotePollInFlightRef.current) return
      lotePollInFlightRef.current = true
      try {
        const hasPending = await fetchLoteGroups(undefined, login)
        if (!hasPending) setLoteAutoPollingEnabled(false)
      } finally {
        lotePollInFlightRef.current = false
      }
    }

    const interval = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [consultaPaused, fetchLoteGroups, loteAutoPollingEnabled, summaryRows, selectedLoginIndex, uploadingBatchFile, user?.id])

  const downloadBatchJobCsv = useCallback(async (job) => {
    if (!user?.id) {
      notify.error('Usuário sem ID.', { autoClose: 2000 })
      return
    }
    if (!currentSummary?.loginP || currentSummary.loginP === '-') {
      notify.error('Selecione um login válido no card Limites API.', { autoClose: 2000 })
      return
    }
    if (!job?.fileName) {
      notify.error('Nome do arquivo não encontrado.', { autoClose: 2000 })
      return
    }

    try {
      const url = `${LOTE_API_URL}?loginP=${encodeURIComponent(currentSummary.loginP)}&id_user=${encodeURIComponent(user.id)}&nomeArquivo=${encodeURIComponent(job.fileName)}`
      const res = await fetch(url, { method: 'GET' })
      const rawText = await res.text()
      if (!res.ok) throw new Error(rawText || `HTTP ${res.status}`)

      let payload = []
      try { payload = rawText ? JSON.parse(rawText) : [] } catch { payload = [] }
      const list = normalizeRows(payload)

      if (!list.length) {
        notify.info('Nenhum registro retornado para esse lote.', { autoClose: 2000 })
        return
      }

      let rowsToExport = list
      const selectedCreated = String(job?.createdAt || job?.created || '').trim()

      if (selectedCreated) {
        const selectedMinute = dateMinuteKey(selectedCreated)
        const byMinute = list.filter((r) => dateMinuteKey(pick(r, ['created_at', 'createdAt'], '')) === selectedMinute)
        if (byMinute.length > 0) rowsToExport = byMinute
      } else {
        // Fallback: escolhe a janela mais recente por minuto.
        const groups = new Map()
        for (const r of list) {
          const tipo = String(pick(r, ['tipoConsulta'], '') || '').trim()
          const createdMin = dateMinuteKey(pick(r, ['created_at', 'createdAt'], ''))
          if (!tipo || !createdMin) continue
          const key = `${tipo}__${createdMin}`
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key).push(r)
        }

        let chosenKey = null
        let chosenTs = -Infinity
        for (const key of groups.keys()) {
          const createdMin = key.split('__').slice(-1)[0]
          const t = new Date(createdMin.replace(' ', 'T')).getTime()
          const ts = Number.isFinite(t) ? t : -Infinity
          if (ts > chosenTs) {
            chosenTs = ts
            chosenKey = key
          }
        }
        if (chosenKey) rowsToExport = groups.get(chosenKey) || list
      }

      if (!rowsToExport.length) {
        notify.info('Nenhum registro encontrado para exportação.', { autoClose: 2200 })
        return
      }
      const exportRows = rowsToExport.map(mapPresencaRowToExportShape)
      const header = PRESENCA_EXPORT_COLUMNS.map((col) => col.header)

      const lines = [header.join(';')]
      for (const r of exportRows) {
        const values = header.map((col) => {
          const rawValue = r?.[col]
          const safeValue = (rawValue && typeof rawValue === 'object')
            ? JSON.stringify(rawValue)
            : toCsvCommaDecimalValue(col, rawValue ?? '')
          return toCsvCell(safeValue)
        })
        lines.push(values.join(';'))
      }

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const safeBase = String(job.fileName || 'lote').replace(/[^\w.\-]+/g, '_')
      const fileName = `lote_${safeBase}_all_${stamp}.csv`

      const content = `\ufeff${lines.join('\r\n')}\r\n`
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      notify.error(err?.message || 'Falha ao baixar lote.', { autoClose: 2500 })
    }
  }, [user?.id, currentSummary?.loginP])

  const askDownloadBatchJobCsv = useCallback((job) => {
    if (!job?.fileName) {
      notify.error('Nome do arquivo não encontrado.', { autoClose: 2000 })
      return
    }
    downloadBatchJobCsv({
      fileName: String(job.fileName),
      createdAt: String(job?.createdAt || ''),
      totalRows: Number(job?.totalRows ?? 0)
    })
  }, [downloadBatchJobCsv])

  const openLotePreview = useCallback((entry) => {
    if (!entry) return

    if (entry?.source === 'job') {
      const job = entry.raw || {}
      const rows = (Array.isArray(job?.validData) ? job.validData : []).map((row, idx) => ({
        id: `${job?.id || 'job'}-${idx}`,
        cpf: normalizeCpfBatch(row?.cpf ?? ''),
        nome: String(row?.nome ?? '').trim(),
        mensagem: '',
        status: 'Pendente',
        data: ''
      }))

      setLotePreviewModal({
        fileName: String(job?.fileName || ''),
        loginP: String(job?.loginP || currentSummary?.loginP || ''),
        totalRows: Number(job?.totalRows ?? rows.length ?? 0),
        previewRows: rows.slice(0, 120),
        previewTotal: rows.length
      })
      return
    }

    const group = entry.raw || {}
    const targetFile = String(group?.file || '').trim().toLowerCase()
    const targetLogin = normalizeLoginKey(group?.loginP || currentSummary?.loginP || '')
    const sourceList = Array.isArray(sourceRowsRef.current) ? sourceRowsRef.current : []
    const filteredRows = sourceList
      .filter((row) => {
        const tipo = String(pick(row, ['tipoConsulta', 'tipo_consulta', 'tipo'], '')).trim().toLowerCase()
        if (tipo === 'individual') return false
        const rowFile = String(pick(row, ['nomeArquivo', 'nome_arquivo', 'tipoConsulta', 'name', 'fileName'], '')).trim().toLowerCase()
        const rowLogin = normalizeLoginKey(pick(row, ['loginP', 'login', 'usuario_login'], ''))
        if (targetFile && rowFile !== targetFile) return false
        if (targetLogin && rowLogin && rowLogin !== targetLogin) return false
        return true
      })

    const byPreviewKey = new Map()
    for (const row of filteredRows) {
      const cpfKey = normalizeCpfBatch(pick(row, ['cpf', 'cliente_cpf', 'documento'], ''))
      const fallbackKey = String(pick(row, ['id', 'ID'], '')).trim()
      const key = cpfKey || `id:${fallbackKey || Math.random()}`
      const prev = byPreviewKey.get(key)
      if (!prev) {
        byPreviewKey.set(key, row)
        continue
      }

      const prevTs = new Date(pick(prev, ['updated_at', 'created_at', 'data'], 0)).getTime()
      const currTs = new Date(pick(row, ['updated_at', 'created_at', 'data'], 0)).getTime()
      const prevStatus = String(pick(prev, ['status', 'final_status', 'situacao', 'status_presenca'], '')).trim()
      const currStatus = String(pick(row, ['status', 'final_status', 'situacao', 'status_presenca'], '')).trim()

      const currIsNewer = (Number.isFinite(currTs) ? currTs : 0) > (Number.isFinite(prevTs) ? prevTs : 0)
      const sameTs = (Number.isFinite(currTs) ? currTs : 0) === (Number.isFinite(prevTs) ? prevTs : 0)
      const preferFinalOverPending = sameTs && isPendingLoteStatus(prevStatus) && !isPendingLoteStatus(currStatus)

      if (currIsNewer || preferFinalOverPending) {
        byPreviewKey.set(key, row)
      }
    }

    const rows = Array.from(byPreviewKey.values())
      .sort((a, b) => new Date(pick(b, ['updated_at', 'created_at', 'data'], 0)).getTime() - new Date(pick(a, ['updated_at', 'created_at', 'data'], 0)).getTime())
      .map((row, idx) => ({
        id: String(pick(row, ['id', 'ID'], idx + 1)),
        cpf: normalizeCpfBatch(pick(row, ['cpf', 'cliente_cpf', 'documento'], '')),
        nome: String(pick(row, ['nome', 'cliente_nome', 'name'], '')).trim(),
        mensagem: String(pick(row, ['mensagem', 'message', 'erro', 'error', 'motivo'], '')).trim(),
        status: String(pick(row, ['status', 'final_status', 'situacao', 'status_presenca'], '-')).trim() || '-',
        data: String(pick(row, ['updated_at', 'created_at', 'data'], '')).trim()
      }))

    setLotePreviewModal({
      fileName: String(group?.file || ''),
      loginP: String(group?.loginP || currentSummary?.loginP || ''),
      totalRows: Number(group?.totalRows ?? group?.total ?? rows.length ?? 0),
      previewRows: rows.slice(0, 120),
      previewTotal: rows.length
    })
  }, [currentSummary?.loginP])

  const askDeleteLoteGroup = useCallback((group) => {
    if (!canDeleteLoteByUser) {
      notify.warn('Somente o usuário Master (ID 1) pode excluir lote.', { autoClose: 2200 })
      return
    }
    const login = String(group?.loginP || currentSummary?.loginP || '').trim()
    if (!login || login === '-') {
      notify.error('Login inválido para exclusão.', { autoClose: 2000 })
      return
    }
    setDeleteLoteModal({
      loginP: login,
      fileName: String(group?.file || '-'),
      idUser: toNumberOrNull(group?.idUser),
      idEquipe: toNumberOrNull(group?.idEquipe),
      idConsultaPresenca: String(currentSummary?.idConsultaPresenca || '').trim(),
      totalRows: Number(group?.totalRows ?? group?.total ?? 0),
      eligibleCount: Number(group?.okByValue || 0),
      notEligibleCount: Number(group?.statusOtherCount ?? group?.error ?? 0)
    })
  }, [canDeleteLoteByUser, currentSummary?.idConsultaPresenca, currentSummary?.loginP])

  const deleteLoteGroup = useCallback(async () => {
    if (!deleteLoteModal) return
    if (!canDeleteLoteByUser) {
      notify.warn('Somente o usuário Master (ID 1) pode excluir lote.', { autoClose: 2200 })
      return
    }
    const requesterUserId = toNumberOrNull(user?.id)
    const login = String(deleteLoteModal?.loginP || currentSummary?.loginP || '').trim()
    const fileName = String(deleteLoteModal?.fileName || '').trim()
    const targetUserId = toNumberOrNull(deleteLoteModal?.idUser)
    const targetEquipeId = toNumberOrNull(deleteLoteModal?.idEquipe)
    const idConsultaPresenca = String(deleteLoteModal?.idConsultaPresenca || currentSummary?.idConsultaPresenca || '').trim()
    if (requesterUserId === null) {
      notify.error('Usuário sem ID.', { autoClose: 2000 })
      return
    }
    if (!login || login === '-') {
      notify.error('Login inválido para exclusão.', { autoClose: 2000 })
      return
    }
    if (!fileName) {
      notify.error('Nome do arquivo inválido para exclusão.', { autoClose: 2000 })
      return
    }
    if (targetUserId === null) {
      notify.error('Lote sem id_user para exclusão.', { autoClose: 2200 })
      return
    }
    if (targetEquipeId === null) {
      notify.error('Lote sem equipe_id para exclusão.', { autoClose: 2200 })
      return
    }
    if (!idConsultaPresenca) {
      notify.error('ID do login (id_consulta_presenca) não identificado.', { autoClose: 2200 })
      return
    }
    try {
      setDeletingLote(true)
      const requestUrl = new URL(PRESENCA_CONSULTAS_DELETE_API_URL, window.location.origin)
      requestUrl.searchParams.set('id_user', String(targetUserId))
      requestUrl.searchParams.set('equipe_id', String(targetEquipeId))
      requestUrl.searchParams.set('id_consulta_presenca', idConsultaPresenca)
      requestUrl.searchParams.set('tipoConsulta', fileName)
      const controller = new AbortController()
      const deleteTimeoutId = setTimeout(() => controller.abort('DELETE_TIMEOUT'), PRESENCA_DELETE_TIMEOUT_MS)
      let response
      try {
        response = await fetch(requestUrl.toString(), {
          method: 'POST',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        })
      } finally {
        clearTimeout(deleteTimeoutId)
      }
      const rawText = await response.text()
      let payload = {}
      try { payload = rawText ? JSON.parse(rawText) : {} } catch { payload = {} }
      if (!response.ok) {
        throw new Error(payload?.message || rawText || `HTTP ${response.status}`)
      }

      const deletedCount = Math.max(0, Number(payload?.deleted_count ?? payload?.deletedCount ?? 0) || 0)
      notify.success(
        deletedCount > 0 ? `Lote removido (${deletedCount} registro${deletedCount === 1 ? '' : 's'}).` : 'Nenhum registro encontrado para remover.',
        { autoClose: 2200 }
      )
      await fetchSummary()
      await fetchLoteGroups(undefined, login)
      setDeleteLoteModal(null)
    } catch (err) {
      const isTimeout = err?.name === 'AbortError' || String(err?.message || '').includes('DELETE_TIMEOUT')
      notify.error(isTimeout ? 'Tempo limite ao excluir lote (backend sem resposta).' : (err?.message || 'Falha ao excluir lotes.'), { autoClose: 3000 })
    } finally {
      setDeletingLote(false)
    }
  }, [canDeleteLoteByUser, currentSummary?.idConsultaPresenca, currentSummary?.loginP, deleteLoteModal, fetchLoteGroups, fetchSummary, user])

  const startBatchJob = useCallback(async (jobId) => {
    setConsultaMsg('')

    if (!currentSummary?.loginP || currentSummary.loginP === '-') {
      setConsultaMsg('Selecione um login válido no card Limites API.')
      return
    }
    if (!currentSummary?.senhaP) {
      setConsultaMsg('Senha do login não encontrada na API de credenciais.')
      return
    }

    const job = batchJobs.find((j) => j.id === jobId)
    if (!job) return
    if (!job.file) {
      setConsultaMsg('Arquivo não disponível para o lote.')
      return
    }

    setBatchJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: 'Processando', progress: 0, okCount: 0, errCount: 0, avgDurationMs: null, finishedAt: null } : j)))
    const formData = new FormData()
    formData.append('file', job.file)
    formData.append('login', currentSummary.loginP)
    formData.append('senha', currentSummary.senhaP)
    formData.append('fileName', job.fileName)
    setConsultaMsg('Lote enviado para o Hostinger...')
    beginBatchPolling(jobId, job)
    fetchLoteGroups(undefined, currentSummary.loginP)
    fetch(PROCESS_CSV_URL, {
      method: 'POST',
      body: formData
    })
      .then((response) => response.json().catch(() => ({})))
      .then((parsed) => {
        const okCount = Number(parsed?.processedOk ?? parsed?.okCount ?? 0)
        const errCount = Number(parsed?.processedError ?? parsed?.erroCount ?? 0)
        const finalStatus = errCount > 0 ? 'Concluído com erros' : 'Concluído'
        setBatchJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: finalStatus, progress: 100, okCount, errCount, finishedAt: new Date().toISOString() } : j)))
        setConsultaMsg(`Lote finalizado: ${okCount} sucesso(s), ${errCount} erro(s).`)
        fetchSummary()
        fetchLoteGroups(undefined, currentSummary.loginP)
      })
      .catch((err) => {
        setBatchJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: 'Erro', finishedAt: new Date().toISOString() } : j)))
        setConsultaMsg(err?.message || 'Falha ao processar lote.')
        stopBatchPolling(jobId)
      })
      .finally(() => {
        setConsultando(false)
      })
  }, [batchJobs, beginBatchPolling, currentSummary, fetchLoteGroups, fetchSummary, stopBatchPolling])

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column text-light">
      <TopNav />

      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <img
                  src="https://portal.presencabank.com.br/assets/images/presencabank/logo.svg"
                  alt="Presença"
                  width="56"
                  height="56"
                  style={{
                    objectFit: 'contain',
                    background: 'transparent',
                    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.28))'
                  }}
                />
                <h2 className="fw-bold mb-0">Consulta Presença</h2>
              </div>
              <div className="small opacity-75">Última atualização: {formatDate(lastSyncAt)}</div>
            </div>
          </div>
          <button type="button" className="btn btn-outline-info btn-sm d-flex align-items-center gap-2" onClick={refresh} disabled={loading || uploadingBatchFile}>
            <FiRefreshCw size={14} />
            <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>

        <section className="mb-3">
          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="opacity-75 small text-uppercase mb-2">Limites API</div>
                <div className="mb-3">
                  <label className="form-label small opacity-75 mb-1">Login</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedLoginIndex}
                    onChange={(e) => {
                      const nextIndex = Number(e.target.value)
                      setSelectedLoginIndex(nextIndex)
                      const nextLoginKey = normalizeLoginKey(summaryRows[nextIndex]?.loginP)
                      selectedLoginKeyRef.current = nextLoginKey
                      const userId = toNumberOrNull(user?.id)
                      if (userId !== null) saveSelectedLoginToStorage(userId, nextLoginKey)
                      fetchSummary()
                    }}
                    disabled={summaryRows.length === 0}
                  >
                    {summaryRows.length === 0 ? (
                      <option value={0}>Sem login</option>
                    ) : (
                      summaryRows.map((item, idx) => (
                        <option key={`${item.loginP}-${idx}`} value={idx}>
                          {maskLogin(item.loginP)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-info btn-sm w-100 mb-3"
                  onClick={openAddLoginModal}
                >
                  Adicionar login
                </button>
                <div className="d-flex flex-column gap-3">
                  <div>
                    <div className="small opacity-75">Total</div>
                    <div className="h4 fw-bold mb-0">{currentSummary.total}</div>
                  </div>
                  <div>
                    <div className="small opacity-75">Usado</div>
                    <div className="h4 fw-bold mb-0">{currentSummary.usado}</div>
                  </div>
                  <div>
                    <div className="small opacity-75">Restantes</div>
                    <div className="h4 fw-bold mb-0">{currentSummary.restantes}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="opacity-75 small mb-2 text-uppercase">Filtros</div>
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label small opacity-75 mb-1">Buscar</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text"><FiSearch size={14} /></span>
                      <input
                        className="form-control"
                        placeholder="Nome, CPF ou equipe"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label small opacity-75 mb-1">De</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small opacity-75 mb-1">Até</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="col-12 d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-info btn-sm d-flex align-items-center gap-2"
                      onClick={downloadFilteredCsv}
                      disabled={loading || filteredRows.length === 0}
                      title="Baixar CSV do que estiver filtrado"
                    >
                      <FiDownload size={14} />
                      <span>CSV</span>
                    </button>
                    <button type="button" className="btn btn-outline-light btn-sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}>
                      Limpar filtros
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                  <div className="opacity-75 small text-uppercase">Consulta</div>
                  <div className="btn-group btn-group-sm" role="group" aria-label="Tipo de consulta">
                    <button
                      type="button"
                      className={`btn ${consultaTab === 'individual' ? 'btn-primary' : 'btn-outline-light'}`}
                      onClick={() => setConsultaTab('individual')}
                      disabled={consultando}
                    >
                      Individual
                    </button>
                    {canAccessBatchMode && (
                      <button
                        type="button"
                        className={`btn ${consultaTab === 'lote' ? 'btn-primary' : 'btn-outline-light'}`}
                        onClick={() => setConsultaTab('lote')}
                        disabled={consultando}
                      >
                        Em lote
                      </button>
                    )}
                  </div>
                </div>

                {consultaTab === 'individual' ? (
                  <form onSubmit={handleConsultarIndividual}>
                    <div className="row g-2">
                      <div className="col-12">
                        <label className="form-label small opacity-75 mb-1">CPF</label>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Somente números"
                          value={cpfConsulta}
                          onChange={(e) => setCpfConsulta(onlyDigits(e.target.value))}
                          maxLength={11}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small opacity-75 mb-1">Telefone</label>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Opcional (gera automático)"
                          value={telefoneConsulta}
                          onChange={(e) => setTelefoneConsulta(onlyDigits(e.target.value))}
                          maxLength={11}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small opacity-75 mb-1">Nome</label>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Nome completo"
                          value={nomeConsulta}
                          onChange={(e) => setNomeConsulta(e.target.value)}
                        />
                      </div>
                      <div className="col-12 d-grid">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={consultando}>
                          {consultando ? 'Consultando...' : 'Consultar'}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div className="row g-2">
                      <div className="col-12">
                        <label className="form-label small opacity-75 mb-1">Arquivo (CSV separado por ;)</label>
                        <input
                          ref={batchFileInputRef}
                          type="file"
                          className="form-control form-control-sm"
                          accept=".csv,text/csv"
                          onChange={handleBatchFileChange}
                          disabled={consultando || uploadingBatchFile}
                        />
                        <div className="small opacity-75 mt-1">
                          Colunas obrigatórias: <span className="fw-semibold">cpf</span>, <span className="fw-semibold">nome</span>, <span className="fw-semibold">telefone</span>.
                          Se <span className="fw-semibold">telefone</span> estiver vazio, será gerado automaticamente.
                        </div>
                        <div className="small opacity-75 mt-1">
                          Depois de selecionar, clique em <span className="fw-semibold">Carregar arquivo</span> para enviar ao lote.
                        </div>
                        {selectedBatchUpload && (
                          <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={uploadBatchFile}
                              disabled={consultando || uploadingBatchFile}
                            >
                              {uploadingBatchFile ? 'Carregando...' : 'Carregar arquivo'}
                            </button>
                            <span className="small opacity-75">
                              {selectedBatchUpload.fileName} | {selectedBatchUpload.totalRows} linha(s)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {consultaMsg && (
                  <div className="small mt-2 opacity-75">{consultaMsg}</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {consultaTab === 'individual' ? (
          <section className="neo-card neo-lg p-0">
            {!loading && !error && filteredRows.length > 0 && (
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
                <div className="small opacity-75">Exibindo {startIndex}-{endIndex} de {filteredRows.length}</div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    {'\u2039'}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${currentPage === 1 ? 'btn-primary' : 'btn-outline-light'}`}
                    onClick={() => setPage(1)}
                  >
                    1
                  </button>
                  {currentPage > 3 && <span className="opacity-50">...</span>}
                  {Array.from({ length: 5 }, (_, i) => currentPage - 2 + i)
                    .filter((p) => p > 1 && p < pages)
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-outline-light'}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                  {currentPage < pages - 2 && <span className="opacity-50">...</span>}
                  {pages > 1 && (
                    <button
                      type="button"
                      className={`btn btn-sm ${currentPage === pages ? 'btn-primary' : 'btn-outline-light'}`}
                      onClick={() => setPage(pages)}
                    >
                      {pages}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={currentPage === pages}
                  >
                    {'\u203A'}
                  </button>
                </div>
              </div>
            )}
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
                <thead>
                  <tr>
                    <th>CPF</th>
                    <th>Nome</th>
                    <th>Data de atualização</th>
                    <th>Status</th>
                    <th>Elegível</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Carregando registros...
                      </td>
                    </tr>
                  )}
                  {!loading && error && (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-danger">{error}</td>
                    </tr>
                  )}
                  {!loading && !error && filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 opacity-75">Sem clientes consultados.</td>
                    </tr>
                  ) : (
                    !loading && !error && pagedRows.map((row) => (
                      <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => openConsultaResultModalFromSource(row?.raw || row)}>
                        <td>
                          {(() => {
                            const cpfDigits = onlyDigits(row.cpf)
                            return cpfDigits ? (
                              <button
                                type="button"
                                className="btn btn-link p-0 text-reset"
                                title="Copiar CPF"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(cpfDigits, 'CPF copiado!')
                                }}
                              >
                                {formatCpf(cpfDigits)}
                              </button>
                            ) : (
                              formatCpf(row.cpf)
                            )
                          })()}
                        </td>
                        <td>
                          {row?.nome ? (
                            <button
                              type="button"
                              className="btn btn-link p-0 text-reset text-start"
                              title="Copiar Nome"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(row.nome, 'Nome copiado!')
                              }}
                            >
                              {row.nome}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{formatDate(row.data)}</td>
                        <td>
                          <span className={`badge ${statusClassName(row?.status)}`}>
                            {row?.status || '-'}
                          </span>
                        </td>
                        <td>
                          {row.elegivel === null ? (
                            <span className="badge text-bg-secondary">-</span>
                          ) : (
                            <span className={`badge ${row.elegivel ? 'text-bg-success' : 'text-bg-danger'}`}>
                              {row.elegivel ? 'Sim' : 'Não'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="neo-card neo-lg p-0">
            {loteSourceRows.length > 0 && (
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
                <div className="small opacity-75">Exibindo {loteStartIndex}-{loteEndIndex} de {loteSourceRows.length}</div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => setLotePage((p) => Math.max(1, p - 1))}
                    disabled={currentLotePage === 1}
                  >
                    {'\u2039'}
                  </button>
                  <span className="small opacity-75 px-1">{currentLotePage}/{lotePages}</span>
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => setLotePage((p) => Math.min(lotePages, p + 1))}
                    disabled={currentLotePage === lotePages}
                  >
                    {'\u203A'}
                  </button>
                </div>
              </div>
            )}
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
                <thead>
                  <tr>
                    <th>Nome do arquivo</th>
                    <th>Quantidade de nomes</th>
                    <th>Resultado</th>
                    <th>Tempo Estimado</th>
                    <th>Status</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loteSourceRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 opacity-75">Nenhum lote carregado.</td>
                    </tr>
                  ) : (
                    pagedLoteRows.map((entry) => {
                      if (entry?.source === 'job') {
                        const job = entry.raw || {}
                        const rawStatusTxt = String(job.status || 'Pronto')

                        const canDownload = (job?.validRows?.length ?? 0) > 0
                        const qty = Number(job?.totalRows ?? 0)
                        const okCount = Math.max(0, Number(job?.okCount ?? 0) || 0)
                        const errCount = Math.max(0, Number(job?.errCount ?? 0) || 0)
                        const pendingCount = rawStatusTxt === 'Processando'
                          ? Math.max(0, qty - okCount - errCount)
                          : 0
                        const statusTxt = pendingCount > 0 || rawStatusTxt === 'Processando'
                          ? 'Processando'
                          : 'Concluído'
                        const cls = batchStatusClassName(statusTxt)
                        const canRun = !consultando && rawStatusTxt !== 'Processando'
                        const canDelete = rawStatusTxt !== 'Processando'

                        return (
                          <tr key={String(entry?.key ?? job.id)}>
                            <td className="text-wrap">
                              <div className="fw-semibold">{job.fileName}</div>
                              <div className="small opacity-75">{job?.createdAt ? formatDate(job.createdAt) : '-'}</div>
                            </td>
                            <td title={`${job.validRows?.length ?? 0} válido(s), ${job.invalidRows?.length ?? 0} inválido(s)`}>
                              {qty}
                            </td>
                            <td>
                              <div className="d-inline-flex align-items-center gap-2 flex-nowrap" style={{ whiteSpace: 'nowrap' }}>
                                <span className="badge text-bg-warning d-inline-flex align-items-center gap-1" title="Pendente">
                                  <FiClock size={12} />
                                  <span>{pendingCount}</span>
                                </span>
                                <span className="badge text-bg-success d-inline-flex align-items-center gap-1" title="Elegível">
                                  <FiCheckCircle size={12} />
                                  <span>{okCount}</span>
                                </span>
                                <span className="badge text-bg-danger d-inline-flex align-items-center gap-1" title="Não elegível">
                                  <FiAlertCircle size={12} />
                                  <span>{errCount}</span>
                                </span>
                              </div>
                            </td>
                            <td>{formatAvgDuration(job?.avgDurationMs)}</td>
                            <td>
                              <span className={`badge ${cls}`}>
                                {statusTxt}{rawStatusTxt === 'Processando' ? ` (${job.progress ?? 0}%)` : ''}
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="d-inline-flex align-items-center gap-2">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm btn-icon btn-ghost-info"
                                  title="Vizualizar"
                                  aria-label="Vizualizar"
                                  onClick={() => openLotePreview(entry)}
                                >
                                  <FiFileText />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm btn-icon btn-ghost-info"
                                  title="Baixar"
                                  aria-label="Baixar"
                                  onClick={() => askDownloadBatchJobCsv({ fileName: job.fileName, createdAt: job.createdAt, totalRows: qty })}
                                  disabled={!canDownload}
                                >
                                  <FiDownload />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm btn-icon btn-ghost-danger"
                                  title={canDeleteLoteByUser ? 'Excluir' : 'Disponível apenas para usuário Master (ID 1)'}
                                  aria-label="Excluir"
                                  onClick={() => deleteBatchJob(job.id)}
                                  disabled={!canDelete || !canDeleteLoteByUser}
                                >
                                  <FiTrash2 />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      }

                      const group = entry.raw || {}
                      const hasPending = Number(group?.pending ?? 0) > 0
                      const statusGroupTxt = hasPending
                        ? 'Processando'
                        : 'Concluído'
                      const cls = batchStatusClassName(statusGroupTxt)
                      const qty = Number(group?.total ?? 0)
                      const pendingCount = Math.max(0, Number(group?.pending ?? 0) || 0)
                      const successCount = Math.max(0, Number(group?.okByValue ?? 0) || 0)
                      const errorCount = Math.max(0, Number(group?.statusOtherCount ?? group?.error ?? 0) || 0)
                      return (
                        <tr key={String(entry?.key ?? group?.id ?? `${group.file}-${group.created}`)}>
                          <td className="text-wrap">
                            <div>{group.file}</div>
                            <div className="small opacity-75">{formatDate(group.created)}</div>
                          </td>
                          <td>
                            {qty}
                          </td>
                          <td>
                            <div className="d-inline-flex align-items-center gap-2 flex-nowrap" style={{ whiteSpace: 'nowrap' }}>
                              <span className="badge text-bg-warning d-inline-flex align-items-center gap-1" title="Pendente">
                                <FiClock size={12} />
                                <span>{pendingCount}</span>
                              </span>
                              <span className="badge text-bg-success d-inline-flex align-items-center gap-1" title="Elegível">
                                <FiCheckCircle size={12} />
                                <span>{successCount}</span>
                              </span>
                              <span className="badge text-bg-danger d-inline-flex align-items-center gap-1" title="Não elegível/erro">
                                <FiAlertCircle size={12} />
                                <span>{errorCount}</span>
                              </span>
                            </div>
                          </td>
                          <td>{formatAvgDuration(group?.avgDurationMs)}</td>
                          <td>
                            <span className={`badge ${cls}`}>
                              {statusGroupTxt}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="d-inline-flex align-items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon btn-ghost-info"
                                title="Vizualizar"
                                aria-label="Vizualizar"
                                onClick={() => openLotePreview(entry)}
                              >
                                <FiFileText />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon btn-ghost-info"
                                title="Baixar"
                                aria-label="Baixar"
                                onClick={() => askDownloadBatchJobCsv({ fileName: group.file, createdAt: group.created, totalRows: qty })}
                              >
                                <FiDownload />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon btn-ghost-danger"
                                title={canDeleteLoteByUser ? 'Excluir' : 'Disponível apenas para usuário Master (ID 1)'}
                                aria-label="Excluir"
                                onClick={() => askDeleteLoteGroup(group)}
                                disabled={!canDeleteLoteByUser}
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {uploadingBatchFile && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 1069 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 'min(92vw, 520px)' }}>
            <div className="modal-content modal-dark">
              <div className="modal-body text-center py-4">
                <div className="spinner-border text-info mb-3" role="status" aria-hidden="true"></div>
                <div className="fw-semibold">Aguarde o envio completo do arquivo</div>
                <div className="small opacity-75 mt-1">Processando upload em lote...</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {consultaResultModal && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1065 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setConsultaResultModal(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            style={{ maxWidth: 'min(96vw, 1200px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <h5 className="modal-title">Resultado da Consulta Individual</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setConsultaResultModal(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-4">
                    <div className="small opacity-75">CPF</div>
                    <div className="fw-semibold">{formatCpf(consultaResultModal.cpf)}</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="small opacity-75">Nome</div>
                    <div className="fw-semibold text-break">{consultaResultModal.nome || '-'}</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="small opacity-75">Telefone</div>
                    <div className="fw-semibold">{formatPhone(consultaResultModal.telefone)}</div>
                    <div className="small opacity-75">{consultaResultModal.phoneOrigin}</div>
                  </div>
                  <div className="col-12">
                    {consultaResultModal.finalMessage && !consultaResultModal.errorMessage && (
                      <>
                        <div className="small opacity-75">Mensagem</div>
                        <div className="fw-semibold small">{consultaResultModal.finalMessage}</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="neo-card p-3 mb-3">
                  <div className="small opacity-75 mb-2">Vínculo</div>
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <div className="small opacity-75">Matrícula</div>
                      <div className="fw-semibold">{consultaResultModal?.vinculo?.matricula || '-'}</div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="small opacity-75">Número Inscrição Empregador</div>
                      <div className="fw-semibold">{consultaResultModal?.vinculo?.numeroInscricaoEmpregador || '-'}</div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="small opacity-75">Elegível</div>
                      <div className="fw-semibold">
                        {(() => {
                          const elegivel = parseNullableBoolean(consultaResultModal?.vinculo?.elegivel)
                          if (elegivel === null) return <span className="badge text-bg-secondary">-</span>
                          return (
                            <span className={`badge ${elegivel ? 'text-bg-success' : 'text-bg-danger'}`}>
                              {elegivel ? 'Sim' : 'Não'}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="neo-card p-3 mb-3">
                  <div className="small opacity-75 mb-2">Margem</div>
                  <div className="row g-2">
                    <div className="col-12 col-md-3"><div className="small opacity-75">Valor Margem Disponível</div><div className="fw-semibold">{formatCurrency(consultaResultModal?.margemData?.valorMargemDisponivel)}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Valor Margem Base</div><div className="fw-semibold">{formatCurrency(consultaResultModal?.margemData?.valorMargemBase)}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Valor Total Devido</div><div className="fw-semibold">{formatCurrency(consultaResultModal?.margemData?.valorTotalDevido)}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Registro Empregatício</div><div className="fw-semibold">{consultaResultModal?.margemData?.registroEmpregaticio || '-'}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">CNPJ Empregador</div><div className="fw-semibold">{consultaResultModal?.margemData?.cnpjEmpregador || '-'}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Data Admissão</div><div className="fw-semibold">{formatDate(consultaResultModal?.margemData?.dataAdmissao)}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Sexo</div><div className="fw-semibold">{consultaResultModal?.margemData?.sexo || '-'}</div></div>
                    <div className="col-12"><div className="small opacity-75">Nome Mãe</div><div className="fw-semibold text-break">{consultaResultModal?.margemData?.nomeMae || '-'}</div></div>
                  </div>
                </div>

                <div className="neo-card p-3">
                  <div className="small opacity-75 mb-2">Tabelas Disponíveis</div>
                  <div className="table-responsive">
                    <table className="table table-dark table-hover align-middle mb-0 table-lookup">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nome</th>
                          <th>Prazo</th>
                          <th>Taxa Juros</th>
                          <th>Valor Liberado</th>
                          <th>Valor Parcela</th>
                          <th>Tipo Crédito</th>
                          <th>Taxa Seguro</th>
                          <th>Valor Seguro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTabelasBody.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-3 opacity-75">Nenhuma tabela retornada.</td>
                          </tr>
                        ) : (
                          sortedTabelasBody.map((item, idx) => (
                            <tr key={item?.id ?? idx}>
                              <td>{item?.id ?? '-'}</td>
                              <td className="text-wrap">{item?.nome || '-'}</td>
                              <td>{item?.prazo ?? '-'}</td>
                              <td>{item?.taxaJuros ?? '-'}</td>
                              <td>{formatCurrency(item?.valorLiberado)}</td>
                              <td>{formatCurrency(item?.valorParcela)}</td>
                              <td>{item?.tipoCredito?.name || '-'}</td>
                              <td>{item?.taxaSeguro ?? '-'}</td>
                              <td>{formatCurrency(item?.valorSeguro)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {consultaResultModal.errorMessage && (
                  <div className="neo-card p-3 mt-3 border border-danger-subtle">
                    <div className="small text-danger fw-semibold mb-2">Mensagem de erro</div>
                    <div className="small text-break">{consultaResultModal.errorMessage}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddLoginModal && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1067 }}
          role="dialog"
          aria-modal="true"
          onClick={() => { if (!savingNovoLogin) setShowAddLoginModal(false) }}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: 'min(92vw, 520px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <form onSubmit={handleNovoLoginSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title">Adicionar login</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    disabled={savingNovoLogin}
                    onClick={() => setShowAddLoginModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small opacity-75 mb-1">Login</label>
                    <input
                      type="text"
                      className="form-control"
                      value={novoLogin}
                      onChange={(e) => setNovoLogin(e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label small opacity-75 mb-1">Senha</label>
                    <input
                      type="text"
                      className="form-control"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-light"
                    disabled={savingNovoLogin}
                    onClick={() => setShowAddLoginModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-info"
                    disabled={savingNovoLogin}
                  >
                    {savingNovoLogin ? 'Enviando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {lotePreviewModal && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1068 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setLotePreviewModal(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            style={{ maxWidth: 'min(96vw, 1200px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <h5 className="modal-title">Vizualizar lote</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setLotePreviewModal(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-8">
                    <div className="small opacity-75">Arquivo</div>
                    <div className="fw-semibold text-break">{lotePreviewModal.fileName || '-'}</div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div className="small opacity-75">Linhas</div>
                    <div className="fw-semibold">{Number(lotePreviewModal.totalRows || 0)}</div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div className="small opacity-75">Prévia</div>
                    <div className="fw-semibold">{Number(lotePreviewModal.previewRows?.length || 0)} / {Number(lotePreviewModal.previewTotal || 0)}</div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
                    <thead>
                      <tr>
                        <th>CPF</th>
                        <th>Nome</th>
                        <th>Mensagem</th>
                        <th>Status</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(lotePreviewModal.previewRows) ? lotePreviewModal.previewRows : []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-4 opacity-75">Nenhuma linha para visualizar.</td>
                        </tr>
                      ) : (
                        lotePreviewModal.previewRows.map((row, idx) => (
                          <tr key={String(row?.id ?? idx)}>
                            <td>{formatCpf(row?.cpf)}</td>
                            <td className="text-wrap">{row?.nome || '-'}</td>
                            <td className="text-wrap" style={{ whiteSpace: 'normal', minWidth: 280 }}>
                              {row?.mensagem || '-'}
                            </td>
                            <td>
                              <span className={`badge ${statusClassName(row?.status)}`}>{row?.status || '-'}</span>
                            </td>
                            <td>{formatDate(row?.data)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  onClick={() => setLotePreviewModal(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteLoteModal && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1068 }}
          role="dialog"
          aria-modal="true"
          onClick={() => { if (!deletingLote) setDeleteLoteModal(null) }}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: 'min(92vw, 560px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <h5 className="modal-title">Confirmar exclusão do lote</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  disabled={deletingLote}
                  onClick={() => setDeleteLoteModal(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p className="mb-2">Você está prestes a excluir os lotes desse login.</p>
                <div className="small opacity-75 mb-1">Arquivo</div>
                <div className="mb-3">{deleteLoteModal.fileName || '-'}</div>
                <div className="small opacity-75 mb-1">Quantidade de linhas</div>
                <div className="mb-3">{Number(deleteLoteModal.totalRows || 0)}</div>
                <div className="small opacity-75 mb-1">Resultado</div>
                <div className="d-flex flex-wrap gap-2">
                  <span
                    className="badge text-bg-success"
                    title={`Elegível: ${Number(deleteLoteModal.eligibleCount || 0)}`}
                    aria-label={`Elegível: ${Number(deleteLoteModal.eligibleCount || 0)}`}
                  >
                    {Number(deleteLoteModal.eligibleCount || 0)}
                  </span>
                  <span
                    className="badge text-bg-danger"
                    title={`Fora de Pendente/Concluído: ${Number(deleteLoteModal.notEligibleCount || 0)}`}
                    aria-label={`Fora de Pendente/Concluído: ${Number(deleteLoteModal.notEligibleCount || 0)}`}
                  >
                    {Number(deleteLoteModal.notEligibleCount || 0)}
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={deletingLote}
                  onClick={() => setDeleteLoteModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deletingLote}
                  onClick={deleteLoteGroup}
                >
                  {deletingLote ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {consultando && (
        <div className="global-loader-overlay" role="status" aria-live="polite">
          <div className="d-flex flex-column align-items-center gap-2 text-light">
            <div className="spinner-border" role="status" aria-hidden="true"></div>
            <div className="small">Aguardando consulta...</div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

