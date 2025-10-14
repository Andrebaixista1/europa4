import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'

const MOCK_RECARGAS = [
  { id: 101, data: '2025-10-10T13:40:00Z', usuario_id: 1, usuario_nome: 'ALICE', login: 'alice', equipe_id: 10, equipe_nome: 'MATRIZ', valor: 120.50, limite: 5000, consultas: 668, status: 'Pendente' },
  { id: 102, data: '2025-10-11T09:10:00Z', usuario_id: 2, usuario_nome: 'BRUNO', login: 'bruno', equipe_id: 11, equipe_nome: 'EXPANDE', valor: 310.00, limite: 1467, consultas: 3533, status: 'Aprovada' },
  { id: 103, data: '2025-10-12T16:20:00Z', usuario_id: 3, usuario_nome: 'CARLA', login: 'carla', equipe_id: 10, equipe_nome: 'MATRIZ', valor: 80.00, limite: 3709, consultas: 1291, status: 'Pendente' },
  { id: 104, data: '2025-10-12T18:05:00Z', usuario_id: 4, usuario_nome: 'DIOGO', login: 'diogo', equipe_id: 12, equipe_nome: 'FILIAL SUL', valor: 200.00, limite: 3548, consultas: 1452, status: 'Rejeitada' },
  { id: 105, data: '2025-10-13T11:00:00Z', usuario_id: 2, usuario_nome: 'BRUNO', login: 'bruno', equipe_id: 11, equipe_nome: 'EXPANDE', valor: 150.00, limite: 4186, consultas: 814, status: 'Pendente' },
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
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const role = user?.role || 'Operador'
  const equipeId = user?.equipe_id ?? null

  useEffect(() => {
    const key = 'ne_recargas_dev_notice'
    if (!sessionStorage.getItem(key)) {
      notify.warn('Gestão de Recargas (teste) — em desenvolvimento', { toastId: 'recargas-dev' })
      sessionStorage.setItem(key, '1')
    }
  }, [])

  const visible = useMemo(() => {
    let base = rows
    // Master vê tudo; demais veem somente suas equipes e próprias recargas
    if (role !== 'Master') {
      base = base.filter(r => (r.usuario_id === user?.id) || (equipeId != null && r.equipe_id === equipeId))
    }
    const q = search.trim().toLowerCase()
    if (q) {
      base = base.filter(r => `${r.id} ${r.usuario_nome} ${r.equipe_nome} ${r.login || ''}`.toLowerCase().includes(q))
    }
    const inRange = (d, de, ate) => {
      if (!de && !ate) return true
      const t = new Date(d).getTime()
      if (de) { const td = new Date(de).setHours(0,0,0,0); if (t < td) return false }
      if (ate) { const ta = new Date(ate).setHours(23,59,59,999); if (t > ta) return false }
      return true
    }
    base = base.filter(r => inRange(r.data, inicio, fim))
    return base
  }, [rows, role, equipeId, search, inicio, fim, user])

  const stats = useMemo(() => {
    const totalCarregado = visible.reduce((acc, r) => acc + (Number(r.valor) || 0), 0)
    const limiteDisponivel = visible.reduce((acc, r) => acc + (Number(r.limite) || 0), 0)
    const consultasRealizadas = visible.reduce((acc, r) => acc + (Number(r.consultas) || 0), 0)
    const totalUsuarios = new Set(visible.map(r => r.usuario_id)).size
    return { totalCarregado, limiteDisponivel, consultasRealizadas, totalUsuarios }
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

        <div className="row g-3 mb-3">
          <div className="col-lg-3 col-md-6">
            <div className="neo-card p-4 h-100">
              <div className="small opacity-75">TOTAL CARREGADO</div>
              <div className="display-6 fw-bold">{stats.totalCarregado.toLocaleString('pt-BR')}</div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="neo-card p-4 h-100">
              <div className="small opacity-75">LIMITE DISPONÍVEL</div>
              <div className="display-6 fw-bold">{stats.limiteDisponivel.toLocaleString('pt-BR')}</div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="neo-card p-4 h-100">
              <div className="small opacity-75">CONSULTAS REALIZADAS</div>
              <div className="display-6 fw-bold">{stats.consultasRealizadas.toLocaleString('pt-BR')}</div>
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
            <div className="col-12 col-md-6">
              <label className="form-label small opacity-75">Buscar</label>
              <input className="form-control" placeholder="Buscar por usuário/equipe..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-12 col-md-4 ms-md-auto d-flex justify-content-end align-items-end gap-2">
              <div className="w-auto">
                <label className="form-label small opacity-75">Quantidade</label>
                <input type="number" min="1" className="form-control" placeholder="Qtd" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
              </div>
              <div className="pb-1">
                <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setQuantidade('') }}>
                  <Fi.FiX className="me-1" />
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="neo-card p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{width:110}}>ID RECARGA</th>
                  <th style={{width:110}}>ID USU�RIO</th>
                  <th>LOGIN</th>
                  <th>TOTAL CARREGADO</th>
                  <th>LIMITE DISPON�VEL</th>
                  <th>CONSULTAS REALIZADAS</th>
                  <th>DATA DA RECARGA</th>
                  <th style={{width:120}}>A��ES</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={8} className="text-center opacity-75 p-4">Sem registros</td></tr>
                )}
                {visible.map(r => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.usuario_id}</td>
                    <td className="text-lowercase">{r.login || (r.usuario_nome || '').toLowerCase()}</td>
                    <td>{Number(r.valor).toFixed(3)}</td>
                    <td>{Number(r.limite || 0).toLocaleString('pt-BR')}</td>
                    <td>{Number(r.consultas || 0).toLocaleString('pt-BR')}</td>
                    <td>{new Date(r.data).toLocaleString('pt-BR')}</td>
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
              </tbody>            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}






