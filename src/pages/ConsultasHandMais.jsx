import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiAlertCircle, FiArrowLeft, FiCheckCircle, FiClock, FiDownload, FiEye, FiFileText, FiRefreshCw, FiSearch, FiSend, FiUpload } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'
import { normalizeRole, Roles } from '../utils/roles.js'

const HANDMAIS_LIMITES_API_URL = 'https://n8n.apivieiracred.store/webhook/api/getconsulta-handmais'
const HANDMAIS_CONSULTAS_API_URL = 'https://n8n.apivieiracred.store/webhook/api/consulta-handmais'
const HANDMAIS_INDIVIDUAL_API_URL = 'https://n8n.apivieiracred.store/webhook/api/consultaHandmais-individual'
const HANDMAIS_BATCH_API_URL = 'https://n8n.apivieiracred.store/webhook/api/consultaHandmais-lote'
const LIMIT_SUMMARY_FALLBACK = { total: '-', usado: '-', restantes: '-' }
const MAIN_TABLE_FIELDS = new Set(['nome', 'cpf', 'status', 'valor_margem'])
const HIDDEN_DETAIL_FIELDS = new Set(['id_user', 'equipe_id', 'id_consulta_hand'])
const DETAIL_FIELD_ORDER = [
  'id',
  'tipoConsulta',
  'telefone',
  'dataNascimento',
  'descricao',
  'nome_tabela',
  'id_tabela',
  'token_tabela',
  'created_at',
  'updated_at',
]
const DETAIL_FIELD_LABELS = {
  id: 'ID',
  tipoConsulta: 'Tipo Consulta',
  telefone: 'Telefone',
  dataNascimento: 'Nascimento',
  descricao: 'Descricao',
  nome_tabela: 'Nome Tabela',
  id_tabela: 'ID Tabela',
  token_tabela: 'Token Tabela',
  created_at: 'Criado em',
  updated_at: 'Atualizado em',
}

const parseCsvLine = (line, separator) => {
  const values = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      const nextChar = line[i + 1]
      if (insideQuotes && nextChar === '"') {
        current += '"'
        i += 1
        continue
      }
      insideQuotes = !insideQuotes
      continue
    }

    if (char === separator && !insideQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

const normalizeHeaderToken = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const normalizeBirthDateInput = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/')
    return `${year}-${month}-${day}`
  }
  return raw
}

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

const normalizeCpf11 = (value) => {
  const digits = onlyDigits(value)
  if (!digits) return ''
  return digits.length < 11 ? digits.padStart(11, '0') : digits.slice(0, 11)
}

const formatCpf = (value) => {
  const cpf = normalizeCpf11(value)
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
    minute: '2-digit',
  })
}

const formatDateOnly = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const parseMarginToNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  let text = String(value).trim()
  if (!text) return null

  text = text.replace(/\s+/g, '').replace(/^R\$/i, '')
  const hasComma = text.includes(',')
  const hasDot = text.includes('.')

  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(',')
    const lastDot = text.lastIndexOf('.')
    if (lastComma > lastDot) {
      text = text.replace(/\./g, '').replace(',', '.')
    } else {
      text = text.replace(/,/g, '')
    }
  } else if (hasComma) {
    text = text.replace(',', '.')
  }

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

const formatCurrencyBRL = (value) => {
  const parsed = parseMarginToNumber(value)
  if (parsed === null) return '-'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parsed)
}

const parseRowTimestamp = (row) => {
  const raw = row?.updated_at ?? row?.created_at ?? null
  const directTs = new Date(raw).getTime()
  if (Number.isFinite(directTs)) return directTs

  const str = String(raw ?? '').trim()
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(str)
  if (!match) return 0

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)
  const parsedTs = new Date(year, month - 1, day, hour, minute, second).getTime()
  return Number.isFinite(parsedTs) ? parsedTs : 0
}

const getRowCreatedAtTimestamp = (row) => {
  const raw = row?.created_at ?? row?.createdAt ?? 0
  const directTs = new Date(raw).getTime()
  if (Number.isFinite(directTs)) return directTs

  const str = String(raw ?? '').trim()
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(str)
  if (!match) return 0

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)
  const parsedTs = new Date(year, month - 1, day, hour, minute, second).getTime()
  return Number.isFinite(parsedTs) ? parsedTs : 0
}

const getRowUpdatedAtTimestamp = (row) => {
  const raw = row?.updated_at ?? row?.updatedAt ?? 0
  const directTs = new Date(raw).getTime()
  if (Number.isFinite(directTs)) return directTs

  const str = String(raw ?? '').trim()
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(str)
  if (!match) return 0

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)
  const parsedTs = new Date(year, month - 1, day, hour, minute, second).getTime()
  return Number.isFinite(parsedTs) ? parsedTs : 0
}

const getRowSortTimestamp = (row) => {
  return Math.max(getRowCreatedAtTimestamp(row), getRowUpdatedAtTimestamp(row), 0)
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
  const createdTs = getRowCreatedAtTimestamp(row)
  const updatedTs = getRowUpdatedAtTimestamp(row)
  if (createdTs <= 0 || updatedTs <= 0 || updatedTs < createdTs) return null
  return updatedTs - createdTs
}

const compareRowsByUpdatedAtDesc = (a, b) => {
  const tsDiff = parseRowTimestamp(b) - parseRowTimestamp(a)
  if (tsDiff !== 0) return tsDiff

  return Number(b?.id || 0) - Number(a?.id || 0)
}

const compareRowsByValorMargemDesc = (a, b) => {
  const aMargin = parseMarginToNumber(a?.valor_margem)
  const bMargin = parseMarginToNumber(b?.valor_margem)

  if (aMargin === null && bMargin === null) return compareRowsByUpdatedAtDesc(a, b)
  if (aMargin === null) return 1
  if (bMargin === null) return -1

  const marginDiff = bMargin - aMargin
  if (marginDiff !== 0) return marginDiff
  return compareRowsByUpdatedAtDesc(a, b)
}

const sortRowsByUpdatedAtDesc = (items) => {
  if (!Array.isArray(items) || items.length <= 1) return Array.isArray(items) ? items : []
  return [...items].sort(compareRowsByUpdatedAtDesc)
}

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (payload && typeof payload === 'object') return [payload]
  return []
}

const parseResponseBody = async (response) => {
  const raw = await response.text()
  let payload = null

  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (payload?.message) throw new Error(payload.message)
    if (payload?.error) throw new Error(payload.error)
    throw new Error(raw || `HTTP ${response.status}`)
  }

  if (payload?.ok === false) {
    throw new Error(payload?.message || payload?.error || 'Falha na API')
  }

  return payload
}

const toIntegerOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

