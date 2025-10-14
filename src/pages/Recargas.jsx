import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'

const MOCK_RECARGAS = [
  { id: 101, data: '2025-10-10T13:40:00Z', usuario_id: 1, usuario_nome: 'ALICE', equipe_id: 10, equipe_nome: 'MATRIZ', valor: 120.50, status: 'Pendente' },
  { id: 102, data: '2025-10-11T09:10:00Z', usuario_id: 2, usuario_nome: 'BRUNO', equipe_id: 11, equipe_nome: 'EXPANDE', valor: 310.00, status: 'Aprovada' },
  { id: 103, data: '2025-10-12T16:20:00Z', usuario_id: 3, usuario_nome: 'CARLA', equipe_id: 10, equipe_nome: 'MATRIZ', valor: 80.00, status: 'Pendente' },
  { id: 104, data: '2025-10-12T18:05:00Z', usuario_id: 4, usuario_nome: 'DIOGO', equipe_id: 12, equipe_nome: 'FILIAL SUL', valor: 200.00, status: 'Rejeitada' },
  { id: 105, data: '2025-10-13T11:00:00Z', usuario_id: 2, usuario_nome: 'BRUNO', equipe_id: 11, equipe_nome: 'EXPANDE', valor: 150.00, status: 'Pendente' },
]

function Badge({ value }) {
  const v = (value || '').toLowerCase()
  const cls = v === 'aprovada' ? 'text-bg-success' : v === 'rejeitada' ? 'text-bg-danger' : 'text-bg-warning'
  return <span className={`badge ${cls}`}>{value}</span>
}

export default function Recargas() {
  const { user } = useAuth()
  const [rows, setRows] = useState(MOCK_RECARGAS)
  const [search, setSearch] = useState('')
  const role = user?.role || 'Operador'
  const equipeId = user?.equipe_id ?? null

  useEffect(() => {
    notify.info('Gestão de Recargas (teste) — em desenvolvimento')
  }, [])

  const visible = useMemo(() => {
    let base = rows
    // Master vê tudo; demais veem somente suas equipes e próprias recargas
    if (role !== 'Master') {
      base = base.filter(r => (r.usuario_id === user?.id) || (equipeId != null && r.equipe_id === equipeId))
    }
    const q = search.trim().toLowerCase()
    if (q) {
      base = base.filter(r => `${r.id} ${r.usuario_nome} ${r.equipe_nome}`.toLowerCase().includes(q))
    }
    return base
  }, [rows, role, equipeId, search, user])

  const stats = useMemo(() => {
    const total = visible.length
    const aprov = visible.filter(r => r.status === 'Aprovada').length
    const pend = visible.filter(r => r.status === 'Pendente').length
    const rej = visible.filter(r => r.status === 'Rejeitada').length
    const soma = visible.reduce((acc, r) => acc + (Number(r.valor) || 0), 0)
    return { total, aprov, pend, rej, soma }
  }, [visible])

  const alterarStatus = (id, novo) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: novo } : r))
  }

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
              <div className="opacity-75 small">Controle e aprovação de recargas</div>
            </div>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-lg-3 col-md-6">
            <div className="neo-card p-3 h-100">
              <div className="small opacity-75">Total</div>
              <div className="display-6 fw-bold">{stats.total}</div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="neo-card p-3 h-100">
              <div className="small opacity-75">Aprovadas</div>
              <div className="display-6 fw-bold">{stats.aprov}</div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="neo-card p-3 h-100">
              <div className="small opacity-75">Pendentes</div>
              <div className="display-6 fw-bold">{stats.pend}</div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="neo-card p-3 h-100">
              <div className="small opacity-75">Valor Total (visível)</div>
              <div className="display-6 fw-bold">R$ {stats.soma.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="neo-card p-4 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small opacity-75">Buscar</label>
              <input className="form-control" placeholder="Buscar por usuário/equipe..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-12 col-md-4 d-flex justify-content-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}><Fi.FiX className="me-1" />Limpar</button>
            </div>
          </div>
        </div>

        <div className="neo-card p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{width:80}}>ID</th>
                  <th>DATA</th>
                  <th>USUÁRIO</th>
                  <th>EQUIPE</th>
                  <th>VALOR</th>
                  <th>STATUS</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} className="text-center opacity-75 p-4">Sem registros</td></tr>
                )}
                {visible.map(r => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{new Date(r.data).toLocaleString('pt-BR')}</td>
                    <td className="text-uppercase">{r.usuario_nome}</td>
                    <td className="text-uppercase">{r.equipe_nome}</td>
                    <td>R$ {Number(r.valor).toFixed(2)}</td>
                    <td><Badge value={r.status} /></td>
                    <td>
                      <div className="d-flex gap-2">
                        <button className="btn btn-ghost btn-ghost-success btn-icon" title="Aprovar" disabled={r.status === 'Aprovada'} onClick={() => alterarStatus(r.id, 'Aprovada')}>
                          <Fi.FiCheck />
                        </button>
                        <button className="btn btn-ghost btn-ghost-danger btn-icon" title="Rejeitar" disabled={r.status === 'Rejeitada'} onClick={() => alterarStatus(r.id, 'Rejeitada')}>
                          <Fi.FiX />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
