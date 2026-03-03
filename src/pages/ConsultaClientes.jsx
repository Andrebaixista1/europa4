import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBriefcase,
  FiChevronRight,
  FiCircle,
  FiCopy,
  FiCreditCard,
  FiDollarSign,
  FiList,
  FiHome,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiX,
} from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { notify } from '../utils/notify.js'
import { useAuth } from '../context/AuthContext.jsx'
import '../styles/consulta-clientes.css'

const API_URL = 'https://n8n.apivieiracred.store/webhook/api/consultacliente'
const BANK_ICON_BY_CODE = {
  '1': { short: 'BB', bg: '#F9D441', color: '#111827' },
  '33': { short: 'SAN', bg: '#E41F26', color: '#FFFFFF' },
  '41': { short: 'BAN', bg: '#1E3A8A', color: '#FFFFFF' },
  '70': { short: 'BRB', bg: '#0F766E', color: '#FFFFFF' },
  '77': { short: 'INT', bg: '#F97316', color: '#FFFFFF' },
  '104': { short: 'CX', bg: '#1D4ED8', color: '#FFFFFF' },
  '212': { short: 'ORG', bg: '#16A34A', color: '#FFFFFF' },
  '237': { short: 'BRA', bg: '#B91C1C', color: '#FFFFFF' },
  '260': { short: 'NU', bg: '#7C3AED', color: '#FFFFFF' },
  '318': { short: 'BMG', bg: '#F97316', color: '#111827' },
  '341': { short: 'ITA', bg: '#F59E0B', color: '#111827' },
  '422': { short: 'SAF', bg: '#2563EB', color: '#FFFFFF' },
  '623': { short: 'PAN', bg: '#06B6D4', color: '#0F172A' },
  '748': { short: 'SIC', bg: '#16A34A', color: '#FFFFFF' },
  '756': { short: 'SIC', bg: '#16A34A', color: '#FFFFFF' },
}
const BANK_NAME_FALLBACK_BY_CODE = {
  '934': 'Agiplan Financeira S/A',
}
const CONTRATO_FONTES = [
  { value: 'portabilidade', label: 'Portabilidade' },
  { value: 'in100', label: 'Qualibanking' },
  { value: 'v8', label: 'V8' },
  { value: 'presenca', label: 'Presença' },
  { value: 'handmais', label: 'Hand+' },
]
const CONTRATO_FONTE_ICON_BY_VALUE = {
  portabilidade: '/neo-logo.svg',
  in100: 'https://qualibanking.com.br/Qlogo.png',
  v8: 'https://v8-white-label-logos.s3.us-east-1.amazonaws.com/v8-rebrand/v8-logo-auth0.svg',
  presenca: 'https://portal.presencabank.com.br/assets/images/presencabank/logo.svg',
  handmais: '/handplus-logo.svg',
}
const CONTRATO_FONTE_STORAGE_KEY = 'consulta_clientes_contrato_fonte'
const CONTRATO_FONTE_VALUES = new Set(CONTRATO_FONTES.map((item) => item.value))

const getInitialContratoFonte = () => {
  if (typeof window === 'undefined') return 'portabilidade'
  try {
    const saved = String(window.localStorage.getItem(CONTRATO_FONTE_STORAGE_KEY) || '').trim()
    if (CONTRATO_FONTE_VALUES.has(saved)) return saved
  } catch {
    // Se localStorage falhar, segue fallback padrao.
  }
  return 'portabilidade'
}

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')
const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== ''
const normalizeBankCode = (value) => {
  const digits = digitsOnly(value)
  if (!digits) return ''
  let normalizedDigits = digits
  if (normalizedDigits.length > 3) {
    normalizedDigits = normalizedDigits.replace(/0+$/, '')
    if (!normalizedDigits) normalizedDigits = '0'
  }
  const numeric = Number(normalizedDigits)
  if (Number.isFinite(numeric)) return String(numeric)
  const trimmed = normalizedDigits.replace(/^0+/, '')
  return trimmed || '0'
}

const stripTrailingZeroDecimals = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.replace(/[.,]0+$/, '')
}

const firstFilled = (...values) => {
  for (const value of values) {
    if (hasValue(value)) return value
  }
  return ''
}

