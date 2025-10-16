﻿import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { notify } from '../utils/notify.js'

// Página Equipes: estrutura pronta para integrar API em seguida.
export default function Equipes() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [equipes, setEquipes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [editNome, setEditNome] = useState('')
  const [supervisores, setSupervisores] = useState([])
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false)
  const [addTeamNome, setAddTeamNome] = useState('')
  const [addTeamSupervisorId, setAddTeamSupervisorId] = useState('')
  const [addTeamDepartamento, setAddTeamDepartamento] = useState('')
  const [addTeamSaldo, setAddTeamSaldo] = useState('200')
  const [addTeamSaving, setAddTeamSaving] = useState(false)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [addUserNome, setAddUserNome] = useState('')
  const [addUserLogin, setAddUserLogin] = useState('')
  const [addUserTipo, setAddUserTipo] = useState('Operador')
  const [addUserSenha, setAddUserSenha] = useState('')
  const [addUserSaving, setAddUserSaving] = useState(false)
  const [isTransferMemberOpen, setIsTransferMemberOpen] = useState(false)
  const [transferMember, setTransferMember] = useState(null)
  const [transferNewTeamId, setTransferNewTeamId] = useState('')
  const [isDeleteTeamOpen, setIsDeleteTeamOpen] = useState(false)
  const [isDeletingTeam, setIsDeletingTeam] = useState(false)

  
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

        // Desembrulha resposta do MSSQL no n8n: array com chave JSON_*
        const unwrap = (d) => {
          if (Array.isArray(d) && d.length > 0 && d[0] && typeof d[0] === 'object') {
            const key = Object.keys(d[0]).find(k => k.toUpperCase().startsWith('JSON_'))
            if (key && typeof d[0][key] === 'string') {
              try { return JSON.parse(d[0][key]) } catch (_) { /* ignore */ }
            }
          }
          return d
        }

        const payload = unwrap(data)

        const mapUser = (u) => ({
          id: u?.id ?? u?.user_id ?? u?.usuario_id ?? null,
          nome: u?.nome ?? u?.name ?? 'Usuário',
          role: u?.role ?? u?.papel ?? u?.perfil ?? '',
          equipe_id: u?.equipe_id ?? u?.team_id ?? u?.equipeId ?? null,
        })

        const toTeam = (t) => ({
          id: t?.id ?? t?.team_id ?? t?.equipe_id ?? null,
          nome: t?.nome ?? t?.name ?? t?.team_name ?? 'Equipe',
          descricao: t?.descricao ?? t?.description ?? '',
          ativo: (t?.ativo ?? t?.active ?? true) ? true : false,
          supervisor: (() => {
            const raw = t?.supervisor ?? t?.lead ?? null
            if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return { nome: raw } } }
            return raw
          })(),
          departamento: t?.departamento ?? t?.department ?? '-',
          membros: t?.membros ?? t?.users ?? t?.usuarios ?? [],
        })

        const collectUsers = () => {
          let arr = []
          if (Array.isArray(payload?.usuarios)) arr = payload.usuarios
          else if (Array.isArray(payload?.users)) arr = payload.users
          else if (Array.isArray(payload?.equipes)) arr = payload.equipes.flatMap(eq => eq.membros || [])
          else if (Array.isArray(payload)) arr = payload
          return arr.map(mapUser).filter(u => u.id != null)
        }

        const usuariosLista = (() => {
          const list = collectUsers()
          const map = new Map()
          list.forEach(u => {
            if (u.id == null) return
            if (!map.has(u.id)) map.set(u.id, u)
          })
          return Array.from(map.values())
        })()

        let eq = []
        if (Array.isArray(payload?.equipes)) {
          eq = payload.equipes.map(toTeam)
        } else if (payload?.equipe || payload?.usuarios || payload?.users) {
          const base = toTeam(payload?.equipe || {})
          const members = base.membros?.length ? base.membros : (payload?.usuarios || payload?.users || [])
          base.membros = members
          if (!base.id && Array.isArray(members) && members[0]?.equipe_id) base.id = members[0].equipe_id
          eq = [base]
        } else if (Array.isArray(payload)) {
          eq = [{ id: null, nome: 'Equipe', descricao: '', ativo: true, supervisor: null, departamento: '-', membros: payload }]
        }

        if (!eq.length) throw new Error('Resposta vazia da API')
        if (!aborted) {
          setEquipes(eq)
          setSelectedId(eq[0]?.id ?? null)
          setSupervisores(
            usuariosLista.filter(u => {
              const r = (u.role || '').toLowerCase()
              return r === 'supervisor' || r === 'administrador' || r === 'master'
            })
          )
        }
      } catch (e) {
        console.error('Falha API Equipes:', e)
        if (!aborted) {
          setError(e)
          setEquipes([])
          setSelectedId(null)
        }
      } finally {
        if (!aborted) setIsLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [user?.id])

  const isMasterRole = user?.role === 'Master'
  const isMasterTeam = (user?.equipe_nome || '').toLowerCase() === 'master'
  const hasMasterAccess = isMasterRole || isMasterTeam
  const isSupervisor = user?.role === 'Supervisor'
  const canCreateTeam = isMasterRole
  const canEditTeamName = hasMasterAccess || isSupervisor
  const canManageMembers = hasMasterAccess || isSupervisor

  const baseEquipes = useMemo(() => {
    if (hasMasterAccess) {
      return equipes
    }
    if (user?.equipe_id != null) {
      return equipes.filter(e => e.id === user.equipe_id)
    }
    return equipes
  }, [equipes, user, hasMasterAccess])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return baseEquipes
    return baseEquipes.filter(e =>
      e.nome.toLowerCase().includes(term) ||
      (e.descricao || '').toLowerCase().includes(term)
    )
  }, [baseEquipes, search])

  const selected = useMemo(() => filtered.find(e => e.id === selectedId) || null, [filtered, selectedId])

  useEffect(() => {
    // Garante seleção válida quando a lista visível muda (ex.: Supervisor)
    if (!filtered.some(e => e.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null)
    }
  }, [filtered, selectedId])

  useEffect(() => {
    setEditNome(selected?.nome || '')
  }, [selected?.id])

  const toLoginFromName = (nome) => {
    const s = (nome || '')
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s-]+/g, ' ')
      .trim()
      .toLowerCase()
    return s.replace(/\s+/g, '')
  }

  const openTransferMemberModal = (member) => {
    if (!isMasterRole) return
    if (!selected || !member) return
    setTransferMember(member)
    const firstDifferent = (equipes || []).find(eq => eq.id !== selected.id)?.id ?? ''
    setTransferNewTeamId(firstDifferent !== undefined ? String(firstDifferent) : '')
    setIsTransferMemberOpen(true)
  }

  const closeTransferMemberModal = () => {
    setIsTransferMemberOpen(false)
    setTransferMember(null)
    setTransferNewTeamId('')
  }

  const handleConfirmTransferMember = async (e) => {
    e?.preventDefault?.()
    if (!isMasterRole) return
    if (!selected || !transferMember) return
    const newTeamNum = transferNewTeamId ? Number(transferNewTeamId) : null
    if (!newTeamNum || newTeamNum === selected.id) {
      notify.warn('Selecione uma nova equipe diferente da atual')
      return
    }
    try {
      const payload = {
        id_usuario: transferMember.id,
        equipe_id: newTeamNum,
      }
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/transfer-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const rawBody = await response.text()
      if (!response.ok) {
        const message = (rawBody || '').trim() || `Erro ${response.status}`
        throw new Error(message)
      }
      try { console.log('transfer-team:', JSON.parse(rawBody)) } catch (_) { if (rawBody.trim()) console.log('transfer-team:', rawBody) }

      // Atualiza lista local: remove do time atual e adiciona no novo
      setEquipes(prev => prev.map(e => {
        if (e.id === selected.id) {
          const membros = (e.membros || []).filter(m => m.id !== transferMember.id)
          return { ...e, membros }
        }
        if (e.id === newTeamNum) {
          const membros = e.membros ? [...e.membros, { ...transferMember, equipe_id: newTeamNum }] : [{ ...transferMember, equipe_id: newTeamNum }]
          return { ...e, membros }
        }
        return e
      }))
      notify.success('Usuário transferido de equipe.')
      closeTransferMemberModal()
      window.location.reload()
    } catch (err) {
      notify.error(`Erro ao transferir: ${err.message}`)
    }
  }

