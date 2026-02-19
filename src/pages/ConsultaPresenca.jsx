import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiDownload, FiPlay, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'

const PRESENCA_API_BASE = import.meta.env.DEV ? '/api/presenca' : 'http://85.31.61.242:3011'
const CRED_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank/'
const HIST_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-historico/'
const LOTE_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-lote/'
const INDIVIDUAL_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-individual/'
const INDIVIDUAL_RESPONSE_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-individual-resposta/'
const LOTE_CSV_API_URL = 'https://n8n.apivieiracred.store/webhook-test/api/presencabank-lotecsv/'
const LOTE_DELETE_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-lote-delete/'
const PROCESS_CSV_URL = `${PRESENCA_API_BASE}/api/process/csv`

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

const formatCpf = (value) => {
  const cpf = onlyDigits(value)
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

const getRowDurationMs = (row) => {
  const createdRaw = row?.created_at || row?.createdAt || row?.data || ''
  const updatedRaw = row?.updated_at || row?.updatedAt || ''
  if (!createdRaw || !updatedRaw) return null

  const created = new Date(createdRaw).getTime()
  const updated = new Date(updatedRaw).getTime()
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return null

  const diff = updated - created
  if (diff < 0) return null
  return diff
}

const formatAvgDuration = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`

  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (totalMinutes < 60) return `${totalMinutes}m ${String(seconds).padStart(2, '0')}s`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
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
  const map = new Map()
  for (const row of rows || []) {
    const file = String(row?.tipoConsulta || row?.name || '').trim()
    const created = String(row?.created_at || row?.createdAt || '').trim()
    const loginP = String(row?.loginP || row?.login || '').trim()
    const createdKey = dateMinuteKey(created)
    if (!file || !createdKey) continue
    const key = `${file.toLowerCase()}--${createdKey}`
    const status = String(row?.status ?? 'Pendente')
    const entry = map.get(key) || {
      file,
      created,
      loginP,
      total: 0,
      pending: 0,
      success: 0,
      error: 0,
      okByValue: 0,
      noValue: 0,
      durationMsTotal: 0,
      durationCount: 0
    }
    if (!entry.loginP && loginP) entry.loginP = loginP
    entry.total += 1
    const normalized = status.toLowerCase()
    if (normalized.includes('pendente')) entry.pending += 1
    else if (normalized.includes('erro') || normalized.includes('falha')) entry.error += 1
    else entry.success += 1

    const valorLiberado = parseMoneyValue(row?.valorLiberado ?? row?.valor_liberado ?? row?.valor ?? 0)
    if (valorLiberado > 0) entry.okByValue += 1
    else entry.noValue += 1

    const durationMs = getRowDurationMs(row)
    if (durationMs !== null) {
      entry.durationMsTotal += durationMs
      entry.durationCount += 1
    }
    map.set(key, entry)
  }
  return Array.from(map.values()).map((entry) => ({
    ...entry,
    avgDurationMs: entry.durationCount > 0 ? (entry.durationMsTotal / entry.durationCount) : null
  }))
}

const toCsvCell = (value) => {
  const s = String(value ?? '')
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

const normalizeBatchRow = (obj, index1Based) => {
  const cpf = onlyDigits(obj?.cpf ?? obj?.CPF ?? obj?.Cpf ?? '')
  const nome = String(obj?.nome ?? obj?.Nome ?? obj?.NOME ?? '').trim()
  const telefoneRaw = onlyDigits(obj?.telefone ?? obj?.Telefone ?? obj?.TELEFONE ?? '')

  if (cpf.length !== 11) return { ok: false, idx: index1Based, error: 'CPF inválido (precisa ter 11 dígitos).' }
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
  if (token === 'presente') return 'text-bg-success'
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

const isDoneIndividualStatus = (status) => {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'concluido' || s === 'concluído'
}

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (payload && typeof payload === 'object') return [payload]
  return []
}

const pick = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

const mapRow = (row, idx) => ({
  id: pick(row, ['id', 'ID', 'id_presenca', 'presenca_id'], idx + 1),
  nome: pick(row, ['nome', 'name', 'cliente_nome', 'usuario_nome', 'nome_cliente', 'nome_cliente_consulta', 'loginP'], '-'),
  cpf: pick(row, ['cpf', 'cliente_cpf', 'numero_documento', 'documento'], ''),
  equipe: pick(row, ['equipe', 'equipe_nome', 'team_name', 'nome_equipe', 'id_user', 'loginP'], '-'),
  data: pick(row, ['updated_at', 'data', 'created_at', 'data_hora', 'data_hora_registro', 'timestamp', 'createdAt'], ''),
  dataNascimento: pick(row, ['dataNascimento', 'data_nascimento', 'nascimento'], ''),
  elegivel: parseBoolean(pick(row, ['elegivel', 'isElegivel'], false)),
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

const mapTabelaFromFlat = (row) => {
  const src = row || {}
  const nome = pick(src, ['nomeTipo', 'nome', 'tipo_nome'], '')
  const prazo = pick(src, ['prazo'], '')
  const valorLiberado = pick(src, ['valorLiberado'], '')
  const valorParcela = pick(src, ['valorParcela'], '')
  const taxaJuros = pick(src, ['taxaJuros'], '')
  const taxaSeguro = pick(src, ['taxaSeguro'], '')
  const valorSeguro = pick(src, ['valorSeguro'], '')
  const id = pick(src, ['idTipo', 'id'], null)

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

export default function ConsultaPresenca() {
  const { user } = useAuth()
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
  const lotePollInFlightRef = useRef(false)
  const loteSawPendingRef = useRef(false)
  const loteCsvUploadInFlightRef = useRef(false)
  const [loteAutoPollingEnabled, setLoteAutoPollingEnabled] = useState(false)
  const batchFileInputRef = useRef(null)
  const [selectedBatchUpload, setSelectedBatchUpload] = useState(null)
  const [uploadingBatchFile, setUploadingBatchFile] = useState(false)
  const [deleteLoteModal, setDeleteLoteModal] = useState(null)
  const [deletingLote, setDeletingLote] = useState(false)
  const [consultaMsg, setConsultaMsg] = useState('')
  const [consultando, setConsultando] = useState(false)
  const [consultaResultModal, setConsultaResultModal] = useState(null)

  const fetchHistoricoRows = useCallback(async (loginP, signal) => {
    const userId = user?.id
    if (!userId || !loginP) {
      setRows([])
      return
    }

    setLoading(true)
    setError('')
    try {
      const url = `${HIST_API_URL}?loginP=${encodeURIComponent(loginP)}&id_user=${encodeURIComponent(userId)}`
      const response = await fetch(url, { method: 'GET', signal })
      const rawText = await response.text()
      if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

      let payload = null
      try {
        payload = rawText ? JSON.parse(rawText) : []
      } catch {
        throw new Error('Resposta da API de histórico inválida.')
      }

      const sourceRows = normalizeRows(payload)
      const normalized = sourceRows.map(mapRow)
      setRows(normalized)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setRows([])
      setError(err?.message || 'Falha ao carregar histórico de consultas.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [user?.id])

  const fetchLoteRows = useCallback(async ({ loginP, nomeArquivo, signal } = {}) => {
    const userId = user?.id
    const login = String(loginP ?? '').trim()
    if (!userId || !login || login === '-') return []

    const params = new URLSearchParams()
    params.set('loginP', login)
    params.set('id_user', String(userId))
    if (nomeArquivo) params.set('nomeArquivo', String(nomeArquivo))

    const url = `${LOTE_API_URL}?${params.toString()}`
    const response = await fetch(url, { method: 'GET', signal })
    if (!response.ok) return []

    const payload = await response.json().catch(() => [])
    return Array.isArray(payload) ? payload : (Array.isArray(payload?.rows) ? payload.rows : [])
  }, [user?.id])

  const fetchSummary = useCallback(async (signal) => {
    const userId = user?.id
    if (!userId) {
      setRows([])
      setSummaryRows([])
      setLoteGroups([])
      loteSawPendingRef.current = false
      setLoteAutoPollingEnabled(false)
      setSelectedLoginIndex(0)
      setError('Usuário sem ID para consulta.')
      return
    }

    setError('')
    try {
      const url = `${CRED_API_URL}?login_id=${encodeURIComponent(userId)}`
      const response = await fetch(url, { method: 'GET', signal })
      const rawText = await response.text()
      if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

      let payload = null
      try {
        payload = rawText ? JSON.parse(rawText) : []
      } catch {
        throw new Error('Resposta da API inválida.')
      }

      const sourceRows = normalizeRows(payload)
      const summaries = sourceRows.map((row) => ({
        loginP: pick(row, ['loginP', 'login', 'usuario_login'], '-'),
        senhaP: pick(row, ['senhaP', 'senha', 'password'], ''),
        total: pick(row, ['total'], '-'),
        usado: pick(row, ['usado'], '-'),
        restantes: pick(row, ['restantes'], '-')
      }))
      setSummaryRows(summaries)
      setSelectedLoginIndex(0)
      const firstLogin = summaries[0]?.loginP
      if (firstLogin && firstLogin !== '-' && !uploadingBatchFile) {
        const loteRows = await fetchLoteRows({ loginP: firstLogin, signal })
        const grouped = groupLoteRows(loteRows)
        setLoteGroups(grouped)
        const hasPending = loteRows.some((row) => !isDoneLoteStatus(row?.status))
        loteSawPendingRef.current = hasPending
        setLoteAutoPollingEnabled(hasPending)
      } else if (!uploadingBatchFile) {
        setLoteGroups([])
        loteSawPendingRef.current = false
        setLoteAutoPollingEnabled(false)
      }

      const updatedCandidates = sourceRows
        .map((row) => pick(row, ['updated_at', 'updatedAt', 'data_update', 'updated'], ''))
        .filter(Boolean)
      const latestUpdated = updatedCandidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
      setLastSyncAt(latestUpdated)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setRows([])
      setSummaryRows([])
      setLoteGroups([])
      loteSawPendingRef.current = false
      setLoteAutoPollingEnabled(false)
      setSelectedLoginIndex(0)
      setError(err?.message || 'Falha ao carregar consulta de presença.')
    }
  }, [fetchLoteRows, uploadingBatchFile, user?.id])

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

  const filteredRowsForExport = useMemo(() => {
    const term = search.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null
    const base = rows.filter((row) => {
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
  }, [rows, search, dateFrom, dateTo])

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

  const currentSummary = summaryRows[selectedLoginIndex] || { loginP: '-', senhaP: '', total: '-', usado: '-', restantes: '-' }
  const pageSize = 50
  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pages)
  const startIndex = filteredRows.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1
  const endIndex = Math.min(filteredRows.length, currentPage * pageSize)
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage])
  const loteSourceRows = batchJobs.length > 0 ? batchJobs : loteGroups
  const lotePageSize = 10
  const lotePages = Math.max(1, Math.ceil(loteSourceRows.length / lotePageSize))
  const currentLotePage = Math.min(lotePage, lotePages)
  const loteStartIndex = loteSourceRows.length === 0 ? 0 : ((currentLotePage - 1) * lotePageSize) + 1
  const loteEndIndex = Math.min(loteSourceRows.length, currentLotePage * lotePageSize)
  const pagedBatchJobs = useMemo(() => {
    const start = (currentLotePage - 1) * lotePageSize
    return batchJobs.slice(start, start + lotePageSize)
  }, [batchJobs, currentLotePage])
  const pagedLoteGroups = useMemo(() => {
    const start = (currentLotePage - 1) * lotePageSize
    return loteGroups.slice(start, start + lotePageSize)
  }, [loteGroups, currentLotePage])
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
    if (consultaTab !== 'lote') return
    setLotePage(1)
  }, [consultaTab, selectedLoginIndex])

  const refresh = () => {
    fetchSummary()
  }

  const downloadFilteredCsv = useCallback(() => {
    if (!filteredRowsForExport.length) {
      notify.info('Nenhum registro para baixar.', { autoClose: 2000 })
      return
    }

    const exportRows = filteredRowsForExport.map((row) => {
      const raw = row?.raw
      return (raw && typeof raw === 'object') ? raw : row
    })

    const header = []
    const seenHeader = new Set()
    for (const row of exportRows) {
      for (const key of Object.keys(row || {})) {
        const norm = String(key || '').trim().toLowerCase()
        if (!norm || norm === 'loginp' || seenHeader.has(norm)) continue
        seenHeader.add(norm)
        header.push(key)
      }
    }

    if (header.length === 0) {
      notify.info('Nenhuma coluna disponível para exportação.', { autoClose: 2000 })
      return
    }

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

    setConsultaResultModal({
      cpf: cpfBase,
      nome: nomeBase,
      telefone: telefoneBase,
      phoneOrigin: pick(resultData, ['phoneOrigin', 'phone_origin'], phoneOriginFallback),
      vinculo: resultData?.vinculo || payload?.vinculo || {
        matricula: pick(payload, ['matricula'], ''),
        numeroInscricaoEmpregador: pick(payload, ['numeroInscricaoEmpregador'], ''),
        elegivel: parseBoolean(pick(payload, ['elegivel'], false))
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
      finalMessage: pick(resultData, ['final_message'], pick(payload, ['error', 'message'], ''))
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
      setConsultaMsg('Selecione um login válido no card Resumo.')
      return
    }
    if (!user?.id) {
      setConsultaMsg('Usuário sem ID para consulta.')
      return
    }

    const payload = {
      loginP: currentSummary.loginP,
      id_user: user.id,
      cpf: cpfDigits,
      telefone: phoneDigits,
      nome
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

      setConsultaMsg('Consulta enviada com sucesso. Aguardando retorno...')

      const query = new URLSearchParams({
        loginP: String(currentSummary.loginP),
        id_user: String(user.id),
        cpf: String(cpfDigits),
        telefone: String(phoneDigits),
        nome: String(nome)
      })

      let completedPayload = null
      while (!completedPayload) {
        const pollResp = await fetch(`${INDIVIDUAL_RESPONSE_API_URL}?${query.toString()}`, { method: 'GET' })
        const pollRaw = await pollResp.text()
        if (!pollResp.ok) throw new Error(pollRaw || `HTTP ${pollResp.status}`)

        let pollPayload = pollRaw
        try {
          pollPayload = pollRaw ? JSON.parse(pollRaw) : []
        } catch {
          pollPayload = pollRaw || []
        }

        const sourceRows = normalizeRows(pollPayload)
        const expectedCpf = onlyDigits(cpfDigits)
        const expectedTel = onlyDigits(phoneDigits)
        const expectedNome = String(nome).trim().toLowerCase()

        const matchedRows = sourceRows.filter((row) => {
          const rowCpf = onlyDigits(pick(row, ['cpf'], ''))
          const rowTel = onlyDigits(pick(row, ['telefone'], ''))
          const rowNome = String(pick(row, ['nome'], '')).trim().toLowerCase()
          const rowLogin = String(pick(row, ['loginP', 'login'], '')).trim()
          const rowUser = String(pick(row, ['id_user', 'idUser', 'user_id'], '')).trim()
          const byCpf = !expectedCpf || !rowCpf || rowCpf === expectedCpf
          const byTel = !expectedTel || !rowTel || rowTel === expectedTel
          const byNome = !expectedNome || !rowNome || rowNome === expectedNome
          const byLogin = !currentSummary.loginP || !rowLogin || rowLogin === String(currentSummary.loginP)
          const byUser = !user?.id || !rowUser || rowUser === String(user.id)
          return byCpf && byTel && byNome && byLogin && byUser
        })

        const rowsToCheck = matchedRows.length ? matchedRows : sourceRows
        const doneRow = rowsToCheck.find((row) => {
          const status = pick(row, ['status', 'final_status', 'situacao', 'status_presenca'], '')
          return isDoneIndividualStatus(status)
        })

        if (doneRow) {
          const doneCreatedKey = dateMinuteKey(pick(doneRow, ['created_at', 'createdAt'], ''))
          const doneCpf = onlyDigits(pick(doneRow, ['cpf'], ''))
          const doneTel = onlyDigits(pick(doneRow, ['telefone'], ''))
          const doneNome = String(pick(doneRow, ['nome'], '')).trim().toLowerCase()
          const doneLogin = String(pick(doneRow, ['loginP', 'login'], '')).trim()

          const relatedRows = rowsToCheck.filter((row) => {
            const rowStatus = pick(row, ['status', 'final_status', 'situacao', 'status_presenca'], '')
            if (!isDoneIndividualStatus(rowStatus)) return false

            const rowCreatedKey = dateMinuteKey(pick(row, ['created_at', 'createdAt'], ''))
            const rowCpf = onlyDigits(pick(row, ['cpf'], ''))
            const rowTel = onlyDigits(pick(row, ['telefone'], ''))
            const rowNome = String(pick(row, ['nome'], '')).trim().toLowerCase()
            const rowLogin = String(pick(row, ['loginP', 'login'], '')).trim()

            const sameCreated = !doneCreatedKey || !rowCreatedKey || rowCreatedKey === doneCreatedKey
            const sameCpf = !doneCpf || !rowCpf || rowCpf === doneCpf
            const sameTel = !doneTel || !rowTel || rowTel === doneTel
            const sameNome = !doneNome || !rowNome || rowNome === doneNome
            const sameLogin = !doneLogin || !rowLogin || rowLogin === doneLogin
            return sameCreated && sameCpf && sameTel && sameNome && sameLogin
          })

          const tabelasBody = relatedRows
            .map(mapTabelaFromFlat)
            .filter(Boolean)
            .filter((item, idx, arr) => {
              const key = `${item?.id ?? ''}|${item?.nome ?? ''}|${item?.prazo ?? ''}|${item?.taxaJuros ?? ''}|${item?.valorLiberado ?? ''}|${item?.valorParcela ?? ''}`
              return arr.findIndex((x) => `${x?.id ?? ''}|${x?.nome ?? ''}|${x?.prazo ?? ''}|${x?.taxaJuros ?? ''}|${x?.valorLiberado ?? ''}|${x?.valorParcela ?? ''}` === key) === idx
            })

          completedPayload = {
            ...doneRow,
            tabelas_body: tabelasBody
          }
          break
        }

        setConsultaMsg('Consulta em processamento... aguardando status Concluido.')
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }

      openConsultaResultModalFromSource(completedPayload, phoneOrigin)
      setConsultaMsg(`Consulta concluída | CPF ${formatCpf(cpfDigits)} | Telefone ${formatPhone(phoneDigits)}.`)
      await fetchSummary()
    } catch (err) {
      setConsultaMsg(err?.message || 'Falha ao chamar API de consulta individual.')
    } finally {
      setConsultando(false)
    }
  }, [cpfConsulta, telefoneConsulta, nomeConsulta, currentSummary, fetchSummary, openConsultaResultModalFromSource, user?.id])

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
    setBatchJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [])

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
        if (!rows.length) return
        const statuses = rows.map((r) => String(r?.status ?? "").toLowerCase())
        const pendingCount = statuses.filter((s) => s === "pendente").length
        const successCount = statuses.filter((s) => s === "concluído" || s === "concluido" || s === "ok").length
        const errorCount = statuses.filter((s) => s === "erro" || s === "falha").length
        const durationValues = rows
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
                progress: pendingCount ? Math.round(((successCount + errorCount) / rows.length) * 100) : 100,
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
      const hasPending = rows.some((row) => !isDoneLoteStatus(row?.status))
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
      setConsultaMsg('Selecione um login válido no card Resumo.')
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
      formData.append('loginP', String(currentSummary.loginP))
      formData.append('id_user', String(user.id))

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
    if (uploadingBatchFile || !loteAutoPollingEnabled || !user?.id || !login || login === '-') return undefined

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
  }, [fetchLoteGroups, loteAutoPollingEnabled, summaryRows, selectedLoginIndex, uploadingBatchFile, user?.id])

  const downloadBatchJobCsv = useCallback(async (job) => {
    if (!user?.id) {
      notify.error('Usuário sem ID.', { autoClose: 2000 })
      return
    }
    if (!currentSummary?.loginP || currentSummary.loginP === '-') {
      notify.error('Selecione um login válido no card Resumo.', { autoClose: 2000 })
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
        notify.info('Nenhum registro retornado para exportação.', { autoClose: 2000 })
        return
      }

      const header = []
      const seenHeader = new Set()
      for (const row of rowsToExport) {
        for (const key of Object.keys(row || {})) {
          const norm = String(key || '').trim().toLowerCase()
          if (!norm || norm === 'loginp' || seenHeader.has(norm)) continue
          seenHeader.add(norm)
          header.push(key)
        }
      }

      if (header.length === 0) {
        notify.info('Nenhuma coluna disponível para exportação.', { autoClose: 2000 })
        return
      }

      const lines = [header.join(';')]
      for (const r of rowsToExport) {
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
      const fileName = `lote_${safeBase}_${stamp}.csv`

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

  const askDeleteLoteGroup = useCallback((group) => {
    const login = String(group?.loginP || currentSummary?.loginP || '').trim()
    if (!login || login === '-') {
      notify.error('Login inválido para exclusão.', { autoClose: 2000 })
      return
    }
    setDeleteLoteModal({
      loginP: login,
      fileName: String(group?.file || '-'),
      totalRows: Number(group?.total || 0),
      eligibleCount: Number(group?.okByValue || 0),
      notEligibleCount: Number(group?.noValue || 0)
    })
  }, [currentSummary?.loginP])

  const deleteLoteGroup = useCallback(async () => {
    if (!deleteLoteModal) return
    const userId = user?.id
    const login = String(deleteLoteModal?.loginP || currentSummary?.loginP || '').trim()
    if (!userId) {
      notify.error('Usuário sem ID.', { autoClose: 2000 })
      return
    }
    if (!login || login === '-') {
      notify.error('Login inválido para exclusão.', { autoClose: 2000 })
      return
    }
    try {
      setDeletingLote(true)
      const url = `${LOTE_DELETE_API_URL}?loginP=${encodeURIComponent(login)}&id_user=${encodeURIComponent(userId)}`
      const response = await fetch(url, { method: 'DELETE' })
      const rawText = await response.text()
      if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

      notify.success('Lotes excluídos com sucesso.', { autoClose: 2000 })
      await fetchLoteGroups(undefined, login)
      setDeleteLoteModal(null)
    } catch (err) {
      notify.error(err?.message || 'Falha ao excluir lotes.', { autoClose: 2500 })
    } finally {
      setDeletingLote(false)
    }
  }, [currentSummary?.loginP, deleteLoteModal, fetchLoteGroups, user?.id])

  const startBatchJob = useCallback(async (jobId) => {
    setConsultaMsg('')

    if (!currentSummary?.loginP || currentSummary.loginP === '-') {
      setConsultaMsg('Selecione um login válido no card Resumo.')
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
            <div className="col-12 col-lg-3">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="opacity-75 small text-uppercase mb-2">Resumo</div>
                <div className="mb-3">
                  <label className="form-label small opacity-75 mb-1">Login</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedLoginIndex}
                    onChange={(e) => setSelectedLoginIndex(Number(e.target.value))}
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

            <div className="col-12 col-lg-9">
              <div className="neo-card neo-lg p-3 p-md-4">
                <div className="opacity-75 small mb-2 text-uppercase">Filtros</div>
                <div className="d-flex flex-wrap gap-2 align-items-end">
                  <div style={{ minWidth: 260, flex: '1 1 320px' }}>
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
                  <div style={{ minWidth: 160 }}>
                    <label className="form-label small opacity-75 mb-1">De</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <label className="form-label small opacity-75 mb-1">Até</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="ms-auto d-flex gap-2">
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
              <div className="neo-card neo-lg p-3 p-md-4 mt-3">
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
                    <button
                      type="button"
                      className={`btn ${consultaTab === 'lote' ? 'btn-primary' : 'btn-outline-light'}`}
                      onClick={() => setConsultaTab('lote')}
                      disabled={consultando}
                    >
                      Em lote
                    </button>
                  </div>
                </div>

                {consultaTab === 'individual' ? (
                  <form onSubmit={handleConsultarIndividual}>
                    <div className="row g-2 align-items-end">
                      <div className="col-12 col-md-3">
                        <label className="form-label small opacity-75 mb-1">CPF</label>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Somente números"
                          value={cpfConsulta}
                          onChange={(e) => setCpfConsulta(onlyDigits(e.target.value))}
                          maxLength={11}
                        />
                      </div>
                      <div className="col-12 col-md-3">
                        <label className="form-label small opacity-75 mb-1">Telefone</label>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Opcional (gera automático)"
                          value={telefoneConsulta}
                          onChange={(e) => setTelefoneConsulta(onlyDigits(e.target.value))}
                          maxLength={11}
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small opacity-75 mb-1">Nome</label>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Nome completo"
                          value={nomeConsulta}
                          onChange={(e) => setNomeConsulta(e.target.value)}
                        />
                      </div>
                      <div className="col-12 col-md-2 d-grid">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={consultando}>
                          {consultando ? 'Consultando...' : 'Consultar'}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div className="row g-2 align-items-end">
                      <div className="col-12 col-md-6">
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
                    <th>Elegível</th>
                    <th>Data de nascimento</th>
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
                      <td colSpan={5} className="text-center py-4 opacity-75">Nenhum registro encontrado.</td>
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
                          <span className={`badge ${row.elegivel ? 'text-bg-success' : 'text-bg-danger'}`}>
                            {row.elegivel ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td>{formatDateOnly(row.dataNascimento)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="neo-card neo-lg p-0">
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
              <div className="small opacity-75">Lotes: {loteSourceRows.length}</div>
              {loteSourceRows.length > 0 && (
                <div className="d-flex align-items-center gap-2">
                  <div className="small opacity-75 d-none d-md-block">Exibindo {loteStartIndex}-{loteEndIndex} de {loteSourceRows.length}</div>
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
              )}
            </div>
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
                <thead>
                  <tr>
                    <th>Nome do arquivo</th>
                    <th>Quantidade de nomes</th>
                    <th>Resultado</th>
                    <th>Tempo médio</th>
                    <th>Status</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {batchJobs.length === 0 && loteGroups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 opacity-75">Nenhum lote carregado.</td>
                    </tr>
                  ) : batchJobs.length > 0 ? (
                    pagedBatchJobs.map((job) => {
                      const statusTxt = String(job.status || 'Pronto')
                      const cls = batchStatusClassName(statusTxt)

                      const canRun = !consultando && statusTxt !== 'Processando'
                      const canDelete = statusTxt !== 'Processando'
                      const canDownload = (job?.validRows?.length ?? 0) > 0
                      const qty = Number(job?.totalRows ?? 0)

                      return (
                        <tr key={job.id}>
                          <td className="text-wrap">{job.fileName}</td>
                          <td title={`${job.validRows?.length ?? 0} válido(s), ${job.invalidRows?.length ?? 0} inválido(s)`}>
                            {qty}
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <span
                                className="badge text-bg-success"
                                title={`Elegível: ${Number(job?.okCount ?? 0)}`}
                                aria-label={`Elegível: ${Number(job?.okCount ?? 0)}`}
                              >
                                {Number(job?.okCount ?? 0)}
                              </span>
                              <span
                                className="badge text-bg-danger"
                                title={`Não elegível: ${Number(job?.errCount ?? 0)}`}
                                aria-label={`Não elegível: ${Number(job?.errCount ?? 0)}`}
                              >
                                {Number(job?.errCount ?? 0)}
                              </span>
                            </div>
                          </td>
                          <td>{formatAvgDuration(job?.avgDurationMs)}</td>
                          <td>
                            <span className={`badge ${cls}`}>
                              {statusTxt}{statusTxt === 'Processando' ? ` (${job.progress ?? 0}%)` : ''}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="d-inline-flex align-items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon btn-ghost-success"
                                title="Iniciar"
                                aria-label="Iniciar"
                                onClick={() => startBatchJob(job.id)}
                                disabled={!canRun}
                              >
                                <FiPlay />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon btn-ghost-danger"
                                title="Excluir"
                                aria-label="Excluir"
                                onClick={() => deleteBatchJob(job.id)}
                                disabled={!canDelete}
                              >
                                <FiTrash2 />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon btn-ghost-info"
                                title="Baixar"
                                aria-label="Baixar"
                                onClick={() => downloadBatchJobCsv(job)}
                                disabled={!canDownload}
                              >
                                <FiDownload />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    pagedLoteGroups.map((group) => {
                      const hasPending = Number(group?.pending ?? 0) > 0
                      const hasError = Number(group?.error ?? 0) > 0
                      const hasSuccess = Number(group?.success ?? 0) > 0
                      const statusTxt = hasPending
                        ? 'Processando'
                        : hasError
                          ? (hasSuccess ? 'Concluído com erros' : 'Erro')
                          : 'Concluído'
                      const cls = batchStatusClassName(statusTxt)
                      const qty = Number(group?.total ?? 0)
                      return (
                        <tr key={`${group.file}-${group.created}`}>
                          <td className="text-wrap">
                            <div>{group.file}</div>
                            <div className="small opacity-75">{formatDate(group.created)}</div>
                          </td>
                          <td>
                            {qty}
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <span
                                className="badge text-bg-success"
                                title={`Elegível: ${Number(group?.okByValue ?? 0)}`}
                                aria-label={`Elegível: ${Number(group?.okByValue ?? 0)}`}
                              >
                                {Number(group?.okByValue ?? 0)}
                              </span>
                              <span
                                className="badge text-bg-danger"
                                title={`Não elegível: ${Number(group?.noValue ?? 0)}`}
                                aria-label={`Não elegível: ${Number(group?.noValue ?? 0)}`}
                              >
                                {Number(group?.noValue ?? 0)}
                              </span>
                            </div>
                          </td>
                          <td>{formatAvgDuration(group?.avgDurationMs)}</td>
                          <td>
                            <span className={`badge ${cls}`}>
                              {statusTxt}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="d-inline-flex align-items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon btn-ghost-danger"
                                title="Excluir"
                                aria-label="Excluir"
                                onClick={() => askDeleteLoteGroup(group)}
                              >
                                <FiTrash2 />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon btn-ghost-info"
                                title="Baixar"
                                aria-label="Baixar"
                                onClick={() => downloadBatchJobCsv({ fileName: group.file, createdAt: group.created })}
                              >
                                <FiDownload />
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
                    {consultaResultModal.finalMessage && (
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
                        <span className={`badge ${consultaResultModal?.vinculo?.elegivel ? 'text-bg-success' : 'text-bg-danger'}`}>
                          {consultaResultModal?.vinculo?.elegivel ? 'Sim' : 'Não'}
                        </span>
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
                    <div className="col-12 col-md-3"><div className="small opacity-75">Data Nascimento</div><div className="fw-semibold">{formatDate(consultaResultModal?.margemData?.dataNascimento)}</div></div>
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
                    title={`Não elegível: ${Number(deleteLoteModal.notEligibleCount || 0)}`}
                    aria-label={`Não elegível: ${Number(deleteLoteModal.notEligibleCount || 0)}`}
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

