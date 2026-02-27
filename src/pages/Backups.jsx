import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

const BACKUPS_HEALTH_URL = String(import.meta.env.VITE_BACKUPS_HEALTH_URL || '/api/health-consult').trim()
const BACKUPS_FORCE_URL = String(import.meta.env.VITE_BACKUPS_FORCE_URL || '/api/health-consult/force-backup').trim()
const REQUEST_TIMEOUT_MS = 20000
const FORCE_POLL_INTERVAL_MS = 5000
const FORCE_POLL_MAX_TRIES = 90
const FORCE_TYPE_OPTIONS = [
  { value: 'daily', label: 'Diário (daily)' },
  { value: 'weekly', label: 'Semanal (weekly)' },
  { value: 'monthly', label: 'Mensal (monthly)' }
]
const FORCE_TYPE_SET = new Set(FORCE_TYPE_OPTIONS.map((item) => item.value))

const toList = (value) => (Array.isArray(value) ? value : [])

const parseDateLike = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDateTime = (value) => {
  const parsed = parseDateLike(value)
  if (!parsed) return '-'
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatDateTimeCompact = (value) => {
  const parsed = parseDateLike(value)
  if (!parsed) return '-'
  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const hour = String(parsed.getHours()).padStart(2, '0')
  const minute = String(parsed.getMinutes()).padStart(2, '0')
  return `${day}/${month} ${hour}:${minute}`
}

const formatNumber = (value) => {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num.toLocaleString('pt-BR') : '0'
}

const formatTimerHours = (value) => {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return '-'
  if (num <= 0) return '0min'
  const totalSeconds = Math.round(num * 3600)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    if (minutes > 0) return `${hours}h ${minutes}min`
    return `${hours}h`
  }
  if (minutes > 0) return `${minutes}min`
  return `${seconds}s`
}

const getStatusMeta = ({ pendingCount, errorsCount }) => {
  if (errorsCount > 0) {
    return {
      label: 'Crítico',
      color: '#ff4d4f'
    }
  }
  if (pendingCount > 0) {
    return {
      label: 'Atenção',
      color: '#f7c948'
    }
  }
  return {
    label: 'OK',
    color: '#22c55e'
  }
}

const normalizeServers = (payload) => {
  if (Array.isArray(payload?.servers)) return payload.servers
  return []
}

const normalizeTableName = (item) => String(
  item?.name_database ??
  item?.database ??
  item?.table ??
  item?.tabela ??
  item?.name ??
  ''
).trim()

const normalizeTableLastBackup = (item) => String(
  item?.last_backup ??
  item?.latest_backup ??
  item?.lastead_backup ??
  item?.backup_at ??
  item?.datetime ??
  ''
).trim()

const normalizeTableKey = (value) => String(value ?? '').trim().toLowerCase()

const normalizeBackedUpTables = (tablesSource, lastBackupSource) => {
  const lastBackupMap = new Map()
  toList(lastBackupSource).forEach((item) => {
    if (!item || typeof item !== 'object') return
    const name = normalizeTableName(item)
    const lastBackup = normalizeTableLastBackup(item)
    const key = normalizeTableKey(name)
    if (!key || !lastBackup) return
    if (!lastBackupMap.has(key)) lastBackupMap.set(key, lastBackup)
  })

  const rows = toList(tablesSource)
    .map((item, idx) => {
      if (item && typeof item === 'object') {
        const name = normalizeTableName(item)
        const directLastBackup = normalizeTableLastBackup(item)
        if (!name && !directLastBackup) return null
        const key = normalizeTableKey(name)
        return {
          key: `obj-${idx}-${name || directLastBackup}`,
          name: name || `Tabela ${idx + 1}`,
          lastBackup: directLastBackup || (key ? String(lastBackupMap.get(key) || '') : '')
        }
      }

      const rawName = String(item ?? '').trim()
      if (!rawName) return null
      const key = normalizeTableKey(rawName)
      return {
        key: `str-${idx}-${rawName}`,
        name: rawName,
        lastBackup: key ? String(lastBackupMap.get(key) || '') : ''
      }
    })
    .filter(Boolean)

  const existing = new Set(rows.map((entry) => normalizeTableKey(entry?.name)))
  toList(lastBackupSource).forEach((item, idx) => {
    if (!item || typeof item !== 'object') return
    const name = normalizeTableName(item)
    const lastBackup = normalizeTableLastBackup(item)
    const key = normalizeTableKey(name)
    if (!key || existing.has(key)) return
    rows.push({
      key: `fallback-${idx}-${name}`,
      name,
      lastBackup
    })
    existing.add(key)
  })

  return rows
}

