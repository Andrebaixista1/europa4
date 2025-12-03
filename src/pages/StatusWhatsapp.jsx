import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import * as Fi from 'react-icons/fi'
import { notify } from '../utils/notify.js'
import { n8nUrl } from '../services/n8nClient.js'

const API_ENDPOINT = n8nUrl('/webhook/canais')

const STATUS_META = {
  CONNECTED: { label: 'Connected', variant: 'success', tone: 'green' },
  DISCONNECTED: { label: 'Disconnected', variant: 'danger', tone: 'red' },
  CONNECTING: { label: 'Connecting', variant: 'warning', tone: 'yellow' },
  FAILED: { label: 'Failed', variant: 'danger', tone: 'red' },
  FLAGGED: { label: 'Flagged', variant: 'warning', tone: 'yellow' },
  UNKNOWN: { label: 'Unknown', variant: 'secondary', tone: 'gray' },
}

const QUALITY_META = {
  GREEN: { label: 'High', color: '#22c55e', tone: 'green' },
  HIGH: { label: 'High', color: '#22c55e', tone: 'green' },
  YELLOW: { label: 'Medium', color: '#fbbf24', tone: 'yellow' },
  MEDIUM: { label: 'Medium', color: '#fbbf24', tone: 'yellow' },
  ORANGE: { label: 'Medium', color: '#f97316', tone: 'yellow' },
  RED: { label: 'Low', color: '#ef4444', tone: 'red' },
  LOW: { label: 'Low', color: '#ef4444', tone: 'red' },
  GRAY: { label: 'Unknown', color: '#9ca3af', tone: 'gray' },
  UNKNOWN: { label: 'Unknown', color: '#9ca3af', tone: 'gray' },
}

const COLOR_PALETTE = {
  green: '#22c55e',
  yellow: '#fbbf24',
  red: '#ef4444',
  gray: '#9ca3af',
}

const columns = [
  { key: 'name', label: 'Canal' },
  { key: 'count', label: 'Telefones' },
  { key: 'status', label: 'Status' },
  { key: 'quality', label: 'Quality rating' },
]

const STATUS_PRIORITY = ['FAILED', 'DISCONNECTED', 'FLAGGED', 'CONNECTING', 'CONNECTED', 'UNKNOWN']
const QUALITY_PRIORITY = ['RED', 'LOW', 'ORANGE', 'YELLOW', 'MEDIUM', 'GREEN', 'HIGH', 'UNKNOWN']
const TONES = ['green', 'yellow', 'red', 'gray']

const normalizeString = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const toStatusCode = (status) => {
  const token = normalizeString(status).toUpperCase()
  return STATUS_META[token] ? token : 'UNKNOWN'
}

const toQualityCode = (rating) => {
  const token = normalizeString(rating).toUpperCase()
  return QUALITY_META[token] ? token : 'UNKNOWN'
}

const aggregateStatus = (entries) => {
  const codes = entries.map((entry) => toStatusCode(entry.status))
  return STATUS_PRIORITY.find((candidate) => codes.includes(candidate)) || 'UNKNOWN'
}

const aggregateQuality = (entries) => {
  const codes = entries.map((entry) => toQualityCode(entry.quality_rating))
  return QUALITY_PRIORITY.find((candidate) => codes.includes(candidate)) || 'UNKNOWN'
}

const formatPhone = (value) => {
  const raw = normalizeString(value)
  if (!raw) return '—'
  const digits = raw.replace(/\D+/g, '')
  if (digits.length < 10) return raw
  const country = digits.slice(0, digits.length - 11) || '55'
  const area = digits.slice(-11, -9)
  const prefix = digits.slice(-9, -4)
  const suffix = digits.slice(-4)
  return `+${country} (${area}) ${prefix}-${suffix}`
}

const getStatusMeta = (status) => STATUS_META[toStatusCode(status)] || STATUS_META.UNKNOWN
const getQualityMeta = (rating) => QUALITY_META[toQualityCode(rating)] || QUALITY_META.UNKNOWN

const ensureCounters = () => ({ green: 0, yellow: 0, red: 0, gray: 0 })

