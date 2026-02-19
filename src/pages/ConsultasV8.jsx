import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiChevronDown, FiDownload, FiEye, FiRefreshCw } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'

const API_URL = 'https://n8n.apivieiracred.store/webhook/api/consulta-v8'
const V8_GET_LOGINS_API_URL = 'https://n8n.apivieiracred.store/webhook/api/getconsulta-v8'
const V8_ADD_LOGIN_API_URL = 'https://n8n.apivieiracred.store/webhook/api/adduser-consultav8'
const V8_INDIVIDUAL_API_URL = 'https://n8n.apivieiracred.store/webhook/api/consultav8-individual'
const LIMITED_USER_ID = 3347
const DEFAULT_LIMIT_SUMMARY = { total: '-', usado: '-', restantes: '-' }

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const canUser3347SeeRow = (row) => {
  const token = String(row?.token_usado ?? '').trim().toLowerCase()
  return token === '*' || token === 'vision' || token === 'a vision'
}

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (payload && typeof payload === 'object') return [payload]
  return []
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

const statusClassName = (status) => {
  const token = String(status ?? '').trim().toUpperCase()
  if (!token) return 'text-bg-secondary'
  if (token.includes('APROV')) return 'text-bg-success'
  if (token.includes('WAITING') || token.includes('CONSENT')) return 'text-bg-warning'
  if (token.includes('REPROV') || token.includes('RECUS') || token.includes('ERROR')) return 'text-bg-danger'
  return 'text-bg-secondary'
}

const isPendingV8Status = (status) => {
  const token = String(status ?? '').trim().toUpperCase()
  if (!token) return false
  return token.includes('PEND') || token.includes('WAITING') || token.includes('CONSENT') || token.includes('PROCESS')
}

const hasPendingRows = (rows) => {
  const list = Array.isArray(rows) ? rows : []
  return list.some((row) => isPendingV8Status(row?.status_consulta_v8))
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
  const byCpf = !expectedCpf || !rowCpf || rowCpf === expectedCpf
  const byNome = !expectedNome || !rowNome || rowNome === expectedNome
  return byCpf && byNome
}

const getRowSortTimestamp = (row) => {
  const raw = row?.created_at || row?.updated_at || row?.createdAt || row?.updatedAt || 0
  const ts = new Date(raw).getTime()
  return Number.isFinite(ts) ? ts : 0
}

const normalizeDescricao = (value) => {
  const txt = String(value ?? '').trim()
  return txt || 'Sem descrição'
}

const descricaoKey = (value) => normalizeDescricao(value).toLowerCase()

