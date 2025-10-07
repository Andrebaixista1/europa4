import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as Fi from 'react-icons/fi'

export default function Usuarios() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [equipesLista, setEquipesLista] = useState([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formNome, setFormNome] = useState('')
  const [formTipo, setFormTipo] = useState('Operador')
  const [formSenha, setFormSenha] = useState('')
  const [formEquipeId, setFormEquipeId] = useState(null)

  useEffect(() => {
    let aborted = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('https://webhook.sistemavieira.com.br/webhook/user-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user?.id }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        const unwrap = (d) => {
          if (Array.isArray(d) && d.length > 0 && d[0] && typeof d[0] === 'object') {
            const key = Object.keys(d[0]).find(k => k.toUpperCase().startsWith('JSON_'))
            if (key && typeof d[0][key] === 'string') {
              try { return JSON.parse(d[0][key]) } catch (_) {}
            }
          }
          return d
        }

        const payload = unwrap(data)
        const mapUser = (u) => ({
          id: u?.id ?? u?.user_id ?? null,
          nome: u?.nome ?? u?.name ?? 'Usuário',
          email: u?.email ?? '',
          role: u?.role ?? u?.papel ?? 'Operador',
          equipe_id: u?.equipe_id ?? u?.team_id ?? null,
          login: u?.login ?? u?.username ?? '',
          ativo: (u?.ativo ?? u?.active ?? true) ? true : false,
        })

        let arr = []
        if (Array.isArray(payload?.usuarios)) arr = payload.usuarios.map(mapUser)
        else if (Array.isArray(payload?.users)) arr = payload.users.map(mapUser)
        else if (Array.isArray(payload?.equipes)) arr = payload.equipes.flatMap(eq => (eq.membros || [])).map(mapUser)
        else if (Array.isArray(payload)) arr = payload.map(mapUser)

        if (!arr.length) throw new Error('Resposta vazia da API')
        if (!aborted) {
          setUsuarios(arr)
          setSelectedId(arr[0]?.id ?? null)
          if (Array.isArray(payload?.equipes)) {
            const eq = payload.equipes
              .map(e => ({ id: e.id ?? e.equipe_id ?? null, nome: e.nome ?? 'Equipe' }))
              .filter(e => e.id != null)
            setEquipesLista(eq)
          } else {
            const uniq = Array.from(new Set(arr.map(u => u.equipe_id).filter(Boolean)))
            setEquipesLista(uniq.map(id => ({ id, nome: `Equipe ${id}` })))
          }
          if (user?.role === 'Supervisor' && user?.equipe_id != null) {
            setFormEquipeId(user.equipe_id)
            setFormTipo('Operador')
          } else {
            setFormEquipeId(payload?.equipes?.[0]?.id ?? arr[0]?.equipe_id ?? null)
          }
        }
      } catch (e) {
        console.error('Falha API Usuarios:', e)
        if (!aborted) { setError(e); setUsuarios([]); setSelectedId(null) }
      } finally {
        if (!aborted) setIsLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [user?.id])

  const baseUsuarios = useMemo(() => {
    const isMasterRole = user?.role === 'Master'
    const isMasterTeam = (user?.equipe_nome || '').toLowerCase() === 'master'
    if (isMasterRole || isMasterTeam) return usuarios
    if (user?.equipe_id != null) return usuarios.filter(u => u.equipe_id === user.equipe_id)
    return usuarios
  }, [usuarios, user])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return baseUsuarios
    return baseUsuarios.filter(u =>
      u.nome.toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term)
    )
  }, [baseUsuarios, search])

  const selected = useMemo(() => filtered.find(u => u.id === selectedId) || null, [filtered, selectedId])

  useEffect(() => {
    if (!filtered.some(u => u.id === selectedId)) setSelectedId(filtered[0]?.id ?? null)
  }, [filtered, selectedId])

  const isSupervisor = user?.role === 'Supervisor'
  const canManage = user?.role === 'Master' || isSupervisor || (user?.equipe_nome || '').toLowerCase() === 'master'

  function toLoginFromName(nome) {
    const s = (nome || '')
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s-]+/g, ' ')
      .trim()
      .toLowerCase()
    return s.replace(/\s+/g, '')
  }

  function handleAddSubmit(e) {
    e.preventDefault()
    const nome = formNome.trim()
    if (!nome) return
    const tipoSel = (formTipo || 'Operador').trim()
    const roleOut = (tipoSel === 'Administrador') ? 'Master' : tipoSel
    const equipeId = isSupervisor ? (user?.equipe_id ?? formEquipeId) : formEquipeId
    if (!equipeId) return
    const nextId = Math.max(0, ...usuarios.map(u => u.id || 0)) + 1
    const novo = { id: nextId, nome, login: toLoginFromName(nome), role: roleOut, equipe_id: equipeId, ativo: true, is_supervisor: roleOut === 'Supervisor' }
    setUsuarios(prev => [novo, ...prev])
    setSelectedId(nextId)
    setIsAddOpen(false)
    setFormNome('')
    setFormSenha('')
    if (!isSupervisor) setFormTipo('Operador')
  }

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div>
            <h2 className="fw-bold mb-1">Usuários</h2>
            <div className="opacity-75 small">Gerencie contas, perfis e acessos</div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex gap-2 mb-3">
                <input value={search} onChange={(e) => setSearch(e.target.value)} className="form-control" placeholder="Buscar usuário..." />
                <button className="btn btn-outline-secondary" onClick={() => setSearch('')} aria-label="Limpar busca" title="Limpar">
                  <Fi.FiX />
                </button>
              </div>
              {isLoading && (<div className="text-center py-4 opacity-75">Carregando...</div>)}
              {error && (<div className="alert alert-danger py-2">{String(error)}</div>)}
              {!isLoading && !error && (
                <ul className="list-group">
                  {filtered.length === 0 && (<li className="list-group-item text-center opacity-75">Nenhum usuário encontrado</li>)}
                  {filtered.map((u) => (
                    <li key={u.id} className={`list-group-item d-flex justify-content-between align-items-center ${selectedId === u.id ? 'active' : ''}`} role="button" onClick={() => setSelectedId(u.id)}>
                      <div className="me-3">
                        <div className="fw-semibold">{u.nome}</div>
                      </div>
                      <div className="text-end small opacity-85">{u.role}</div>
                    </li>
                  ))}
                </ul>
              )}
              {!error && (<div className="small mt-3 opacity-50">Dados carregados da API.</div>)}
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="neo-card neo-lg p-4 h-100">
              {!selected ? (
                <div className="opacity-75">Selecione um usuário para ver os detalhes.</div>
              ) : (
                <>
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div>
                      <h5 className="mb-1">{selected.nome}</h5>
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-primary btn-sm" disabled title="Editar" aria-label="Editar"><Fi.FiEdit /></button>
                      <button className="btn btn-outline-danger btn-sm" title="Excluir" aria-label="Excluir" disabled={selected.id === user?.id}
                        onClick={() => {
                          if (selected.id === user?.id) return
                          if (!confirm('Confirmar exclusão?')) return
                          const next = usuarios.filter(u => u.id !== selected.id)
                          setUsuarios(next)
                          setSelectedId(next[0]?.id ?? null)
                        }}>
                        <Fi.FiTrash2 />
                      </button>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="p-3 rounded-3 h-100" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="small text-uppercase opacity-75 mb-2">Perfil</div>
                        <div className="mb-1"><span className="opacity-75">Nome: </span>{selected.nome}</div>
                        <div className="mb-2"><span className="opacity-75">Tipo: </span>{selected.role}</div>
                        <button className="btn btn-outline-secondary btn-sm" disabled title="Alterar tipo" aria-label="Alterar tipo"><Fi.FiRefreshCcw /></button>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 rounded-3 h-100" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="small text-uppercase opacity-75 mb-2">Segurança</div>
                        <div className="mb-2"><span className="opacity-75">Status: </span>{selected.ativo ? 'Ativo' : 'Inativo'}</div>
                        <div className="d-flex gap-2">
                          <button className="btn btn-outline-warning btn-sm" title="Alterar senha" aria-label="Alterar senha"
                            onClick={() => { const nova = prompt('Nova senha para ' + selected.nome + ':'); if (!nova) return; alert('Senha alterada (mock). Integre com a API.') }}>
                            <Fi.FiKey />
                          </button>
                          <button className="btn btn-outline-secondary btn-sm" title={selected.ativo ? 'Desativar usuário' : 'Ativar usuário'} aria-label={selected.ativo ? 'Desativar usuário' : 'Ativar usuário'} disabled={selected.id === user?.id}
                            onClick={() => { if (selected.id === user?.id) return; setUsuarios(prev => prev.map(u => u.id === selected.id ? { ...u, ativo: !u.ativo } : u)) }}>
                            <Fi.FiLock />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 d-flex justify-content-end">
                    <button className="btn btn-primary btn-sm" title="Adicionar usuário" aria-label="Adicionar usuário" onClick={() => setIsAddOpen(true)} disabled={!canManage}>
                      <Fi.FiPlus />
                    </button>
                  </div>
                </>
              )}
              <div className="small mt-3 opacity-75">Integração prevista: GET/POST/PUT em /usuarios</div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {isAddOpen && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Adicionar usuário</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setIsAddOpen(false)}></button>
              </div>
              <form onSubmit={handleAddSubmit}>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label">Nome</label>
                    <input className="form-control" value={formNome} onChange={(e) => setFormNome(e.target.value)} required />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Tipo</label>
                    <select className="form-select" value={isSupervisor ? 'Operador' : formTipo} onChange={(e) => setFormTipo(e.target.value)} disabled={isSupervisor}>
                      <option>Master</option>
                      <option>Administrador</option>
                      <option>Supervisor</option>
                      <option>Operador</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Senha</label>
                    <input type="password" className="form-control" value={formSenha} onChange={(e) => setFormSenha(e.target.value)} required />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Equipe</label>
                    <select className="form-select" value={isSupervisor ? (user?.equipe_id ?? '') : (formEquipeId ?? '')} onChange={(e) => setFormEquipeId(parseInt(e.target.value, 10))} disabled={isSupervisor} required>
                      <option value="" disabled>Selecione...</option>
                      {(equipesLista || []).map(eq => (<option key={eq.id} value={eq.id}>{eq.nome}</option>))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={!formNome.trim() || (!isSupervisor && !formEquipeId)}>Salvar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

