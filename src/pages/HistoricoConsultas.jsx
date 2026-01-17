import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { FiArrowLeft, FiDownload, FiEye, FiPrinter } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Roles } from '../utils/roles.js'
import '../styles/historico.css'

const LOG_TIME_OFFSET_HOURS = 3

const getRegistroDate = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(d.getHours() + LOG_TIME_OFFSET_HOURS)
  return d
}

const getDateKey = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatCpf = (value = '') => {
  const v = String(value).replace(/\D/g, '').slice(0, 11)
  const parts = []
  if (v.length > 0) parts.push(v.slice(0, 3))
  if (v.length > 3) parts.push(v.slice(3, 6))
  if (v.length > 6) parts.push(v.slice(6, 9))
  const rest = v.slice(9, 11)
  let out = parts[0] || ''
  if (parts[1]) out = `${parts[0]}.${parts[1]}`
  if (parts[2]) out = `${parts[0]}.${parts[1]}.${parts[2]}`
  if (rest.length > 0) out = `${out}-${rest}`
  return out
}

const formatBeneficio = (value = '') => {
  const v = String(value).replace(/\D/g, '').slice(0, 10)
  const p1 = v.slice(0, 3)
  const p2 = v.slice(3, 6)
  const p3 = v.slice(6, 9)
  const p4 = v.slice(9, 10)
  let out = ''
  if (p1) out = p1
  if (p2) out = `${p1}.${p2}`
  if (p3) out = `${p1}.${p2}.${p3}`
  if (p4) out = `${p1}.${p2}.${p3}-${p4}`
  return out
}

