﻿import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { notify } from '../utils/notify.js'

const API_BASE = 'http://85.31.61.242:8011/api'
const ROLE_BY_ID = {
  1: 'Master',
  2: 'Supervisor',
  3: 'Operador',
  4: 'Administrador'
}

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

const unwrapSqlJsonEnvelope = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return raw
  const first = raw[0]
  if (!first || typeof first !== 'object') return raw
  const key = Object.keys(first).find((item) => item.toUpperCase().startsWith('JSON_'))
  if (!key || typeof first[key] !== 'string') return raw
  try {
    return JSON.parse(first[key])
  } catch {
    return raw
  }
}

const normalizeApiCollection = (raw) => {
  const data = unwrapSqlJsonEnvelope(raw)
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.items)) return data.items
  return []
}

const safeJson = async (response) => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text.trim() || `HTTP ${response.status}`)
  }
}

const fetchCollection = async (path, idUser) => {
  const url = new URL(`${API_BASE}/${path}`)
  if (idUser !== null && idUser !== undefined && idUser !== '') {
    url.searchParams.set('id_user', String(idUser))
  }
  const response = await fetch(url.toString(), { method: 'GET' })
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`)
  }
  const payload = await safeJson(response)
  return normalizeApiCollection(payload)
}

// Página Equipes: estrutura pronta para integrar API em seguida.
export default function Equipes() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [equipes, setEquipes] = useState([])
  const [usuariosBase, setUsuariosBase] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [editNome, setEditNome] = useState('')
  const [supervisores, setSupervisores] = useState([])
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false)
  const [addTeamNome, setAddTeamNome] = useState('')
  const [addTeamSupervisorId, setAddTeamSupervisorId] = useState('')
  const [addTeamDepartamento, setAddTeamDepartamento] = useState('')
  const [addTeamSaving, setAddTeamSaving] = useState(false)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [addUserMode, setAddUserMode] = useState('existente')
  const [existingUserId, setExistingUserId] = useState('')
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
  const [deleteTeamAction, setDeleteTeamAction] = useState('desvincular')

  
  useEffect(() => {
    let aborted = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const idUser = user?.id_user ?? user?.id ?? null
        const [usuariosRaw, equipesRaw] = await Promise.all([
          fetchCollection('usuarios', idUser),
          fetchCollection('equipes', idUser),
        ])

        const mapUser = (u) => ({
          id: toNumberOrNull(u?.id ?? u?.user_id ?? u?.usuario_id),
          nome: u?.nome ?? u?.name ?? 'Usuário',
          role: (() => {
            const directRole = String(u?.role ?? u?.papel ?? u?.perfil ?? '').trim()
            if (directRole) return directRole
            const roleNome = String(u?.role_nome ?? '').trim()
            if (roleNome) return roleNome
            const roleId = toNumberOrNull(u?.role_id)
            return ROLE_BY_ID[roleId] ?? 'Operador'
          })(),
          equipe_id: toNumberOrNull(u?.equipe_id ?? u?.team_id ?? u?.equipeId),
          login: u?.login ?? '',
          ativo: (u?.ativo ?? true) ? true : false,
        })

        const toTeam = (t) => ({
          id: toNumberOrNull(t?.id ?? t?.team_id ?? t?.equipe_id),
          nome: t?.nome ?? t?.name ?? t?.team_name ?? 'Equipe',
          descricao: t?.descricao ?? t?.description ?? '',
          ativo: (t?.ativo ?? t?.active ?? true) ? true : false,
          supervisor_user_id: toNumberOrNull(t?.supervisor_user_id ?? t?.supervisor_id),
          departamento: t?.departamento ?? t?.department ?? '-',
          membros: [],
        })

        const usuariosLista = (usuariosRaw || [])
          .map(mapUser)
          .filter((u) => u.id != null)

        const usuariosById = new Map(usuariosLista.map((u) => [u.id, u]))
        const membrosPorEquipe = new Map()
        for (const member of usuariosLista) {
          if (member.equipe_id == null) continue
          if (!membrosPorEquipe.has(member.equipe_id)) {
            membrosPorEquipe.set(member.equipe_id, [])
          }
          membrosPorEquipe.get(member.equipe_id).push(member)
        }

        let eq = []
        if (Array.isArray(equipesRaw) && equipesRaw.length) {
          eq = equipesRaw.map(toTeam).filter((team) => team.id != null)
        } else {
          const uniqueTeams = Array.from(new Set(usuariosLista.map((u) => u.equipe_id).filter((id) => id != null)))
          eq = uniqueTeams.map((teamId) => ({
            id: teamId,
            nome: `Equipe ${teamId}`,
            descricao: '',
            ativo: true,
            supervisor_user_id: null,
            departamento: '-',
            membros: []
          }))
        }

        eq = eq.map((team) => {
          const membros = membrosPorEquipe.get(team.id) || []
          const supervisorById = team.supervisor_user_id != null ? usuariosById.get(team.supervisor_user_id) : null
          const supervisorByRole = membros.find((member) => {
            const role = String(member?.role || '').toLowerCase()
            return role === 'supervisor' || role === 'administrador' || role === 'master'
          }) || null
          const supervisor = supervisorById || supervisorByRole || null
          return {
            ...team,
            supervisor: supervisor ? { id: supervisor.id, nome: supervisor.nome } : null,
            membros
          }
        })

        if (!eq.length) throw new Error('Resposta vazia da API')
        if (!aborted) {
          setUsuariosBase(usuariosLista)
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
          setUsuariosBase([])
          setEquipes([])
          setSelectedId(null)
        }
      } finally {
        if (!aborted) setIsLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [user?.id, user?.id_user])

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
  const availableExistingUsers = useMemo(() => {
    const selectedTeamId = selected?.id ?? null
    return (usuariosBase || [])
      .filter((u) => u?.id != null && u.equipe_id !== selectedTeamId)
      .sort((a, b) => String(a?.nome || '').localeCompare(String(b?.nome || '')))
  }, [usuariosBase, selected?.id])

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
      const response = await fetch(`${API_BASE}/alter/equipe`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const apiPayload = await safeJson(response).catch(() => null)
      if (!response.ok || apiPayload?.success === false) {
        throw new Error(apiPayload?.message || `Erro ${response.status}`)
      }
      console.log('alter/equipe:', apiPayload)

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
      setUsuariosBase(prev => prev.map(u => (
        u.id === transferMember.id ? { ...u, equipe_id: newTeamNum } : u
      )))
      notify.success('Usuário transferido de equipe.')
      closeTransferMemberModal()
    } catch (err) {
      notify.error(`Erro ao transferir: ${err.message}`)
    }
  }

  async function handleSaveNomeEquipe() {
    if (!selected) return
    const name = (editNome || '').trim()
    if (!name) {
      notify.warn('Informe o nome da equipe.')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/alter/equipe-dados`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          equipe_id: selected.id,
          nome: name,
          descricao: selected.descricao ?? null,
          supervisor_user_id: selected.supervisor_user_id ?? null,
          ativo: selected.ativo !== false
        })
      })

      const payload = await safeJson(response).catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `Erro ${response.status}`)
      }

      const result = payload?.data ?? {}
      const nextName = result?.nome || name
      const nextDescricao = result?.descricao ?? selected.descricao ?? ''

      setEquipes(prev => prev.map((e) => (
        e.id === selected.id
          ? {
              ...e,
              nome: nextName,
              descricao: nextDescricao,
              supervisor_user_id: toNumberOrNull(result?.supervisor_user_id) ?? e.supervisor_user_id,
              ativo: result?.ativo ?? e.ativo,
            }
          : e
      )))
      setEditNome(nextName)

      const successMessage = payload?.mensagem ?? payload?.message ?? 'Nome da equipe atualizado.'
      notify.success(successMessage)
    } catch (error) {
      console.error('Erro ao atualizar equipe:', error)
      notify.error(`Erro ao atualizar equipe: ${error.message}`)
    }
  }

  const removeMemberFromTeams = (teams, userId) => teams.map((team) => ({
    ...team,
    membros: (team.membros || []).filter((member) => member.id !== userId)
  }))

  const updateTeamSupervisorCache = (teams, removedIds) => teams.map((team) => {
    if (!removedIds.includes(team.supervisor?.id) && !removedIds.includes(team.supervisor_user_id)) {
      return team
    }
    return {
      ...team,
      supervisor: null,
      supervisor_user_id: null,
    }
  })

  const handleOpenAddTeam = () => {
    if (!canCreateTeam) return
    setAddTeamNome('')
    setAddTeamDepartamento('')
    const firstSupervisorId = supervisores[0]?.id ?? ''
    setAddTeamSupervisorId(firstSupervisorId !== undefined ? String(firstSupervisorId) : '')
    setIsAddTeamOpen(true)
  }

  const handleCloseAddTeam = () => {
    setIsAddTeamOpen(false)
    setAddTeamNome('')
    setAddTeamDepartamento('')
    setAddTeamSupervisorId('')
    setAddTeamSaving(false)
  }

  const openDeleteTeamModal = () => {
    if (!isMasterRole) return
    if (!selected) return
    setDeleteTeamAction('desvincular')
    setIsDeleteTeamOpen(true)
  }

  const closeDeleteTeamModal = () => {
    setIsDeleteTeamOpen(false)
    setDeleteTeamAction('desvincular')
  }

  async function handleConfirmDeleteTeam() {
    if (!selected || !selected.id) { closeDeleteTeamModal(); return }
    const teamId = selected.id
    const teamName = selected.nome || 'Equipe'
    const memberIds = (selected.membros || []).map((member) => Number(member.id)).filter((id) => !Number.isNaN(id))
    try {
      setIsDeletingTeam(true)
      const response = await fetch(`${API_BASE}/delete/equipe`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipe_id: teamId,
          acao_membros: deleteTeamAction,
        })
      })

      const payload = await safeJson(response).catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`)
      }

      setEquipes(prev => {
        let next = (prev || []).filter(e => e.id !== teamId)
        if (deleteTeamAction === 'excluir' && memberIds.length > 0) {
          next = updateTeamSupervisorCache(next, memberIds)
        }
        const nextId = next[0]?.id ?? null
        setSelectedId(nextId)
        return next
      })

      if (deleteTeamAction === 'desvincular' && memberIds.length > 0) {
        setUsuariosBase(prev => prev.map((usuario) => (
          memberIds.includes(Number(usuario.id))
            ? { ...usuario, equipe_id: null }
            : usuario
        )))
      }

      if (deleteTeamAction === 'excluir' && memberIds.length > 0) {
        setUsuariosBase(prev => prev.filter((usuario) => !memberIds.includes(Number(usuario.id))))
        setSupervisores(prev => prev.filter((usuario) => !memberIds.includes(Number(usuario.id))))
      }

      const successMessage = payload?.message || `Equipe ${teamName} excluida com sucesso.`
      notify.success(successMessage)
      closeDeleteTeamModal()
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

    if (!nome) {
      notify.warn('Informe o nome da equipe.')
      return
    }

    setAddTeamSaving(true)

    try {
      const supervisor = supervisores.find((s) => Number(s.id) === supervisorId) || null

      const resp = await fetch(`${API_BASE}/register/equipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          descricao: departamento || null,
          supervisor_user_id: supervisorId ?? null,
          ativo: true,
        }),
      })

      const payload = await safeJson(resp).catch(() => null)
      if (!resp.ok || payload?.success === false) {
        throw new Error(payload?.message || `Erro ${resp.status}`)
      }

      const result = payload?.data ?? payload ?? {}
      const nextId = result.id || Math.max(0, ...equipes.map(e => e.id || 0)) + 1
      const novaEquipe = {
        id: nextId,
        nome: result.nome || nome,
        descricao: result.descricao ?? departamento,
        ativo: result.ativo ?? true,
        supervisor_user_id: toNumberOrNull(result.supervisor_user_id) ?? supervisorId ?? null,
        supervisor,
        departamento: result.descricao ?? departamento,
        membros: [],
      }

      setEquipes(prev => [novaEquipe, ...prev])
      setSelectedId(nextId)
      notify.success(`Equipe "${nome}" criada com sucesso!`)
      handleCloseAddTeam()
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

  const handleSelectEquipe = (teamId) => {
    setSelectedId(teamId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleOpenAddUser = () => {
    if (!selected || !isMasterRole) return
    const nextMode = availableExistingUsers.length > 0 ? 'existente' : 'novo'
    setAddUserMode(nextMode)
    setExistingUserId(nextMode === 'existente' ? String(availableExistingUsers[0]?.id ?? '') : '')
    setAddUserNome('')
    setAddUserLogin('')
    setAddUserSenha('')
    setAddUserTipo('Operador')
    setIsAddUserOpen(true)
  }

  const handleCloseAddUser = () => {
    setIsAddUserOpen(false)
    setAddUserMode('existente')
    setExistingUserId('')
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

    const equipeId = selected.id
    if (!equipeId) {
      notify.error('Equipe inválida para adicionar Usuário')
      return
    }

    if (addUserMode === 'existente') {
      const targetUserId = existingUserId ? Number(existingUserId) : null
      const existingUser = (usuariosBase || []).find((u) => Number(u.id) === targetUserId) || null

      if (!targetUserId || !existingUser) {
        notify.warn('Selecione um usuário existente.')
        return
      }

      setAddUserSaving(true)

      try {
        const response = await fetch(`${API_BASE}/alter/equipe`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id_usuario: targetUserId,
            equipe_id: equipeId,
          })
        })

        const payload = await safeJson(response).catch(() => null)
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.message || `Erro ${response.status}`)
        }

        const previousTeamId = toNumberOrNull(existingUser?.equipe_id)
        const memberToInsert = { ...existingUser, equipe_id: equipeId }

        setUsuariosBase(prev => prev.map((usuario) => (
          Number(usuario.id) === targetUserId
            ? { ...usuario, equipe_id: equipeId }
            : usuario
        )))

        setEquipes(prev => prev.map((team) => {
          if (previousTeamId != null && team.id === previousTeamId) {
            return { ...team, membros: (team.membros || []).filter((member) => member.id !== targetUserId) }
          }

          if (team.id === equipeId) {
            const membrosAtualizados = removeMemberFromTeams([team], targetUserId)[0]?.membros || []
            return { ...team, membros: [...membrosAtualizados, memberToInsert] }
          }

          return team
        }))

        notify.success(payload?.message || 'Usuário vinculado à equipe com sucesso.')
        handleCloseAddUser()
      } catch (error) {
        console.error('Erro ao vincular Usuário existente:', error)
        notify.error(`Erro ao vincular Usuário: ${error.message}`)
      } finally {
        setAddUserSaving(false)
      }

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

    setAddUserSaving(true)

    try {
      const response = await fetch(`${API_BASE}/register/usuarios`, {
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

      const payload = await safeJson(response).catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `Erro ${response.status}`)
      }

      const result = payload?.data ?? payload ?? {}

      const nextId = result?.id || result?.Id || Math.max(0, ...((selected.membros || []).map(m => m.id || 0))) + 1
      const novo = {
        id: nextId,
        nome: result?.nome || nome,
        login: result?.login || login,
        role: result?.role || roleOut,
        equipe_id: equipeId,
        ativo: result?.ativo ?? true,
      }

      setUsuariosBase(prev => [...prev, novo])
      if (['master', 'administrador', 'supervisor'].includes(String(novo.role || '').toLowerCase())) {
        setSupervisores(prev => [...prev, novo])
      }
      setEquipes(prev => prev.map(e => {
        if (e.id !== selected.id) return e
        const membros = e.membros ? [...e.membros, novo] : [novo]
        return { ...e, membros }
      }))
      notify.success(`Usuário "${nome}" criado com sucesso!`)
      handleCloseAddUser()
    } catch (error) {
      console.error('Erro ao criar Usuário pela equipe:', error)
      notify.error(`Erro ao criar Usuário: ${error.message}`)
    } finally {
      setAddUserSaving(false)
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
                    disabled={!canCreateTeam}
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
                      onClick={() => handleSelectEquipe(e.id)}
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
              {!!selected?.membros?.length && (
                <div className="mb-3">
                  <label className="form-label">O que fazer com os {selected.membros.length} membro(s)?</label>
                  <select className="form-select" value={deleteTeamAction} onChange={(e) => setDeleteTeamAction(e.target.value)} disabled={isDeletingTeam}>
                    <option value="desvincular">Deixar sem equipe</option>
                    <option value="excluir">Apagar usuários junto</option>
                  </select>
                </div>
              )}
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
                  <label className="form-label">Modo</label>
                  <select className="form-select" value={addUserMode} onChange={(e) => setAddUserMode(e.target.value)} disabled={addUserSaving}>
                    <option value="existente">Usuário existente</option>
                    <option value="novo">Novo usuário</option>
                  </select>
                </div>
                {addUserMode === 'existente' ? (
                  <div className="mb-3">
                    <label className="form-label">Usuário</label>
                    <select className="form-select" value={existingUserId} onChange={(e) => setExistingUserId(e.target.value)} disabled={addUserSaving} required>
                      <option value="">Selecione...</option>
                      {availableExistingUsers.map((existingUser) => {
                        const teamName = equipes.find((team) => team.id === existingUser.equipe_id)?.nome || 'Sem equipe'
                        return (
                          <option key={existingUser.id} value={existingUser.id}>
                            {`${existingUser.nome} (${existingUser.login}) - ${teamName}`}
                          </option>
                        )
                      })}
                    </select>
                    {availableExistingUsers.length === 0 && (
                      <div className="small opacity-75 mt-2">Nenhum usuário disponível para vincular.</div>
                    )}
                  </div>
                ) : (
                  <>
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
                  </>
                )}
                {isMasterRole && (
                  <div className="mb-3">
                    <label className="form-label">Equipe</label>
                    <input className="form-control" value={selected?.nome || ''} disabled readOnly />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseAddUser} disabled={addUserSaving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={addUserSaving || (addUserMode === 'existente' ? !existingUserId : (!addUserNome.trim() || !addUserLogin.trim() || !addUserSenha.trim()))}>
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
            <label className="form-label">Supervisor</label>
            <select className="form-select" value={addTeamSupervisorId} onChange={(e) => setAddTeamSupervisorId(e.target.value)} disabled={addTeamSaving}>
              <option value="">Sem supervisor</option>
              {supervisores.map((sup) => (<option key={sup.id} value={sup.id}>{sup.nome}</option>))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Descrição</label>
            <input className="form-control" value={addTeamDepartamento} onChange={(e) => setAddTeamDepartamento(e.target.value)} disabled={addTeamSaving} placeholder="Equipe de operações" />
          </div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <button type="button" className="btn btn-ghost" onClick={handleCloseAddTeam} disabled={addTeamSaving}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={addTeamSaving || !addTeamNome.trim()}>
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
