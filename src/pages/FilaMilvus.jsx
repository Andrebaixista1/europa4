import { useCallback, useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiExternalLink, FiRefreshCw } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_MILVUS_API_URL
const AUTH_TOKEN =import.meta.env.VITE_MILVUS_AUTH_TOKEN
const REQUEST_BODY = { filtro_body: {} }
const DESK_FILTER = 'Setor Planejamento'

const unwrapList = (input) => {
  if (!input) return null
  if (Array.isArray(input)) return input
  if (typeof input === 'object') {
    if (Array.isArray(input.data)) return input.data
    if (Array.isArray(input.lista)) return input.lista
    if (Array.isArray(input.items)) return input.items
  }
  return null
}

const normalizeKey = (value = '') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()

const statusVariants = {
  nafila: 'secondary',
  aguardandousuario: 'warning',
  aguardandocliente: 'warning',
  pendentedousuario: 'warning',
  pendentedocliente: 'warning',
  pausado: 'warning',
  pausa: 'warning',
  ematendimento: 'info',
  emexecucao: 'info',
  atendendo: 'info',
  atendimento: 'info',
  resolvido: 'success',
  finalizado: 'success',
  concluido: 'success',
}

const priorityVariants = {
  alta: 'danger',
  media: 'primary',
  baixa: 'success',
}

const QUEUE_KEYWORDS = ['fila']
const WAITING_KEYWORDS = ['aguard', 'pendent', 'pausad', 'pausa', 'paus']
const ACTIVE_KEYWORDS = ['atendimento', 'execucao', 'atendendo']

const getStatusVariant = (value) => {
  const key = normalizeKey(value)
  if (statusVariants[key]) return statusVariants[key]
  const fallback = Object.entries(statusVariants).find(([pattern]) => key.includes(pattern))
  return fallback ? fallback[1] : 'secondary'
}

const getPriorityVariant = (value) => {
  const key = normalizeKey(value)
  if (priorityVariants[key]) return priorityVariants[key]
  const fallback = Object.entries(priorityVariants).find(([pattern]) => key.includes(pattern))
  return fallback ? fallback[1] : 'primary'
}