async function handleSaveNomeEquipe() {
    if (!selected) return
    if (!user?.id) {
      notify.error('Usuário inválido para alteração de equipe.')
      return
    }
    const name = (editNome || '').trim()
    if (!name) return
    setEquipes(prev => prev.map(e => e.id === selected.id ? { ...e, nome: name } : e))

    try {
      const payload = {
        id_usuario: user.id,
        equipe_id: selected.id,
        nome: name,
      }

      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/alter-team-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const rawBody = await response.text()
      if (!response.ok) {
        const message = (rawBody || '').trim() || `Erro ${response.status}`
        throw new Error(message)
      }

      let successMessage = 'Nome da equipe atualizado.'
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody)
          const apiMessage = parsed?.mensagem ?? parsed?.message ?? parsed?.status
          if (typeof apiMessage === 'string' && apiMessage.trim()) successMessage = apiMessage.trim()
        } catch (_) {
          if (rawBody.trim()) successMessage = rawBody.trim()
        }
      }

      notify.success(successMessage)
      window.location.reload()
    } catch (error) {
      console.error('Erro ao atualizar equipe:', error)
      notify.error(`Erro ao atualizar equipe: ${error.message}`)
    }
  }

  const handleOpenAddTeam = () => {
    if (!canCreateTeam) return
    setAddTeamNome('')
    setAddTeamDepartamento('Equipe de operacoes Versatil')
    setAddTeamSaldo('200')
    const firstSupervisorId = supervisores[0]?.id ?? ''
    setAddTeamSupervisorId(firstSupervisorId !== undefined ? String(firstSupervisorId) : '')
    setIsAddTeamOpen(true)
  }

  const handleCloseAddTeam = () => {
    setIsAddTeamOpen(false)
    setAddTeamNome('')
    setAddTeamDepartamento('')
    setAddTeamSupervisorId('')
    setAddTeamSaldo('200')
    setAddTeamSaving(false)
  }

  const openDeleteTeamModal = () => {
    if (!isMasterRole) return
    if (!selected) return
    setIsDeleteTeamOpen(true)
  }

  const closeDeleteTeamModal = () => setIsDeleteTeamOpen(false)

  async function handleConfirmDeleteTeam() {
    if (!selected || !selected.id) { closeDeleteTeamModal(); return }
    const teamId = selected.id
    const teamName = selected.nome || 'Equipe'
    try {
      setIsDeletingTeam(true)
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/del-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: teamId })
      })

      if (!response.ok) {
        let message = ''
        try { message = (await response.text())?.trim() ?? '' } catch (_) { /* ignore */ }
        throw new Error(message || `HTTP ${response.status}`)
      }

      setEquipes(prev => {
        const next = (prev || []).filter(e => e.id !== teamId)
        const nextId = next[0]?.id ?? null
        setSelectedId(nextId)
        return next
      })
      notify.success(`Equipe ${teamName} excluida com sucesso.`)
      closeDeleteTeamModal()
      setTimeout(() => {
        try { window.location.reload() } catch (_) { /* ignore */ }
      }, 1000)
    } catch (error) {
      notify.error(`Falha ao excluir equipe: ${error.message}`)
    } finally {
      setIsDeletingTeam(false)
    }
  }

  async function handleAddTeamSubmit(event) {
    event.preventDefault()
    if (!canCreateTeam) {
      notify.warn('Apenas usuários Master podem criar equipes.')
      return
    }
    const nome = addTeamNome.trim()
    const departamento = addTeamDepartamento.trim()
    const supervisorId = addTeamSupervisorId ? Number(addTeamSupervisorId) : null
    
    const saldoNum = addTeamSaldo === '' ? NaN : Number(addTeamSaldo)

    if (!nome) {
      notify.warn('Informe o nome da equipe.')
      return
    }
    if (!supervisorId) {
      notify.warn('Selecione um supervisor.')
      return
    }
    
    if (Number.isNaN(saldoNum)) {
      notify.warn('Informe um saldo numérico.')
      return
    }

    setAddTeamSaving(true)

    try {
      const supervisor = supervisores.find((s) => Number(s.id) === supervisorId) || null

      // Send new team data to n8n webhook
      try {
        const payload = {
          id_usuario: supervisorId, // enviar o ID do supervisor selecionado
          nome: nome,
          departamento: departamento,
          supervisor_id: supervisorId,
          supervisor_nome: supervisor?.nome ?? null,
          
          saldo: saldoNum,
        }
        const resp = await fetch('https://webhook.sistemavieira.com.br/webhook/add-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const bodyText = await resp.text()
        if (!resp.ok) {
          const message = (bodyText || '').trim() || `Erro ${resp.status}`
          throw new Error(message)
        }
        try { console.log('add-team n8n:', JSON.parse(bodyText)) } catch (_) { if (bodyText.trim()) console.log('add-team n8n:', bodyText) }
      } catch (apiErr) {
        // Stop flow on API failure
        throw apiErr
      }
      const nextId = Math.max(0, ...equipes.map(e => e.id || 0)) + 1
      const novaEquipe = {
        id: nextId,
        nome,
        descricao: departamento,
        ativo: true,
        
          saldo: saldoNum,
        departamento,
        membros: [],
      }

      setEquipes(prev => [novaEquipe, ...prev])
      setSelectedId(nextId)
      notify.success(`Equipe "${nome}" criada com sucesso!`)
      handleCloseAddTeam()
      window.location.reload()
    } catch (error) {
      console.error('Erro ao criar equipe:', error)
      notify.error(`Erro ao criar equipe: ${error.message}`)
      setAddTeamSaving(false)
    }
  }

  const optionToRole = (option) => {
    const value = (option || '').toLowerCase()
    switch (value) {
      case 'master':
        return 'Master'
      case 'administrador':
        return 'Administrador'
      case 'supervisor':
        return 'Supervisor'
      case 'operador':
        return 'Operador'
      default:
        return option || 'Operador'
    }
  }

  const handleOpenAddUser = () => {
    if (!selected || !isMasterRole) return
    setAddUserNome('')
    setAddUserLogin('')
    setAddUserSenha('')
    setAddUserTipo('Operador')
    setIsAddUserOpen(true)
  }

  const handleCloseAddUser = () => {
    setIsAddUserOpen(false)
    setAddUserNome('')
    setAddUserLogin('')
    setAddUserSenha('')
    setAddUserTipo('Operador')
    setAddUserSaving(false)
  }

  const handleAddUserNomeChange = (value) => {
    const upper = (value || '').toUpperCase()
    setAddUserNome(upper)
    if (!addUserLogin) {
      setAddUserLogin(toLoginFromName(upper))
    }
  }

  async function handleAddUserSubmit(event) {
    event.preventDefault()
    if (!selected) {
      notify.error('Selecione uma equipe.')
      return
    }
    const nome = addUserNome.trim()
    const login = addUserLogin.trim()
    const senha = addUserSenha.trim()
    const tipoSel = (isMasterRole ? addUserTipo : 'Operador').trim()

    if (!nome || !login || !senha) {
      notify.warn('Preencha todos os campos obrigatórios')
      return
    }

    if (senha.length < 4) {
      notify.warn('A senha deve ter pelo menos 4 caracteres')
      return
    }

    const roleOut = optionToRole(tipoSel)
    const equipeId = selected.id

    if (!equipeId) {
      notify.error('Equipe inválida para adicionar Usuário')
      return
    }

    setAddUserSaving(true)

    try {
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/add-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: nome.toUpperCase(),
          login: login.toLowerCase(),
          senha,
          role: roleOut,
          equipe_id: equipeId,
          ativo: true,
          criado_por: user?.id || selected?.supervisor?.id || 1
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error((errorText || '').trim() || `Erro ${response.status}`)
      }

      let result = null
      try {
        result = await response.json()
      } catch (_) {
        result = null
      }

      const nextId = result?.id || result?.Id || Math.max(0, ...((selected.membros || []).map(m => m.id || 0))) + 1
      const novo = {
        id: nextId,
        nome,
        login,
        role: roleOut,
        ativo: true,
      }

      setEquipes(prev => prev.map(e => {
        if (e.id !== selected.id) return e
        const membros = e.membros ? [...e.membros, novo] : [novo]
        return { ...e, membros }
      }))
      notify.success(`Usuário "${nome}" criado com sucesso!`)
      notify.success(`Usuário "${nome}" criado com sucesso!`)
      window.location.reload()
    } catch (error) {
      console.error('Erro ao criar Usuário pela equipe:', error)
      console.error('Erro ao criar Usuário pela equipe:', error)
      notify.error(`Erro ao criar Usuário: ${error.message}`)
    }
  }

  return (
    <>
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <Fi.FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Equipes</h2>
              <div className="opacity-75 small">Estruture times, supervisor e operadores</div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                {isMasterRole && (
                  <button
                    className="btn btn-ghost btn-ghost-primary btn-icon d-flex align-items-center justify-content-center"
                    title="Adicionar equipe"
                    aria-label="Adicionar equipe"
                    onClick={handleOpenAddTeam}
                    disabled={!canCreateTeam || supervisores.length === 0}
                  >
                    <Fi.FiPlus />
                  </button>
                )}
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-control"
                  placeholder="Buscar equipe..."
                />
                <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')} aria-label="Limpar busca" title="Limpar">
                  <Fi.FiX />
                </button>
              </div>

              {isLoading && (
                <div className="text-center py-4 opacity-75">Carregando...</div>
              )}
              {error && (
                <div className="alert alert-danger py-2">{String(error)}</div>
              )}
              {!isLoading && !error && (
                <ul className="list-group">
                  {filtered.length === 0 && (
                    <li className="list-group-item text-center opacity-75">Nenhuma equipe encontrada</li>
                  )}
                  {filtered.map((e) => (
                    <li
                      key={e.id}
                      className={`list-group-item d-flex justify-content-between align-items-center ${selectedId === e.id ? 'active' : ''}`}
                      role="button"
                      onClick={() => setSelectedId(e.id)}
                    >
                      <div className="me-3">
                        <div className="fw-semibold">{e.nome}</div>
                        <div className="small opacity-75">{e.descricao || 'Sem descrição'}</div>
                      </div>
                      <div className="text-end small">
                        <div className="opacity-85">Sup.: {e.supervisor?.nome || 'Sem supervisor'}</div>
                        <div className="opacity-75">Operadores: {e.membros?.length ?? 0}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!error && (
                <div className="small mt-3 opacity-50">Dados carregados da API.</div>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="neo-card neo-lg p-4 h-100">
              {!selected ? (
                <div className="opacity-75">Selecione uma equipe para ver os detalhes.</div>
              ) : (
                <>
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div>
                      <h5 className="mb-1">{selected.nome}</h5>
                      <div className="small opacity-75">{selected.descricao || 'Sem descrição'}</div>
                      
                    </div>
                    <div className="d-flex gap-2">
                      {isMasterRole && (
                        <button className="btn btn-ghost btn-ghost-danger btn-icon" onClick={openDeleteTeamModal} disabled={isDeletingTeam} aria-hidden>
                          <Fi.FiTrash2 />
                        </button>
                      )}
                    </div>
                  </div>

                  {(isMasterRole || user?.role === 'Supervisor' || (user?.equipe_nome || '').toLowerCase() === 'master') && (
                    <div className="mb-3 d-flex align-items-center gap-2">
                      <input className="form-control form-control-sm" value={editNome} onChange={(e) => setEditNome(e.target.value)} aria-label="Nome da equipe" />
                      <button className="btn btn-ghost btn-ghost-primary btn-icon" onClick={handleSaveNomeEquipe} title="Salvar nome" aria-label="Salvar nome">
                        <Fi.FiSave />
                      </button>
                    </div>
                  )}

                  <div className="mb-3 p-3 rounded-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="small text-uppercase opacity-75 mb-1">Supervisor</div>
                    <div>{selected.supervisor?.nome || 'Sem supervisor'}</div>
                  </div>

                  <div>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <h6 className="mb-0">Membros ({selected.membros?.length ?? 0})</h6>
                        <button className="btn btn-ghost btn-ghost-primary btn-icon" title="Adicionar membro" aria-label="Adicionar membro"
                          onClick={handleOpenAddUser}
                          disabled={!isMasterRole}
                        >
                          <Fi.FiPlus />
                        </button>
                      </div>
                    <div className="table-responsive">
                      <table className="table table-dark table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th style={{ width: 80 }}>ID</th>
                            <th>Nome</th>
                            <th>Login</th>
                            <th style={{ width: 100 }} className="text-end">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selected.membros || []).map(m => (
                            <tr key={m.id}>
                              <td>{m.id}</td>
                              <td>{m.nome}</td>
                              <td>{m.login}</td>
                              <td className="text-end">
                                <button className="btn btn-ghost btn-icon" title="Transferir" aria-label="Transferir" onClick={() => openTransferMemberModal(m)} disabled={!isMasterRole}>
                                  <Fi.FiArrowRight />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {(!selected.membros || selected.membros.length === 0) && (
                            <tr>
                              <td colSpan="4" className="opacity-75">Nenhum membro.</td>
                              </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
    {isDeleteTeamOpen && selected && (
      <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1050 }} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirmar Exclusão</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={closeDeleteTeamModal}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">Tem certeza que deseja excluir a equipe {selected?.nome}?</div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeDeleteTeamModal}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmDeleteTeam} disabled={isDeletingTeam}>Excluir</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {isTransferMemberOpen && transferMember && selected && (
      <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1050 }} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Transferir usuário</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={closeTransferMemberModal}></button>
            </div>
            <form onSubmit={handleConfirmTransferMember}>
              <div className="modal-body">
                <div className="mb-3">
                  <div className="small text-uppercase opacity-75 mb-2">Usuário</div>
                  <div className="fw-semibold">{transferMember?.nome}</div>
                </div>
                <div className="d-flex align-items-center justify-content-between gap-3">
                  <div className="flex-fill">
                    <label className="form-label">Equipe atual</label>
                    <input className="form-control" value={selected?.nome || ''} disabled readOnly />
                  </div>
                  <div className="text-center" aria-hidden="true" style={{ width: '48px', marginTop: '22px' }}>
                    <Fi.FiArrowRight size={24} />
                  </div>
                  <div className="flex-fill">
                    <label className="form-label">Nova equipe</label>
                    <select className="form-select" value={transferNewTeamId} onChange={(e) => setTransferNewTeamId(e.target.value)} required>
                      <option value="">Selecione...</option>
                      {(equipes || []).map(eq => (
                        <option key={eq.id} value={eq.id} disabled={eq.id === selected?.id}>
                          {eq.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeTransferMemberModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!transferNewTeamId || Number(transferNewTeamId) === selected?.id}>Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
    {isMasterRole && selected && isAddUserOpen && (
      <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1050 }} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Adicionar usuário</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={handleCloseAddUser} disabled={addUserSaving}></button>
            </div>
            <form onSubmit={handleAddUserSubmit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Nome Completo *</label>
                  <input
                    className="form-control"
                    value={addUserNome}
                    onChange={(e) => handleAddUserNomeChange(e.target.value)}
                    disabled={addUserSaving}
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Login *</label>
                  <input
                    className="form-control"
                    value={addUserLogin}
                    onChange={(e) => setAddUserLogin((e.target.value || '').toLowerCase())}
                    disabled={addUserSaving}
                    placeholder="Ex: joaosilva"
                    required
                  />
                </div>
                {isMasterRole && (
                  <div className="mb-3">
                    <label className="form-label">Tipo</label>
                    <select className="form-select" value={addUserTipo} onChange={(e) => setAddUserTipo(e.target.value)} disabled={addUserSaving}>
                      <option>Master</option>
                      <option>Administrador</option>
                      <option>Supervisor</option>
                      <option>Operador</option>
                    </select>
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Senha *</label>
                  <input
                    type="password"
                    className="form-control"
                    value={addUserSenha}
                    onChange={(e) => setAddUserSenha(e.target.value)}
                    disabled={addUserSaving}
                    placeholder="Mínimo 4 caracteres"
                    required
                  />
                </div>
                {isMasterRole && (
                  <div className="mb-3">
                    <label className="form-label">Equipe</label>
                    <input className="form-control" value={selected?.nome || ''} disabled readOnly />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseAddUser} disabled={addUserSaving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={addUserSaving || !addUserNome.trim() || !addUserLogin.trim() || !addUserSenha.trim()}>
                  {addUserSaving ? (
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
    {canCreateTeam && isAddTeamOpen && (
  <div className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" style={{background:'rgba(0,0,0,0.6)', zIndex:1050}}>
    <div className="neo-card neo-lg p-4" style={{maxWidth:680, width:'95%'}}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="mb-0">Adicionar equipe</h5>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Fechar" onClick={handleCloseAddTeam} disabled={addTeamSaving}>
          <Fi.FiX />
        </button>
      </div>
      <form onSubmit={handleAddTeamSubmit}>
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label">Nome da equipe *</label>
            <input className="form-control" value={addTeamNome} onChange={(e) => setAddTeamNome(e.target.value)} disabled={addTeamSaving} placeholder="Nome da equipe" required />
          </div>
          <div className="col-12">
            <label className="form-label">Supervisor *</label>
            <select className="form-select" value={addTeamSupervisorId} onChange={(e) => setAddTeamSupervisorId(e.target.value)} disabled={addTeamSaving} required>
              <option value="">Selecione...</option>
              {supervisores.map((sup) => (<option key={sup.id} value={sup.id}>{sup.nome}</option>))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Departamento *</label>
            <input className="form-control" value={addTeamDepartamento} onChange={(e) => setAddTeamDepartamento(e.target.value)} disabled={addTeamSaving} placeholder="Equipe de operações Versatil" required />
          </div>
          <div className="col-12">
            <label className="form-label">Saldo *</label>
            <input type="number" inputMode="numeric" pattern="\\d*" min="0" step="1" className="form-control" value={addTeamSaldo} onChange={(e) => setAddTeamSaldo((e.target.value || '').replace(/[^0-9]/g, ''))} disabled={addTeamSaving} placeholder="Ex: 200" required />
          </div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <button type="button" className="btn btn-ghost" onClick={handleCloseAddTeam} disabled={addTeamSaving}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={addTeamSaving || !addTeamNome.trim() || !addTeamSupervisorId || !addTeamDepartamento.trim() || !String(addTeamSaldo || '').trim()}>
            {addTeamSaving ? (
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
)}
</>
)
}
