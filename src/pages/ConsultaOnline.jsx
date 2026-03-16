import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiSearch } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'

const API_BASE = 'http://85.31.61.242:8011/api'
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
const DEFAULT_SELECTED = API_SOURCES.map((source) => source.key)

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 11)

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

export default function ConsultaOnline() {
  const { user } = useAuth()
  const [cpf, setCpf] = useState('')
  const [consultadoCpf, setConsultadoCpf] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedSources, setSelectedSources] = useState(DEFAULT_SELECTED)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saldoState, setSaldoState] = useState(() => {
    const initial = {}
    API_SOURCES.forEach((source) => {
      initial[source.key] = source.unlimited
        ? { loading: false, error: '', total: '∞', usado: 0, restantes: '∞' }
        : { loading: false, error: '', total: '-', usado: '-', restantes: '-' }
    })
    return initial
  })

  const cpfDigits = useMemo(() => onlyDigits(cpf), [cpf])
  const hasCpf = cpfDigits.length === 11
  const hasResults = rows.length > 0
  const hasSources = selectedSources.length > 0

  const resolveUserEquipeId = () => {
    const raw = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
    if (raw === null || raw === undefined || raw === '') return null
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? null : parsed
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
      const url = new URL(`${API_BASE}/consultas/online`)
      url.searchParams.set('cpf', cpfDigits)
      url.searchParams.set('apis', selectedSources.join(','))
      const response = await fetch(url.toString(), { method: 'GET' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = payload?.message || payload?.error || 'Falha ao consultar.'
        throw new Error(message)
      }
      const data = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : [])
      setRows(data)
      setConsultadoCpf(cpfDigits)
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

        <section className="neo-card p-3 mb-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <label className="form-label fw-semibold mb-0">CPF do cliente</label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setIsModalOpen(true); fetchSaldos() }}
            >
              Selecionar APIs
            </button>
          </div>
          <div className="d-flex gap-2 flex-wrap mt-2">
            <div className="input-group" style={{ maxWidth: 920 }}>
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
            <button type="button" className="btn btn-primary" disabled={!hasCpf || !hasSources} onClick={handleConsultar}>
              {loading ? 'Consultando...' : 'Consultar'}
            </button>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3">
            {API_SOURCES.map((source) => {
              const active = selectedSources.includes(source.key)
              return (
                <div
                  key={source.key}
                  className={`d-inline-flex align-items-center justify-content-center rounded-2 px-2 py-1 ${active ? 'bg-primary' : 'bg-secondary'}`}
                  title={source.label}
                  aria-label={source.label}
                >
                  <img
                    src={source.logoSrc}
                    alt={source.label}
                    style={{ width: 20, height: 20, objectFit: 'contain' }}
                    onError={(event) => {
                      if (source.logoFallbackSrc && event.currentTarget.src !== source.logoFallbackSrc) {
                        event.currentTarget.src = source.logoFallbackSrc
                      }
                    }}
                  />
                </div>
              )
            })}
          </div>
        </section>

        <section className="neo-card p-3">
          <h5 className="mb-3">{hasResults ? `${rows.length} registro(s) encontrado(s)` : '0 registro(s) encontrado(s)'}</h5>

          {!consultadoCpf && <p className="mb-0 opacity-75">Informe um CPF para consultar.</p>}

          {consultadoCpf && !hasResults && !loading && (
            <p className="mb-0 opacity-75">{error || 'Nenhum dado encontrado para este CPF.'}</p>
          )}

          {hasResults && (
            <div className="table-responsive">
              <table className="table table-dark table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>CPF</th>
                    <th>Nome</th>
                    <th>UF</th>
                    <th>Benefício</th>
                    <th>Margem Disponível</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={`${row?.CPF || row?.cpf || idx}-${idx}`}>
                      <td>{row?.CPF || row?.cpf || '-'}</td>
                      <td>{row?.NOME || row?.nome || '-'}</td>
                      <td>{row?.UF || row?.uf || '-'}</td>
                      <td>{row?.Beneficio || row?.beneficio || row?.BENEFICIO_LIMPO || '-'}</td>
                      <td>{row?.MARGEM_DISPONIVEL ?? row?.margem_disponivel ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <Footer />
      {isModalOpen && (
        <div
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-start justify-content-center"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1050, overflowY: 'auto', padding: '72px 16px 24px' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dark p-4" style={{ maxWidth: 620, width: '100%', margin: '0 auto' }}>
            <div className="d-flex align-items-start justify-content-between mb-3">
              <div>
                <h5 className="modal-dark-title mb-1">Selecionar APIs</h5>
                <div className="small modal-dark-subtitle">Escolha quais APIs serão usadas e veja o saldo da sua equipe.</div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon text-light" onClick={() => setIsModalOpen(false)} aria-label="Fechar">
                <FiArrowLeft />
              </button>
            </div>
            <div className="d-flex flex-column gap-3">
              {API_SOURCES.map((source) => {
                const data = saldoState[source.key]
                const selected = selectedSources.includes(source.key)
                return (
                  <label key={source.key} className="neo-card p-3 d-flex align-items-center justify-content-between gap-3">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
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
                      />
                      {source.logoSrc && (
                        <img
                          src={source.logoSrc}
                          alt={source.label}
                          style={{ width: 26, height: 26, objectFit: 'contain' }}
                          onError={(event) => {
                            if (source.logoFallbackSrc && event.currentTarget.src !== source.logoFallbackSrc) {
                              event.currentTarget.src = source.logoFallbackSrc
                            }
                          }}
                        />
                      )}
                      <div className="fw-semibold">{source.label}</div>
                    </div>
                    <div className="text-end small">
                      {data.loading && <div>Carregando...</div>}
                      {!data.loading && data.error && <div className="text-danger">Erro: {data.error}</div>}
                      {!data.loading && !data.error && (
                        <div className="d-flex flex-column">
                          <span>Total: {data.total}</span>
                          <span>Usado: {data.usado}</span>
                          <span>Restante: {data.restantes}</span>
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" className="btn btn-ghost fw-bold" onClick={() => setIsModalOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
