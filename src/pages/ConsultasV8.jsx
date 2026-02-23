import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import { FiAlertCircle, FiArrowLeft, FiCheckCircle, FiChevronDown, FiClock, FiDownload, FiEye, FiFileText, FiRefreshCw, FiTrash2, FiUpload } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext.jsx'
import { consultarImportacaoCsvV8Status } from '../services/v8Client.js'
import { notify } from '../utils/notify.js'

const V8_LARAVEL_BASE_PATH = '/api/consulta-v8'
const V8_CONSULTAS_GET_API_URL = 'https://n8n.apivieiracred.store/webhook/api/consulta-v8/'
const V8_CONSULTAS_DELETE_API_URL = `${V8_LARAVEL_BASE_PATH}/consultas`
const V8_CONSULTAS_RELEASE_API_URL = `${V8_LARAVEL_BASE_PATH}/liberar-pendentes`
const V8_LIMITES_GET_API_URL = 'https://n8n.apivieiracred.store/webhook/api/getconsulta-v8/'
const V8_INDIVIDUAL_API_URL = `${V8_LARAVEL_BASE_PATH}/individual`
const V8_BATCH_API_URL = V8_LARAVEL_BASE_PATH
const V8_ADD_LOGIN_API_URL = 'https://n8n.apivieiracred.store/webhook/api/adduser-consultav8'
const LIMITED_USER_ID = 3347
const DEFAULT_LIMIT_SUMMARY = { total: '-', usado: '-', restantes: '-' }
const DISABLE_V8_AUTO_POLLING = true
const BATCH_POST_INTERVAL_MS = 2000
const DEFAULT_BATCH_POST_PROGRESS = {
  fileName: '',
  total: 0,
  processed: 0,
  ok: 0,
  error: 0,
  phase: 'idle'
}

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)))

const canUser3347SeeRow = (row) => {
  const token = String(row?.token_usado ?? '').trim().toLowerCase()
  if (!token) return true
  return token === '*' || token === 'vision' || token === 'a vision'
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
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  const looksLikeHtml = contentType.includes('text/html') || /^\s*<!doctype html/i.test(raw) || /^\s*<html/i.test(raw)
  let payload = null
  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (looksLikeHtml) throw new Error(`Rota não encontrada (HTTP ${response.status})`)
    if (payload?.message) throw new Error(payload.message)
    if (payload?.error) throw new Error(payload.error)
    throw new Error(raw || `HTTP ${response.status}`)
  }

  if (looksLikeHtml) {
    throw new Error('A API retornou HTML em vez de JSON')
  }

  if (payload?.ok === false) {
    throw new Error(payload?.message || payload?.error || 'Falha na API')
  }

  return payload
}

const releasePendingConsultas = async ({ idUser, idEquipe, tipoConsulta, ids = [] }) => {
  const requestPayload = {
    id_user: Number(idUser),
    id_equipe: Number(idEquipe),
    tipoConsulta: String(tipoConsulta ?? '').trim(),
  }
  const parsedIds = Array.isArray(ids)
    ? ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : []

  if (parsedIds.length > 0) requestPayload.ids = parsedIds

  const response = await fetch(V8_CONSULTAS_RELEASE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(requestPayload),
  })

  return parseResponseBody(response)
}

const filterConsultasByUser = (rows, userId) => {
  const list = Array.isArray(rows) ? rows : []
  const parsedUserId = toNumberOrNull(userId)
  if (parsedUserId === null || parsedUserId === 1) return list

  return list.filter((row) => {
    const rowUserId = toNumberOrNull(row?.id_user ?? row?.idUser)
    return rowUserId !== null && rowUserId === parsedUserId
  })
}

const buildLimitSummaryFromRows = (rows) => {
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) return DEFAULT_LIMIT_SUMMARY

  const parseTotal = (row) => toNumberOrNull(row?.total ?? row?.limite)
  const parseUsado = (row) => toNumberOrNull(row?.consultados ?? row?.usado)

  const totalRow = list.find((row) => {
    const id = String(row?.id ?? '').trim()
    const email = String(row?.email ?? row?.login ?? '').trim().toUpperCase()
    const isAggregate = id === '0' || email === 'TOTAL'
    if (!isAggregate) return false
    return parseTotal(row) !== null || parseUsado(row) !== null
  })

  if (totalRow) {
    const total = parseTotal(totalRow) ?? 0
    const usado = parseUsado(totalRow) ?? 0
    return {
      total,
      usado,
      restantes: Math.max(0, total - usado),
    }
  }

  let total = 0
  let usado = 0
  let hasAnyNumeric = false

  for (const row of list) {
    const totalValue = parseTotal(row)
    const usadoValue = parseUsado(row)
    if (totalValue !== null) {
      total += totalValue
      hasAnyNumeric = true
    }
    if (usadoValue !== null) {
      usado += usadoValue
      hasAnyNumeric = true
    }
  }

  if (!hasAnyNumeric) return DEFAULT_LIMIT_SUMMARY

  return {
    total,
    usado,
    restantes: Math.max(0, total - usado),
  }
}

const resolveUserEquipeId = (user) => {
  return toNumberOrNull(user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId)
}

const resolveUserRoleId = (user) => {
  return toNumberOrNull(user?.id_role ?? user?.role_id ?? user?.roleId ?? user?.level)
}

const pickFromObjects = (objects, keys) => {
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue
    for (const key of keys) {
      const value = obj?.[key]
      if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
  }
  return ''
}

const pickRowValue = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

const resolveLimitSummary = (payload, rowsCount = 0) => {
  const root = (payload && typeof payload === 'object') ? payload : {}
  const objects = [root, root?.summary, root?.meta, root?.limite, root?.stats]
  const totalRaw = pickFromObjects(objects, ['total', 'limite_total', 'total_limite', 'total_creditos', 'creditos_total', 'limiteTotal'])
  const usadoRaw = pickFromObjects(objects, ['usado', 'utilizado', 'consumido', 'total_usado', 'creditos_usados', 'limite_usado'])
  const restantesRaw = pickFromObjects(objects, ['restantes', 'restante', 'saldo', 'disponivel', 'creditos_restantes', 'limite_restante'])

  let totalNum = toNumberOrNull(totalRaw)
  let usadoNum = toNumberOrNull(usadoRaw)
  let restantesNum = toNumberOrNull(restantesRaw)

  if (usadoNum === null) usadoNum = toNumberOrNull(rowsCount) ?? 0
  if (totalNum === null && restantesNum !== null) totalNum = usadoNum + restantesNum
  if (totalNum === null) totalNum = usadoNum
  if (restantesNum === null && totalNum !== null && usadoNum !== null) restantesNum = Math.max(0, totalNum - usadoNum)

  const toDisplay = (num, raw) => {
    if (num !== null && Number.isFinite(num)) return num
    const txt = String(raw ?? '').trim()
    return txt || '-'
  }

  return {
    total: toDisplay(totalNum, totalRaw),
    usado: toDisplay(usadoNum, usadoRaw),
    restantes: toDisplay(restantesNum, restantesRaw)
  }
}

const displayOrFallback = (value, fallback = '-') => {
  const text = String(value ?? '').trim()
  if (text) return value
  const fallbackText = String(fallback ?? '').trim()
  return fallbackText || '-'
}

const loginOptionLabel = (summary, idx = 0) => {
  const rawEmail = String(summary?.email || summary?.login || '').trim()
  const beforeAt = rawEmail.includes('@') ? rawEmail.split('@')[0] : rawEmail
  const userLabel = beforeAt || `login${idx + 1}`
  const empresa = String(summary?.empresa || '').trim() || 'Sem empresa'
  return `${userLabel} | ${empresa}`
}

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

const normalizeCpf11 = (value) => {
  const digits = onlyDigits(value)
  if (!digits) return ''
  const base = digits.length > 11 ? digits.slice(-11) : digits
  return base.padStart(11, '0')
}

const normalizeClientName = (value) => {
  const txt = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!txt) return ''
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