const buildForceBackupBody = ({ nameDatabase, type, pending = [] }) => {
  const params = new URLSearchParams()
  params.append('name_database', String(nameDatabase || '').trim())
  params.append('type', String(type || '').trim())
  toList(pending).forEach((item) => {
    const value = String(item || '').trim()
    if (value) params.append('pending[]', value)
  })
  return params
}

const renderPeriodBlock = (period) => {
  const safe = period && typeof period === 'object' ? period : {}
  const quantity = safe?.quantity
  const timerHours = safe?.timer_hours
  const firstStart = safe?.first_start
  const lastFinish = safe?.last_finish
  const hasAnyValue = [quantity, timerHours, firstStart, lastFinish].some((value) => String(value ?? '').trim() !== '')
  if (!hasAnyValue) return <div className="small opacity-75">-</div>
  return (
    <>
      <div className="small">Qtd: {formatNumber(quantity)}</div>
      <div className="small">Tempo: {formatTimerHours(timerHours)}</div>
      <div className="small opacity-75">Início: {formatDateTime(firstStart)}</div>
      <div className="small opacity-75">Fim: {formatDateTime(lastFinish)}</div>
    </>
  )
}

export default function Backups() {
  const abortRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [forcingBackup, setForcingBackup] = useState(false)
  const [pollingForce, setPollingForce] = useState(false)
  const [error, setError] = useState('')
  const [triggerMessage, setTriggerMessage] = useState('')
  const [generatedAt, setGeneratedAt] = useState('')
  const [servers, setServers] = useState([])
  const [expandedServerKey, setExpandedServerKey] = useState('')
  const [isForceModalOpen, setIsForceModalOpen] = useState(false)
  const [forceServer, setForceServer] = useState('')
  const [forceType, setForceType] = useState('daily')
  const [isForceTableModalOpen, setIsForceTableModalOpen] = useState(false)
  const [forceTableServer, setForceTableServer] = useState('')
  const [forceTableName, setForceTableName] = useState('')
  const [forceTableType, setForceTableType] = useState('daily')

  const fetchHealth = useCallback(async ({ silent = false } = {}) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    abortRef.current = controller

    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const response = await fetch(BACKUPS_HEALTH_URL, {
        method: 'GET',
        signal: controller.signal
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(body || `HTTP ${response.status}`)
      }
      const payload = await response.json().catch(() => null)
      const normalizedServers = normalizeServers(payload)
      setGeneratedAt(String(payload?.generated_at || ''))
      setServers(normalizedServers)
      const runningCount = normalizedServers.reduce((sum, row) => sum + Number(row?.running_backup_count || 0), 0)
      return {
        servers: normalizedServers,
        runningCount
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
      setServers([])
      setGeneratedAt('')
      setError('Erro ao carregar status dos backups.')
      return null
    } finally {
      clearTimeout(timeoutId)
      if (!silent) setLoading(false)
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [fetchHealth])

  const summary = useMemo(() => {
    const totalServidores = servers.length
    const totalBases = servers.reduce((sum, row) => sum + Number(row?.quantity_databases || 0), 0)
    const totalPendencias = servers.reduce((sum, row) => sum + toList(row?.pending).length, 0)
    const totalErros = servers.reduce((sum, row) => sum + toList(row?.errors).length, 0)
    const totalExecucao = servers.reduce((sum, row) => sum + Number(row?.running_backup_count || 0), 0)
    return { totalServidores, totalBases, totalPendencias, totalErros, totalExecucao }
  }, [servers])

  const serverOptions = useMemo(() => {
    const unique = new Set()
    servers.forEach((item) => {
      const name = String(item?.name_database || '').trim()
      if (name) unique.add(name)
    })
    return Array.from(unique)
  }, [servers])

  const openForceBackupModal = useCallback(() => {
    const defaultServer = serverOptions[0] || ''
    setForceServer((prev) => prev || defaultServer)
    setForceType('daily')
    setTriggerMessage('')
    setIsForceModalOpen(true)
  }, [serverOptions])

  const closeForceBackupModal = useCallback(() => {
    if (forcingBackup) return
    setIsForceModalOpen(false)
  }, [forcingBackup])

  const openForceTableModal = useCallback((serverName, tableName) => {
    setTriggerMessage('')
    setForceTableServer(String(serverName || '').trim())
    setForceTableName(String(tableName || '').trim())
    setForceTableType('daily')
    setIsForceModalOpen(false)
    setIsForceTableModalOpen(true)
  }, [])

  const closeForceTableModal = useCallback(() => {
    if (forcingBackup) return
    setIsForceTableModalOpen(false)
  }, [forcingBackup])

  const submitForceBackup = useCallback(async (event) => {
    event.preventDefault()
    if (forcingBackup) return
    if (!forceServer) {
      setTriggerMessage('Falha ao forçar backup: selecione um servidor.')
      return
    }
    if (!FORCE_TYPE_SET.has(forceType)) {
      setTriggerMessage('Falha ao forçar backup: type inválido.')
      return
    }

    setForcingBackup(true)
    setTriggerMessage('')
    try {
      const response = await fetch(BACKUPS_FORCE_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json'
        },
        body: buildForceBackupBody({
          nameDatabase: forceServer,
          type: forceType
        })
      })
      if (!response.ok) {
        const raw = await response.text().catch(() => '')
        throw new Error(raw || `HTTP ${response.status}`)
      }
      setTriggerMessage('Backup forçado com sucesso. Aguardando finalizar execução...')
      setIsForceModalOpen(false)
      setPollingForce(true)
      let finished = false
      for (let attempt = 1; attempt <= FORCE_POLL_MAX_TRIES; attempt += 1) {
        const snapshot = await fetchHealth({ silent: true })
        const runningCount = Number(snapshot?.runningCount || 0)
        if (runningCount <= 0) {
          finished = true
          break
        }
        setTriggerMessage(`Backup em andamento. Em execução: ${runningCount}. Atualizando...`)
        await new Promise((resolve) => setTimeout(resolve, FORCE_POLL_INTERVAL_MS))
      }
      if (finished) {
        setTriggerMessage('Backup finalizado. Não há mais itens em execução.')
      } else {
        setTriggerMessage('Backup enviado. Ainda existem itens em execução; continue acompanhando.')
      }
      await fetchHealth({ silent: false })
    } catch (err) {
      setTriggerMessage(`Falha ao forçar backup: ${err?.message || 'erro desconhecido'}`)
    } finally {
      setPollingForce(false)
      setForcingBackup(false)
    }
  }, [fetchHealth, forceServer, forceType, forcingBackup])

  const submitForceTableBackup = useCallback(async (event) => {
    event.preventDefault()
    if (forcingBackup) return
    if (!forceTableServer || !forceTableName) {
      setTriggerMessage('Falha ao forçar backup individual: servidor ou tabela inválido.')
      return
    }
    if (!FORCE_TYPE_SET.has(forceTableType)) {
      setTriggerMessage('Falha ao forçar backup individual: type inválido.')
      return
    }

    setForcingBackup(true)
    setTriggerMessage('')
    try {
      const response = await fetch(BACKUPS_FORCE_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json'
        },
        body: buildForceBackupBody({
          nameDatabase: forceTableServer,
          type: forceTableType,
          pending: [forceTableName]
        })
      })
      if (!response.ok) {
        const raw = await response.text().catch(() => '')
        throw new Error(raw || `HTTP ${response.status}`)
      }
      setTriggerMessage('Backup individual forçado com sucesso. Aguardando finalizar execução...')
      setIsForceTableModalOpen(false)
      setPollingForce(true)
      let finished = false
      for (let attempt = 1; attempt <= FORCE_POLL_MAX_TRIES; attempt += 1) {
        const snapshot = await fetchHealth({ silent: true })
        const runningCount = Number(snapshot?.runningCount || 0)
        if (runningCount <= 0) {
          finished = true
          break
        }
        setTriggerMessage(`Backup individual em andamento. Em execução: ${runningCount}. Atualizando...`)
        await new Promise((resolve) => setTimeout(resolve, FORCE_POLL_INTERVAL_MS))
      }
      if (finished) {
        setTriggerMessage('Backup individual finalizado. Não há mais itens em execução.')
      } else {
        setTriggerMessage('Backup individual enviado. Ainda existem itens em execução; continue acompanhando.')
      }
      await fetchHealth({ silent: false })
    } catch (err) {
      setTriggerMessage(`Falha ao forçar backup individual: ${err?.message || 'erro desconhecido'}`)
    } finally {
      setPollingForce(false)
      setForcingBackup(false)
    }
  }, [fetchHealth, forceTableName, forceTableServer, forceTableType, forcingBackup])

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-3">
          <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
            <Fi.FiArrowLeft size={16} />
            <span className="d-none d-sm-inline">Voltar</span>
          </Link>
          <div>
            <h2 className="fw-bold mb-1">Backups</h2>
            <div className="opacity-75 small">Monitoramento da saúde dos backups por servidor</div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 px-3 mb-3 small">{error}</div>}
        {triggerMessage && (
          <div className={`alert py-2 px-3 mb-3 small ${triggerMessage.startsWith('Falha') ? 'alert-warning' : 'alert-success'}`}>
            {triggerMessage}
          </div>
        )}

        <div className="row g-3">
          <div className="col-12">
            <section className="neo-card neo-lg p-3 p-md-4">
              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-3">
                  <div className="small text-uppercase opacity-75">Gerado em</div>
                  <div className="fw-semibold">{formatDateTime(generatedAt)}</div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="small text-uppercase opacity-75">Servidores</div>
                  <div className="fw-semibold">{formatNumber(summary.totalServidores)}</div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="small text-uppercase opacity-75">Bases</div>
                  <div className="fw-semibold">{formatNumber(summary.totalBases)}</div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="small text-uppercase opacity-75">Pendências</div>
                  <div className="fw-semibold">{formatNumber(summary.totalPendencias)}</div>
                </div>
                <div className="col-6 col-md-1">
                  <div className="small text-uppercase opacity-75">Erros</div>
                  <div className="fw-semibold">{formatNumber(summary.totalErros)}</div>
                </div>
                <div className="col-12 col-md-2 d-flex justify-content-md-end">
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-outline-light btn-sm d-inline-flex align-items-center justify-content-center gap-2" onClick={fetchHealth} disabled={loading || forcingBackup}>
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <span className="d-inline-flex align-items-center lh-1">
                          <Fi.FiRefreshCw size={14} style={{ display: 'block' }} />
                        </span>
                      )}
                      Atualizar
                    </button>
                    <button type="button" className="btn btn-primary btn-sm d-inline-flex align-items-center justify-content-center gap-2" onClick={openForceBackupModal} disabled={loading || forcingBackup}>
                      <span className="d-inline-flex align-items-center lh-1">
                        <Fi.FiPlay size={14} style={{ display: 'block' }} />
                      </span>
                      Forçar backup
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="col-12">
            <section className="neo-card neo-lg p-0 overflow-hidden">
              <div className="section-bar px-3 py-2 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <Fi.FiDatabase className="opacity-75" />
                  <span className="fw-semibold">Status por servidor</span>
                </div>
                <div className="small opacity-75">Em execução: {formatNumber(summary.totalExecucao)}</div>
              </div>

              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Servidor</th>
                      <th>Último backup</th>
                      <th>Bases</th>
                      <th>Status</th>
                      <th>Em execução</th>
                      <th>Diário</th>
                      <th>Semanal</th>
                      <th>Mensal</th>
                      <th>Coletado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={9} className="text-center py-4 opacity-75">Carregando status dos backups...</td>
                      </tr>
                    )}

                    {!loading && servers.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-4 opacity-75">Nenhum servidor retornado.</td>
                      </tr>
                    )}

                    {!loading && servers.map((row, index) => {
                      const serverName = String(row?.name_database || '-').trim()
                      const latest = row?.latest_backup || row?.lastead_backup || ''
                      const pendingCount = toList(row?.pending).length
                      const errorsCount = toList(row?.errors).length
                      const daily = row?.daily || {}
                      const weekly = row?.weekly || {}
                      const monthly = row?.monthly || {}
                      const tables = normalizeBackedUpTables(row?.backed_up_databases, row?.databases_last_backup)
                      const status = getStatusMeta({ pendingCount, errorsCount })
                      const rowKey = `${String(row?.name_database || 'server').trim()}-${index}`
                      const isExpanded = expandedServerKey === rowKey
                      return (
                        [
                          <tr
                            key={`main-${rowKey}`}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedServerKey((prev) => (prev === rowKey ? '' : rowKey))}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setExpandedServerKey((prev) => (prev === rowKey ? '' : rowKey))
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="fw-semibold">
                              <span className="d-inline-flex align-items-center gap-2">
                                {isExpanded ? <Fi.FiChevronDown size={14} className="opacity-75" /> : <Fi.FiChevronRight size={14} className="opacity-75" />}
                                {serverName}
                              </span>
                            </td>
                            <td>{formatDateTime(latest)}</td>
                            <td>{formatNumber(row?.quantity_databases)}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <span
                                  className="status-dot-anim"
                                  title={status.label}
                                  aria-label={status.label}
                                  style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '999px',
                                    backgroundColor: status.color,
                                    display: 'inline-block',
                                    boxShadow: `0 0 0 2px ${status.color}33`
                                  }}
                                />
                                <span className="small fw-semibold">{status.label}</span>
                              </div>
                              <div className="small opacity-75 mt-1">
                                Pendências: {formatNumber(pendingCount)} | Erros: {formatNumber(errorsCount)}
                              </div>
                            </td>
                            <td>{formatNumber(row?.running_backup_count)}</td>
                            <td>{renderPeriodBlock(daily)}</td>
                            <td>{renderPeriodBlock(weekly)}</td>
                            <td>{renderPeriodBlock(monthly)}</td>
                            <td>{formatDateTime(row?.collected_at)}</td>
                          </tr>,
                          isExpanded && (
                            <tr key={`details-${rowKey}`}>
                              <td colSpan={9} style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <div className="py-3 px-1">
                                  <div className="d-flex align-items-center gap-2 mb-3">
                                    <Fi.FiLayers size={14} className="opacity-75" />
                                    <div className="small text-uppercase opacity-75">Tabelas com backup</div>
                                  </div>
                                  {tables.length > 0 ? (
                                    <div className="row g-1">
                                      {tables.map((tableItem, tableIndex) => (
                                        <div key={`${rowKey}-${tableItem.key}-${tableIndex}`} className="col-6 col-sm-4 col-md-3 col-lg-2 col-xl-1">
                                          <div
                                            className="d-flex flex-column justify-content-between rounded-3 p-1 h-100"
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => openForceTableModal(serverName, tableItem.name)}
                                            onKeyDown={(event) => {
                                              if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                openForceTableModal(serverName, tableItem.name)
                                              }
                                            }}
                                            style={{
                                              minHeight: 72,
                                              aspectRatio: '1 / 1',
                                              background: 'linear-gradient(180deg, rgba(10,24,52,0.85), rgba(7,18,40,0.85))',
                                              border: '1px solid rgba(214, 229, 255, 0.75)',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            <div>
                                              <span className="small text-break d-block" style={{ fontSize: '0.92rem', lineHeight: 1.15 }}>{tableItem.name}</span>
                                              <span className="d-block opacity-75" style={{ fontSize: '0.78rem', lineHeight: 1.15 }}>
                                                Últ.: {formatDateTimeCompact(tableItem.lastBackup)}
                                              </span>
                                            </div>
                                            <div className="d-flex justify-content-end">
                                              <Fi.FiDatabase size={18} className="opacity-75" />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="small opacity-75">Nenhuma tabela informada para este servidor.</div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        ]
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
      {isForceModalOpen && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.55)', position: 'fixed', inset: 0, zIndex: 1050 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Forçar backup</h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={closeForceBackupModal} disabled={forcingBackup}></button>
              </div>
              <form onSubmit={submitForceBackup}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Servidor</label>
                    <select
                      className="form-select"
                      value={forceServer}
                      onChange={(event) => setForceServer(event.target.value)}
                      disabled={forcingBackup || serverOptions.length === 0}
                    >
                      {serverOptions.length === 0 && <option value="">Nenhum servidor disponível</option>}
                      {serverOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={forceType}
                      onChange={(event) => setForceType(event.target.value)}
                      disabled={forcingBackup}
                    >
                      {FORCE_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeForceBackupModal} disabled={forcingBackup}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={forcingBackup || !forceServer}>
                    {forcingBackup ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Enviando...
                      </>
                    ) : (
                      'Forçar backup'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {isForceTableModalOpen && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.55)', position: 'fixed', inset: 0, zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Forçar backup da tabela</h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={closeForceTableModal} disabled={forcingBackup}></button>
              </div>
              <form onSubmit={submitForceTableBackup}>
                <div className="modal-body">
                  <div className="mb-2">
                    <div className="small text-uppercase opacity-75">Servidor</div>
                    <div className="fw-semibold">{forceTableServer || '-'}</div>
                  </div>
                  <div className="mb-3">
                    <div className="small text-uppercase opacity-75">Tabela</div>
                    <div className="fw-semibold text-break">{forceTableName || '-'}</div>
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={forceTableType}
                      onChange={(event) => setForceTableType(event.target.value)}
                      disabled={forcingBackup}
                    >
                      {FORCE_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeForceTableModal} disabled={forcingBackup}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={forcingBackup || !forceTableServer || !forceTableName}>
                    {forcingBackup ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Enviando...
                      </>
                    ) : (
                      'Forçar backup'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
