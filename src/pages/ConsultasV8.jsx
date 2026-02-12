import { useCallback, useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiDownload, FiEye, FiRefreshCw } from 'react-icons/fi'

const API_URL = 'https://n8n.apivieiracred.store/webhook/api/consulta-v8'

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (payload && typeof payload === 'object') return [payload]
  return []
}

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

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

export default function ConsultasV8() {
  const [rows, setRows] = useState([])
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
  const [statusFilters, setStatusFilters] = useState([])
  const [valorMin, setValorMin] = useState('')
  const [valorMax, setValorMax] = useState('')

  const fetchConsultas = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(API_URL, { method: 'GET', signal })
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
      setRows(normalizeRows(payload))
      setLastSyncAt(new Date())
    } catch (err) {
      if (err?.name === 'AbortError') return
      setRows([])
      setError(err?.message || 'Falha ao carregar consultas V8')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchConsultas(controller.signal)
    return () => controller.abort()
  }, [fetchConsultas])

  const sortedRows = useMemo(() => {
    const list = Array.isArray(rows) ? [...rows] : []
    return list.sort((a, b) => {
      const ta = new Date(a?.created_at || 0).getTime()
      const tb = new Date(b?.created_at || 0).getTime()
      return tb - ta
    })
  }, [rows])

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

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setAgeMin('')
    setAgeMax('')
    setUpdatedFrom('')
    setUpdatedTo('')
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
    statusFilters.length ||
    valorMin.trim() ||
    valorMax.trim()
  )

  useEffect(() => {
    setPage(1)
  }, [searchTerm, ageMin, ageMax, updatedFrom, updatedTo, statusFilters, valorMin, valorMax])

  const selectedStatusSet = useMemo(() => {
    return new Set(statusFilters.map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean))
  }, [statusFilters])

  const preStatusFilteredRows = useMemo(() => {
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

  const exportCSV = useCallback(() => {
    const headers = [
      'ID',
      'CPF',
      'Sexo',
      'Nascimento',
      'Nome',
      'Telefone',
      'Ultima atualizacao',
      'Status Consulta V8',
      'Valor Liberado',
      'Descricao'
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
              <h2 className="fw-bold mb-1">Consultas V8</h2>
              <div className="small opacity-75">
                {lastSyncAt ? `Ultima atualizacao: ${formatDate(lastSyncAt)}` : 'Carregando dados...'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline-info btn-sm d-flex align-items-center gap-2"
            onClick={() => fetchConsultas()}
            disabled={loading}
          >
            <FiRefreshCw size={14} />
            <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>

        <section className="mb-3">
          <div className="row g-3">
            <div className="col-12">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="opacity-75 small mb-2 text-uppercase">Filtros</div>
                <div className="d-flex flex-wrap gap-2 align-items-end">
                  <div style={{ flex: '2 1 360px', minWidth: 240 }}>
                    <label className="form-label small opacity-75 mb-1" htmlFor="v8-search">Buscar</label>
                    <input
                      id="v8-search"
                      className="form-control form-control-sm"
                      placeholder="Nome ou CPF"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: '1 1 240px', minWidth: 200 }}>
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

                  <div style={{ flex: '2 1 360px', minWidth: 260 }}>
                    <label className="form-label small opacity-75 mb-1">Ultima atualizacao</label>
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

                  <div style={{ flex: '1 1 280px', minWidth: 220 }}>
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

                  <div style={{ flex: '0 1 280px', minWidth: 240, marginLeft: 'auto' }}>
                    <div className="d-flex flex-column flex-sm-row gap-2 w-100 justify-content-end">
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
                  <div className="small opacity-75 mt-3">Total (sem status): {preStatusFilteredRows.length}</div>
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
                  <th>Ultima atualizacao</th>
                  <th>Status Consulta V8</th>
                  <th>Valor Liberado</th>
                  <th className="text-center">Descricao</th>
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
                    <div className="small opacity-75">Ultima atualizacao</div>
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
                  <div className="small opacity-75 mb-1">Descricao</div>
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