const formatCpf = (value) => {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return cpf || '-'
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

const parseMoney = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const str = String(value ?? '').trim()
  if (!str) return null
  const cleaned = str.replace(/[^\d,.-]/g, '')
  if (!cleaned) return null

  let normalized = cleaned
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  if (hasComma && hasDot) normalized = cleaned.replace(/\./g, '').replace(',', '.')
  else if (hasComma) normalized = cleaned.replace(',', '.')

  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

const formatPhone = (value) => {
  const phone = onlyDigits(value)
  if (phone.length === 11) return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
  if (phone.length === 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`
  return phone || '-'
}

const formatDate = (value, opts = {}) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR', opts.dateOnly ? {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  } : {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const parseLocalDateInput = (value, endOfDay = false) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || !month || !day) return null
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0)
}

const getAge = (birth) => {
  if (!birth) return null
  const date = new Date(birth)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const m = now.getMonth() - date.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age -= 1
  return Number.isFinite(age) ? age : null
}

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const sexoToken = (value) => {
  const token = String(value ?? '').trim().toLowerCase()
  if (token === 'male' || token === 'm' || token === 'masculino') {
    return 'M'
  }
  if (token === 'female' || token === 'f' || token === 'feminino') {
    return 'F'
  }
  return 'NI'
}

const renderSexo = (value) => {
  const token = sexoToken(value)
  if (token === 'M') {
    return <span style={{ color: '#245FE2', fontWeight: 700 }}>M</span>
  }
  if (token === 'F') {
    return <span style={{ color: '#ff2d55', fontWeight: 700 }}>F</span>
  }
  return <span className="opacity-75">NI</span>
}

const normalizeStatusToken = (status) => {
  return String(status ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

const V8_STATUS_PT_BR_MAP = {
  WAITING_CONSENT: 'Aguardando consentimento',
  WAITING_CONSULT: 'Aguardando consulta',
  WAITING_CREDIT_ANALYSIS: 'Aguardando análise de crédito',
  CONSENT_APPROVED: 'Consentimento aprovado',
  CONSENT_REJECTED: 'Consentimento recusado',
  CONSENT_DENIED: 'Consentimento negado',
  CONSENT_EXPIRED: 'Consentimento expirado',
  CONSENT_PENDING: 'Consentimento pendente',
  CREDIT_ANALYSIS_APPROVED: 'Análise de crédito aprovada',
  CREDIT_ANALYSIS_REJECTED: 'Análise de crédito reprovada',
  CREDIT_ANALYSIS_DENIED: 'Análise de crédito negada',
  APPROVED: 'Aprovado',
  REJECTED: 'Reprovado',
  DENIED: 'Negado',
  ERROR: 'Erro',
  FAILED: 'Falha',
  PENDING: 'Pendente',
  PENDENTE: 'Pendente',
  PROCESSING: 'Processando',
  IN_PROGRESS: 'Em processamento',
  COMPLETED: 'Concluído',
  SUCCESS: 'Sucesso',
  CANCELLED: 'Cancelado',
  CANCELED: 'Cancelado',
  EXPIRED: 'Expirado',
  NOT_FOUND: 'Não encontrado',
  NO_OFFER: 'Sem oferta',
  NO_OFFERS: 'Sem ofertas',
}

const formatUnknownV8StatusLabel = (status) => {
  const raw = String(status ?? '').trim()
  if (!raw) return ''
  if (!/[a-z]/.test(raw) && /[_-]/.test(raw)) {
    return raw
      .toLowerCase()
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }
  return raw
}

const translateV8StatusLabel = (status) => {
  const raw = String(status ?? '').trim()
  if (!raw) return ''
  const token = normalizeStatusToken(raw).replace(/\s+/g, '_')
  return V8_STATUS_PT_BR_MAP[token] || formatUnknownV8StatusLabel(raw)
}

const getV8RowStatus = (row) => {
  return String(
    pickRowValue(
      row,
      ['status_consulta_v8', 'statusConsultaV8', 'status_consulta', 'status', 'situacao', 'final_status'],
      ''
    )
  ).trim()
}

const isSuccessV8Status = (status) => {
  const token = normalizeStatusToken(status)
  if (!token) return false
  return (
    token.includes('APROV') ||
    token.includes('SUCESSO') ||
    token.includes('SUCCESS') ||
    token.includes('CONCLUIDO') ||
    token.includes('CONCLUIDA')
  )
}

const statusClassName = (status) => {
  const token = normalizeStatusToken(status)
  if (!token) return 'text-bg-secondary'
  if (isSuccessV8Status(token)) return 'text-bg-success'
  if (token.includes('WAITING') || token.includes('CONSENT')) return 'text-bg-warning'
  if (token.includes('REPROV') || token.includes('RECUS') || token.includes('ERROR')) return 'text-bg-danger'
  return 'text-bg-secondary'
}

const isPendingV8Status = (status) => {
  const token = normalizeStatusToken(status)
    .toUpperCase()
    .replace(/\s+/g, '_')

  if (!token) return false

  const explicitPendingStatuses = new Set([
    'PENDENTE',
    'PENDING',
    'CONSENT_APPROVED',
    'WAITING_CONSULT',
    'WAITING_CREDIT_ANALYSIS',
    'AGUARDANDO_CONSULTA',
    'AGUARDANDO_ANALISE_DE_CREDITO',
    'CONSENTIMENTO_APROVADO'
  ])

  if (explicitPendingStatuses.has(token)) return true

  return (
    token.includes('PEND') ||
    token.includes('WAITING') ||
    token.includes('CONSENT') ||
    token.includes('AGUARDANDO') ||
    (token.includes('ANALISE') && token.includes('CREDITO')) ||
    token.includes('PROCESS')
  )
}

const hasPendingRows = (rows) => {
  const list = Array.isArray(rows) ? rows : []
  return list.some((row) => isPendingV8Status(getV8RowStatus(row)))
}

const normalizeNameToken = (value) => {
  const txt = String(value ?? '').trim()
  if (!txt) return ''
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

const rowMatchesPollingQuery = (row, query) => {
  if (!query || typeof query !== 'object') return true
  const expectedCpf = onlyDigits(query?.cpf)
  const expectedNome = normalizeNameToken(query?.nome)
  const rowCpf = onlyDigits(row?.cliente_cpf ?? row?.cpf)
  const rowNome = normalizeNameToken(row?.cliente_nome ?? row?.nome)
  const byCpf = !expectedCpf || (rowCpf && rowCpf === expectedCpf)
  const byNome = !expectedNome || (rowNome && rowNome === expectedNome)
  return byCpf && byNome
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

const getRowSortTimestamp = (row) => {
  const raw = row?.created_at || row?.updated_at || row?.createdAt || row?.updatedAt || 0
  const ts = new Date(raw).getTime()
  return Number.isFinite(ts) ? ts : 0
}

const getV8RowIdentityKey = (row) => {
  const cpf = normalizeCpf11(row?.cliente_cpf ?? row?.cpf)
  const nome = normalizeNameToken(row?.cliente_nome ?? row?.nome)
  const telefone = onlyDigits(row?.telefone ?? row?.phone ?? row?.celular ?? '')
  if (cpf || nome || telefone) {
    return `${cpf}|${nome}|${telefone}`
  }

  const id = String(row?.id ?? '').trim()
  const createdAt = String(row?.created_at ?? row?.createdAt ?? '').trim()
  const updatedAt = String(row?.updated_at ?? row?.updatedAt ?? '').trim()
  return `fallback|${id}|${createdAt}|${updatedAt}`
}

const dedupeRowsByIdentityLatest = (rows) => {
  const list = Array.isArray(rows) ? rows : []
  const byKey = new Map()

  for (const row of list) {
    const key = getV8RowIdentityKey(row)
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, row)
      continue
    }

    if (getRowSortTimestamp(row) >= getRowSortTimestamp(prev)) {
      byKey.set(key, row)
    }
  }

  return Array.from(byKey.values())
}

const pickLatestRow = (rows) => {
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) return null
  return list.reduce((acc, row) => {
    if (!acc) return row
    return getRowSortTimestamp(row) >= getRowSortTimestamp(acc) ? row : acc
  }, null)
}

const findBestRowForModal = (rows, prevRow) => {
  if (!prevRow) return null
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) return null

  const prevId = String(prevRow?.id ?? '').trim()
  if (prevId) {
    const byId = list.find((row) => String(row?.id ?? '').trim() === prevId)
    if (byId) return byId
  }

  const prevCpf = onlyDigits(prevRow?.cliente_cpf ?? prevRow?.cpf)
  const prevNome = normalizeNameToken(prevRow?.cliente_nome ?? prevRow?.nome)
  const matched = list.filter((row) => {
    const rowCpf = onlyDigits(row?.cliente_cpf ?? row?.cpf)
    const rowNome = normalizeNameToken(row?.cliente_nome ?? row?.nome)
    const byCpf = !prevCpf || !rowCpf || rowCpf === prevCpf
    const byNome = !prevNome || !rowNome || rowNome === prevNome
    return byCpf && byNome
  })

  const latestMatched = pickLatestRow(matched)
  return latestMatched || null
}

const mergeRowsKeepingSuccessStatus = (previousRows, nextRows) => {
  const prevList = Array.isArray(previousRows) ? previousRows : []
  const nextList = Array.isArray(nextRows) ? nextRows : []
  if (prevList.length === 0 || nextList.length === 0) return nextList

  const prevById = new Map()
  for (const row of prevList) {
    const id = String(row?.id ?? '').trim()
    if (!id) continue
    prevById.set(id, row)
  }

  return nextList.map((nextRow) => {
    const id = String(nextRow?.id ?? '').trim()
    if (!id) return nextRow
    const prevRow = prevById.get(id)
    if (!prevRow) return nextRow

    const prevStatus = getV8RowStatus(prevRow)
    const nextStatus = getV8RowStatus(nextRow)
    if (!isSuccessV8Status(prevStatus)) return nextRow

    const nextIsPendingOrEmpty = !String(nextStatus ?? '').trim() || isPendingV8Status(nextStatus)
    if (!nextIsPendingOrEmpty) return nextRow

    return {
      ...nextRow,
      status_consulta_v8: prevStatus,
      mensagem: String(nextRow?.mensagem ?? '').trim() ? nextRow?.mensagem : prevRow?.mensagem,
      descricao: String(nextRow?.descricao ?? '').trim() ? nextRow?.descricao : prevRow?.descricao
    }
  })
}

const mergeRowsPreservingPreviousById = (previousRows, nextRows) => {
  const prevList = Array.isArray(previousRows) ? previousRows : []
  const nextList = Array.isArray(nextRows) ? nextRows : []
  if (prevList.length === 0) return nextList
  if (nextList.length === 0) return prevList

  const byId = new Map()
  const prevNoId = []
  const nextNoId = []

  for (const row of prevList) {
    const id = String(row?.id ?? '').trim()
    if (!id) {
      prevNoId.push(row)
      continue
    }
    byId.set(id, row)
  }

  for (const row of nextList) {
    const id = String(row?.id ?? '').trim()
    if (!id) {
      nextNoId.push(row)
      continue
    }
    byId.set(id, row)
  }

  const mergedNoId = dedupeRowsByIdentityLatest([...nextNoId, ...prevNoId])
  return [...byId.values(), ...mergedNoId]
}

const normalizeDescricao = (value) => {
  const txt = String(value ?? '').trim()
  return txt || 'Sem descrição'
}

const descricaoKey = (value) => normalizeDescricao(value).toLowerCase()

const normalizeProvidedPhone = (value) => {
  const digits = onlyDigits(value)
  if (!digits) return ''
  return digits.length > 11 ? digits.slice(-11) : digits
}

const generateRandomPhone11 = () => {
  const ddd = Math.floor(Math.random() * 89) + 11
  const tail = Math.floor(Math.random() * (99999999 - 11111111 + 1)) + 11111111
  return `${ddd}9${String(tail).padStart(8, '0')}`
}

const normalizeOrGenerateBatchPhone = (value) => {
  const provided = normalizeProvidedPhone(value)
  if (provided) return provided
  return generateRandomPhone11()
}

const normalizeHeaderToken = (value) => {
  const txt = String(value ?? '').trim()
  if (!txt) return ''
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const parseSemicolonCsvLine = (line) => {
  const src = String(line ?? '')
  const out = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === '"') {
      if (inQuotes && src[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ';' && !inQuotes) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)

  return out.map((cell, idx) => {
    const value = String(cell ?? '').trim()
    if (idx === 0) return value.replace(/^\uFEFF/, '')
    return value
  })
}

const parseBatchCsvFile = (rawText, fileName = '') => {
  const text = String(rawText ?? '').replace(/^\uFEFF/, '')
  const lines = text
    .split(/\r?\n/)
    .map((line) => String(line ?? '').trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return { ok: false, error: 'Arquivo CSV vazio.' }
  }

  const headerCells = parseSemicolonCsvLine(lines[0])
  if (headerCells.length < 2) {
    return { ok: false, error: 'CSV invalido. Use separador ; e colunas cpf;nome.' }
  }

  const headerTokens = headerCells.map(normalizeHeaderToken)
  const cpfIndex = headerTokens.indexOf('cpf')
  const nomeIndex = headerTokens.indexOf('nome')
  const telefoneIndex = headerTokens.findIndex((token) => token === 'telefone' || token === 'phone' || token === 'celular')
  if (cpfIndex === -1 || nomeIndex === -1) {
    return { ok: false, error: 'CSV precisa ter as colunas obrigatorias: cpf e nome.' }
  }

  const validRows = []
  const invalidRows = []

  for (let idx = 1; idx < lines.length; idx += 1) {
    const cells = parseSemicolonCsvLine(lines[idx])
    const rawCpf = cells[cpfIndex] ?? ''
    const rawNome = cells[nomeIndex] ?? ''
    const rawTelefone = telefoneIndex >= 0 ? (cells[telefoneIndex] ?? '') : ''
    const cpf = normalizeCpf11(rawCpf)
    const nome = normalizeClientName(rawNome)
    const telefone = normalizeOrGenerateBatchPhone(rawTelefone)

    if (!cpf || !nome) {
      invalidRows.push({
        line: idx + 1,
        cpf: String(rawCpf ?? ''),
        nome: String(rawNome ?? ''),
        telefone: String(rawTelefone ?? ''),
        reason: 'cpf ou nome invalido'
      })
      continue
    }

    validRows.push({
      line: idx + 1,
      cpf,
      nome,
      telefone
    })
  }

  const uniqueValidRows = dedupeRowsByIdentityLatest(validRows)

  if (uniqueValidRows.length === 0) {
    return {
      ok: false,
      error: 'Nenhuma linha valida encontrada no CSV.',
      fileName,
      totalRows: Math.max(0, lines.length - 1),
      validRows: uniqueValidRows,
      invalidRows
    }
  }

  return {
    ok: true,
    fileName,
    totalRows: Math.max(0, lines.length - 1),
    validRows: uniqueValidRows,
    invalidRows
  }
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
  const explicit = parseDurationToMs(pickRowValue(row, ['tempo_medio', 'tempoMedio', 'tempo_medio_ms', 'avg_duration_ms', 'duracao_ms'], null))
  if (explicit !== null) return explicit

  const createdAt = new Date(row?.created_at || row?.createdAt || 0).getTime()
  const updatedAt = new Date(row?.updated_at || row?.updatedAt || 0).getTime()
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null
  if (updatedAt < createdAt) return null
  return updatedAt - createdAt
}

const formatAvgDuration = (value) => {
  const ms = parseDurationToMs(value)
  if (ms === null) return '-'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)} s`
  const min = Math.floor(sec / 60)
  const rem = Math.round(sec % 60)
  return `${min}m ${String(rem).padStart(2, '0')}s`
}

const toCsvEscaped = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const formatValorLiberadoCsv = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const parsed = parseMoney(value)
  if (parsed !== null) {
    return parsed.toFixed(2).replace('.', ',')
  }
  return String(value).replace(/\./g, ',')
}

const mapRowToV8CsvPayload = (row, fallbackTipoConsulta = '') => {
  const rawCpf = String(row?.cliente_cpf ?? row?.cpf ?? '').trim()
  const rawNome = String(row?.cliente_nome ?? row?.nome ?? '').trim()
  const rawTelefone = String(row?.telefone ?? row?.phone ?? row?.celular ?? '').trim()

  const clienteCpf = rawCpf || normalizeCpf11(row?.cliente_cpf ?? row?.cpf)
  const clienteNome = rawNome
  const telefone = rawTelefone ? normalizeProvidedPhone(rawTelefone) : ''
  const mensagem = String(row?.mensagem ?? row?.descricao ?? '').trim()
  const tipoConsulta = String(
    pickRowValue(
      row,
      ['tipoConsulta', 'tipo_consulta', 'tipoConsultaV8', 'tipo_consulta_v8', 'nome_arquivo', 'nomeArquivo', 'arquivo', 'file_name', 'fileName'],
      fallbackTipoConsulta
    )
  ).trim()
  const statusConsultaV8 = getV8RowStatus(row)
  const valorLiberado = formatValorLiberadoCsv(row?.valor_liberado ?? row?.valorLiberado ?? row?.valor)
  const createdAt = String(row?.created_at ?? row?.createdAt ?? '').trim()
  const updatedAt = String(row?.updated_at ?? row?.updatedAt ?? '').trim()
  const descricao = String(row?.descricao ?? row?.descricao_v8 ?? row?.mensagem ?? '').trim()

  return {
    cliente_cpf: clienteCpf,
    cliente_nome: clienteNome,
    telefone,
    mensagem,
    descricao,
    tipoConsulta,
    status_consulta_v8: statusConsultaV8,
    valor_liberado: valorLiberado,
    created_at: createdAt,
    updated_at: updatedAt
  }
}

const dedupeV8CsvRows = (rows) => {
  const list = Array.isArray(rows) ? rows : []
  const seen = new Set()
  const out = []

  for (const row of list) {
    const key = [
      row?.cliente_cpf ?? '',
      row?.cliente_nome ?? '',
      row?.telefone ?? '',
      row?.mensagem ?? '',
      row?.tipoConsulta ?? '',
      row?.status_consulta_v8 ?? '',
      row?.valor_liberado ?? '',
      row?.created_at ?? '',
      row?.updated_at ?? ''
    ].map((v) => String(v ?? '').trim().toLowerCase()).join('|')

    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }

  return out
}

const getBatchFileNameFromRow = (row) => {
  return String(pickRowValue(row, [
    'nome_arquivo',
    'nomeArquivo',
    'arquivo',
    'file_name',
    'fileName',
    'lote',
    'batch',
    'tipoConsulta',
    'tipo_consulta',
    'tipoConsultaV8',
    'tipo_consulta_v8'
  ], '')).trim()
}

const getTipoConsultaFromRow = (row) => {
  return String(pickRowValue(row, [
    'tipoConsulta',
    'tipo_consulta',
    'tipoConsultaV8',
    'tipo_consulta_v8'
  ], '')).trim()
}

const resolveRowUserId = (row) => {
  return toNumberOrNull(
    row?.id_user
    ?? row?.idUser
    ?? row?.user_id
    ?? row?.userId
  )
}

const resolveRowEquipeId = (row) => {
  return toNumberOrNull(
    row?.id_equipe
    ?? row?.idEquipe
    ?? row?.equipe_id
    ?? row?.equipeId
    ?? row?.team_id
    ?? row?.teamId
  )
}

const isIndividualBatchToken = (value) => {
  const token = normalizeHeaderToken(value).replace(/\s+/g, '')
  if (!token) return false
  return (
    token === 'individual' ||
    token === 'consultaindividual' ||
    token === 'indiv'
  )
}

const buildNormalizedBatchCsv = (rows) => {
  const list = Array.isArray(rows) ? rows : []
  const lines = ['cpf;nome;telefone']
  for (const row of list) {
    const cpf = normalizeCpf11(row?.cpf)
    const nome = normalizeClientName(row?.nome)
    const telefone = normalizeOrGenerateBatchPhone(row?.telefone)
    if (!cpf || !nome) continue
    lines.push(`${cpf};${nome};${telefone}`)
  }
  return lines.join('\r\n')
}

const formatElapsedTimer = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0)
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

