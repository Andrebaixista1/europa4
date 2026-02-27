import { useEffect, useMemo, useState } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { novidadesList } from '../components/NovidadesModal.jsx'
import { Roles } from '../utils/roles.js'
import { notify } from '../utils/notify.js'

const V8_LIMITES_GET_API_URL = 'https://n8n.apivieiracred.store/webhook/api/getconsulta-v8/'
const V8_CONSULTAS_GET_API_URL = 'https://n8n.apivieiracred.store/webhook/api/consulta-v8/'
const PRESENCA_LIMITES_GET_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-limite/'
const PRESENCA_CONSULTAS_GET_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank/'
const LOG_SOURCE = {
  IN100: 'in100',
  V8: 'v8',
  PRESENCA: 'presenca'
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
  const [saldoPresenca, setSaldoPresenca] = useState({ total: '-', usado: '-', restantes: '-' })
  const [loadingSaldoPresenca, setLoadingSaldoPresenca] = useState(false)
  const [activeLogsSource, setActiveLogsSource] = useState(LOG_SOURCE.IN100)
  const [logsBySource, setLogsBySource] = useState({
    [LOG_SOURCE.IN100]: [],
    [LOG_SOURCE.V8]: [],
    [LOG_SOURCE.PRESENCA]: []
  })
  const [loadingLogsBySource, setLoadingLogsBySource] = useState({
    [LOG_SOURCE.IN100]: false,
    [LOG_SOURCE.V8]: false,
    [LOG_SOURCE.PRESENCA]: false
  })
  const [logsErrorBySource, setLogsErrorBySource] = useState({
    [LOG_SOURCE.IN100]: '',
    [LOG_SOURCE.V8]: '',
    [LOG_SOURCE.PRESENCA]: ''
  })
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
    setLoadingSaldo(true)
    try {
      const payload = buildSaldoPayload()
      const res = await fetch('https://n8n.apivieiracred.store/webhook/get-saldos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (!data) return
      const num = (val) => Number(val ?? 0)
      const arr = Array.isArray(data) ? data : [data]
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
    } catch (_) {
      /* silencioso */
    } finally {
      setLoadingSaldo(false)
    }
  }

  const toNumberOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  const normalizeRows = (payload) => {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.rows)) return payload.rows
    if (payload && typeof payload === 'object') return [payload]
    return []
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
      const requestUrl = new URL(V8_LIMITES_GET_API_URL)
      requestUrl.searchParams.set('id_user', String(user?.id))
      const equipeId = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
      if (equipeId !== null && equipeId !== undefined && equipeId !== '') {
        requestUrl.searchParams.set('equipe_id', String(equipeId))
      }

      const roleId = user?.id_role ?? user?.role_id ?? user?.roleId ?? user?.level ?? null
      const roleLabel = String(user?.role ?? '').trim()
      const hierarchyLevel = user?.nivel_hierarquia ?? user?.NivelHierarquia ?? user?.level ?? roleId

      if (roleId !== null && roleId !== undefined && roleId !== '') {
        requestUrl.searchParams.set('id_role', String(roleId))
        requestUrl.searchParams.set('role_id', String(roleId))
      }
      if (roleLabel) {
        requestUrl.searchParams.set('role', roleLabel)
        requestUrl.searchParams.set('hierarquia', roleLabel)
      }
      if (hierarchyLevel !== null && hierarchyLevel !== undefined && hierarchyLevel !== '') {
        requestUrl.searchParams.set('nivel_hierarquia', String(hierarchyLevel))
      }

      const response = await fetch(requestUrl.toString(), { method: 'GET' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json().catch(() => ({}))
      const rows = normalizeRows(payload)
      setSaldoV8(buildV8SummaryFromRows(rows))
    } catch (_) {
      setSaldoV8({ total: '-', usado: '-', restantes: '-' })
    } finally {
      setLoadingSaldoV8(false)
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

  const fetchSaldoPresenca = async () => {
    if (!user?.id) return
    setLoadingSaldoPresenca(true)
    try {
      const requestUrl = new URL(PRESENCA_LIMITES_GET_API_URL)
      requestUrl.searchParams.set('id_user', String(user.id))
      const equipeId = resolveUserEquipeId(user)
      if (equipeId !== null) requestUrl.searchParams.set('equipe_id', String(equipeId))
      const roleLabel = String(user?.role ?? '').trim()
      const hierarchyLevel = user?.nivel_hierarquia ?? user?.NivelHierarquia ?? user?.level ?? ''
      if (roleLabel) {
        requestUrl.searchParams.set('role', roleLabel)
        requestUrl.searchParams.set('hierarquia', roleLabel)
      }
      if (hierarchyLevel !== null && hierarchyLevel !== undefined && hierarchyLevel !== '') {
        requestUrl.searchParams.set('nivel_hierarquia', String(hierarchyLevel))
      }

      const response = await fetch(requestUrl.toString(), { method: 'GET' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json().catch(() => ({}))
      const rows = normalizeRows(payload)
      setSaldoPresenca(buildPresencaSummaryFromRows(rows))
    } catch (_) {
      setSaldoPresenca({ total: '-', usado: '-', restantes: '-' })
    } finally {
      setLoadingSaldoPresenca(false)
    }
  }

  const mapNivel = (r) => {
    if (r === Roles.Master) return 'master'
    if (r === Roles.Administrador) return 'adm'
    if (r === Roles.Supervisor) return 'super'
    return 'operador'
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
    row?.status ??
    row?.status_api ??
    row?.status_consulta_v8 ??
    row?.status_presenca ??
    row?.situacao ??
    row?.final_status ??
    ''
  ).trim()

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
    setLogsLoading(LOG_SOURCE.IN100, true)
    setLogsError(LOG_SOURCE.IN100, '')
    try {
      const equipeId = resolveUserEquipeId(user)
      const payload = { id: user.id, equipe_id: equipeId, nivel: mapNivel(user?.role) }
      const res = await fetch('https://n8n.apivieiracred.store/webhook/consulta-logs-in100', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(payload)
      })
      const raw = await res.text().catch(() => '')
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      const arr = parseRowsFromRaw(raw)
      const deduped = dedupeByKey(arr, (item) => {
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
        detail: String(item?.resposta_api ?? '').trim() || '-',
        cpf: String(item?.numero_documento ?? ''),
        nb: String(item?.numero_beneficio ?? '')
      }))
      setLogsData(LOG_SOURCE.IN100, dedupeByCpf(normalized).slice(0, 10))
    } catch (e) {
      setLogsData(LOG_SOURCE.IN100, [])
      setLogsError(LOG_SOURCE.IN100, e?.message || 'Erro ao carregar')
    } finally {
      setLogsLoading(LOG_SOURCE.IN100, false)
    }
  }

  const fetchLogsV8 = async () => {
    if (!user?.id) return
    setLogsLoading(LOG_SOURCE.V8, true)
    setLogsError(LOG_SOURCE.V8, '')
    try {
      const requestUrl = new URL(V8_CONSULTAS_GET_API_URL)
      requestUrl.searchParams.set('id_user', String(user.id))
      const equipeId = resolveUserEquipeId(user)
      if (equipeId !== null) requestUrl.searchParams.set('equipe_id', String(equipeId))
      const roleId = resolveUserRoleId(user)
      const roleLabel = String(user?.role ?? '').trim()
      const hierarchyLevel = user?.nivel_hierarquia ?? user?.NivelHierarquia ?? user?.level ?? roleId
      if (roleId !== null && roleId !== undefined && roleId !== '') {
        requestUrl.searchParams.set('id_role', String(roleId))
        requestUrl.searchParams.set('role_id', String(roleId))
      }
      if (roleLabel) {
        requestUrl.searchParams.set('role', roleLabel)
        requestUrl.searchParams.set('hierarquia', roleLabel)
      }
      if (hierarchyLevel !== null && hierarchyLevel !== undefined && hierarchyLevel !== '') {
        requestUrl.searchParams.set('nivel_hierarquia', String(hierarchyLevel))
      }
      if (Number(user?.id) === 1) requestUrl.searchParams.set('all', '1')

      const response = await fetch(requestUrl.toString(), { method: 'GET' })
      const raw = await response.text().catch(() => '')
      if (!response.ok) throw new Error(raw || `HTTP ${response.status}`)
      const rows = parseRowsFromRaw(raw)
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
        detail: String(item?.cliente_nome ?? item?.nome ?? item?.descricao ?? item?.tipoConsulta ?? '-').trim() || '-',
        cpf: String(item?.cliente_cpf ?? item?.cpf ?? ''),
        nb: String(item?.valor_liberado ?? item?.valorLiberado ?? item?.valor ?? item?.numero_beneficio ?? item?.nb ?? '')
      }))
      setLogsData(LOG_SOURCE.V8, dedupeByCpf(normalized).slice(0, 10))
    } catch (e) {
      setLogsData(LOG_SOURCE.V8, [])
      setLogsError(LOG_SOURCE.V8, e?.message || 'Erro ao carregar')
    } finally {
      setLogsLoading(LOG_SOURCE.V8, false)
    }
  }

  const fetchLogsPresenca = async () => {
    if (!user?.id) return
    setLogsLoading(LOG_SOURCE.PRESENCA, true)
    setLogsError(LOG_SOURCE.PRESENCA, '')
    try {
      const requestUrl = new URL(PRESENCA_CONSULTAS_GET_API_URL)
      const equipeId = resolveUserEquipeId(user)
      requestUrl.searchParams.set('id_user', String(user.id))
      if (equipeId !== null) requestUrl.searchParams.set('equipe_id', String(equipeId))
      const roleLabel = String(user?.role ?? '').trim()
      const hierarchyLevel = user?.nivel_hierarquia ?? user?.NivelHierarquia ?? user?.level ?? ''
      if (roleLabel) {
        requestUrl.searchParams.set('role', roleLabel)
        requestUrl.searchParams.set('hierarquia', roleLabel)
      }
      if (hierarchyLevel !== null && hierarchyLevel !== undefined && hierarchyLevel !== '') {
        requestUrl.searchParams.set('nivel_hierarquia', String(hierarchyLevel))
      }

      const response = await fetch(requestUrl.toString(), { method: 'GET' })
      const raw = await response.text().catch(() => '')
      if (!response.ok) throw new Error(raw || `HTTP ${response.status}`)
      const rows = parseRowsFromRaw(raw)
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
        detail: String(item?.nome ?? item?.cliente_nome ?? item?.tipoConsulta ?? '-').trim() || '-',
        cpf: String(item?.cpf ?? item?.cliente_cpf ?? item?.numero_documento ?? ''),
        nb: String(item?.valorMargemDisponivel ?? item?.valor_margem_disponivel ?? item?.valorMargem ?? item?.numero_beneficio ?? item?.nb ?? '')
      }))
      setLogsData(LOG_SOURCE.PRESENCA, dedupeByCpf(normalized).slice(0, 10))
    } catch (e) {
      setLogsData(LOG_SOURCE.PRESENCA, [])
      setLogsError(LOG_SOURCE.PRESENCA, e?.message || 'Erro ao carregar')
    } finally {
      setLogsLoading(LOG_SOURCE.PRESENCA, false)
    }
  }

  const fetchLogsBySource = async (source) => {
    if (source === LOG_SOURCE.V8) return fetchLogsV8()
    if (source === LOG_SOURCE.PRESENCA) return fetchLogsPresenca()
    return fetchLogsIn100()
  }

  useEffect(() => {
    if (news.length === 0) return undefined
    const id = setInterval(() => setCurrent((i) => (i + 1) % news.length), 15000)
    return () => clearInterval(id)
  }, [news.length])

  useEffect(() => {
    fetchSaldo()
    fetchSaldoV8()
    fetchSaldoPresenca()
    fetchLogsIn100()
    fetchLogsV8()
    fetchLogsPresenca()
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
    [LOG_SOURCE.PRESENCA]: {
      title: 'Últimas consultas Presença'
    }
  }
  const rightColumnMeta = {
    [LOG_SOURCE.IN100]: { label: 'NB', copyLabel: 'NB copiado!', copyTitle: 'Copiar NB' },
    [LOG_SOURCE.V8]: { label: 'Valor liberado', copyLabel: 'Valor liberado copiado!', copyTitle: 'Copiar valor liberado' },
    [LOG_SOURCE.PRESENCA]: { label: 'Margem disponível', copyLabel: 'Margem disponível copiada!', copyTitle: 'Copiar margem disponível' }
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

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-4">
          <div>
            <h2 className="fw-bold mb-1">Dashboard</h2>
            <div className="opacity-75 small">Bem-vindo(a), {user?.name} - Perfil: {role}</div>
          </div>
        </div>

        {news.length > 0 && (
          <section className="news-carousel">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div>
                <div className="small opacity-75 text-uppercase">Últimas novidades</div>
                <h5 className="mb-0">O que temos de mais novo na Europa</h5>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCurrent((i) => (i - 1 + news.length) % news.length)}
                  aria-label="Anterior"
                >
                  <FiChevronLeft />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCurrent((i) => (i + 1) % news.length)}
                  aria-label="Próximo"
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
            <div className="news-card">
              <div className="news-thumb" style={bgStyle} />
              <div className="news-card-body">
                <div className="small opacity-85">{card.data}</div>
                <h5 className="fw-bold mb-2">{card.titulo}</h5>
                <p className="mb-0 opacity-85">{card.descricao}</p>
              </div>
            </div>
            <div className="news-dots mt-3">
              {news.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`news-dot ${idx === current ? 'active' : ''}`}
                  onClick={() => setCurrent(idx)}
                  aria-label={`Ir para novidade ${idx + 1}`}
                />
              ))}
            </div>
          </section>
        )}

        <section className="row g-3 mt-4 align-items-start">
          <div className="col-12 col-lg-4">
            <div className="d-flex flex-column gap-3">
              <div
                className="neo-card neo-lg p-4"
                role="button"
                tabIndex={0}
                onClick={() => handleSelectLogsSource(LOG_SOURCE.IN100)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleSelectLogsSource(LOG_SOURCE.IN100)
                  }
                }}
                style={{ cursor: 'pointer', boxShadow: activeLogsSource === LOG_SOURCE.IN100 ? 'inset 0 0 0 1px rgba(13, 202, 240, 0.65)' : undefined }}
              >
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
                  onClick={(event) => { event.stopPropagation(); fetchSaldo() }}
                  disabled={loadingSaldo}
                >
                  Atualizar saldo
                </button>
              </div>

              <div
                className="neo-card neo-lg p-4"
                role="button"
                tabIndex={0}
                onClick={() => handleSelectLogsSource(LOG_SOURCE.V8)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleSelectLogsSource(LOG_SOURCE.V8)
                  }
                }}
                style={{ cursor: 'pointer', boxShadow: activeLogsSource === LOG_SOURCE.V8 ? 'inset 0 0 0 1px rgba(13, 202, 240, 0.65)' : undefined }}
              >
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
                  onClick={(event) => { event.stopPropagation(); fetchSaldoV8() }}
                  disabled={loadingSaldoV8}
                >
                  Atualizar saldo V8
                </button>
              </div>

              <div
                className="neo-card neo-lg p-4"
                role="button"
                tabIndex={0}
                onClick={() => handleSelectLogsSource(LOG_SOURCE.PRESENCA)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleSelectLogsSource(LOG_SOURCE.PRESENCA)
                  }
                }}
                style={{ cursor: 'pointer', boxShadow: activeLogsSource === LOG_SOURCE.PRESENCA ? 'inset 0 0 0 1px rgba(13, 202, 240, 0.65)' : undefined }}
              >
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
                  onClick={(event) => { event.stopPropagation(); fetchSaldoPresenca() }}
                  disabled={loadingSaldoPresenca}
                >
                  Atualizar saldo Presença
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div>
                  <div className="small text-uppercase opacity-75">{sourceMeta[activeLogsSource]?.title || 'Últimas consultas'}</div>
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
                      <th style={{ width: '30%' }}>Pesquisa</th>
                      <th style={{ width: '23%' }}>CPF</th>
                      <th style={{ width: '23%' }}>{activeRightMeta.label}</th>
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
                              title={String(log?.status ?? '')}
                              aria-label={String(log?.status ?? '')}
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