export default function StatusWhatsapp() {
  const [channels, setChannels] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })
  const [selectedGroup, setSelectedGroup] = useState(null)

  const fetchChannels = useCallback(async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(API_ENDPOINT)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      const data = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
      setChannels(data.map(item => ({ ...item })))
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('Erro ao buscar canais WhatsApp:', err)
      setError(err.message || 'Erro ao buscar canais')
      notify.error(`Erro ao buscar canais: ${err.message || 'Falha inesperada'}`)
    } finally {
      if (silent) setIsRefreshing(false)
      else setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChannels({ silent: false })
  }, [fetchChannels])

  const groupedChannels = useMemo(() => {
    const map = new Map()
    channels.forEach((channel) => {
      const key = normalizeString(channel.account_name).toLowerCase() || 'sem-nome'
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: normalizeString(channel.account_name) || '—',
          entries: [],
        })
      }
      map.get(key).entries.push(channel)
    })

    return Array.from(map.values()).map((group) => {
      const count = group.entries.length
      const statusCode = aggregateStatus(group.entries)
      const qualityCode = aggregateQuality(group.entries)

      const statusCounters = group.entries.reduce((acc, entry) => {
        const tone = getStatusMeta(entry.status).tone
        acc[tone] = (acc[tone] || 0) + 1
        return acc
      }, ensureCounters())

      const qualityCounters = group.entries.reduce((acc, entry) => {
        const tone = getQualityMeta(entry.quality_rating).tone
        acc[tone] = (acc[tone] || 0) + 1
        return acc
      }, ensureCounters())

      return {
        ...group,
        count,
        statusCode,
        qualityCode,
        statusCounters,
        qualityCounters,
      }
    })
  }, [channels])

  const summary = useMemo(() => {
    const totalNumbers = channels.length
    const totalGroups = groupedChannels.length

    const totals = channels.reduce(
      (acc, entry) => {
        const statusTone = getStatusMeta(entry.status).tone
        const qualityTone = getQualityMeta(entry.quality_rating).tone
        acc.status[statusTone] = (acc.status[statusTone] || 0) + 1
        acc.quality[qualityTone] = (acc.quality[qualityTone] || 0) + 1
        return acc
      },
      { status: ensureCounters(), quality: ensureCounters() }
    )

    return { totalNumbers, totalGroups, ...totals }
  }, [channels, groupedChannels])

  const sortedGroups = useMemo(() => {
    const list = [...groupedChannels]
    const { key, direction } = sortConfig || {}
    const dir = direction === 'desc' ? -1 : 1
    list.sort((a, b) => {
      switch (key) {
        case 'count':
          return (a.count - b.count) * dir
        case 'status': {
          const aIndex = STATUS_PRIORITY.indexOf(a.statusCode)
          const bIndex = STATUS_PRIORITY.indexOf(b.statusCode)
          return (aIndex - bIndex) * dir
        }
        case 'quality': {
          const aIndex = QUALITY_PRIORITY.indexOf(a.qualityCode)
          const bIndex = QUALITY_PRIORITY.indexOf(b.qualityCode)
          return (aIndex - bIndex) * dir
        }
        case 'name':
        default:
          return normalizeString(a.name).localeCompare(normalizeString(b.name)) * dir
      }
    })
    return list
  }, [groupedChannels, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' }
      }
      const nextDirection = prev.direction === 'asc' ? 'desc' : 'asc'
      return { key, direction: nextDirection }
    })
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <Fi.FiArrowUp size={14} className="opacity-50" />
    return sortConfig.direction === 'asc' ? <Fi.FiArrowUp size={14} /> : <Fi.FiArrowDown size={14} />
  }

  const handleRefresh = () => {
    fetchChannels({ silent: true })
  }

  const renderStatusBadge = (status) => {
    const meta = getStatusMeta(status)
    return (
      <span className={`badge text-bg-${meta.variant} rounded-pill px-3 py-2 text-capitalize`}>{meta.label}</span>
    )
  }

  const renderQuality = (rating) => {
    const meta = getQualityMeta(rating)
    return (
      <div className="d-inline-flex align-items-center gap-2 fw-semibold">
        <span
          aria-hidden
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '999px',
            backgroundColor: meta.color,
            display: 'inline-block',
          }}
        ></span>
        <span>{meta.label}</span>
      </div>
    )
  }

  const renderCounters = (counters) => {
    if (!counters) return null
    return (
      <div className="d-inline-flex align-items-center gap-3">
        {TONES.map((tone) => (
          (counters[tone] ?? 0) > 0 ? (
            <span key={tone} className="d-inline-flex align-items-center gap-1">
              <span
                aria-hidden
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '999px',
                  backgroundColor: COLOR_PALETTE[tone],
                  display: 'inline-block',
                }}
              ></span>
              <span className="fw-semibold">{counters[tone] ?? 0}</span>
            </span>
          ) : null
        ))}
      </div>
    )
  }

  const renderSummaryCounters = (counters) => {
    return (
      <div className="d-flex flex-wrap gap-3">
        {TONES.map((tone) => (
          <span key={tone} className="d-inline-flex align-items-center gap-2">
            <span
              aria-hidden
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                backgroundColor: COLOR_PALETTE[tone],
                display: 'inline-block',
              }}
            ></span>
            <span className="fw-semibold">{counters?.[tone] ?? 0}</span>
          </span>
        ))}
      </div>
    )
  }

  const openGroupModal = (group) => {
    setSelectedGroup(group)
  }

  const closeGroupModal = () => {
    setSelectedGroup(null)
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-4">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <Fi.FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Status WhatsApp</h2>
              <div className="opacity-75 small">Monitore o status de todos os canais WhatsApp.</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline-info d-inline-flex align-items-center gap-2"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
          >
            {(isLoading || isRefreshing) ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              <Fi.FiRefreshCw />
            )}
            <span>Atualizar</span>
          </button>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6 col-xl-3">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small text-uppercase opacity-65 mb-2">Total de canais</div>
              <div className="display-6 fw-bold">{summary.totalGroups ?? 0}</div>
              <div className="opacity-60 small">Grupos únicos por nome</div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small text-uppercase opacity-65 mb-2">Total de telefones</div>
              <div className="display-6 fw-bold">{summary.totalNumbers ?? 0}</div>
              <div className="opacity-60 small">Soma geral de números cadastrados</div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small text-uppercase opacity-65 mb-3">Status</div>
              {renderSummaryCounters(summary.status)}
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small text-uppercase opacity-65 mb-3">Quality rating</div>
              {renderSummaryCounters(summary.quality)}
            </div>
          </div>
        </div>

        {error && (
          <div className="neo-card neo-lg p-4 mb-4 text-start">
            <div className="d-flex align-items-center gap-3">
              <Fi.FiAlertTriangle size={18} className="text-warning" />
              <div>
                <h6 className="mb-1">Falha ao carregar canais</h6>
                <div className="small opacity-75">{error}</div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary ms-auto"
                onClick={() => fetchChannels({ silent: false })}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        <div className="neo-card neo-lg p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="mb-1">Canais WhatsApp ({sortedGroups.length})</h5>
              <div className="opacity-65 small">Agrupados por nome do canal. Clique para ver os números associados.</div>
            </div>
          </div>

          {isLoading ? (
            <div className="py-5 text-center opacity-75 d-flex align-items-center justify-content-center gap-2">
              <span className="spinner-border" role="status" aria-hidden="true"></span>
              <span>Carregando canais...</span>
            </div>
          ) : sortedGroups.length === 0 ? (
            <div className="py-5 text-center opacity-75">Nenhum canal encontrado.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle">
                <thead className="table-light text-uppercase small">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.key} scope="col" className="text-nowrap">
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-decoration-none text-uppercase fw-semibold d-inline-flex align-items-center gap-1 p-0"
                          onClick={() => handleSort(column.key)}
                        >
                          {column.label}
                          {renderSortIcon(column.key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedGroups.map((group) => (
                    <tr
                      key={group.key}
                      className="border-top border-dark-subtle"
                      role="button"
                      tabIndex={0}
                      onClick={() => openGroupModal(group)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openGroupModal(group)
                        }
                      }}
                    >
                      <td>
                        <div className="fw-semibold text-light d-flex align-items-center gap-2">
                          {group.name}
                          <Fi.FiChevronRight size={14} className="opacity-50" />
                        </div>
                      </td>
                      <td className="text-nowrap fw-semibold">{group.count}</td>
                      <td>{renderCounters(group.statusCounters)}</td>
                      <td>{renderCounters(group.qualityCounters)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {selectedGroup && (
        <div
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(0, 0, 0, 0.6)', zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
          onClick={closeGroupModal}
        >
          <div
            className="neo-card neo-lg p-4"
            style={{ maxWidth: 720, width: '95%' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h5 className="mb-1">{selectedGroup.name}</h5>
                <div className="small opacity-75">{selectedGroup.count} telefone(s) vinculado(s)</div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" onClick={closeGroupModal} aria-label="Fechar">
                <Fi.FiX size={18} />
              </button>
            </div>

            <div className="list-group list-group-flush">
              {selectedGroup.entries.map((entry) => (
                <div key={`${entry.phone_id || entry.record_id}`} className="list-group-item bg-transparent text-light">
                  <div className="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">
                    <div>
                      <div className="fw-semibold">{formatPhone(entry.display_phone_number || entry.display_phone_number_api)}</div>
                      <div className="small opacity-60">ID: {entry.phone_id || entry.record_id || '—'}</div>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                      {renderStatusBadge(entry.status)}
                      {renderQuality(entry.quality_rating)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
