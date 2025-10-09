import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'
import { Link } from 'react-router-dom'
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
  const [isSaving, setIsSaving] = useState(false)
  const [formNome, setFormNome] = useState('')
  const [formLogin, setFormLogin] = useState('')
  const [formTipo, setFormTipo] = useState('Operador')
  const [formSenha, setFormSenha] = useState('')
  const [formEquipeId, setFormEquipeId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const normalizeId = (value) => {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return Number.isNaN(num) ? null : num
  }

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
          nome: u?.nome ?? u?.name ?? 'usuário',
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
          
          // Processar equipes corretamente
          if (Array.isArray(payload?.equipes)) {
            const eq = payload.equipes.map(e => ({
              id: e.id ?? e.equipe_id ?? null,
              nome: e.nome ?? `Equipe ${e.id}`,
              descricao: e.descricao || ''
            })).filter(e => e.id != null)
            
            setEquipesLista(eq)
          } else {
            // Fallback: criar equipes baseado nos usuários
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

  // Atualizar login automaticamente baseado no nome
  const handleNomeChange = (nome) => {
    setFormNome(nome)
    if (!formLogin || formLogin === toLoginFromName(formNome)) {
      setFormLogin(toLoginFromName(nome))
    }
  }

  // Função para abrir modal de adicionar usuário
  const handleOpenAddModal = () => {
    // Limpar formulário
    setFormNome('')
    setFormLogin('')
    setFormSenha('')
    setFormTipo('Operador')
    
    // Para supervisores, definir automaticamente a equipe
    if (isSupervisor && user?.equipe_id) {
      setFormEquipeId(user.equipe_id)
    } else {
      setFormEquipeId(equipesLista[0]?.id || null)
    }
    
    setIsAddOpen(true)
  }

  async function handleAddSubmit(e) {
    e.preventDefault()
    console.log('🚀 Iniciando handleAddSubmit...')
    
    const nome = formNome.trim()
    const login = formLogin.trim()
    const senha = formSenha.trim()
    
    console.log('📋 Dados do formulário:', { nome, login, senha, formEquipeId, formTipo })
    
    if (!nome || !login || !senha) {
      notify.warn('Preencha todos os campos obrigatórios')
      return
    }

    if (senha.length < 4) {
      notify.warn('A senha deve ter pelo menos 4 caracteres')
      return
    }
    
    const tipoSel = (formTipo || 'Operador').trim()
    const roleOut = (tipoSel === 'Administrador') ? 'Master' : tipoSel
    const equipeId = isSupervisor ? (user?.equipe_id ?? formEquipeId) : formEquipeId
    
    console.log('🔍 Processamento:', { tipoSel, roleOut, equipeId, isSupervisor })
    
    if (!equipeId) {
      notify.warn('Selecione uma equipe')
      return
    }

    setIsSaving(true)
    
    try {
      console.log('🔄 Criando usuário via API...', { nome, login, role: roleOut, equipe_id: equipeId })
      
      // Chamada para a API de adicionar usuário
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/add-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: nome,
          login: login,
          senha: senha,
          role: roleOut,
          equipe_id: equipeId,
          ativo: true,
          criado_por: user?.id || 1
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erro ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('✅ Usuário criado via API:', result)

      // Criar objeto local para atualizar a lista
      const nextId = result.id || result.Id || Math.max(0, ...usuarios.map(u => u.id || 0)) + 1
      const novo = {
        id: nextId,
        nome,
        login,
        role: roleOut,
        equipe_id: equipeId,
        ativo: true,
        is_supervisor: roleOut === 'Supervisor'
      }
      
      setUsuarios(prev => [novo, ...prev])
      setSelectedId(nextId)
      setIsAddOpen(false)
      
      // Limpar formulário
      setFormNome('')
      setFormLogin('')
      setFormSenha('')
      if (!isSupervisor) setFormTipo('Operador')
      
      notify.success(`Usuário "${nome}" criado com sucesso!`)
      
    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error)
      notify.error(`Erro ao criar usuário: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteUser(targetId) {
    if (targetId === user?.id) return

    setDeletingId(targetId)
    setPendingDelete(null)

    try {
      const response = await fetch('https://n8n.sistemavieira.com.br/webhook-test/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: targetId })
      })

      const rawBody = await response.text()
      if (!response.ok) {
        const message = (rawBody || '').trim() || `Erro ${response.status}`
        throw new Error(message)
      }

      if (rawBody) {
        try {
          console.log('Usuário removido via API:', JSON.parse(rawBody))
        } catch (_) {
          console.log('Usuário removido via API (texto):', rawBody)
        }
      }

      const removedUser = usuarios.find(u => u.id === targetId)
      setUsuarios(prev => {
        const next = prev.filter(u => u.id !== targetId)
        setSelectedId(current => (current === targetId ? next[0]?.id ?? null : current))
        return next
      })

      if (removedUser?.nome) {
        notify.success(`Usuário "${removedUser.nome}" excluído.`)
      } else {
        notify.success('Usuário excluído.')
      }

    } catch (error) {
      console.error('Erro ao excluir usuário:', error)
      notify.error(`Erro ao excluir usuário: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <Fi.FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Usuários</h2>
              <div className="opacity-75 small">Gerencie contas, perfis e acessos</div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                {canManage && (
                  <button className="btn btn-primary d-flex align-items-center justify-content-center" title="Adicionar usuário" aria-label="Adicionar usuário" onClick={handleOpenAddModal} disabled={!canManage}>
                    <Fi.FiPlus />
                  </button>
                )}
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
                      <button className="btn btn-outline-danger btn-sm" title="Excluir" aria-label="Excluir" disabled={selected.id === user?.id || deletingId === selected.id}
                        onClick={() => setPendingDelete(selected)}>
                        {deletingId === selected.id ? (
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        ) : (
                          <Fi.FiTrash2 />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="p-3 rounded-3 h-100" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="small text-uppercase opacity-75 mb-2">Perfil</div>
                        <div className="mb-1"><span className="opacity-75">Nome: </span>{selected.nome}</div>
                        <div className="mb-1"><span className="opacity-75">Login: </span>{selected.login}</div>
                        <div className="mb-2"><span className="opacity-75">Tipo: </span>{selected.role}</div>
                        <button className="btn btn-outline-secondary btn-sm" disabled title="Alterar tipo" aria-label="Alterar tipo"><Fi.FiRefreshCcw /></button>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 rounded-3 h-100" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="small text-uppercase opacity-75 mb-2">SEGURANÇA</div>
                        <div className="mb-2"><span className="opacity-75">Status: </span>{selected.ativo ? 'Ativo' : 'Inativo'}</div>
                        <div className="d-flex gap-2">
                          <button className="btn btn-outline-warning btn-sm" title="Alterar senha" aria-label="Alterar senha"
                            onClick={() => { 
                              const nova = prompt('Nova senha para ' + selected.nome + ':')
                              if (!nova) return
                              if (nova.length < 4) {
                                notify.warn('A senha deve ter pelo menos 4 caracteres')
                                return
                              }
                              // TODO: Integrar com API de alteração de senha
                              notify.info('Funcionalidade em desenvolvimento. Integre com a API.')
                            }}>
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

                </>
              )}
              {/* <div className="small mt-3 opacity-75">Integração com: https://webhook.sistemavieira.com.br/webhook/add-user</div> */}
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
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setIsAddOpen(false)} disabled={isSaving}></button>
              </div>
              <form onSubmit={handleAddSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nome Completo *</label>
                    <input 
                      className="form-control" 
                      value={formNome} 
                      onChange={(e) => handleNomeChange(e.target.value)} 
                      disabled={isSaving}
                      placeholder="Ex: João Silva"
                      required 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Login *</label>
                    <input 
                      className="form-control" 
                      value={formLogin} 
                      onChange={(e) => setFormLogin(e.target.value)} 
                      disabled={isSaving}
                      placeholder="Ex: joaosilva"
                      required 
                    />
                    <div className="form-text">Login será usado para acessar o sistema</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Tipo</label>
                    <select className="form-select" value={formTipo} onChange={(e) => setFormTipo(e.target.value)} disabled={isSupervisor || isSaving}>
                      <option>Master</option>
                      <option>Administrador</option>
                      <option>Supervisor</option>
                      <option>Operador</option>
                    </select>
                    {isSupervisor && <div className="form-text">Como supervisora, você só pode criar operadores</div>}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Senha *</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={formSenha} 
                      onChange={(e) => setFormSenha(e.target.value)} 
                      disabled={isSaving}
                      placeholder="Mínimo 4 caracteres"
                      required 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Equipe *</label>
                    <select className="form-select" value={formEquipeId ?? ''} onChange={(e) => setFormEquipeId(e.target.value ? parseInt(e.target.value, 10) : null)} disabled={isSupervisor || isSaving} required>
                      <option value="" disabled>Selecione uma equipe...</option>
                      {(equipesLista || []).map(eq => (<option key={eq.id} value={eq.id}>{eq.nome}</option>))}
                    </select>
                    {isSupervisor && <div className="form-text">Como supervisora, você só pode criar usuários na sua equipe</div>}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddOpen(false)} disabled={isSaving}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={isSaving || !formNome.trim() || !formLogin.trim() || !formSenha.trim() || !formEquipeId}>
                    {isSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Salvando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {pendingDelete && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirmar exclusão</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setPendingDelete(null)} disabled={deletingId != null}></button>
              </div>
              <div className="modal-body">
                <p>Tem certeza que deseja excluir <strong>{pendingDelete.nome}</strong>?</p>
                <p className="mb-0 small opacity-75">Esta ação não pode ser desfeita.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPendingDelete(null)} disabled={deletingId != null}>Cancelar</button>
                <button type="button" className="btn btn-danger" onClick={() => handleDeleteUser(pendingDelete.id)} disabled={deletingId != null}>
                  {deletingId != null ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Excluindo...
                    </>
                  ) : (
                    'Excluir'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

