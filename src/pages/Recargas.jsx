import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'

const endpoint = 'https://webhook.sistemavieira.com.br/webhook/get-saldos'

const currency = (value) => {
  const num = Number(value) || 0
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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
    equipeNome: raw?.equipe_nome || 'Equipe Excluida',
    total,
    limite,
    consultas,
    data,
  }
}

export default function Recargas() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  useEffect(() => {
    let aborted = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(endpoint, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('Resposta inválida da API')
        if (!aborted) setRows(data.map(parseRow).filter(r => r.id != null))
      } catch (err) {
        if (!aborted) {
          setError(err)
          setRows([])
          notify.error(`Falha ao carregar recargas: ${err.message}`)
        }
      } finally {
        if (!aborted) setIsLoading(false)
      }
    }

    load()
    return () => { aborted = true }
  }, [])

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

        <div className="neo-card neo-lg p-4 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small opacity-75">Buscar por equipe ou ID</label>
              <input className="form-control" placeholder="Digite para filtrar..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small opacity-75">Início</label>
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
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center opacity-75 p-4">Sem registros</td></tr>
                  )}
                  {filtered.map(row => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.equipeId ?? '-'}</td>
                      <td className="text-uppercase">{row.equipeNome}</td>
                      <td>{currency(row.total)}</td>
                      <td>{currency(row.limite)}</td>
                      <td>{integer(row.consultas)}</td>
                      <td>{row.data ? row.data.toLocaleString('pt-BR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
