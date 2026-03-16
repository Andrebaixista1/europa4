import { useEffect, useMemo, useRef, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { novidadesList } from '../components/NovidadesModal.jsx'
import { Roles } from '../utils/roles.js'
import { notify } from '../utils/notify.js'

const API_BASE = 'http://85.31.61.242:8011/api'
const IN100_LIMITES_GET_API_URL = `${API_BASE}/dashboard/saldos/in100`
const IN100_CONSULTAS_GET_API_URL = `${API_BASE}/dashboard/consultas/in100`
const V8_LIMITES_FALLBACK_API_URL = `${API_BASE}/logins/consultasv8`
const V8_CONSULTAS_FALLBACK_API_URL = `${API_BASE}/dashboard/consultas/v8`
const PRATA_LIMITES_GET_API_URL = `${API_BASE}/dashboard/saldos/prata`
const PRATA_CONSULTAS_GET_API_URL = `${API_BASE}/dashboard/consultas/prata`
const PRESENCA_LIMITES_GET_API_URL = `${API_BASE}/dashboard/saldos/presenca`
const PRESENCA_CONSULTAS_GET_API_URL = `${API_BASE}/dashboard/consultas/presenca`
const HANDMAIS_LIMITES_FALLBACK_API_URL = `${API_BASE}/logins/consultashandmais`
const HANDMAIS_CONSULTAS_FALLBACK_API_URL = `${API_BASE}/dashboard/consultas/handmais`
const ENABLE_IN100_API = true
const ENABLE_PRATA_API = true
const ENABLE_PRESENCA_API = true
const LOG_SOURCE = {
  IN100: 'in100',
  V8: 'v8',
  PRATA: 'prata',
  PRESENCA: 'presenca',
  HANDMAIS: 'handmais'
}

const formatLastAccess = (value) => {
  if (!value) return '-'
  const raw = String(value).trim()
  const normalized = raw.replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1')
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString('pt-BR')
}

export default function Dashboard() {
  const { user } = useAuth()
  const role = user?.role ?? 'Operador'
  const news = useMemo(() => novidadesList.slice(0, 3), [])
  const [current, setCurrent] = useState(0)
  const [saldo, setSaldo] = useState({ carregado: 0, disponivel: 0, realizadas: 0 })
  const [loadingSaldo, setLoadingSaldo] = useState(false)
  const [saldoV8, setSaldoV8] = useState({ total: '-', usado: '-', restantes: '-' })
  const [loadingSaldoV8, setLoadingSaldoV8] = useState(false)
  const [saldoPrata, setSaldoPrata] = useState({ total: '-', usado: '-', restantes: '-' })
  const [loadingSaldoPrata, setLoadingSaldoPrata] = useState(false)
  const [saldoPresenca, setSaldoPresenca] = useState({ total: '-', usado: '-', restantes: '-' })
  const [loadingSaldoPresenca, setLoadingSaldoPresenca] = useState(false)
  const [saldoHandMais, setSaldoHandMais] = useState({ total: '-', usado: '-', restantes: '-' })
  const [loadingSaldoHandMais, setLoadingSaldoHandMais] = useState(false)
  const [activeLogsSource, setActiveLogsSource] = useState(LOG_SOURCE.IN100)
  const [logsBySource, setLogsBySource] = useState({
    [LOG_SOURCE.IN100]: [],
    [LOG_SOURCE.V8]: [],
    [LOG_SOURCE.PRATA]: [],
    [LOG_SOURCE.PRESENCA]: [],
    [LOG_SOURCE.HANDMAIS]: []
  })
  const [loadingLogsBySource, setLoadingLogsBySource] = useState({
    [LOG_SOURCE.IN100]: false,
    [LOG_SOURCE.V8]: false,
    [LOG_SOURCE.PRATA]: false,
    [LOG_SOURCE.PRESENCA]: false,
    [LOG_SOURCE.HANDMAIS]: false
  })
  const [logsErrorBySource, setLogsErrorBySource] = useState({
    [LOG_SOURCE.IN100]: '',
    [LOG_SOURCE.V8]: '',
    [LOG_SOURCE.PRATA]: '',
    [LOG_SOURCE.PRESENCA]: '',
    [LOG_SOURCE.HANDMAIS]: ''
  })
  const dashboardSaldosAvailableRef = useRef(null)
  const dashboardConsultasAvailableRef = useRef(null)
  const initialFetchUserRef = useRef(null)
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

  const buildSaldoPayload = () => {
    const equipeId = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
    const equipeNome = user?.equipe_nome ?? user?.team_name ?? user?.teamName ?? user?.equipeNome ?? null
    const payload = {
      id_user: user?.id,
      id: user?.id,
      login: user?.login
    }
    if (equipeId != null) {
      payload.equipe_id = equipeId
      payload.team_id = equipeId
      payload.id_equipe = equipeId
    }
    if (equipeNome) {
      payload.equipe_nome = equipeNome
      payload.team_name = equipeNome
      payload.nome_equipe = equipeNome
    }
    return payload
  }

  const fetchSaldo = async () => {
    if (!user?.id) return
    if (!ENABLE_IN100_API) {
      setSaldo({ carregado: 0, disponivel: 0, realizadas: 0 })
      return
    }
    if (dashboardSaldosAvailableRef.current === false) {
      setSaldo({ carregado: 0, disponivel: 0, realizadas: 0 })
      return
    }
    setLoadingSaldo(true)
    try {
      const payload = buildSaldoPayload()
      const rows = await fetchRowsFromUrl(buildSaldoRequestUrl(IN100_LIMITES_GET_API_URL))
      if (!Array.isArray(rows) || rows.length === 0) return
      const num = (val) => Number(val ?? 0)
      const arr = rows
      const targetTeamId = payload?.equipe_id ?? payload?.team_id ?? payload?.id_equipe ?? null
      const item =
        arr.find((row) => {
          if (!row) return false
          if (targetTeamId == null) return false
          const eqId = Number(row.equipe_id ?? row.team_id ?? row.id_equipe)
          return Number(targetTeamId) === eqId
        }) || arr[0] || {}
      setSaldo({
        carregado: num(item.total_carregado ?? item.total ?? item.carregado),
        disponivel: num(item.limite_disponivel ?? item.disponivel ?? item.limite ?? item.limite_total),
        realizadas: num(item.consultas_realizada ?? item.consultas_realizadas ?? item.realizadas ?? item.qtd_consultas)
      })
    } catch (e) {
      if (isMissingRouteError(e)) {
        dashboardSaldosAvailableRef.current = false
      }
      setSaldo({ carregado: 0, disponivel: 0, realizadas: 0 })
    } finally {
      setLoadingSaldo(false)
    }
  }

  const toNumberOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  const buildV8SummaryFromRows = (rows) => {
    const list = Array.isArray(rows) ? rows : []
    if (list.length === 0) return { total: '-', usado: '-', restantes: '-' }

    const parseTotal = (row) => toNumberOrNull(row?.total ?? row?.limite)
    const parseUsado = (row) => toNumberOrNull(row?.consultados ?? row?.usado)

    const totalRow = list.find((row) => {
      const id = String(row?.id ?? '').trim()
      const email = String(row?.email ?? row?.login ?? '').trim().toUpperCase()
      return (id === '0' || email === 'TOTAL') && (parseTotal(row) !== null || parseUsado(row) !== null)
    })

    if (totalRow) {
      const total = parseTotal(totalRow) ?? 0
      const usado = parseUsado(totalRow) ?? 0
      return { total, usado, restantes: Math.max(0, total - usado) }
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

    if (!hasAnyNumeric) return { total: '-', usado: '-', restantes: '-' }
    return { total, usado, restantes: Math.max(0, total - usado) }
  }

  const fetchSaldoV8 = async () => {
    if (!user?.id) return
    setLoadingSaldoV8(true)
    try {
      const rows = await fetchRowsFromUrl(buildSaldoRequestUrl(V8_LIMITES_FALLBACK_API_URL))
      setSaldoV8(buildV8SummaryFromRows(rows))
    } catch (_) {
      setSaldoV8({ total: '-', usado: '-', restantes: '-' })
    } finally {
      setLoadingSaldoV8(false)
    }
  }

  const fetchSaldoPrata = async () => {
    if (!user?.id) return
    if (!ENABLE_PRATA_API) {
      setSaldoPrata({ total: '-', usado: '-', restantes: '-' })
      return
    }
    if (dashboardSaldosAvailableRef.current === false) {
      setSaldoPrata({ total: '-', usado: '-', restantes: '-' })
      return
    }
    setLoadingSaldoPrata(true)
    try {
      const rows = await fetchRowsFromUrl(buildSaldoRequestUrl(PRATA_LIMITES_GET_API_URL))
      setSaldoPrata(buildV8SummaryFromRows(rows))
    } catch (e) {
      if (isMissingRouteError(e)) {
        dashboardSaldosAvailableRef.current = false
      }
      setSaldoPrata({ total: '-', usado: '-', restantes: '-' })
    } finally {
      setLoadingSaldoPrata(false)
    }
  }

  const buildPresencaSummaryFromRows = (rows) => {
    const list = Array.isArray(rows) ? rows : []
    if (list.length === 0) return { total: '-', usado: '-', restantes: '-' }

    let total = 0
    let usado = 0
    let hasAnyNumeric = false

    for (const row of list) {
      const id = String(row?.id ?? '').trim()
      if (id === '0') continue
      const totalValue = toNumberOrNull(row?.total ?? row?.limite)
      const usadoValue = toNumberOrNull(row?.usado ?? row?.consultados)

      if (totalValue !== null) {
        total += totalValue
        hasAnyNumeric = true
      }
      if (usadoValue !== null) {
        usado += usadoValue
        hasAnyNumeric = true
      }
    }

    if (!hasAnyNumeric) return { total: '-', usado: '-', restantes: '-' }
    return { total, usado, restantes: Math.max(0, total - usado) }
  }

  const buildHandMaisSummaryFromRows = (rows) => {
    const list = Array.isArray(rows) ? rows : []
    if (list.length === 0) return { total: '-', usado: '-', restantes: '-' }

    let total = 0
    let usado = 0
    let hasAnyNumeric = false

    for (const row of list) {
      const totalValue = toNumberOrNull(row?.total ?? row?.limite)
      const usadoValue = toNumberOrNull(row?.consultados ?? row?.usado)

      if (totalValue !== null) {
        total += totalValue
        hasAnyNumeric = true
      }
      if (usadoValue !== null) {
        usado += usadoValue
        hasAnyNumeric = true
      }
    }

    if (!hasAnyNumeric) return { total: '-', usado: '-', restantes: '-' }
    return { total, usado, restantes: Math.max(0, total - usado) }
  }

  const fetchSaldoPresenca = async () => {
    if (!user?.id) return
    if (!ENABLE_PRESENCA_API) {
      setSaldoPresenca({ total: '-', usado: '-', restantes: '-' })
      return
    }
    if (dashboardSaldosAvailableRef.current === false) {
      setSaldoPresenca({ total: '-', usado: '-', restantes: '-' })
      return
    }
    setLoadingSaldoPresenca(true)
    try {
      const rows = await fetchRowsFromUrl(buildSaldoRequestUrl(PRESENCA_LIMITES_GET_API_URL))
      setSaldoPresenca(buildPresencaSummaryFromRows(rows))
    } catch (e) {
      if (isMissingRouteError(e)) {
        dashboardSaldosAvailableRef.current = false
      }
      setSaldoPresenca({ total: '-', usado: '-', restantes: '-' })
    } finally {
      setLoadingSaldoPresenca(false)
    }
  }

  const buildSaldoRequestUrl = (baseUrl) => {
    const url = new URL(baseUrl)
    const equipeId = resolveUserEquipeId(user)

    if (equipeId !== null) {
      url.searchParams.set('equipe_id', String(equipeId))
    } else {
      url.searchParams.set('all', '1')
    }

    return url.toString()
  }

  const buildLegacyRequestUrl = (baseUrl, options = {}) => {
    const url = new URL(baseUrl)
    const equipeId = resolveUserEquipeId(user)
    const roleId = resolveUserRoleId(user)
    const roleLabel = String(user?.role ?? '').trim()
    const hierarchyLevel = user?.nivel_hierarquia ?? user?.NivelHierarquia ?? user?.level ?? roleId
    const consultaId = toNumberOrNull(options?.idConsultaHand)

    if (user?.id !== null && user?.id !== undefined && user?.id !== '') {
      url.searchParams.set('id_user', String(user.id))
    }
    if (equipeId !== null) {
      url.searchParams.set('equipe_id', String(equipeId))
    }
    if (roleId !== null) {
      url.searchParams.set('id_role', String(roleId))
      url.searchParams.set('role_id', String(roleId))
    }
    if (roleLabel) {
      url.searchParams.set('role', roleLabel)
      url.searchParams.set('hierarquia', roleLabel)
    }
    if (hierarchyLevel !== null && hierarchyLevel !== undefined && hierarchyLevel !== '') {
      url.searchParams.set('nivel_hierarquia', String(hierarchyLevel))
    }
    if (consultaId !== null) {
      url.searchParams.set('id_consulta_hand', String(consultaId))
    }

    if (Number(user?.id) === 1) {
      url.searchParams.set('all', '1')
    }

    return url.toString()
  }

  const getHandMaisSortTimestamp = (row) => {
    const updatedTs = new Date(row?.updated_at ?? row?.updatedAt ?? '').getTime()
    const createdTs = new Date(row?.created_at ?? row?.createdAt ?? '').getTime()
    const updatedSafe = Number.isFinite(updatedTs) ? updatedTs : 0
    const createdSafe = Number.isFinite(createdTs) ? createdTs : 0
    return Math.max(updatedSafe, createdSafe, 0)
  }

  const sortHandMaisRowsByUpdatedAtDesc = (rows) => {
    const arr = Array.isArray(rows) ? [...rows] : []
    return arr.sort((a, b) => getHandMaisSortTimestamp(b) - getHandMaisSortTimestamp(a))
  }

  const fetchSaldoHandMais = async () => {
    if (!user?.id) return
    setLoadingSaldoHandMais(true)
    try {
      let rows = await fetchRowsFromUrl(buildSaldoRequestUrl(HANDMAIS_LIMITES_FALLBACK_API_URL))
      rows = sortHandMaisRowsByUpdatedAtDesc(rows)
      setSaldoHandMais(buildHandMaisSummaryFromRows(rows))
    } catch (_) {
      setSaldoHandMais({ total: '-', usado: '-', restantes: '-' })
    } finally {
      setLoadingSaldoHandMais(false)
    }
  }

  const resolveUserEquipeId = (u) => {
    const raw = u?.equipe_id ?? u?.team_id ?? u?.equipeId ?? u?.teamId ?? null
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? null : parsed
  }

  const resolveUserRoleId = (u) => {
    const raw = u?.id_role ?? u?.role_id ?? u?.roleId ?? u?.level ?? null
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? null : parsed
  }

  const resolveRoleScope = () => {
    const roleText = String(user?.role ?? '').trim().toLowerCase()
    const isMaster =
      Number(user?.id) === 1 ||
      roleText === 'master' ||
      roleText.includes('master')
    const isAdmin = roleText === 'administrador' || roleText === 'admin' || roleText.includes('administrador')
    const isSupervisor = roleText === 'supervisor' || roleText.includes('supervisor')

    if (isMaster) return 'master'
    if (isAdmin || isSupervisor) return 'team'
    return 'self'
  }

  const applyLastConsultasScope = (rows) => {
    const list = Array.isArray(rows) ? rows : []
    const scope = resolveRoleScope()
    if (scope !== 'self') return list

    const currentUserId = toNumberOrNull(user?.id)
    if (currentUserId === null) return []

    return list.filter((row) => {
      const rowUserId = toNumberOrNull(row?.id_user ?? row?.user_id ?? row?.usuario_id)
      return rowUserId !== null && rowUserId === currentUserId
    })
  }

  const parseRowsFromRaw = (raw) => {
    try {
      const data = JSON.parse(raw)
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.data)) return data.data
      if (Array.isArray(data?.rows)) return data.rows
      if (data && typeof data === 'object') return [data]
      return []
    } catch (_) {
      return []
    }
  }

  const fetchRowsFromUrl = async (url) => {
    const response = await fetch(url, { method: 'GET' })
    const raw = await response.text().catch(() => '')
    if (!response.ok) {
      let message = ''
      try {
        const parsed = raw ? JSON.parse(raw) : null
        message = String(parsed?.message ?? '').trim()
      } catch (_) {
        message = ''
      }
      const error = new Error(message || `HTTP ${response.status}`)
      error.status = response.status
      throw error
    }
    return parseRowsFromRaw(raw)
  }

  const isMissingRouteError = (error) => {
    const status = Number(error?.status ?? 0)
    if (status === 404 || status === 405) return true
    const message = String(error?.message ?? '').toUpperCase()
    return message.includes('HTTP 404') || message.includes('HTTP 405')
  }

  const dedupeByKey = (list, keyBuilder) => {
    const arr = Array.isArray(list) ? list : []
    const seen = new Set()
    const out = []
    for (const item of arr) {
      if (!item) continue
      const key = keyBuilder(item)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
    return out
  }

  const dedupeByCpf = (list) => {
    const arr = Array.isArray(list) ? list : []
    const seen = new Set()
    const out = []
    for (const item of arr) {
      const cpf = String(item?.cpf ?? '').replace(/\D/g, '')
      if (cpf.length === 11) {
        if (seen.has(cpf)) continue
        seen.add(cpf)
      }
      out.push(item)
    }
    return out
  }

  const getStatusToken = (row) => String(
    row?.status_consulta ??
    row?.status_consulta_prata ??
    row?.status_consulta_v8 ??
    row?.status_consulta_hand ??
    row?.status ??
    row?.status_api ??
    row?.status_presenca ??
    row?.situacao ??
    row?.final_status ??
    ''
  ).trim()

  const getStatusTooltip = (row) => {
    const raw = String(
      row?.status_consulta ??
      row?.status_consulta_prata ??
      row?.status_consulta_v8 ??
      row?.status_consulta_hand ??
      row?.status ??
      row?.status_api ??
      row?.status_presenca ??
      row?.situacao ??
      row?.final_status ??
      ''
    ).trim()

    return raw || '(vazio)'
  }

  const getTimestampValue = (row) => String(
    row?.data_hora_registro ??
    row?.updated_at ??
    row?.created_at ??
    row?.data_hora ??
    row?.data ??
    row?.timestamp ??
    row?.createdAt ??
    ''
  ).trim()

  const sortByLatest = (list) => {
    const arr = Array.isArray(list) ? [...list] : []
    return arr.sort((a, b) => {
      const ta = new Date(getTimestampValue(a)).getTime()
      const tb = new Date(getTimestampValue(b)).getTime()
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })
  }

  const setLogsLoading = (source, value) => {
    setLoadingLogsBySource((prev) => ({ ...prev, [source]: value }))
  }

  const setLogsError = (source, value) => {
    setLogsErrorBySource((prev) => ({ ...prev, [source]: value }))
  }

  const setLogsData = (source, value) => {
    setLogsBySource((prev) => ({ ...prev, [source]: value }))
  }

  const fetchLogsIn100 = async () => {
    if (!user?.id) return
    if (!ENABLE_IN100_API) {
      setLogsData(LOG_SOURCE.IN100, [])
      setLogsError(LOG_SOURCE.IN100, '')
      return
    }
    if (dashboardConsultasAvailableRef.current === false) {
      setLogsData(LOG_SOURCE.IN100, [])
      setLogsError(LOG_SOURCE.IN100, '')
      return
    }
    setLogsLoading(LOG_SOURCE.IN100, true)
    setLogsError(LOG_SOURCE.IN100, '')
    try {
      const rows = await fetchRowsFromUrl(buildLegacyRequestUrl(IN100_CONSULTAS_GET_API_URL))
      const deduped = dedupeByKey(rows, (item) => {
        const cpf = String(item?.numero_documento ?? '').replace(/\D/g, '')
        const nb = String(item?.numero_beneficio ?? '').replace(/\D/g, '')
        return [
          getTimestampValue(item),
          getStatusToken(item),
          String(item?.resposta_api ?? '').trim(),
          cpf,
          nb
        ].join('|')
      })
      const normalized = sortByLatest(deduped).map((item) => ({
        timestamp: getTimestampValue(item),
        status: getStatusToken(item),
        statusTooltip: getStatusTooltip(item),
        detail: String(item?.resposta_api ?? '').trim() || '-',
        cpf: String(item?.numero_documento ?? ''),
        nb: String(item?.numero_beneficio ?? '')
      }))
      setLogsData(LOG_SOURCE.IN100, dedupeByCpf(normalized).slice(0, 10))
    } catch (e) {
      if (isMissingRouteError(e)) {
        dashboardConsultasAvailableRef.current = false
      }
      setLogsData(LOG_SOURCE.IN100, [])
      setLogsError(LOG_SOURCE.IN100, isMissingRouteError(e) ? '' : (e?.message || 'Erro ao carregar'))
    } finally {
      setLogsLoading(LOG_SOURCE.IN100, false)
    }
  }

  const fetchLogsV8 = async () => {
    if (!user?.id) return
    if (dashboardConsultasAvailableRef.current === false) {
      setLogsData(LOG_SOURCE.V8, [])
      setLogsError(LOG_SOURCE.V8, '')
      return
    }
    setLogsLoading(LOG_SOURCE.V8, true)
    setLogsError(LOG_SOURCE.V8, '')
    try {
      const rows = await fetchRowsFromUrl(buildLegacyRequestUrl(V8_CONSULTAS_FALLBACK_API_URL))
      const scopedRows = applyLastConsultasScope(rows)
      const deduped = dedupeByKey(scopedRows, (item) => {
        const cpf = String(item?.cliente_cpf ?? item?.cpf ?? '').replace(/\D/g, '')
        return [
          getTimestampValue(item),
          getStatusToken(item),
          String(item?.cliente_nome ?? item?.nome ?? '').trim(),
          cpf
        ].join('|')
      })
      const normalized = sortByLatest(deduped).map((item) => ({
        timestamp: getTimestampValue(item),
        status: getStatusToken(item),
        statusTooltip: getStatusTooltip(item),
        detail: String(item?.cliente_nome ?? item?.nome ?? item?.descricao ?? item?.tipoConsulta ?? '-').trim() || '-',
        cpf: String(item?.cliente_cpf ?? item?.cpf ?? ''),
        nb: String(item?.valor_liberado ?? item?.valorLiberado ?? item?.valor ?? item?.numero_beneficio ?? item?.nb ?? '')
      }))
      setLogsData(LOG_SOURCE.V8, dedupeByCpf(normalized).slice(0, 10))
    } catch (e) {
      if (isMissingRouteError(e)) {
        dashboardConsultasAvailableRef.current = false
      }
      setLogsData(LOG_SOURCE.V8, [])
      setLogsError(LOG_SOURCE.V8, isMissingRouteError(e) ? '' : (e?.message || 'Erro ao carregar'))
    } finally {
      setLogsLoading(LOG_SOURCE.V8, false)
    }
  }

  const fetchLogsPrata = async () => {
    if (!user?.id) return
    if (!ENABLE_PRATA_API) {
      setLogsData(LOG_SOURCE.PRATA, [])
      setLogsError(LOG_SOURCE.PRATA, '')
      return
    }
    if (dashboardConsultasAvailableRef.current === false) {
      setLogsData(LOG_SOURCE.PRATA, [])
      setLogsError(LOG_SOURCE.PRATA, '')
      return
    }
    setLogsLoading(LOG_SOURCE.PRATA, true)
    setLogsError(LOG_SOURCE.PRATA, '')
    try {
      const rows = await fetchRowsFromUrl(buildLegacyRequestUrl(PRATA_CONSULTAS_GET_API_URL))
      const deduped = dedupeByKey(rows, (item) => {
        const cpf = String(item?.cliente_cpf ?? item?.cpf ?? '').replace(/\D/g, '')
        return [
          getTimestampValue(item),
          getStatusToken(item),
          String(item?.cliente_nome ?? item?.nome ?? '').trim(),
          cpf
        ].join('|')
      })
      const normalized = sortByLatest(deduped).map((item) => ({
        timestamp: getTimestampValue(item),
        status: getStatusToken(item),
        statusTooltip: getStatusTooltip(item),
        detail: String(item?.cliente_nome ?? item?.nome ?? item?.descricao ?? item?.tipoConsulta ?? '-').trim() || '-',
        cpf: String(item?.cliente_cpf ?? item?.cpf ?? ''),
        nb: String(item?.valor_liberado ?? item?.valorLiberado ?? item?.valor ?? item?.margem_total_disponivel ?? item?.margem_disponivel ?? item?.numero_beneficio ?? item?.nb ?? '')
      }))
      setLogsData(LOG_SOURCE.PRATA, dedupeByCpf(normalized).slice(0, 10))
    } catch (e) {
      if (isMissingRouteError(e)) {
        dashboardConsultasAvailableRef.current = false
      }
      setLogsData(LOG_SOURCE.PRATA, [])
      setLogsError(LOG_SOURCE.PRATA, isMissingRouteError(e) ? '' : (e?.message || 'Erro ao carregar'))
    } finally {
      setLogsLoading(LOG_SOURCE.PRATA, false)
    }
  }

  const fetchLogsPresenca = async () => {
    if (!user?.id) return
    if (!ENABLE_PRESENCA_API) {
      setLogsData(LOG_SOURCE.PRESENCA, [])
      setLogsError(LOG_SOURCE.PRESENCA, '')
      return
    }
    if (dashboardConsultasAvailableRef.current === false) {
      setLogsData(LOG_SOURCE.PRESENCA, [])
      setLogsError(LOG_SOURCE.PRESENCA, '')
      return
    }
    setLogsLoading(LOG_SOURCE.PRESENCA, true)
    setLogsError(LOG_SOURCE.PRESENCA, '')
    try {
      const rows = await fetchRowsFromUrl(buildLegacyRequestUrl(PRESENCA_CONSULTAS_GET_API_URL))
      const deduped = dedupeByKey(rows, (item) => {
        const cpf = String(item?.cpf ?? item?.cliente_cpf ?? item?.numero_documento ?? '').replace(/\D/g, '')
        return [
          getTimestampValue(item),
          getStatusToken(item),
          String(item?.nome ?? item?.cliente_nome ?? '').trim(),
          cpf
        ].join('|')
      })
      const normalized = sortByLatest(deduped).map((item) => ({
        timestamp: getTimestampValue(item),
        status: getStatusToken(item),
        statusTooltip: getStatusTooltip(item),
        detail: String(item?.nome ?? item?.cliente_nome ?? item?.tipoConsulta ?? '-').trim() || '-',
        cpf: String(item?.cpf ?? item?.cliente_cpf ?? item?.numero_documento ?? ''),
        nb: String(item?.valorMargemDisponivel ?? item?.valor_margem_disponivel ?? item?.valorMargem ?? item?.numero_beneficio ?? item?.nb ?? '')
      }))
      setLogsData(LOG_SOURCE.PRESENCA, dedupeByCpf(normalized).slice(0, 10))
    } catch (e) {
      if (isMissingRouteError(e)) {
        dashboardConsultasAvailableRef.current = false
      }
      setLogsData(LOG_SOURCE.PRESENCA, [])
      setLogsError(LOG_SOURCE.PRESENCA, isMissingRouteError(e) ? '' : (e?.message || 'Erro ao carregar'))
    } finally {
      setLogsLoading(LOG_SOURCE.PRESENCA, false)
    }
  }

  const fetchLogsHandMais = async () => {
    if (!user?.id) return
    if (dashboardConsultasAvailableRef.current === false) {
      setLogsData(LOG_SOURCE.HANDMAIS, [])
      setLogsError(LOG_SOURCE.HANDMAIS, '')
      return
    }
    setLogsLoading(LOG_SOURCE.HANDMAIS, true)
    setLogsError(LOG_SOURCE.HANDMAIS, '')
    try {
      const rows = await fetchRowsFromUrl(buildLegacyRequestUrl(HANDMAIS_CONSULTAS_FALLBACK_API_URL))
      const scopedRows = applyLastConsultasScope(rows)
      const deduped = dedupeByKey(scopedRows, (item) => {
        const cpf = String(item?.cpf ?? item?.cliente_cpf ?? '').replace(/\D/g, '')
        return [
          getTimestampValue(item),
          getStatusToken(item),
          String(item?.nome ?? item?.cliente_nome ?? '').trim(),
          cpf,
          String(item?.valor_margem ?? item?.valorMargem ?? '').trim(),
        ].join('|')
      })
      const normalized = sortByLatest(deduped).map((item) => ({
        timestamp: getTimestampValue(item),
        status: getStatusToken(item),
        statusTooltip: getStatusTooltip(item),
        detail: String(item?.nome ?? item?.cliente_nome ?? item?.descricao ?? item?.tipoConsulta ?? '-').trim() || '-',
        cpf: String(item?.cpf ?? item?.cliente_cpf ?? ''),
        nb: String(item?.valor_margem ?? item?.valorMargem ?? ''),
      }))
      setLogsData(LOG_SOURCE.HANDMAIS, dedupeByCpf(normalized).slice(0, 10))
    } catch (e) {
      if (isMissingRouteError(e)) {
        dashboardConsultasAvailableRef.current = false
      }
      setLogsData(LOG_SOURCE.HANDMAIS, [])
      setLogsError(LOG_SOURCE.HANDMAIS, isMissingRouteError(e) ? '' : (e?.message || 'Erro ao carregar'))
    } finally {
      setLogsLoading(LOG_SOURCE.HANDMAIS, false)
    }
  }

  const fetchLogsBySource = async (source) => {
    if (source === LOG_SOURCE.V8) return fetchLogsV8()
    if (source === LOG_SOURCE.PRATA) return fetchLogsPrata()
    if (source === LOG_SOURCE.PRESENCA) return fetchLogsPresenca()
    if (source === LOG_SOURCE.HANDMAIS) return fetchLogsHandMais()
    return fetchLogsIn100()
  }

  useEffect(() => {
    if (news.length === 0) return undefined
    const id = setInterval(() => setCurrent((i) => (i + 1) % news.length), 15000)
    return () => clearInterval(id)
  }, [news.length])

  useEffect(() => {
    if (!user?.id) return
    if (initialFetchUserRef.current === user.id) return
    initialFetchUserRef.current = user.id

    fetchSaldo()
    fetchSaldoV8()
    fetchSaldoPrata()
    fetchSaldoPresenca()
    fetchSaldoHandMais()
    fetchLogsBySource(activeLogsSource)
  }, [user])

  const fmtCpf = (v) => {
    const d = String(v ?? '').replace(/\D/g, '')
    if (d.length !== 11) return d || '-'
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  const fmtNb = (v) => {
    const d = String(v ?? '').replace(/\D/g, '')
    if (d.length !== 10) return d || '-'
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  const fmtHoraSP = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    if (Number.isNaN(d)) return '-'
    d.setHours(d.getHours() + 3)
    return d.toLocaleTimeString('pt-BR', { hour12: false })
  }

  const card = news[current]
  const bgStyle = card?.image
    ? {
        backgroundImage: `url(${card.image})`,
        backgroundSize: card?.imageFit === 'contain' ? 'contain' : 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundColor: card?.imageBackground || 'rgba(255, 255, 255, 0.04)'
      }
    : {}

  const sourceMeta = {
    [LOG_SOURCE.IN100]: {
      title: 'Últimas consultas IN100'
    },
    [LOG_SOURCE.V8]: {
      title: 'Últimas consultas V8'
    },
    [LOG_SOURCE.PRATA]: {
      title: 'Últimas consultas Prata'
    },
    [LOG_SOURCE.PRESENCA]: {
      title: 'Últimas consultas Presença'
    },
    [LOG_SOURCE.HANDMAIS]: {
      title: 'Últimas consultas Hand+'
    }
  }
  const rightColumnMeta = {
    [LOG_SOURCE.IN100]: { label: 'NB', copyLabel: 'NB copiado!', copyTitle: 'Copiar NB' },
    [LOG_SOURCE.V8]: { label: 'Valor liberado', copyLabel: 'Valor liberado copiado!', copyTitle: 'Copiar valor liberado' },
    [LOG_SOURCE.PRATA]: { label: 'Valor liberado', copyLabel: 'Valor liberado copiado!', copyTitle: 'Copiar valor liberado' },
    [LOG_SOURCE.PRESENCA]: { label: 'Margem disponível', copyLabel: 'Margem disponível copiada!', copyTitle: 'Copiar margem disponível' },
    [LOG_SOURCE.HANDMAIS]: { label: 'Valor margem', copyLabel: 'Valor margem copiado!', copyTitle: 'Copiar valor margem' }
  }

  const activeRows = logsBySource[activeLogsSource] || []
  const activeLoading = Boolean(loadingLogsBySource[activeLogsSource])
  const activeError = String(logsErrorBySource[activeLogsSource] || '')
  const activeRightMeta = rightColumnMeta[activeLogsSource] || rightColumnMeta[LOG_SOURCE.IN100]

  const handleSelectLogsSource = (source) => {
    setActiveLogsSource(source)
    const hasLoaded = Array.isArray(logsBySource[source]) && logsBySource[source].length > 0
    const isLoading = Boolean(loadingLogsBySource[source])
    if (!hasLoaded && !isLoading) fetchLogsBySource(source)
  }

  const getStatusBadgeClass = (status, detail) => {
    const token = String(status ?? '').trim().toLowerCase()
    const detailToken = String(detail ?? '').trim().toLowerCase()
    if (token.includes('sucesso') || token.includes('conclu') || token === 'ok' || token.includes('presente') || token.includes('consultad')) return 'text-bg-success'
    if (token.includes('pend') || token.includes('process') || token.includes('aguard') || detailToken.includes('pendente')) return 'text-bg-warning'
    if (token.includes('erro') || token.includes('falha') || token.includes('reprov') || token.includes('ausente')) return 'text-bg-danger'
    return 'text-bg-secondary'
  }

  const fmtMoneyBRL = (value) => {
    const raw = String(value ?? '').trim()
    if (!raw) return '-'
    const onlyThousandsWithDot = /^\d{1,3}(\.\d{3})+$/.test(raw)
    const normalized = raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : (onlyThousandsWithDot ? raw.replace(/\./g, '') : raw)
    const numeric = Number(normalized)
    if (!Number.isFinite(numeric)) return raw
    return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const fmtLastColumn = (value, source) => {
    if (source === LOG_SOURCE.IN100) return fmtNb(value)
    return fmtMoneyBRL(value)
  }

  const dashboardRows = [
    {
      source: LOG_SOURCE.IN100,
      nome: 'IN100',
      saldo: Number(saldo?.disponivel ?? 0),
      disponiveis: Number(saldo?.disponivel ?? 0),
      realizadas: Number(saldo?.realizadas ?? 0)
    },
    {
      source: LOG_SOURCE.V8,
      nome: 'V8 Bank',
      saldo: Number(saldoV8?.total ?? 0),
      disponiveis: Number(saldoV8?.restantes ?? 0),
      realizadas: Number(saldoV8?.usado ?? 0)
    },
    {
      source: LOG_SOURCE.PRATA,
      nome: 'Prata',
      saldo: Number(saldoPrata?.total ?? 0),
      disponiveis: Number(saldoPrata?.restantes ?? 0),
      realizadas: Number(saldoPrata?.usado ?? 0)
    },
    {
      source: LOG_SOURCE.HANDMAIS,
      nome: 'Hand+',
      saldo: Number(saldoHandMais?.total ?? 0),
      disponiveis: Number(saldoHandMais?.restantes ?? 0),
      realizadas: Number(saldoHandMais?.usado ?? 0)
    },
    {
      source: LOG_SOURCE.PRESENCA,
      nome: 'Presença',
      saldo: Number(saldoPresenca?.total ?? 0),
      disponiveis: Number(saldoPresenca?.restantes ?? 0),
      realizadas: Number(saldoPresenca?.usado ?? 0)
    }
  ]

  const renderSaldoPanel = () => {
    if (activeLogsSource === LOG_SOURCE.V8) {
      return (
        <>
          <div className="small text-uppercase opacity-75">Saldo V8</div>
          <div className="d-flex align-items-center gap-2">
            <div className="display-5 fw-bold mb-0">{saldoV8.total}</div>
            {loadingSaldoV8 && <div className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>}
          </div>
          <div className="small opacity-75">Limite total disponível para consultas V8.</div>
          <div className="mt-2 d-flex gap-3 flex-wrap">
            <div>
              <div className="small text-uppercase opacity-75">Usado</div>
              <div className="fw-semibold">{saldoV8.usado}</div>
            </div>
            <div>
              <div className="small text-uppercase opacity-75">Restante</div>
              <div className="fw-semibold">{saldoV8.restantes}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-3"
            onClick={fetchSaldoV8}
            disabled={loadingSaldoV8}
          >
            Atualizar saldo V8
          </button>
        </>
      )
    }

    if (activeLogsSource === LOG_SOURCE.PRATA) {
      return (
        <>
          <div className="small text-uppercase opacity-75">Saldo Prata</div>
          <div className="d-flex align-items-center gap-2">
            <div className="display-5 fw-bold mb-0">{saldoPrata.total}</div>
            {loadingSaldoPrata && <div className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>}
          </div>
          <div className="small opacity-75">Limite total disponível para consultas Prata.</div>
          <div className="mt-2 d-flex gap-3 flex-wrap">
            <div>
              <div className="small text-uppercase opacity-75">Usado</div>
              <div className="fw-semibold">{saldoPrata.usado}</div>
            </div>
            <div>
              <div className="small text-uppercase opacity-75">Restante</div>
              <div className="fw-semibold">{saldoPrata.restantes}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-3"
            onClick={fetchSaldoPrata}
            disabled={loadingSaldoPrata}
          >
            Atualizar saldo Prata
          </button>
        </>
      )
    }

    if (activeLogsSource === LOG_SOURCE.HANDMAIS) {
      return (
        <>
          <div className="small text-uppercase opacity-75">Saldo Hand+</div>
          <div className="d-flex align-items-center gap-2">
            <div className="display-5 fw-bold mb-0">{saldoHandMais.total}</div>
            {loadingSaldoHandMais && <div className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>}
          </div>
          <div className="small opacity-75">Limite total disponível para consultas Hand+.</div>
          <div className="mt-2 d-flex gap-3 flex-wrap">
            <div>
              <div className="small text-uppercase opacity-75">Usado</div>
              <div className="fw-semibold">{saldoHandMais.usado}</div>
            </div>
            <div>
              <div className="small text-uppercase opacity-75">Restante</div>
              <div className="fw-semibold">{saldoHandMais.restantes}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-3"
            onClick={fetchSaldoHandMais}
            disabled={loadingSaldoHandMais}
          >
            Atualizar saldo Hand+
          </button>
        </>
      )
    }

    if (activeLogsSource === LOG_SOURCE.PRESENCA) {
      return (
        <>
          <div className="small text-uppercase opacity-75">Saldo Presença</div>
          <div className="d-flex align-items-center gap-2">
            <div className="display-5 fw-bold mb-0">{saldoPresenca.total}</div>
            {loadingSaldoPresenca && <div className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>}
          </div>
          <div className="small opacity-75">Limite total disponível para consultas Presença.</div>
          <div className="mt-2 d-flex gap-3 flex-wrap">
            <div>
              <div className="small text-uppercase opacity-75">Usado</div>
              <div className="fw-semibold">{saldoPresenca.usado}</div>
            </div>
            <div>
              <div className="small text-uppercase opacity-75">Restante</div>
              <div className="fw-semibold">{saldoPresenca.restantes}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-3"
            onClick={fetchSaldoPresenca}
            disabled={loadingSaldoPresenca}
          >
            Atualizar saldo Presença
          </button>
        </>
      )
    }

    return (
      <>
        <div className="small text-uppercase opacity-75">Saldo IN100 (equipe/usuário)</div>
        <div className="d-flex align-items-center gap-2">
          <div className="display-5 fw-bold mb-0">{Number(saldo.disponivel ?? 0)}</div>
          {loadingSaldo && <div className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>}
        </div>
        <div className="small opacity-75">Disponível para consultas IN100.</div>
        <div className="mt-2 d-flex gap-3 flex-wrap">
          <div>
            <div className="small text-uppercase opacity-75">Realizadas</div>
            <div className="fw-semibold">{saldo.realizadas}</div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-3"
          onClick={fetchSaldo}
          disabled={loadingSaldo}
        >
          Atualizar saldo
        </button>
      </>
    )
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1 dashboard-php dashboard-v2">
        <div className="d-flex align-items-baseline justify-content-between mb-4">
          <div>
            <h2 className="fw-bold mb-1">Dashboard</h2>
          </div>
        </div>

        <section className="row g-3 mb-3">
          <div className="col-12 col-lg-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small opacity-75 text-uppercase mb-3">Informações usuário</div>
              <div className="d-flex flex-column gap-2">
                <div><span className="opacity-75">Perfil:</span> <span className="fw-semibold">{role}</span></div>
                <div><span className="opacity-75">Equipe:</span> <span className="fw-semibold">{user?.equipe_nome ?? user?.team_name ?? '-'}</span></div>
                <div><span className="opacity-75">Último acesso:</span> <span className="fw-semibold">{formatLastAccess(user?.data_ultimo_login ?? user?.lastLogin)}</span></div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small opacity-75 text-uppercase mb-2">Últimas novidades</div>
              {card ? (
                <div className="d-flex gap-3 align-items-start">
                  <div className="dashboard-v2-news-thumb" style={bgStyle} />
                  <div>
                    <div className="small opacity-75 mb-1">{card.data}</div>
                    <h5 className="fw-bold mb-1">{card.titulo}</h5>
                    <p className="mb-0 opacity-85">{card.descricao}</p>
                  </div>
                </div>
              ) : (
                <div className="opacity-75 small">Sem novidades disponíveis no momento.</div>
              )}
            </div>
          </div>
        </section>

        <section className="row g-3 align-items-start dashboard-main-grid">
          <div className="col-12 col-xl-7 dashboard-main-left">
            <div className="neo-card neo-lg p-3 p-lg-4 h-100">
              <div className="small opacity-75 text-uppercase mb-3">Sistemas (saldo)</div>
              <div className="table-responsive dashboard-v2-summary-table">
                <table className="table table-dark table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Saldo</th>
                      <th>Disponíveis</th>
                      <th>Realizadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardRows.map((row) => (
                      <tr
                        key={row.source}
                        className={activeLogsSource === row.source ? 'is-active' : ''}
                        onClick={() => handleSelectLogsSource(row.source)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="fw-semibold">{row.nome}</td>
                        <td>{Number.isFinite(row.saldo) ? row.saldo.toLocaleString('pt-BR') : '-'}</td>
                        <td>{Number.isFinite(row.disponiveis) ? row.disponiveis.toLocaleString('pt-BR') : '-'}</td>
                        <td>{Number.isFinite(row.realizadas) ? row.realizadas.toLocaleString('pt-BR') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-5 dashboard-main-right">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div>
                  <div className="small text-uppercase opacity-75">Top 10 consultas</div>
                  <div className="fw-semibold">{sourceMeta[activeLogsSource]?.title || 'Últimas consultas'}</div>
                  <div className="fw-semibold">Exibindo até 10 mais recentes</div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fetchLogsBySource(activeLogsSource)} disabled={activeLoading}>
                  {activeLoading ? 'Atualizando...' : 'Atualizar lista'}
                </button>
              </div>
              {activeError && <div className="alert alert-danger py-2 px-3 mb-3 small">{activeError}</div>}
              <div className="table-responsive">
                <table className="table table-dark table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: '12%' }}>Hora</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '26%' }}>Pesquisa</th>
                      <th style={{ width: '25%' }}>CPF</th>
                      <th style={{ width: '25%' }}>{activeRightMeta.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeRows && activeRows.length > 0 ? activeRows : activeLoading ? Array.from({ length: 3 }) : []).map((log, idx) => (
                      <tr key={idx}>
                        <td className="small">
                          {log ? fmtHoraSP(log.timestamp) : <span className="placeholder col-8" />}
                        </td>
                        <td className="small">
                          {log ? (
                            <span
                              className={`badge rounded-pill px-2 status-badge ${getStatusBadgeClass(log?.status, log?.detail)}`}
                              title={String(log?.statusTooltip ?? log?.status ?? '(vazio)')}
                              aria-label={String(log?.statusTooltip ?? log?.status ?? '(vazio)')}
                            >
                              i
                            </span>
                          ) : (
                            <span className="placeholder col-6" />
                          )}
                        </td>
                        <td className="small">{log ? (log.detail || '-') : <span className="placeholder col-10" />}</td>
                        <td className="small">
                          {log ? (
                            <button
                              type="button"
                              className="btn btn-link p-0 text-reset"
                              onClick={() => copyToClipboard(log.cpf, 'CPF copiado!')}
                              title="Copiar CPF"
                            >
                              {fmtCpf(log.cpf)}
                            </button>
                          ) : (
                            <span className="placeholder col-6" />
                          )}
                        </td>
                        <td className="small">
                          {log ? (
                            activeLogsSource === LOG_SOURCE.IN100 ? (
                              <button
                                type="button"
                                className="btn btn-link p-0 text-reset"
                                onClick={() => copyToClipboard(log.nb, activeRightMeta.copyLabel)}
                                title={activeRightMeta.copyTitle}
                              >
                                {fmtLastColumn(log.nb, activeLogsSource)}
                              </button>
                            ) : (
                              <span>{fmtLastColumn(log.nb, activeLogsSource)}</span>
                            )
                          ) : (
                            <span className="placeholder col-6" />
                          )}
                        </td>
                      </tr>
                    ))}
                    {!activeLoading && (!activeRows || activeRows.length === 0) && (
                      <tr>
                        <td className="small" colSpan={5}>Nenhuma consulta encontrada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  )
}