const resolveUserRoleId = (user) => (
  toIntegerOrNull(user?.id_role)
  ?? toIntegerOrNull(user?.role_id)
  ?? toIntegerOrNull(user?.id_roles)
  ?? toIntegerOrNull(user?.roleId)
  ?? toIntegerOrNull(user?.idRole)
)

const statusBadgeClassName = (statusRaw) => {
  const status = String(statusRaw || '').trim().toLowerCase()
  if (status === 'consultado') return 'text-bg-success'
  if (status === 'erro') return 'text-bg-danger'
  if (status === 'processando') return 'text-bg-info'
  if (status === 'pendente') return 'text-bg-warning text-dark'
  return 'text-bg-secondary'
}

const batchStatusBadgeClassName = (statusRaw) => {
  const token = normalizeBatchToken(statusRaw)
  if (token.includes('process')) return 'text-bg-warning'
  if (token.includes('conclu') && token.includes('erro')) return 'text-bg-danger'
  if (token.includes('conclu') || token.includes('sucesso')) return 'text-bg-success'
  if (token.includes('erro')) return 'text-bg-danger'
  return 'text-bg-secondary'
}

const normalizeBatchToken = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\.csv$/i, '')

const isIndividualBatchToken = (value) => {
  const token = normalizeBatchToken(value)
  return !token || token === 'individual' || token === 'consulta individual'
}

const isPendingLikeStatus = (value) => {
  const token = normalizeBatchToken(value)
  return token.includes('pend') || token.includes('process')
}

