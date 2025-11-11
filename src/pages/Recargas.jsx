import { useCallback, useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import * as Fi from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { notify } from '../utils/notify.js'
import { useAuth } from '../context/AuthContext.jsx'

const endpoint = 'https://n8n.apivieiracred.store/webhook/get-saldos'

const ROWS_PER_PAGE = 100

const integer = (value) => {
  const num = Number(value) || 0
  return num.toLocaleString('pt-BR')
}

const parseRow = (raw) => {
  const total = Number(raw?.total_carregado) || 0
  const limite = Number(raw?.limite_disponivel) || 0
  const consultas = Number(raw?.consultas_realizada) || 0
  const data = raw?.data_saldo_carregado ? new Date(raw.data_saldo_carregado) : null

  return {
    id: raw?.saldo_id ?? raw?.id ?? null,
    equipeId: raw?.equipe_id ?? null,
    equipeNome: raw?.equipe_nome || 'Equipe Excluída',
    total,
    limite,
    consultas,
    data,
  }
}

export default function Recargas() {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSavingAdd, setIsSavingAdd] = useState(false)
  const [selectedTeamKey, setSelectedTeamKey] = useState('')
  const [addAmount, setAddAmount] = useState('200')
  const [currentPage, setCurrentPage] = useState(1)

  const { user } = useAuth()
  const isMaster = (user?.role || '').toLowerCase() === 'master'

  const addAmountValue = Number(addAmount)
  const showAboveRecommended = Number.isFinite(addAmountValue) && addAmountValue > 200

  const fetchRows = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Resposta inválida da API')
      setRows(data.map(parseRow).filter(r => r.id != null))
    } catch (err) {
      setError(err)
      setRows([])
      notify.error(`Falha ao carregar recargas: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const teamOptions = useMemo(() => {
    const map = new Map()
    rows.forEach(row => {
      if (!row) return
      const name = String(row.equipeNome || 'Equipe sem nome')
      const key = row.equipeId != null ? `id:${row.equipeId}` : `nome:${name}`
      if (!map.has(key)) {
        map.set(key, { key, id: row.equipeId ?? null, name })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const selectedTeam = useMemo(() => {
    return teamOptions.find(option => option.key === selectedTeamKey) ?? null
  }, [teamOptions, selectedTeamKey])

  const handleAddRecarga = () => {
    if (!isMaster) {
      notify.warn('Apenas Master pode adicionar recargas.')
      return
    }
    setSelectedTeamKey('')
    setAddAmount('200')
    setIsSavingAdd(false)
    setIsAddOpen(true)
  }

  const handleCloseAdd = () => {
    setIsAddOpen(false)
    setSelectedTeamKey('')
    setAddAmount('200')
    setIsSavingAdd(false)
  }


  const handleSubmitAddRecarga = async (event) => {
    event?.preventDefault?.()
    if (!isMaster) {
      notify.error('Apenas Master pode adicionar recargas.')
      return
    }
    if (!selectedTeam) {
      notify.error('Selecione uma equipe')
      return
    }
    if (!Number.isFinite(addAmountValue) || addAmountValue <= 0) {
      notify.error('Informe uma quantidade válida para a recarga')
      return
    }
    try {
      setIsSavingAdd(true)
      const payload = {
        equipeNome: selectedTeam.name,
        equipeId: selectedTeam.id,
        quantidade: addAmountValue,
      }
      const response = await fetch('https://n8n.apivieiracred.store/webhook/adc-saldo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        let message = ''
        try { message = (await response.text())?.trim() ?? '' } catch (_) {}
        throw new Error(message || `HTTP ${response.status}`)
      }
      notify.success('Recarga enviada com sucesso.')
      handleCloseAdd()
      await fetchRows()
    } catch (error) {
      notify.error(`Falha ao enviar recarga: ${error.message}`)
    } finally {
      setIsSavingAdd(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const hasInicio = Boolean(inicio)
    const hasFim = Boolean(fim)
    const start = hasInicio ? new Date(inicio).setHours(0, 0, 0, 0) : null
    const end = hasFim ? new Date(fim).setHours(23, 59, 59, 999) : null

    return rows.filter(row => {
      if (q) {
        const hay = `${row.id || ''} ${row.equipeNome || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (row.data) {
        const time = row.data.getTime()
        if (start != null && time < start) return false
        if (end != null && time > end) return false
      }
      return true
    })
  }, [rows, search, inicio, fim])

  useEffect(() => { setCurrentPage(1) }, [search, inicio, fim])

  useEffect(() => {
    const total = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
    if (currentPage > total) {
      setCurrentPage(total)
    }
  }, [filtered.length, currentPage])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const hasPagination = filtered.length > ROWS_PER_PAGE

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE
    return filtered.slice(start, start + ROWS_PER_PAGE)
  }, [filtered, currentPage])

  const paginationItems = useMemo(() => {
    const total = Math.ceil(filtered.length / ROWS_PER_PAGE)
    if (total <= 1) return []
    const pages = new Set([1, total, currentPage])
    for (let i = currentPage - 2; i <= currentPage + 2; i += 1) {
      if (i > 1 && i < total) pages.add(i)
    }
    const sorted = Array.from(pages).sort((a, b) => a - b)
    const items = []
    for (let i = 0; i < sorted.length; i += 1) {
      const page = sorted[i]
      if (i > 0) {
        const prev = sorted[i - 1]
        if (page - prev > 1) {
          items.push({ type: 'ellipsis', key: `ellipsis-${prev}-${page}` })
        }
      }
      items.push({ type: 'page', key: `page-${page}`, page })
    }
    return items
  }, [filtered.length, currentPage])

  const stats = useMemo(() => {
    const totalCarregado = filtered.reduce((acc, row) => acc + row.total, 0)
    const limiteDisponivel = filtered.reduce((acc, row) => acc + row.limite, 0)
    const consultas = filtered.reduce((acc, row) => acc + row.consultas, 0)
    const totalEquipes = new Set(filtered.map(row => row.equipeId ?? row.equipeNome)).size
    return { totalCarregado, limiteDisponivel, consultas, totalEquipes }
  }, [filtered])

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <Fi.FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Gestão de Recargas</h2>
              <div className="opacity-75 small">Resumo financeiro das equipes</div>
            </div>
          </div>
          <div className="d-flex align-items-center">
            <button
              type="button"
              className="btn btn-primary d-flex align-items-center gap-2"
              disabled={!isMaster}
              title={isMaster ? 'Adicionar nova recarga' : 'Apenas Master'}
              onClick={() => { if (isMaster) { handleAddRecarga() } else { notify.warn('Apenas Master pode adicionar recargas') } }}
            >
              <Fi.FiPlus size={16} />
              <span className="d-none d-sm-inline">Adicionar Recarga</span>
              <span className="d-sm-none">Nova</span>
            </button>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-lg-3 col-md-6">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small opacity-75 mb-1">Total Carregado</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiDollarSign className="opacity-50" />
                <div className="display-6 fw-bold">{integer(stats.totalCarregado)}</div>
              </div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small opacity-75 mb-1">Limite Disponível</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiTrendingUp className="opacity-50" />
                <div className="display-6 fw-bold">{integer(stats.limiteDisponivel)}</div>
              </div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small opacity-75 mb-1">Consultas Realizadas</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiActivity className="opacity-50" />
                <div className="display-6 fw-bold">{integer(stats.consultas)}</div>
              </div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="small opacity-75 mb-1">Equipes com Saldo</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiUsers className="opacity-50" />
                <div className="display-6 fw-bold">{stats.totalEquipes}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small opacity-75">Buscar por equipe ou ID</label>
              <input className="form-control" placeholder="Digite para filtrar..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small opacity-75">Inicio</label>
              <input type="date" className="form-control" value={inicio} onChange={e => setInicio(e.target.value)} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small opacity-75">Fim</label>
              <input type="date" className="form-control" value={fim} onChange={e => setFim(e.target.value)} />
            </div>
            <div className="col-12 col-md-2 d-flex justify-content-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setInicio(''); setFim('') }}>
                <Fi.FiX className="me-1" />
                Limpar
              </button>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-0">
          {isLoading && (<div className="p-4 text-center opacity-75">Carregando...</div>)}
          {error && (<div className="p-4 alert alert-danger">{error.message}</div>)}
          {!isLoading && !error && (
            <div className="table-responsive">
              {hasPagination && (
                <div className="d-flex justify-content-end px-3 pt-3">
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      title="Página anterior"
                    >
                      <Fi.FiChevronLeft />
                    </button>
                    {paginationItems.map(item => {
                      if (item.type === 'ellipsis') {
                        return (
                          <span key={item.key} className="btn btn-ghost btn-sm disabled" aria-hidden>...</span>
                        )
                      }
                      const isActive = item.page === currentPage
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setCurrentPage(item.page)}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          {item.page}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      title="Próxima página"
                    >
                      <Fi.FiChevronRight />
                    </button>
                  </div>
                </div>
              )}
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>ID</th>
                    <th style={{ width: 120 }}>Equipe ID</th>
                    <th>Equipe</th>
                    <th>Total Carregado</th>
                    <th>Limite Disponível</th>
                    <th>Consultas Realizadas</th>
                    <th style={{ width: 180 }}>Data da Recarga</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center opacity-75 p-4">Sem registros</td></tr>
                  ) : (
                    paginatedRows.map(row => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{row.equipeId ?? '-'}</td>
                        <td className="text-uppercase">{row.equipeNome}</td>
                      <td>{integer(row.total)}</td>
                      <td>{integer(row.limite)}</td>
                        <td>{integer(row.consultas)}</td>
                        <td>{row.data ? row.data.toLocaleString('pt-BR') : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
      {isMaster && isAddOpen && (
        <div
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1050 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dark p-4" style={{ maxWidth: 520, width: '95%' }}>
            <div className="d-flex align-items-start justify-content-between mb-3">
              <div>
                <h5 className="modal-dark-title mb-1">Adicionar Recarga</h5>
                <div className="small modal-dark-subtitle">Informe os dados da equipe e o valor que deseja adicionar.</div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon text-light" onClick={handleCloseAdd} aria-label="Fechar">
                <Fi.FiX />
              </button>
            </div>
            <form onSubmit={handleSubmitAddRecarga}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label small">Equipe *</label>
                  <select
                    className="form-select"
                    disabled={isSavingAdd}
                    value={selectedTeamKey}
                    onChange={event => setSelectedTeamKey(event.target.value)}
                    required
                  >
                    <option value="">Selecione uma equipe...</option>
                    {teamOptions.map(option => (
                      <option key={option.key} value={option.key}>
                        {option.name}
                        {option.id != null ? ` (ID ${option.id})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedTeam && (
                  <div className="col-12 col-md-6">
                    <label className="form-label small">ID da equipe</label>
                    <input className="form-control" value={selectedTeam.id ?? '-'} readOnly disabled />
                  </div>
                )}
                <div className={selectedTeam ? 'col-12 col-md-6' : 'col-12'}>
                  <label className="form-label small">Quantidade da recarga *</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="1"
                    disabled={isSavingAdd}
                    value={addAmount}
                    onChange={event => setAddAmount(event.target.value)}
                  />
                  <div className="form-text">Quantidade padrão 200.</div>
                  {showAboveRecommended && (
                    <div className="form-text text-primary">Para manter o controle, prefira quantidades abaixo de 200.</div>
                  )}
                </div>
              </div>
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-ghost fw-bold" onClick={handleCloseAdd} disabled={isSavingAdd}>Cancelar</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!selectedTeam || isSavingAdd}
                >
                  {isSavingAdd ? 'Enviando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