const parseISODateParts = (value) => {
  const m = String(value || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
}

const partsToBR = (p) => `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${String(p.y)}`

const formatDate = (iso) => {
  if (!iso) return '-'
  const p = parseISODateParts(iso)
  if (p) return partsToBR(p)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const formatTime = (iso) => (
  iso
    ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' })
    : '--:--'
)

const idadeFrom = (iso) => {
  if (!iso) return '-'
  const parts = parseISODateParts(iso)
  const birth = parts ? new Date(parts.y, parts.m - 1, parts.d) : new Date(iso)
  if (Number.isNaN(birth.getTime())) return '-'
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const month = today.getMonth() - birth.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}

const brCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

const mapTipoCredito = (value) => {
  if (!value) return '-'
  if (value === 'magnetic_card') return 'Cartao magnetico'
  if (value === 'checking_account') return 'Conta Corrente'
  return value
}

const mapSituacao = (value) => (value === 'elegible' ? 'Elegivel' : value || '-')

const fetchBanco = async (code, signal) => {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/banks/v1/${code}`, { signal })
    if (!res.ok) throw new Error('fail')
    const data = await res.json()
    return { code: data.code || code, name: data.name || data.fullName || String(code) }
  } catch (_) {
    if (signal?.aborted) return null
    return { code, name: String(code) }
  }
}

function fmtDateTime(iso) {
  const d = getRegistroDate(iso)
  if (!d) return '-'
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}

function fmtCPF(v) {
  const d = String(v ?? '').replace(/\D/g, '')
  if (!d) return 'xxx.xxx.xxx-xx'
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
  return d
}
function fmtNB(v) {
  const d = String(v ?? '').replace(/\D/g, '')
  if (!d) return 'xxx.xxx.xxx-x'
  if (d.length === 10) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 10)}`
  return d
}

function parseLooseList(text) {
  const t = String(text || '').trim()
  if (!t) return []
  try { return JSON.parse(t) } catch { }
  const wrapped = '[' + t
    .replace(/}\s*,\s*{/g, '},{')
    .replace(/}\s*[\r\n]+\s*{/g, '},{')
    .replace(/,\s*$/, '') + ']'
  try { return JSON.parse(wrapped) } catch { }
  return []
}

function dedupeByCpfNbLogin(list) {
  const arr = Array.isArray(list) ? list : []
  const byKey = new Map()

  const ts = (row) => {
    const t = Date.parse(row?.data_hora_registro ?? '')
    return Number.isFinite(t) ? t : -Infinity
  }

  for (const row of arr) {
    if (!row) continue
    const cpf = String(row?.numero_documento ?? '').replace(/\D/g, '')
    const nb = String(row?.numero_beneficio ?? '').replace(/\D/g, '')
    const login = String(row?.login ?? row?.usuario_nome ?? '').trim().toLowerCase()

    const hasMainKey = Boolean(cpf || nb || login)
    const key = hasMainKey
      ? `cpf:${cpf}|nb:${nb}|login:${login}`
      : [
          String(row?.data_hora_registro ?? ''),
          String(row?.status_api ?? '').trim(),
          String(row?.resposta_api ?? '').trim()
        ].join('|')

    const prev = byKey.get(key)
    if (!prev || ts(row) > ts(prev)) byKey.set(key, row)
  }

  return Array.from(byKey.values()).sort((a, b) => ts(b) - ts(a))
}

export default function HistoricoConsultas() {
  const { user } = useAuth()
  const [rows, setRows] = useState(null) // null = carregando
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailBanco, setDetailBanco] = useState(null)
  const pageSize = 50

  useEffect(() => {
    if (!user?.id) return
    const controller = new AbortController()
    const signal = controller.signal

      ; (async () => {
        try {
          setError('')
          const equipeId = (user?.equipe_id ?? null)
          const role = user?.role
          const nivel = role === Roles.Master ? 'master' : role === Roles.Administrador ? 'adm' : role === Roles.Supervisor ? 'super' : 'operador'
          const payload = { id: user.id, equipe_id: equipeId, nivel }
          const res = await fetch('https://n8n.apivieiracred.store/webhook/consulta-logs-in100', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(payload),
            signal
          })
          const raw = await res.text().catch(() => '')
          if (!res.ok) throw new Error(raw || ('HTTP ' + res.status))
          let data
          try { data = JSON.parse(raw) } catch { data = parseLooseList(raw) }
          let arr = []
          if (Array.isArray(data)) arr = data
          else if (Array.isArray(data?.data)) arr = data.data
          else if (Array.isArray(data?.rows)) arr = data.rows
          else if (data && typeof data === 'object') arr = [data]
          if (!signal.aborted) setRows(arr)
        } catch (e) {
          if (signal.aborted) return
          setRows([])
          setError(e?.message || 'Erro ao carregar')
        }
      })()

    return () => controller.abort()
  }, [user?.id])

  useEffect(() => {
    if (!selectedRow) {
      setDetailData(null)
      setDetailError('')
      setDetailLoading(false)
      setDetailBanco(null)
      return undefined
    }

    const controller = new AbortController()
    const signal = controller.signal
    const cpf = String(selectedRow?.numero_documento ?? '').replace(/\D/g, '')
    const nb = String(selectedRow?.numero_beneficio ?? '').replace(/\D/g, '')
    const id = selectedRow?.id_usuario ?? selectedRow?.id ?? user?.id ?? null

    setDetailLoading(true)
    setDetailError('')
    setDetailData(null)
    setDetailBanco(null)

    if (!id || (!cpf && !nb)) {
      setDetailLoading(false)
      setDetailError('Dados insuficientes para consultar detalhes.')
      return () => controller.abort()
    }

    let active = true
    ;(async () => {
      try {
        const res = await fetch('https://n8n.apivieiracred.store/webhook/consulta-online-repostas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, cpf, nb }),
          signal,
        })
        const text = await res.text().catch(() => '')
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
        let data = null
        try { data = JSON.parse(text) } catch { throw new Error('Resposta invalida da API.') }
        let item = null
        if (Array.isArray(data)) item = data[0]
        else if (Array.isArray(data?.data)) item = data.data[0]
        else if (Array.isArray(data?.rows)) item = data.rows[0]
        else if (data && typeof data === 'object') item = data
        if (!item) throw new Error('Nenhum detalhe encontrado.')
        if (!active) return
        setDetailData(item)
        if (item?.banco_desembolso) {
          const banco = await fetchBanco(item.banco_desembolso, signal)
          if (active && banco) setDetailBanco(banco)
        }
      } catch (err) {
        if (!active || err?.name === 'AbortError') return
        setDetailError(err?.message || 'Erro ao carregar detalhes.')
      } finally {
        if (active) setDetailLoading(false)
      }
    })()

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedRow, user?.id])

  const items = useMemo(() => dedupeByCpfNbLogin(rows), [rows])
  const statusOptions = useMemo(() => {
    const set = new Set()
    for (const row of items) {
      const status = String(row?.status_api ?? '').trim()
      if (status) set.add(status)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [items])

  const dateOptions = useMemo(() => {
    const byKey = new Map()
    for (const row of items) {
      const d = getRegistroDate(row?.data_hora_registro)
      if (!d) continue
      const key = getDateKey(d)
      if (!byKey.has(key)) byKey.set(key, d)
    }
    return Array.from(byKey.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, d]) => ({ value, label: d.toLocaleDateString('pt-BR') }))
  }, [items])

  const filteredItems = useMemo(() => {
    if (!items.length) return []
    return items.filter((row) => {
      if (statusFilter) {
        const status = String(row?.status_api ?? '').trim()
        if (status !== statusFilter) return false
      }
      if (dateFilter) {
        const d = getRegistroDate(row?.data_hora_registro)
        if (!d) return false
        if (getDateKey(d) !== dateFilter) return false
      }
      return true
    })
  }, [items, statusFilter, dateFilter])
  const pages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(page, pages)
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, currentPage])
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, filteredItems.length)

  // Sempre volta para a primeira página ao recarregar os dados
  useEffect(() => { setPage(1) }, [items.length, statusFilter, dateFilter])

  const stats = useMemo(() => {
    const total = filteredItems.length
    let sucesso = 0
    let pendentes = 0
    for (const r of filteredItems) {
      const status = r?.status_api
      const resp = String(r?.resposta_api || '').toLowerCase()
      if (status === 'Sucesso') sucesso += 1
      else if (status == null || resp === 'pendente') pendentes += 1
    }
    const falhas = Math.max(0, total - sucesso - pendentes)
    return { total, sucesso, falhas, pendentes }
  }, [filteredItems])

  const exportCSV = () => {
    const headers = ['Data/Hora', 'Status', 'Pesquisa', 'Nome', 'CPF', 'NB', 'Data Nascimento', 'UF', 'Login']
    const out = filteredItems.map(r => {
      const login = String(r?.login || r?.usuario_nome || '')
      let nome = String(r?.nome || '')
      if (login && nome.endsWith(login)) {
        nome = nome.slice(0, -login.length)
      }
      // Remove trailing commas and whitespace
      nome = nome.replace(/[, ]+$/, '')
      if (!nome) nome = '-'
      return [
        fmtDateTime(r?.data_hora_registro),
        r?.status_api ?? '',
        r?.resposta_api ?? '',
        nome,
        r?.numero_documento ?? '',
        r?.numero_beneficio ?? '',
        fmtDate(r?.data_nascimento),
        r?.estado ?? '',
        login,
      ]
    })
    const csv = [headers, ...out]
      .map(row => row.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';'))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'historico_consultas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const detail = useMemo(() => {
    if (!selectedRow) return null
    if (!detailData) return selectedRow
    const merged = { ...selectedRow }
    for (const [key, value] of Object.entries(detailData)) {
      if (value !== null && value !== undefined && value !== '') {
        merged[key] = value
      }
    }
    return merged
  }, [selectedRow, detailData])
  const detailUpdatedAt = detail?.data_retorno_consulta || detail?.data_consulta || detail?.data_hora_registro || null
  const detailUpdatedLabel = detailUpdatedAt ? `${formatDate(detailUpdatedAt)} as ${formatTime(detailUpdatedAt)}` : null
  const textOrDash = (value) => {
    if (value === null || value === undefined) return '-'
    const str = String(value).trim()
    return str ? str : '-'
  }
  const birthIso = detail?.data_nascimento
  const birthAge = birthIso ? idadeFrom(birthIso) : '-'
  const birthLabel = birthIso
    ? `${formatDate(birthIso)}${birthAge !== '-' ? ` (${birthAge} anos)` : ''}`
    : '-'
  const moneyValue = (value) => (value == null ? '-' : brCurrency(value))

  return (
    <div className="hc-page bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="mb-2">
          <Link to="/dashboard" className="btn btn-outline-light d-inline-flex align-items-center gap-2" title="Voltar ao Dashboard">
            <FiArrowLeft size={16} />
            <span className="d-none d-sm-inline">Voltar</span>
          </Link>
        </div>
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div>
            <h2 className="fw-bold mb-1">Histórico de Consultas</h2>
            <div className="opacity-75 small">Acompanhe e filtre os resultados das consultas (IN100).</div>
          </div>
          <button type="button" className="btn btn-outline-light d-inline-flex align-items-center gap-2" onClick={exportCSV}>
            <FiDownload />
            <span>Exportar CSV</span>
          </button>
        </div>

        <section className="mb-4">
          <div className="row g-2">
            <div className="col-12 col-md-6 col-lg-2">
              <div className="neo-card neo-lg p-3 text-center hc-stat-card">
                <div className="opacity-75 small mb-1">Total</div>
                <div className="display-6 fw-bold mb-0">{stats.total}</div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-2">
              <div className="neo-card neo-lg p-3 text-center hc-stat-card">
                <div className="opacity-75 small mb-1">Sucesso</div>
                <div className="display-6 fw-bold mb-0">{stats.sucesso}</div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-2">
              <div className="neo-card neo-lg p-3 text-center hc-stat-card">
                <div className="opacity-75 small mb-1">Falhas</div>
                <div className="display-6 fw-bold mb-0">{stats.falhas}</div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-2">
              <div className="neo-card neo-lg p-3 text-center hc-stat-card">
                <div className="opacity-75 small mb-1">Pendentes</div>
                <div className="display-6 fw-bold mb-0">{stats.pendentes}</div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-4">
              <div className="neo-card neo-lg p-3 hc-stat-card">
                <div className="opacity-75 small mb-2 text-uppercase">Filtros</div>
                <div className="d-flex flex-column gap-2">
                  <div>
                    <label className="form-label small opacity-75 mb-1" htmlFor="hc-status-filter">Status</label>
                    <select
                      id="hc-status-filter"
                      className="form-select form-select-sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      disabled={statusOptions.length === 0}
                    >
                      <option value="">Todos</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label small opacity-75 mb-1" htmlFor="hc-date-filter">Data/Hora</label>
                    <select
                      id="hc-date-filter"
                      className="form-select form-select-sm"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      disabled={dateOptions.length === 0}
                    >
                      <option value="">Todas as datas</option>
                      {dateOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => {
                      setStatusFilter('')
                      setDateFilter('')
                      setPage(1)
                    }}
                    disabled={!statusFilter && !dateFilter}
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="neo-card neo-lg p-0">
          {filteredItems.length > 0 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
              <div className="small opacity-75">Exibindo {startIndex}-{endIndex} de {filteredItems.length}</div>
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                <button type="button" className={`btn btn-sm ${currentPage === 1 ? 'btn-primary' : 'btn-outline-light'}`} onClick={() => setPage(1)}>1</button>
                {currentPage > 3 && <span className="opacity-50">...</span>}
                {Array.from({ length: 5 }, (_, i) => currentPage - 2 + i)
                  .filter(p => p > 1 && p < pages)
                  .map(p => (
                    <button key={p} type="button" className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-outline-light'}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                {currentPage < pages - 2 && <span className="opacity-50">...</span>}
                {pages > 1 && (
                  <button type="button" className={`btn btn-sm ${currentPage === pages ? 'btn-primary' : 'btn-outline-light'}`} onClick={() => setPage(pages)}>{pages}</button>
                )}
                <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={currentPage === pages}>›</button>
              </div>
            </div>
          )}
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: '150px' }}>Data/Hora</th>
                  <th style={{ minWidth: '110px' }}>Status</th>
                  <th style={{ minWidth: '160px' }}>Pesquisa</th>
                  <th style={{ minWidth: '200px' }}>Nome</th>
                  <th style={{ minWidth: '140px' }}>CPF</th>
                  <th style={{ minWidth: '140px' }}>NB</th>
                  <th style={{ minWidth: '140px' }}>Data Nasc.</th>
                  <th style={{ minWidth: '80px' }}>UF</th>
                  <th style={{ minWidth: '160px' }}>Login</th>
                  <th style={{ minWidth: '90px' }} className="text-center">Verificar</th>
                </tr>
              </thead>
              <tbody>
                {rows === null ? (
                  <tr>
                    <td colSpan={10} className="text-center opacity-75 py-4">Carregando...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="text-center text-danger py-4">Erro ao carregar: {error}</td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center opacity-75 py-4">Nenhuma consulta encontrada.</td>
                  </tr>
                ) : (
                  pageItems.map((r, idx) => {
                    const login = String(r?.login || r?.usuario_nome || '')
                    let nome = String(r?.nome || '')
                    if (login && nome.endsWith(login)) {
                      nome = nome.slice(0, -login.length)
                    }
                    // Remove trailing commas and whitespace
                    nome = nome.replace(/[, ]+$/, '')
                    if (!nome) nome = '-'
                    return (
                      <tr key={(r?.id_usuario ?? idx) + '-' + (r?.numero_beneficio ?? '') + '-' + idx}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r?.data_hora_registro)}</td>
                        <td>
                          {(() => {
                            const status = r?.status_api
                            const cls = status === 'Sucesso' ? 'text-bg-success' : (status == null ? 'text-bg-warning' : 'text-bg-danger')
                            const titleTxt = String(status ?? '')
                            return (
                              <span className={`badge rounded-pill px-2 status-badge ${cls}`} title={titleTxt} aria-label={titleTxt}>i</span>
                            )
                          })()}
                        </td>
                        <td>{r?.resposta_api || ''}</td>
                        <td className="text-nowrap">{nome || '-'}</td>
                        <td>{fmtCPF(r?.numero_documento)}</td>
                        <td>{fmtNB(r?.numero_beneficio)}</td>
                        <td>{fmtDate(r?.data_nascimento)}</td>
                        <td>{r?.estado || '-'}</td>
                        <td className="text-nowrap">{login}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            title="Verificar"
                            aria-label="Verificar"
                            onClick={() => setSelectedRow(r)}
                          >
                            <FiEye size={18} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      {selectedRow && (
        <div
          className="modal fade show hc-modal"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedRow(null)}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered hc-modal-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content modal-dark hc-modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detalhes da consulta</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setSelectedRow(null)}></button>
              </div>
              <div className="modal-body hc-modal-body">
                {detailUpdatedLabel && (
                  <div className="small opacity-75 mb-3">Atualizado: {detailUpdatedLabel}</div>
                )}
                {detail && (
                  <div className="row g-2 mb-3">
                    <div className="col-12 col-lg-6">
                      <div className="small opacity-75">Status</div>
                      <div className="fw-semibold text-break">{textOrDash(detail?.status_api)}</div>
                    </div>
                    <div className="col-12 col-lg-6">
                      <div className="small opacity-75">Pesquisa</div>
                      <div className="fw-semibold text-break">{textOrDash(detail?.resposta_api)}</div>
                    </div>
                  </div>
                )}
                {detailLoading && (
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <div className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>
                    <span>Carregando detalhes...</span>
                  </div>
                )}
                {detailError && (
                  <div className="alert alert-danger py-2 px-3 small mb-3">{detailError}</div>
                )}
                {detail && (
                  <>
                    <div className="neo-card p-3 mb-3">
                      <div className="fw-semibold mb-2">Dados pessoais</div>
                      <div className="row g-2">
                        <div className="col-12 col-lg-5">
                          <div className="small opacity-75">Nome</div>
                          <div className="fw-semibold text-break">{textOrDash(detail?.nome)}</div>
                        </div>
                        <div className="col-6 col-lg-3">
                          <div className="small opacity-75">CPF</div>
                          <div className="fw-semibold">{detail?.numero_documento ? formatCpf(detail.numero_documento) : '-'}</div>
                        </div>
                        <div className="col-6 col-lg-2">
                          <div className="small opacity-75">Idade</div>
                          <div className="fw-semibold">{birthLabel}</div>
                        </div>
                        <div className="col-6 col-lg-2">
                          <div className="small opacity-75">UF</div>
                          <div className="fw-semibold">{textOrDash(detail?.estado)}</div>
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
                          <div className="kv-value">{detail?.numero_beneficio ? formatBeneficio(detail.numero_beneficio) : '-'}</div>
                          <div className="kv-label">Especie:</div>
                          <div className="kv-value">-</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Situacao:</div>
                          <div className="kv-value">{mapSituacao(detail?.situacao_beneficio)}</div>
                          <div className="kv-label">Data de concessao:</div>
                          <div className="kv-value">{detail?.data_concessao ? formatDate(detail.data_concessao) : '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">UF:</div>
                          <div className="kv-value">{textOrDash(detail?.estado)}</div>
                          <div className="kv-label">Despacho do beneficio:</div>
                          <div className="kv-value">-</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Representante / Procurador:</div>
                          <div className="kv-value">{textOrDash(detail?.nome_representante_legal)}</div>
                          <div className="kv-label">Portabilidades:</div>
                          <div className="kv-value">{detail?.numero_portabilidades != null ? String(detail.numero_portabilidades) : '-'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-12 col-lg-4">
                        <div className="neo-card stat-card h-100">
                          <div className="p-3">
                            <div className="stat-title">Saldo Cartao Beneficio</div>
                            <div className="stat-value">{moneyValue(detail?.saldo_cartao_beneficio)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12 col-lg-4">
                        <div className="neo-card stat-card h-100">
                          <div className="p-3">
                            <div className="stat-title">Saldo Cartao Consignado</div>
                            <div className="stat-value">{moneyValue(detail?.saldo_cartao_consignado)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12 col-lg-4">
                        <div className="neo-card stat-card h-100">
                          <div className="p-3">
                            <div className="stat-title">Margem disponivel</div>
                            <div className="stat-value">{moneyValue(detail?.saldo_total_disponivel)}</div>
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
                          <div className="kv-value">{textOrDash(detail?.banco_desembolso)}</div>
                          <div className="kv-label">Nome do banco:</div>
                          <div className="kv-value">{detailBanco?.name || '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Agencia:</div>
                          <div className="kv-value">{textOrDash(detail?.agencia_desembolso)}</div>
                          <div className="kv-label">Conta:</div>
                          <div className="kv-value">{textOrDash(detail?.conta_desembolso)}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Digito:</div>
                          <div className="kv-value">{textOrDash(detail?.digito_desembolso)}</div>
                          <div className="kv-label">Tipo de credito:</div>
                          <div className="kv-value">{mapTipoCredito(detail?.tipo_credito)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-light" onClick={() => window.print()}>
                  <FiPrinter className="me-2" />
                  Imprimir
                </button>
                <button type="button" className="btn btn-outline-light" onClick={() => setSelectedRow(null)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