const formatAvgDuration = (value) => {
  const ms = parseDurationToMs(value)
  if (ms === null) return '-'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)} s`
  if (sec >= 3600) {
    const totalSeconds = Math.round(sec)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  }
  const min = Math.floor(sec / 60)
  const rem = Math.round(sec % 60)
  return `${min}m ${String(rem).padStart(2, '0')}s`
}

const safeCsvValue = (value) => {
  const text = String(value ?? '')
  if (text.includes(';') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const UTF8_BOM = '\uFEFF'

const normalizeNameToken = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')

const countDistinctNames = (items) => {
  if (!Array.isArray(items) || items.length === 0) return 0
  const seen = new Set()

  for (const row of items) {
    const nameKey = normalizeNameToken(row?.nome)
    if (nameKey) {
      seen.add(`n:${nameKey}`)
      continue
    }

    const cpfKey = normalizeCpf11(row?.cpf)
    if (cpfKey) {
      seen.add(`c:${cpfKey}`)
      continue
    }

    const fallback = String(row?.id ?? '').trim()
    if (fallback) seen.add(`i:${fallback}`)
  }

  return seen.size
}

export default function ConsultasHandMais() {
  const { user } = useAuth()
  const batchFileInputRef = useRef(null)
  const [rows, setRows] = useState([])
  const [limites, setLimites] = useState([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [loadingLimites, setLoadingLimites] = useState(false)
  const [rowsError, setRowsError] = useState('')
  const [limitesError, setLimitesError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [descricaoFilter, setDescricaoFilter] = useState('')
  const [formCpf, setFormCpf] = useState('')
  const [formNome, setFormNome] = useState('')
  const [formTelefone, setFormTelefone] = useState('')
  const [formNascimento, setFormNascimento] = useState('')
  const [formError, setFormError] = useState('')
  const [consultaMode, setConsultaMode] = useState('individual')
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [pendingBatchUpload, setPendingBatchUpload] = useState(null)
  const [batchUploads, setBatchUploads] = useState([])
  const [batchPreviewRow, setBatchPreviewRow] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [selectedRowTabIndex, setSelectedRowTabIndex] = useState(0)
  const [currentConsultaHandId, setCurrentConsultaHandId] = useState(null)

  const currentUserId = useMemo(() => (
    toIntegerOrNull(user?.id)
    ?? toIntegerOrNull(user?.id_user)
    ?? toIntegerOrNull(user?.idUser)
  ), [user])

  const currentEquipeId = useMemo(() => (
    toIntegerOrNull(user?.equipe_id)
    ?? toIntegerOrNull(user?.id_equipe)
    ?? toIntegerOrNull(user?.equipeId)
  ), [user])

  const currentRoleId = useMemo(() => resolveUserRoleId(user), [user])
  const currentRoleLabel = useMemo(() => String(user?.role ?? '').trim(), [user])
  const normalizedRole = useMemo(
    () => normalizeRole(user?.role, user?.level ?? user?.nivel_hierarquia ?? user?.NivelHierarquia ?? null),
    [user]
  )
  const canAccessBatchMode = normalizedRole === Roles.Master || normalizedRole === Roles.Supervisor
  const currentHierarchyLevel = useMemo(() => (
    toIntegerOrNull(
      user?.nivel_hierarquia
      ?? user?.NivelHierarquia
      ?? user?.level
      ?? currentRoleId
    )
  ), [user, currentRoleId])

  useEffect(() => {
    if (!canAccessBatchMode && consultaMode !== 'individual') {
      setConsultaMode('individual')
    }
  }, [canAccessBatchMode, consultaMode])

  const buildHandMaisRequestUrl = useCallback((baseUrl, options = {}) => {
    const url = new URL(baseUrl)
    const explicitConsultaId = toIntegerOrNull(options?.idConsultaHand)
    const resolvedConsultaId = explicitConsultaId ?? currentConsultaHandId
    if (currentUserId !== null) url.searchParams.set('id_user', String(currentUserId))
    if (currentEquipeId !== null) url.searchParams.set('equipe_id', String(currentEquipeId))
    if (currentRoleId !== null) {
      url.searchParams.set('id_role', String(currentRoleId))
      url.searchParams.set('role_id', String(currentRoleId))
    }
    if (currentRoleLabel) {
      url.searchParams.set('role', currentRoleLabel)
      url.searchParams.set('hierarquia', currentRoleLabel)
    }
    if (currentHierarchyLevel !== null) {
      url.searchParams.set('nivel_hierarquia', String(currentHierarchyLevel))
    }
    if (resolvedConsultaId !== null) {
      url.searchParams.set('id_consulta_hand', String(resolvedConsultaId))
    }
    return url.toString()
  }, [currentConsultaHandId, currentEquipeId, currentHierarchyLevel, currentRoleId, currentRoleLabel, currentUserId])

  const fetchConsultas = useCallback(async (idConsultaHand = null) => {
    setLoadingRows(true)
    setRowsError('')
    try {
      const response = await fetch(buildHandMaisRequestUrl(HANDMAIS_CONSULTAS_API_URL, { idConsultaHand }), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const payload = await parseResponseBody(response)
      setRows(sortRowsByUpdatedAtDesc(normalizeRows(payload)))
    } catch (e) {
      setRows([])
      setRowsError(e?.message || 'Falha ao carregar consultas Hand+')
    } finally {
      setLoadingRows(false)
    }
  }, [buildHandMaisRequestUrl])

  const fetchLimites = useCallback(async () => {
    setLoadingLimites(true)
    setLimitesError('')
    try {
      const response = await fetch(buildHandMaisRequestUrl(HANDMAIS_LIMITES_API_URL), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const payload = await parseResponseBody(response)
      const normalized = sortRowsByUpdatedAtDesc(normalizeRows(payload))
      setLimites(normalized)
      const nextConsultaId = toIntegerOrNull(normalized?.[0]?.id)
      setCurrentConsultaHandId((prev) => (prev === nextConsultaId ? prev : nextConsultaId))
      return nextConsultaId
    } catch (e) {
      setLimites([])
      setLimitesError(e?.message || 'Falha ao carregar limites Hand+')
      setCurrentConsultaHandId(null)
      return null
    } finally {
      setLoadingLimites(false)
    }
  }, [buildHandMaisRequestUrl])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const consultaId = await fetchLimites()
      if (cancelled) return
      await fetchConsultas(consultaId)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchConsultas, fetchLimites])

  const handleRefresh = useCallback(async () => {
    const consultaId = await fetchLimites()
    await fetchConsultas(consultaId)
  }, [fetchConsultas, fetchLimites])

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault()
    setFormError('')

    const cpf = normalizeCpf11(formCpf)
    const nome = String(formNome || '').trim()
    const dataNascimento = String(formNascimento || '').trim()
    const telefone = onlyDigits(formTelefone).slice(0, 11)

    if (cpf.length !== 11) {
      setFormError('Informe um CPF valido com 11 digitos.')
      return
    }

    if (!nome) {
      setFormError('Informe o nome do cliente.')
      return
    }

    if (!dataNascimento) {
      setFormError('Informe a data de nascimento.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        cliente_cpf: cpf,
        cliente_nome: nome,
        tipoConsulta: 'Individual',
        dt_nascimento: dataNascimento,
        data_nascimento: dataNascimento,
        hold_pending: true,
      }

      if (telefone) payload.telefone = telefone
      if (currentUserId !== null) payload.id_user = currentUserId
      if (currentEquipeId !== null) payload.id_equipe = currentEquipeId
      if (currentRoleId !== null) payload.id_role = currentRoleId

      const response = await fetch(HANDMAIS_INDIVIDUAL_API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      await parseResponseBody(response)
      notify.success('Consulta Hand+ enviada com sucesso.')
      setFormCpf('')
      setFormNome('')
      setFormTelefone('')
      setFormNascimento('')
      await handleRefresh()
    } catch (e) {
      setFormError(e?.message || 'Falha ao enviar consulta Hand+')
    } finally {
      setSubmitting(false)
    }
  }, [currentEquipeId, currentRoleId, currentUserId, formCpf, formNascimento, formNome, formTelefone, handleRefresh])

  const parseBatchCsvRows = useCallback((csvText) => {
    const text = String(csvText ?? '').replace(/\uFEFF/g, '')
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (lines.length < 2) {
      return {
        validRows: [],
        invalidRows: [{ line: 0, reason: 'CSV sem linhas de dados.' }],
      }
    }

    const separator = lines[0].includes(';') ? ';' : ','
    const headerTokens = parseCsvLine(lines[0], separator).map(normalizeHeaderToken)

    const getIndex = (aliases) => {
      for (const alias of aliases) {
        const idx = headerTokens.indexOf(alias)
        if (idx >= 0) return idx
      }
      return -1
    }

    const cpfIdx = getIndex(['cpf', 'cliente_cpf'])
    const nomeIdx = getIndex(['nome', 'cliente_nome', 'name'])
    const nascIdx = getIndex(['dt_nascimento', 'dtnascimento', 'data_nascimento', 'datanascimento', 'nascimento', 'birthdate'])
    const telIdx = getIndex(['telefone', 'fone', 'celular', 'phone'])

    if (cpfIdx < 0 || nomeIdx < 0 || nascIdx < 0) {
      return {
        validRows: [],
        invalidRows: [{ line: 0, reason: 'Cabecalho deve conter CPF, NOME e DT NASCIMENTO.' }],
      }
    }

    const validRows = []
    const invalidRows = []

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i], separator)
      const cpf = normalizeCpf11(cols[cpfIdx] || '')
      const nome = String(cols[nomeIdx] || '').trim()
      const dataNascimento = normalizeBirthDateInput(cols[nascIdx] || '')
      const telefone = onlyDigits(telIdx >= 0 ? cols[telIdx] || '' : '').slice(0, 11)

      if (cpf.length !== 11) {
        invalidRows.push({ line: i + 1, reason: 'CPF invalido.' })
        continue
      }
      if (!nome) {
        invalidRows.push({ line: i + 1, reason: 'Nome vazio.' })
        continue
      }
      if (!dataNascimento) {
        invalidRows.push({ line: i + 1, reason: 'Data de nascimento vazia.' })
        continue
      }

      const rowPayload = { cpf, nome, dataNascimento }
      if (telefone) rowPayload.telefone = telefone
      if (currentUserId) rowPayload.id_user = currentUserId
      if (currentEquipeId) rowPayload.equipe_id = currentEquipeId
      validRows.push(rowPayload)
    }

    return { validRows, invalidRows }
  }, [currentEquipeId, currentUserId])

  const openBatchFilePicker = useCallback(() => {
    setBatchError('')
    batchFileInputRef.current?.click()
  }, [])

  const downloadBatchTemplate = useCallback(() => {
    const lines = [
      'nome;cpf;dt_nascimento;telefone',
      'JOAO MODELO;12345678901;1980-01-15;11999990001',
      'MARIA MODELO;23456789012;1975-06-22;11999990002',
      'CARLOS MODELO;34567890123;1990-11-03;11999990003',
    ]
    const content = `${lines.join('\r\n')}\r\n`
    const blob = new Blob([UTF8_BOM, content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'modelo_lote_handmais.csv'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [])

  const handleBatchFileChange = useCallback(async (event) => {
    const file = event.target?.files?.[0]
    if (!file) return

    setBatchError('')
    try {
      const content = await file.text()
      const parsed = parseBatchCsvRows(content)
      setPendingBatchUpload({
        file,
        fileName: file.name,
        totalRows: parsed.validRows.length + parsed.invalidRows.length,
        validRows: parsed.validRows,
        invalidRows: parsed.invalidRows,
      })
      if (parsed.validRows.length === 0) {
        setBatchError(parsed.invalidRows[0]?.reason || 'Nenhuma linha valida encontrada no CSV.')
      }
    } catch (e) {
      setPendingBatchUpload(null)
      setBatchError(e?.message || 'Falha ao ler arquivo CSV.')
    } finally {
      if (event.target) event.target.value = ''
    }
  }, [parseBatchCsvRows])

  const submitBatchRows = useCallback(async () => {
    const validRows = Array.isArray(pendingBatchUpload?.validRows) ? pendingBatchUpload.validRows : []
    const file = pendingBatchUpload?.file
    if (validRows.length === 0) {
      setBatchError('Nenhuma linha valida para enviar.')
      return
    }
    if (!file) {
      setBatchError('Arquivo CSV nao encontrado para envio.')
      return
    }

    setBatchUploading(true)
    setBatchError('')
    try {
      const rawName = String(pendingBatchUpload?.fileName || `lote_handmais_${Date.now()}`).trim()
      const uploadName = rawName.toLowerCase().endsWith('.csv') ? rawName : `${rawName}.csv`
      const localId = `local-${Date.now()}`
      const uniqueNameCount = countDistinctNames(validRows)
      const localEntry = {
        id: localId,
        source: 'local',
        fileName: uploadName,
        totalRows: validRows.length,
        uniqueNameCount,
        successCount: 0,
        errorCount: 0,
        pendingCount: validRows.length,
        status: 'Processando',
        createdAt: new Date().toISOString(),
        avgDurationMs: null,
        previewRows: validRows.slice(0, 20),
        previewTotal: validRows.length,
      }

      setBatchUploads((prev) => [localEntry, ...prev.filter((item) => normalizeBatchToken(item?.fileName) !== normalizeBatchToken(uploadName))])

      const formData = new FormData()
      formData.append('arquivo', file, uploadName)
      formData.append('tipoConsulta', uploadName)
      formData.append('id_user', currentUserId === null ? '' : String(currentUserId))
      formData.append('equipe_id', currentEquipeId === null ? '' : String(currentEquipeId))
      formData.append('id_consulta_handmais', currentConsultaHandId === null ? '' : String(currentConsultaHandId))

      const response = await fetch(HANDMAIS_BATCH_API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      })
      const payload = await parseResponseBody(response)
      notify.success(payload?.message || `Lote enviado com ${validRows.length} linhas.`)
      setPendingBatchUpload(null)
      await handleRefresh()
    } catch (e) {
      setBatchError(e?.message || 'Falha ao enviar lote.')
    } finally {
      setBatchUploading(false)
    }
  }, [currentConsultaHandId, currentEquipeId, currentUserId, handleRefresh, pendingBatchUpload])

  const latestTableUpdatedAt = useMemo(() => {
    const candidates = []
    for (const row of rows) {
      if (row?.updated_at) candidates.push(row.updated_at)
    }
    for (const row of limites) {
      if (row?.updated_at) candidates.push(row.updated_at)
    }
    if (candidates.length === 0) return null
    return candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
  }, [rows, limites])

  const currentLimitSummary = useMemo(() => {
    if (!Array.isArray(limites) || limites.length === 0) return LIMIT_SUMMARY_FALLBACK
    const row = limites[0] || {}
    const total = Number(row?.total || 0)
    const usado = Number(row?.consultados || 0)
    const restantes = Number(row?.restantes ?? Math.max(total - usado, 0))
    const formatter = new Intl.NumberFormat('pt-BR')
    return {
      total: formatter.format(Math.max(0, total)),
      usado: formatter.format(Math.max(0, usado)),
      restantes: formatter.format(Math.max(0, restantes)),
    }
  }, [limites])

  const statusOptions = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      const label = String(row?.status || '').trim()
      if (!label) continue
      map.set(label, (map.get(label) || 0) + 1)
    }
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }))
  }, [rows])

  const filteredRows = useMemo(() => {
    const token = String(searchTerm || '').trim().toLowerCase()
    const statusToken = String(statusFilter || '').trim().toLowerCase()
    const descricaoToken = String(descricaoFilter || '').trim().toLowerCase()

    return rows.filter((row) => {
      const status = String(row?.status || '').trim().toLowerCase()
      const descricao = String(row?.descricao || '').trim().toLowerCase()
      const combined = [
        row?.nome,
        row?.cpf,
        row?.telefone,
        row?.token_tabela,
        row?.tipoConsulta,
        row?.id_tabela,
        row?.nome_tabela,
      ].map((item) => String(item || '').toLowerCase()).join(' ')

      if (statusToken && status !== statusToken) return false
      if (descricaoToken && !descricao.includes(descricaoToken)) return false
      if (token && !combined.includes(token)) return false
      return true
    })
  }, [descricaoFilter, rows, searchTerm, statusFilter])

  const uniqueRowsByCpf = useMemo(() => {
    const byCpf = new Map()

    for (const row of filteredRows) {
      const cpfKey = normalizeCpf11(row?.cpf)
      const rowTs = parseRowTimestamp(row)
      const rowUpdatedAt = row?.updated_at ?? row?.created_at ?? null

      if (!cpfKey) {
        const fallbackKey = String(row?.id ?? `${row?.nome || ''}-${row?.created_at || ''}`)
        const currentFallback = byCpf.get(fallbackKey)
        if (!currentFallback) {
          byCpf.set(fallbackKey, { row, latestTs: rowTs, latestUpdatedAt: rowUpdatedAt })
          continue
        }
        byCpf.set(fallbackKey, {
          row: compareRowsByValorMargemDesc(row, currentFallback.row) < 0 ? row : currentFallback.row,
          latestTs: Math.max(currentFallback.latestTs, rowTs),
          latestUpdatedAt: currentFallback.latestTs >= rowTs ? currentFallback.latestUpdatedAt : rowUpdatedAt,
        })
        continue
      }

      const current = byCpf.get(cpfKey)
      if (!current) {
        byCpf.set(cpfKey, { row, latestTs: rowTs, latestUpdatedAt: rowUpdatedAt })
        continue
      }

      byCpf.set(cpfKey, {
        row: compareRowsByValorMargemDesc(row, current.row) < 0 ? row : current.row,
        latestTs: Math.max(current.latestTs, rowTs),
        latestUpdatedAt: current.latestTs >= rowTs ? current.latestUpdatedAt : rowUpdatedAt,
      })
    }

    return Array.from(byCpf.values())
      .sort((a, b) => {
        const tsDiff = b.latestTs - a.latestTs
        if (tsDiff !== 0) return tsDiff
        return compareRowsByUpdatedAtDesc(a.row, b.row)
      })
      .map((item) => item)
  }, [filteredRows])

  const hasActivePendingRows = useMemo(
    () => rows.some((row) => isPendingLikeStatus(row?.status)),
    [rows]
  )

  const apiBatchGroups = useMemo(() => {
    const groups = new Map()
    for (const row of rows) {
      const tipoConsulta = String(row?.tipoConsulta || '').trim()
      if (isIndividualBatchToken(tipoConsulta)) continue
      const key = normalizeBatchToken(tipoConsulta)
      if (!key) continue

      const statusToken = String(row?.status || '').trim().toLowerCase()
      const createdAt = row?.updated_at || row?.created_at || null

      if (!groups.has(key)) {
        groups.set(key, {
          id: `api-${key}`,
          source: 'api',
          fileName: tipoConsulta,
          totalRows: 0,
          uniqueNameCount: 0,
          successCount: 0,
          errorCount: 0,
          pendingCount: 0,
          createdAt,
          apiRows: [],
          avgDurationMs: null,
          nameTokens: new Set(),
        })
      }

      const group = groups.get(key)
      group.totalRows += 1
      const nameToken = normalizeNameToken(row?.nome)
      if (nameToken) group.nameTokens.add(`n:${nameToken}`)
      else {
        const cpfToken = normalizeCpf11(row?.cpf)
        if (cpfToken) group.nameTokens.add(`c:${cpfToken}`)
      }
      if (statusToken === 'consultado') group.successCount += 1
      else if (statusToken === 'erro') group.errorCount += 1
      else group.pendingCount += 1
      if (createdAt && (!group.createdAt || new Date(createdAt).getTime() > new Date(group.createdAt).getTime())) {
        group.createdAt = createdAt
      }
      group.apiRows.push(row)
    }

    return Array.from(groups.values()).map((group) => {
      const pendingCount = Math.max(0, group.totalRows - group.successCount - group.errorCount)
      const rowsList = Array.isArray(group.apiRows) ? group.apiRows : []
      const quantity = rowsList.length
      const startCandidates = rowsList
        .map((r) => {
          const createdTs = getRowCreatedAtTimestamp(r)
          if (Number.isFinite(createdTs) && createdTs > 0) return createdTs
          const fallbackTs = getRowSortTimestamp(r)
          return Number.isFinite(fallbackTs) && fallbackTs > 0 ? fallbackTs : null
        })
        .filter((v) => Number.isFinite(v) && v > 0)
      const endCandidates = rowsList
        .map((r) => {
          const updatedTs = getRowUpdatedAtTimestamp(r)
          if (Number.isFinite(updatedTs) && updatedTs > 0) return updatedTs
          const fallbackTs = getRowSortTimestamp(r)
          return Number.isFinite(fallbackTs) && fallbackTs > 0 ? fallbackTs : null
        })
        .filter((v) => Number.isFinite(v) && v > 0)

      let avgDurationMs = null
      if (quantity > 0 && startCandidates.length > 0 && endCandidates.length > 0) {
        const earliestTs = Math.min(...startCandidates)
        const latestTs = Math.max(...endCandidates)
        if (latestTs >= earliestTs) {
          avgDurationMs = latestTs - earliestTs
        }
      }

      if (avgDurationMs === null) {
        const durationCandidates = rowsList
          .map((r) => getRowDurationMs(r))
          .filter((v) => Number.isFinite(v) && v >= 0)
        if (durationCandidates.length > 0) {
          avgDurationMs = durationCandidates.reduce((acc, v) => acc + v, 0)
        }
      }

      const status = pendingCount > 0
        ? 'Processando'
        : 'Concluido'
      return {
        ...group,
        uniqueNameCount: group.nameTokens.size > 0 ? group.nameTokens.size : group.totalRows,
        pendingCount,
        avgDurationMs,
        status,
        previewRows: group.apiRows.slice(0, 25),
        previewTotal: group.totalRows,
      }
    })
  }, [rows])

  const batchTableRows = useMemo(() => {
    const byToken = new Map()
    for (const item of apiBatchGroups) {
      byToken.set(normalizeBatchToken(item?.fileName), item)
    }
    for (const item of batchUploads) {
      const token = normalizeBatchToken(item?.fileName)
      if (!token || byToken.has(token)) continue
      byToken.set(token, item)
    }

    return Array.from(byToken.values()).sort((a, b) => {
      const aTs = a?.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTs = b?.createdAt ? new Date(b.createdAt).getTime() : 0
      return bTs - aTs
    })
  }, [apiBatchGroups, batchUploads])

  const openBatchPreviewModal = useCallback((entry) => {
    setBatchPreviewRow(entry || null)
  }, [])

  const downloadBatchRows = useCallback((entry) => {
    const sourceRows = Array.isArray(entry?.apiRows) && entry.apiRows.length > 0
      ? entry.apiRows
      : (Array.isArray(entry?.previewRows) ? entry.previewRows : [])
    if (sourceRows.length === 0) {
      notify.warn('Nenhuma linha disponivel para exportar.')
      return
    }

    const headers = ['nome', 'cpf', 'telefone', 'dataNascimento', 'status', 'descricao', 'tipoConsulta', 'valorMargem', 'id_tabela', 'token_tabela', 'created_at', 'updated_at']
    const lines = [headers.join(';')]
    for (const row of sourceRows) {
      const formattedBirthDate = formatDateOnly(row?.dataNascimento)
      const formattedMargin = formatCurrencyBRL(row?.valor_margem ?? row?.valorMargem)
      const values = [
        row?.nome ?? '',
        normalizeCpf11(row?.cpf),
        row?.telefone ?? '',
        formattedBirthDate === '-' ? '' : formattedBirthDate,
        row?.status ?? '',
        row?.descricao ?? '',
        row?.tipoConsulta ?? '',
        formattedMargin === '-' ? '' : formattedMargin.replace(/\u00A0/g, ' '),
        row?.id_tabela ?? '',
        row?.token_tabela ?? '',
        row?.created_at ?? '',
        row?.updated_at ?? '',
      ].map((value) => safeCsvValue(value))
      lines.push(values.join(';'))
    }
    const content = `${lines.join('\r\n')}\r\n`
    const blob = new Blob([UTF8_BOM, content], { type: 'text/csv;charset=utf-8;' })
    const downloadName = String(entry?.fileName || `lote_handmais_${Date.now()}.csv`).trim()
    const fileName = downloadName.toLowerCase().endsWith('.csv') ? downloadName : `${downloadName}.csv`

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [])

  const selectedRowTabs = useMemo(() => {
    if (!selectedRow || typeof selectedRow !== 'object') return []

    const selectedCpf = normalizeCpf11(selectedRow?.cpf)
    if (!selectedCpf) return [selectedRow]

    const candidates = rows.filter((item) => normalizeCpf11(item?.cpf) === selectedCpf)

    const dedup = new Map()
    for (const item of candidates) {
      const key = String(item?.id ?? `${item?.cpf || ''}-${item?.id_tabela || ''}-${item?.created_at || ''}`)
      if (!dedup.has(key)) dedup.set(key, item)
    }

    const sorted = Array.from(dedup.values()).sort(compareRowsByValorMargemDesc)
    return sorted.length > 0 ? sorted : [selectedRow]
  }, [rows, selectedRow])

  const activeSelectedRow = useMemo(() => {
    if (!selectedRow) return null
    if (!Array.isArray(selectedRowTabs) || selectedRowTabs.length === 0) return selectedRow
    const safeIdx = Math.min(Math.max(0, selectedRowTabIndex), selectedRowTabs.length - 1)
    return selectedRowTabs[safeIdx] ?? selectedRow
  }, [selectedRow, selectedRowTabIndex, selectedRowTabs])

  useEffect(() => {
    if (!selectedRow) return
    setSelectedRowTabIndex(0)
  }, [selectedRow?.id])

  useEffect(() => {
    if (!selectedRow) return
    const maxIdx = Math.max(0, selectedRowTabs.length - 1)
    if (selectedRowTabIndex > maxIdx) setSelectedRowTabIndex(0)
  }, [selectedRow, selectedRowTabIndex, selectedRowTabs.length])

  const detailEntries = useMemo(() => {
    if (!activeSelectedRow || typeof activeSelectedRow !== 'object') return []

    const entries = []
    const seen = new Set()

    for (const key of DETAIL_FIELD_ORDER) {
      if (!Object.prototype.hasOwnProperty.call(activeSelectedRow, key)) continue
      if (MAIN_TABLE_FIELDS.has(key) || HIDDEN_DETAIL_FIELDS.has(key)) continue
      entries.push([key, activeSelectedRow[key]])
      seen.add(key)
    }

    for (const key of Object.keys(activeSelectedRow)) {
      if (seen.has(key) || MAIN_TABLE_FIELDS.has(key) || HIDDEN_DETAIL_FIELDS.has(key)) continue
      entries.push([key, activeSelectedRow[key]])
      seen.add(key)
    }

    return entries
  }, [activeSelectedRow])

  const formatDetailValue = useCallback((key, value) => {
    if (value === null || value === undefined || value === '') return '-'
    if (key === 'dataNascimento') return formatDateOnly(value)
    if (key === 'created_at' || key === 'updated_at') return formatDate(value)
    return String(value)
  }, [])

  const activeTotalRows = consultaMode === 'batch' ? batchTableRows.length : uniqueRowsByCpf.length

  useEffect(() => {
    if (!hasActivePendingRows) return undefined

    const timer = setInterval(() => {
      if (loadingRows || loadingLimites) return
      handleRefresh()
    }, 5000)

    return () => clearInterval(timer)
  }, [handleRefresh, hasActivePendingRows, loadingLimites, loadingRows])

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
                <img src="/handplus-logo.svg" alt="Hand+" width="52" height="52" style={{ objectFit: 'contain' }} />
                <h2 className="fw-bold mb-0">Consulta Hand+</h2>
              </div>
              <div className="small opacity-75">
                {latestTableUpdatedAt ? `Ultima atualizacao: ${formatDate(latestTableUpdatedAt)}` : 'Carregando dados...'}
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-outline-info btn-sm d-flex align-items-center gap-2" onClick={handleRefresh} disabled={loadingRows || loadingLimites}>
              <FiRefreshCw size={14} />
              <span>{loadingRows || loadingLimites ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          </div>
        </div>

        <div className="alert alert-warning border-warning-subtle bg-warning bg-opacity-10 text-warning-emphasis mb-3" role="alert">
          Estamos em manutenção. Por isso, algumas funcionalidades desta página podem parar de funcionar temporariamente.
        </div>

        <section className="mb-3">
          <div className="row g-3">
            <div className="col-12 col-xxl-3">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="opacity-75 small text-uppercase mb-2">Limites Hand+</div>
                <div className="d-flex flex-column gap-3">
                  <div><div className="small opacity-75">Total</div><div className="h5 fw-bold mb-0">{currentLimitSummary.total}</div></div>
                  <div><div className="small opacity-75">Usado</div><div className="h5 fw-bold mb-0">{currentLimitSummary.usado}</div></div>
                  <div><div className="small opacity-75">Restantes</div><div className="h5 fw-bold mb-0">{currentLimitSummary.restantes}</div></div>
                </div>
                {limitesError && <div className="small text-danger mt-3">{limitesError}</div>}
                {loadingLimites && <div className="small opacity-75 mt-3 d-flex align-items-center gap-2"><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Carregando limites...</div>}
              </div>
            </div>

            <div className="col-12 col-xxl-5">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="opacity-75 small mb-2 text-uppercase">Filtros</div>
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label small opacity-75 mb-1" htmlFor="hand-search">Buscar</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text"><FiSearch size={14} /></span>
                      <input id="hand-search" className="form-control" placeholder="Nome, CPF, telefone ou matricula" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small opacity-75 mb-1" htmlFor="hand-status">Status</label>
                    <select id="hand-status" className="form-select form-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">Todos</option>
                      {statusOptions.map((item) => (
                        <option key={item.label} value={item.label}>{item.label} ({item.count})</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small opacity-75 mb-1" htmlFor="hand-descricao">Descricao</label>
                    <input id="hand-descricao" className="form-control form-control-sm" placeholder="Contem..." value={descricaoFilter} onChange={(e) => setDescricaoFilter(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-xxl-4">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
                  <div className="opacity-75 small text-uppercase">Consulta Hand+</div>
                  <div className="btn-group btn-group-sm" role="group" aria-label="Modo de consulta">
                    <button
                      type="button"
                      className={`btn ${consultaMode === 'individual' ? 'btn-info' : 'btn-outline-info'}`}
                      onClick={() => setConsultaMode('individual')}
                    >
                      Individual
                    </button>
                    {canAccessBatchMode && (
                      <button
                        type="button"
                        className={`btn ${consultaMode === 'batch' ? 'btn-info' : 'btn-outline-info'}`}
                        onClick={() => setConsultaMode('batch')}
                      >
                        Em lote
                      </button>
                    )}
                  </div>
                </div>

                {consultaMode === 'individual' ? (
                  <form className="d-flex flex-column gap-2" onSubmit={handleSubmit}>
                    <div>
                      <label className="form-label small opacity-75 mb-1" htmlFor="hand-cpf">CPF</label>
                      <input id="hand-cpf" className="form-control form-control-sm" inputMode="numeric" maxLength={14} placeholder="00000000000" value={formCpf} onChange={(e) => setFormCpf(onlyDigits(e.target.value).slice(0, 11))} onBlur={() => setFormCpf((prev) => normalizeCpf11(prev))} />
                    </div>
                    <div>
                      <label className="form-label small opacity-75 mb-1" htmlFor="hand-nome">Nome do cliente</label>
                      <input id="hand-nome" className="form-control form-control-sm" placeholder="NOME DO CLIENTE" value={formNome} onChange={(e) => setFormNome(e.target.value)} />
                    </div>
                    <div className="row g-2">
                      <div className="col-12 col-sm-6">
                        <label className="form-label small opacity-75 mb-1" htmlFor="hand-nasc">Nascimento</label>
                        <input id="hand-nasc" type="date" className="form-control form-control-sm" value={formNascimento} onChange={(e) => setFormNascimento(e.target.value)} />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label small opacity-75 mb-1" htmlFor="hand-fone">Telefone</label>
                        <input id="hand-fone" className="form-control form-control-sm" inputMode="numeric" maxLength={11} placeholder="11999999999" value={formTelefone} onChange={(e) => setFormTelefone(onlyDigits(e.target.value).slice(0, 11))} />
                      </div>
                    </div>
                    <div className="small opacity-75">
                      Se o telefone nao for informado, o sistema gera automaticamente.
                    </div>
                    {formError && <div className="small text-danger">{formError}</div>}
                    <button type="submit" className="btn btn-outline-info btn-sm mt-1 d-inline-flex align-items-center justify-content-center gap-2" disabled={submitting}>
                      <FiSend size={14} />
                      <span>{submitting ? 'Enviando...' : 'Consultar'}</span>
                    </button>
                  </form>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    <div className="small opacity-75">
                      Arquivo separado por <code>;</code> com colunas obrigatorias <code>cpf</code>, <code>nome</code> e <code>dt_nascimento</code>. <code>telefone</code> e opcional.
                    </div>
                    <input
                      ref={batchFileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="d-none"
                      onChange={handleBatchFileChange}
                    />
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-info btn-sm w-100 d-inline-flex align-items-center justify-content-center gap-2"
                        onClick={openBatchFilePicker}
                        disabled={batchUploading}
                      >
                        <FiUpload size={14} />
                        <span>Selecionar CSV</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-info btn-sm d-inline-flex align-items-center gap-2"
                        onClick={submitBatchRows}
                        disabled={batchUploading || !pendingBatchUpload?.validRows?.length}
                      >
                        <FiSend size={14} />
                        <span>{batchUploading ? 'Enviando...' : 'Enviar lote'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-light btn-sm d-inline-flex align-items-center gap-2"
                        onClick={downloadBatchTemplate}
                        disabled={batchUploading}
                      >
                        <FiDownload size={14} />
                        <span>Baixar modelo</span>
                      </button>
                    </div>
                    {batchError && <div className="small text-danger">{batchError}</div>}
                    {pendingBatchUpload ? (
                      <div className="neo-card p-2 mt-1">
                        <div className="small d-flex align-items-center gap-2">
                          <FiFileText size={14} />
                          <span className="fw-semibold text-break">{pendingBatchUpload.fileName}</span>
                        </div>
                        <div className="small opacity-75 mt-1">
                          Total: {pendingBatchUpload.totalRows} | validos: {pendingBatchUpload.validRows.length} | invalidos: {pendingBatchUpload.invalidRows.length}
                        </div>
                        {pendingBatchUpload.invalidRows.length > 0 && (
                          <div className="small text-warning mt-1">
                            Linhas invalidas: {pendingBatchUpload.invalidRows.slice(0, 5).map((item) => `${item.line} (${item.reason})`).join(', ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="small opacity-75">Nenhum CSV selecionado.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className={consultaMode === 'batch' ? 'neo-card neo-lg p-0' : 'neo-card p-3 p-md-4'}>
          <div className={`d-flex align-items-center justify-content-between gap-2 flex-wrap ${consultaMode === 'batch' ? 'p-3 border-bottom border-secondary' : 'mb-2'}`}>
            <h5 className="mb-0">Resultados</h5>
            <div className="small opacity-75 d-flex align-items-center gap-2"><FiClock size={14} /> {activeTotalRows} registros</div>
          </div>

          {rowsError && <div className={`small text-danger ${consultaMode === 'batch' ? 'px-3 pb-2' : 'mb-2'}`}>{rowsError}</div>}

          {loadingRows ? (
            <div className={`d-flex align-items-center gap-2 ${consultaMode === 'batch' ? 'p-3' : 'py-3'}`}>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span className="small opacity-75">Carregando consultas...</span>
            </div>
          ) : consultaMode === 'batch' ? (
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
                <thead>
                  <tr>
                    <th>Nome do arquivo</th>
                    <th>Quantidade de nomes</th>
                    <th>Resultado</th>
                    <th>Tempo Estimado</th>
                    <th>Status</th>
                    <th className="text-center">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {batchTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center opacity-75">Nenhum lote encontrado.</td>
                    </tr>
                  ) : batchTableRows.map((entry, idx) => (
                    <tr key={String(entry?.id ?? `${entry?.fileName || 'batch'}-${idx}`)}>
                      <td className="text-wrap">
                        <div className="fw-semibold">{entry?.fileName || '-'}</div>
                        <div className="small opacity-75">{entry?.createdAt ? formatDate(entry.createdAt) : '-'}</div>
                      </td>
                      <td>{Number(entry?.uniqueNameCount ?? entry?.totalRows ?? 0)}</td>
                      <td>
                        <div className="d-inline-flex align-items-center gap-2 flex-nowrap">
                          <span className="badge text-bg-warning d-inline-flex align-items-center gap-1" title="Falta consultar">
                            <FiClock size={12} />
                            <span>{Number(entry?.pendingCount ?? 0)}</span>
                          </span>
                          <span className="badge text-bg-success d-inline-flex align-items-center gap-1" title="Sem erro">
                            <FiCheckCircle size={12} />
                            <span>{Number(entry?.successCount ?? 0)}</span>
                          </span>
                          <span className="badge text-bg-danger d-inline-flex align-items-center gap-1" title="Com erro">
                            <FiAlertCircle size={12} />
                            <span>{Number(entry?.errorCount ?? 0)}</span>
                          </span>
                        </div>
                      </td>
                      <td>{formatAvgDuration(entry?.avgDurationMs)}</td>
                      <td>
                        <span className={`badge ${batchStatusBadgeClassName(entry?.status)}`}>
                          {entry?.status || '-'}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="d-inline-flex align-items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-outline-light btn-sm p-1 d-inline-flex align-items-center justify-content-center"
                            title="Visualizar lote"
                            onClick={() => openBatchPreviewModal(entry)}
                          >
                            <FiFileText size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-light btn-sm p-1 d-inline-flex align-items-center justify-content-center"
                            title="Baixar CSV"
                            onClick={() => downloadBatchRows(entry)}
                          >
                            <FiDownload size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Status</th>
                    <th>Valor Margem</th>
                    <th>Ultima Atualizacao</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {uniqueRowsByCpf.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-4 opacity-75">Nenhum resultado encontrado.</td></tr>
                  ) : uniqueRowsByCpf.map((entry, idx) => {
                    const row = entry?.row || {}
                    return (
                    <tr key={row?.id || `${row?.cpf || 'row'}-${row?.updated_at || idx}`}>
                      <td>{row?.nome || '-'}</td>
                      <td>{formatCpf(row?.cpf)}</td>
                      <td><span className={`badge ${statusBadgeClassName(row?.status)}`}>{row?.status || '-'}</span></td>
                      <td>{formatCurrencyBRL(row?.valor_margem)}</td>
                      <td>{formatDate(entry?.latestUpdatedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline-light btn-sm p-1 d-inline-flex align-items-center justify-content-center"
                          title="Ver detalhes"
                          onClick={() => {
                            setSelectedRowTabIndex(0)
                            setSelectedRow(row)
                          }}
                        >
                          <FiEye size={16} />
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      {batchPreviewRow && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1066 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setBatchPreviewRow(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            style={{ maxWidth: 'min(96vw, 1200px)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <h5 className="modal-title mb-0">Visualizar lote</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Fechar"
                  onClick={() => setBatchPreviewRow(null)}
                />
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-8">
                    <div className="small opacity-75">Arquivo</div>
                    <div className="fw-semibold text-break">{batchPreviewRow?.fileName || '-'}</div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div className="small opacity-75">Linhas</div>
                    <div className="fw-semibold">{Number(batchPreviewRow?.totalRows || 0)}</div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div className="small opacity-75">Status</div>
                    <div className="fw-semibold">{batchPreviewRow?.status || '-'}</div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-dark table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>CPF</th>
                        <th>Telefone</th>
                        <th>Nascimento</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(batchPreviewRow?.previewRows?.length ?? 0) === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-3 opacity-75">Sem dados de pre-visualizacao.</td>
                        </tr>
                      ) : (
                        (batchPreviewRow?.previewRows ?? []).map((item, idx) => (
                          <tr key={`${item?.cpf || 'cpf'}-${idx}`}>
                            <td className="text-wrap">{item?.nome || '-'}</td>
                            <td>{formatCpf(item?.cpf)}</td>
                            <td>{item?.telefone || '-'}</td>
                            <td>{formatDetailValue('dataNascimento', item?.dataNascimento)}</td>
                            <td><span className={`badge ${statusBadgeClassName(item?.status)}`}>{item?.status || '-'}</span></td>
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
      )}
      {selectedRow && (
        <>
          <div
            className="modal fade show"
            style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1065 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setSelectedRow(null)}
          >
            <div
              className="modal-dialog modal-dialog-centered modal-xl"
              style={{ maxWidth: 'min(96vw, 1180px)' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-content modal-dark">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title">Resultado da Consulta Hand+</h5>
                    <div className="small modal-dark-subtitle">Visualizacao detalhada da consulta selecionada.</div>
                  </div>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    aria-label="Fechar"
                    onClick={() => setSelectedRow(null)}
                  />
                </div>
                <div className="modal-body">
                  <div className="row g-2 mb-3">
                    <div className="col-12 col-md-4">
                      <div className="small opacity-75">CPF</div>
                      <div className="fw-semibold">{formatCpf(activeSelectedRow?.cpf)}</div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="small opacity-75">Nome</div>
                      <div className="fw-semibold text-break">{activeSelectedRow?.nome || '-'}</div>
                    </div>
                    <div className="col-12 col-md-2">
                      <div className="small opacity-75">Status</div>
                      <div><span className={`badge ${statusBadgeClassName(activeSelectedRow?.status)}`}>{activeSelectedRow?.status || '-'}</span></div>
                    </div>
                    <div className="col-12 col-md-2">
                      <div className="small opacity-75">Valor Margem</div>
                      <div className="fw-semibold">{formatCurrencyBRL(activeSelectedRow?.valor_margem)}</div>
                    </div>
                  </div>

                  {selectedRowTabs.length > 1 && (
                    <div className="d-flex align-items-end gap-1 mb-3 flex-wrap">
                      {selectedRowTabs.map((item, idx) => (
                        <button
                          key={String(item?.id ?? `${item?.cpf || 'row'}-${idx}`)}
                          type="button"
                          className={`btn btn-sm ${idx === selectedRowTabIndex ? 'btn-info text-dark' : 'btn-outline-light'}`}
                          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                          onClick={() => setSelectedRowTabIndex(idx)}
                          title={item?.id ? `ID ${item.id}` : `Consulta ${idx + 1}`}
                        >
                          {`Consulta ${idx + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="neo-card p-3 mb-3">
                    <div className="small opacity-75 mb-2">Vinculo</div>
                    <div className="row g-2">
                      {detailEntries
                        .filter(([key]) => ['tipoConsulta', 'telefone', 'dataNascimento', 'nome_tabela', 'id_tabela', 'token_tabela'].includes(key))
                        .map(([key, value]) => (
                          <div key={key} className="col-12 col-md-4">
                            <div className="small opacity-75">{DETAIL_FIELD_LABELS[key] || key}</div>
                            <div className="fw-semibold text-wrap" style={{ whiteSpace: 'normal' }}>{formatDetailValue(key, value)}</div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="neo-card p-3">
                    <div className="small opacity-75 mb-2">Informacoes adicionais</div>
                    <div className="row g-2">
                      {detailEntries
                        .filter(([key]) => !['descricao', 'tipoConsulta', 'telefone', 'dataNascimento', 'nome_tabela', 'id_tabela', 'token_tabela'].includes(key))
                        .map(([key, value]) => (
                      <div key={key} className="col-12 col-md-6">
                        <div className="neo-card p-2 h-100">
                          <div className="small opacity-75">{DETAIL_FIELD_LABELS[key] || key}</div>
                          <div className="small text-wrap" style={{ whiteSpace: 'normal' }}>{formatDetailValue(key, value)}</div>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>

                  <div className="neo-card p-3 mt-3" style={{ borderColor: 'rgba(255, 140, 0, 0.35)' }}>
                    <div className="small opacity-75 mb-1">Descricao</div>
                    <div className="small text-break">{activeSelectedRow?.descricao || 'Sem descricao para esta consulta.'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <Footer />
    </div>
  )
}

