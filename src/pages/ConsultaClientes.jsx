import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBriefcase,
  FiChevronRight,
  FiCalendar,
  FiCircle,
  FiCopy,
  FiCreditCard,
  FiDollarSign,
  FiList,
  FiHome,
  FiPhone,
  FiSearch,
  FiUser,
  FiX,
} from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { notify } from '../utils/notify.js'
import '../styles/consulta-clientes.css'

const API_BASE = 'http://85.31.61.242:8011/api'
const LOCAL_BANK_NAME_BY_CODE = {
  '1': 'Banco do Brasil',
  '104': 'Caixa Economica Federal',
  '212': 'Banco Original',
  '237': 'Banco Bradesco',
  '260': 'Nubank',
  '318': 'Banco BMG',
  '341': 'Itau',
  '623': 'Banco Pan',
  '756': 'Sicoob',
}
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
  { value: 'prata', label: 'Prata' },
]
const CONTRATO_FONTE_ICON_BY_VALUE = {
  portabilidade: '/neo-logo.svg',
  in100: 'https://qualibanking.com.br/Qlogo.png',
  v8: 'https://v8-white-label-logos.s3.us-east-1.amazonaws.com/v8-rebrand/v8-logo-auth0.svg',
  presenca: 'https://portal.presencabank.com.br/assets/images/presencabank/logo.svg',
  handmais: '/handplus-logo.svg',
  prata: '/prata-digital-logo.svg',
}
const getInitialContratoFonte = () => 'portabilidade'

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')
const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== ''
const hasDisplayValue = (value) => {
  if (!hasValue(value)) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized !== '-' && normalized !== '--' && normalized !== 'null' && normalized !== 'undefined' && normalized !== 'n/a'
}
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