const formatCpf = (value) => {
  const cpf = digitsOnly(value).slice(0, 11)
  if (!cpf) return ''
  if (cpf.length < 11) return cpf
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

const formatBeneficio = (value) => {
  const beneficio = digitsOnly(value).slice(0, 10)
  if (!beneficio) return ''
  if (beneficio.length < 10) return beneficio
  return `${beneficio.slice(0, 3)}.${beneficio.slice(3, 6)}.${beneficio.slice(6, 9)}-${beneficio.slice(9)}`
}

const normalizeCpfForConsulta = (value) => {
  const digits = digitsOnly(value)
  if (!digits) return ''
  if (digits.length > 11) return null
  return digits.padStart(11, '0')
}

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const txt = String(value).trim()
  if (!txt) return null
  const normalized = txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const formatMoney = (value) => {
  const n = parseNumber(value)
  if (n === null) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

const formatPercent = (value, decimals = 2) => {
  const n = parseNumber(value)
  if (n === null) return '-'
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`
}

const normalizeTaxaPercent = (value) => {
  const n = parseNumber(value)
  if (n === null) return null
  if (n < 0) return 1.5
  if (n > 2.99) return 2.99
  return n
}

const calcExcelRate = (nper, pmt, pv, fv = 0, paymentType = 0) => {
  const periods = parseNumber(nper)
  const payment = parseNumber(pmt)
  const presentValue = parseNumber(pv)
  const futureValue = parseNumber(fv) ?? 0
  const type = parseNumber(paymentType) ?? 0

  if (periods === null || payment === null || presentValue === null) return null
  if (periods <= 0 || payment <= 0 || presentValue <= 0) return null

  const n = periods
  const p = payment
  const pvSigned = -Math.abs(presentValue)

  const f = (rate) => {
    if (Math.abs(rate) < 1e-12) {
      return pvSigned + p * n + futureValue
    }
    const a = Math.pow(1 + rate, n)
    return pvSigned * a + p * (1 + rate * type) * ((a - 1) / rate) + futureValue
  }

  let rate = 0.02
  for (let i = 0; i < 60; i += 1) {
    const y = f(rate)
    const h = 1e-6
    const dy = (f(rate + h) - y) / h
    if (!Number.isFinite(y) || !Number.isFinite(dy) || Math.abs(dy) < 1e-12) break
    const next = rate - (y / dy)
    if (!Number.isFinite(next) || next <= -0.9999 || next > 100) break
    if (Math.abs(next - rate) < 1e-10) {
      rate = next
      break
    }
    rate = next
  }

  if (Number.isFinite(rate) && rate > -0.9999 && rate < 100) {
    const check = f(rate)
    if (Math.abs(check) < 1e-6) return rate
  }

  let low = 0
  let high = 1
  let fLow = f(low)
  let fHigh = f(high)
  if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow * fHigh > 0) return null

  for (let i = 0; i < 120; i += 1) {
    const mid = (low + high) / 2
    const fMid = f(mid)
    if (!Number.isFinite(fMid)) return null
    if (Math.abs(fMid) < 1e-10) return mid
    if (fLow * fMid <= 0) {
      high = mid
      fHigh = fMid
    } else {
      low = mid
      fLow = fMid
    }
  }

  const result = (low + high) / 2
  return Number.isFinite(result) ? result : null
}

const parseDateAny = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (/^\d{8}$/.test(raw)) {
    const y = Number(raw.slice(0, 4))
    const m = Number(raw.slice(4, 6))
    const d = Number(raw.slice(6, 8))
    const date = new Date(y, m - 1, d)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = (value) => {
  const date = parseDateAny(value)
  return date ? date.toLocaleDateString('pt-BR') : '-'
}

const formatDateTime = (value) => {
  const date = parseDateAny(value)
  return date ? date.toLocaleString('pt-BR') : '-'
}

const formatAge = (idadeValue, nascimentoValue) => {
  const idadeNum = parseNumber(idadeValue)
  if (idadeNum !== null) return `${Math.trunc(idadeNum)} anos`
  const nascimento = parseDateAny(nascimentoValue)
  if (!nascimento) return '-'
  const today = new Date()
  let age = today.getFullYear() - nascimento.getFullYear()
  const monthDiff = today.getMonth() - nascimento.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < nascimento.getDate())) age -= 1
  return age >= 0 ? `${age} anos` : '-'
}

const mapSituacao = (value) => {
  if (!hasValue(value)) return '-'
  const n = parseNumber(value)
  if (n === 1) return 'Ativo'
  if (n === 0) return 'Inativo'
  return String(value)
}

const toTitleCase = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase())

const mapTipoCreditoIn100 = (value) => {
  if (!hasValue(value)) return '-'
  const raw = String(value).trim()
  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ').trim()
  if (normalized === 'magnetic card' || normalized === 'cartao magnetico' || normalized === 'cartão magnético') return 'Cartão Magnético'
  if (normalized === 'checking account' || normalized === 'conta corrente') return 'Conta Corrente'
  const numeric = Number(raw.replace(',', '.'))
  if (!Number.isNaN(numeric) && numeric === 2) return 'Cartão Magnético'
  return toTitleCase(raw)
}

const mapSituacaoIn100 = (value) => {
  if (!hasValue(value)) return '-'
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'elegible' || normalized === 'eligible') return 'Elegível'
  return toTitleCase(value)
}

const mapBloqueioIn100 = (value) => {
  if (!hasValue(value)) return '-'
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'not_blocked') return 'Não bloqueado'
  return toTitleCase(value)
}

const formatPhone = (value) => {
  const d = digitsOnly(value)
  if (!d) return '-'
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return String(value)
}

const buildWhatsAppUrl = (value) => {
  const digits = digitsOnly(value)
  if (!digits) return '#'
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${normalized}`
}

const copyPhoneDigits = async (value) => {
  const digits = digitsOnly(value)
  if (!digits) return
  try {
    await navigator.clipboard.writeText(digits)
    notify.success('Telefone copiado.')
  } catch {
    notify.error('Não foi possível copiar.')
  }
}

const trimLeadingZeros = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.replace(/^0+(?=\d)/, '')
}

const normalizeSourceToken = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')

const QUALIBANKING_ERROR_STATUS_PATTERNS = [
  'beneficio bloqueado pelo beneficiario',
  'beneficiario tem representante legal, mas nao foi informado',
  'um erro interno aconteceu e esta sendo investigado',
  'erro 404',
  'beneficio bloqueado devido a transferencia de beneficio',
  'beneficio bloqueado durante o processo de concessao',
  'taxa limite excedida',
  'beneficiario nao encontrado',
  'erro no retorno do saldo',
  'beneficio nao encontrado',
  'erro interno',
]

const QUALIBANKING_WARNING_STATUS_PATTERNS = [
  'aguarde um pouco e tente novamente (api tentou consultar mais de 10 vezes)',
  'numero do beneficio invalido',
  'desativado temporariamente',
  'fornecido nao e valido',
]

const isQualibankingErrorStatus = (value) => {
  if (!hasValue(value)) return false
  const normalized = normalizeSourceToken(value)
  return QUALIBANKING_ERROR_STATUS_PATTERNS.some((pattern) => normalized.includes(pattern))
}

const isQualibankingSuccessStatus = (value) => {
  if (!hasValue(value)) return false
  const normalized = normalizeSourceToken(value)
  return normalized === 'sucesso'
}

const isQualibankingWarningStatus = (value) => {
  if (!hasValue(value)) return false
  const normalized = normalizeSourceToken(value)
  return QUALIBANKING_WARNING_STATUS_PATTERNS.some((pattern) => normalized.includes(pattern))
}

const collectApiMessageTexts = (value, output = []) => {
  if (value === null || value === undefined) return output
  if (Array.isArray(value)) {
    value.forEach((item) => collectApiMessageTexts(item, output))
    return output
  }
  if (typeof value === 'object') {
    if (hasValue(value?.text)) output.push(String(value.text).trim())
    if (Array.isArray(value?.messages)) collectApiMessageTexts(value.messages, output)
    return output
  }
  return output
}

const formatApiMessageText = (value, fallback = '-') => {
  if (!hasValue(value)) return fallback

  if (typeof value === 'object') {
    const texts = collectApiMessageTexts(value)
      .map((text) => text.trim())
      .filter(Boolean)
    if (texts.length > 0) return Array.from(new Set(texts)).join('; ')
    return fallback
  }

  const raw = String(value).trim()
  if (!raw) return fallback

  const parsed = tryParseJson(raw)
  if (parsed) {
    const texts = collectApiMessageTexts(parsed)
      .map((text) => text.trim())
      .filter(Boolean)
    if (texts.length > 0) return Array.from(new Set(texts)).join('; ')
  }

  const regexTexts = [...raw.matchAll(/"text"\s*:\s*"([^"]+)"/g)]
    .map((match) => String(match?.[1] ?? '').trim())
    .filter(Boolean)
  if (regexTexts.length > 0) return Array.from(new Set(regexTexts)).join('; ')

  return raw
}

const sortByDataHoraRegistroDesc = (rows) => [...rows].sort((a, b) => {
  const timeA = parseDateAny(a?.data_hora_registro)?.getTime()
  const timeB = parseDateAny(b?.data_hora_registro)?.getTime()
  const safeA = Number.isFinite(timeA) ? timeA : -Infinity
  const safeB = Number.isFinite(timeB) ? timeB : -Infinity
  return safeB - safeA
})

const sortByCreatedAtDesc = (rows) => [...rows].sort((a, b) => {
  const timeA = parseDateAny(a?.createdAtRaw ?? a?.created_at)?.getTime()
  const timeB = parseDateAny(b?.createdAtRaw ?? b?.created_at)?.getTime()
  const safeA = Number.isFinite(timeA) ? timeA : -Infinity
  const safeB = Number.isFinite(timeB) ? timeB : -Infinity
  return safeB - safeA
})

const getV8RowStatus = (row) => firstFilled(
  row?.status_consulta_v8,
  row?.statusConsultaV8,
  row?.status_consulta,
  row?.status,
  row?.situacao,
  row?.final_status,
  '-'
)

const getV8Descricao = (row) => String(firstFilled(row?.descricao_v8, row?.descricao, row?.mensagem, '')).trim()

const normalizeV8StatusToken = (value) => String(value ?? '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/\s+/g, '_')

const V8_STATUS_PT_BR_MAP = {
  WAITING_CONSENT: 'Aguardando consentimento',
  WAITING_CONSULT: 'Aguardando consulta',
  WAITING_CREDIT_ANALYSIS: 'Aguardando análise de crédito',
  CONSENT_APPROVED: 'Consentimento aprovado',
  CONSENT_REJECTED: 'Consentimento rejeitado',
  CONSENT_DENIED: 'Consentimento negado',
  CONSENT_EXPIRED: 'Consentimento expirado',
  CONSENT_PENDING: 'Consentimento pendente',
  CREDIT_ANALYSIS_APPROVED: 'Análise de crédito aprovada',
  CREDIT_ANALYSIS_REJECTED: 'Análise de crédito rejeitada',
  CREDIT_ANALYSIS_DENIED: 'Análise de crédito negada',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
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

const translateV8StatusLabel = (status) => {
  const raw = String(status ?? '').trim()
  if (!raw) return '-'
  const token = normalizeV8StatusToken(raw)
  return V8_STATUS_PT_BR_MAP[token] || toTitleCase(raw.replace(/[_-]+/g, ' '))
}

const getV8StatusBadgeClass = (status) => {
  const normalized = normalizeSourceToken(status)
  if (!normalized || normalized === '-') return 'text-bg-secondary'
  if (normalized.includes('sucesso') || normalized.includes('concluid') || normalized.includes('aprovad')) return 'text-bg-success'
  if (normalized.includes('erro') || normalized.includes('falha') || normalized.includes('reprov') || normalized.includes('rejeit') || normalized.includes('reject') || normalized.includes('negad')) return 'text-bg-danger'
  if (normalized.includes('process') || normalized.includes('aguard') || normalized.includes('penden')) return 'text-bg-warning text-dark'
  return 'text-bg-info text-dark'
}

const resolveContratoFonteFromRow = (row) => {
  const sourceToken = normalizeSourceToken(firstFilled(
    row?.Tabela,
    row?.tabela,
    row?.origem,
    row?.fonte,
    row?.source
  ))

  if (sourceToken.includes('qualibanking') || sourceToken.includes('in100')) return 'in100'
  if (sourceToken.includes('v8')) return 'v8'
  if (sourceToken.includes('presenca')) return 'presenca'
  if (sourceToken.includes('hand')) return 'handmais'
  if (sourceToken.includes('macica') || sourceToken.includes('maci') || sourceToken.includes('portabilidade')) return 'portabilidade'

  if (hasValue(row?.id_contrato_empres) || hasValue(row?.vl_empres) || hasValue(row?.quant_parcelas) || hasValue(row?.tipo_empres)) {
    return 'portabilidade'
  }

  return ''
}

const tryParseJson = (value) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const unwrapRows = (payload, depth = 0) => {
  if (depth > 6 || payload === null || payload === undefined) return []
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'string') {
    const parsed = tryParseJson(payload)
    return parsed ? unwrapRows(parsed, depth + 1) : []
  }
  if (typeof payload !== 'object') return []

  const candidates = [payload.data, payload.rows, payload.result, payload.results, payload.items, payload.body, payload.payload, payload.output, payload.response]
  for (const candidate of candidates) {
    const rows = unwrapRows(candidate, depth + 1)
    if (rows.length > 0) return rows
  }
  return [payload]
}

const normalizeRows = (payload) => unwrapRows(payload).map((row) => (row && typeof row === 'object' ? row : { value: row }))

const parseResponseBody = async (response) => {
  const raw = await response.text()
  let payload = null
  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    payload = { raw }
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

const getParamValue = (params, key) => params.get(key) || params.get(key.toUpperCase()) || params.get(key.toLowerCase()) || ''

const parseCpfFromUrl = (pathname, search) => {
  const searchParams = new URLSearchParams(search)
  const queryCpf = getParamValue(searchParams, 'cpf')
  if (queryCpf) return queryCpf

  const base = '/consultas/clientes'
  if (!pathname.startsWith(base)) return ''
  let tail = pathname.slice(base.length)
  if (tail.startsWith('/')) tail = tail.slice(1)
  tail = tail.replace(/\/+$/, '')
  if (!tail) return ''

  const pathParams = new URLSearchParams(tail.replace(/^\?/, ''))
  return getParamValue(pathParams, 'cpf')
}

const toIntegerOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

const isClienteRow = (row) => (
  hasValue(row?.NOME)
  || hasValue(row?.nome)
  || hasValue(row?.cliente_nome)
  || hasValue(row?.CPF)
  || hasValue(row?.CPF_LIMPO)
  || hasValue(row?.cliente_cpf)
  || hasValue(row?.Beneficio)
  || hasValue(row?.numero_beneficio)
  || hasValue(row?.numero_documento)
  || hasValue(row?.nome_segurado)
  || hasValue(row?.nu_cpf)
  || hasValue(row?.nu_cpf_tratado)
  || hasValue(row?.nb)
)

const getRowNome = (row) => firstFilled(row?.Entrantes, row?.entrantes, row?.nome_segurado, row?.NOME, row?.nome, row?.cliente_nome)
const getRowCpfDigits = (row) => digitsOnly(firstFilled(row?.CPF_LIMPO, row?.CPF, row?.nu_cpf_tratado, row?.nu_cpf, row?.numero_documento, row?.cliente_cpf))
const getRowBeneficio = (row) => String(firstFilled(row?.numero_beneficio, row?.Beneficio, row?.BENEFICIO_LIMPO, row?.nb, row?.nb_tratado, row?.nb_ix)).trim()
const getRowTableToken = (row) => normalizeSourceToken(firstFilled(row?.Tabela, row?.tabela))
const isMacicaOrEntrantesRow = (row) => {
  const token = getRowTableToken(row)
  return token.includes('macica') || token.includes('maci') || token.includes('entrantes')
}
const isQualibankingRow = (row) => {
  const token = getRowTableToken(row)
  return token.includes('qualibanking') || token.includes('in100')
}
const isV8Row = (row) => {
  if (resolveContratoFonteFromRow(row) === 'v8') return true
  return hasValue(row?.cliente_nome) || hasValue(row?.cliente_cpf)
}
const normalizeNameToken = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')

const panelStyle = {
  borderRadius: 10,
}

const bubbleIconStyle = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: '#1ea7ff',
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
}

const miniLabelStyle = {
  fontSize: '0.8rem',
  opacity: 0.8,
}

function CopyButton({ value, label }) {
  const handleCopy = useCallback(async () => {
    if (!hasValue(value)) return
    try {
      await navigator.clipboard.writeText(String(value))
      notify.success(`${label} copiado.`)
    } catch {
      notify.error('Não foi possível copiar.')
    }
  }, [label, value])

  return (
    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={handleCopy} disabled={!hasValue(value)} title={`Copiar ${label.toLowerCase()}`}>
      <FiCopy size={14} />
    </button>
  )
}

function SectionTitle({ icon: IconComp, title, right }) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
      <div className="d-flex align-items-center gap-2">
        <span style={bubbleIconStyle}><IconComp size={14} /></span>
        <div className="fw-semibold text-uppercase" style={{ fontSize: '0.86rem' }}>{title}</div>
      </div>
      {right}
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <div style={miniLabelStyle}>{label}</div>
      <div className="fw-semibold">{hasValue(value) ? String(value) : '-'}</div>
    </div>
  )
}