const formatEtaMinutesOrHours = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0)
  const totalMinutes = Math.max(0, Math.ceil(safe / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) return `${hours}h ${minutes}min`
  return `${totalMinutes}min`
}

export default function ConsultasV8() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [limitSummary, setLimitSummary] = useState(DEFAULT_LIMIT_SUMMARY)
  const [limitRows, setLimitRows] = useState([])
  const [loadingLimites, setLoadingLimites] = useState(false)
  const [limitesError, setLimitesError] = useState('')
  const [loginSummaries, setLoginSummaries] = useState([])
  const [selectedLoginIndex, setSelectedLoginIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastSyncAt, setLastSyncAt] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [page, setPage] = useState(1)

  const [searchTerm, setSearchTerm] = useState('')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [updatedFrom, setUpdatedFrom] = useState('')
  const [updatedTo, setUpdatedTo] = useState('')
  const [descriptionFilters, setDescriptionFilters] = useState([])
  const [statusFilters, setStatusFilters] = useState([])
  const [valorMin, setValorMin] = useState('')
  const [valorMax, setValorMax] = useState('')
  const [consultaCpf, setConsultaCpf] = useState('')
  const [consultaNome, setConsultaNome] = useState('')
  const [consultaError, setConsultaError] = useState('')
  const [consultaMode, setConsultaMode] = useState('individual')
  const [pendingBatchUpload, setPendingBatchUpload] = useState(null)
  const [batchUploads, setBatchUploads] = useState([])
  const [batchUploadError, setBatchUploadError] = useState('')
  const [batchPreviewRow, setBatchPreviewRow] = useState(null)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState(null)
  const [uploadingBatchFile, setUploadingBatchFile] = useState(false)
  const [batchPostProgress, setBatchPostProgress] = useState(DEFAULT_BATCH_POST_PROGRESS)
  const [batchPostStartedAt, setBatchPostStartedAt] = useState(null)
  const [batchPostElapsedSeconds, setBatchPostElapsedSeconds] = useState(0)
  const [deletingBatch, setDeletingBatch] = useState(false)
  const [batchPollingTarget, setBatchPollingTarget] = useState(null)
  const [batchImportJob, setBatchImportJob] = useState(null)
  const [showAddLoginModal, setShowAddLoginModal] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novaEmpresa, setNovaEmpresa] = useState('')
  const [savingNovoLogin, setSavingNovoLogin] = useState(false)
  const [sendingConsultaIndividual, setSendingConsultaIndividual] = useState(false)
  const [autoPollingActive, setAutoPollingActive] = useState(false)
  const [pollingQuery, setPollingQuery] = useState(null)
  const pollInFlightRef = useRef(false)
  const batchPollInFlightRef = useRef(false)
  const pollSawPendingRef = useRef(false)
  const tableScrollRef = useRef(null)
  const batchFileInputRef = useRef(null)
  const rowsRef = useRef([])
  const fetchSeqRef = useRef(0)
  const canDeleteBatchByUser = toNumberOrNull(user?.id) === 1
  const batchPostTotal = Math.max(0, Number(batchPostProgress?.total ?? 0))
  const batchPostProcessed = Math.max(0, Number(batchPostProgress?.processed ?? 0))
  const batchPostPercent = batchPostTotal > 0
    ? Math.min(100, Math.round((batchPostProcessed / batchPostTotal) * 100))
    : 0
  const batchPostEtaSeconds = useMemo(() => {
    if (!uploadingBatchFile || batchPostTotal <= 0) return 0
    if (batchPostProgress?.phase === 'liberando') return 0

    const processed = Math.min(batchPostTotal, Math.max(0, Number(batchPostProcessed) || 0))
    const remaining = Math.max(0, batchPostTotal - processed)
    if (remaining === 0) return 0

    if (processed <= 0) {
      const intervalSeconds = Math.max(1, Math.ceil(BATCH_POST_INTERVAL_MS / 1000))
      return remaining * intervalSeconds
    }

    const elapsed = Math.max(1, Number(batchPostElapsedSeconds) || 0)
    const avgSecondsPerItem = elapsed / processed
    return Math.ceil(remaining * avgSecondsPerItem)
  }, [uploadingBatchFile, batchPostTotal, batchPostProcessed, batchPostElapsedSeconds, batchPostProgress?.phase])

  useEffect(() => {
    if (!uploadingBatchFile || !batchPostStartedAt) {
      setBatchPostElapsedSeconds(0)
      return undefined
    }

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - Number(batchPostStartedAt)) / 1000)
      setBatchPostElapsedSeconds(Math.max(0, elapsed))
    }

    updateElapsed()
    const intervalId = setInterval(updateElapsed, 1000)
    return () => clearInterval(intervalId)
  }, [uploadingBatchFile, batchPostStartedAt])

  const fetchLimites = useCallback(async (signal, options = {}) => {
    const silent = options?.silent === true
    if (!silent) {
      setLoadingLimites(true)
      setLimitesError('')
    }

    try {
      const userId = toNumberOrNull(user?.id)
      const equipeId = resolveUserEquipeId(user)
      if (userId === null || equipeId === null) {
        setLimitRows([])
        setLimitSummary(DEFAULT_LIMIT_SUMMARY)
        return []
      }

      const requestUrl = new URL(V8_LIMITES_GET_API_URL)
      requestUrl.searchParams.set('id_user', String(userId))
      requestUrl.searchParams.set('equipe_id', String(equipeId))

      const response = await fetch(requestUrl.toString(), { method: 'GET', signal })
      const payload = await parseResponseBody(response)
      const normalized = normalizeRows(payload)

      setLimitRows(normalized)
      setLimitSummary(buildLimitSummaryFromRows(normalized))
      return normalized
    } catch (err) {
      if (err?.name === 'AbortError') return []
      setLimitRows([])
      setLimitSummary(DEFAULT_LIMIT_SUMMARY)
      setLimitesError(err?.message || 'Falha ao carregar limites V8')
      return []
    } finally {
      if (!silent && !signal?.aborted) setLoadingLimites(false)
    }
  }, [user])

  const fetchConsultas = useCallback(async (signal, query = {}, options = {}) => {
    const requestSeq = ++fetchSeqRef.current
    const silent = options?.silent === true
    const preservePosition = options?.preservePosition === true
    let windowY = 0
    let tableTop = 0
    let tableLeft = 0

    if (!silent) {
      setLoading(true)
      setError('')
    }

    if (preservePosition && typeof window !== 'undefined') {
      windowY = window.scrollY || 0
      const tableEl = tableScrollRef.current
      if (tableEl) {
        tableTop = tableEl.scrollTop
        tableLeft = tableEl.scrollLeft
      }
    }

    try {
      const userId = toNumberOrNull(user?.id)

      if (userId === null) {
        rowsRef.current = []
        setRows([])
        return []
      }

      const requestUrl = new URL(V8_CONSULTAS_GET_API_URL)
      requestUrl.searchParams.set('id_user', String(userId))
      const equipeId = resolveUserEquipeId(user)
      if (equipeId !== null) requestUrl.searchParams.set('equipe_id', String(equipeId))
      if (userId === 1) requestUrl.searchParams.set('all', '1')

      const normalizedCpf = normalizeCpf11(query?.cpf)
      const normalizedNome = normalizeClientName(query?.nome)
      const hasScopedQuery = Boolean(normalizedCpf || normalizedNome)
      if (normalizedCpf) requestUrl.searchParams.set('cpf', normalizedCpf)
      if (normalizedNome) requestUrl.searchParams.set('nome', normalizedNome)

      const response = await fetch(requestUrl.toString(), { method: 'GET', signal })
      const payload = await parseResponseBody(response)
      const normalizedRows = filterConsultasByUser(normalizeRows(payload), userId)
      if (requestSeq !== fetchSeqRef.current) {
        return rowsRef.current
      }

      const mergedRows = mergeRowsKeepingSuccessStatus(rowsRef.current, normalizedRows)
      const nextRows = hasScopedQuery
        ? mergeRowsPreservingPreviousById(rowsRef.current, mergedRows)
        : mergedRows

      rowsRef.current = nextRows
      setRows(nextRows)
      setSelectedRow((prev) => {
        if (!prev) return prev
        const synced = findBestRowForModal(nextRows, prev)
        return synced || prev
      })
      setLastSyncAt(new Date())

      if (preservePosition && typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          window.scrollTo({ top: windowY, left: 0, behavior: 'auto' })
          const tableEl = tableScrollRef.current
          if (tableEl) {
            tableEl.scrollTop = tableTop
            tableEl.scrollLeft = tableLeft
          }
        })
      }

      return nextRows
    } catch (err) {
      if (err?.name === 'AbortError') return
      if (requestSeq !== fetchSeqRef.current) return rowsRef.current
      rowsRef.current = []
      setRows([])
      setError(err?.message || 'Falha ao carregar consultas V8')
      return []
    } finally {
      if (!silent && !signal?.aborted && requestSeq === fetchSeqRef.current) setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    const controller = new AbortController()
    fetchLimites(controller.signal)
    return () => controller.abort()
  }, [fetchLimites])

  useEffect(() => {
    const controller = new AbortController()
    fetchConsultas(controller.signal)
    return () => controller.abort()
  }, [fetchConsultas])

  useEffect(() => {
    if (DISABLE_V8_AUTO_POLLING) return undefined
    if (!autoPollingActive) return undefined

    let cancelled = false
    const tick = async () => {
      if (cancelled || pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        const latestRows = await fetchConsultas(undefined, pollingQuery || {}, { silent: true, preservePosition: true })
        if (cancelled) return

        const scopedRows = (pollingQuery && typeof pollingQuery === 'object')
          ? latestRows.filter((row) => rowMatchesPollingQuery(row, pollingQuery))
          : latestRows

        // Enquanto a consulta alvo ainda não apareceu, mantém polling.
        if ((pollingQuery && typeof pollingQuery === 'object') && scopedRows.length === 0) return

        const latestScopedRow = scopedRows.reduce((acc, row) => {
          if (!acc) return row
          return getRowSortTimestamp(row) >= getRowSortTimestamp(acc) ? row : acc
        }, null)
        if (!latestScopedRow) return

        const latestIsPending = isPendingV8Status(getV8RowStatus(latestScopedRow))
        if (latestIsPending) {
          pollSawPendingRef.current = true
          return
        }

        // Para somente quando o registro mais recente sair de pendente.
        setAutoPollingActive(false)
        setPollingQuery(null)
        fetchLimites(undefined, { silent: true })
        fetchConsultas(undefined, {}, { silent: true, preservePosition: true })
      } finally {
        pollInFlightRef.current = false
      }
    }

    tick()
    const interval = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [autoPollingActive, pollingQuery, fetchConsultas, fetchLimites])

  useEffect(() => {
    if (DISABLE_V8_AUTO_POLLING) return undefined
    const fileName = String(batchPollingTarget?.fileName ?? '').trim()
    if (!fileName) return undefined

    let cancelled = false
    const normalizedTarget = normalizeHeaderToken(fileName)

    const tick = async () => {
      if (cancelled || batchPollInFlightRef.current) return
      batchPollInFlightRef.current = true
      try {
        const latestRows = await fetchConsultas(undefined, {}, { silent: true, preservePosition: true })
        if (cancelled) return

        const scopedRows = (Array.isArray(latestRows) ? latestRows : []).filter((row) => {
          const rowBatchName = getBatchFileNameFromRow(row)
          return normalizeHeaderToken(rowBatchName) === normalizedTarget
        })

        // Enquanto o lote ainda não aparece no retorno, continua polling.
        if (scopedRows.length === 0) return

        const hasPending = scopedRows.some((row) => isPendingV8Status(getV8RowStatus(row)))
        if (hasPending) return

        setBatchPollingTarget(null)
        fetchLimites(undefined, { silent: true })
      } finally {
        batchPollInFlightRef.current = false
      }
    }

    tick()
    const interval = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [batchPollingTarget, fetchConsultas, fetchLimites])

  useEffect(() => {
    if (DISABLE_V8_AUTO_POLLING) return undefined
    const jobId = String(batchImportJob?.jobId ?? '').trim()
    if (!jobId) return undefined

    let cancelled = false
    let errorsCount = 0

    const tick = async () => {
      if (cancelled) return
      try {
        const status = await consultarImportacaoCsvV8Status({ jobId })
        if (cancelled) return
        errorsCount = 0

        if (status.failed) {
          setBatchImportJob(null)
          notify.error('Falha no processamento do lote.', { autoClose: 2800 })
          fetchConsultas(undefined, {}, { silent: true, preservePosition: true })
          fetchLimites(undefined, { silent: true })
          return
        }

        if (status.done) {
          setBatchImportJob(null)
          notify.success('Lote processado com sucesso.', { autoClose: 2400 })
          fetchConsultas(undefined, {}, { silent: true, preservePosition: true })
          fetchLimites(undefined, { silent: true })
        }
      } catch {
        errorsCount += 1
        if (errorsCount >= 4) {
          setBatchImportJob(null)
          notify.warn('Nao foi possivel acompanhar o status do lote.', { autoClose: 2600 })
        }
      }
    }

    tick()
    const interval = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [batchImportJob, fetchConsultas, fetchLimites])

  const openAddLoginModal = useCallback(() => {
    setNovoEmail('')
    setNovaSenha('')
    setNovaEmpresa('')
    setShowAddLoginModal(true)
  }, [])

  const handleNovoLoginSubmit = useCallback(async (event) => {
    event.preventDefault()
    if (savingNovoLogin) return

    const email = String(novoEmail ?? '').trim().toLowerCase()
    const senha = String(novaSenha ?? '').trim()
    const empresa = String(novaEmpresa ?? '').trim()
    if (!email || !senha || !empresa) {
      notify.warn('Preencha email, senha e empresa.', { autoClose: 2200 })
      return
    }
    if (!email.includes('@')) {
      notify.warn('Informe um email válido.', { autoClose: 2200 })
      return
    }
    if (!user?.id) {
      notify.error('Usuário sem ID para cadastrar login.', { autoClose: 2400 })
      return
    }

    try {
      setSavingNovoLogin(true)
      const response = await fetch(V8_ADD_LOGIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          senha,
          empresa,
          id_user: user.id
        })
      })
      const rawText = await response.text()
      if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

      notify.success('Novo login enviado com sucesso.', { autoClose: 2200 })
      setShowAddLoginModal(false)
      fetchLimites()
    } catch (err) {
      notify.error(err?.message || 'Falha ao enviar novo login.', { autoClose: 2800 })
    } finally {
      setSavingNovoLogin(false)
    }
  }, [savingNovoLogin, novoEmail, novaSenha, novaEmpresa, user?.id, fetchLimites])

  const handleConsultaSubmit = useCallback(async (event) => {
    event.preventDefault()
    const normalizedCpf = normalizeCpf11(consultaCpf)
    const normalizedNome = normalizeClientName(consultaNome)
    setConsultaCpf(normalizedCpf)
    setConsultaNome(normalizedNome)

    if (!normalizedCpf || !normalizedNome) {
      setConsultaError('Informe CPF e nome do cliente.')
      return
    }

    const userId = toNumberOrNull(user?.id)
    if (userId === null) {
      setConsultaError('Usuario sem ID para consulta.')
      return
    }

    const equipeId = resolveUserEquipeId(user)
    if (equipeId === null) {
      setConsultaError('Usuario sem id_equipe para consulta.')
      return
    }

    const roleId = resolveUserRoleId(user)
    if (roleId === null) {
      setConsultaError('Usuario sem id_role para consulta.')
      return
    }

    const payload = {
      cliente_cpf: normalizedCpf,
      cliente_nome: normalizedNome,
      tipoConsulta: 'Individual',
      id_user: userId,
      id_equipe: equipeId,
      id_role: roleId,
      hold_pending: true
    }

    try {
      setSendingConsultaIndividual(true)
      setConsultaError('')
      const response = await fetch(V8_INDIVIDUAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const responsePayload = await parseResponseBody(response)
      const insertedId = toNumberOrNull(responsePayload?.data?.id)
      if (!insertedId) {
        throw new Error('Nao foi possivel identificar o ID da consulta adicionada.')
      }
      await releasePendingConsultas({
        idUser: userId,
        idEquipe: equipeId,
        tipoConsulta: 'Individual',
        ids: [insertedId]
      })

      if ([200, 201].includes(response.status)) {
        notify.success('Consulta iniciada.', { autoClose: 2200 })
      } else {
        notify.success('Consulta individual enviada com sucesso.', { autoClose: 2200 })
      }
      setSelectedRow({
        id: '-',
        cliente_cpf: normalizedCpf,
        cliente_nome: normalizedNome,
        tipoConsulta: 'Individual',
        status_consulta_v8: 'Aguardando Consulta',
        mensagem: 'Consulta iniciada. Aguardando retorno...',
        created_at: new Date().toISOString(),
        telefone: '',
        valor_liberado: '',
        descricao: ''
      })
      pollSawPendingRef.current = false
      setPollingQuery({ cpf: normalizedCpf, nome: normalizedNome })
      setAutoPollingActive(true)
      fetchConsultas(undefined, {}, { silent: true, preservePosition: true })
    } catch (err) {
      const msg = err?.message || 'Falha ao enviar consulta individual.'
      setConsultaError(msg)
      notify.error(msg, { autoClose: 2800 })
    } finally {
      setSendingConsultaIndividual(false)
    }
  }, [consultaCpf, consultaNome, fetchConsultas, user])

  const openBatchFilePicker = useCallback(() => {
    if (!batchFileInputRef.current) return
    batchFileInputRef.current.click()
  }, [])

  const handleBatchFileChange = useCallback(async (event) => {
    const input = event?.target
    const file = input?.files?.[0]
    if (!file) return

    try {
      const fileName = String(file?.name ?? '').trim()
      if (!fileName.toLowerCase().endsWith('.csv')) {
        const msg = 'Selecione um arquivo .csv.'
        setBatchUploadError(msg)
        setPendingBatchUpload(null)
        notify.warn(msg, { autoClose: 2200 })
        return
      }

      const rawText = await file.text()
      const parsed = parseBatchCsvFile(rawText, fileName)
      if (!parsed.ok) {
        const msg = parsed?.error || 'Arquivo CSV invalido.'
        setBatchUploadError(msg)
        setPendingBatchUpload(null)
        notify.error(msg, { autoClose: 2800 })
        return
      }

      setBatchUploadError('')
      setPendingBatchUpload({
        id: `draft-${Date.now()}`,
        fileName: parsed.fileName || fileName,
        totalRows: parsed.totalRows,
        validRows: parsed.validRows,
        invalidRows: parsed.invalidRows,
        status: 'Pronto',
        createdAt: new Date().toISOString()
      })
      notify.success(`Arquivo validado: ${parsed.validRows.length} nome(s) pronto(s).`, { autoClose: 2200 })
    } catch (err) {
      const msg = err?.message || 'Falha ao ler o CSV.'
      setBatchUploadError(msg)
      setPendingBatchUpload(null)
      notify.error(msg, { autoClose: 2600 })
    } finally {
      if (input) input.value = ''
    }
  }, [])

  const batchUploadInFlightRef = useRef(false)

  const addPendingBatchToList = useCallback(async () => {
    if (uploadingBatchFile) return
    if (batchUploadInFlightRef.current) return
    if (!pendingBatchUpload) {
      notify.warn('Selecione e valide um CSV primeiro.', { autoClose: 2200 })
      return
    }

    const userId = toNumberOrNull(user?.id)
    if (userId === null) {
      notify.error('Usuario sem ID para envio do lote.', { autoClose: 2600 })
      return
    }

    const equipeId = resolveUserEquipeId(user)
    if (equipeId === null) {
      notify.error('Usuario sem id_equipe para envio do lote.', { autoClose: 2600 })
      return
    }

    const roleId = resolveUserRoleId(user)
    if (roleId === null) {
      notify.error('Usuario sem id_role para envio do lote.', { autoClose: 2600 })
      return
    }

    const nomeArquivo = String(pendingBatchUpload?.fileName || `lote_${Date.now()}.csv`).trim()
    const validRows = Array.isArray(pendingBatchUpload?.validRows) ? pendingBatchUpload.validRows : []
    if (validRows.length === 0) {
      notify.error('CSV sem linhas validas para envio.', { autoClose: 2600 })
      return
    }

    const startedAtIso = new Date().toISOString()
    let insertedIds = []
    let okCount = 0
    let errCount = 0
    let releasedToPending = false

    batchUploadInFlightRef.current = true
    try {
      setUploadingBatchFile(true)
      setBatchUploadError('')
      setBatchPostStartedAt(Date.now())
      setBatchPostElapsedSeconds(0)
      setBatchPostProgress({
        fileName: nomeArquivo,
        total: validRows.length,
        processed: 0,
        ok: 0,
        error: 0,
        phase: 'enviando'
      })

      const batchRowsPayload = validRows
        .map((row) => ({
          cliente_cpf: normalizeCpf11(row?.cpf),
          cliente_nome: normalizeClientName(row?.nome),
          telefone: normalizeOrGenerateBatchPhone(row?.telefone),
        }))
        .filter((row) => row.cliente_cpf && row.cliente_nome)

      if (batchRowsPayload.length === 0) {
        notify.error('CSV sem linhas validas para envio.', { autoClose: 2600 })
        return
      }

      const bulkStartedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      const response = await fetch(V8_BATCH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          id_user: userId,
          id_equipe: equipeId,
          id_role: roleId,
          tipoConsulta: nomeArquivo,
          hold_pending: true,
          rows: batchRowsPayload
        })
      })
      const responsePayload = await parseResponseBody(response)
      const responseData = (responsePayload && typeof responsePayload === 'object')
        ? (responsePayload?.data && typeof responsePayload.data === 'object' ? responsePayload.data : responsePayload)
        : {}
      const rawIds = Array.isArray(responseData?.ids) ? responseData.ids : []
      insertedIds = rawIds
        .map((id) => toNumberOrNull(id))
        .filter((id) => Number.isInteger(id) && id > 0)

      const insertedCountFromApi = toNumberOrNull(
        responseData?.inserted_count
        ?? responseData?.insertedCount
        ?? responseData?.total_inserted
        ?? responseData?.count
      )
      const inferredInserted = insertedIds.length > 0 ? insertedIds.length : batchRowsPayload.length
      okCount = Math.max(0, Math.min(batchRowsPayload.length, insertedCountFromApi ?? inferredInserted))
      errCount = Math.max(0, batchRowsPayload.length - okCount)

      setBatchPostProgress((prev) => ({
        ...prev,
        total: batchRowsPayload.length,
        processed: batchRowsPayload.length,
        ok: okCount,
        error: errCount
      }))

      const bulkEndedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      const bulkElapsedMs = Number(bulkEndedAt) - Number(bulkStartedAt)
      const avgDurationMs = (Number.isFinite(bulkElapsedMs) && bulkElapsedMs >= 0 && batchRowsPayload.length > 0)
        ? bulkElapsedMs / batchRowsPayload.length
        : null

      setPendingBatchUpload(null)
      if (okCount > 0) {
        setBatchPostProgress((prev) => ({ ...prev, phase: 'liberando' }))
        try {
          const idsForRelease = insertedIds.length > 0 && insertedIds.length <= 1800
            ? insertedIds
            : []
          await releasePendingConsultas({
            idUser: userId,
            idEquipe: equipeId,
            tipoConsulta: nomeArquivo,
            ids: idsForRelease
          })
          releasedToPending = true
          setBatchPollingTarget({ fileName: nomeArquivo })
        } catch (releaseErr) {
          releasedToPending = false
          setBatchPollingTarget(null)
          const releaseMsg = releaseErr?.message || 'Lote inserido, mas nao foi possivel liberar para pendente.'
          setBatchUploadError(releaseMsg)
          notify.error(releaseMsg, { autoClose: 3600 })
        }
      } else {
        setBatchPollingTarget(null)
      }
      setBatchImportJob(null)
      setBatchUploads((prev) => {
        const next = (Array.isArray(prev) ? prev : []).filter((item) => item?.fileName !== nomeArquivo)
        const localStatus = okCount > 0
          ? (releasedToPending ? 'Processando' : 'Aguardando liberacao')
          : 'Erro'
        return [{
          id: `local-${Date.now()}`,
          source: 'local',
          fileName: nomeArquivo,
          totalRows: batchRowsPayload.length,
          okCount,
          errCount,
          pendingCount: okCount,
          successCount: 0,
          errorCount: errCount,
          avgDurationMs,
          status: localStatus,
          createdAt: startedAtIso,
          validRows,
          invalidRows: Array.isArray(pendingBatchUpload?.invalidRows) ? pendingBatchUpload.invalidRows : []
        }, ...next]
      })

      if (okCount > 0 && errCount === 0 && releasedToPending) {
        notify.success('Lote enviado com sucesso.', { autoClose: 2200 })
      } else if (okCount > 0 && releasedToPending) {
        notify.warn(`${okCount} enviados e ${errCount} com erro.`, { autoClose: 3200 })
      } else if (okCount > 0) {
        notify.warn(`Lote inserido (${okCount}), aguardando liberacao para pendente.`, { autoClose: 3600 })
      } else {
        notify.error('Nenhuma linha do lote foi enviada com sucesso.', { autoClose: 3200 })
      }

      fetchConsultas(undefined, {}, { silent: true, preservePosition: true })
    } catch (err) {
      const msg = err?.message || 'Falha ao enviar lote CSV.'
      setBatchUploadError(msg)
      notify.error(msg, { autoClose: 3200 })
    } finally {
      setUploadingBatchFile(false)
      setBatchPostProgress(DEFAULT_BATCH_POST_PROGRESS)
      setBatchPostStartedAt(null)
      setBatchPostElapsedSeconds(0)
      batchUploadInFlightRef.current = false
    }
  }, [uploadingBatchFile, pendingBatchUpload, user, fetchConsultas])

  const removeLocalBatchEntry = useCallback((id) => {
    setBatchUploads((prev) => prev.filter((entry) => entry?.id !== id))
  }, [])

  const openDeleteBatchModal = useCallback((entry) => {
    if (!canDeleteBatchByUser) return
    if (!entry || entry?.source === 'local') return
    setBatchDeleteTarget(entry)
  }, [canDeleteBatchByUser])

  const closeDeleteBatchModal = useCallback(() => {
    if (deletingBatch) return
    setBatchDeleteTarget(null)
  }, [deletingBatch])

  const confirmDeleteBatch = useCallback(async () => {
    if (deletingBatch || !batchDeleteTarget) return
    if (!canDeleteBatchByUser) {
      notify.warn('Somente o usuario Master (ID 1) pode excluir lote.', { autoClose: 2600 })
      return
    }

    const tipoConsulta = String(batchDeleteTarget?.fileName || '').trim()
    if (!tipoConsulta) {
      notify.error('Nao foi possivel identificar o nome do lote.', { autoClose: 2600 })
      return
    }

    const requesterUserId = toNumberOrNull(user?.id)
    if (requesterUserId === null) {
      notify.error('Usuario sem ID para excluir lote.', { autoClose: 2600 })
      return
    }

    const targetUserId = toNumberOrNull(
      batchDeleteTarget?.idUser
      ?? resolveRowUserId(batchDeleteTarget?.apiRows?.[0])
      ?? null
    )
    const targetEquipeId = toNumberOrNull(
      batchDeleteTarget?.idEquipe
      ?? resolveRowEquipeId(batchDeleteTarget?.apiRows?.[0])
      ?? null
    )
    const requesterEquipeId = resolveUserEquipeId(user)

    if (requesterUserId !== 1 && targetEquipeId === null) {
      notify.error('Usuario sem id_equipe para excluir lote.', { autoClose: 2600 })
      return
    }

    try {
      setDeletingBatch(true)

      const requestUrl = new URL(V8_CONSULTAS_DELETE_API_URL, window.location.origin)
      requestUrl.searchParams.set('id_user', String(requesterUserId))
      // Backward-compat: alguns backends ainda validam id_equipe como obrigatorio.
      const compatEquipeId = requesterUserId === 1
        ? (requesterEquipeId ?? targetEquipeId ?? 1)
        : targetEquipeId
      if (compatEquipeId !== null) {
        requestUrl.searchParams.set('id_equipe', String(compatEquipeId))
      }
      if (requesterUserId === 1) {
        if (targetUserId !== null) requestUrl.searchParams.set('target_id_user', String(targetUserId))
        if (targetEquipeId !== null) requestUrl.searchParams.set('target_id_equipe', String(targetEquipeId))
      } else {
        requestUrl.searchParams.set('id_equipe', String(targetEquipeId))
      }
      requestUrl.searchParams.set('tipoConsulta', tipoConsulta)

      const response = await fetch(requestUrl.toString(), {
        method: 'DELETE',
        headers: { Accept: 'application/json' }
      })

      const payload = await parseResponseBody(response)
      const deletedCount = Math.max(0, Number(payload?.deleted_count ?? payload?.deletedCount ?? 0) || 0)

      notify.success(
        deletedCount > 0
          ? `Lote removido (${deletedCount} registro${deletedCount === 1 ? '' : 's'}).`
          : 'Nenhum registro encontrado para remover.',
        { autoClose: 2600 }
      )

      const targetScopeKey = `${normalizeHeaderToken(tipoConsulta)}|${targetUserId ?? 'na'}|${targetEquipeId ?? 'na'}`
      const fallbackFileKey = normalizeHeaderToken(tipoConsulta)
      setBatchUploads((prev) => (Array.isArray(prev) ? prev : []).filter((entry) => {
        const entryScopeKey = `${normalizeHeaderToken(entry?.fileName || '')}|${toNumberOrNull(entry?.idUser) ?? 'na'}|${toNumberOrNull(entry?.idEquipe) ?? 'na'}`
        if (targetUserId !== null || targetEquipeId !== null) return entryScopeKey !== targetScopeKey
        return normalizeHeaderToken(entry?.fileName) !== fallbackFileKey
      }))
      setBatchPreviewRow((prev) => {
        if (!prev) return prev
        const prevScopeKey = `${normalizeHeaderToken(prev?.fileName || '')}|${toNumberOrNull(prev?.idUser) ?? 'na'}|${toNumberOrNull(prev?.idEquipe) ?? 'na'}`
        if (targetUserId !== null || targetEquipeId !== null) {
          return prevScopeKey === targetScopeKey ? null : prev
        }
        return normalizeHeaderToken(prev?.fileName) === fallbackFileKey ? null : prev
      })
      setBatchDeleteTarget(null)
      if (normalizeHeaderToken(batchPollingTarget?.fileName) === fallbackFileKey) {
        setBatchPollingTarget(null)
      }

      fetchConsultas(undefined, {}, { silent: true, preservePosition: true })
      fetchLimites(undefined, { silent: true })
    } catch (err) {
      notify.error(err?.message || 'Falha ao excluir lote.', { autoClose: 3000 })
    } finally {
      setDeletingBatch(false)
    }
  }, [deletingBatch, batchDeleteTarget, canDeleteBatchByUser, user, batchPollingTarget?.fileName, fetchConsultas, fetchLimites])

  const openBatchPreviewModal = useCallback((entry) => {
    if (!entry) return
    let previewRows = []
    if (entry?.source === 'local') {
      const backendRows = Array.isArray(rowsRef.current) ? rowsRef.current : []
      const entryBatchName = String(entry?.fileName || '').trim()
      const latestByCpfNome = new Map()
      const latestByCpf = new Map()

      for (const backendRow of backendRows) {
        const backendBatchName = getBatchFileNameFromRow(backendRow)
        if (entryBatchName && backendBatchName && normalizeHeaderToken(backendBatchName) !== normalizeHeaderToken(entryBatchName)) {
          continue
        }
        const cpf = normalizeCpf11(backendRow?.cliente_cpf ?? backendRow?.cpf)
        const nome = normalizeClientName(backendRow?.cliente_nome ?? backendRow?.nome)
        if (!cpf) continue

        const keyCpf = cpf
        const keyCpfNome = `${cpf}|${normalizeNameToken(nome)}`
        const ts = getRowSortTimestamp(backendRow)

        const prevByCpfNome = latestByCpfNome.get(keyCpfNome)
        if (!prevByCpfNome || getRowSortTimestamp(prevByCpfNome) <= ts) {
          latestByCpfNome.set(keyCpfNome, backendRow)
        }

        const prevByCpf = latestByCpf.get(keyCpf)
        if (!prevByCpf || getRowSortTimestamp(prevByCpf) <= ts) {
          latestByCpf.set(keyCpf, backendRow)
        }
      }

      previewRows = (Array.isArray(entry?.validRows) ? entry.validRows : []).map((row) => {
        const cpf = normalizeCpf11(row?.cpf ?? row?.cliente_cpf)
        const nome = normalizeClientName(row?.nome ?? row?.cliente_nome)
        const keyCpfNome = `${cpf}|${normalizeNameToken(nome)}`
        const matched = latestByCpfNome.get(keyCpfNome) || latestByCpf.get(cpf)

        return {
          ...row,
          cpf,
          nome,
          telefone: normalizeProvidedPhone(row?.telefone ?? row?.phone ?? row?.celular),
          status: String(matched?.status ?? row?.status ?? '').trim(),
          status_consulta_v8: getV8RowStatus(matched || row)
        }
      })
    } else {
      const sourceRows = Array.isArray(entry?.apiRows) ? entry.apiRows : []
      previewRows = sourceRows
        .map((row) => ({
          cpf: normalizeCpf11(row?.cliente_cpf ?? row?.cpf),
          nome: normalizeClientName(row?.cliente_nome ?? row?.nome),
          telefone: normalizeProvidedPhone(row?.telefone ?? row?.phone ?? row?.celular),
          status: String(row?.status ?? '').trim(),
          status_consulta_v8: getV8RowStatus(row)
          ,
          descricao: String(row?.descricao ?? row?.descricao_v8 ?? row?.mensagem ?? '').trim()
        }))
        .filter((row) => row.cpf && row.nome)
    }

    previewRows = dedupeRowsByIdentityLatest(previewRows)

    setBatchPreviewRow({
      ...entry,
      previewRows: previewRows.slice(0, 120),
      previewTotal: previewRows.length
    })
  }, [])

  const downloadBatchRows = useCallback((entry) => {
    if (!entry) return
    let rowsForCsv = []
    if (entry?.source === 'local') {
      rowsForCsv = (Array.isArray(entry?.validRows) ? entry.validRows : []).map((row) => mapRowToV8CsvPayload({
        cliente_cpf: row?.cpf,
        cliente_nome: row?.nome,
        telefone: row?.telefone,
        mensagem: '',
        tipoConsulta: entry?.fileName || '',
        valor_liberado: '',
        created_at: '',
        updated_at: ''
      }, entry?.fileName || ''))
    } else {
      const sourceRows = Array.isArray(entry?.apiRows) ? entry.apiRows : []
      rowsForCsv = sourceRows
        .map((row) => mapRowToV8CsvPayload(row, entry?.fileName || ''))
        .filter((row) => row.cliente_cpf && row.cliente_nome)
    }

    rowsForCsv = dedupeV8CsvRows(rowsForCsv)

    if (rowsForCsv.length === 0) {
      notify.warn('Nao ha linhas validas para download.', { autoClose: 2200 })
      return
    }

    const header = [
      'cliente_cpf',
      'cliente_nome',
      'telefone',
      'mensagem',
      'tipoConsulta',
      'status_consulta_v8',
      'valor_liberado',
      'created_at',
      'updated_at'
    ].join(';')
    const lines = rowsForCsv.map((item) => ([
      item?.cliente_cpf ?? '',
      item?.cliente_nome ?? '',
      item?.telefone ?? '',
      item?.mensagem ?? '',
      item?.tipoConsulta ?? '',
      item?.status_consulta_v8 ?? '',
      item?.valor_liberado ?? '',
      item?.created_at ?? '',
      item?.updated_at ?? ''
    ].map(toCsvEscaped).join(';')))
    const csv = ['\ufeff' + header, ...lines].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const baseName = String(entry?.fileName || 'consulta-v8-lote')
      .replace(/\.csv$/i, '')
      .replace(/[^\w.-]+/g, '_')
    a.href = url
    a.download = `${baseName}_normalizado.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleRefresh = useCallback(() => {
    fetchLimites(undefined, { silent: true })
    const normalizedCpf = normalizeCpf11(consultaCpf)
    const normalizedNome = normalizeClientName(consultaNome)
    if (normalizedCpf && normalizedNome) {
      setConsultaCpf(normalizedCpf)
      setConsultaNome(normalizedNome)
      setConsultaError('')
      fetchConsultas(undefined, { cpf: normalizedCpf, nome: normalizedNome })
      return
    }
    fetchConsultas()
  }, [consultaCpf, consultaNome, fetchConsultas, fetchLimites])

  const visibleRows = useMemo(() => {
    const userId = toNumberOrNull(user?.id)
    if (userId !== LIMITED_USER_ID) return rows
    return (Array.isArray(rows) ? rows : []).filter(canUser3347SeeRow)
  }, [rows, user?.id])

  const sortedRows = useMemo(() => {
    const list = Array.isArray(visibleRows) ? [...visibleRows] : []
    return list.sort((a, b) => {
      const ta = getRowCreatedAtTimestamp(a)
      const tb = getRowCreatedAtTimestamp(b)
      if (tb !== ta) return tb - ta
      return getRowSortTimestamp(b) - getRowSortTimestamp(a)
    })
  }, [visibleRows])

  const latestTableUpdatedAt = useMemo(() => {
    const list = Array.isArray(visibleRows) ? visibleRows : []
    let maxTs = -Infinity
    for (const row of list) {
      const ts = getRowSortTimestamp(row)
      if (ts > maxTs) maxTs = ts
    }
    return Number.isFinite(maxTs) && maxTs > 0 ? new Date(maxTs) : null
  }, [visibleRows])

  const statusOptions = useMemo(() => {
    const set = new Set()
    for (const r of sortedRows) {
      const status = getV8RowStatus(r)
      if (status) set.add(status)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [sortedRows])

  const addStatusFilter = useCallback((raw) => {
    const token = String(raw ?? '').trim()
    if (!token) return

    const exact = statusOptions.find((opt) => opt.toLowerCase() === token.toLowerCase())
    let canonical = exact
    if (!canonical) {
      const matches = statusOptions.filter((opt) => opt.toLowerCase().includes(token.toLowerCase()))
      if (matches.length === 1) canonical = matches[0]
    }
    if (!canonical) return

    setStatusFilters((prev) => {
      if (prev.some((v) => v.toLowerCase() === canonical.toLowerCase())) return prev
      return [...prev, canonical]
    })
  }, [statusOptions])

  const removeStatusFilter = useCallback((token) => {
    const key = String(token ?? '').trim().toLowerCase()
    setStatusFilters((prev) => prev.filter((v) => v.toLowerCase() !== key))
  }, [])

  const toggleDescriptionFilter = useCallback((key) => {
    const normalized = String(key ?? '').trim().toLowerCase()
    if (!normalized) return
    setDescriptionFilters((prev) => {
      if (prev.includes(normalized)) return prev.filter((item) => item !== normalized)
      return [...prev, normalized]
    })
  }, [])

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setAgeMin('')
    setAgeMax('')
    setUpdatedFrom('')
    setUpdatedTo('')
    setDescriptionFilters([])
    setStatusFilters([])
    setValorMin('')
    setValorMax('')
    setPage(1)
  }, [])

  const hasFilters = Boolean(
    searchTerm.trim() ||
    ageMin.trim() ||
    ageMax.trim() ||
    updatedFrom.trim() ||
    updatedTo.trim() ||
    descriptionFilters.length ||
    statusFilters.length ||
    valorMin.trim() ||
    valorMax.trim()
  )

  useEffect(() => {
    setPage(1)
  }, [searchTerm, ageMin, ageMax, updatedFrom, updatedTo, descriptionFilters, statusFilters, valorMin, valorMax])

  useEffect(() => {
    setPage(1)
    if (consultaMode !== 'individual') setConsultaError('')
  }, [consultaMode])

  const selectedStatusSet = useMemo(() => {
    return new Set(statusFilters.map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean))
  }, [statusFilters])

  const selectedDescriptionSet = useMemo(() => {
    return new Set(descriptionFilters.map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean))
  }, [descriptionFilters])

  const baseFilteredRows = useMemo(() => {
    const q = String(searchTerm ?? '').trim().toLowerCase()
    const qDigits = onlyDigits(q)

    const minAge = ageMin.trim() === '' ? null : Number(ageMin)
    const maxAge = ageMax.trim() === '' ? null : Number(ageMax)

    const fromDate = updatedFrom.trim() ? parseLocalDateInput(updatedFrom, false) : null
    const toDate = updatedTo.trim() ? parseLocalDateInput(updatedTo, true) : null

    const minValor = valorMin.trim() === '' ? null : Number(valorMin)
    const maxValor = valorMax.trim() === '' ? null : Number(valorMax)

    return sortedRows.filter((row) => {
      if (!row) return false

      if (q) {
        const nome = String(row?.cliente_nome ?? '').toLowerCase()
        const cpfDigits = onlyDigits(row?.cliente_cpf)
        const okCpf = qDigits ? cpfDigits.includes(qDigits) : false
        const okNome = q ? nome.includes(q) : false
        if (!okCpf && !okNome) return false
      }

      if (minAge !== null || maxAge !== null) {
        const idade = getAge(row?.nascimento)
        if (idade === null) return false
        if (Number.isFinite(minAge) && idade < minAge) return false
        if (Number.isFinite(maxAge) && idade > maxAge) return false
      }

      if (fromDate || toDate) {
        const createdAtTs = getRowCreatedAtTimestamp(row)
        if (!Number.isFinite(createdAtTs) || createdAtTs <= 0) return false
        if (fromDate && createdAtTs < fromDate.getTime()) return false
        if (toDate && createdAtTs > toDate.getTime()) return false
      }

      if (minValor !== null || maxValor !== null) {
        const numeric = parseMoney(row?.valor_liberado)
        if (numeric === null) return false
        if (Number.isFinite(minValor) && numeric < minValor) return false
        if (Number.isFinite(maxValor) && numeric > maxValor) return false
      }

      return true
    })
  }, [sortedRows, searchTerm, ageMin, ageMax, updatedFrom, updatedTo, valorMin, valorMax])

  const descriptionOptions = useMemo(() => {
    const map = new Map()
    for (const row of baseFilteredRows) {
      const label = normalizeDescricao(row?.descricao)
      const key = label.toLowerCase()
      const prev = map.get(key)
      if (prev) prev.count += 1
      else map.set(key, { key, label, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label, 'pt-BR'))
  }, [baseFilteredRows])

  const descriptionLabelByKey = useMemo(() => {
    const map = new Map()
    for (const item of descriptionOptions) map.set(item.key, item.label)
    return map
  }, [descriptionOptions])

  const descriptionButtonLabel = useMemo(() => {
    if (descriptionFilters.length === 0) return 'Todas descrições'
    if (descriptionFilters.length === 1) return descriptionLabelByKey.get(descriptionFilters[0]) || '1 descrição'
    return `${descriptionFilters.length} descrições`
  }, [descriptionFilters, descriptionLabelByKey])

  const preStatusFilteredRows = useMemo(() => {
    if (selectedDescriptionSet.size === 0) return baseFilteredRows
    return baseFilteredRows.filter((row) => selectedDescriptionSet.has(descricaoKey(row?.descricao)))
  }, [baseFilteredRows, selectedDescriptionSet])

  const filteredRows = useMemo(() => {
    if (selectedStatusSet.size === 0) return preStatusFilteredRows
    return preStatusFilteredRows.filter((row) => {
      const status = getV8RowStatus(row).toLowerCase()
      return selectedStatusSet.has(status)
    })
  }, [preStatusFilteredRows, selectedStatusSet])

  const statusCounts = useMemo(() => {
    const map = new Map()
    for (const row of preStatusFilteredRows) {
      const rawLabel = getV8RowStatus(row)
      if (!rawLabel) continue
      const key = rawLabel.toLowerCase()
      const prev = map.get(key)
      if (prev) prev.count += 1
      else map.set(key, { key, label: rawLabel, displayLabel: translateV8StatusLabel(rawLabel), count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => (b.count - a.count) || a.displayLabel.localeCompare(b.displayLabel, 'pt-BR'))
  }, [preStatusFilteredRows])

  const apiBatchRows = useMemo(() => {
    return sortedRows.filter((row) => {
      const tipoConsulta = getTipoConsultaFromRow(row)
      const batchName = getBatchFileNameFromRow(row)
      if (!tipoConsulta && !batchName) return false
      if (isIndividualBatchToken(tipoConsulta || batchName)) return false
      return true
    })
  }, [sortedRows])

  const apiBatchGroups = useMemo(() => {
    const grouped = new Map()
    for (const row of apiBatchRows) {
      const fileName = getBatchFileNameFromRow(row) || 'Lote sem nome'
      const rowUserId = resolveRowUserId(row)
      const rowEquipeId = resolveRowEquipeId(row)
      const groupKey = `${normalizeHeaderToken(fileName)}|${rowUserId ?? 'na'}|${rowEquipeId ?? 'na'}`

      const prev = grouped.get(groupKey)
      if (prev) {
        prev.apiRows.push(row)
      } else {
        grouped.set(groupKey, {
          fileName,
          source: 'api',
          idUser: rowUserId,
          idEquipe: rowEquipeId,
          apiRows: [row]
        })
      }
    }

    return Array.from(grouped.values()).map((group, idx) => {
      const rowsList = dedupeRowsByIdentityLatest(Array.isArray(group.apiRows) ? group.apiRows : [])
      const quantity = rowsList.length
      const okCount = rowsList.filter((r) => isSuccessV8Status(getV8RowStatus(r))).length
      const pendingCount = rowsList.filter((r) => isPendingV8Status(getV8RowStatus(r))).length
      const errCount = Math.max(0, quantity - okCount - pendingCount)
      const durationCandidates = rowsList
        .map((r) => getRowDurationMs(r))
        .filter((v) => Number.isFinite(v) && v >= 0)
      const avgDurationMs = durationCandidates.length > 0
        ? durationCandidates.reduce((acc, v) => acc + v, 0) / durationCandidates.length
        : null

      let status = 'Aguardando'
      if (pendingCount > 0) status = 'Processando'
      else if (quantity > 0) status = 'Concluido'

      const latestTs = rowsList.reduce((acc, row) => Math.max(acc, getRowSortTimestamp(row)), 0)
      return {
        id: `api-${idx}-${group.fileName}-${group.idUser ?? 'na'}-${group.idEquipe ?? 'na'}`,
        source: 'api',
        fileName: group.fileName,
        idUser: group.idUser,
        idEquipe: group.idEquipe,
        totalRows: quantity,
        okCount,
        errCount,
        pendingCount,
        successCount: okCount,
        errorCount: errCount,
        avgDurationMs,
        status,
        createdAt: latestTs > 0 ? new Date(latestTs).toISOString() : '',
        apiRows: rowsList
      }
    })
  }, [apiBatchRows])

  const batchTableRows = useMemo(() => {
    const localEntries = Array.isArray(batchUploads) ? batchUploads : []
    const combined = [...localEntries, ...apiBatchGroups]
    const byFile = new Map()

    for (const entry of combined) {
      const baseName = normalizeHeaderToken(entry?.fileName || `sem-nome-${entry?.id || ''}`)
      const fileKey = entry?.source === 'api'
        ? `${baseName}|${toNumberOrNull(entry?.idUser) ?? 'na'}|${toNumberOrNull(entry?.idEquipe) ?? 'na'}`
        : baseName
      const prev = byFile.get(fileKey)
      if (!prev) {
        byFile.set(fileKey, entry)
        continue
      }

      // Quando a API ja retornou o lote, prioriza a linha derivada da API em vez da linha local temporaria.
      if (prev?.source === 'local' && entry?.source === 'api') {
        byFile.set(fileKey, entry)
        continue
      }
      if (prev?.source === 'api' && entry?.source === 'local') {
        continue
      }

      const prevTs = new Date(prev?.createdAt || 0).getTime()
      const nextTs = new Date(entry?.createdAt || 0).getTime()
      if (nextTs >= prevTs) byFile.set(fileKey, entry)
    }

    return Array.from(byFile.values()).sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime()
      const tb = new Date(b?.createdAt || 0).getTime()
      return tb - ta
    })
  }, [batchUploads, apiBatchGroups])

  const pageSize = 50
  const individualPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / pageSize)), [filteredRows.length])
  const currentIndividualPage = useMemo(() => Math.min(page, individualPages), [page, individualPages])

  const pageRows = useMemo(() => {
    const start = (currentIndividualPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentIndividualPage])

  const batchPages = useMemo(() => Math.max(1, Math.ceil(batchTableRows.length / pageSize)), [batchTableRows.length])
  const currentBatchPage = useMemo(() => Math.min(page, batchPages), [page, batchPages])
  const pagedBatchRows = useMemo(() => {
    const start = (currentBatchPage - 1) * pageSize
    return batchTableRows.slice(start, start + pageSize)
  }, [batchTableRows, currentBatchPage])

  const activeTotalRows = consultaMode === 'lote' ? batchTableRows.length : filteredRows.length
  const activePages = consultaMode === 'lote' ? batchPages : individualPages
  const activeCurrentPage = consultaMode === 'lote' ? currentBatchPage : currentIndividualPage
  const activeStartIndex = activeTotalRows === 0 ? 0 : ((activeCurrentPage - 1) * pageSize + 1)
  const activeEndIndex = activeTotalRows === 0 ? 0 : Math.min(activeCurrentPage * pageSize, activeTotalRows)

  const pages = individualPages
  const currentPage = currentIndividualPage
  const startIndex = filteredRows.length === 0 ? 0 : ((currentIndividualPage - 1) * pageSize + 1)
  const endIndex = filteredRows.length === 0 ? 0 : Math.min(currentIndividualPage * pageSize, filteredRows.length)

  const currentLimitSummary = {
    total: displayOrFallback(limitSummary.total),
    usado: displayOrFallback(limitSummary.usado),
    restantes: displayOrFallback(limitSummary.restantes)
  }

  const exportCSV = useCallback(() => {
  const headers = [
    'cliente_cpf',
    'cliente_nome',
    'telefone',
    'mensagem',
    'descricao',
    'tipoConsulta',
    'status_consulta_v8',
    'valor_liberado',
    'created_at',
    'updated_at'
  ]
    const outRows = dedupeV8CsvRows(
      filteredRows
      .map((row) => mapRowToV8CsvPayload(row))
    )
    const out = outRows
      .map((item) => ([
        item?.cliente_cpf ?? '',
        item?.cliente_nome ?? '',
        item?.telefone ?? '',
        item?.mensagem ?? '',
        item?.descricao ?? '',
        item?.tipoConsulta ?? '',
        item?.status_consulta_v8 ?? '',
        item?.valor_liberado ?? '',
        item?.created_at ?? '',
        item?.updated_at ?? ''
      ]))

    const csv = [headers, ...out]
      .map((row) => row.map((value) => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(';'))
      .join('\r\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'consultas_v8.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredRows])

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
                  src="https://v8-white-label-logos.s3.us-east-1.amazonaws.com/v8-rebrand/v8-logo-auth0.svg"
                  alt="V8"
                  width="58"
                  height="22"
                  style={{ objectFit: 'contain' }}
                />
                <h2 className="fw-bold mb-0">Consulta V8</h2>
              </div>
              <div className="small opacity-75">
                {latestTableUpdatedAt
                  ? `Última atualização: ${formatDate(latestTableUpdatedAt)}`
                  : 'Carregando dados...'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline-info btn-sm d-flex align-items-center gap-2"
            onClick={handleRefresh}
            disabled={loading}
          >
            <FiRefreshCw size={14} />
            <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>

        <section className="mb-3">
          <div className="row g-3">
            <div className="col-12 col-xxl-3">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="d-flex flex-column align-items-start gap-3 mb-3">
                  <div>
                    <div className="opacity-75 small text-uppercase mb-1">Limites V8</div>
                  </div>
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <div className="small opacity-75">Total</div>
                      <div className="h5 fw-bold mb-0">{currentLimitSummary.total}</div>
                    </div>
                    <div>
                      <div className="small opacity-75">Usado</div>
                      <div className="h5 fw-bold mb-0">{currentLimitSummary.usado}</div>
                    </div>
                    <div>
                      <div className="small opacity-75">Restantes</div>
                      <div className="h5 fw-bold mb-0">{currentLimitSummary.restantes}</div>
                    </div>
                  </div>
                </div>

                {limitesError && (
                  <div className="small text-danger mb-2">{limitesError}</div>
                )}

                {loadingLimites && (
                  <div className="small opacity-75 d-flex align-items-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Carregando limites...
                  </div>
                )}
              </div>
            </div>

            <div className="col-12 col-xxl-6">
              <div className="neo-card neo-lg p-3 p-md-4 h-100" style={{ overflow: 'visible', position: 'relative', zIndex: 20 }}>
                <div className="opacity-75 small mb-2 text-uppercase">Filtros</div>
                <div style={{ overflow: 'visible' }}>
                  <div className="row g-2 align-items-end">
                    <div className="col-12 col-md-6">
                      <label className="form-label small opacity-75 mb-1" htmlFor="v8-search">Buscar</label>
                      <input
                        id="v8-search"
                        className="form-control form-control-sm"
                        placeholder="Nome ou CPF"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small opacity-75 mb-1">Descrições</label>
                      <div className="dropdown w-100" style={{ position: 'relative', zIndex: 30 }}>
                        <button
                          type="button"
                          className="btn btn-outline-light btn-sm w-100 d-flex align-items-center justify-content-between gap-2"
                          data-bs-toggle="dropdown"
                          data-bs-auto-close="outside"
                          title={descriptionButtonLabel}
                        >
                          <span className="text-truncate">{descriptionButtonLabel}</span>
                          <FiChevronDown size={14} />
                        </button>
                        <div className="dropdown-menu dropdown-menu-dark w-100 p-2" style={{ maxHeight: 280, overflowY: 'auto', zIndex: 3000 }}>
                          {descriptionOptions.length === 0 ? (
                            <div className="small opacity-75 px-2 py-1">Nenhuma descrição</div>
                          ) : (
                            descriptionOptions.map((item) => {
                              const checked = selectedDescriptionSet.has(item.key)
                              return (
                                <label key={item.key} className="d-flex align-items-center gap-2 px-2 py-1 rounded" style={{ cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    className="form-check-input mt-0"
                                    checked={checked}
                                    onChange={() => toggleDescriptionFilter(item.key)}
                                  />
                                  <span className="small text-wrap flex-grow-1">{item.label}</span>
                                  <span className="badge text-bg-secondary">{item.count}</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-md-6 order-3 order-md-3">
                      <label className="form-label small opacity-75 mb-1">Idade</label>
                      <div className="d-flex gap-2">
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm"
                          placeholder="Min"
                          value={ageMin}
                          onChange={(e) => setAgeMin(e.target.value)}
                          style={{ minWidth: 0 }}
                        />
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm"
                          placeholder="Max"
                          value={ageMax}
                          onChange={(e) => setAgeMax(e.target.value)}
                          style={{ minWidth: 0 }}
                        />
                      </div>
                    </div>

                    <div className="col-12 order-5 order-md-5">
                      <label className="form-label small opacity-75 mb-1">Última atualização</label>
                      <div className="d-flex gap-2">
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={updatedFrom}
                          onChange={(e) => setUpdatedFrom(e.target.value)}
                          style={{ minWidth: 0 }}
                        />
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={updatedTo}
                          onChange={(e) => setUpdatedTo(e.target.value)}
                          style={{ minWidth: 0 }}
                        />
                      </div>
                    </div>

                    <div className="col-12 col-md-6 order-4 order-md-4">
                      <label className="form-label small opacity-75 mb-1">Valor liberado</label>
                      <div className="d-flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          className="form-control form-control-sm"
                          placeholder="Min"
                          value={valorMin}
                          onChange={(e) => setValorMin(e.target.value)}
                          style={{ minWidth: 0 }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          className="form-control form-control-sm"
                          placeholder="Max"
                          value={valorMax}
                          onChange={(e) => setValorMax(e.target.value)}
                          style={{ minWidth: 0 }}
                        />
                      </div>
                    </div>

                    <div className="col-12 order-6">
                      <div className="d-flex gap-2 w-100">
                        <button
                          type="button"
                          className="btn btn-outline-light btn-sm flex-fill"
                          onClick={clearFilters}
                          disabled={!hasFilters}
                        >
                          Limpar filtros
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-light btn-sm flex-fill d-inline-flex align-items-center justify-content-center gap-2"
                          onClick={exportCSV}
                          disabled={consultaMode === 'lote' || loading || Boolean(error) || filteredRows.length === 0}
                          title={consultaMode === 'lote' ? 'Disponivel no modo Individual' : 'Baixar CSV (;)'}
                        >
                          <FiDownload size={16} />
                          <span>CSV</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-xxl-3">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="opacity-75 small mb-2 text-uppercase">Consulta</div>
                <div className="btn-group btn-group-sm w-100 mb-3" role="group" aria-label="Modo de consulta">
                  <button
                    type="button"
                    className={`btn ${consultaMode === 'individual' ? 'btn-info text-dark' : 'btn-outline-light'}`}
                    onClick={() => setConsultaMode('individual')}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    className={`btn ${consultaMode === 'lote' ? 'btn-info text-dark' : 'btn-outline-light'}`}
                    onClick={() => setConsultaMode('lote')}
                  >
                    Em lote
                  </button>
                </div>

                {consultaMode === 'individual' ? (
                  <form className="d-flex flex-column gap-2" onSubmit={handleConsultaSubmit}>
                    <div>
                      <label className="form-label small opacity-75 mb-1" htmlFor="v8-consulta-cpf">CPF</label>
                      <input
                        id="v8-consulta-cpf"
                        className="form-control form-control-sm"
                        inputMode="numeric"
                        maxLength={14}
                        placeholder="00000000000"
                        value={consultaCpf}
                        onChange={(e) => setConsultaCpf(onlyDigits(e.target.value).slice(0, 11))}
                        onBlur={() => setConsultaCpf((prev) => normalizeCpf11(prev))}
                      />
                    </div>

                    <div>
                      <label className="form-label small opacity-75 mb-1" htmlFor="v8-consulta-nome">Nome do cliente</label>
                      <input
                        id="v8-consulta-nome"
                        className="form-control form-control-sm"
                        placeholder="NOME DO CLIENTE"
                        value={consultaNome}
                        onChange={(e) => setConsultaNome(e.target.value)}
                        onBlur={() => setConsultaNome((prev) => normalizeClientName(prev))}
                      />
                    </div>

                    {consultaError && <div className="small text-danger">{consultaError}</div>}

                    <button type="submit" className="btn btn-outline-info btn-sm mt-1" disabled={loading || sendingConsultaIndividual}>
                      {sendingConsultaIndividual ? 'Enviando...' : 'Consultar'}
                    </button>
                  </form>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    <input
                      ref={batchFileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="d-none"
                      onChange={handleBatchFileChange}
                    />

                    <button
                      type="button"
                      className="btn btn-outline-info btn-sm d-inline-flex align-items-center justify-content-center gap-2"
                      onClick={openBatchFilePicker}
                      disabled={uploadingBatchFile}
                    >
                      <FiUpload size={15} />
                      <span>Selecionar CSV</span>
                    </button>

                    <div className="small opacity-75">
                      Arquivo separado por <code>;</code> com colunas obrigatorias <code>cpf</code> e <code>nome</code>. <code>telefone</code> e opcional.
                    </div>

                    {batchUploadError && (
                      <div className="small text-danger">{batchUploadError}</div>
                    )}

                    {pendingBatchUpload && (
                      <div className="neo-card p-2 mt-1">
                        <div className="small fw-semibold text-break">{pendingBatchUpload.fileName}</div>
                        <div className="small opacity-75">
                          Total: {pendingBatchUpload.totalRows} | validos: {pendingBatchUpload.validRows.length} | invalidos: {pendingBatchUpload.invalidRows.length}
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-light btn-sm w-100 mt-2"
                          onClick={addPendingBatchToList}
                          disabled={uploadingBatchFile}
                        >
                          {uploadingBatchFile ? 'Enviando...' : 'Enviar lote'}
                        </button>
                      </div>
                    )}

                    {uploadingBatchFile && (
                      <div className="mt-2">
                        <div className="d-flex justify-content-between align-items-center small mb-1">
                          <span>
                            {batchPostProgress.phase === 'liberando'
                              ? 'Liberando pendentes...'
                              : 'Enviando lote...'}
                          </span>
                          <span>{batchPostProcessed}/{batchPostTotal} ({batchPostPercent}%)</span>
                        </div>
                        <div className="progress" style={{ height: 8 }}>
                          <div
                            className={`progress-bar ${batchPostProgress.phase === 'liberando' ? 'bg-warning' : 'bg-info'} progress-bar-striped progress-bar-animated`}
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={batchPostPercent}
                            style={{ width: `${batchPostPercent}%` }}
                          />
                        </div>
                        <div className="small opacity-75 mt-1">
                          {batchPostProgress.fileName ? `${batchPostProgress.fileName} | ` : ''}
                          Sucesso: {Number(batchPostProgress.ok || 0)} | Erro: {Number(batchPostProgress.error || 0)} | ETA: {batchPostProgress.phase === 'liberando' ? 'finalizando...' : formatEtaMinutesOrHours(batchPostEtaSeconds)}
                        </div>
                      </div>
                    )}

                    {!pendingBatchUpload && (
                      <div className="small opacity-75">Nenhum CSV selecionado.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {consultaMode === 'individual' && (
            <div className="col-12">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <div className="opacity-75 small text-uppercase">Status Consulta V8</div>
                  {statusFilters.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-outline-light btn-sm"
                      onClick={() => setStatusFilters([])}
                      title="Limpar status"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="small opacity-75 mb-2">Clique para filtrar</div>

                {loading ? (
                  <div className="d-flex align-items-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span className="small opacity-75">Carregando...</span>
                  </div>
                ) : error ? (
                  <div className="small text-danger">Falha ao carregar.</div>
                ) : statusCounts.length === 0 ? (
                  <div className="small opacity-75">Nenhum status encontrado.</div>
                ) : (
                  <div style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'hidden' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: 8
                      }}
                    >
                      {statusCounts.map((item) => {
                        const selected = selectedStatusSet.has(item.key)
                        return (
                          <button
                            key={item.key}
                            type="button"
                            className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-outline-light'} w-100 text-start p-3`}
                            onClick={() => (selected ? removeStatusFilter(item.label) : addStatusFilter(item.label))}
                            title={item.displayLabel || item.label}
                            style={{ aspectRatio: '1 / 1', whiteSpace: 'normal' }}
                          >
                            <div className="d-flex flex-column h-100">
                              <div
                                className="fw-semibold text-break"
                                style={{
                                  lineHeight: 1.1,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 4,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}
                              >
                                {item.displayLabel || item.label}
                              </div>
                              <div className="mt-auto d-flex justify-content-end pt-2">
                                <span className={`badge ${selected ? 'text-bg-light' : 'text-bg-secondary'}`}>{item.count}</span>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {!loading && !error && (
                  <div className="small opacity-75 mt-3">Total de Clientes: {preStatusFilteredRows.length}</div>
                )}
              </div>
            </div>
            )}
          </div>
        </section>

        {consultaMode === 'lote' ? (
          <section className="neo-card neo-lg p-0">
            {batchTableRows.length > 0 && (
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
                <div className="small opacity-75">Exibindo {activeStartIndex}-{activeEndIndex} de {activeTotalRows}</div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={activeCurrentPage === 1}
                  >
                    {'\u2039'}
                  </button>
                  <span className="small opacity-75 px-1">{activeCurrentPage}/{activePages}</span>
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => setPage((p) => Math.min(activePages, p + 1))}
                    disabled={activeCurrentPage === activePages}
                  >
                    {'\u203A'}
                  </button>
                </div>
              </div>
            )}
            <div className="table-responsive" ref={tableScrollRef}>
              <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
                <thead>
                  <tr>
                    <th>Nome do arquivo</th>
                    <th>Quantidade de nomes</th>
                    <th>Resultado</th>
                    <th>Tempo medio</th>
                    <th>Status</th>
                    <th className="text-center">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {batchTableRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center opacity-75">
                        Nenhum lote encontrado.
                      </td>
                    </tr>
                  )}

                  {pagedBatchRows.map((entry) => {
                    const statusTxt = String(entry?.status || '-')
                    const statusToken = normalizeHeaderToken(statusTxt)
                    const totalRowsNum = Math.max(0, Number(entry?.totalRows ?? 0) || 0)
                    const successCount = Math.max(
                      0,
                      Number(
                        entry?.successCount
                        ?? (entry?.source === 'local' ? 0 : (entry?.okCount ?? 0))
                      ) || 0
                    )
                    const errorCount = Math.max(
                      0,
                      Number(entry?.errorCount ?? entry?.errCount ?? 0) || 0
                    )
                    const pendingCount = Math.max(
                      0,
                      Number(
                        entry?.pendingCount
                        ?? (entry?.source === 'local'
                          ? (entry?.okCount ?? 0)
                          : Math.max(0, totalRowsNum - successCount - errorCount))
                      ) || 0
                    )
                    const statusClass = statusToken.includes('process')
                      ? 'text-bg-warning'
                      : (statusToken.includes('conclu') || statusToken.includes('sucesso'))
                        ? 'text-bg-success'
                        : statusToken.includes('erro')
                          ? 'text-bg-danger'
                          : 'text-bg-secondary'
                    const canDelete = canDeleteBatchByUser
                    const isTargetPolling = normalizeHeaderToken(entry?.fileName) === normalizeHeaderToken(batchPollingTarget?.fileName)

                    return (
                      <tr key={String(entry?.id ?? entry?.fileName)}>
                        <td className="text-wrap">
                          <div className="fw-semibold">{entry?.fileName || '-'}</div>
                          <div className="small opacity-75">{entry?.createdAt ? formatDate(entry.createdAt) : '-'}</div>
                        </td>
                        <td>{Number(entry?.totalRows ?? 0)}</td>
                        <td>
                          <div className="d-inline-flex align-items-center gap-2 flex-nowrap" style={{ whiteSpace: 'nowrap' }}>
                            <span className="badge text-bg-warning d-inline-flex align-items-center gap-1" title="Falta consultar">
                              <FiClock size={12} />
                              <span>{pendingCount}</span>
                            </span>
                            <span className="badge text-bg-success d-inline-flex align-items-center gap-1" title="Sem erro">
                              <FiCheckCircle size={12} />
                              <span>{successCount}</span>
                            </span>
                            <span className="badge text-bg-danger d-inline-flex align-items-center gap-1" title="Com erro">
                              <FiAlertCircle size={12} />
                              <span>{errorCount}</span>
                            </span>
                          </div>
                        </td>
                        <td>{formatAvgDuration(entry?.avgDurationMs)}</td>
                        <td>
                          <span className={`badge ${statusClass}`}>
                            {isTargetPolling ? 'Processando' : statusTxt}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="d-inline-flex align-items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icon btn-ghost-info"
                              title="Visualizar"
                              aria-label="Visualizar"
                              onClick={() => openBatchPreviewModal(entry)}
                            >
                              <FiFileText />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icon btn-ghost-success"
                              title="Baixar"
                              aria-label="Baixar"
                              onClick={() => downloadBatchRows(entry)}
                            >
                              <FiDownload />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icon btn-ghost-danger"
                              title={
                                canDelete
                                  ? (entry?.source === 'local' ? 'Excluir lote local' : 'Excluir lote da tabela')
                                  : 'Disponivel apenas para usuario Master (ID 1)'
                              }
                              aria-label="Excluir"
                              disabled={!canDelete}
                              onClick={() => {
                                if (entry?.source === 'local') {
                                  removeLocalBatchEntry(entry?.id)
                                  return
                                }
                                openDeleteBatchModal(entry)
                              }}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
        <section className="neo-card neo-lg p-0">
          {!loading && !error && filteredRows.length > 0 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
              <div className="small opacity-75">Exibindo {startIndex}-{endIndex} de {filteredRows.length}</div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
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
                  .filter(p => p > 1 && p < pages)
                  .map(p => (
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
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={currentPage === pages}
                >
                  {'\u203A'}
                </button>
              </div>
            </div>
          )}
          <div className="table-responsive" ref={tableScrollRef}>
            <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>CPF</th>
                  <th>Sexo</th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Última atualização</th>
                  <th>Status Consulta V8</th>
                  <th>Valor Liberado</th>
                  <th className="text-center">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center">
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Carregando consultas...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-danger">
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center opacity-75">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}

                {!loading && !error && pageRows.map((row, idx) => {
                  const resolvedStatus = getV8RowStatus(row)
                  const translatedStatus = translateV8StatusLabel(resolvedStatus)
                  return (
                    <tr key={String(row?.id ?? `${row?.cliente_cpf ?? 'sem-cpf'}-${row?.created_at ?? idx}`)}>
                      <td>{row?.id ?? '-'}</td>
                      <td>{formatCpf(row?.cliente_cpf)}</td>
                      <td>{renderSexo(row?.cliente_sexo)}</td>
                      <td className="text-nowrap">{row?.cliente_nome || '-'}</td>
                      <td>{formatPhone(row?.telefone)}</td>
                      <td>{formatDate(row?.created_at)}</td>
                      <td>
                        <span className={`badge ${statusClassName(resolvedStatus)}`}>
                          {translatedStatus || resolvedStatus || '-'}
                        </span>
                      </td>
                      <td>{formatCurrency(row?.valor_liberado)}</td>
                      <td className="text-center">
                        {(() => {
                          const token = String(row?.mensagem ?? row?.descricao ?? '').trim()
                          const hasDescricao = Boolean(token && token !== '-')
                          return (
                            <button
                              type="button"
                              className={`btn btn-ghost ${hasDescricao ? 'btn-ghost-success' : ''} btn-icon`}
                              title="Ver detalhes"
                              aria-label="Ver detalhes"
                              onClick={() => setSelectedRow(row)}
                            >
                              <FiEye size={18} />
                            </button>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </main>
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
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <form onSubmit={handleNovoLoginSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title">Adicionar login V8</h5>
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
                    <label className="form-label small opacity-75 mb-1">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={novoEmail}
                      onChange={(event) => setNovoEmail(event.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small opacity-75 mb-1">Senha</label>
                    <input
                      type="text"
                      className="form-control"
                      value={novaSenha}
                      onChange={(event) => setNovaSenha(event.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label small opacity-75 mb-1">Empresa</label>
                    <input
                      type="text"
                      className="form-control"
                      value={novaEmpresa}
                      onChange={(event) => setNovaEmpresa(event.target.value)}
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
      {selectedRow && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: 'min(92vw, 760px)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-0">Detalhes do cliente</h5>
                  <div className="small opacity-75">Ultima atualizacao: {formatDate(selectedRow?.created_at)}</div>
                </div>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setSelectedRow(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-2">
                  <div className="col-12 col-lg-4">
                    <div className="small opacity-75">ID</div>
                    <div className="fw-semibold text-break">{selectedRow?.id ?? '-'}</div>
                  </div>
                  <div className="col-12 col-lg-8">
                    <div className="small opacity-75">Nome</div>
                    <div className="fw-semibold text-break">{selectedRow?.cliente_nome || '-'}</div>
                  </div>

                  <div className="col-6 col-lg-4">
                    <div className="small opacity-75">CPF</div>
                    <div className="fw-semibold">{formatCpf(selectedRow?.cliente_cpf)}</div>
                  </div>
                  <div className="col-3 col-lg-2">
                    <div className="small opacity-75">Sexo</div>
                    <div className="fw-semibold">{renderSexo(selectedRow?.cliente_sexo)}</div>
                  </div>
                  <div className="col-12 col-lg-3">
                    <div className="small opacity-75">Telefone</div>
                    <div className="fw-semibold">{formatPhone(selectedRow?.telefone)}</div>
                  </div>

                  <div className="col-12 col-lg-6">
                    <div className="small opacity-75">Email</div>
                    <div className="fw-semibold text-break">{selectedRow?.email || '-'}</div>
                  </div>
                  <div className="col-6 col-lg-6">
                    <div className="small opacity-75">Valor liberado</div>
                    <div className="fw-semibold">{formatCurrency(selectedRow?.valor_liberado)}</div>
                  </div>

                  <div className="col-12">
                    <div className="small opacity-75">Status Consulta V8</div>
                    <div className="fw-semibold">
                      <span className={`badge ${statusClassName(getV8RowStatus(selectedRow))}`}>
                        {translateV8StatusLabel(getV8RowStatus(selectedRow)) || getV8RowStatus(selectedRow) || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="neo-card p-3 mt-3">
                  <div className="small opacity-75 mb-1">Descrição</div>
                  <div className="fw-semibold text-break">{selectedRow?.mensagem || selectedRow?.descricao || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {batchPreviewRow && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1061 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setBatchPreviewRow(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: 'min(96vw, 1040px)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-0">Lote selecionado</h5>
                  <div className="small opacity-75">{batchPreviewRow?.fileName || '-'}</div>
                </div>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setBatchPreviewRow(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-3">
                  <div className="col-6 col-md-3">
                    <div className="small opacity-75">Quantidade</div>
                    <div className="fw-semibold">{Number(batchPreviewRow?.previewTotal ?? 0)}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="small opacity-75">Status</div>
                    <div className="fw-semibold">{batchPreviewRow?.status || '-'}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="small opacity-75">Tempo medio</div>
                    <div className="fw-semibold">{formatAvgDuration(batchPreviewRow?.avgDurationMs)}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="small opacity-75">Origem</div>
                    <div className="fw-semibold">{batchPreviewRow?.fileName || '-'}</div>
                  </div>
                </div>

                <div className="table-responsive" style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'hidden' }}>
                  <table className="table table-dark table-sm align-middle mb-0" style={{ minWidth: 0, tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>CPF</th>
                        <th>Nome</th>
                        <th>Telefone</th>
                        <th>status</th>
                        <th>Resposta V8</th>
                        <th>Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(batchPreviewRow?.previewRows?.length ?? 0) === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-3 opacity-75">Sem linhas para visualizar.</td>
                        </tr>
                      )}
                      {(batchPreviewRow?.previewRows ?? []).map((item, idx) => (
                        <tr key={`${item?.cpf || 'cpf'}-${idx}`}>
                          <td>{idx + 1}</td>
                          <td className="text-nowrap">{formatCpf(item?.cpf)}</td>
                          <td className="text-nowrap">{item?.nome || '-'}</td>
                          <td className="text-nowrap">{formatPhone(item?.telefone)}</td>
                          <td>{translateV8StatusLabel(item?.status) || item?.status || '-'}</td>
                          <td>{translateV8StatusLabel(item?.status_consulta_v8) || item?.status_consulta_v8 || '-'}</td>
                          <td style={{ maxWidth: 320, whiteSpace: 'normal' }}>
                            {item?.descricao ? <span>{item.descricao}</span> : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {batchDeleteTarget && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1062 }}
          role="dialog"
          aria-modal="true"
          onClick={closeDeleteBatchModal}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: 'min(92vw, 560px)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <h5 className="modal-title mb-0">Excluir lote</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  disabled={deletingBatch}
                  onClick={closeDeleteBatchModal}
                ></button>
              </div>
              <div className="modal-body">
                <div className="small opacity-75 mb-1">Lote selecionado</div>
                <div className="fw-semibold text-break mb-3">{batchDeleteTarget?.fileName || '-'}</div>
                <div className="small">
                  Esta acao remove os registros da tabela <code>consulta_v8</code> usando os filtros:
                </div>
                <div className="small mt-2">
                  <div>
                    <code>id_user</code>: {
                      toNumberOrNull(
                        batchDeleteTarget?.idUser
                        ?? resolveRowUserId(batchDeleteTarget?.apiRows?.[0])
                        ?? user?.id
                      ) ?? '-'
                    }
                  </div>
                  <div>
                    <code>id_equipe</code>: {
                      toNumberOrNull(
                        batchDeleteTarget?.idEquipe
                        ?? resolveRowEquipeId(batchDeleteTarget?.apiRows?.[0])
                        ?? resolveUserEquipeId(user)
                      ) ?? '-'
                    }
                  </div>
                  <div><code>tipoConsulta</code>: {batchDeleteTarget?.fileName || '-'}</div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={deletingBatch}
                  onClick={closeDeleteBatchModal}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deletingBatch}
                  onClick={confirmDeleteBatch}
                >
                  {deletingBatch ? 'Excluindo...' : 'Confirmar exclusao'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}