export default function ConsultasV8() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [limitSummary, setLimitSummary] = useState(DEFAULT_LIMIT_SUMMARY)
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
  const [showAddLoginModal, setShowAddLoginModal] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novaEmpresa, setNovaEmpresa] = useState('')
  const [savingNovoLogin, setSavingNovoLogin] = useState(false)
  const [sendingConsultaIndividual, setSendingConsultaIndividual] = useState(false)
  const [autoPollingActive, setAutoPollingActive] = useState(false)
  const [pollingQuery, setPollingQuery] = useState(null)
  const pollInFlightRef = useRef(false)
  const pollSawPendingRef = useRef(false)

  const fetchLoginSummaries = useCallback(async (signal) => {
    const userId = toNumberOrNull(user?.id)
    if (userId === null) {
      setLoginSummaries([])
      setSelectedLoginIndex(0)
      return
    }

    try {
      const url = `${V8_GET_LOGINS_API_URL}?id_user=${encodeURIComponent(userId)}`
      const response = await fetch(url, { method: 'GET', signal })
      const raw = await response.text()
      if (!response.ok) throw new Error(raw || `HTTP ${response.status}`)

      let payload = []
      try {
        payload = raw ? JSON.parse(raw) : []
      } catch {
        payload = []
      }

      const sourceRows = normalizeRows(payload)
      const mapped = sourceRows.map((row) => ({
        loginId: pickRowValue(row, ['id_login', 'idLogin', 'login_id', 'id', 'Id'], ''),
        login: String(pickRowValue(row, ['login', 'loginP', 'usuario_login', 'email'], '-')).trim() || '-',
        email: String(pickRowValue(row, ['email', 'Email', 'login', 'loginP'], '')).trim(),
        empresa: String(pickRowValue(row, ['empresa', 'Empresa', 'company', 'nome_empresa'], '')).trim(),
        total: pickRowValue(row, ['total', 'limite_total', 'total_limite', 'total_creditos'], '-'),
        usado: pickRowValue(row, ['usado', 'utilizado', 'total_usado', 'creditos_usados'], '-'),
        restantes: pickRowValue(row, ['restantes', 'restante', 'saldo', 'disponivel', 'creditos_restantes'], '-')
      }))

      const unique = []
      const seen = new Set()
      for (const item of mapped) {
        const key = `${String(item.loginId || '').toLowerCase()}|${String(item.login || '').toLowerCase()}|${String(item.email || '').toLowerCase()}|${String(item.empresa || '').toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(item)
      }

      setLoginSummaries(unique)
      setSelectedLoginIndex((prev) => {
        if (unique.length === 0) return 0
        return Math.min(prev, unique.length - 1)
      })
    } catch (err) {
      if (err?.name === 'AbortError') return
      setLoginSummaries([])
      setSelectedLoginIndex(0)
    }
  }, [user?.id])

  const fetchConsultas = useCallback(async (signal, query = {}) => {
    setLoading(true)
    setError('')
    try {
      const userId = toNumberOrNull(user?.id)
      const selectedLogin = loginSummaries[selectedLoginIndex] || null

      if (userId === null || !selectedLogin) {
        setRows([])
        setLimitSummary(DEFAULT_LIMIT_SUMMARY)
        return []
      }

      const requestUrl = new URL(API_URL)
      const activeLogin = String(selectedLogin?.login ?? selectedLogin?.email ?? '').trim()
      const activeEmail = String(selectedLogin?.email ?? '').trim()
      const activeEmpresa = String(selectedLogin?.empresa ?? '').trim()

      // Sempre envia todos os filtros-base da consulta V8.
      requestUrl.searchParams.set('user_id', String(userId))
      requestUrl.searchParams.set('login', activeLogin)
      requestUrl.searchParams.set('email', activeEmail)
      requestUrl.searchParams.set('empresa', activeEmpresa)

      const normalizedCpf = normalizeCpf11(query?.cpf)
      const normalizedNome = normalizeClientName(query?.nome)
      if (normalizedCpf) requestUrl.searchParams.set('cpf', normalizedCpf)
      if (normalizedNome) requestUrl.searchParams.set('nome', normalizedNome)

      const response = await fetch(requestUrl.toString(), { method: 'GET', signal })
      const raw = await response.text()
      if (!response.ok) {
        throw new Error(raw || `HTTP ${response.status}`)
      }
      let payload = null
      try {
        payload = raw ? JSON.parse(raw) : []
      } catch {
        throw new Error('Resposta da API invalida')
      }
      const normalizedRows = normalizeRows(payload)
      setRows(normalizedRows)
      setLimitSummary(resolveLimitSummary(payload, normalizedRows.length))
      setLastSyncAt(new Date())
      return normalizedRows
    } catch (err) {
      if (err?.name === 'AbortError') return
      setRows([])
      setLimitSummary(DEFAULT_LIMIT_SUMMARY)
      setError(err?.message || 'Falha ao carregar consultas V8')
      return []
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [user?.id, loginSummaries, selectedLoginIndex])

  useEffect(() => {
    const controller = new AbortController()
    fetchLoginSummaries(controller.signal)
    return () => controller.abort()
  }, [fetchLoginSummaries])

  useEffect(() => {
    const controller = new AbortController()
    fetchConsultas(controller.signal)
    return () => controller.abort()
  }, [fetchConsultas])

  useEffect(() => {
    if (!autoPollingActive) return undefined

    let cancelled = false
    const tick = async () => {
      if (cancelled || pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        const latestRows = await fetchConsultas(undefined, pollingQuery || {})
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

        const latestIsPending = isPendingV8Status(latestScopedRow?.status_consulta_v8)
        if (latestIsPending) {
          pollSawPendingRef.current = true
          return
        }

        // Para somente quando o registro mais recente sair de pendente.
        setAutoPollingActive(false)
        setPollingQuery(null)
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
  }, [autoPollingActive, pollingQuery, fetchConsultas])

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
      fetchLoginSummaries()
    } catch (err) {
      notify.error(err?.message || 'Falha ao enviar novo login.', { autoClose: 2800 })
    } finally {
      setSavingNovoLogin(false)
    }
  }, [savingNovoLogin, novoEmail, novaSenha, novaEmpresa, user?.id, fetchLoginSummaries])

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
      setConsultaError('Usuário sem ID para consulta.')
      return
    }

    const selectedLogin = loginSummaries[selectedLoginIndex] || null
    const loginIdRaw = String(selectedLogin?.loginId ?? '').trim()
    if (!loginIdRaw) {
      setConsultaError('Selecione um login válido com ID para consultar.')
      return
    }

    const parsedLoginId = toNumberOrNull(loginIdRaw)
    const payload = {
      id_login: parsedLoginId ?? loginIdRaw,
      id_user: userId,
      cpf: normalizedCpf,
      nome: normalizedNome
    }

    try {
      setSendingConsultaIndividual(true)
      setConsultaError('')
      const response = await fetch(V8_INDIVIDUAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const rawText = await response.text()
      if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

      if (response.status === 200) {
        notify.success('Consulta iniciada.', { autoClose: 2200 })
      } else {
        notify.success('Consulta individual enviada com sucesso.', { autoClose: 2200 })
      }
      pollSawPendingRef.current = false
      setPollingQuery({ cpf: normalizedCpf, nome: normalizedNome })
      setAutoPollingActive(true)
      fetchConsultas(undefined, { cpf: normalizedCpf, nome: normalizedNome })
    } catch (err) {
      const msg = err?.message || 'Falha ao enviar consulta individual.'
      setConsultaError(msg)
      notify.error(msg, { autoClose: 2800 })
    } finally {
      setSendingConsultaIndividual(false)
    }
  }, [consultaCpf, consultaNome, fetchConsultas, loginSummaries, selectedLoginIndex, user?.id])

  const handleRefresh = useCallback(() => {
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
  }, [consultaCpf, consultaNome, fetchConsultas])

  const visibleRows = useMemo(() => {
    const userId = toNumberOrNull(user?.id)
    if (userId !== LIMITED_USER_ID) return rows
    return (Array.isArray(rows) ? rows : []).filter(canUser3347SeeRow)
  }, [rows, user?.id])

  const sortedRows = useMemo(() => {
    const list = Array.isArray(visibleRows) ? [...visibleRows] : []
    return list.sort((a, b) => {
      const ta = new Date(a?.created_at || 0).getTime()
      const tb = new Date(b?.created_at || 0).getTime()
      return tb - ta
    })
  }, [visibleRows])

  const statusOptions = useMemo(() => {
    const set = new Set()
    for (const r of sortedRows) {
      const status = String(r?.status_consulta_v8 ?? '').trim()
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
        const updatedAt = new Date(row?.created_at)
        if (Number.isNaN(updatedAt.getTime())) return false
        if (fromDate && updatedAt < fromDate) return false
        if (toDate && updatedAt > toDate) return false
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
      const status = String(row?.status_consulta_v8 ?? '').trim().toLowerCase()
      return selectedStatusSet.has(status)
    })
  }, [preStatusFilteredRows, selectedStatusSet])

  const statusCounts = useMemo(() => {
    const map = new Map()
    for (const row of preStatusFilteredRows) {
      const label = String(row?.status_consulta_v8 ?? '').trim()
      if (!label) continue
      const key = label.toLowerCase()
      const prev = map.get(key)
      if (prev) prev.count += 1
      else map.set(key, { key, label, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label, 'pt-BR'))
  }, [preStatusFilteredRows])

  const pageSize = 50
  const pages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / pageSize)), [filteredRows.length])
  const currentPage = useMemo(() => Math.min(page, pages), [page, pages])

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage])

  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, filteredRows.length)
  const currentLoginSummary = loginSummaries[selectedLoginIndex] || null
  const currentLimitSummary = {
    total: displayOrFallback(currentLoginSummary?.total, limitSummary.total),
    usado: displayOrFallback(currentLoginSummary?.usado, limitSummary.usado),
    restantes: displayOrFallback(currentLoginSummary?.restantes, limitSummary.restantes)
  }

  const exportCSV = useCallback(() => {
    const headers = [
      'ID',
      'CPF',
      'Sexo',
      'Nascimento',
      'Nome',
      'Telefone',
      'Última atualização',
      'Status Consulta V8',
      'Valor Liberado',
      'Descrição'
    ]
    const out = filteredRows.map((r) => ([
      r?.id ?? '',
      formatCpf(r?.cliente_cpf),
      sexoToken(r?.cliente_sexo),
      formatDate(r?.nascimento, { dateOnly: true }),
      r?.cliente_nome ?? '',
      formatPhone(r?.telefone),
      formatDate(r?.created_at),
      r?.status_consulta_v8 ?? '',
      formatCurrency(r?.valor_liberado),
      r?.descricao ?? ''
    ]))

    const csv = [headers, ...out]
      .map(row => row.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';'))
      .join('\r\n')

    // Excel (Windows) often needs a UTF-8 BOM to display PT-BR accents correctly.
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
                {lastSyncAt ? `Última atualização: ${formatDate(lastSyncAt)}` : 'Carregando dados...'}
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
                <div className="opacity-75 small text-uppercase mb-2">Limite</div>
                <div className="mb-3">
                  <label className="form-label small opacity-75 mb-1">Login</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedLoginIndex}
                    onChange={(event) => setSelectedLoginIndex(Number(event.target.value))}
                    disabled={loginSummaries.length === 0}
                  >
                    {loginSummaries.length === 0 ? (
                      <option value={0}>Sem login</option>
                    ) : (
                      loginSummaries.map((item, idx) => (
                        <option key={`${item.login || item.email}-${idx}`} value={idx}>
                          {loginOptionLabel(item, idx)}
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
                    <div className="h4 fw-bold mb-0">{currentLimitSummary.total}</div>
                  </div>
                  <div>
                    <div className="small opacity-75">Usado</div>
                    <div className="h4 fw-bold mb-0">{currentLimitSummary.usado}</div>
                  </div>
                  <div>
                    <div className="small opacity-75">Restantes</div>
                    <div className="h4 fw-bold mb-0">{currentLimitSummary.restantes}</div>
                  </div>
                </div>
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
                          disabled={loading || Boolean(error) || filteredRows.length === 0}
                          title="Baixar CSV (;)"
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
              </div>
            </div>

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
                            title={item.label}
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
                                {item.label}
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
          </div>
        </section>

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
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>CPF</th>
                  <th>Sexo</th>
                  <th>Nascimento</th>
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
                    <td colSpan={10} className="py-4 text-center">
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Carregando consultas...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td colSpan={10} className="py-4 text-center text-danger">
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-4 text-center opacity-75">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}

                {!loading && !error && pageRows.map((row, idx) => (
                  <tr key={String(row?.id ?? `${row?.cliente_cpf ?? 'sem-cpf'}-${row?.created_at ?? idx}`)}>
                    <td>{row?.id ?? '-'}</td>
                    <td>{formatCpf(row?.cliente_cpf)}</td>
                    <td>{renderSexo(row?.cliente_sexo)}</td>
                    <td>{formatDate(row?.nascimento, { dateOnly: true })}</td>
                    <td className="text-nowrap">{row?.cliente_nome || '-'}</td>
                    <td>{formatPhone(row?.telefone)}</td>
                    <td>{formatDate(row?.created_at)}</td>
                    <td>
                      <span className={`badge ${statusClassName(row?.status_consulta_v8)}`}>
                        {row?.status_consulta_v8 || '-'}
                      </span>
                    </td>
                    <td>{formatCurrency(row?.valor_liberado)}</td>
                    <td className="text-center">
                      {(() => {
                        const token = String(row?.descricao ?? '').trim()
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
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
                <h5 className="modal-title">Detalhes do cliente</h5>
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
                  <div className="col-3 col-lg-3">
                    <div className="small opacity-75">Nascimento</div>
                    <div className="fw-semibold">{formatDate(selectedRow?.nascimento, { dateOnly: true })}</div>
                  </div>
                  <div className="col-12 col-lg-3">
                    <div className="small opacity-75">Telefone</div>
                    <div className="fw-semibold">{formatPhone(selectedRow?.telefone)}</div>
                  </div>

                  <div className="col-12 col-lg-6">
                    <div className="small opacity-75">Email</div>
                    <div className="fw-semibold text-break">{selectedRow?.email || '-'}</div>
                  </div>
                  <div className="col-6 col-lg-3">
                    <div className="small opacity-75">Última atualização</div>
                    <div className="fw-semibold">{formatDate(selectedRow?.created_at)}</div>
                  </div>
                  <div className="col-6 col-lg-3">
                    <div className="small opacity-75">Valor liberado</div>
                    <div className="fw-semibold">{formatCurrency(selectedRow?.valor_liberado)}</div>
                  </div>

                  <div className="col-12">
                    <div className="small opacity-75">Status Consulta V8</div>
                    <div className="fw-semibold">
                      <span className={`badge ${statusClassName(selectedRow?.status_consulta_v8)}`}>
                        {selectedRow?.status_consulta_v8 || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="neo-card p-3 mt-3">
                  <div className="small opacity-75 mb-1">Descrição</div>
                  <div className="fw-semibold text-break">{selectedRow?.descricao || '-'}</div>
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