function MatriculaLine({ leftLabel, leftValue, rightLabel, rightValue }) {
  return (
    <div className="row g-2 gx-lg-5 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="col-12 col-lg-6 d-flex justify-content-between gap-3 pe-lg-4">
        <span style={miniLabelStyle}>{leftLabel}:</span>
        <span className="fw-semibold text-end">{hasValue(leftValue) ? leftValue : '-'}</span>
      </div>
      <div className="col-12 col-lg-6 d-flex justify-content-between gap-3 ps-lg-4">
        <span style={miniLabelStyle}>{rightLabel}:</span>
        <span className="fw-semibold text-end">{hasValue(rightValue) ? rightValue : '-'}</span>
      </div>
    </div>
  )
}

function EmptyCell({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} className="opacity-75">{text}</td>
    </tr>
  )
}

function AccordionToggle({ open, onToggle, label }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon btn-sm"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? `Fechar ${label}` : `Abrir ${label}`}
      title={open ? `Fechar ${label}` : `Abrir ${label}`}
    >
      <FiChevronRight
        size={15}
        style={{
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform .18s ease',
        }}
      />
    </button>
  )
}

function BankNameWithIcon({ bankCode, bankName }) {
  const code = normalizeBankCode(bankCode)
  const bankMeta = BANK_ICON_BY_CODE[code] || null
  const shortCode = bankMeta?.short || (code ? String(code).slice(0, 3) : '')

  return (
    <div className="d-flex align-items-center gap-2">
      {shortCode ? (
        <span
          style={{
            minWidth: 20,
            height: 16,
            borderRadius: 4,
            padding: '0 4px',
            background: bankMeta?.bg || 'rgba(30,167,255,0.2)',
            color: bankMeta?.color || '#e5e7eb',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.62rem',
            fontWeight: 700,
            lineHeight: 1,
          }}
          title={code ? `Banco ${code}` : 'Banco'}
        >
          {shortCode}
        </span>
      ) : (
        <span style={{ width: 16, height: 16, borderRadius: 3, background: 'rgba(30,167,255,0.2)', border: '1px solid rgba(30,167,255,0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <FiCreditCard size={10} />
        </span>
      )}
      <span>{bankName}</span>
    </div>
  )
}

export default function ConsultaClientes() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [selectedBenefitKey, setSelectedBenefitKey] = useState('')
  const [bankNameByCode, setBankNameByCode] = useState({})
  const [rawPayload, setRawPayload] = useState(null)
  const [isEnderecosOpen, setIsEnderecosOpen] = useState(false)
  const [isBancosOpen, setIsBancosOpen] = useState(true)
  const [isContratosOpen, setIsContratosOpen] = useState(true)
  const [showRoundedTaxaHint, setShowRoundedTaxaHint] = useState(false)
  const [contratoFonte, setContratoFonte] = useState(getInitialContratoFonte)
  const [in100DetailItem, setIn100DetailItem] = useState(null)
  const [v8DetailItem, setV8DetailItem] = useState(null)
  const lastUrlCpfRef = useRef('')
  const disponibilidadeToastKeyRef = useRef('')
  const hideSearchByInitialUrlRef = useRef(
    Boolean(normalizeCpfForConsulta(parseCpfFromUrl(location.pathname, location.search)))
  )

  const userContext = useMemo(() => {
    const idUser = toIntegerOrNull(user?.id ?? user?.id_user ?? user?.idUser)
    const equipeId = toIntegerOrNull(user?.equipe_id ?? user?.team_id ?? user?.id_equipe ?? user?.equipeId)
    const isUserOne = idUser === 1
    const hierarquia = String(user?.hierarquia ?? user?.role ?? user?.nivel_hierarquia ?? '').trim() || (isUserOne ? 'master' : '')
    return {
      idUser,
      equipeId,
      hierarquia,
      ready: idUser !== null && (isUserOne || (equipeId !== null && hierarquia.length > 0)),
    }
  }, [user])

  const visibleRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows])
  const hasCpfInUrl = hideSearchByInitialUrlRef.current

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const loadBanks = async () => {
      try {
        const response = await fetch('https://brasilapi.com.br/api/banks/v1', {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) return
        const data = await response.json()
        if (!Array.isArray(data) || !active) return

        const next = {}
        data.forEach((item) => {
          const code = normalizeBankCode(item?.code)
          if (!code) return
          next[code] = item?.fullName || item?.name || next[code] || code
        })
        if (active) setBankNameByCode(next)
      } catch {
        // Silencioso: se a API de bancos falhar, exibimos apenas o codigo.
      }
    }

    loadBanks()
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const resolveBankName = useCallback((code, fallbackName = '') => {
    const normalizedCode = normalizeBankCode(code)
    if (normalizedCode && hasValue(bankNameByCode[normalizedCode])) return bankNameByCode[normalizedCode]
    if (normalizedCode && hasValue(BANK_NAME_FALLBACK_BY_CODE[normalizedCode])) return BANK_NAME_FALLBACK_BY_CODE[normalizedCode]
    if (hasValue(fallbackName)) return String(fallbackName)
    return '-'
  }, [bankNameByCode])

  const resolveBankCodeDisplay = useCallback((code) => {
    const normalizedCode = normalizeBankCode(code)
    return normalizedCode || '-'
  }, [])

  const columns = useMemo(() => {
    if (visibleRows.length === 0) return []
    const keys = new Set()
    for (const row of visibleRows) {
      if (!row || typeof row !== 'object') continue
      Object.keys(row).forEach((k) => keys.add(k))
    }
    return Array.from(keys)
  }, [visibleRows])

  const profile = useMemo(() => {
    try {
      const allRows = visibleRows.filter((row) => row && typeof row === 'object')
      const mappedRows = allRows.filter((row) => isClienteRow(row))
      if (mappedRows.length === 0) return null

      const rowsMacicaEntrantes = mappedRows.filter((row) => isMacicaOrEntrantesRow(row))
      const rowsQualibanking = mappedRows.filter((row) => isQualibankingRow(row))
      const rowsV8 = mappedRows.filter((row) => isV8Row(row))
      const hasPersonalBaseData = (row) => (
        hasValue(getRowNome(row))
        || hasValue(getRowCpfDigits(row))
        || hasValue(getRowBeneficio(row))
        || hasValue(firstFilled(row?.UF, row?.uf, row?.estado))
      )
      const hasMacicaEntrantesBaseData = rowsMacicaEntrantes.some((row) => hasPersonalBaseData(row))
      const hasQualibankingBaseData = rowsQualibanking.some((row) => hasPersonalBaseData(row))
      const hasV8BaseData = rowsV8.some((row) => (
        hasPersonalBaseData(row)
        || hasValue(firstFilled(row?.cliente_nome, row?.cliente_cpf))
      ))

      const preferredSourceRows = hasMacicaEntrantesBaseData
        ? rowsMacicaEntrantes
        : hasQualibankingBaseData
          ? rowsQualibanking
          : hasV8BaseData
            ? rowsV8
            : mappedRows

      const preferredPersonalSeedRows = preferredSourceRows.length > 0 ? preferredSourceRows : mappedRows

      const benefitMap = new Map()
      preferredPersonalSeedRows.forEach((row, index) => {
        const beneficio = getRowBeneficio(row)
        const cpfDigits = getRowCpfDigits(row)
        const nome = getRowNome(row)
        if (!beneficio && !cpfDigits && !nome) return
        const key = `${beneficio || `sem-beneficio-${index}`}|${cpfDigits || 'sem-cpf'}`
        const current = {
          key,
          beneficio,
          cpfDigits,
          cpf: cpfDigits ? formatCpf(cpfDigits) : '-',
          nome: nome || '-',
          nomeToken: normalizeNameToken(nome),
          row,
        }

        const previous = benefitMap.get(key)
        if (!previous) {
          benefitMap.set(key, current)
          return
        }

        const prevNomeOk = hasValue(previous.nome) && previous.nome !== '-'
        const currNomeOk = hasValue(current.nome) && current.nome !== '-'
        if (!prevNomeOk && currNomeOk) {
          benefitMap.set(key, current)
          return
        }

        const prevDate = parseDateAny(firstFilled(previous.row?.data_hora_registro, previous.row?.updated_at, previous.row?.created_at))
        const currDate = parseDateAny(firstFilled(current.row?.data_hora_registro, current.row?.updated_at, current.row?.created_at))
        if ((currDate?.getTime?.() || 0) > (prevDate?.getTime?.() || 0)) {
          benefitMap.set(key, current)
        }
      })

      const benefitOptions = Array.from(benefitMap.values())
      if (benefitOptions.length === 0) {
        const baseRow = preferredPersonalSeedRows[0] || mappedRows[0]
        benefitOptions.push({
          key: 'default-beneficio',
          beneficio: '',
          cpfDigits: getRowCpfDigits(baseRow),
          cpf: formatCpf(getRowCpfDigits(baseRow)),
          nome: getRowNome(baseRow) || '-',
          nomeToken: normalizeNameToken(getRowNome(baseRow)),
          row: baseRow,
        })
      }

      const uniqueNomes = new Set(benefitOptions.map((item) => item.nome).filter(hasValue))
      const uniqueCpfs = new Set(benefitOptions.map((item) => item.cpfDigits).filter(hasValue))
      const uniqueBeneficios = new Set(benefitOptions.map((item) => item.beneficio).filter(hasValue))
      const shouldShowBenefitSelect = uniqueNomes.size > 1 || uniqueCpfs.size > 1 || uniqueBeneficios.size > 1

      const selectedOption = benefitOptions.find((item) => item.key === selectedBenefitKey) || benefitOptions[0]
      const selectedBeneficio = selectedOption?.beneficio || ''
      const selectedCpfDigits = selectedOption?.cpfDigits || ''
      const selectedNomeToken = selectedOption?.nomeToken || ''

      const relatedRows = preferredPersonalSeedRows.filter((row) => {
        const rowBeneficio = getRowBeneficio(row)
        const rowCpf = getRowCpfDigits(row)
        const rowNomeToken = normalizeNameToken(getRowNome(row))

        // Mantem o contexto completo do beneficio selecionado para nao perder campos.
        if (hasValue(selectedBeneficio)) return rowBeneficio === selectedBeneficio
        if (hasValue(selectedCpfDigits)) return rowCpf === selectedCpfDigits
        if (hasValue(selectedNomeToken)) return rowNomeToken === selectedNomeToken
        return false
      })
      const poolRows = relatedRows.length > 0 ? relatedRows : preferredPersonalSeedRows
      const prioritizedRows = [
        ...preferredPersonalSeedRows,
        ...mappedRows.filter((row) => !preferredPersonalSeedRows.includes(row)),
      ]
      const globalRows = prioritizedRows.length > 0 ? prioritizedRows : mappedRows

      const preferredRows = poolRows.filter((row) => {
        const rowCpf = getRowCpfDigits(row)
        const rowNomeToken = normalizeNameToken(getRowNome(row))
        if (hasValue(selectedCpfDigits) && rowCpf === selectedCpfDigits) return true
        if (hasValue(selectedNomeToken) && rowNomeToken === selectedNomeToken) return true
        return false
      })

      const mergedRows = [
        ...preferredRows,
        ...poolRows.filter((row) => !preferredRows.includes(row)),
      ]
      const personalRows = preferredRows.length > 0 ? preferredRows : mergedRows

      const pickFromRows = (rowsList, keys, fallback = '') => {
        const rows = Array.isArray(rowsList) ? rowsList : []
        const listKeys = Array.isArray(keys) ? keys : [keys]
        for (const row of rows) {
          for (const key of listKeys) {
            const value = row?.[key]
            if (hasValue(value)) return value
          }
        }
        return fallback
      }

      const cpfValue = firstFilled(
        selectedOption?.cpfDigits,
        pickFromRows(personalRows, ['CPF_LIMPO', 'CPF', 'nu_cpf_tratado', 'nu_cpf', 'numero_documento', 'cliente_cpf']),
        pickFromRows(mergedRows, ['CPF_LIMPO', 'CPF', 'nu_cpf_tratado', 'nu_cpf', 'numero_documento', 'cliente_cpf']),
      )
      const nascimentoValue = firstFilled(
        pickFromRows(personalRows, ['Data_Nascimento', 'dt_nascimento_tratado', 'dt_nascimento']),
        pickFromRows(mergedRows, ['Data_Nascimento', 'dt_nascimento_tratado', 'dt_nascimento'])
      )

      const enderecos = [{
        cep: pickFromRows(globalRows, ['cep', 'CEP']),
        rua: pickFromRows(globalRows, ['endereco']),
        bairro: pickFromRows(globalRows, ['bairro']),
        cidade: pickFromRows(globalRows, ['municipio', 'Municipio', 'cidade']),
        uf: pickFromRows(globalRows, ['uf', 'UF']),
      }].filter((item) => hasValue(item.cep) || hasValue(item.rua) || hasValue(item.cidade))

      const phones = [
        ...globalRows.flatMap((row) => [
          row?.CELULAR1,
          row?.CELULAR2,
          row?.CELULAR3,
          row?.CELULAR4,
          row?.telefone,
        ]),
      ]
        .map((item) => digitsOnly(item))
        .filter((item) => item.length >= 10)
        .filter((item, idx, arr) => arr.indexOf(item) === idx)

      const rawBanco = pickFromRows(globalRows, ['Banco', 'id_banco_pagto', 'banco_desembolso'])
      const contaBase = pickFromRows(globalRows, ['Conta', 'nu_conta_corrente', 'conta_desembolso'])
      const digitoDesembolso = pickFromRows(globalRows, ['digito_desembolso'])
      const bankRows = [{
        tipoLiberacao: pickFromRows(globalRows, ['Meio_Pagamento', 'cs_meio_pagto']),
        bancoCodigo: normalizeBankCode(rawBanco),
        bancoNomeRaw: hasValue(rawBanco) && !digitsOnly(rawBanco) ? String(rawBanco).trim() : '',
        agencia: stripTrailingZeroDecimals(pickFromRows(globalRows, ['Agencia', 'id_agencia_banco', 'agencia_desembolso'])),
        conta: hasValue(contaBase)
          ? `${trimLeadingZeros(contaBase)}${hasValue(digitoDesembolso) ? `-${digitoDesembolso}` : ''}`
          : '',
        digito: hasValue(digitoDesembolso) ? String(digitoDesembolso) : '',
        tipoCredito: mapTipoCreditoIn100(pickFromRows(globalRows, ['tipo_credito'])),
      }].filter((item) => hasValue(item.tipoLiberacao) || hasValue(item.bancoCodigo) || hasValue(item.bancoNomeRaw) || hasValue(item.agencia) || hasValue(item.conta) || hasValue(item.digito) || hasValue(item.tipoCredito))

      const rowsByFonte = {
        portabilidade: [],
        in100: [],
        v8: [],
        presenca: [],
        handmais: [],
      }
      allRows.forEach((row) => {
        const source = resolveContratoFonteFromRow(row)
        if (!source || !rowsByFonte[source]) return
        rowsByFonte[source].push(row)
      })

      const mapContratoPadrao = (row, index) => {
        const parcelas = firstFilled(row?.quant_parcelas_tratado, row?.quant_parcelas)
        const valorParcela = firstFilled(row?.vl_parcela_tratado, row?.vl_parcela)
        const valorEmprestado = firstFilled(row?.vl_empres_tratado, row?.vl_empres)
        const pagas = stripTrailingZeroDecimals(firstFilled(row?.pagas, row?.parcelas_pagas, row?.qt_pagas))
        const restantes = stripTrailingZeroDecimals(firstFilled(row?.restantes, row?.parcelas_restantes, row?.qt_restantes))
        const taxaRate = calcExcelRate(parcelas, valorParcela, valorEmprestado)
        const taxaRatePercent = taxaRate !== null ? taxaRate * 100 : null
        const taxaPercent = normalizeTaxaPercent(taxaRatePercent)

        const rawBancoContrato = firstFilled(row?.id_banco_empres, row?.id_banco_pagto)
        return {
          key: `${index}-${firstFilled(row?.id_contrato_empres, row?.nb, row?.numero_beneficio, 'contrato')}`,
          bancoCodigo: normalizeBankCode(rawBancoContrato),
          bancoNomeRaw: hasValue(rawBancoContrato) && !digitsOnly(rawBancoContrato) ? String(rawBancoContrato).trim() : '',
          contrato: trimLeadingZeros(firstFilled(row?.id_contrato_empres)),
          pgtoRestantes: (hasValue(pagas) || hasValue(restantes))
            ? `${hasValue(pagas) ? pagas : '-'}/${hasValue(restantes) ? restantes : '-'}`
            : '-',
          parcelas: stripTrailingZeroDecimals(parcelas),
          taxa: taxaPercent !== null ? formatPercent(taxaPercent, 2) : '-',
          showRoundedTaxaHint: taxaPercent === 1.5,
          valorParcela,
          emprestado: valorEmprestado,
        }
      }

      const contratosByFonte = {
        portabilidade: rowsByFonte.portabilidade
          .filter((row) => hasValue(row?.id_contrato_empres) || hasValue(row?.vl_empres) || hasValue(row?.nb))
          .map(mapContratoPadrao),
        in100: sortByDataHoraRegistroDesc(
          rowsByFonte.in100.filter((row) => hasValue(row?.numero_documento) || hasValue(row?.numero_beneficio) || hasValue(row?.status_api))
        ).map((row, index) => {
            const bancoCodigo = normalizeBankCode(row?.banco_desembolso)
            const conta = trimLeadingZeros(row?.conta_desembolso)
            const digito = firstFilled(row?.digito_desembolso)
            const situacaoLabel = mapSituacaoIn100(row?.situacao_beneficio)
            const tipoCreditoLabel = mapTipoCreditoIn100(row?.tipo_credito)
            const tipoBloqueioLabel = mapBloqueioIn100(row?.tipo_bloqueio)
            return {
              key: `in100-${index}-${firstFilled(row?.numero_beneficio, row?.numero_documento, 'item')}`,
              numeroDocumentoRaw: digitsOnly(row?.numero_documento),
              numeroDocumento: formatCpf(row?.numero_documento),
              numeroBeneficio: firstFilled(row?.numero_beneficio, row?.Beneficio, row?.nb, row?.nb_tratado, '-'),
              nome: firstFilled(row?.nome, row?.nome_segurado, row?.NOME, '-'),
              tipoBloqueio: tipoBloqueioLabel,
              dataConcessao: formatDate(row?.data_concessao),
              tipoCredito: tipoCreditoLabel,
              limiteCartaoBeneficio: formatMoney(row?.limite_cartao_beneficio),
              saldoCartaoBeneficio: formatMoney(row?.saldo_cartao_beneficio),
              situacaoBeneficio: situacaoLabel,
              limiteCartaoConsignado: formatMoney(row?.limite_cartao_consignado),
              saldoCartaoConsignado: formatMoney(row?.saldo_cartao_consignado),
              saldoCreditoConsignado: formatMoney(row?.saldo_credito_consignado),
              saldoTotalMaximo: formatMoney(row?.saldo_total_maximo),
              saldoTotalUtilizado: formatMoney(row?.saldo_total_utilizado),
              saldoTotalDisponivel: formatMoney(row?.saldo_total_disponivel),
              saldoCartaoBeneficioRaw: row?.saldo_cartao_beneficio,
              saldoCartaoConsignadoRaw: row?.saldo_cartao_consignado,
              saldoTotalDisponivelRaw: row?.saldo_total_disponivel,
              bancoCodigo,
              bancoNomeRaw: hasValue(row?.banco_desembolso) && !digitsOnly(row?.banco_desembolso) ? String(row?.banco_desembolso).trim() : '',
              agenciaDesembolso: stripTrailingZeroDecimals(row?.agencia_desembolso),
              contaDesembolso: hasValue(conta) ? `${conta}` : '-',
              digitoDesembolso: hasValue(digito) ? String(digito) : '-',
              numeroPortabilidades: hasValue(row?.numero_portabilidades) ? String(row?.numero_portabilidades) : '-',
              numeroPortabilidadesRaw: row?.numero_portabilidades,
              dataHoraRegistro: formatDateTime(row?.data_hora_registro),
              dataHoraRegistroRaw: row?.data_hora_registro,
              uf: firstFilled(row?.estado, row?.UF, row?.uf, '-'),
              respostaApi: formatApiMessageText(firstFilled(row?.resposta_api, '-')),
              statusApi: formatApiMessageText(firstFilled(row?.status_api, '-')),
              rowRaw: row,
            }
          }),
        v8: sortByCreatedAtDesc(
          rowsByFonte.v8.filter((row) => (
            hasValue(firstFilled(row?.cliente_cpf, row?.cpf, row?.CPF))
            || hasValue(firstFilled(row?.cliente_nome, row?.nome, row?.NOME))
            || hasValue(getV8RowStatus(row))
            || hasValue(firstFilled(row?.valor_liberado, row?.valorLiberado, row?.valor))
            || hasValue(getV8Descricao(row))
          ))
        ).map((row, index) => {
          const cpfRaw = digitsOnly(firstFilled(row?.cliente_cpf, row?.cpf, row?.CPF))
          const descricaoV8 = getV8Descricao(row)
          const createdAtRaw = firstFilled(row?.created_at, row?.createdAt, row?.data_hora_registro, '')
          const statusConsultaV8Raw = getV8RowStatus(row)
          return {
            key: `v8-${index}-${cpfRaw || row?.id || 'item'}`,
            cpfRaw,
            cpf: cpfRaw ? formatCpf(cpfRaw) : '-',
            nome: firstFilled(row?.cliente_nome, row?.nome, row?.NOME, '-'),
            createdAtRaw,
            createdAt: parseDateAny(createdAtRaw) ? formatDateTime(createdAtRaw) : (hasValue(createdAtRaw) ? String(createdAtRaw) : '-'),
            statusConsultaV8Raw,
            statusConsultaV8: translateV8StatusLabel(statusConsultaV8Raw),
            valorLiberado: formatMoney(firstFilled(row?.valor_liberado, row?.valorLiberado, row?.valor)),
            descricaoV8,
            hasDescricao: hasValue(descricaoV8),
            rowRaw: row,
          }
        }),
        presenca: rowsByFonte.presenca
          .filter((row) => hasValue(row?.id_contrato_empres) || hasValue(row?.vl_empres) || hasValue(row?.nb))
          .map(mapContratoPadrao),
        handmais: rowsByFonte.handmais
          .filter((row) => hasValue(row?.id_contrato_empres) || hasValue(row?.vl_empres) || hasValue(row?.nb))
          .map(mapContratoPadrao),
      }

      return {
        nome: firstFilled(
          pickFromRows(personalRows, ['Entrantes', 'entrantes', 'nome_segurado', 'NOME', 'nome', 'cliente_nome']),
          pickFromRows(mergedRows, ['Entrantes', 'entrantes', 'nome_segurado', 'NOME', 'nome', 'cliente_nome'])
        ),
        cpfRaw: cpfValue,
        cpf: hasValue(cpfValue) ? formatCpf(cpfValue) : '-',
        idade: formatAge(
          firstFilled(
            pickFromRows(personalRows, ['IDADE', 'idade']),
            pickFromRows(mergedRows, ['IDADE', 'idade'])
          ),
          nascimentoValue
        ),
        nascimento: formatDate(nascimentoValue),
        nb: firstFilled(selectedBeneficio, pickFromRows(mergedRows, ['numero_beneficio', 'Beneficio', 'nb', 'nb_tratado']), '-'),
        especie: firstFilled(
          pickFromRows(personalRows, ['esp', 'CODIGO_ESPECIE']),
          pickFromRows(mergedRows, ['esp', 'CODIGO_ESPECIE']),
          '-'
        ),
        dib: formatDate(firstFilled(
          pickFromRows(personalRows, ['data_concessao', 'dib', 'Data_Lemit']),
          pickFromRows(mergedRows, ['data_concessao', 'dib', 'Data_Lemit'])
        )),
        ddb: formatDate(firstFilled(
          pickFromRows(personalRows, ['DDB', 'ddb']),
          pickFromRows(mergedRows, ['DDB', 'ddb'])
        )),
        consignavel: (
          (parseNumber(firstFilled(
            pickFromRows(personalRows, ['MARGEM_RMC']),
            pickFromRows(mergedRows, ['MARGEM_RMC'])
          )) || 0) > 0
          || (parseNumber(firstFilled(
            pickFromRows(personalRows, ['MARGEM_DISPONIVEL']),
            pickFromRows(mergedRows, ['MARGEM_DISPONIVEL'])
          )) || 0) > 0
          || String(firstFilled(
            pickFromRows(personalRows, ['situacao_beneficio']),
            pickFromRows(mergedRows, ['situacao_beneficio'])
          )).toLowerCase() === 'elegible'
        ) ? 'Sim' : '-',
        situacao: firstFilled(
          mapSituacaoIn100(firstFilled(
            pickFromRows(personalRows, ['situacao_beneficio']),
            pickFromRows(mergedRows, ['situacao_beneficio'])
          )),
          mapSituacao(firstFilled(
            pickFromRows(personalRows, ['situacao_empres', 'situacao']),
            pickFromRows(mergedRows, ['situacao_empres', 'situacao'])
          )),
          '-'
        ),
        uf: firstFilled(
          pickFromRows(personalRows, ['UF', 'uf', 'estado']),
          pickFromRows(mergedRows, ['UF', 'uf', 'estado']),
          '-'
        ),
        margemRmc: formatMoney(pickFromRows(globalRows, ['MARGEM_RMC'])),
        margemRcc: formatMoney(pickFromRows(globalRows, ['Margem_RCC', 'MARGEM_RCC'])),
        margemLivre: formatMoney(pickFromRows(globalRows, ['MARGEM_DISPONIVEL'])),
        renda: formatMoney(pickFromRows(globalRows, ['VALOR_BENEFICIO', 'vl_beneficio'])),
        valorLiberadoRmc: formatMoney(pickFromRows(globalRows, ['valor_liberador_RMC', 'valor_liberador_rmc'])),
        valorLiberadoRcc: formatMoney(pickFromRows(globalRows, ['valor_liberador_RCC', 'valor_liberador_rcc'])),
        totalValorLiberado: formatMoney(firstFilled(
          pickFromRows(globalRows, ['Total_Valor_Liberado', 'total_valor_liberado']),
          pickFromRows(globalRows, ['Total_Valor_Liberado(0.02801)', 'Total_Valor_Liberado(0,02801)']),
        )),
        totalCartao: formatMoney(pickFromRows(globalRows, ['total_cartao', 'Total_Cartao', 'TOTAL_CARTAO'])),
        saldoCartaoBeneficio: formatMoney(pickFromRows(globalRows, ['saldo_cartao_beneficio'])),
        saldoCartaoConsignado: formatMoney(pickFromRows(globalRows, ['saldo_cartao_consignado'])),
        margemDisponivelIn100: formatMoney(pickFromRows(globalRows, ['saldo_total_disponivel'])),
        portabilidades: firstFilled(pickFromRows(globalRows, ['numero_portabilidades']), '-'),
        telefoneInclusao: formatDate(pickFromRows(globalRows, ['Data_Lemit'])),
        enderecos,
        phones,
        bankRows,
        contratosByFonte,
        benefitOptions: benefitOptions.map((item) => ({
          key: item.key,
          beneficio: item.beneficio || '-',
          cpf: item.cpf || '-',
          nome: item.nome || '-',
          label: item.beneficio || '-',
        })),
        selectedBenefitKey: selectedOption?.key || '',
        shouldShowBenefitSelect,
      }
    } catch (profileError) {
      console.error('ConsultaClientes profile parse error', profileError)
      return null
    }
  }, [visibleRows, selectedBenefitKey])

  const selectedContratoFonteLabel = useMemo(
    () => CONTRATO_FONTES.find((fonte) => fonte.value === contratoFonte)?.label || 'Contratos',
    [contratoFonte]
  )
  const selectedContratoRows = useMemo(
    () => profile?.contratosByFonte?.[contratoFonte] ?? [],
    [profile?.contratosByFonte, contratoFonte]
  )
  const hasRoundedTaxa = useMemo(
    () => contratoFonte !== 'in100' && Boolean(selectedContratoRows?.some((item) => item?.showRoundedTaxaHint)),
    [contratoFonte, selectedContratoRows]
  )
  const contratoQuantidadeByFonte = useMemo(() => ({
    portabilidade: profile?.contratosByFonte?.portabilidade?.length ?? 0,
    in100: profile?.contratosByFonte?.in100?.length ?? 0,
    v8: profile?.contratosByFonte?.v8?.length ?? 0,
    presenca: profile?.contratosByFonte?.presenca?.length ?? 0,
    handmais: profile?.contratosByFonte?.handmais?.length ?? 0,
  }), [profile?.contratosByFonte])
  const modalidadesDisponiveis = useMemo(
    () => CONTRATO_FONTES
      .map((fonte) => ({ ...fonte, quantidade: Number(contratoQuantidadeByFonte[fonte.value] ?? 0) }))
      .filter((item) => item.quantidade > 0),
    [contratoQuantidadeByFonte]
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(CONTRATO_FONTE_STORAGE_KEY, contratoFonte)
    } catch {
      // Sem bloquear a UI se o navegador negar acesso ao storage.
    }
  }, [contratoFonte])

  useEffect(() => {
    if (loading || !profile || modalidadesDisponiveis.length === 0) return
    const cpfToken = String(profile?.cpfRaw || profile?.cpf || '').trim()
    const modalKey = modalidadesDisponiveis.map((item) => `${item.value}:${item.quantidade}`).join('|')
    const toastKey = `${cpfToken}|${modalKey}`
    if (!cpfToken || disponibilidadeToastKeyRef.current === toastKey) return

    disponibilidadeToastKeyRef.current = toastKey
    notify.info(
      <div className="d-flex flex-column gap-2" style={{ fontSize: 15, lineHeight: 1.25 }}>
        <div className="fw-bold" style={{ fontSize: 16 }}>Modalidades disponíveis</div>
        {modalidadesDisponiveis.map((item) => (
          <div key={item.value} className="d-flex align-items-center gap-2 fw-semibold">
            <img
              src={CONTRATO_FONTE_ICON_BY_VALUE[item.value] || '/neo-logo.svg'}
              alt={item.label}
              width="25"
              height="25"
              style={{ width: 25, height: 25, objectFit: 'contain', borderRadius: 4 }}
            />
            <span>{item.label}: {item.quantidade}</span>
          </div>
        ))}
      </div>,
      { autoClose: 5000 }
    )
  }, [loading, profile, modalidadesDisponiveis])

  const selectedIn100Row = useMemo(() => {
    if (contratoFonte !== 'in100' || !selectedContratoRows?.length) return null
    const ordered = [...selectedContratoRows].sort((a, b) => {
      const aNome = hasValue(a?.nome) && a.nome !== '-' ? 1 : 0
      const bNome = hasValue(b?.nome) && b.nome !== '-' ? 1 : 0
      if (aNome !== bNome) return bNome - aNome
      const aTs = parseDateAny(a?.dataHoraRegistroRaw)?.getTime?.() || 0
      const bTs = parseDateAny(b?.dataHoraRegistroRaw)?.getTime?.() || 0
      return bTs - aTs
    })
    return ordered[0] || null
  }, [contratoFonte, selectedContratoRows])
  const profileView = useMemo(() => {
    if (!profile) return null
    if (!selectedIn100Row) return profile
    return {
      ...profile,
      nome: hasValue(selectedIn100Row.nome) ? selectedIn100Row.nome : profile.nome,
      cpfRaw: hasValue(selectedIn100Row.numeroDocumentoRaw) ? selectedIn100Row.numeroDocumentoRaw : profile.cpfRaw,
      cpf: hasValue(selectedIn100Row.numeroDocumento) ? selectedIn100Row.numeroDocumento : profile.cpf,
      nb: hasValue(selectedIn100Row.numeroBeneficio) ? selectedIn100Row.numeroBeneficio : profile.nb,
      dib: hasValue(selectedIn100Row.dataConcessao) ? selectedIn100Row.dataConcessao : profile.dib,
      situacao: hasValue(selectedIn100Row.situacaoBeneficio) ? selectedIn100Row.situacaoBeneficio : profile.situacao,
      uf: hasValue(selectedIn100Row.uf) ? selectedIn100Row.uf : profile.uf,
      saldoCartaoBeneficio: hasValue(selectedIn100Row.saldoCartaoBeneficio) ? selectedIn100Row.saldoCartaoBeneficio : profile.saldoCartaoBeneficio,
      saldoCartaoConsignado: hasValue(selectedIn100Row.saldoCartaoConsignado) ? selectedIn100Row.saldoCartaoConsignado : profile.saldoCartaoConsignado,
      margemDisponivelIn100: hasValue(selectedIn100Row.saldoTotalDisponivel) ? selectedIn100Row.saldoTotalDisponivel : profile.margemDisponivelIn100,
      portabilidades: hasValue(selectedIn100Row.numeroPortabilidades) ? selectedIn100Row.numeroPortabilidades : profile.portabilidades,
      bankRows: [{
        tipoLiberacao: profile.bankRows?.[0]?.tipoLiberacao || '',
        bancoCodigo: selectedIn100Row.bancoCodigo || profile.bankRows?.[0]?.bancoCodigo || '',
        bancoNomeRaw: selectedIn100Row.bancoNomeRaw || profile.bankRows?.[0]?.bancoNomeRaw || '',
        agencia: selectedIn100Row.agenciaDesembolso || profile.bankRows?.[0]?.agencia || '',
        conta: selectedIn100Row.contaDesembolso || profile.bankRows?.[0]?.conta || '',
        digito: selectedIn100Row.digitoDesembolso || profile.bankRows?.[0]?.digito || '',
        tipoCredito: selectedIn100Row.tipoCredito || profile.bankRows?.[0]?.tipoCredito || '',
      }],
    }
  }, [profile, selectedIn100Row])

  useEffect(() => {
    if (!profile?.benefitOptions?.length) {
      if (selectedBenefitKey) setSelectedBenefitKey('')
      return
    }
    const exists = profile.benefitOptions.some((item) => item.key === selectedBenefitKey)
    if (!exists) {
      setSelectedBenefitKey(profile.benefitOptions[0].key)
    }
  }, [profile, selectedBenefitKey])

  useEffect(() => {
    setIsEnderecosOpen(false)
    setIsBancosOpen(true)
    setIsContratosOpen(true)
  }, [profile?.cpfRaw])

  useEffect(() => {
    if (!isContratosOpen || !hasRoundedTaxa) {
      setShowRoundedTaxaHint(false)
      return
    }
    setShowRoundedTaxaHint(true)
    const timer = setTimeout(() => setShowRoundedTaxaHint(false), 3000)
    return () => clearTimeout(timer)
  }, [isContratosOpen, hasRoundedTaxa])

  const executeConsulta = useCallback(async (cpfInput, { syncUrl = true } = {}) => {
    const cpfDigits = normalizeCpfForConsulta(cpfInput)
    if (!cpfDigits) {
      setError('Informe um CPF válido.')
      setRows([])
      setRawPayload(null)
      return
    }

    setLoading(true)
    setError('')

    try {
      const url = new URL(API_URL)
      url.searchParams.set('cpf', cpfDigits)
      if (userContext.idUser !== null) url.searchParams.set('id_user', String(userContext.idUser))
      if (userContext.equipeId !== null) url.searchParams.set('equipe_id', String(userContext.equipeId))
      if (userContext.hierarquia) url.searchParams.set('hierarquia', userContext.hierarquia)

      const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } })
      const payload = await parseResponseBody(response)
      const normalized = normalizeRows(payload)

      setSelectedBenefitKey('')
      setRows(normalized)
      setRawPayload(payload)
      if (normalized.length === 0) notify.info('Nenhum dado encontrado para este CPF.')
      if (syncUrl) navigate(`/consultas/clientes?cpf=${cpfDigits}`, { replace: true })
    } catch (e) {
      setRows([])
      setRawPayload(null)
      setError(e?.message || 'Falha ao consultar cliente.')
    } finally {
      setLoading(false)
    }
  }, [navigate, userContext])

  useEffect(() => {
    const urlCpf = normalizeCpfForConsulta(parseCpfFromUrl(location.pathname, location.search))
    if (!urlCpf) return
    if (!userContext.ready) {
      setError('Aguardando dados da sessão para consultar...')
      return
    }

    const requestKey = `${urlCpf}|${userContext.idUser}|${userContext.equipeId}|${userContext.hierarquia}`
    if (lastUrlCpfRef.current === requestKey) return

    lastUrlCpfRef.current = requestKey
    setCpf(formatCpf(urlCpf))
    executeConsulta(urlCpf, { syncUrl: false })
  }, [location.pathname, location.search, executeConsulta, userContext])

  const handleSubmit = useCallback((event) => {
    event.preventDefault()
    executeConsulta(cpf, { syncUrl: false })
  }, [cpf, executeConsulta])

  const currentProfile = profileView || profile
  const isIn100Selected = contratoFonte === 'in100'
  const summaryCards = isIn100Selected
    ? [
      { label: 'Saldo Cartão Benefício', value: currentProfile?.saldoCartaoBeneficio ?? '-', footer: '' },
      { label: 'Saldo Cartão Consignado', value: currentProfile?.saldoCartaoConsignado ?? '-', footer: '' },
      { label: 'Margem disponível', value: currentProfile?.margemDisponivelIn100 ?? '-', footer: '' },
    ]
    : [
      { label: 'Margem RMC', value: currentProfile?.margemRmc ?? '-', footer: `Valor Liberado RMC: ${currentProfile?.valorLiberadoRmc ?? '-'}` },
      { label: 'Margem RCC', value: currentProfile?.margemRcc ?? '-', footer: `Valor Liberado RCC: ${currentProfile?.valorLiberadoRcc ?? '-'}` },
      { label: 'Total Cartão', value: currentProfile?.totalCartao ?? '-', footer: '' },
      { label: 'Margem Livre', value: currentProfile?.margemLivre ?? '-', footer: `Renda: ${currentProfile?.renda ?? '-'}` },
      { label: 'Valor Consignável', value: currentProfile?.totalValorLiberado ?? '-', footer: '' },
    ]
  const in100ModalData = useMemo(() => {
    if (!in100DetailItem) return null
    const cpfDigits = digitsOnly(firstFilled(in100DetailItem.numeroDocumentoRaw, in100DetailItem.rowRaw?.numero_documento))
    const nbDigits = digitsOnly(firstFilled(in100DetailItem.numeroBeneficio, in100DetailItem.rowRaw?.numero_beneficio))
    return {
      status: firstFilled(in100DetailItem.statusApi, in100DetailItem.rowRaw?.status_api, '-'),
      pesquisa: firstFilled(in100DetailItem.respostaApi, in100DetailItem.rowRaw?.resposta_api, '-'),
      nome: firstFilled(in100DetailItem.nome, in100DetailItem.rowRaw?.nome, '-'),
      cpfDigits,
      cpf: cpfDigits ? formatCpf(cpfDigits) : '-',
      nbDigits,
      nb: nbDigits ? formatBeneficio(nbDigits) : '-',
      uf: firstFilled(in100DetailItem.uf, in100DetailItem.rowRaw?.estado, '-'),
      situacao: firstFilled(in100DetailItem.situacaoBeneficio, '-'),
      dataConcessao: firstFilled(in100DetailItem.dataConcessao, '-'),
      portabilidades: firstFilled(in100DetailItem.numeroPortabilidades, '-'),
      saldoCartaoBeneficio: firstFilled(in100DetailItem.saldoCartaoBeneficio, '-'),
      saldoCartaoConsignado: firstFilled(in100DetailItem.saldoCartaoConsignado, '-'),
      margemDisponivel: firstFilled(in100DetailItem.saldoTotalDisponivel, '-'),
      bancoCodigo: resolveBankCodeDisplay(in100DetailItem.bancoCodigo),
      bancoNome: resolveBankName(in100DetailItem.bancoCodigo, in100DetailItem.bancoNomeRaw),
      agencia: firstFilled(in100DetailItem.agenciaDesembolso, '-'),
      conta: firstFilled(in100DetailItem.contaDesembolso, '-'),
      digito: firstFilled(in100DetailItem.digitoDesembolso, '-'),
      tipoCredito: firstFilled(in100DetailItem.tipoCredito, '-'),
      registro: firstFilled(in100DetailItem.dataHoraRegistro, '-'),
    }
  }, [in100DetailItem, resolveBankCodeDisplay, resolveBankName])
  const v8ModalData = useMemo(() => {
    if (!v8DetailItem) return null
    const cpfRaw = firstFilled(v8DetailItem.cpfRaw, digitsOnly(firstFilled(v8DetailItem.rowRaw?.cliente_cpf, v8DetailItem.rowRaw?.cpf, v8DetailItem.rowRaw?.CPF)))
    return {
      cpfRaw,
      cpf: cpfRaw ? formatCpf(cpfRaw) : '-',
      nome: firstFilled(v8DetailItem.nome, v8DetailItem.rowRaw?.cliente_nome, v8DetailItem.rowRaw?.nome, '-'),
      createdAt: firstFilled(v8DetailItem.createdAt, '-'),
      statusConsultaV8Raw: firstFilled(v8DetailItem.statusConsultaV8Raw, '-'),
      statusConsultaV8: firstFilled(v8DetailItem.statusConsultaV8, '-'),
      valorLiberado: firstFilled(v8DetailItem.valorLiberado, '-'),
      descricao: firstFilled(v8DetailItem.descricaoV8, '-'),
    }
  }, [v8DetailItem])
  const in100ModalStatusIsError = useMemo(
    () => isQualibankingErrorStatus(in100ModalData?.status),
    [in100ModalData?.status]
  )
  const in100ModalStatusIsWarning = useMemo(
    () => isQualibankingWarningStatus(in100ModalData?.status),
    [in100ModalData?.status]
  )
  const in100ModalStatusIsSuccess = useMemo(
    () => isQualibankingSuccessStatus(in100ModalData?.status),
    [in100ModalData?.status]
  )

  return (
    <div className="consulta-clientes-page bg-deep min-vh-100 d-flex flex-column text-light">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        {!hasCpfInUrl && (
          <div className="d-flex align-items-start gap-3 mb-3 flex-wrap">
            <Link to="/dashboard" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Consulta Clientes</h2>
              <div className="small opacity-75">Página para consultar clientes em todos os canais, bancos de dados, IN100 e bancos via API.</div>
            </div>
          </div>
        )}

        {!hasCpfInUrl && (
          <section className="neo-card p-3 p-md-4 mb-3" style={panelStyle}>
            <form className="row g-2 align-items-end" onSubmit={handleSubmit}>
              <div className="col-12 col-md-8 col-lg-6">
                <label className="form-label small opacity-75 mb-1" htmlFor="consulta-clientes-cpf">CPF do cliente</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text"><FiSearch size={14} /></span>
                  <input id="consulta-clientes-cpf" className="form-control" placeholder="000.000.000-00" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} maxLength={14} autoComplete="off" />
                </div>
              </div>
              <div className="col-12 col-md-auto d-flex gap-2">
                <button type="submit" className="btn btn-info btn-sm d-flex align-items-center gap-2" disabled={loading}><FiSearch size={14} /><span>{loading ? 'Consultando...' : 'Consultar'}</span></button>
                <button type="button" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" onClick={() => executeConsulta(cpf, { syncUrl: false })} disabled={loading}><FiRefreshCw size={14} /><span>Atualizar</span></button>
              </div>
            </form>
            {error && <div className="small text-danger mt-2">{error}</div>}
          </section>
        )}

        <section className="neo-card p-3 p-md-4 cc-results-wrap" style={panelStyle}>
          <div className="small opacity-75 mb-3">{loading ? 'Consultando API...' : `${visibleRows.length} registro(s) encontrado(s)`}</div>
          {error && <div className="small text-danger mb-3">{error}</div>}

          {visibleRows.length === 0 ? (
            <div className="small opacity-75">Informe um CPF para consultar.</div>
          ) : currentProfile ? (
            <div className="d-flex flex-column gap-3">
              <section className="neo-card p-3" style={panelStyle}>
                <SectionTitle icon={FiUser} title="Dados Pessoais" />
                <div className="row g-3">
                  <div className="col-12 col-md-4 col-xl-4"><InfoField label="Nome" value={currentProfile.nome} /></div>
                  <div className="col-12 col-md-4 col-xl-4">
                    <div className="d-flex flex-column flex-xl-row align-items-xl-end gap-2 gap-xl-3">
                      <div className="flex-grow-1">
                        <div style={miniLabelStyle}>CPF</div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-semibold">{currentProfile.cpf}</span>
                          <CopyButton value={currentProfile.cpfRaw} label="CPF" />
                        </div>
                      </div>
                      {profile.shouldShowBenefitSelect && (
                        <div style={{ minWidth: 220, width: '100%', maxWidth: 320 }}>
                          <label className="form-label small opacity-75 mb-1">Benefício</label>
                          <select
                            className="form-select form-select-sm"
                            value={profile.selectedBenefitKey}
                            onChange={(event) => setSelectedBenefitKey(event.target.value)}
                          >
                            {profile.benefitOptions.map((item) => (
                              <option key={item.key} value={item.key}>{item.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-12 col-md-4 col-xl-4"><InfoField label="Idade" value={`${currentProfile.nascimento} (${currentProfile.idade})`} /></div>
                </div>
              </section>

              <section className="row g-3">
                {summaryCards.map((item) => (
                  <div key={item.label} className={isIn100Selected ? 'col-12 col-lg-4' : 'col-12 col-md-6 col-xl'}>
                    <div className="neo-card p-3 h-100" style={panelStyle}>
                      <div className="d-flex align-items-center gap-2 mb-2"><span style={bubbleIconStyle}><FiDollarSign size={13} /></span><div className="small opacity-75">{item.label}</div></div>
                      <div className="h3 fw-bold mb-0">{item.value}</div>
                      {item.footer ? (
                        <div className="small fw-semibold mt-3 px-2 py-1 rounded" style={{ background: 'rgba(0, 199, 255, 0.25)' }}>{item.footer}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </section>

              <section className="row g-3">
                <div className="col-12 col-xl-7">
                  <div className="neo-card p-3 h-100" style={panelStyle}>
                    <SectionTitle icon={FiBriefcase} title="Informações da Matrícula" right={<div className="d-flex align-items-center gap-2"><span className="badge text-bg-dark">Matrícula</span><span className="fw-semibold">{currentProfile.nb}</span><CopyButton value={currentProfile.nb} label="Matrícula" /></div>} />
                    <MatriculaLine leftLabel="NB" leftValue={currentProfile.nb} rightLabel="Consignável" rightValue={currentProfile.consignavel} />
                    <MatriculaLine leftLabel="Espécie" leftValue={currentProfile.especie} rightLabel="Situação" rightValue={currentProfile.situacao} />
                    <MatriculaLine leftLabel="Data Início Benefício" leftValue={currentProfile.dib} rightLabel="UF" rightValue={currentProfile.uf} />
                    <div className="row g-2 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="col-12 col-lg-6 d-flex justify-content-between gap-3">
                        <span style={miniLabelStyle}>Data Despacho Benefício:</span>
                        <span className="fw-semibold text-end">{hasValue(currentProfile.ddb) ? currentProfile.ddb : '-'}</span>
                      </div>
                    </div>
                    {isIn100Selected && (
                      <div className="row g-2 py-2">
                        <div className="col-12 col-lg-6 d-flex justify-content-between gap-3">
                          <span style={miniLabelStyle}>Portabilidades:</span>
                          <span className="fw-semibold text-end">{currentProfile.portabilidades || '-'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-12 col-xl-5">
                  <div className="neo-card p-3 h-100" style={panelStyle}>
                    <SectionTitle icon={FiPhone} title={`Telefones (${currentProfile.phones.length})`} />
                    <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-0"><thead><tr><th style={{ width: 52 }}></th><th>Número</th><th>Inclusão</th></tr></thead><tbody>{currentProfile.phones.length === 0 ? <EmptyCell colSpan={3} text="Nenhum telefone disponível." /> : currentProfile.phones.map((phone) => <tr key={phone}><td><a href={buildWhatsAppUrl(phone)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-icon btn-sm" title="Conversar no WhatsApp" aria-label="Conversar no WhatsApp"><FaWhatsapp size={14} color="#22c55e" /></a></td><td><button type="button" className="btn btn-link p-0 text-reset" title="Copiar telefone" onClick={() => copyPhoneDigits(phone)}>{formatPhone(phone)}</button></td><td>{currentProfile.telefoneInclusao || '-'}</td></tr>)}</tbody></table></div>
                  </div>
                </div>
              </section>

              <section className="row g-3">
                <div className="col-12">
                  <div className="neo-card p-3 h-100" style={panelStyle}>
                    <SectionTitle
                      icon={FiHome}
                      title={`Endereços (${currentProfile.enderecos.length})`}
                      right={<AccordionToggle open={isEnderecosOpen} onToggle={() => setIsEnderecosOpen((prev) => !prev)} label="endereços" />}
                    />
                    {isEnderecosOpen && (
                      <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-0"><thead><tr><th style={{ width: 30 }}></th><th>CEP</th><th>Rua</th><th>Bairro</th><th>Cidade</th></tr></thead><tbody>{currentProfile.enderecos.length === 0 ? <EmptyCell colSpan={5} text="Nenhum endereço disponível." /> : currentProfile.enderecos.map((item) => <tr key={`${item.cep}-${item.rua}-${item.cidade}`}><td><FiCircle size={12} /></td><td>{item.cep || '-'}</td><td>{item.rua || '-'}</td><td>{item.bairro || '-'}</td><td>{item.cidade ? `${item.cidade} /${item.uf || '-'}` : '-'}</td></tr>)}</tbody></table></div>
                    )}
                  </div>
                </div>
              </section>

              <section className="row g-3">
                <div className="col-12 col-xl-6">
                  <div className="neo-card p-3 h-100" style={panelStyle}>
                    <SectionTitle
                      icon={FiCreditCard}
                      title={`Dados Bancários (${currentProfile.bankRows.length})`}
                      right={<AccordionToggle open={isBancosOpen} onToggle={() => setIsBancosOpen((prev) => !prev)} label="dados bancários" />}
                    />
                    {isBancosOpen && (
                      <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-0"><thead><tr><th>Cód.</th><th>Banco</th><th>Agência</th><th>Conta</th><th>Dígito</th><th>Tipo de crédito</th></tr></thead><tbody>{currentProfile.bankRows.length === 0 ? <EmptyCell colSpan={6} text="Nenhum dado bancário disponível." /> : currentProfile.bankRows.map((item) => <tr key={`${item.tipoLiberacao}-${item.bancoCodigo}-${item.conta}`}><td>{resolveBankCodeDisplay(item.bancoCodigo)}</td><td><BankNameWithIcon bankCode={item.bancoCodigo} bankName={resolveBankName(item.bancoCodigo, item.bancoNomeRaw)} /></td><td>{item.agencia || '-'}</td><td>{item.conta || '-'}</td><td>{item.digito || '-'}</td><td>{item.tipoCredito || '-'}</td></tr>)}</tbody></table></div>
                    )}
                  </div>
                </div>
                <div className="col-12 col-xl-6">
                  <div className="neo-card p-3 h-100" style={panelStyle}>
                    <SectionTitle icon={FiBriefcase} title="Modalidades de Contrato" />
                    <div className="table-responsive">
                      <table className="table table-dark table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Modalidade</th>
                            <th style={{ width: 170 }}>Qtd. contratos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {CONTRATO_FONTES.map((fonte) => (
                            <tr key={fonte.value}>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-link p-0 border-0 text-decoration-none text-start align-baseline"
                                  style={{
                                    color: contratoFonte === fonte.value ? '#22d3ee' : 'inherit',
                                    fontWeight: contratoFonte === fonte.value ? 700 : 500,
                                  }}
                                  onClick={() => setContratoFonte(fonte.value)}
                                >
                                  <span className="d-inline-flex align-items-center gap-2">
                                    <img
                                      src={CONTRATO_FONTE_ICON_BY_VALUE[fonte.value] || '/neo-logo.svg'}
                                      alt={fonte.label}
                                      loading="lazy"
                                      width="18"
                                      height="18"
                                      style={{ objectFit: 'contain', borderRadius: 4 }}
                                      onError={(event) => {
                                        if (event.currentTarget.src.endsWith('/neo-logo.svg')) return
                                        event.currentTarget.src = '/neo-logo.svg'
                                      }}
                                    />
                                    <span>{fonte.label}</span>
                                  </span>
                                </button>
                              </td>
                              <td>{contratoQuantidadeByFonte[fonte.value] ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="neo-card p-3" style={panelStyle}>
                  <SectionTitle
                    icon={FiDollarSign}
                    title={selectedContratoFonteLabel}
                    right={<AccordionToggle open={isContratosOpen} onToggle={() => setIsContratosOpen((prev) => !prev)} label="contratos" />}
                  />
                  {isContratosOpen && (
                    <div className="table-responsive">
                      {contratoFonte === 'in100' ? (
                        <table className="table table-dark table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>CPF</th>
                              <th>NB</th>
                              <th>Nome</th>
                              <th>Cód</th>
                              <th>Banco</th>
                              <th>Limite Cartão Consignado</th>
                              <th>Saldo Cartão Benefício</th>
                              <th>Saldo Cartão Consignado</th>
                              <th style={{ width: 130 }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedContratoRows.length === 0 ? (
                              <EmptyCell colSpan={9} text="Nenhum registro de Qualibanking encontrado." />
                            ) : (
                              selectedContratoRows.map((item) => (
                                <tr key={item.key}>
                                  <td>{item.numeroDocumento || '-'}</td>
                                  <td>{item.numeroBeneficio || '-'}</td>
                                  <td>{item.nome || '-'}</td>
                                  <td>{resolveBankCodeDisplay(item.bancoCodigo)}</td>
                                  <td>
                                    <BankNameWithIcon
                                      bankCode={item.bancoCodigo}
                                      bankName={resolveBankName(item.bancoCodigo, item.bancoNomeRaw)}
                                    />
                                  </td>
                                  <td>{item.limiteCartaoConsignado || '-'}</td>
                                  <td>{item.saldoCartaoBeneficio || '-'}</td>
                                  <td>{item.saldoCartaoConsignado || '-'}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-outline-info btn-sm d-inline-flex align-items-center justify-content-center"
                                      title="Descrição"
                                      aria-label="Descrição"
                                      onClick={() => setIn100DetailItem(item)}
                                    >
                                      <FiList size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      ) : contratoFonte === 'v8' ? (
                        <table className="table table-dark table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>CPF</th>
                              <th>Nome</th>
                              <th>Última atualização</th>
                              <th>Status Consulta V8</th>
                              <th>Valor Liberado</th>
                              <th style={{ width: 110 }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedContratoRows.length === 0 ? (
                              <EmptyCell colSpan={6} text="Nenhum registro de V8 encontrado." />
                            ) : (
                              sortByCreatedAtDesc(selectedContratoRows).map((item) => (
                                <tr key={item.key}>
                                  <td>{item.cpf || '-'}</td>
                                  <td>{item.nome || '-'}</td>
                                  <td>{item.createdAt || '-'}</td>
                                  <td>
                                    <span className={`badge ${getV8StatusBadgeClass(item.statusConsultaV8Raw || item.statusConsultaV8)}`}>
                                      {item.statusConsultaV8 || '-'}
                                    </span>
                                  </td>
                                  <td>{item.valorLiberado || '-'}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-outline-info btn-sm d-inline-flex align-items-center justify-content-center"
                                      title={item.hasDescricao ? 'Descrição' : 'Sem descrição_v8'}
                                      aria-label="Descrição"
                                      onClick={() => setV8DetailItem(item)}
                                      disabled={!item.hasDescricao}
                                    >
                                      <FiList size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      ) : (
                        <table className="table table-dark table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Cód.</th>
                              <th>Banco</th>
                              <th>N do Contrato</th>
                              <th>Pago/Restantes</th>
                              <th>Parcelas</th>
                              <th>Taxa</th>
                              <th>Valor Parcela</th>
                              <th>Emprestado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedContratoRows.length === 0 ? (
                              <EmptyCell colSpan={8} text="Nenhum contrato encontrado." />
                            ) : (
                              selectedContratoRows.map((item) => (
                                <tr key={item.key}>
                                  <td>{resolveBankCodeDisplay(item.bancoCodigo)}</td>
                                  <td>
                                    <BankNameWithIcon
                                      bankCode={item.bancoCodigo}
                                      bankName={resolveBankName(item.bancoCodigo, item.bancoNomeRaw)}
                                    />
                                  </td>
                                  <td>{item.contrato || '-'}</td>
                                  <td>{item.pgtoRestantes || '-'}</td>
                                  <td>{item.parcelas || '-'}</td>
                                  <td>
                                    <span className="d-inline-flex align-items-center gap-1 position-relative">
                                      <span>{item.taxa || '-'}</span>
                                      {showRoundedTaxaHint && item.showRoundedTaxaHint && (
                                        <span className="d-inline-flex align-items-center position-relative" aria-live="polite">
                                          <FiAlertTriangle size={13} className="text-warning" />
                                          <span
                                            style={{
                                              position: 'absolute',
                                              left: 'calc(100% + 8px)',
                                              top: '50%',
                                              transform: 'translateY(-50%)',
                                              zIndex: 1600,
                                              pointerEvents: 'none',
                                              whiteSpace: 'normal',
                                              maxWidth: 320,
                                              minWidth: 280,
                                              padding: '7px 10px',
                                              borderRadius: 10,
                                              border: '1px solid rgba(255,255,255,0.16)',
                                              background: 'rgba(8, 12, 22, 0.72)',
                                              color: '#e2e8f0',
                                              fontSize: 12,
                                              fontWeight: 600,
                                              letterSpacing: '0.01em',
                                              boxShadow: '0 12px 24px rgba(0, 0, 0, 0.35)',
                                              backdropFilter: 'blur(4px)',
                                            }}
                                            role="tooltip"
                                          >
                                            Taxa arredondada, necessário refazer o cálculo com o extrato atualizado!
                                          </span>
                                          <span
                                            aria-hidden="true"
                                            style={{
                                              position: 'absolute',
                                              left: 'calc(100% + 3px)',
                                              top: '50%',
                                              width: 10,
                                              height: 10,
                                              transform: 'translateY(-50%) rotate(45deg)',
                                              background: 'rgba(8, 12, 22, 0.72)',
                                              borderLeft: '1px solid rgba(255,255,255,0.16)',
                                              borderBottom: '1px solid rgba(255,255,255,0.16)',
                                              zIndex: 1601,
                                            }}
                                          />
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  <td>{hasValue(item.valorParcela) ? formatMoney(item.valorParcela) : '-'}</td>
                                  <td>{hasValue(item.emprestado) ? formatMoney(item.emprestado) : '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              <div className="small text-warning">A API respondeu em formato não mapeado para o layout detalhado.</div>
              {columns.length > 0 && <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-0"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visibleRows.map((row, index) => <tr key={`row-${index}`}>{columns.map((column) => <td key={`${index}-${column}`}>{hasValue(row?.[column]) ? String(row[column]) : '-'}</td>)}</tr>)}</tbody></table></div>}
            </div>
          )}

        </section>
      </main>
      {v8DetailItem && v8ModalData && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ background: 'rgba(2, 6, 23, 0.72)', zIndex: 2500 }}
          onClick={() => setV8DetailItem(null)}
        >
          <div
            className="neo-card p-3 p-md-4"
            style={{ width: 'min(760px, 100%)', maxHeight: '85vh', overflow: 'auto', borderRadius: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h6 className="mb-0">Detalhes do cliente</h6>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm text-danger"
                aria-label="Fechar"
                title="Fechar"
                onClick={() => setV8DetailItem(null)}
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="small opacity-75 mb-3">Última atualização: {v8ModalData.createdAt}</div>
            <div className="row g-2 mb-3">
              <div className="col-12 col-lg-8">
                <div className="small opacity-75">Nome</div>
                <div className="fw-semibold text-break">{v8ModalData.nome}</div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="small opacity-75">CPF</div>
                <div className="fw-semibold d-flex align-items-center gap-2">
                  <span>{v8ModalData.cpf}</span>
                  <CopyButton value={v8ModalData.cpfRaw} label="CPF" />
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <div className="small opacity-75">Status Consulta V8</div>
                <div className="fw-semibold">
                  <span className={`badge ${getV8StatusBadgeClass(v8ModalData.statusConsultaV8Raw || v8ModalData.statusConsultaV8)}`}>
                    {v8ModalData.statusConsultaV8}
                  </span>
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <div className="small opacity-75">Valor Liberado</div>
                <div className="fw-semibold">{v8ModalData.valorLiberado}</div>
              </div>
            </div>
            <div className="neo-card p-3">
              <div className="small opacity-75 mb-1">Descrição</div>
              <div className="fw-semibold text-break">{v8ModalData.descricao}</div>
            </div>
          </div>
        </div>
      )}
      {in100DetailItem && in100ModalData && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ background: 'rgba(2, 6, 23, 0.72)', zIndex: 2500 }}
          onClick={() => setIn100DetailItem(null)}
        >
          <div
            className="neo-card p-3 p-md-4"
            style={{ width: 'min(1100px, 100%)', maxHeight: '85vh', overflow: 'auto', borderRadius: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="mb-0">Descrição do Registro Qualibanking</h6>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm text-danger"
                aria-label="Fechar"
                title="Fechar"
                onClick={() => setIn100DetailItem(null)}
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="small opacity-75 mb-3">Atualizado: {in100ModalData.registro}</div>
            <div className="row g-2 mb-3">
              <div className="col-12 col-lg-6">
                <div className="small opacity-75">Status</div>
                <div
                  className={`fw-semibold text-break ${in100ModalStatusIsWarning ? 'text-warning' : ''} ${!in100ModalStatusIsWarning && in100ModalStatusIsError ? 'text-danger' : ''} ${in100ModalStatusIsSuccess ? 'text-success' : ''}`}
                >
                  {in100ModalData.status}
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <div className="small opacity-75">Pesquisa</div>
                <div className="fw-semibold text-break">{in100ModalData.pesquisa}</div>
              </div>
            </div>

            <div className="neo-card p-3 mb-3">
              <div className="fw-semibold mb-2">Dados pessoais</div>
              <div className="row g-2">
                <div className="col-12 col-lg-5">
                  <div className="small opacity-75">Nome</div>
                  <div className="fw-semibold text-break">{in100ModalData.nome}</div>
                </div>
                <div className="col-6 col-lg-3">
                  <div className="small opacity-75">CPF</div>
                  <div className="fw-semibold d-flex align-items-center gap-2">
                    <span>{in100ModalData.cpf}</span>
                    <CopyButton value={in100ModalData.cpfDigits} label="CPF" />
                  </div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="small opacity-75">Idade</div>
                  <div className="fw-semibold">-</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="small opacity-75">UF</div>
                  <div className="fw-semibold">{in100ModalData.uf}</div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0 mb-3">
              <div className="section-bar px-3 py-2">
                <div className="fw-semibold">Informacoes da matricula</div>
              </div>
              <div className="kv-list p-3">
                <div className="kv-line">
                  <div className="kv-label">NB:</div>
                  <div className="kv-value d-flex align-items-center gap-2">
                    <span>{in100ModalData.nb}</span>
                    <CopyButton value={in100ModalData.nbDigits} label="NB" />
                  </div>
                  <div className="kv-label">Especie:</div>
                  <div className="kv-value">-</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Situacao:</div>
                  <div className="kv-value">{in100ModalData.situacao}</div>
                  <div className="kv-label">Data de concessao:</div>
                  <div className="kv-value">{in100ModalData.dataConcessao}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">UF:</div>
                  <div className="kv-value">{in100ModalData.uf}</div>
                  <div className="kv-label">Despacho do beneficio:</div>
                  <div className="kv-value">-</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Representante / Procurador:</div>
                  <div className="kv-value">-</div>
                  <div className="kv-label">Portabilidades:</div>
                  <div className="kv-value">{in100ModalData.portabilidades}</div>
                </div>
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card h-100">
                  <div className="p-3">
                    <div className="stat-title">Saldo Cartao Beneficio</div>
                    <div className="stat-value">{in100ModalData.saldoCartaoBeneficio}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card h-100">
                  <div className="p-3">
                    <div className="stat-title">Saldo Cartao Consignado</div>
                    <div className="stat-value">{in100ModalData.saldoCartaoConsignado}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card h-100">
                  <div className="p-3">
                    <div className="stat-title">Margem disponivel</div>
                    <div className="stat-value">{in100ModalData.margemDisponivel}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0">
              <div className="section-bar px-3 py-2">
                <div className="fw-semibold">Dados bancarios</div>
              </div>
              <div className="kv-list p-3">
                <div className="kv-line">
                  <div className="kv-label">Banco:</div>
                  <div className="kv-value">{in100ModalData.bancoCodigo}</div>
                  <div className="kv-label">Nome do banco:</div>
                  <div className="kv-value">{in100ModalData.bancoNome}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Agencia:</div>
                  <div className="kv-value">{in100ModalData.agencia}</div>
                  <div className="kv-label">Conta:</div>
                  <div className="kv-value">{in100ModalData.conta}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Digito:</div>
                  <div className="kv-value">{in100ModalData.digito}</div>
                  <div className="kv-label">Tipo de credito:</div>
                  <div className="kv-value">{in100ModalData.tipoCredito}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
