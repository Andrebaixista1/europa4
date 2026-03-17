import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiSearch } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'

const API_BASE = 'http://85.31.61.242:8011/api'
const CONSULTA_ONLINE_POST_URL = 'https://n8n.apivieiracred.store/webhook/api/consultaonline'
const CONSULTA_ONLINE_RESULTADOS_URL = 'https://n8n.apivieiracred.store/webhook/api/resultados-consultaonline'
const CONSULTA_ONLINE_FILA_URL = `${API_BASE}/consultaonline/fila`
const API_SOURCES = [
  {
    key: 'macica',
    label: 'Maciça',
    logoSrc: '/neo-logo.svg',
    unlimited: true
  },
  {
    key: 'entrantes',
    label: 'Entrantes',
    logoSrc: '/neo-logo.svg',
    unlimited: true
  },
  {
    key: 'in100',
    label: 'Qualibanking',
    saldoUrl: `${API_BASE}/dashboard/saldos/in100`,
    logoSrc: 'https://quali.joinbank.com.br/quali/assets/images/logo/logo-auth.svg'
  },
  {
    key: 'v8',
    label: 'V8',
    saldoUrl: `${API_BASE}/dashboard/saldos/v8`,
    logoSrc: 'https://v8-white-label-logos.s3.us-east-1.amazonaws.com/v8-rebrand/v8-logo-auth0.svg'
  },
  {
    key: 'presenca',
    label: 'Presença',
    saldoUrl: `${API_BASE}/dashboard/saldos/presenca`,
    logoSrc: 'https://portal.presencabank.com.br/assets/images/presencabank/logo.svg'
  },
  {
    key: 'handmais',
    label: 'Hand+',
    saldoUrl: `${API_BASE}/dashboard/saldos/handmais`,
    logoSrc: 'http://localhost:5174/handplus-logo.svg',
    logoFallbackSrc: '/handplus-logo.svg'
  },
  {
    key: 'prata',
    label: 'Prata',
    saldoUrl: `${API_BASE}/dashboard/saldos/prata`,
    logoSrc: 'http://localhost:5174/prata-digital-logo.svg',
    logoFallbackSrc: '/prata-digital-logo.svg'
  }
]
const DEFAULT_SELECTED = ['macica', 'entrantes']
const SELECTED_SOURCES_STORAGE_KEY = 'consulta_online_selected_sources'

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 11)
const onlyPhoneDigits = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 11)
const onlyNbDigits = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 12)

const apiLabelMap = Object.freeze(
  API_SOURCES.reduce((acc, source) => {
    acc[String(source.key).toLowerCase()] = source.label
    return acc
  }, {
    in100: 'Qualibanking',
  })
)