const formatDateTime = (value) => {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const adaptTickets = (items = []) =>
  items
    .filter((item) => {
      if (!DESK_FILTER) return true
      const desk = item?.mesa_trabalho ?? item?.mesaTrabalho ?? ''
      const statusKey = normalizeKey(item?.status)
      if (statusKey === 'finalizado') return false
      return normalizeKey(desk) === normalizeKey(DESK_FILTER)
    })
    .map((item) => {
      const desk = item?.mesa_trabalho ?? item?.mesaTrabalho ?? ''
      return {
        codigo: item?.codigo ?? item?.id ?? 'Sem codigo',
        cliente: item?.setor ?? item?.cliente ?? 'Nao informado',
        descricao: item?.titulo ?? item?.assunto ?? item?.descricao ?? '',
        status: item?.status ?? 'Sem status',
        prioridade: item?.prioridade ?? 'Sem prioridade',
        ultimaAtualizacao: item?.data_modificacao ?? item?.data ?? '',
        tecnico: item?.tecnico ?? item?.responsavel ?? 'Agurdando técnico',
        mesaTrabalho: desk,
      }
    })

export default function FilaMilvus() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchTickets = useCallback(async ({ silent } = {}) => {
    silent ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: AUTH_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(REQUEST_BODY),
      })

      if (!response.ok) {
        throw new Error(`Milvus retornou ${response.status}`)
      }

      const payload = await response.json()
      const rawList =
        unwrapList(payload?.lista) ||
        unwrapList(payload?.dados) ||
        unwrapList(payload?.data) ||
        unwrapList(payload?.resultados) ||
        unwrapList(payload?.conteudo) ||
        (Array.isArray(payload) ? payload : [])

      setTickets(adaptTickets(rawList))
      setLastSync(new Date())
    } catch (err) {
      console.error('Erro ao buscar fila Milvus', err)
      setError('Nao foi possivel carregar a fila agora. Tente novamente em instantes.')
    } finally {
      silent ? setRefreshing(false) : setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchTickets({ silent: true })
    }, 60000)
    return () => clearInterval(intervalId)
  }, [fetchTickets])

  const statusOptions = useMemo(() => {
    const values = new Set()
    tickets.forEach((ticket) => {
      if (ticket.status) values.add(ticket.status)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [tickets])

  const priorityOptions = useMemo(() => {
    const values = new Set()
    tickets.forEach((ticket) => {
      if (ticket.prioridade) values.add(ticket.prioridade)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [tickets])

  const filteredTickets = useMemo(() => {
    const normalizedStatus = normalizeKey(statusFilter)
    const normalizedPriority = normalizeKey(priorityFilter)
    const normalizedSearch = normalizeKey(searchTerm)

    return tickets.filter((ticket) => {
      if (normalizedStatus && normalizeKey(ticket.status) !== normalizedStatus) return false
      if (normalizedPriority && normalizeKey(ticket.prioridade) !== normalizedPriority) return false
      if (normalizedSearch) {
        const searchable = normalizeKey(`${ticket.codigo} ${ticket.cliente} ${ticket.descricao || ''}`)
        if (!searchable.includes(normalizedSearch)) return false
      }
      return true
    })
  }, [tickets, statusFilter, priorityFilter, searchTerm])

  const sortedTickets = useMemo(() => {
    const clone = [...filteredTickets]
    const hasResponsavel = (value) => {
      if (!value) return false
      const normalized = normalizeKey(value)
      return normalized.length > 0 && normalized !== 'equipemilvus'
    }
    return clone.sort((a, b) => {
      const respA = hasResponsavel(a.tecnico)
      const respB = hasResponsavel(b.tecnico)
      const statusA = normalizeKey(a.status)
      const statusB = normalizeKey(b.status)
      const isAtendendoA = statusA.includes('atendendo') || statusA.includes('atendimento')
      const isAtendendoB = statusB.includes('atendendo') || statusB.includes('atendimento')

      if (isAtendendoA !== isAtendendoB) {
        return isAtendendoA ? -1 : 1
      }

      if (respA !== respB) {
        return respA ? -1 : 1
      }

      const dateA = new Date(a.ultimaAtualizacao).getTime() || 0
      const dateB = new Date(b.ultimaAtualizacao).getTime() || 0
      if (dateA !== dateB) {
        return dateB - dateA
      }
      return String(b.codigo).localeCompare(String(a.codigo))
    })
  }, [filteredTickets])

  const metrics = useMemo(() => {
    const summary = { queue: 0, active: 0, waiting: 0 }
    tickets.forEach((ticket) => {
      const key = normalizeKey(ticket.status)
      if (!key) return

      if (QUEUE_KEYWORDS.some((pattern) => key.includes(pattern))) {
        summary.queue += 1
        return
      }

      if (WAITING_KEYWORDS.some((pattern) => key.includes(pattern))) {
        summary.waiting += 1
        return
      }

      if (ACTIVE_KEYWORDS.some((pattern) => key.includes(pattern))) {
        summary.active += 1
      }
    })
    return [
      { label: 'Na fila', value: summary.queue, helper: 'Aguardam triagem do time Milvus' },
      { label: 'Em atendimento', value: summary.active, helper: 'Tecnicos atuando agora' },
      { label: 'Pendentes do usuario', value: summary.waiting, helper: 'Dependem de retorno' },
    ]
  }, [tickets])

  const handleRefresh = () => {
    fetchTickets({ silent: tickets.length > 0 })
  }

  const handleClearFilters = () => {
    setStatusFilter('')
    setPriorityFilter('')
    setSearchTerm('')
  }

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
          <div className="d-flex align-items-center gap-3">
            <Link
              to="/dashboard"
              className="btn btn-outline-light btn-sm d-flex align-items-center gap-2"
              title="Voltar ao Dashboard"
            >
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Fila Milvus</h2>
              <p className="opacity-75 mb-0">Monitoramento interno da fila integrada com o time Milvus.</p>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-outline-light btn-sm d-flex align-items-center gap-2"
              onClick={handleRefresh}
              disabled={loading || refreshing}
            >
              {loading || refreshing ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              ) : (
                <FiRefreshCw size={16} />
              )}
              Atualizar
            </button>
            <a
              href="https://vieirartech.suport.cloud"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary d-flex align-items-center gap-2"
            >
              <FiExternalLink />
              Abrir Milvus
            </a>
          </div>
        </div>

        <div className="row g-3 mb-4">
          {metrics.map((metric) => (
            <div className="col-md-4" key={metric.label}>
              <div className="neo-card neo-lg p-4 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-uppercase small opacity-75">{metric.label}</span>
                  <span className="badge text-bg-dark">{metric.helper}</span>
                </div>
                <div className="display-5 fw-bold">{metric.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="neo-card neo-lg p-4">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
            <div>
              <h5 className="mb-1">Chamados</h5>
              <div className="opacity-75 small">Dados recebidos diretamente da API de integracao Milvus.</div>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="badge text-bg-secondary">
                Ultima sincronizacao: {lastSync ? formatDateTime(lastSync) : 'aguardando'}
              </span>
              <span className="badge text-bg-success">Total listado: {sortedTickets.length}</span>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger small d-flex align-items-center gap-2 mb-3" role="alert">
              {error}
            </div>
          )}

          <div className="row g-3 mb-3">
            <div className="col-md-4 col-lg-3">
              <label className="form-label small text-uppercase opacity-75">Buscar</label>
              <input
                type="text"
                className="form-control form-control-sm bg-dark border-0 text-light"
                placeholder="Cliente, chamado..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="col-md-4 col-lg-3">
              <label className="form-label small text-uppercase opacity-75">Status</label>
              <select
                className="form-select form-select-sm bg-dark border-0 text-light"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Todos</option>
                {statusOptions.map((status) => (
                  <option value={status} key={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4 col-lg-3">
              <label className="form-label small text-uppercase opacity-75">Prioridade</label>
              <select
                className="form-select form-select-sm bg-dark border-0 text-light"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="">Todas</option>
                {priorityOptions.map((priority) => (
                  <option value={priority} key={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4 col-lg-3 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-light btn-sm w-100"
                onClick={handleClearFilters}
                disabled={!searchTerm && !statusFilter && !priorityFilter}
              >
                Limpar filtros
              </button>
            </div>
          </div>

          <div className="table-responsive text-nowrap">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead className="text-uppercase small opacity-75">
                <tr>
                  <th>Chamado</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th>Ultima atualizacao</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      <div className="d-inline-flex align-items-center gap-2">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        <span>Carregando fila...</span>
                      </div>
                    </td>
                  </tr>
                ) : !lastSync ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 opacity-75">
                      Clique em <strong>Atualizar</strong> para carregar os chamados do Milvus.
                    </td>
                  </tr>
                ) : sortedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 opacity-75">
                      Nenhum chamado retornado para o filtro informado.
                    </td>
                  </tr>
                ) : (
                  sortedTickets.map((ticket) => (
                    <tr key={ticket.codigo}>
                      <td className="fw-semibold">{ticket.codigo}</td>
                      <td>
                        <div className="fw-semibold">{ticket.cliente}</div>
                      </td>
                      <td>
                        <span className={`badge text-bg-${getStatusVariant(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge text-bg-${getPriorityVariant(ticket.prioridade)}`}>
                          {ticket.prioridade}
                        </span>
                      </td>
                      <td>
                        <div className="fw-semibold">{formatDateTime(ticket.ultimaAtualizacao)}</div>
                        <div className="small opacity-75">Tecnico: {ticket.tecnico || 'Equipe Milvus'}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
