import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as Fi from 'react-icons/fi'
import { notify } from '../utils/notify.js'
import { Link } from 'react-router-dom'

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

const ROWS_PER_PAGE = 50

export default function AdminControlePlanejamento() {
  const { user } = useAuth()
  const isMaster = (user?.role || '').toLowerCase() === 'master'
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [inactivatingId, setInactivatingId] = useState(null)
  const [renewingId, setRenewingId] = useState(null)

  const [search, setSearch] = useState('')
  const [grupo, setGrupo] = useState('')
  const [status, setStatus] = useState('')
  const [renovacaoDe, setRenovacaoDe] = useState('')
  const [renovacaoAte, setRenovacaoAte] = useState('')
  const [vencimentoDe, setVencimentoDe] = useState('')
  const [vencimentoAte, setVencimentoAte] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addAgencia, setAddAgencia] = useState('') // codigo
  const ADD_NEW_AGENCIA = '__NEW__'
  const [addNovaAgencia, setAddNovaAgencia] = useState('')
  const [addEmpresa, setAddEmpresa] = useState('')
  const [addGrupo, setAddGrupo] = useState('')
  const [addCargo, setAddCargo] = useState('')
  const [addLogin, setAddLogin] = useState('')
  const ymdLocal = (d) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    return `${yyyy}-${mm}-${dd}`
  }
  const toDateOnly = (value) => {
    if (!value) return null
    if (typeof value === 'string') {
      const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
      if (match) return match[1]
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null
      return value.toISOString().slice(0, 10)
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toISOString().slice(0, 10)
  }
  const formatDateDisplay = (value) => {
    const str = toDateOnly(value)
    if (!str) return ''
    const [yyyy, mm, dd] = str.split('-')
    return `${dd}/${mm}/${yyyy}`
  }
  const [addDataCadastro, setAddDataCadastro] = useState(() => ymdLocal(new Date()))
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isPageAnimating, setIsPageAnimating] = useState(false)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('https://n8n.sistemavieira.com.br/webhook/api/getall-vanguard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Resposta inválida da API')
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

  // Opções derivadas para o modal de Adicionar
  const agencias = useMemo(() => {
    const map = new Map()
    for (const it of (items || [])) {
      if (!it || !it.codigo) continue
      if (!map.has(it.codigo)) {
        map.set(it.codigo, { codigo: it.codigo, empresa: (it.empresa || ''), grupo: (it.grupo || '') })
      }
    }
    return Array.from(map.values()).sort((a,b) => String(a.codigo).localeCompare(String(b.codigo)))
  }, [items])

  const cargos = useMemo(() => {
    return Array.from(new Set((items || []).map(i => i.cargo).filter(Boolean))).sort()
  }, [items])

  // Atualiza empresa/grupo ao escolher agência
  useEffect(() => {
    if (!addAgencia) { setAddEmpresa(''); setAddGrupo(''); return }
    if (addAgencia === ADD_NEW_AGENCIA) { setAddEmpresa(''); setAddGrupo(''); return }
    const found = agencias.find(a => String(a.codigo) === String(addAgencia))
    setAddEmpresa(found?.empresa || '')
    setAddGrupo(found?.grupo || '')
  }, [addAgencia, agencias])

  const isNewAgencia = useMemo(() => addAgencia === ADD_NEW_AGENCIA, [addAgencia])

  // Datas derivadas
  const addRenovacao = useMemo(() => addDataCadastro, [addDataCadastro])
  const addVencimento = useMemo(() => {
    if (!addDataCadastro) return ''
    const d = new Date(addDataCadastro)
    if (isNaN(d)) return ''
    const v = new Date(d)
    v.setDate(v.getDate() + 30)
    return ymdLocal(v)
  }, [addDataCadastro])

  async function handleAddSubmit(e) {
    e?.preventDefault?.()
    if (!isMaster) {
      notify.error('Apenas Master pode adicionar usuários')
      return
    }
    // Validações simples
    if (!addAgencia) return notify.error('Selecione uma agência')
    if (isNewAgencia) {
      if (!addNovaAgencia?.trim()) return notify.error('Informe o nome da nova agência')
      if (!addEmpresa?.trim()) return notify.error('Informe a empresa')
      if (!addGrupo?.trim()) return notify.error('Selecione o grupo')
    }
    if (!addLogin) return notify.error('Informe o login')
    // nome será enviado igual ao campo empresa
    if (!addCargo) return notify.error('Selecione um cargo')
    if (!addDataCadastro) return notify.error('Informe a data de cadastro')

    const payload = {
      cargo: addCargo,
      codigo: isNewAgencia ? addNovaAgencia.trim() : addAgencia,
      data_cadastro: addDataCadastro,
      empresa: addEmpresa,
      grupo: addGrupo,
      login: addLogin,
      nome: addEmpresa,
      renovacao: addRenovacao,
      status: 'Ativo',
      vencimento: addVencimento,
    }

    try {
      setIsSubmittingAdd(true)
      const res = await fetch('https://n8n.sistemavieira.com.br/webhook/api/add-vanguard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      try { await res.json() } catch (_) { /* ignore */ }
      notify.success('Usuário adicionado com sucesso')
      setShowAdd(false)
      // limpa form
      setAddAgencia(''); setAddNovaAgencia(''); setAddEmpresa(''); setAddGrupo(''); setAddCargo(''); setAddLogin(''); setAddDataCadastro(ymdLocal(new Date()))
      await load()
    } catch (e) {
      console.error('Falha ao adicionar usuário:', e)
      notify.error(`Falha ao adicionar: ${e.message}`)
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  async function handleInativar(item) {
    if (!item || !item.id) return
    if (!isMaster) {
      notify.error('Apenas Master pode inativar usuários')
      return
    }
    try {
      setInactivatingId(item.id)
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/api/del-vanguard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Tenta ler JSON, mas não exige formato específico
      let data
      try { data = await res.json() } catch (_) { /* ignore */ }
      notify.success('Usuário inativado com sucesso')
      await load()
    } catch (e) {
      console.error('Falha ao inativar usuário:', e)
      notify.error(`Falha ao inativar: ${e.message}`)
    } finally {
      setInactivatingId(null)
    }
  }

  async function handleRenovar(item) {
    if (!item || !item.id) return
    if (!isMaster) {
      notify.error('Apenas Master pode renovar usuários')
      return
    }
    try {
      setRenewingId(item.id)
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/api/up-vanguard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      try { await res.json() } catch (_) { /* ignore non-JSON */ }
      notify.success('Usuário renovado com sucesso')
      await load()
    } catch (e) {
      console.error('Falha ao renovar usuário:', e)
      notify.error(`Falha ao renovar: ${e.message}`)
    } finally {
      setRenewingId(null)
    }
  }

  const grupos = useMemo(() => {
    return Array.from(new Set((items || []).map(i => i.grupo).filter(Boolean))).sort()
  }, [items])

  const filtered = useMemo(() => {
    const inRange = (rawValue, de, ate) => {
      const date = toDateOnly(rawValue)
      if (!date) return !(de || ate)
      if (de && date < de) return false
      if (ate && date > ate) return false
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
      if (!inRange(it.renovacao, renovacaoDe, renovacaoAte)) return false
      if (!inRange(it.vencimento, vencimentoDe, vencimentoAte)) return false
      return true
    })
  }, [items, search, grupo, status, renovacaoDe, renovacaoAte, vencimentoDe, vencimentoAte])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, grupo, status, renovacaoDe, renovacaoAte, vencimentoDe, vencimentoAte])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE
    return filtered.slice(start, start + ROWS_PER_PAGE)
  }, [filtered, currentPage])

  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return []
    const candidates = new Set([1, totalPages, currentPage])
    for (let i = currentPage - 2; i <= currentPage + 2; i += 1) {
      if (i > 1 && i < totalPages) candidates.add(i)
    }
    const pages = Array.from(candidates).sort((a, b) => a - b)
    const result = []
    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i]
      if (i > 0) {
        const prev = pages[i - 1]
        if (page - prev > 1) {
          result.push({ type: 'ellipsis', key: `ellipsis-${prev}-${page}` })
        }
      }
      result.push({ type: 'page', key: `page-${page}`, page })
    }
    return result
  }, [totalPages, currentPage])

  useEffect(() => {
    if (filtered.length === 0) return
    setIsPageAnimating(true)
    const timer = setTimeout(() => setIsPageAnimating(false), 500)
    return () => clearTimeout(timer)
  }, [currentPage, filtered.length])

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
      formatDateDisplay(i.renovacao),
      formatDateDisplay(i.vencimento),
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
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <Fi.FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Controle Planejamento</h2>
              <div className="opacity-75 small">Vanguard - Sistema de Controle de Usuários</div>
            </div>
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
              <input className="form-control" placeholder="Buscar por login, nome ou agência..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Renovação - De</label>
              <input type="date" className="form-control" value={renovacaoDe} onChange={e => setRenovacaoDe(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Renovação - Até</label>
              <input type="date" className="form-control" value={renovacaoAte} onChange={e => setRenovacaoAte(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Vencimento - De</label>
              <input type="date" className="form-control" value={vencimentoDe} onChange={e => setVencimentoDe(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small opacity-75">Vencimento - Até</label>
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
            <div className="col-12 col-md-auto ms-md-auto d-flex gap-2 justify-content-end flex-nowrap">
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setGrupo(''); setStatus(''); setRenovacaoDe(''); setRenovacaoAte(''); setVencimentoDe(''); setVencimentoAte(''); }}>
                <Fi.FiX className="me-1" />
                <span className="d-none d-sm-inline">Limpar</span>
              </button>
              <button className="btn btn-ghost btn-ghost-primary btn-sm" onClick={load} disabled={isLoading}>
                <Fi.FiRefreshCcw className="me-1" />
                <span className="d-none d-sm-inline">Atualizar</span>
              </button>
              <button className="btn btn-ghost btn-ghost-info btn-sm" onClick={downloadCsv} disabled={isLoading}>
                <Fi.FiDownload className="me-1" />
                <span className="d-none d-sm-inline">Download</span>
              </button>
              <button
                className="btn btn-ghost btn-ghost-primary btn-sm"
                disabled={!isMaster}
                title={isMaster ? 'Adicionar' : 'Apenas Master'}
                onClick={() => { if (isMaster) { setShowAdd(true) } else { notify.warn('Apenas Master pode adicionar') } }}
              >
                <Fi.FiPlus className="me-1" />
                <span className="d-none d-sm-inline">Adicionar</span>
              </button>
            </div>
          </div>
        </div>

        <div className="small opacity-75 mb-2">Mostrando {filtered.length} de {items.length} usuários</div>

        <div className="neo-card neo-lg p-0">
          {isLoading && (<div className="p-4 text-center opacity-75">Carregando...</div>)}
          {error && (<div className="p-4 alert alert-danger">{String(error)}</div>)}
          {!isLoading && !error && (
            <div className={`table-responsive ${isPageAnimating ? 'page-fade' : ''}`}>
              {totalPages > 1 && (
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
                    <th style={{width:80}}>ID</th>
                    <th>AGENCIA</th>
                    <th>LOGIN</th>
                    <th>EMPRESA</th>
                    <th>GRUPO</th>
                    <th>DATA RENOVACAO</th>
                    <th>DATA VENCIMENTO</th>
                    <th>STATUS</th>
                    <th>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="text-center opacity-75 p-4">Sem registros</td></tr>
                  )}
                  {paginated.map((i) => (
                    <tr key={i.id}>
                      <td>{i.id}</td>
                      <td>{i.codigo}</td>
                      <td className="text-uppercase">{i.login}</td>
                      <td className="text-uppercase">{i.empresa || i.nome}</td>
                      <td className="text-uppercase">{i.grupo}</td>
                      <td>{i.renovacao ? formatDateDisplay(i.renovacao) : '-'}</td>
                      <td>{i.vencimento ? formatDateDisplay(i.vencimento) : '-'}</td>
                      <td><Badge status={i.status} /></td>
                      <td>
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-ghost btn-ghost-primary btn-icon d-inline-flex align-items-center justify-content-center"
                            disabled={!isMaster || renewingId === i.id || String(i.status || '').toLowerCase() !== 'inativo'}
                            title={isMaster ? (String(i.status || '').toLowerCase() === 'inativo' ? 'Renovar' : 'Disponível apenas para Inativo') : 'Apenas Master'}
                            aria-label="Renovar"
                            onClick={() => handleRenovar(i)}
                          >
                            <Fi.FiRotateCcw />
                          </button>
                          {/*<button className="btn btn-ghost btn-ghost-danger btn-icon d-inline-flex align-items-center justify-content-center" disabled={!isMaster || inactivatingId === i.id} title={isMaster ? 'Inativar' : 'Apenas Master'} aria-label="Inativar" onClick={() => handleInativar(i)}>
                            <Fi.FiUserX />
                          </button>*/}
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
      {isMaster && showAdd && (
        <div className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" style={{background:'rgba(0,0,0,0.6)', zIndex:1050}}>
          <div className="neo-card neo-lg p-4" style={{maxWidth:720, width:'95%'}}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="mb-0">Adicionar Novo Usuário</h5>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)} aria-label="Fechar">
                <Fi.FiX />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label small">Agência *</label>
                  <select className="form-select" value={addAgencia} onChange={e => setAddAgencia(e.target.value)} required>
                    <option value="">Selecione uma opção</option>
                    <option value={ADD_NEW_AGENCIA}>+ Adicionar Nova Empresa</option>
                    {agencias.map(a => (
                      <option key={a.codigo} value={a.codigo}>{a.codigo} - {a.empresa}</option>
                    ))}
                  </select>
                </div>
                {isNewAgencia && (
                  <div className="col-12">
                    <label className="form-label small">Nova Agência *</label>
                    <input className="form-control" value={addNovaAgencia} onChange={e => setAddNovaAgencia(e.target.value)} placeholder="Digite o nome da nova agência" required={isNewAgencia} />
                  </div>
                )}
                <div className="col-12 col-md-6">
                  <label className="form-label small">Empresa {isNewAgencia ? '*' : ''}</label>
                  <input className="form-control" value={addEmpresa} onChange={e => setAddEmpresa(e.target.value)} disabled={!isNewAgencia} placeholder={isNewAgencia ? 'Digite a empresa' : 'Selecione uma agência'} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small">Grupo {isNewAgencia ? '*' : ''}</label>
                  {isNewAgencia ? (
                    <select className="form-select" value={addGrupo} onChange={e => setAddGrupo(e.target.value)} required={isNewAgencia}>
                      <option value="">Selecione um grupo</option>
                      {grupos.map(g => (<option key={g} value={g}>{g}</option>))}
                    </select>
                  ) : (
                    <input className="form-control" value={addGrupo} disabled placeholder="Selecione uma agência" />
                  )}
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small">Login *</label>
                  <input className="form-control" value={addLogin} onChange={e => setAddLogin(e.target.value)} placeholder="Digite o login" required />
                </div>
                <div className="col-12">
                  <label className="form-label small">Cargo *</label>
                  <select className="form-select" value={addCargo} onChange={e => setAddCargo(e.target.value)} required>
                    <option value="">Selecione um cargo</option>
                    {cargos.map(c => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label small">Data Cadastro *</label>
                  <input type="date" className="form-control" value={addDataCadastro} onChange={e => setAddDataCadastro(e.target.value)} required />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Data Renovação</label>
                  <input type="date" className="form-control" value={addRenovacao} disabled />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Status</label>
                  <input className="form-control" value="Ativo" disabled />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Data Vencimento</label>
                  <input type="date" className="form-control" value={addVencimento} disabled />
                </div>
              </div>
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={
                  isSubmittingAdd ||
                  (!isNewAgencia && !addAgencia) ||
                  (isNewAgencia && (!addNovaAgencia?.trim() || !addEmpresa?.trim() || !addGrupo?.trim())) ||
                  !addCargo || !addLogin
                }>Adicionar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}