const parseNullableBoolean = (value) => {
  if (value === null || value === undefined) return null
  const token = String(value).trim().toLowerCase()
  if (!token) return null
  if (token === 'true' || token === '1' || token === 'sim') return true
  if (token === 'false' || token === '0' || token === 'nao' || token === 'não') return false
  return null
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
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw)
  if (brMatch) {
    const day = Number(brMatch[1])
    const month = Number(brMatch[2])
    const year = Number(brMatch[3])
    const hour = Number(brMatch[4] ?? 0)
    const minute = Number(brMatch[5] ?? 0)
    const second = Number(brMatch[6] ?? 0)
    const date = new Date(year, month - 1, day, hour, minute, second)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

const getRowUpdatedAtCandidate = (row) => firstFilled(
  row?.updated_at,
  row?.updatedAt,
  row?.data_update,
  row?.dataUpdate,
  row?.data_hora_registro,
  row?.data_hora,
  row?.data,
  row?.created_at,
  row?.createdAt,
  row?.timestamp,
  row?.result?.updated_at,
  row?.result?.updatedAt,
  row?.result?.data_update,
  row?.result?.dataUpdate,
  row?.result?.created_at,
  row?.result?.createdAt,
  row?.result?.timestamp,
  row?.result?.original?.updated_at,
  row?.result?.original?.updatedAt,
  row?.original?.updated_at,
  row?.original?.updatedAt,
)

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

const getHandMaisStatusBadgeClass = (statusRaw) => {
  const status = normalizeSourceToken(statusRaw)
  if (!status || status === '-') return 'text-bg-secondary'
  if (status === 'consultado' || status.includes('sucesso') || status.includes('concluid')) return 'text-bg-success'
  if (status.includes('erro') || status.includes('falha')) return 'text-bg-danger'
  if (status.includes('process')) return 'text-bg-info'
  if (status.includes('pend')) return 'text-bg-warning text-dark'
  return 'text-bg-secondary'
}

const getHandMaisStatus = (row) => firstFilled(
  row?.status,
  row?.situacao,
  row?.status_handmais,
  row?.final_status,
  '-'
)

const getHandMaisUpdatedAtRaw = (row) => firstFilled(
  row?.updated_at,
  row?.updatedAt,
  row?.data_hora_registro,
  row?.data_hora,
  row?.timestamp,
  row?.created_at,
  row?.createdAt,
  ''
)

const getHandMaisValorMargem = (row) => firstFilled(
  row?.valor_margem,
  row?.valorMargem,
  row?.valor_margem_disponivel,
  row?.valorMargemDisponivel,
  row?.valor,
  ''
)

const getHandMaisDescricao = (row) => formatApiMessageText(
  firstFilled(row?.descricao, row?.descricao_handmais, row?.mensagem, row?.message, ''),
  ''
)

const HANDMAIS_DETAIL_FIELD_LABELS = {
  id: 'ID',
  tipoConsulta: 'Tipo Consulta',
  telefone: 'Telefone',
  dataNascimento: 'Nascimento',
  nome_tabela: 'Nome Tabela',
  id_tabela: 'ID Tabela',
  token_tabela: 'Token Tabela',
  created_at: 'Criado em',
  updated_at: 'Atualizado em',
  createdAt: 'Criado em',
  updatedAt: 'Atualizado em',
}

const pickByKeys = (source, keys, fallback = '') => {
  if (!source || typeof source !== 'object') return fallback
  for (const key of keys) {
    const value = source[key]
    if (hasValue(value)) return value
  }
  return fallback
}

const isFluxoCompletoOkMessage = (message) => {
  const token = String(message ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return token === 'fluxo completo ok'
}

const mapPresencaTabelaFromFlat = (row) => {
  const src = row || {}
  const nome = firstFilled(src?.nomeTipo, src?.nome_tipo, src?.nome, src?.tipo_nome)
  const prazo = firstFilled(src?.prazo, src?.prazo_meses)
  const valorLiberado = firstFilled(src?.valorLiberado, src?.valor_liberado, src?.valor)
  const valorParcela = firstFilled(src?.valorParcela, src?.valor_parcela)
  const taxaJuros = firstFilled(src?.taxaJuros, src?.taxa_juros)
  const taxaSeguro = firstFilled(src?.taxaSeguro, src?.taxa_seguro)
  const valorSeguro = firstFilled(src?.valorSeguro, src?.valor_seguro)
  const id = firstFilled(src?.idTipo, src?.id_tipo, src?.id)
  const tipoCreditoNome = firstFilled(src?.tipoCredito?.name, src?.tipoCreditoNome, src?.tipo_credito_nome, src?.tipo_credito, 'Novo')

  if (!nome && !prazo && !valorLiberado && !valorParcela && !taxaJuros && !taxaSeguro && !valorSeguro) return null
  return {
    id,
    nome,
    prazo,
    taxaJuros,
    valorLiberado,
    valorParcela,
    tipoCredito: { name: hasValue(tipoCreditoNome) ? String(tipoCreditoNome) : 'Novo' },
    taxaSeguro,
    valorSeguro
  }
}

const getPresencaUpdatedAtRaw = (row) => firstFilled(
  row?.updated_at,
  row?.updatedAt,
  row?.data_hora_registro,
  row?.dataHoraRegistro,
  row?.created_at,
  row?.createdAt,
  row?.data_consulta,
  row?.dataConsulta,
)

const getPresencaFallbackNome = (row) => firstFilled(
  row?.nome,
  row?.NOME,
  row?.cliente_nome,
  row?.nomeCliente,
  row?.nome_segurado,
  row?.Entrantes,
  row?.entrantes,
)

const getPresencaFallbackCpfDigits = (row) => digitsOnly(firstFilled(
  row?.cpf,
  row?.CPF,
  row?.cliente_cpf,
  row?.CPF_LIMPO,
  row?.nu_cpf_tratado,
  row?.nu_cpf,
  row?.numero_documento,
))

const getPresencaElegivel = (row) => parseNullableBoolean(firstFilled(
  row?.elegivel,
  row?.isElegivel,
  row?.is_elegivel,
  row?.eligivel,
  row?.vinculo?.elegivel,
  row?.result?.vinculo?.elegivel,
  row?.result?.original?.elegivel,
))

const getPresencaIdentityToken = (row) => {
  const nomeToken = normalizeNameToken(getPresencaFallbackNome(row))
  if (hasValue(nomeToken)) return `nome:${nomeToken}`
  const cpfDigits = getPresencaFallbackCpfDigits(row)
  if (hasValue(cpfDigits)) return `cpf:${cpfDigits}`
  return ''
}

const isPresencaRow = (row) => {
  const sourceToken = normalizeSourceToken(firstFilled(
    row?.Tabela,
    row?.tabela,
    row?.origem,
    row?.fonte,
    row?.source
  ))
  if (sourceToken.includes('presenca')) return true
  return (
    hasValue(row?.nomeTipo)
    || hasValue(row?.nome_tipo)
    || hasValue(row?.valorLiberado)
    || hasValue(row?.valor_liberado)
    || hasValue(row?.valorMargemBase)
    || hasValue(row?.valor_margem_base)
    || hasValue(row?.valorMargemDisponivel)
    || hasValue(row?.valor_margem_disponivel)
    || hasValue(row?.valorTotalDevido)
    || hasValue(row?.valor_total_devido)
  )
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
  if (sourceToken.includes('prata')) return 'prata'
  if (isPresencaRow(row)) return 'presenca'
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

const buildConsultaUrl = (path, cpf) => {
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('cpf', cpf)
  return url.toString()
}

const extractApiRows = (payload) => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (payload.success === false) return []
  if (Array.isArray(payload.data)) return payload.data
  return []
}

const fetchConsultaRows = async ({ path, cpf, sourceTag, sourceLabel }) => {
  const response = await fetch(buildConsultaUrl(path, cpf), { method: 'GET' })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const apiMessage = payload?.message || payload?.error || `Falha ao consultar ${sourceLabel}.`
    const error = new Error(apiMessage)
    error.status = response.status
    throw error
  }
  const rows = extractApiRows(payload)
  if (!rows.length) return []
  const normalized = normalizeRows(rows)
  return normalized.map((row) => ({
    ...(row && typeof row === 'object' ? row : { value: row }),
    Tabela: sourceTag,
    source: sourceTag,
  }))
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

const isClienteRow = (row) => (
  hasValue(row?.NOME)
  || hasValue(row?.nome)
  || hasValue(row?.cliente_nome)
  || hasValue(row?.cpf)
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
const getRowCpfDigits = (row) => digitsOnly(firstFilled(row?.cpf, row?.CPF_LIMPO, row?.CPF, row?.nu_cpf_tratado, row?.nu_cpf, row?.numero_documento, row?.cliente_cpf))
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
  width: 22,
  height: 22,
  color: '#f1f5f9',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  opacity: 0.95,
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
        <span style={bubbleIconStyle}><IconComp size={19} /></span>
        <div className="fw-semibold text-uppercase" style={{ fontSize: '0.86rem' }}>{title}</div>
      </div>
      {right}
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
  const fallbackChipBg = 'var(--primary-soft, rgba(37, 99, 235, 0.16))'
  const fallbackChipColor = 'var(--text, #0f172a)'
  const fallbackChipBorder = '1px solid var(--border-strong, rgba(37, 99, 235, 0.38))'

  return (
    <div className="d-flex align-items-center gap-2">
      {shortCode ? (
        <span
          style={{
            minWidth: 20,
            height: 16,
            borderRadius: 4,
            padding: '0 4px',
            background: bankMeta?.bg || fallbackChipBg,
            color: bankMeta?.color || fallbackChipColor,
            border: bankMeta ? '1px solid rgba(255,255,255,0.18)' : fallbackChipBorder,
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
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: fallbackChipBg,
            border: fallbackChipBorder,
            color: 'var(--primary, #2563eb)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <FiCreditCard size={10} />
        </span>
      )}
      <span>{bankName}</span>
    </div>
  )
}

export default function ConsultaClientes() {
  const location = useLocation()
  const navigate = useNavigate()

  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [selectedBenefitKey, setSelectedBenefitKey] = useState('')
  const [bankNameByCode] = useState(() => ({ ...LOCAL_BANK_NAME_BY_CODE }))
  const [rawPayload, setRawPayload] = useState(null)
  const [isEnderecosOpen, setIsEnderecosOpen] = useState(false)
  const [isBancosOpen, setIsBancosOpen] = useState(true)
  const [isContratosOpen, setIsContratosOpen] = useState(true)
  const [showRoundedTaxaHint, setShowRoundedTaxaHint] = useState(false)
  const [contratoFonte, setContratoFonte] = useState(getInitialContratoFonte)
  const [in100DetailItem, setIn100DetailItem] = useState(null)
  const [v8DetailItem, setV8DetailItem] = useState(null)
  const [handMaisDetailItem, setHandMaisDetailItem] = useState(null)
  const [presencaDetailItem, setPresencaDetailItem] = useState(null)
  const lastUrlCpfRef = useRef('')
  const disponibilidadeToastKeyRef = useRef('')
  const hideSearchByInitialUrlRef = useRef(
    Boolean(normalizeCpfForConsulta(parseCpfFromUrl(location.pathname, location.search)))
  )

  const visibleRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows])
  const hasCpfInUrl = hideSearchByInitialUrlRef.current

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

      const phonesSourceRows = globalRows.filter((row) => !isPresencaRow(row))
      const phones = [
        ...phonesSourceRows.flatMap((row) => [
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
        prata: [],
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
        const dataUpdateRaw = firstFilled(row?.data_update, row?.updated_at, row?.updatedAt, row?.data_hora_registro, row?.created_at)
        const dataUpdateTs = parseDateAny(dataUpdateRaw)?.getTime?.() || 0
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
          dataUpdateRaw,
          dataUpdateTs,
          dataUpdate: hasValue(dataUpdateRaw)
            ? (parseDateAny(dataUpdateRaw) ? formatDate(dataUpdateRaw) : String(dataUpdateRaw))
            : '-',
        }
      }

      const mapContratoPresenca = (row, index) => {
        const nomeTipo = firstFilled(row?.nomeTipo, row?.nome_tipo, row?.tipo_nome, row?.tipo)
        const status = firstFilled(row?.status, row?.Status, row?.situacao)
        const prazo = firstFilled(row?.prazo, row?.prazo_dias, row?.prazoDias)
        const valorLiberado = firstFilled(row?.valorLiberado, row?.valor_liberado, row?.valor)
        const valorMargemBase = firstFilled(row?.valorMargemBase, row?.valor_margem_base, row?.margemBase)
        const valorMargemDisponivel = firstFilled(row?.valorMargemDisponivel, row?.valor_margem_disponivel, row?.margemDisponivel)
        const valorParcela = firstFilled(row?.valorParcela, row?.valor_parcela)
        const valorTotalDevido = firstFilled(row?.valorTotalDevido, row?.valor_total_devido)
        const fallbackNome = getPresencaFallbackNome(row)
        const fallbackCpfDigits = getPresencaFallbackCpfDigits(row)
        const updatedAtRaw = getPresencaUpdatedAtRaw(row)
        const updatedAtTs = parseDateAny(updatedAtRaw)?.getTime?.() || 0
        const elegivel = getPresencaElegivel(row)
        return {
          key: `presenca-${index}-${updatedAtTs}-${getPresencaIdentityToken(row) || 'item'}`,
          nomeTipo: hasValue(nomeTipo) ? String(nomeTipo).trim() : '-',
          status: hasValue(status) ? String(status).trim() : '-',
          prazo: hasValue(prazo) ? String(prazo).trim() : '-',
          valorLiberado,
          valorMargemBase,
          valorMargemDisponivel,
          valorParcela,
          valorTotalDevido,
          valorLiberadoNum: parseNumber(valorLiberado),
          updatedAtRaw,
          updatedAtTs,
          fallbackNome: fallbackNome || '-',
          fallbackCpfDigits,
          fallbackCpf: fallbackCpfDigits ? formatCpf(fallbackCpfDigits) : '-',
          elegivel,
          identityToken: getPresencaIdentityToken(row),
          rowRaw: row,
        }
      }

      const buildPresencaContratos = (rows) => {
        const presencaRows = rows.filter((row) => (
          hasValue(firstFilled(row?.nomeTipo, row?.nome_tipo))
          || hasValue(firstFilled(row?.status, row?.Status, row?.situacao))
          || hasValue(firstFilled(row?.valorLiberado, row?.valor_liberado, row?.valor))
          || hasValue(firstFilled(row?.valorMargemBase, row?.valor_margem_base))
          || hasValue(firstFilled(row?.valorMargemDisponivel, row?.valor_margem_disponivel))
          || hasValue(firstFilled(row?.valorParcela, row?.valor_parcela))
          || hasValue(firstFilled(row?.valorTotalDevido, row?.valor_total_devido))
        ))

        const mostRecentFirst = [...presencaRows].sort((a, b) => {
          const aTs = parseDateAny(getPresencaUpdatedAtRaw(a))?.getTime?.() || 0
          const bTs = parseDateAny(getPresencaUpdatedAtRaw(b))?.getTime?.() || 0
          return bTs - aTs
        })

        const uniqueByKey = new Map()
        mostRecentFirst.forEach((row, index) => {
          const mapped = mapContratoPresenca(row, index)
          const distinctKey = [
            mapped.identityToken || '-',
            mapped.nomeTipo,
            mapped.prazo,
            String(mapped.valorLiberado ?? ''),
            String(mapped.valorMargemBase ?? ''),
            String(mapped.valorMargemDisponivel ?? ''),
            String(mapped.valorParcela ?? ''),
            String(mapped.valorTotalDevido ?? ''),
            mapped.elegivel === null ? 'null' : (mapped.elegivel ? '1' : '0'),
          ].join('|')
          if (!uniqueByKey.has(distinctKey)) uniqueByKey.set(distinctKey, mapped)
        })

        return Array.from(uniqueByKey.values()).sort((a, b) => {
          const aValor = a.valorLiberadoNum
          const bValor = b.valorLiberadoNum
          if (aValor !== null && bValor !== null && bValor !== aValor) return bValor - aValor
          if (aValor === null && bValor !== null) return 1
          if (aValor !== null && bValor === null) return -1
          return b.updatedAtTs - a.updatedAtTs
        })
      }

      const mapContratoHandMais = (row, index) => {
        const nomeRaw = firstFilled(row?.nome, row?.NOME, row?.cliente_nome, row?.nomeCliente)
        const cpfRawDigits = digitsOnly(firstFilled(row?.cpf, row?.CPF, row?.cliente_cpf, row?.numero_documento))
        const statusRaw = getHandMaisStatus(row)
        const valorMargemRaw = getHandMaisValorMargem(row)
        const updatedAtRaw = getHandMaisUpdatedAtRaw(row)
        const descricao = getHandMaisDescricao(row)
        const updatedAtTs = parseDateAny(updatedAtRaw)?.getTime?.() || 0
        return {
          key: `handmais-${index}-${cpfRawDigits || row?.id || row?.id_tabela || 'item'}`,
          nome: hasValue(nomeRaw) ? String(nomeRaw).trim() : '-',
          cpfRaw: cpfRawDigits,
          cpf: cpfRawDigits ? formatCpf(cpfRawDigits) : '-',
          statusRaw: hasValue(statusRaw) ? String(statusRaw).trim() : '-',
          status: hasValue(statusRaw) ? toTitleCase(String(statusRaw)) : '-',
          valorMargemRaw,
          valorMargem: hasValue(valorMargemRaw) ? formatMoney(valorMargemRaw) : '-',
          valorMargemNum: parseNumber(valorMargemRaw),
          updatedAtRaw,
          updatedAt: hasValue(updatedAtRaw)
            ? (parseDateAny(updatedAtRaw) ? formatDateTime(updatedAtRaw) : String(updatedAtRaw))
            : '-',
          updatedAtTs,
          descricao,
          hasDescricao: hasValue(descricao),
          rowRaw: row,
        }
      }

      const buildHandMaisContratos = (rows) => {
        const handRows = rows.filter((row) => (
          hasValue(firstFilled(row?.nome, row?.NOME, row?.cliente_nome))
          || hasValue(firstFilled(row?.cpf, row?.CPF, row?.cliente_cpf))
          || hasValue(getHandMaisStatus(row))
          || hasValue(getHandMaisValorMargem(row))
          || hasValue(getHandMaisUpdatedAtRaw(row))
          || hasValue(getHandMaisDescricao(row))
        ))

        const mapped = handRows.map((row, index) => mapContratoHandMais(row, index))
        const unique = new Map()
        mapped.forEach((item) => {
          const distinctKey = [
            item.cpfRaw || normalizeNameToken(item.nome),
            item.statusRaw,
            String(item.valorMargemRaw ?? ''),
            item.updatedAtRaw,
            item.descricao,
          ].join('|')
          if (!unique.has(distinctKey)) unique.set(distinctKey, item)
        })

        return Array.from(unique.values()).sort((a, b) => {
          const aValor = a.valorMargemNum
          const bValor = b.valorMargemNum
          if (aValor !== null && bValor !== null && bValor !== aValor) return bValor - aValor
          if (aValor === null && bValor !== null) return 1
          if (aValor !== null && bValor === null) return -1

          if (b.updatedAtTs !== a.updatedAtTs) return b.updatedAtTs - a.updatedAtTs
          return 0
        })
      }

      const contratosByFonte = {
        portabilidade: rowsByFonte.portabilidade
          .filter((row) => hasValue(row?.id_contrato_empres) || hasValue(row?.vl_empres) || hasValue(row?.nb))
          .map(mapContratoPadrao)
          .sort((a, b) => b.dataUpdateTs - a.dataUpdateTs),
        in100: sortByDataHoraRegistroDesc(
          (() => {
            const baseRows = rowsByFonte.in100.filter((row) => (
              hasValue(row?.numero_documento) || hasValue(row?.numero_beneficio) || hasValue(row?.status_api)
            ))
            const seen = new Set()
            return baseRows.filter((row) => {
              const cpfKey = digitsOnly(firstFilled(row?.numero_documento, row?.cpf, row?.CPF, ''))
              const nbKey = digitsOnly(firstFilled(row?.numero_beneficio, row?.Beneficio, row?.nb, ''))
              const tsKey = firstFilled(row?.data_hora_registro, row?.data_consulta, row?.data_retorno_consulta, '')
              const statusKey = firstFilled(row?.status_api, row?.status, '')
              const key = [cpfKey, nbKey, tsKey, statusKey].join('|')
              if (!key || seen.has(key)) return false
              seen.add(key)
              return true
            })
          })()
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
        presenca: buildPresencaContratos(rowsByFonte.presenca),
        handmais: buildHandMaisContratos(rowsByFonte.handmais),
        prata: rowsByFonte.prata.map((row, index) => ({
          key: `prata-${index}-${digitsOnly(firstFilled(row?.cpf, row?.CPF, row?.numero_documento)) || row?.id || 'item'}`,
          cpfRaw: digitsOnly(firstFilled(row?.cpf, row?.CPF, row?.numero_documento)),
          cpf: formatCpf(firstFilled(row?.cpf, row?.CPF, row?.numero_documento)),
          nome: firstFilled(row?.nome, row?.NOME, '-'),
          status: firstFilled(row?.status_consulta, row?.status, '-'),
          margemDisponivel: formatMoney(firstFilled(row?.margem_disponivel, row?.margem_total_disponivel)),
          createdAt: formatDateTime(firstFilled(row?.created_at, row?.createdAt, row?.updated_at)),
          rowRaw: row,
        })),
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
    prata: profile?.contratosByFonte?.prata?.length ?? 0,
  }), [profile?.contratosByFonte])
  const modalidadesDisponiveis = useMemo(
    () => CONTRATO_FONTES
      .map((fonte) => ({ ...fonte, quantidade: Number(contratoQuantidadeByFonte[fonte.value] ?? 0) }))
      .filter((item) => item.quantidade > 0),
    [contratoQuantidadeByFonte]
  )
  const handleSelectContratoFonte = useCallback((nextFonte) => {
    const nextValue = String(nextFonte || '').trim()
    if (!nextValue || nextValue === contratoFonte) return

    const selectedFonte = CONTRATO_FONTES.find((item) => item.value === nextValue)
    if (!selectedFonte) return

    setContratoFonte(nextValue)

    if (nextValue === 'portabilidade') return

    notify.error(
      <div className="d-flex align-items-center gap-2" style={{ lineHeight: 1.25 }}>
        <img
          src={CONTRATO_FONTE_ICON_BY_VALUE[nextValue] || '/neo-logo.svg'}
          alt={selectedFonte.label}
          width="20"
          height="20"
          style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 4, flex: '0 0 auto' }}
          onError={(event) => {
            if (event.currentTarget.src.endsWith('/neo-logo.svg')) return
            event.currentTarget.src = '/neo-logo.svg'
          }}
        />
        <span>Alguns dados mudaram. Para voltar ao padrão, clique em Portabilidade.</span>
      </div>,
      {
        autoClose: 15000,
        icon: false,
      }
    )
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
      const offlineSource = { key: 'offline', path: '/consultas/offline', sourceTag: 'macica', sourceLabel: 'Maciça' }
      const followUpSources = [
        { key: 'in100', path: '/consultas/in100', sourceTag: 'qualibanking_in100', sourceLabel: 'IN100' },
        { key: 'v8', path: '/consultas/v8', sourceTag: 'v8', sourceLabel: 'V8' },
        { key: 'presenca', path: '/consultas/presenca', sourceTag: 'presenca', sourceLabel: 'Presença' },
        { key: 'handmais', path: '/consultas/handmais', sourceTag: 'handmais', sourceLabel: 'Hand+' },
        { key: 'prata', path: '/consultas/prata', sourceTag: 'prata', sourceLabel: 'Prata' },
      ]

      const mergedRows = []
      const rawByFonte = {}
      const errors = []

      try {
        const offlineRows = await fetchConsultaRows({ ...offlineSource, cpf: cpfDigits })
        rawByFonte[offlineSource.key] = offlineRows
        mergedRows.push(...offlineRows)
      } catch (err) {
        errors.push(`${offlineSource.sourceLabel}: ${err?.message || 'Erro ao consultar.'}`)
      }

      setSelectedBenefitKey('')
      setRows([...mergedRows])
      setRawPayload({ cpf: cpfDigits, sources: { ...rawByFonte }, errors: [...errors] })
      if (syncUrl) navigate(`/consultas/clientes?cpf=${cpfDigits}`, { replace: true })

      for (const source of followUpSources) {
        try {
          const rows = await fetchConsultaRows({ ...source, cpf: cpfDigits })
          rawByFonte[source.key] = rows
          if (rows.length > 0) {
            mergedRows.push(...rows)
            setRows([...mergedRows])
          }
        } catch (err) {
          errors.push(`${source.sourceLabel}: ${err?.message || 'Erro ao consultar.'}`)
        } finally {
          setRawPayload({ cpf: cpfDigits, sources: { ...rawByFonte }, errors: [...errors] })
        }
      }

      if (mergedRows.length === 0) notify.info('Nenhum dado encontrado para este CPF.')
      if (errors.length > 0) notify.error(errors.join(' | '))
    } catch (e) {
      setRows([])
      setRawPayload(null)
      setError(e?.message || 'Falha ao consultar cliente.')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    const urlCpf = normalizeCpfForConsulta(parseCpfFromUrl(location.pathname, location.search))
    if (!urlCpf) return

    const requestKey = `${urlCpf}`
    if (lastUrlCpfRef.current === requestKey) return

    lastUrlCpfRef.current = requestKey
    setCpf(formatCpf(urlCpf))
    executeConsulta(urlCpf, { syncUrl: false })
  }, [location.pathname, location.search, executeConsulta])

  const handleSubmit = useCallback((event) => {
    event.preventDefault()
    executeConsulta(cpf, { syncUrl: false })
  }, [cpf, executeConsulta])

  const currentProfile = profileView || profile
  const profileCpfRawDisplay = useMemo(() => {
    const fromCurrentProfile = digitsOnly(firstFilled(currentProfile?.cpfRaw, currentProfile?.cpf))
    if (hasValue(fromCurrentProfile)) return fromCurrentProfile

    const presencaRows = Array.isArray(profile?.contratosByFonte?.presenca) ? profile.contratosByFonte.presenca : []
    for (const item of presencaRows) {
      const rowRaw = item?.rowRaw && typeof item.rowRaw === 'object' ? item.rowRaw : {}
      const fallbackDigits = digitsOnly(firstFilled(
        item?.fallbackCpfDigits,
        item?.fallbackCpf,
        rowRaw?.cpf,
        rowRaw?.CPF,
        rowRaw?.cliente_cpf,
        rowRaw?.numero_documento,
      ))
      if (hasValue(fallbackDigits)) return fallbackDigits
    }
    return ''
  }, [currentProfile?.cpfRaw, currentProfile?.cpf, profile?.contratosByFonte?.presenca])
  const profileCpfDisplay = profileCpfRawDisplay ? formatCpf(profileCpfRawDisplay) : '-'
  const profileUpdatedAtDisplay = useMemo(() => {
    let latestRaw = ''
    let latestTs = -Infinity

    visibleRows.forEach((row) => {
      if (!row || typeof row !== 'object') return
      const raw = getRowUpdatedAtCandidate(row)
      if (!hasValue(raw)) return

      const ts = parseDateAny(raw)?.getTime?.()
      if (Number.isFinite(ts)) {
        if (ts > latestTs) {
          latestTs = ts
          latestRaw = raw
        }
      } else if (!latestRaw) {
        latestRaw = raw
      }
    })

    if (!hasDisplayValue(latestRaw)) return ''
    const parsed = parseDateAny(latestRaw)
    const formatted = parsed ? formatDateTime(latestRaw) : String(latestRaw).trim()
    return hasDisplayValue(formatted) ? formatted : ''
  }, [visibleRows])
  const profileNascimentoDisplay = hasValue(currentProfile?.nascimento) ? currentProfile.nascimento : '-'
  const profileIdadeDisplay = hasValue(currentProfile?.idade) ? currentProfile.idade : '-'
  const profileUfDisplay = hasValue(currentProfile?.uf) ? currentProfile.uf : '-'
  const profileBeneficioDisplay = hasValue(currentProfile?.nb) ? currentProfile.nb : '-'
  const profileBeneficioCopyValue = hasValue(currentProfile?.nb) ? digitsOnly(currentProfile.nb) : ''
  const isIn100Selected = contratoFonte === 'in100'
  const summaryCards = isIn100Selected
    ? [
      { label: 'Saldo Cartão Benefício', value: currentProfile?.saldoCartaoBeneficio ?? '-', footer: '' },
      { label: 'Saldo Cartão Consignado', value: currentProfile?.saldoCartaoConsignado ?? '-', footer: '' },
      { label: 'Margem disponível', value: currentProfile?.margemDisponivelIn100 ?? '-', footer: '' },
    ]
    : [
      { label: 'Margem RMC', value: currentProfile?.margemRmc ?? '-', footer: '' },
      { label: 'Margem RCC', value: currentProfile?.margemRcc ?? '-', footer: '' },
      { label: 'Total Cartão', value: currentProfile?.totalCartao ?? '-', footer: '' },
      { label: 'Margem Livre', value: currentProfile?.margemLivre ?? '-', footer: '' },
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
  const handMaisModalData = useMemo(() => {
    if (!handMaisDetailItem) return null

    const rowRaw = handMaisDetailItem?.rowRaw && typeof handMaisDetailItem.rowRaw === 'object'
      ? handMaisDetailItem.rowRaw
      : {}
    const cpfRaw = firstFilled(
      handMaisDetailItem.cpfRaw,
      digitsOnly(firstFilled(rowRaw?.cpf, rowRaw?.CPF, rowRaw?.cliente_cpf, rowRaw?.numero_documento))
    )
    const nome = firstFilled(handMaisDetailItem.nome, rowRaw?.nome, rowRaw?.cliente_nome, '-')
    const statusRaw = firstFilled(handMaisDetailItem.statusRaw, getHandMaisStatus(rowRaw), '-')
    const valorMargemRaw = firstFilled(handMaisDetailItem.valorMargemRaw, getHandMaisValorMargem(rowRaw), '')
    const updatedAtRaw = firstFilled(handMaisDetailItem.updatedAtRaw, getHandMaisUpdatedAtRaw(rowRaw), '')
    const descricao = firstFilled(handMaisDetailItem.descricao, getHandMaisDescricao(rowRaw), '')

    const formatHandMaisDetailValue = (key, value) => {
      if (!hasValue(value)) return '-'
      if (key === 'cpf') return formatCpf(value)
      if (key === 'valor_margem' || key === 'valorMargem') return formatMoney(value)
      if (key === 'dataNascimento') return formatDate(value)
      if (key === 'created_at' || key === 'createdAt' || key === 'updated_at' || key === 'updatedAt') return formatDateTime(value)
      return String(value)
    }

    const vinculoKeys = ['tipoConsulta', 'telefone', 'dataNascimento', 'nome_tabela', 'id_tabela', 'token_tabela']
    const vinculoEntries = vinculoKeys.map((key) => ({
      key,
      label: HANDMAIS_DETAIL_FIELD_LABELS[key] || key,
      value: formatHandMaisDetailValue(key, rowRaw?.[key]),
    }))

    const adicionaisEntries = [
      { key: 'id', label: HANDMAIS_DETAIL_FIELD_LABELS.id, value: formatHandMaisDetailValue('id', rowRaw?.id) },
      { key: 'created_at', label: HANDMAIS_DETAIL_FIELD_LABELS.created_at, value: formatHandMaisDetailValue('created_at', firstFilled(rowRaw?.created_at, rowRaw?.createdAt)) },
      { key: 'updated_at', label: HANDMAIS_DETAIL_FIELD_LABELS.updated_at, value: formatHandMaisDetailValue('updated_at', firstFilled(rowRaw?.updated_at, rowRaw?.updatedAt)) },
    ]

    return {
      cpfRaw,
      cpf: cpfRaw ? formatCpf(cpfRaw) : '-',
      nome: hasValue(nome) ? String(nome) : '-',
      statusRaw: hasValue(statusRaw) ? String(statusRaw) : '-',
      status: hasValue(statusRaw) ? String(statusRaw) : '-',
      valorMargem: hasValue(valorMargemRaw) ? formatMoney(valorMargemRaw) : '-',
      updatedAt: hasValue(updatedAtRaw) ? (parseDateAny(updatedAtRaw) ? formatDateTime(updatedAtRaw) : String(updatedAtRaw)) : '-',
      vinculoEntries,
      adicionaisEntries,
      descricao: hasValue(descricao) ? String(descricao) : 'Sem descrição para esta consulta.',
    }
  }, [handMaisDetailItem])
  const presencaModalData = useMemo(() => {
    if (!presencaDetailItem) return null

    const payload = presencaDetailItem?.rowRaw && typeof presencaDetailItem.rowRaw === 'object'
      ? presencaDetailItem.rowRaw
      : {}
    const resultData = payload?.result && typeof payload.result === 'object' ? payload.result : payload
    const fallbackOriginal = resultData?.original && typeof resultData.original === 'object' ? resultData.original : {}
    const vinculoPayload = resultData?.vinculo && typeof resultData.vinculo === 'object'
      ? resultData.vinculo
      : (payload?.vinculo && typeof payload.vinculo === 'object' ? payload.vinculo : {})
    const margemPayload = resultData?.margem_data && typeof resultData.margem_data === 'object'
      ? resultData.margem_data
      : (payload?.margem_data && typeof payload.margem_data === 'object' ? payload.margem_data : {})

    const cpfDigits = digitsOnly(firstFilled(
      pickByKeys(resultData, ['cpf', 'cliente_cpf', 'numero_documento', 'documento']),
      pickByKeys(fallbackOriginal, ['cpf', 'cliente_cpf', 'numero_documento', 'documento']),
      pickByKeys(payload, ['cpf', 'cliente_cpf', 'numero_documento', 'documento']),
      presencaDetailItem.fallbackCpfDigits,
    ))
    const nome = firstFilled(
      pickByKeys(resultData, ['nome', 'name', 'cliente_nome', 'nome_cliente', 'nomeCliente']),
      pickByKeys(fallbackOriginal, ['nome', 'name', 'cliente_nome', 'nome_cliente', 'nomeCliente']),
      pickByKeys(payload, ['nome', 'name', 'cliente_nome', 'nome_cliente', 'nomeCliente']),
      presencaDetailItem.fallbackNome,
      '-'
    )
    const updatedAtRaw = firstFilled(
      presencaDetailItem.updatedAtRaw,
      pickByKeys(resultData, ['updated_at', 'updatedAt', 'created_at', 'createdAt', 'data_hora_registro', 'data']),
      pickByKeys(payload, ['updated_at', 'updatedAt', 'created_at', 'createdAt', 'data_hora_registro', 'data']),
    )
    const mensagem = firstFilled(
      pickByKeys(resultData, ['Mensagem', 'mensagem', 'final_message', 'finalMessage', 'msg']),
      pickByKeys(payload, ['Mensagem', 'mensagem', 'final_message', 'finalMessage', 'error', 'message']),
      ''
    )
    const errorMessage = hasValue(mensagem) && !isFluxoCompletoOkMessage(mensagem) ? String(mensagem) : ''
    const elegivel = parseNullableBoolean(firstFilled(
      vinculoPayload?.elegivel,
      pickByKeys(resultData, ['elegivel', 'isElegivel', 'is_elegivel', 'eligivel']),
      pickByKeys(fallbackOriginal, ['elegivel', 'isElegivel', 'is_elegivel', 'eligivel']),
      pickByKeys(payload, ['elegivel', 'isElegivel', 'is_elegivel', 'eligivel']),
      presencaDetailItem.elegivel === null ? '' : String(presencaDetailItem.elegivel),
    ))

    const rawTabelas = Array.isArray(resultData?.tabelas_body)
      ? resultData.tabelas_body
      : (Array.isArray(payload?.tabelas_body)
        ? payload.tabelas_body
        : (Array.isArray(resultData?.tabelasBody)
          ? resultData.tabelasBody
          : (Array.isArray(payload?.tabelasBody) ? payload.tabelasBody : [])))

    let tabelasBody = rawTabelas
      .map((item) => mapPresencaTabelaFromFlat(item))
      .filter(Boolean)

    if (tabelasBody.length === 0) {
      const identityToken = presencaDetailItem.identityToken || getPresencaIdentityToken(payload)
      const relatedRows = visibleRows.filter((row) => (
        row
        && typeof row === 'object'
        && isPresencaRow(row)
        && getPresencaIdentityToken(row) === identityToken
      ))
      tabelasBody = relatedRows
        .map((item) => mapPresencaTabelaFromFlat(item))
        .filter(Boolean)
    }
    if (tabelasBody.length === 0) {
      const fallbackTabela = mapPresencaTabelaFromFlat(payload)
      if (fallbackTabela) tabelasBody = [fallbackTabela]
    }

    const uniqueTabelas = new Map()
    tabelasBody.forEach((item) => {
      const uniqueKey = `${item?.id ?? '-'}|${item?.nome ?? '-'}|${item?.prazo ?? '-'}|${item?.valorLiberado ?? '-'}`
      if (!uniqueTabelas.has(uniqueKey)) uniqueTabelas.set(uniqueKey, item)
    })

    return {
      cpfDigits,
      cpf: cpfDigits ? formatCpf(cpfDigits) : '-',
      nome,
      updatedAt: hasValue(updatedAtRaw) ? formatDateTime(updatedAtRaw) : '-',
      vinculo: {
        matricula: firstFilled(vinculoPayload?.matricula, pickByKeys(resultData, ['matricula']), pickByKeys(payload, ['matricula']), '-'),
        numeroInscricaoEmpregador: firstFilled(
          vinculoPayload?.numeroInscricaoEmpregador,
          pickByKeys(resultData, ['numeroInscricaoEmpregador', 'cnpjEmpregador']),
          pickByKeys(payload, ['numeroInscricaoEmpregador', 'cnpjEmpregador']),
          '-'
        ),
        elegivel,
      },
      margemData: {
        valorMargemDisponivel: firstFilled(
          margemPayload?.valorMargemDisponivel,
          presencaDetailItem.valorMargemDisponivel,
          pickByKeys(resultData, ['valorMargemDisponivel', 'valor_margem_disponivel']),
          pickByKeys(payload, ['valorMargemDisponivel', 'valor_margem_disponivel']),
        ),
        valorMargemBase: firstFilled(
          margemPayload?.valorMargemBase,
          presencaDetailItem.valorMargemBase,
          pickByKeys(resultData, ['valorMargemBase', 'valor_margem_base']),
          pickByKeys(payload, ['valorMargemBase', 'valor_margem_base']),
        ),
        valorTotalDevido: firstFilled(
          margemPayload?.valorTotalDevido,
          presencaDetailItem.valorTotalDevido,
          pickByKeys(resultData, ['valorTotalDevido', 'valor_total_devido']),
          pickByKeys(payload, ['valorTotalDevido', 'valor_total_devido']),
        ),
        registroEmpregaticio: firstFilled(
          margemPayload?.registroEmpregaticio,
          pickByKeys(resultData, ['registroEmpregaticio', 'registro_empregaticio', 'matricula']),
          pickByKeys(payload, ['registroEmpregaticio', 'registro_empregaticio', 'matricula']),
          '-'
        ),
        cnpjEmpregador: firstFilled(
          margemPayload?.cnpjEmpregador,
          pickByKeys(resultData, ['cnpjEmpregador', 'numeroInscricaoEmpregador']),
          pickByKeys(payload, ['cnpjEmpregador', 'numeroInscricaoEmpregador']),
          '-'
        ),
        dataAdmissao: firstFilled(
          margemPayload?.dataAdmissao,
          pickByKeys(resultData, ['dataAdmissao', 'data_admissao']),
          pickByKeys(payload, ['dataAdmissao', 'data_admissao']),
          ''
        ),
        sexo: firstFilled(
          margemPayload?.sexo,
          pickByKeys(resultData, ['sexo']),
          pickByKeys(payload, ['sexo']),
          '-'
        ),
        nomeMae: firstFilled(
          margemPayload?.nomeMae,
          pickByKeys(resultData, ['nomeMae', 'nome_mae']),
          pickByKeys(payload, ['nomeMae', 'nome_mae']),
          '-'
        ),
      },
      tabelasBody: Array.from(uniqueTabelas.values()),
      finalMessage: hasValue(mensagem) ? String(mensagem) : '',
      errorMessage,
    }
  }, [presencaDetailItem, visibleRows])
  const sortedPresencaTabelas = useMemo(() => {
    if (!presencaModalData) return []
    const list = Array.isArray(presencaModalData.tabelasBody) ? [...presencaModalData.tabelasBody] : []
    return list.sort((a, b) => {
      const aValor = parseNumber(a?.valorLiberado)
      const bValor = parseNumber(b?.valorLiberado)
      if (aValor !== null && bValor !== null && bValor !== aValor) return bValor - aValor
      if (aValor === null && bValor !== null) return 1
      if (aValor !== null && bValor === null) return -1
      const aPrazo = parseNumber(a?.prazo)
      const bPrazo = parseNumber(b?.prazo)
      if (aPrazo !== null && bPrazo !== null && aPrazo !== bPrazo) return aPrazo - bPrazo
      return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR')
    })
  }, [presencaModalData])
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
              <h2 className="fw-bold mb-1">Consulta Offiline</h2>
              <div className="small opacity-75">
                Página para consultar clientes em todos os canais, bancos de dados, IN100 e bancos via API.
                Consulta offline com dados simulados para teste.
              </div>
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
              </div>
            </form>
            {error && <div className="small text-danger mt-2">{error}</div>}
          </section>
        )}

        <section className="neo-card p-3 p-md-4 cc-results-wrap" style={panelStyle}>
          <div className="small opacity-75 mb-3">{loading ? 'Consultando...' : `${visibleRows.length} registro(s) encontrado(s)`}</div>
          {error && <div className="small text-danger mb-3">{error}</div>}

          {visibleRows.length === 0 ? (
            <div className="small opacity-75">Informe um CPF para consultar.</div>
          ) : currentProfile ? (
            <div className="d-flex flex-column gap-3">
              <section className="neo-card p-3" style={panelStyle}>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <span style={bubbleIconStyle}><FiUser size={19} /></span>
                    <div className="fw-semibold" style={{ fontSize: '1.85rem', lineHeight: 1 }}>Dados pessoais</div>
                  </div>
                  {hasDisplayValue(profileUpdatedAtDisplay) ? (
                    <div className="small opacity-75">Atualizado: {profileUpdatedAtDisplay}</div>
                  ) : null}
                </div>
                <div className="row g-3 align-items-start">
                  <div className="col-12 col-md-6 col-lg-3">
                    <div style={miniLabelStyle}>Nome</div>
                    <div className="fw-semibold">{hasValue(currentProfile?.nome) ? currentProfile.nome : '-'}</div>
                  </div>
                  <div className="col-12 col-md-6 col-lg-2">
                    <div style={miniLabelStyle}># CPF</div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-semibold">{profileCpfDisplay}</span>
                      <CopyButton value={profileCpfRawDisplay} label="CPF" />
                    </div>
                  </div>
                  <div className="col-6 col-md-4 col-lg-2">
                    <div style={miniLabelStyle} className="d-flex align-items-center gap-1">
                      <FiCalendar size={13} />
                      <span>Data Nascimento</span>
                    </div>
                    <div className="fw-semibold">{profileNascimentoDisplay}</div>
                  </div>
                  <div className="col-6 col-md-2 col-lg-1">
                    <div style={miniLabelStyle} className="d-flex align-items-center gap-1">
                      <FiCalendar size={13} />
                      <span>Idade</span>
                    </div>
                    <div className="fw-semibold">{profileIdadeDisplay}</div>
                  </div>
                  <div className="col-6 col-md-2 col-lg-1">
                    <div style={miniLabelStyle}>UF</div>
                    <div className="fw-semibold">{profileUfDisplay}</div>
                  </div>
                  <div className="col-12 col-md-6 col-lg-3">
                    <div style={miniLabelStyle}>Benefícios (NB)</div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-semibold">{profileBeneficioDisplay}</span>
                      <CopyButton value={profileBeneficioCopyValue} label="NB" />
                    </div>
                    {profile.shouldShowBenefitSelect && (
                      <div className="mt-2">
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
              </section>

              <section className="row g-3">
                {summaryCards.map((item) => (
                  <div key={item.label} className={isIn100Selected ? 'col-12 col-lg-4' : 'col-12 col-md-6 col-xl'}>
                    <div className="neo-card p-3 h-100" style={panelStyle}>
                      <div className="d-flex align-items-center gap-2 mb-2"><span style={bubbleIconStyle}><FiDollarSign size={18} /></span><div className="small opacity-75">{item.label}</div></div>
                      <div className="h3 fw-bold mb-0" style={{ fontSize: '1.45rem', lineHeight: 1.2 }}>{item.value}</div>
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
                                  onClick={() => handleSelectContratoFonte(fonte.value)}
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
                      ) : contratoFonte === 'presenca' ? (
                        <table className="table table-dark table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>CPF</th>
                              <th>Tabela</th>
                              <th>Prazo</th>
                              <th>Valor Liberado</th>
                              <th>Elegível</th>
                              <th style={{ width: 100 }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedContratoRows.length === 0 ? (
                              <EmptyCell colSpan={7} text="Nenhum registro de Presença encontrado." />
                            ) : (
                              selectedContratoRows.map((item) => (
                                <tr key={item.key}>
                                  <td>{item.fallbackNome || '-'}</td>
                                  <td>{item.fallbackCpf || '-'}</td>
                                  <td>{item.nomeTipo || '-'}</td>
                                  <td>{item.prazo || '-'}</td>
                                  <td>{hasValue(item.valorLiberado) ? formatMoney(item.valorLiberado) : '-'}</td>
                                  <td>
                                    {item.elegivel === null ? (
                                      <span className="badge text-bg-secondary">-</span>
                                    ) : (
                                      <span className={`badge ${item.elegivel ? 'text-bg-success' : 'text-bg-danger'}`}>
                                        {item.elegivel ? 'Sim' : 'Não'}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-outline-info btn-sm d-inline-flex align-items-center justify-content-center"
                                      title="Ver detalhes"
                                      aria-label="Ver detalhes"
                                      onClick={() => setPresencaDetailItem(item)}
                                    >
                                      <FiList size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      ) : contratoFonte === 'handmais' ? (
                        <table className="table table-dark table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>CPF</th>
                              <th>Status</th>
                              <th>Valor Margem</th>
                              <th>Última atualização</th>
                              <th style={{ width: 110 }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedContratoRows.length === 0 ? (
                              <EmptyCell colSpan={6} text="Nenhum registro de Hand+ encontrado." />
                            ) : (
                              selectedContratoRows.map((item) => (
                                <tr key={item.key}>
                                  <td>{item.nome || '-'}</td>
                                  <td>{item.cpf || '-'}</td>
                                  <td>
                                    <span className={`badge ${getHandMaisStatusBadgeClass(item.statusRaw || item.status)}`}>
                                      {item.status || '-'}
                                    </span>
                                  </td>
                                  <td>{item.valorMargem || '-'}</td>
                                  <td>{item.updatedAt || '-'}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-outline-info btn-sm d-inline-flex align-items-center justify-content-center"
                                      title={item.hasDescricao ? 'Descrição' : 'Sem descrição'}
                                      aria-label="Descrição"
                                      onClick={() => setHandMaisDetailItem(item)}
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
                      ) : contratoFonte === 'prata' ? (
                        <table className="table table-dark table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>CPF</th>
                              <th>Status</th>
                              <th>Margem Disponível</th>
                              <th>Última atualização</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedContratoRows.length === 0 ? (
                              <EmptyCell colSpan={5} text="Nenhum registro de Prata encontrado." />
                            ) : (
                              selectedContratoRows.map((item) => (
                                <tr key={item.key}>
                                  <td>{item.nome || '-'}</td>
                                  <td>{item.cpf || '-'}</td>
                                  <td>{item.status || '-'}</td>
                                  <td>{item.margemDisponivel || '-'}</td>
                                  <td>{item.createdAt || '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      ) : (
                        <table className="table table-dark table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Banco</th>
                              <th>N do Contrato</th>
                              <th>Pago/Restantes (Parcelas)</th>
                              <th>Taxa</th>
                              <th>Valor Parcela</th>
                              <th>Emprestado</th>
                              <th>Última atualização</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedContratoRows.length === 0 ? (
                              <EmptyCell colSpan={7} text="Nenhum contrato encontrado." />
                            ) : (
                              selectedContratoRows.map((item) => (
                                <tr key={item.key}>
                                  <td>
                                    <BankNameWithIcon
                                      bankCode={item.bancoCodigo}
                                      bankName={resolveBankName(item.bancoCodigo, item.bancoNomeRaw)}
                                    />
                                  </td>
                                  <td>{item.contrato || '-'}</td>
                                  <td>{`${item.pgtoRestantes || '-'} (${item.parcelas || '-'})`}</td>
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
                                  <td>{item.dataUpdate || '-'}</td>
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
      {handMaisDetailItem && handMaisModalData && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ background: 'rgba(2, 6, 23, 0.72)', zIndex: 2500 }}
          onClick={() => setHandMaisDetailItem(null)}
        >
          <div
            className="neo-card p-0"
            style={{ width: 'min(1180px, 100%)', maxHeight: '85vh', overflow: 'auto', borderRadius: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="d-flex align-items-start justify-content-between gap-3 px-3 py-3 border-bottom border-secondary-subtle">
              <div>
                <h5 className="mb-1">Resultado da Consulta Hand+</h5>
                <div className="small opacity-75">Visualização detalhada da consulta selecionada.</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm text-danger"
                aria-label="Fechar"
                title="Fechar"
                onClick={() => setHandMaisDetailItem(null)}
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="p-3">
              <div className="row g-2 mb-3">
                <div className="col-12 col-md-3">
                  <div className="small opacity-75">CPF</div>
                  <div className="fw-semibold d-flex align-items-center gap-2">
                    <span>{handMaisModalData.cpf}</span>
                    <CopyButton value={handMaisModalData.cpfRaw} label="CPF" />
                  </div>
                </div>
                <div className="col-12 col-md-3">
                  <div className="small opacity-75">Nome</div>
                  <div className="fw-semibold text-break">{handMaisModalData.nome}</div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="small opacity-75">Status</div>
                  <div>
                    <span className={`badge ${getHandMaisStatusBadgeClass(handMaisModalData.statusRaw)}`}>
                      {handMaisModalData.status}
                    </span>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="small opacity-75">Valor Margem</div>
                  <div className="fw-semibold">{handMaisModalData.valorMargem}</div>
                </div>
                <div className="col-12 col-md-2">
                  <div className="small opacity-75">Última atualização</div>
                  <div className="fw-semibold text-wrap" style={{ whiteSpace: 'normal' }}>{handMaisModalData.updatedAt}</div>
                </div>
              </div>

              <div className="neo-card p-3 mb-3">
                <div className="small opacity-75 mb-2">Vínculo</div>
                <div className="row g-2">
                  {handMaisModalData.vinculoEntries.map((entry) => (
                    <div key={entry.key} className="col-12 col-md-4">
                      <div className="small opacity-75">{entry.label}</div>
                      <div className="fw-semibold text-wrap" style={{ whiteSpace: 'normal' }}>{entry.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="neo-card p-3 mb-3">
                <div className="small opacity-75 mb-2">Informações adicionais</div>
                <div className="row g-2">
                  {handMaisModalData.adicionaisEntries.map((entry) => (
                    <div key={entry.key} className="col-12 col-md-4">
                      <div className="neo-card p-2 h-100">
                        <div className="small opacity-75">{entry.label}</div>
                        <div className="small text-wrap" style={{ whiteSpace: 'normal' }}>{entry.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="neo-card p-3" style={{ borderColor: 'rgba(255, 140, 0, 0.35)' }}>
                <div className="small opacity-75 mb-1">Descrição</div>
                <div className="small text-break">{handMaisModalData.descricao}</div>
              </div>
            </div>
          </div>
        </div>
      )}
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
      {presencaDetailItem && presencaModalData && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ background: 'rgba(2, 6, 23, 0.72)', zIndex: 2500 }}
          onClick={() => setPresencaDetailItem(null)}
        >
          <div
            className="neo-card p-3 p-md-4"
            style={{ width: 'min(1200px, 100%)', maxHeight: '85vh', overflow: 'auto', borderRadius: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="mb-0">Resultado da Consulta Individual</h6>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm text-danger"
                aria-label="Fechar"
                title="Fechar"
                onClick={() => setPresencaDetailItem(null)}
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="small opacity-75 mb-3">Última atualização: {presencaModalData.updatedAt}</div>

            <div className="row g-2 mb-3">
              <div className="col-12 col-md-6">
                <div className="small opacity-75">CPF</div>
                <div className="fw-semibold d-flex align-items-center gap-2">
                  <span>{presencaModalData.cpf}</span>
                  <CopyButton value={presencaModalData.cpfDigits} label="CPF" />
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="small opacity-75">Nome</div>
                <div className="fw-semibold text-break">{presencaModalData.nome || '-'}</div>
              </div>
              {presencaModalData.finalMessage && !presencaModalData.errorMessage && (
                <div className="col-12">
                  <div className="small opacity-75">Mensagem</div>
                  <div className="fw-semibold small text-break">{presencaModalData.finalMessage}</div>
                </div>
              )}
            </div>

            <div className="neo-card p-3 mb-3">
              <div className="small opacity-75 mb-2">Vínculo</div>
              <div className="row g-2">
                <div className="col-12 col-md-4">
                  <div className="small opacity-75">Elegível</div>
                  <div className="fw-semibold">
                    {presencaModalData?.vinculo?.elegivel === null ? (
                      <span className="badge text-bg-secondary">-</span>
                    ) : (
                      <span className={`badge ${presencaModalData.vinculo.elegivel ? 'text-bg-success' : 'text-bg-danger'}`}>
                        {presencaModalData.vinculo.elegivel ? 'Sim' : 'Não'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="neo-card p-3 mb-3">
              <div className="small opacity-75 mb-2">Margem</div>
              <div className="row g-2">
                <div className="col-12 col-md-3"><div className="small opacity-75">Valor Margem Disponível</div><div className="fw-semibold">{formatMoney(presencaModalData?.margemData?.valorMargemDisponivel)}</div></div>
                <div className="col-12 col-md-3"><div className="small opacity-75">Valor Margem Base</div><div className="fw-semibold">{formatMoney(presencaModalData?.margemData?.valorMargemBase)}</div></div>
                <div className="col-12 col-md-3"><div className="small opacity-75">Valor Total Devido</div><div className="fw-semibold">{formatMoney(presencaModalData?.margemData?.valorTotalDevido)}</div></div>
                <div className="col-12 col-md-3"><div className="small opacity-75">Data Admissão</div><div className="fw-semibold">{formatDate(presencaModalData?.margemData?.dataAdmissao)}</div></div>
              </div>
            </div>

            <div className="neo-card p-3">
              <div className="small opacity-75 mb-2">Tabelas Disponíveis</div>
              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0">
                  <thead>
                    <tr>
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
                    {sortedPresencaTabelas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-3 opacity-75">Nenhuma tabela retornada.</td>
                      </tr>
                    ) : (
                      sortedPresencaTabelas.map((item, idx) => (
                        <tr key={`${item?.id ?? 'id'}-${item?.nome ?? 'nome'}-${idx}`}>
                          <td className="text-wrap">{item?.nome || '-'}</td>
                          <td>{hasValue(item?.prazo) ? String(item.prazo) : '-'}</td>
                          <td>{hasValue(item?.taxaJuros) ? String(item.taxaJuros) : '-'}</td>
                          <td>{hasValue(item?.valorLiberado) ? formatMoney(item.valorLiberado) : '-'}</td>
                          <td>{hasValue(item?.valorParcela) ? formatMoney(item.valorParcela) : '-'}</td>
                          <td>{firstFilled(item?.tipoCredito?.name, item?.tipoCredito, 'Novo')}</td>
                          <td>{hasValue(item?.taxaSeguro) ? String(item.taxaSeguro) : '-'}</td>
                          <td>{hasValue(item?.valorSeguro) ? formatMoney(item.valorSeguro) : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {presencaModalData.errorMessage && (
              <div className="neo-card p-3 mt-3 border border-danger-subtle">
                <div className="small text-danger fw-semibold mb-2">Mensagem de erro</div>
                <div className="small text-break">{presencaModalData.errorMessage}</div>
              </div>
            )}
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
