import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as Fi from 'react-icons/fi'
import { notify } from '../utils/notify.js'

function StatCard({ title, value, icon: Icon, accent = 'primary' }) {
  return (
    <div className={`neo-card neo-lg p-4 neo-accent-${accent} h-100`}>
      <div className="d-flex align-items-center justify-content-between">
        <div>
          <div className="small opacity-75 mb-1">{title}</div>
          <div className="display-6 fw-bold">{value}</div>
        </div>
        {Icon && (
          <div className="icon-wrap d-inline-flex align-items-center justify-content-center rounded-3" aria-hidden>
            <Icon size={28} />
          </div>
        )}
      </div>
    </div>
  )
}

function Badge({ status }) {
  const s = (status || '').toLowerCase()
  const cls = s === 'ativo' ? 'text-bg-success' : (s === 'inativo' ? 'text-bg-danger' : 'text-bg-warning')
  const label = status || 'Aguardando'
  return <span className={`badge ${cls}`}>{label}</span>
}

export default function AdminControlePlanejamento() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [grupo, setGrupo] = useState('')
  const [status, setStatus] = useState('')
  const [renovacaoDe, setRenovacaoDe] = useState('')
  const [renovacaoAte, setRenovacaoAte] = useState('')
  const [vencimentoDe, setVencimentoDe] = useState('')
  const [vencimentoAte, setVencimentoAte] = useState('')

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('https://n8n.sistemavieira.com.br/webhook/api/getall-vanguard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Resposta invalida da API')
      setItems(data)
    } catch (e) {
      console.error('Falha ao carregar Vanguard:', e)
      setError(e)
      notify.error(`Falha ao carregar dados: ${e.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const grupos = useMemo(() => {
    return Array.from(new Set((items || []).map(i => i.grupo).filter(Boolean))).sort()
  }, [items])

  const filtered = useMemo(() => {
    const parseDate = (s) => (s ? new Date(s) : null)
    const inRange = (d, de, ate) => {
      if (!d) return !(de || ate) ? true : false
      const t = d.getTime()
      if (de) { const tde = new Date(de).setHours(0,0,0,0); if (t < tde) return false }
      if (ate) { const tate = new Date(ate).setHours(23,59,59,999); if (t > tate) return false }
      return true
    }
    const q = search.trim().toLowerCase()
    const st = status.trim().toLowerCase()
    const gp = grupo.trim().toLowerCase()
    return (items || []).filter(it => {
      if (q) {
        const hay = `${it.login || ''} ${it.nome || ''} ${it.codigo || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (gp && (String(it.grupo || '').toLowerCase() !== gp)) return false
      if (st && String(it.status || '').toLowerCase() !== st) return false
      const ren = parseDate(it.renovacao)
      if (!inRange(ren, renovacaoDe, renovacaoAte)) return false
      const ven = parseDate(it.vencimento)
      if (!inRange(ven, vencimentoDe, vencimentoAte)) return false
      return true
    })
  }, [items, search, grupo, status, renovacaoDe, renovacaoAte, vencimentoDe, vencimentoAte])

  const stats = useMemo(() => {
    const base = filtered
    const total = base.length
    const ativos = base.filter(i => (i.status || '').toLowerCase() === 'ativo').length
    const inativos = base.filter(i => (i.status || '').toLowerCase() === 'inativo').length
    const aguard = base.filter(i => (i.status || '').toLowerCase() === 'aguardando').length
    return { total, ativos, inativos, aguard }
  }, [filtered])

  const downloadCsv = () => {
    const header = ['ID','AGENCIA','LOGIN','EMPRESA','GRUPO','DATA RENOVACAO','DATA VENCIMENTO','STATUS']
    const rows = filtered.map(i => [
      i.id,
      i.codigo,
      i.login,
      (i.empresa || i.nome || ''),
      (i.grupo || ''),
      i.renovacao ? new Date(i.renovacao).toLocaleDateString('pt-BR') : '',
      i.vencimento ? new Date(i.vencimento).toLocaleDateString('pt-BR') : '',
      (i.status || '')
    ])
    const lines = [header, ...rows].map(r => r.map(v => String(v).replaceAll('"','""')).map(v => `"${v}"`).join(';'))
    const csv = '\ufeff' + lines.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')
    a.download = `controle-planejamento-${stamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h2 className="fw-bold mb-1">Controle Planejamento</h2>
            <div className="opacity-75 small">Vanguard - Sistema de Controle de Usuarios</div>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-lg-3 col-md-6"><StatCard title="Total" value={stats.total} icon={Fi.FiUsers} accent="primary" /></div>
          <div className="col-lg-3 col-md-6"><StatCard title="Ativos" value={stats.ativos} icon={Fi.FiUserCheck} accent="success" /></div>
          <div className="col-lg-3 col-md-6"><StatCard title="Inativos" value={stats.inativos} icon={Fi.FiUserX} accent="danger" /></div>
          <div className="col-lg-3 col-md-6"><StatCard title="Aguardando" value={stats.aguard} icon={Fi.FiClock} accent="warning" /></div>
        </div>

        <div className="neo-card neo-lg p-4 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small opacity-75">Buscar</label>
              <input className="form-control" placeholder="Buscar por login, nome ou agencia..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Renovacao - De</label>
              <input type="date" className="form-control" value={renovacaoDe} onChange={e => setRenovacaoDe(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Renovacao - Ate</label>
              <input type="date" className="form-control" value={renovacaoAte} onChange={e => setRenovacaoAte(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Vencimento - De</label>
              <input type="date" className="form-control" value={vencimentoDe} onChange={e => setVencimentoDe(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Vencimento - Ate</label>
              <input type="date" className="form-control" value={vencimentoAte} onChange={e => setVencimentoAte(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Grupos</label>
              <select className="form-select" value={grupo} onChange={e => setGrupo(e.target.value)}>
                <option value="">Todos os Grupos</option>
                {grupos.map(g => (<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Status</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">Todos os Status</option>
                <option>Ativo</option>
                <option>Inativo</option>
                <option>Aguardando</option>
              </select>
            </div>
            <div className="col-12 col-md-4 d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={() => { setSearch(''); setGrupo(''); setStatus(''); setRenovacaoDe(''); setRenovacaoAte(''); setVencimentoDe(''); setVencimentoAte(''); }}>Limpar</button>
              <button className="btn btn-outline-light" onClick={load} disabled={isLoading}><Fi.FiRefreshCcw className="me-1" /> Atualizar</button>
              <button className="btn btn-outline-info" onClick={downloadCsv} disabled={isLoading}><Fi.FiDownload className="me-1" /> Download</button>
              <button className="btn btn-primary" disabled title="Apenas Supervisor pode adicionar"><Fi.FiPlus className="me-1" /> Adicionar</button>
            </div>
          </div>
        </div>

        <div className="small opacity-75 mb-2">Mostrando {filtered.length} de {items.length} usuarios</div>

        <div className="neo-card neo-lg p-0">
          {isLoading && (<div className="p-4 text-center opacity-75">Carregando...</div>)}
          {error && (<div className="p-4 alert alert-danger">{String(error)}</div>)}
          {!isLoading && !error && (
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{width:80}}>ID</th>
                    <th>AGENCIA</th>
                    <th>LOGIN</th>
                    <th>EMPRESA</th>
                    <th>GRUPO</th>
                    <th>DATA RENOVACAO</th>
                    <th>DATA VENCIMENTO</th>
                    <th>STATUS</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="text-center opacity-75 p-4">Sem registros</td></tr>
                  )}
                  {filtered.map((i) => (
                    <tr key={i.id}>
                      <td>{i.id}</td>
                      <td>{i.codigo}</td>
                      <td className="text-uppercase">{i.login}</td>
                      <td className="text-uppercase">{i.empresa || i.nome}</td>
                      <td className="text-uppercase">{i.grupo}</td>
                      <td>{i.renovacao ? new Date(i.renovacao).toLocaleDateString('pt-BR') : '-'}</td>
                      <td>{i.vencimento ? new Date(i.vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                      <td><Badge status={i.status} /></td>
                      <td>
                        <div className="d-flex gap-2">
                          <button className="btn btn-outline-primary btn-sm d-inline-flex align-items-center justify-content-center" disabled={user?.role !== 'Master'} title={user?.role === 'Master' ? 'Renovar' : 'Apenas Master'} aria-label="Renovar">
                            <Fi.FiRotateCcw />
                          </button>
                          <button className="btn btn-outline-danger btn-sm d-inline-flex align-items-center justify-content-center" disabled={user?.role !== 'Master'} title={user?.role === 'Master' ? 'Inativar' : 'Apenas Master'} aria-label="Inativar">
                            <Fi.FiUserX />
                          </button>
                        </div>
                      </td>
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