const normalizeApiToken = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const parseConsultasAtivasTokens = (value) => {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map((v) => normalizeApiToken(v)).filter(Boolean)
  }

  const str = String(value ?? '').trim()
  if (!str) return []

  // Common case: backend returns JSON string like ["macica","entrantes"]
  if ((str.startsWith('[') && str.endsWith(']')) || (str.startsWith('{') && str.endsWith('}'))) {
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed)) return parsed.map((v) => normalizeApiToken(v)).filter(Boolean)
      if (parsed && typeof parsed === 'object') return Object.values(parsed).map((v) => normalizeApiToken(v)).filter(Boolean)
    } catch {
      // fallthrough
    }
  }

  return str
    .replace(/[\[\]\{\}"]/g, '')
    .split(/[,;|]/g)
    .map((item) => normalizeApiToken(item))
    .filter(Boolean)
}

const formatConsultasAtivas = (value) => {
  if (!value) return ''

  const tokens = parseConsultasAtivasTokens(value)

  const labels = tokens.map((token) => apiLabelMap[token] || token).filter(Boolean)

  return Array.from(new Set(labels)).join(', ')
}

const formatCpf = (value) => {
  const digits = onlyDigits(value)
  const p1 = digits.slice(0, 3)
  const p2 = digits.slice(3, 6)
  const p3 = digits.slice(6, 9)
  const p4 = digits.slice(9, 11)
  if (!digits) return ''
  if (digits.length <= 3) return p1
  if (digits.length <= 6) return `${p1}.${p2}`
  if (digits.length <= 9) return `${p1}.${p2}.${p3}`
  return `${p1}.${p2}.${p3}-${p4}`
}

const formatPhone = (value) => {
  const digits = onlyPhoneDigits(value)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function ConsultaOnline() {
  const { user } = useAuth()
  const [cpf, setCpf] = useState('')
  const [nb, setNb] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [consultadoCpf, setConsultadoCpf] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [filaLoading, setFilaLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedSources, setSelectedSources] = useState(() => {
    try {
      const raw = localStorage.getItem(SELECTED_SOURCES_STORAGE_KEY)
      if (!raw) return DEFAULT_SELECTED
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return DEFAULT_SELECTED
      const allowed = new Set(API_SOURCES.map((source) => source.key))
      const filtered = parsed.filter((key) => allowed.has(key))
      return filtered.length > 0 ? filtered : DEFAULT_SELECTED
    } catch (_) {
      return DEFAULT_SELECTED
    }
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeSourceKey, setActiveSourceKey] = useState(DEFAULT_SELECTED[0])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)
  const [activeDetailsApi, setActiveDetailsApi] = useState('')
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [detailsPayload, setDetailsPayload] = useState(null)
  const [saldoState, setSaldoState] = useState(() => {
    const initial = {}
    API_SOURCES.forEach((source) => {
      initial[source.key] = source.unlimited
        ? { loading: false, error: '', total: '∞', usado: 0, restantes: '∞' }
        : { loading: false, error: '', total: '-', usado: '-', restantes: '-' }
    })
    return initial
  })

  const fetchConsultaOnlineResultados = async (row) => {
    setDetailsLoading(true)
    setDetailsError('')
    try {
      const url = new URL(CONSULTA_ONLINE_RESULTADOS_URL)
      const cpfDigits = onlyDigits(row?.cpf ?? row?.CPF ?? '')
      const hierarquia = resolveHierarchyName()
      const equipeId = row?.equipe_id ?? resolveUserEquipeId()
      if (row?.id != null && row?.id !== '') url.searchParams.set('id', String(row.id))
      if (row?.id_user != null && row?.id_user !== '') url.searchParams.set('id_user', String(row.id_user))
      if (cpfDigits) url.searchParams.set('cpf', cpfDigits)
      if (row?.id_consulta != null && row?.id_consulta !== '') url.searchParams.set('id_consulta', String(row.id_consulta))
      if (hierarquia) url.searchParams.set('hierarquia', String(hierarquia))
      if (equipeId != null && equipeId !== '') url.searchParams.set('equipe_id', String(equipeId))

      const resp = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        const msg = data?.message || data?.error || `HTTP ${resp.status}`
        throw new Error(msg)
      }
      setDetailsPayload(data)
      return data
    } catch (err) {
      setDetailsPayload(null)
      setDetailsError(err?.message || 'Falha ao carregar resultados.')
      return null
    } finally {
      setDetailsLoading(false)
    }
  }

  const openDetails = (row) => {
    setSelectedRow(row ?? null)
    setActiveDetailsApi('')
    setDetailsPayload(null)
    setDetailsError('')
    setIsDetailsOpen(true)
    if (row) void fetchConsultaOnlineResultados(row)
  }

  const closeDetails = () => {
    setIsDetailsOpen(false)
    setSelectedRow(null)
    setActiveDetailsApi('')
    setDetailsPayload(null)
    setDetailsError('')
  }

  const formatMaybeDateTime = (value) => {
    if (!value) return '-'
    const str = String(value).trim()
    if (!str) return '-'
    const parsed = new Date(str.replace(' ', 'T'))
    if (Number.isNaN(parsed.getTime())) return str
    return parsed.toLocaleString('pt-BR')
  }

  const detailsApiTokens = useMemo(() => {
    if (!selectedRow || typeof selectedRow !== 'object') return []
    const raw = selectedRow.consultas_ativas ?? selectedRow.CONSULTAS_ATIVAS ?? selectedRow.apis ?? selectedRow.api
    return Array.from(new Set(parseConsultasAtivasTokens(raw)))
  }, [selectedRow])

  const detailsActiveApiPayload = useMemo(() => {
    if (!detailsPayload || typeof detailsPayload !== 'object') return null
    const token = normalizeApiToken(activeDetailsApi)
    if (!token) return null
    return (
      detailsPayload?.[token] ??
      detailsPayload?.data?.[token] ??
      detailsPayload?.resultados?.[token] ??
      null
    )
  }, [detailsPayload, activeDetailsApi])

  const resolveApiSource = (apiKey) => {
    const token = normalizeApiToken(apiKey)
    return API_SOURCES.find((source) => normalizeApiToken(source.key) === token) ?? null
  }

  const DetailsApiIcon = ({ apiKey }) => {
    const source = resolveApiSource(apiKey)
    if (!source) return <FiSearch />
    return (
      <img
        src={source.logoSrc}
        alt={source.label}
        style={{ width: 16, height: 16, objectFit: 'contain' }}
        onError={(event) => {
          if (source.logoFallbackSrc && event.currentTarget.src !== source.logoFallbackSrc) {
            event.currentTarget.src = source.logoFallbackSrc
          }
        }}
      />
    )
  }

  const detailsRows = useMemo(() => {
    if (!selectedRow || typeof selectedRow !== 'object') return []
    const r = selectedRow
    const consultasAtivasValue = activeDetailsApi
      ? (apiLabelMap[normalizeApiToken(activeDetailsApi)] || activeDetailsApi)
      : (formatConsultasAtivas(r.consultas_ativas ?? r.CONSULTAS_ATIVAS ?? r.apis ?? r.api) || '-')

    const dtNasc = r.dt_nascimento ?? r.dtNascimento ?? r.data_nascimento ?? null
    return [
      { label: 'CPF', value: formatCpf(r.cpf ?? r.CPF) || '-' },
      { label: 'Status', value: r.status ?? r.STATUS ?? '-' },
      { label: 'Consultas ativas', value: consultasAtivasValue },
      { label: 'NB', value: r.nb ?? '-' },
      { label: 'Nome', value: r.nome ?? '-' },
      { label: 'Telefone', value: r.telefone ?? '-' },
      { label: 'Criado em', value: formatMaybeDateTime(r.created_at) },
      { label: 'Atualizado em', value: formatMaybeDateTime(r.updated_at) },
    ].filter((item) => {
      if (item.label !== 'Data de nascimento') return true
      const v = String(item.value ?? '').trim()
      return v && v !== '-'
    }).concat(
      dtNasc ? [{ label: 'Data de nascimento', value: dtNasc }] : []
    )
  }, [selectedRow])

  const cpfDigits = useMemo(() => onlyDigits(cpf), [cpf])
  const nbDigits = useMemo(() => onlyNbDigits(nb), [nb])
  const telefoneDigits = useMemo(() => onlyPhoneDigits(telefone), [telefone])
  const hasCpf = cpfDigits.length === 11
  const hasResults = rows.length > 0
  const hasSources = selectedSources.length > 0
  const needsNb = selectedSources.includes('in100')
  const needsNomeTelefone = selectedSources.some((key) => ['v8', 'handmais', 'prata', 'presenca'].includes(key))
  const needsDataNascimento = selectedSources.some((key) => ['prata', 'presenca'].includes(key))
  const hasRequiredFields = hasCpf && hasSources
  const selectedSourceEntries = API_SOURCES.filter((source) => selectedSources.includes(source.key))
  const selectedSourceLabels = selectedSourceEntries.map((source) => source.label).join(', ')
  const activeSource = API_SOURCES.find((source) => source.key === activeSourceKey) ?? API_SOURCES[0]
  const activeSourceSaldo = saldoState[activeSource?.key] ?? { loading: false, error: '', total: '-', usado: '-', restantes: '-' }

  const resolveUserId = () => {
    const raw = user?.id ?? user?.id_user ?? user?.user_id ?? null
    if (raw === null || raw === undefined || raw === '') return null
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? raw : parsed
  }

  const resolveUserEquipeId = () => {
    const raw = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
    if (raw === null || raw === undefined || raw === '') return null
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? null : parsed
  }

  const resolveHierarchyName = () => {
    const raw = String(user?.role ?? user?.role_nome ?? user?.role_slug ?? '').trim().toLowerCase()
    if (raw === 'master') return 'master'
    if (raw === 'administrador' || raw === 'admin' || raw === 'adm') return 'adm'
    if (raw === 'supervisor' || raw === 'super') return 'super'
    if (raw === 'operador' || raw === 'oper') return 'oper'
    return raw || null
  }

  const fetchFila = async () => {
    const hierarquia = resolveHierarchyName()
    const equipeId = resolveUserEquipeId()
    const idUser = resolveUserId()

    const url = new URL(CONSULTA_ONLINE_FILA_URL)
    if (hierarquia) url.searchParams.set('hierarquia', hierarquia)
    if (hierarquia === 'oper' && idUser != null) url.searchParams.set('id_user', String(idUser))
    if ((hierarquia === 'adm' || hierarquia === 'super') && equipeId != null) url.searchParams.set('equipe_id', String(equipeId))
    if (hierarquia === 'master' && equipeId != null) url.searchParams.set('equipe_id', String(equipeId))

    setFilaLoading(true)
    try {
      const resp = await fetch(url.toString(), { cache: 'no-store' })
      const payload = await resp.json().catch(() => null)
      if (!resp.ok) {
        const msg = payload?.message || payload?.error || `HTTP ${resp.status}`
        throw new Error(msg)
      }
      const data = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : [])
      setRows(data)
      setError('')
      return data
    } catch (err) {
      setError(err?.message || 'Falha ao carregar fila.')
      return null
    } finally {
      setFilaLoading(false)
    }
  }

  const buildSaldoUrl = (baseUrl) => {
    const url = new URL(baseUrl)
    const equipeId = resolveUserEquipeId()
    if (equipeId != null) {
      url.searchParams.set('equipe_id', String(equipeId))
    } else {
      url.searchParams.set('all', '1')
    }
    return url.toString()
  }

  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_SOURCES_STORAGE_KEY, JSON.stringify(selectedSources))
    } catch (_) {
      // noop
    }
  }, [selectedSources])

  useEffect(() => {
    if (!API_SOURCES.some((source) => source.key === activeSourceKey)) {
      setActiveSourceKey(DEFAULT_SELECTED[0])
      return
    }
    if (selectedSources.includes(activeSourceKey)) return
    if (selectedSources.length > 0) {
      setActiveSourceKey(selectedSources[0])
      return
    }
    setActiveSourceKey(API_SOURCES[0]?.key ?? '')
  }, [activeSourceKey, selectedSources])

  useEffect(() => {
    let cancelled = false
    let intervalId = null

    ;(async () => {
      const data = await fetchFila()
      if (cancelled) return
      if (Array.isArray(data)) {
        // ok
      }
    })()

    intervalId = setInterval(() => {
      if (cancelled) return
      void fetchFila()
    }, 4000)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, []) // load & poll fila

  const summarizeRows = (rows) => {
    const list = Array.isArray(rows) ? rows : []
    if (list.length === 0) return { total: '-', usado: '-', restantes: '-' }

    const toDateValue = (value) => {
      if (!value) return null
      const str = String(value).trim()
      if (!str) return null
      const parsed = new Date(str.replace(' ', 'T'))
      if (Number.isNaN(parsed.getTime())) return null
      return parsed.getTime()
    }

    const pickLatest = (a, b) => {
      const aUpdated = toDateValue(a?.updated_at) ?? toDateValue(a?.created_at)
      const bUpdated = toDateValue(b?.updated_at) ?? toDateValue(b?.created_at)
      if (aUpdated != null && bUpdated != null) return aUpdated >= bUpdated ? a : b
      if (aUpdated != null) return a
      if (bUpdated != null) return b
      const aId = Number(a?.id ?? 0)
      const bId = Number(b?.id ?? 0)
      return aId >= bId ? a : b
    }

    let latest = null
    for (const row of list) {
      if (!row) continue
      if (!latest) {
        latest = row
        continue
      }
      latest = pickLatest(latest, row)
    }
    if (!latest) return { total: '-', usado: '-', restantes: '-' }

    const totalValue = Number(latest?.total ?? latest?.limite ?? latest?.total_carregado ?? latest?.limite_disponivel ?? 0)
    const usadoValue = Number(latest?.consultados ?? latest?.usado ?? latest?.consultas_realizada ?? latest?.consultas_realizadas ?? 0)
    if (Number.isNaN(totalValue) && Number.isNaN(usadoValue)) {
      return { total: '-', usado: '-', restantes: '-' }
    }
    const total = Number.isNaN(totalValue) ? 0 : totalValue
    const usado = Number.isNaN(usadoValue) ? 0 : usadoValue
    return { total, usado, restantes: Math.max(0, total - usado) }
  }

  const fetchSaldos = async () => {
    const equipeId = resolveUserEquipeId()
    if (equipeId == null) {
      notify.warn('Equipe do usuário não encontrada. Não foi possível carregar os saldos.')
    }
    const updates = {}
    API_SOURCES.forEach((source) => {
      if (source.unlimited) {
        updates[source.key] = { loading: false, error: '', total: '∞', usado: 0, restantes: '∞' }
        return
      }
      updates[source.key] = { ...saldoState[source.key], loading: true, error: '' }
    })
    setSaldoState((prev) => ({ ...prev, ...updates }))

    await Promise.all(API_SOURCES.filter((source) => !source.unlimited).map(async (source) => {
      try {
        const res = await fetch(buildSaldoUrl(source.saldoUrl), { cache: 'no-store' })
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          const msg = payload?.message || payload?.error || `HTTP ${res.status}`
          throw new Error(msg)
        }
        const data = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : [])
        const summary = summarizeRows(data)
        setSaldoState((prev) => ({
          ...prev,
          [source.key]: { ...summary, loading: false, error: '' }
        }))
      } catch (err) {
        setSaldoState((prev) => ({
          ...prev,
          [source.key]: { ...prev[source.key], loading: false, error: err?.message || 'Erro' }
        }))
      }
    }))
  }

  const handleConsultar = async () => {
    if (!hasCpf) return
    if (!hasSources) {
      notify.warn('Selecione ao menos uma API para consultar.')
      return
    }
    setLoading(true)
    setError('')
    setRows([])
    try {
      const idConsulta = Date.now()
      const payloadBody = {
        id_consulta: idConsulta,
        id_user: resolveUserId(),
        equipe_id: resolveUserEquipeId(),
        hierarquia: resolveHierarchyName(),
        cpf: cpfDigits,
        apis: selectedSources,
      }
      if (nbDigits) payloadBody.nb = nbDigits
      if (nome.trim()) payloadBody.nome = nome.trim()
      if (telefoneDigits) payloadBody.telefone = telefoneDigits
      if (dataNascimento) payloadBody.data_nascimento = dataNascimento

      const response = await fetch(CONSULTA_ONLINE_POST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody)
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = payload?.message || payload?.error || 'Falha ao consultar.'
        throw new Error(message)
      }
      const data = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : [])
      setRows(data)
      setConsultadoCpf(cpfDigits)
      setIsModalOpen(false)
      notify.success('Consulta enviada para processamento. Acompanhe a fila abaixo.')
      void fetchFila()
    } catch (err) {
      setError(err?.message || 'Falha ao consultar.')
      setConsultadoCpf(cpfDigits)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-3">
          <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
            <FiArrowLeft size={16} />
            <span>Voltar</span>
          </Link>
          <div>
            <h2 className="fw-bold mb-1">Consulta Online</h2>
            <div className="opacity-75 small">
              Pagina para consultar clientes online em todos os canais e bancos via API.
            </div>
          </div>
        </div>

        <section className="neo-card p-4 mb-3">
          <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <div>
              <div className="small text-uppercase opacity-75 mb-2">Nova consulta</div>
              <h5 className="fw-bold mb-2">Pesquisar cliente para fila online</h5>
              <div className="small opacity-75 mb-3">
                Selecione as APIs, preencha os dados do cliente no modal e envie a consulta para processamento.
              </div>
              <div className="d-flex flex-wrap gap-2">
                {selectedSourceEntries.map((source) => (
                  <span
                    key={source.key}
                    className="d-inline-flex align-items-center gap-2 px-2 py-1 rounded-2"
                    style={{
                      border: '1px solid rgba(96, 224, 185, 0.45)',
                      background: source.key === 'prata' ? 'rgba(255,255,255,0.96)' : 'rgba(10, 20, 40, 0.55)'
                    }}
                  >
                    <img
                      src={source.logoSrc}
                      alt={source.label}
                      style={{ width: 18, height: 18, objectFit: 'contain' }}
                      onError={(event) => {
                        if (source.logoFallbackSrc && event.currentTarget.src !== source.logoFallbackSrc) {
                          event.currentTarget.src = source.logoFallbackSrc
                        }
                      }}
                    />
                    <span className="small" style={{ color: source.key === 'prata' ? '#11203a' : '#dfe7ff' }}>{source.label}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="text-end">
              <div className="small opacity-75 mb-2">APIs ativas</div>
              <div className="display-6 fw-bold mb-3">{selectedSources.length}</div>
              <button
                type="button"
                className="btn btn-primary px-4"
                onClick={() => { setIsModalOpen(true); fetchSaldos() }}
              >
                <FiSearch className="me-2" />
                Pesquisar cliente
              </button>
            </div>
          </div>
        </section>

        <section className="neo-card p-3">
          <div className="d-flex align-items-start justify-content-between gap-3 mb-3 flex-wrap">
            <div>
              <h5 className="mb-1">Fila de consultas</h5>
              <div className="small opacity-75">Aguardando o retorno padrão da fila para ajustar as colunas finais.</div>
            </div>
            <div className="small opacity-75">
              {filaLoading ? 'Atualizando...' : (hasResults ? `${rows.length} item(ns)` : 'Sem itens carregados')}
            </div>
          </div>

          {!consultadoCpf && <p className="mb-0 opacity-75">Nenhuma consulta enviada nesta sessão.</p>}

          {consultadoCpf && !hasResults && !loading && (
            <p className="mb-0 opacity-75">{error || 'Consulta enviada. Aguardando retorno da fila.'}</p>
          )}

          {hasResults && (
            <div className="table-responsive">
              <table className="table table-dark table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>CPF</th>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>APIs</th>
                    <th>Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                  <tr
                    key={`${row?.id ?? row?.cpf ?? idx}-${idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetails(row)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openDetails(row)
                      }
                    }}
                    title="Clique para ver detalhes"
                    style={{ cursor: 'pointer' }}
                  >
                      <td>{formatCpf(row?.cpf ?? row?.CPF ?? consultadoCpf) || '-'}</td>
                      <td>{row?.nome ?? row?.NOME ?? '-'}</td>
                      <td>{row?.status ?? row?.STATUS ?? row?.message ?? 'Em fila'}</td>
                      <td>{formatConsultasAtivas(row?.consultas_ativas ?? row?.CONSULTAS_ATIVAS ?? row?.apis ?? row?.api) || '-'}</td>
                      <td>{row?.updated_at ?? row?.created_at ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <Footer />
    {isDetailsOpen && (
      <div
        className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-start justify-content-center"
        style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1060, overflowY: 'auto', padding: '72px 16px 24px' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dark p-4" style={{ maxWidth: 920, width: '100%', margin: '0 auto' }}>
          <div className="d-flex align-items-start justify-content-between mb-3">
            <div>
              <div className="small text-uppercase opacity-75 mb-1">Detalhes da fila</div>
              <h5 className="modal-dark-title mb-0">Cliente</h5>
            </div>
            <button type="button" className="btn btn-ghost btn-icon text-light" onClick={closeDetails} aria-label="Fechar">
              <FiArrowLeft />
            </button>
          </div>

          <div className="neo-card p-3 mb-3">
            <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
              <div>
                <div className="small opacity-75 mb-1">CPF</div>
                <div className="fs-4 fw-bold">{detailsRows.find((i) => i.label === 'CPF')?.value || '-'}</div>
                <div className="d-flex flex-wrap gap-3 mt-2">
                  <div>
                    <div className="small opacity-75">NB</div>
                    <div className="fw-semibold">{detailsRows.find((i) => i.label === 'NB')?.value || '-'}</div>
                  </div>
                  <div>
                    <div className="small opacity-75">Nome</div>
                    <div className="fw-semibold" style={{ maxWidth: 520, wordBreak: 'break-word' }}>
                      {detailsRows.find((i) => i.label === 'Nome')?.value || '-'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-end">
                <div className="small opacity-75 mb-1">Status</div>
                <span className="badge rounded-pill text-bg-warning">{detailsRows.find((i) => i.label === 'Status')?.value || '-'}</span>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 col-lg-6">
              <div className="neo-card p-3 h-100">
                <div className="small text-uppercase opacity-75 mb-3">Dados</div>
                <div className="d-flex flex-column gap-2">
                  {detailsRows
                    .filter((item) => !['CPF', 'Status', 'NB', 'Nome', 'Criado em', 'Atualizado em'].includes(item.label))
                    .map((item) => (
                      <div key={item.label} className="d-flex justify-content-between gap-3">
                        <div className="small opacity-75">{item.label}</div>
                        <div className="fw-semibold text-end" style={{ maxWidth: 420, wordBreak: 'break-word' }}>
                          {String(item.value ?? '-')}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div className="neo-card p-3 h-100">
                <div className="small text-uppercase opacity-75 mb-3">Registro</div>
                <div className="d-flex flex-column gap-2">
                  {detailsRows
                    .filter((item) => ['Criado em', 'Atualizado em'].includes(item.label))
                    .map((item) => (
                      <div key={item.label} className="d-flex justify-content-between gap-3">
                        <div className="small opacity-75">{item.label}</div>
                        <div className="fw-semibold text-end">{String(item.value ?? '-')}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {detailsApiTokens.length > 0 && (
            <div className="neo-card p-3">
              <div className="small text-uppercase opacity-75 mb-2">Consultas ativas</div>
              <div className="d-flex flex-wrap gap-2">
                {detailsApiTokens.map((token) => {
                  const active = normalizeApiToken(activeDetailsApi) === token
                  const src = resolveApiSource(token)
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`btn ${active ? 'btn-primary' : 'btn-ghost'} btn-sm d-inline-flex align-items-center gap-2`}
                      onClick={() => setActiveDetailsApi(active ? '' : token)}
                      title={(src?.label ?? apiLabelMap[token] ?? token) || token}
                    >
                      <DetailsApiIcon apiKey={token} />
                      <span>{src?.label ?? apiLabelMap[token] ?? token}</span>
                    </button>
                  )
                })}
              </div>
              {activeDetailsApi && (
                <div className="small opacity-75 mt-2">
                  Filtrando por: <span className="fw-semibold">{apiLabelMap[normalizeApiToken(activeDetailsApi)] || activeDetailsApi}</span>
                </div>
              )}
              {detailsLoading && (
                <div className="small mt-3">Carregando resultados...</div>
              )}
              {detailsError && (
                <div className="text-danger small mt-3">Erro ao carregar resultados: {detailsError}</div>
              )}
              {!detailsLoading && !detailsError && activeDetailsApi && (
                <div className="mt-3">
                  <div className="small text-uppercase opacity-75 mb-2">Resultado</div>
                  <pre
                    className="mb-0"
                    style={{
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 10,
                      padding: 12,
                      maxHeight: 320,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 12,
                      color: '#dfe7ff',
                    }}
                  >
                    {JSON.stringify(detailsActiveApiPayload ?? detailsPayload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div className="d-flex justify-content-end mt-3">
            <button type="button" className="btn btn-primary px-4" onClick={closeDetails}>Fechar</button>
          </div>
        </div>
      </div>
    )}
      {isModalOpen && (
        <div
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-start justify-content-center"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1050, overflowY: 'auto', padding: '72px 16px 24px' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dark p-4" style={{ maxWidth: 1360, width: '100%', margin: '0 auto' }}>
            <div className="d-flex align-items-start justify-content-between mb-3">
              <div>
                <div className="small text-uppercase opacity-75 mb-1">Consulta online</div>
                <h5 className="modal-dark-title mb-1">Montar consulta do cliente</h5>
                <div className="small modal-dark-subtitle">Preencha os dados à esquerda e selecione as APIs com saldo disponível à direita.</div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon text-light" onClick={() => setIsModalOpen(false)} aria-label="Fechar">
                <FiArrowLeft />
              </button>
            </div>
            <div className="row g-4">
              <div className="col-12 col-lg-4">
                <div className="neo-card p-3 h-100">
                  <div className="small text-uppercase opacity-75 mb-3">Dados do cliente</div>
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label small opacity-75">CPF</label>
                      <div className="input-group">
                        <span className="input-group-text bg-transparent border-secondary text-light">
                          <FiSearch />
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          value={formatCpf(cpf)}
                          onChange={(event) => setCpf(event.target.value)}
                          placeholder="000.000.000-00"
                        />
                      </div>
                    </div>
                    {needsNb && (
                      <div className="col-12">
                        <label className="form-label small opacity-75">NB</label>
                        <input
                          type="text"
                          className="form-control"
                          value={nbDigits}
                          onChange={(event) => setNb(event.target.value)}
                          placeholder="Informe o benefício"
                        />
                      </div>
                    )}
                    {needsNomeTelefone && (
                      <>
                        <div className="col-12">
                          <label className="form-label small opacity-75">Nome completo</label>
                          <input
                            type="text"
                            className="form-control"
                            value={nome}
                            onChange={(event) => setNome(event.target.value)}
                            placeholder="Nome completo do cliente"
                          />
                        </div>
                        <div className={needsDataNascimento ? 'col-12 col-md-6' : 'col-12'}>
                          <label className="form-label small opacity-75">Telefone</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formatPhone(telefone)}
                            onChange={(event) => setTelefone(event.target.value)}
                            placeholder="Telefone com DDD"
                          />
                        </div>
                      </>
                    )}
                    {needsDataNascimento && (
                      <div className="col-12 col-md-6">
                        <label className="form-label small opacity-75">Data de nascimento</label>
                        <input
                          type="date"
                          className="form-control"
                          value={dataNascimento}
                          onChange={(event) => setDataNascimento(event.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-8">
                <div className="neo-card p-3 h-100">
                  <div className="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
                    <div>
                      <div className="small text-uppercase opacity-75">APIs disponíveis</div>
                      <div className="small opacity-75">Marque as fontes que devem entrar na fila.</div>
                    </div>
                    <div className="small opacity-75">{selectedSources.length} selecionada(s)</div>
                  </div>
                  <div className="row g-3">
                    <div className="col-12 col-xl-6">
                      <div
                        className="d-flex flex-column gap-2"
                        style={{
                          height: 560,
                          maxHeight: '62vh',
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          paddingRight: 10
                        }}
                      >
                        {API_SOURCES.map((source) => {
                          const selected = selectedSources.includes(source.key)
                          const focused = activeSourceKey === source.key
                          return (
                            <button
                              key={source.key}
                              type="button"
                              className="neo-card p-3 text-start w-100"
                              onClick={() => setActiveSourceKey(source.key)}
                              style={{
                                borderColor: focused ? 'rgba(59, 130, 246, 0.65)' : (selected ? 'rgba(96, 224, 185, 0.45)' : 'rgba(255,255,255,0.08)'),
                                boxShadow: focused ? 'inset 0 0 0 1px rgba(59, 130, 246, 0.18)' : 'none',
                                background: focused ? 'rgba(18, 33, 62, 0.92)' : 'rgba(12, 20, 36, 0.92)'
                              }}
                            >
                              <div className="d-flex align-items-center gap-3 w-100">
                                <input
                                  type="checkbox"
                                  className="form-check-input flex-shrink-0 m-0"
                                  checked={selected}
                                  onChange={() => {
                                    setSelectedSources((prev) => {
                                      const exists = prev.includes(source.key)
                                      if (exists) {
                                        return prev.filter((item) => item !== source.key)
                                      }
                                      return [...prev, source.key]
                                    })
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div
                                  className="d-inline-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
                                  style={{
                                    width: 40,
                                    height: 40,
                                    background: source.key === 'prata' ? 'rgba(255,255,255,0.96)' : 'rgba(10, 20, 40, 0.45)',
                                    border: '1px solid rgba(255,255,255,0.08)'
                                  }}
                                >
                                  <img
                                    src={source.logoSrc}
                                    alt={source.label}
                                    style={{ width: 22, height: 22, objectFit: 'contain' }}
                                    onError={(event) => {
                                      if (source.logoFallbackSrc && event.currentTarget.src !== source.logoFallbackSrc) {
                                        event.currentTarget.src = source.logoFallbackSrc
                                      }
                                    }}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="fw-semibold">{source.label}</div>
                                  <div className="small opacity-75">
                                    {selected ? 'Selecionada para esta consulta.' : 'Clique para ver detalhes e saldo.'}
                                  </div>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="col-12 col-xl-6">
                      <div className="neo-card p-3 h-100" style={{ minHeight: 560, maxHeight: '62vh' }}>
                        <div className="small text-uppercase opacity-75 mb-3">Detalhes da API</div>
                        <div className="d-flex align-items-center gap-3 mb-4">
                          <div
                            className="d-inline-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
                            style={{
                              width: 52,
                              height: 52,
                              background: activeSource?.key === 'prata' ? 'rgba(255,255,255,0.96)' : 'rgba(10, 20, 40, 0.45)',
                              border: '1px solid rgba(255,255,255,0.08)'
                            }}
                          >
                            <img
                              src={activeSource?.logoSrc}
                              alt={activeSource?.label}
                              style={{ width: 28, height: 28, objectFit: 'contain' }}
                              onError={(event) => {
                                if (activeSource?.logoFallbackSrc && event.currentTarget.src !== activeSource.logoFallbackSrc) {
                                  event.currentTarget.src = activeSource.logoFallbackSrc
                                }
                              }}
                            />
                          </div>
                          <div>
                            <div className="fw-semibold fs-5">{activeSource?.label}</div>
                            <div className="small opacity-75">
                              {activeSource?.unlimited ? 'Fonte com saldo ilimitado.' : 'Fonte controlada pelo saldo da equipe.'}
                            </div>
                          </div>
                        </div>

                        <div className="row g-3 mb-4">
                          <div className="col-12 col-md-4">
                            <div className="neo-card p-3 h-100">
                              <div className="small opacity-75 text-uppercase mb-2">Total</div>
                              <div className="fs-4 fw-bold">{activeSourceSaldo.total}</div>
                            </div>
                          </div>
                          <div className="col-12 col-md-4">
                            <div className="neo-card p-3 h-100">
                              <div className="small opacity-75 text-uppercase mb-2">Usado</div>
                              <div className="fs-4 fw-bold">{activeSourceSaldo.usado}</div>
                            </div>
                          </div>
                          <div className="col-12 col-md-4">
                            <div className="neo-card p-3 h-100">
                              <div className="small opacity-75 text-uppercase mb-2">Restante</div>
                              <div className="fs-4 fw-bold">{activeSourceSaldo.restantes}</div>
                            </div>
                          </div>
                        </div>

                        <div className="neo-card p-3">
                          <div className="small text-uppercase opacity-75 mb-2">Regras desta fonte</div>
                          <div className="small mb-2">
                            {activeSource?.unlimited ? 'Consulta sem consumo de saldo de equipe.' : 'Consulta sujeita ao saldo disponível do cadastro selecionado para sua equipe.'}
                          </div>
                          <div className="small opacity-75">
                            {selectedSources.includes(activeSource?.key)
                              ? 'Esta API será incluída quando você enviar a consulta para a fila.'
                              : 'Marque o checkbox na lista para incluir esta API na fila.'}
                          </div>
                          {activeSourceSaldo.error && (
                            <div className="text-danger small mt-3">Erro ao carregar saldo: {activeSourceSaldo.error}</div>
                          )}
                          {activeSourceSaldo.loading && (
                            <div className="small mt-3">Carregando saldo...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" className="btn btn-ghost fw-bold" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary px-4" disabled={!hasRequiredFields || !hasSources || loading} onClick={handleConsultar}>
                {loading ? 'Enviando...' : 'Enviar para fila'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



