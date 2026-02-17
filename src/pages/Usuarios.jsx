import { useEffect, useMemo, useRef, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'

const MENU_PERMISSION_TREE = [
  {
    menu: { code: 'menu:dashboard', label: 'Visão Geral' },
    children: [],
  },
  {
    menu: { code: 'menu:consultas', label: 'Consultas' },
    children: [
      { code: 'menu:in100', label: 'Consulta Individual (IN100)' },
      { code: 'menu:argus', label: 'Cliente Argus' },
      { code: 'menu:historico', label: 'Histórico de Consultas' },
      { code: 'menu:v8', label: 'Consultas V8' },
    ],
  },
  {
    menu: { code: 'menu:gestao', label: 'Gestão' },
    children: [
      { code: 'menu:recargas', label: 'Gestão de Recargas' },
      { code: 'menu:controle-planejamento', label: 'Controle Planejamento' },
      { code: 'menu:relatorios', label: 'Relatórios' },
    ],
  },
  {
    menu: { code: 'menu:configuracoes', label: 'Configurações' },
    children: [
      { code: 'menu:usuarios', label: 'Usuários' },
      { code: 'menu:equipes', label: 'Equipes' },
    ],
  },
]

const BUTTON_PERMISSION_ITEMS = [
  { code: 'btn:usuario:editar', label: 'Editar usuário' },
  { code: 'btn:usuario:transferir', label: 'Transferir usuário' },
  { code: 'btn:usuario:excluir', label: 'Excluir usuário' },
  { code: 'btn:usuario:senha', label: 'Alterar senha' },
  { code: 'btn:usuario:status', label: 'Ativar/Desativar usuário' },
  { code: 'btn:usuario:criar', label: 'Adicionar usuário' },
]

const MENU_PERMISSION_CODES = MENU_PERMISSION_TREE.flatMap((section) => [
  section.menu.code,
  ...section.children.map((item) => item.code),
])
const BUTTON_PERMISSION_CODES = BUTTON_PERMISSION_ITEMS.map((item) => item.code)
const ALL_PERMISSION_CODES = [...MENU_PERMISSION_CODES, ...BUTTON_PERMISSION_CODES]

const makeState = (enabledCodes) => ALL_PERMISSION_CODES.reduce((acc, code) => {
  acc[code] = enabledCodes.includes(code)
  return acc
}, {})

const MENU_ALL_CONSULTAS = ['menu:consultas', 'menu:in100', 'menu:argus', 'menu:historico', 'menu:v8']
const MENU_GESTAO_CONTROLE = ['menu:gestao', 'menu:controle-planejamento']
const MENU_CONFIGURACOES_ALL = ['menu:configuracoes', 'menu:usuarios', 'menu:equipes']

const buildPermissionPresetByRole = (role) => {
  const roleName = String(role || '').trim().toLowerCase()
  let allowedMenus = []

  if (roleName === 'master') {
    allowedMenus = [...MENU_PERMISSION_CODES]
  } else if (roleName === 'administrador') {
    allowedMenus = ['menu:dashboard', ...MENU_ALL_CONSULTAS, ...MENU_GESTAO_CONTROLE, ...MENU_CONFIGURACOES_ALL]
  } else if (roleName === 'supervisor') {
    allowedMenus = ['menu:dashboard', ...MENU_ALL_CONSULTAS, ...MENU_CONFIGURACOES_ALL]
  } else {
    // Operador (padrão)
    allowedMenus = ['menu:dashboard', ...MENU_ALL_CONSULTAS]
  }

  // Nesta etapa os botões continuam todos ligados no mock de frontend.
  return makeState([...allowedMenus, ...BUTTON_PERMISSION_CODES])
}

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
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [passwordUser, setPasswordUser] = useState(null)
  const [passwordValue, setPasswordValue] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordCurrent, setPasswordCurrent] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [editNome, setEditNome] = useState('')
  const [editLogin, setEditLogin] = useState('')
  const [editTipo, setEditTipo] = useState('Operador')
  const [editStatusAtivo, setEditStatusAtivo] = useState(true)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterTipo, setFilterTipo] = useState('')
  const [filterNome, setFilterNome] = useState('')
  const [filterEquipeId, setFilterEquipeId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [transferUser, setTransferUser] = useState(null)
  const [transferNewEquipeId, setTransferNewEquipeId] = useState('')
  const [userPermissionDrafts, setUserPermissionDrafts] = useState({})
  const detailAnchorRef = useRef(null)
  const normalizeId = (value) => {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return Number.isNaN(num) ? null : num
  }
  const smoothScrollTo = (targetY, duration = 450) => {
    if (typeof window === 'undefined') return
    const startY = window.scrollY || window.pageYOffset || 0
    const diff = targetY - startY
    if (Math.abs(diff) < 1) return
    const start = performance.now()
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
    const step = (now) => {
      const elapsed = Math.min(1, (now - start) / duration)
      const eased = easeOutCubic(elapsed)
      window.scrollTo(0, startY + diff * eased)
      if (elapsed < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  useEffect(() => {
    let aborted = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('https://n8n.apivieiracred.store/webhook/user-team', {
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
          nome: u?.nome ?? u?.name ?? 'Usuários',
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
            // Fallback: criar equipes baseado nos Usuários
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
        console.error('Falha API Usuários:', e)
        if (!aborted) { setError(e); setUsuarios([]); setSelectedId(null) }
      } finally {
        if (!aborted) setIsLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [user?.id])
  const baseUsuarios = useMemo(() => {
    const isAdminRole = ['master', 'administrador'].includes((user?.role || '').toLowerCase())
    const isMasterTeam = (user?.equipe_nome || '').toLowerCase() === 'master'
    if (isAdminRole || isMasterTeam) return usuarios
    if (user?.equipe_id != null) return usuarios.filter(u => u.equipe_id === user.equipe_id)
    return usuarios
  }, [usuarios, user])
  const filtered = useMemo(() => {
    let list = baseUsuarios
    
    // Filtro por tipo (role)
    const tipo = (filterTipo || '').trim()
    if (tipo) {
      const t = tipo.toLowerCase()
      list = list.filter(u => (u.role || '').toLowerCase() === t)
    }
    
    // Filtro por nome
    const nomeTerm = (filterNome || '').trim().toLowerCase()
    if (nomeTerm) {
      list = list.filter(u => (u.nome || '').toLowerCase().includes(nomeTerm))
    }
    
    // Filtro por equipe
    const eqId = filterEquipeId ? Number(filterEquipeId) : null
    if (eqId) {
      list = list.filter(u => u.equipe_id === eqId)
    }
    
    // Filtro por status
    const status = (filterStatus || '').trim()
    if (status) {
      const wantActive = status === 'Ativo'
      list = list.filter(u => Boolean(u.ativo) === wantActive)
    }
    
    // Busca livre
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter(u =>
        (u.nome || '').toLowerCase().includes(term) ||
        (u.role || '').toLowerCase().includes(term)
      )
    }
    
    return list
  }, [baseUsuarios, search, filterTipo, filterNome, filterEquipeId, filterStatus])
  const selected = useMemo(() => filtered.find(u => u.id === selectedId) || null, [filtered, selectedId])
  useEffect(() => {
    if (!filtered.some(u => u.id === selectedId)) setSelectedId(filtered[0]?.id ?? null)
  }, [filtered, selectedId])
  const isSuperUser = (user?.role === 'Master') || ((user?.equipe_nome || '').toLowerCase() === 'master')
  const canEditPermissionCheckboxes = Number(user?.id) === 1
  const isSupervisor = user?.role === 'Supervisor'
  const isAdminRole = (user?.role || '').toLowerCase() === 'administrador'
  const isScopedManager = isSupervisor || isAdminRole
  const canManageAll = isSuperUser
  const canAdd = canManageAll || isScopedManager
  const sameTeam = (target) => {
    const te = target?.equipe_id
    const ue = user?.equipe_id
    if (te == null || ue == null) return false
    return Number(te) === Number(ue)
  }
  // Somente Master pode editar dados do usuário (nome/login/tipo/status via modal)
  const canEditUser = (target) => canManageAll
  const canTransferUser = () => canManageAll
  const canDeleteUser = (target) => canManageAll && (target?.id !== user?.id)
  // Admin/Supervisor podem alterar status e senha apenas da própria equipe
  const canToggleUser = (target) => (canManageAll || (isScopedManager && sameTeam(target))) && (target?.id !== user?.id)
  const canChangePasswordFor = (target) => canManageAll || (isScopedManager && sameTeam(target))
  const teamNameById = (id) => {
    const found = (equipesLista || []).find(e => e.id === id)
    return found ? found.nome : (id != null ? `Equipe ${id}` : '-')
  }
  const selectedUserPermissions = useMemo(() => {
    const preset = buildPermissionPresetByRole(selected?.role)
    const selectedUserId = normalizeId(selected?.id)
    if (selectedUserId == null) return preset
    return userPermissionDrafts[selectedUserId] || preset
  }, [selected?.id, selected?.role, userPermissionDrafts])
  const handleTogglePermissionCheckbox = (permissionCode) => {
    if (!canEditPermissionCheckboxes) return
    const selectedUserId = normalizeId(selected?.id)
    if (selectedUserId == null) return

    setUserPermissionDrafts((prev) => {
      const current = prev[selectedUserId] || buildPermissionPresetByRole(selected?.role)
      return {
        ...prev,
        [selectedUserId]: {
          ...current,
          [permissionCode]: !Boolean(current[permissionCode]),
        },
      }
    })
  }
  const handleSavePermissionDraft = () => {
    notify.info('Frontend apenas: sem integração com API no momento.')
  }
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
    const upper = (nome || '').toUpperCase()
    setFormNome(upper)
    // se login estiver vazio ou era derivado do nome anterior, atualiza sugestão em minúsculas
    if (!formLogin || formLogin === toLoginFromName(formNome)) {
      setFormLogin(toLoginFromName(upper))
    }
  }
  // Função para abrir modal de adicionar Usuário
  const handleOpenAddModal = () => {
    if (!canAdd) return
    // Limpar formulário
    setFormNome('')
    setFormLogin('')
    setFormSenha('')
    // Definir tipo padrão conforme papel de quem está criando
    if (isSupervisor) setFormTipo('Operador')
    else if (isAdminRole) setFormTipo('Administrador')
    else setFormTipo('Operador')
    
    // Para supervisores/administradores, definir automaticamente a equipe
    if ((isSupervisor || isAdminRole) && user?.equipe_id) {
      setFormEquipeId(user.equipe_id)
    } else {
      setFormEquipeId(equipesLista[0]?.id || null)
    }
    
    setIsAddOpen(true)
  }
  const openPasswordModal = (targetUser) => {
    if (!canChangePasswordFor(targetUser)) return
    if (!targetUser) return
    setPasswordUser(targetUser)
    setPasswordValue('')
    setPasswordConfirm('')
    setPasswordCurrent('')
    setShowNewPassword(false)
    setShowCurrentPassword(false)
    setIsPasswordModalOpen(true)
  }
  const openTransferModal = (targetUser) => {
    if (!canTransferUser(targetUser)) return
    if (!targetUser) return
    setTransferUser(targetUser)
    // preseleciona diferente da atual se houver
    const firstDifferent = (equipesLista || []).find(eq => eq.id !== targetUser.equipe_id)?.id ?? ''
    setTransferNewEquipeId(firstDifferent !== undefined ? String(firstDifferent) : '')
    setIsTransferOpen(true)
  }
  const closeTransferModal = () => {
    setIsTransferOpen(false)
    setTransferUser(null)
    setTransferNewEquipeId('')
  }
  const handleConfirmTransfer = async (e) => {
    e?.preventDefault?.()
    if (!canTransferUser(transferUser)) return
    if (!transferUser) return
    const newIdNum = transferNewEquipeId ? Number(transferNewEquipeId) : null
    if (!newIdNum || newIdNum === transferUser.equipe_id) {
      notify.warn('Selecione uma nova equipe diferente da atual')
      return
    }
    try {
      const payload = {
        id_usuario: transferUser.id,
        equipe_id: newIdNum,
      }
      const response = await fetch('https://n8n.apivieiracred.store/webhook/transfer-team', {
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
      setUsuarios(prev => prev.map(u => (
        u.id === transferUser.id ? { ...u, equipe_id: newIdNum } : u
      )))
      notify.success('Usuário transferido de equipe.')
      closeTransferModal()
    } catch (err) {
      notify.error(`Erro ao transferir: ${err.message}`)
    }
  }
  const closePasswordModal = () => {
    setIsPasswordModalOpen(false)
    setPasswordUser(null)
    setPasswordValue('')
    setPasswordConfirm('')
    setPasswordCurrent('')
    setShowNewPassword(false)
    setShowCurrentPassword(false)
    setIsChangingPassword(false)
  }
  const handleGeneratePassword = () => {
    const length = Math.floor(Math.random() * 3) + 6
    let generated = ''
    for (let i = 0; i < length; i += 1) {
      generated += Math.floor(Math.random() * 10).toString()
    }
    setPasswordValue(generated)
    setPasswordConfirm(generated)
    setShowNewPassword(true)
  }
  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    if (!canChangePasswordFor(passwordUser)) return
    const senhaAtual = passwordCurrent.trim()
    const senha = passwordValue.trim()
    const confirmacao = passwordConfirm.trim()
    if (!senhaAtual || !senha || !confirmacao) {
      notify.warn('Preencha todos os campos obrigatórios')
      return
    }
    if (senha.length < 4) {
      notify.warn('A senha deve ter pelo menos 4 caracteres')
      return
    }
    if (senha !== confirmacao) {
      notify.warn('As senhas Não coincidem')
      return
    }
    const userId = normalizeId(passwordUser?.id ?? null) ?? passwordUser?.id ?? null
    if (userId == null) {
      notify.error('Selecione um Usuário válido')
      return
    }
    setIsChangingPassword(true)
    try {
      const response = await fetch('https://n8n.apivieiracred.store/webhook/alter-pass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: userId,
          senha_nova: senha,
          senha_atual: senhaAtual,
          confirmacao
        })
      })
      const rawBody = await response.text()
      if (!response.ok) {
        const message = (rawBody || '').trim() || `Erro ${response.status}`
        throw new Error(message)
      }
      const trimmedBody = (rawBody || '').trim()
      const normalizedBody = trimmedBody.toLowerCase()
      if (!trimmedBody || trimmedBody === '{}' || trimmedBody === '[]' || normalizedBody === 'null' || normalizedBody === 'undefined') {
        const message = 'Senha não alterada: usuário não encontrado.'
        console.warn(`API alter-pass retornou payload vazio para o Usuário ${userId}`, trimmedBody)
        notify.error(message)
        return
      }
      let successMessage = 'Senha atualizada com sucesso.'
      try {
        const parsed = JSON.parse(trimmedBody)
        console.log('Senha alterada via API:', parsed)
        if (parsed == null || (Array.isArray(parsed) && parsed.length === 0) || (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0)) {
          const message = 'Senha não alterada: usuário não encontrado.'
          console.warn(`API alter-pass retornou objeto vazio para o Usuário ${userId}`, parsed)
          notify.error(message)
          return
        }
        const apiMessage = parsed?.mensagem ?? parsed?.message ?? parsed?.status
        if (typeof apiMessage === 'string' && apiMessage.trim()) successMessage = apiMessage.trim()
      } catch (_) {
        console.log('Senha alterada via API (texto):', trimmedBody)
        successMessage = trimmedBody
      }
      notify.success(successMessage)
      closePasswordModal()
    } catch (error) {
      console.error('Erro ao alterar senha:', error)
      notify.error(`Erro ao alterar senha: ${error.message}`)
    } finally {
      setIsChangingPassword(false)
    }
  }
  const roleToOption = (role) => {
    switch ((role || '').toLowerCase()) {
      case 'master':
        return 'Master'
      case 'administrador':
        return 'Administrador'
      case 'supervisor':
        return 'Supervisor'
      case 'operador':
        return 'Operador'
      default:
        return 'Operador'
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
  const openEditModal = (targetUser) => {
    if (!canEditUser(targetUser)) return
    if (!targetUser) return
    setEditUser(targetUser)
    setEditNome((targetUser.nome || '').toUpperCase())
    setEditLogin((targetUser.login || '').toLowerCase())
    setEditTipo(roleToOption(targetUser.role))
    setEditStatusAtivo(targetUser.ativo !== false)
    setIsEditModalOpen(true)
  }
  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditUser(null)
    setEditNome('')
    setEditLogin('')
    setEditTipo('Operador')
    setEditStatusAtivo(true)
    setIsSavingEdit(false)
  }
  const handleEditSubmit = async (event) => {
    if (!canEditUser(editUser)) { notify.warn('Você só pode alterar usuários da sua equipe.'); return }
    event.preventDefault()
    const nome = editNome.trim()
    const login = editLogin.trim()
    const roleOption = optionToRole(editTipo)
    const userId = normalizeId(editUser?.id ?? null) ?? editUser?.id ?? null
    if (!userId) {
      notify.error('Selecione um Usuário válido')
      return
    }
    if (!nome || !login) {
      notify.warn('Preencha todos os campos obrigatórios')
      return
    }
    setIsSavingEdit(true)
    try {
      const response = await fetch('https://n8n.apivieiracred.store/webhook/alter-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: userId,
          nome: nome.toUpperCase(),
          login: login.toLowerCase(),
          role: roleOption,
          ativo: editStatusAtivo,
          status: editStatusAtivo ? 'Ativo' : 'Inativo'
        })
      })
      const rawBody = await response.text()
      if (!response.ok) {
        const message = (rawBody || '').trim() || `Erro ${response.status}`
        throw new Error(message)
      }
      let successMessage = 'Usuário atualizado com sucesso.'
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody)
          console.log('Usuário alterado via API:', parsed)
          const apiMessage = parsed?.mensagem ?? parsed?.message ?? parsed?.status
          if (typeof apiMessage === 'string' && apiMessage.trim()) successMessage = apiMessage.trim()
        } catch (_) {
          console.log('Usuário alterado via API (texto):', rawBody)
          if (rawBody.trim()) successMessage = rawBody.trim()
        }
      }
      const nomeUpper = nome.toUpperCase()
      const loginLower = login.toLowerCase()
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, nome: nomeUpper, login: loginLower, role: roleOption, ativo: editStatusAtivo } : u))
      setSelectedId(userId)
      notify.success(successMessage)
      closeEditModal()
    } catch (error) {
      console.error('Erro ao atualizar Usuário:', error)
      notify.error(`Erro ao atualizar Usuário: ${error.message}`)
    } finally {
      setIsSavingEdit(false)
    }
  }
  async function handleAddSubmit(e) {
    if (!canAdd) return
    e.preventDefault()
    console.log('✅ Iniciando handleAddSubmit...')
    
    const nome = formNome.trim()
    const login = formLogin.trim()
    const senha = formSenha.trim()
    
    console.log('Y Dados do formulário:', { nome, login, senha, formEquipeId, formTipo })
    
    if (!nome || !login || !senha) {
      notify.warn('Preencha todos os campos obrigatórios')
      return
    }
    if (senha.length < 4) {
      notify.warn('A senha deve ter pelo menos 4 caracteres')
      return
    }
    
    const tipoSel = (formTipo || 'Operador').trim()
    const roleOut = isAdminRole ? 'Administrador' : tipoSel
    const equipeId = (isSupervisor || isAdminRole) ? (user?.equipe_id ?? formEquipeId) : formEquipeId
    
    console.log('Processamento:', { tipoSel, roleOut, equipeId, isSupervisor })
    
    if (!equipeId) {
      notify.warn('Selecione uma equipe')
      return
    }
    setIsSaving(true)
    
    try {
      console.log('Criando Usuário via API...', { nome, login, role: roleOut, equipe_id: equipeId })
      
      // Chamada para a API de adicionar Usuário
      const response = await fetch('https://n8n.apivieiracred.store/webhook/add-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: nome.toUpperCase(),
          login: login.toLowerCase(),
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
      console.log('Usuário criado via API:', result)
      // Criar objeto local para atualizar a lista
      const nextId = result.id || result.Id || Math.max(0, ...usuarios.map(u => u.id || 0)) + 1
      const novo = {
        id: nextId,
        nome: nome.toUpperCase(),
        login: login.toLowerCase(),
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
      console.error('a Erro ao criar Usuário:', error)
      notify.error(`Erro ao criar Usuário: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }
  async function handleDeleteUser(targetId) {
    const targetUser = usuarios.find(u => u.id === targetId)
    if (!canDeleteUser(targetUser)) return
    if (targetId === user?.id) return
    setDeletingId(targetId)
    setPendingDelete(null)
    try {
      const response = await fetch('https://n8n.apivieiracred.store/webhook/delete-user', {
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
      console.error('Erro ao excluir Usuário:', error)
      notify.error(`Erro ao excluir Usuário: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }
  const handleToggleStatus = async (targetUser) => {
    if (!canToggleUser(targetUser)) return
    if (!targetUser) return
    const targetId = normalizeId(targetUser.id ?? null) ?? targetUser.id ?? null
    if (targetId == null) {
      notify.error('Não foi possível identificar o usuário.')
      return
    }
    if (targetId === user?.id) {
      notify.warn('Você não pode alterar o seu próprio status.')
      return
    }
    const nextActive = !targetUser.ativo
    setTogglingId(targetId)
    try {
      const response = await fetch('https://n8n.apivieiracred.store/webhook/alter-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: targetId,
          ativo: nextActive,
          status: nextActive ? 'Ativo' : 'Inativo'
        })
      })
      const rawBody = await response.text()
      if (!response.ok) {
        const message = (rawBody || '').trim() || `Erro ${response.status}`
        throw new Error(message)
      }
      let successMessage = nextActive ? 'Usuário ativado.' : 'Usuário desativado.'
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody)
          console.log('Status alterado via API:', parsed)
          const apiMessage = parsed?.mensagem ?? parsed?.message ?? parsed?.status
          if (typeof apiMessage === 'string' && apiMessage.trim()) successMessage = apiMessage.trim()
        } catch (_) {
          console.log('Status alterado via API (texto):', rawBody)
          if (rawBody.trim()) successMessage = rawBody.trim()
        }
      }
      setUsuarios(prev => prev.map(u => (
        u.id === targetId ? { ...u, ativo: nextActive } : u
      )))
      notify.success(successMessage)
    } catch (error) {
      console.error('Erro ao alterar status:', error)
      notify.error(`Erro ao alterar status: ${error.message}`)
    } finally {
      setTogglingId(null)
    }
  }
  useEffect(() => {
    if (!selected) return
    const el = detailAnchorRef.current
    if (!el) return
    window.requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const top = Math.max(0, rect.top + window.scrollY - 12)
      smoothScrollTo(top)
    })
  }, [selectedId, selected])

  return (
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
              <h2 className="fw-bold mb-1">Usuários</h2>
              <div className="opacity-75 small">Gerencie contas, perfis e acessos</div>
            </div>
          </div>
        </div>
        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="neo-card neo-lg p-4 h-100">
                            <div className="d-flex align-items-center gap-2 mb-3">
                
                {canAdd && (
              <button className="btn btn-primary d-flex align-items-center justify-content-center" title="Adicionar Usuário" aria-label="Adicionar Usuário" onClick={handleOpenAddModal} disabled={!canAdd}>
                    <Fi.FiPlus />
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" title="Filtrar" aria-label="Filtrar" onClick={() => setIsFilterOpen(v => !v)}>
                  <Fi.FiFilter />
                </button>
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="form-control" placeholder="Buscar Usuário..." />
                <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')} aria-label="Limpar busca" title="Limpar">
                  <Fi.FiX />
                </button>
              </div>
              <div style={{ overflow: 'hidden', transition: 'max-height 300ms ease', maxHeight: isFilterOpen ? 500 : 0 }}>
                <div className="border rounded-3 p-3 mb-3 user-filter-surface">
                  <div className="row g-2 align-items-end">
                    <div className="col-12 col-md-3">
                      <label className="form-label small opacity-75">Tipo</label>
                      <select className="form-select form-select-sm" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                        <option value="">Todos</option>
                        <option>Master</option>
                        <option>Administrador</option>
                        <option>Supervisor</option>
                        <option>Operador</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small opacity-75">Nome</label>
                      <input className="form-control form-control-sm" value={filterNome} onChange={(e) => setFilterNome(e.target.value)} placeholder="Filtrar por nome..." />
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label small opacity-75">Equipe</label>
                      <select className="form-select form-select-sm" value={filterEquipeId} onChange={(e) => setFilterEquipeId(e.target.value)}>
                        <option value="">Todas</option>
                        {(equipesLista || []).map(eq => (
                          <option key={eq.id} value={eq.id}>{eq.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-2">
                      <label className="form-label small opacity-75">Status</label>
                      <select className="form-select form-select-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="">Todos</option>
                        <option>Ativo</option>
                        <option>Inativo</option>
                      </select>
                    </div>
                    <div className="col-12 d-flex justify-content-end">
                      <button type="button" className="btn btn-ghost btn-sm" title="Limpar filtros" onClick={() => { setFilterTipo(''); setFilterNome(''); setFilterEquipeId(''); setFilterStatus(''); }}>Limpar</button>
                    </div>
                  </div>
                </div>
              </div>              {isLoading && (<div className="text-center py-4 opacity-75">Carregando...</div>)}
              {error && (<div className="alert alert-danger py-2">{String(error)}</div>)}
              {!isLoading && !error && (
                <ul className="list-group">
                  {filtered.length === 0 && (<li className="list-group-item text-center opacity-75">Nenhum Usuário encontrado</li>)}
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
          <div className="col-12 col-lg-7">
            <div
              className="neo-card neo-lg p-4 h-100"
              ref={detailAnchorRef}
            >
              {!selected ? (
                <div className="opacity-75">Selecione um Usuário para ver os detalhes.</div>
              ) : (
                <>
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div>
                      <h5 className="mb-1">{selected.nome}</h5>
                    </div>
                    <div className="d-flex gap-2">
                      {canEditUser(selected) && (
                        <button className="btn btn-ghost btn-ghost-primary btn-icon" title="Editar" aria-label="Editar" onClick={() => openEditModal(selected)}>
                          <Fi.FiEdit />
                        </button>
                      )}
                      <button className="btn btn-ghost btn-icon" title="Transferir" aria-label="Transferir" onClick={() => openTransferModal(selected)} disabled={!canTransferUser(selected)}>
                        <Fi.FiArrowRight />
                      </button>
                      <button className="btn btn-ghost btn-ghost-danger btn-icon" title="Excluir" aria-label="Excluir" disabled={!canDeleteUser(selected) || deletingId === selected.id}
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
                      <div className="p-3 rounded-3 h-100 user-detail-surface">
                        <div className="small text-uppercase opacity-75 mb-2">Perfil</div>
                        <div className="mb-1"><span className="opacity-75">Nome: </span>{selected.nome}</div>
                        <div className="mb-1"><span className="opacity-75">Login: </span>{selected.login}</div>
                        <div className="mb-2"><span className="opacity-75">Tipo: </span>{selected.role}</div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 rounded-3 h-100 user-detail-surface">
                        <div className="small text-uppercase opacity-75 mb-2">SEGURANÇA</div>
                        <div className="mb-2"><span className="opacity-75">Status: </span>{selected.ativo ? 'Ativo' : 'Inativo'}</div>
                        <div className="d-flex gap-2">
                          <button className="btn btn-outline-warning btn-sm" title="Alterar senha" aria-label="Alterar senha" disabled={!canChangePasswordFor(selected)}
                            onClick={() => openPasswordModal(selected)}>
                            <Fi.FiKey />
                          </button>
                          <button className="btn btn-outline-secondary btn-sm" title={selected.ativo ? 'Desativar Usuário' : 'Ativar Usuário'} aria-label={selected.ativo ? 'Desativar Usuário' : 'Ativar Usuário'} disabled={!canToggleUser(selected) || togglingId === selected.id}
                            onClick={() => handleToggleStatus(selected)}>
                            {togglingId === selected.id ? (
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            ) : (
                              <Fi.FiLock />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-3 user-detail-surface">
                    <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
                      <div>
                        <div className="small text-uppercase opacity-75">Permissões de acesso</div>
                        <div className="small opacity-75">
                          Controle visual via checkbox (frontend). Somente usuário ID 1 pode alterar.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleSavePermissionDraft}
                        disabled={!canEditPermissionCheckboxes || !selected}
                      >
                        Salvar (mock)
                      </button>
                    </div>
                    <div className="row g-3">
                      <div className="col-12 col-md-7">
                        <div className="p-3 rounded-3 border h-100">
                          <div className="fw-semibold mb-2">Menus</div>
                          <div className="d-flex flex-column gap-3">
                            {MENU_PERMISSION_TREE.map((section) => (
                              <div key={section.menu.code} className="d-flex flex-column gap-2">
                                <label className="form-check d-flex align-items-center gap-2 m-0">
                                  <input
                                    type="checkbox"
                                    className="form-check-input mt-0"
                                    checked={Boolean(selectedUserPermissions[section.menu.code])}
                                    onChange={() => handleTogglePermissionCheckbox(section.menu.code)}
                                    disabled={!canEditPermissionCheckboxes || !selected}
                                  />
                                  <span className="form-check-label fw-semibold">{section.menu.label}</span>
                                </label>
                                {section.children.length > 0 && (
                                  <div className="ps-4 d-flex flex-column gap-2">
                                    {section.children.map((item) => (
                                      <label key={item.code} className="form-check d-flex align-items-center gap-2 m-0">
                                        <input
                                          type="checkbox"
                                          className="form-check-input mt-0"
                                          checked={Boolean(selectedUserPermissions[item.code])}
                                          onChange={() => handleTogglePermissionCheckbox(item.code)}
                                          disabled={!canEditPermissionCheckboxes || !selected}
                                        />
                                        <span className="form-check-label">{item.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* <div className="small mt-3 opacity-75">IntegraAAo com: https://n8n.apivieiracred.store/webhook/add-user</div> */}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      {isTransferOpen && transferUser && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Transferir Usuário</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeTransferModal}></button>
              </div>
              <form onSubmit={handleConfirmTransfer}>
                <div className="modal-body">
                  <div className="mb-3">
                    <div className="small text-uppercase opacity-75 mb-2">Usuário</div>
                    <div className="fw-semibold">{transferUser?.nome}</div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between gap-3">
                    <div className="flex-fill">
                      <label className="form-label">Equipe atual</label>
                      <input className="form-control" value={teamNameById(transferUser?.equipe_id)} disabled readOnly />
                    </div>
                    <div className="text-center" aria-hidden="true" style={{ width: '48px', marginTop: '22px' }}>
                      <Fi.FiArrowRight size={24} />
                    </div>
                    <div className="flex-fill">
                      <label className="form-label">Nova equipe</label>
                      <select className="form-select" value={transferNewEquipeId} onChange={(e) => setTransferNewEquipeId(e.target.value)} required>
                        <option value="">Selecione...</option>
                        {(equipesLista || []).map(eq => (
                          <option key={eq.id} value={eq.id} disabled={eq.id === transferUser?.equipe_id}>
                            {eq.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeTransferModal}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={!transferNewEquipeId || Number(transferNewEquipeId) === transferUser?.equipe_id}>Confirmar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {isAddOpen && (
  <div className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" style={{background:'rgba(0,0,0,0.6)', zIndex:1050}}>
    <div className="neo-card neo-lg p-4" style={{maxWidth:720, width:'95%'}}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="mb-0">Adicionar Usuário</h5>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Fechar" onClick={() => setIsAddOpen(false)} disabled={isSaving}>
          <Fi.FiX />
        </button>
      </div>
      <form onSubmit={handleAddSubmit}>
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label">Nome Completo *</label>
            <input className="form-control" value={formNome} onChange={(e) => handleNomeChange(e.target.value)} disabled={isSaving} placeholder="Ex: Joao Silva" required />
          </div>
          <div className="col-12">
            <label className="form-label">Login *</label>
            <input className="form-control" value={formLogin} onChange={(e) => setFormLogin((e.target.value || '').toLowerCase())} disabled={isSaving} placeholder="Ex: joaosilva" required />
            <div className="form-text text-white">Login será usado para acessar o sistema</div>
          </div>
          <div className="col-12">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={formTipo} onChange={(e) => setFormTipo(e.target.value)} disabled={(isSupervisor || isAdminRole) || isSaving}>
              <option>Master</option>
              <option>Administrador</option>
              <option>Supervisor</option>
              <option>Operador</option>
            </select>
            {isSupervisor && <div className="form-text text-white">Como supervisor(a), você só pode criar operadores</div>}
            {isAdminRole && <div className="form-text text-white">Como administrador(a), você só pode criar usuários Administradores</div>}
          </div>
          <div className="col-12">
            <label className="form-label">Senha *</label>
            <input type="password" className="form-control" value={formSenha} onChange={(e) => setFormSenha(e.target.value)} disabled={isSaving} placeholder="Minimo 4 caracteres" required />
          </div>
          <div className="col-12">
            <label className="form-label">Equipe *</label>
            <select className="form-select" value={formEquipeId ?? ''} onChange={(e) => setFormEquipeId(e.target.value ? parseInt(e.target.value, 10) : null)} disabled={(isSupervisor || isAdminRole) || isSaving} required>
              <option value="" disabled>Selecione uma equipe...</option>
              {(equipesLista || []).map(eq => (<option key={eq.id} value={eq.id}>{eq.nome}</option>))}
            </select>
          </div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <button type="button" className="btn btn-ghost" onClick={() => setIsAddOpen(false)} disabled={isSaving}>Cancelar</button>
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
      )}
      {isEditModalOpen && editUser && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Editar usuario</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeEditModal} disabled={isSavingEdit}></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nome</label>
                     <input className="form-control" value={editNome} onChange={(e) => setEditNome((e.target.value || '').toUpperCase())} disabled={isSavingEdit} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Login</label>
                     <input className="form-control" value={editLogin} onChange={(e) => setEditLogin((e.target.value || '').toLowerCase())} disabled={isSavingEdit} required />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Tipo</label>
                      <select className="form-select" value={editTipo} onChange={(e) => setEditTipo(e.target.value)} disabled={isSavingEdit}>
                        <option>Master</option>
                        <option>Administrador</option>
                        <option>Supervisor</option>
                        <option>Operador</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Status</label>
                      <select className="form-select" value={editStatusAtivo ? 'Ativo' : 'Inativo'} onChange={(e) => setEditStatusAtivo(e.target.value === 'Ativo')} disabled={isSavingEdit}>
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={closeEditModal} disabled={isSavingEdit}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={isSavingEdit || !editNome.trim() || !editLogin.trim()}>Salvar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {isPasswordModalOpen && passwordUser && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Alterar senha</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={closePasswordModal} disabled={isChangingPassword}></button>
              </div>
              <form onSubmit={handlePasswordSubmit}>
                <div className="modal-body">
                  <p className="small opacity-75 mb-3">Defina uma nova senha para <strong>{passwordUser.nome}</strong>.</p>
                  <div className="mb-3">
                    <label className="form-label">Senha atual *</label>
                    <div className="input-group">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        className="form-control"
                        value={passwordCurrent}
                        onChange={(e) => setPasswordCurrent(e.target.value)}
                        disabled={isChangingPassword}
                        placeholder="Digite a senha atual"
                        minLength={4}
                        required
                      />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCurrentPassword((prev) => !prev)} disabled={isChangingPassword} title={showCurrentPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-label={showCurrentPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                        {showCurrentPassword ? <Fi.FiEyeOff /> : <Fi.FiEye />}
                      </button>
                    </div>
                    <div className="form-text">Informe a senha utilizada no login.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nova senha *</label>
                    <div className="input-group">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        className="form-control"
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        disabled={isChangingPassword}
                        placeholder="Digite a nova senha"
                        minLength={4}
                        required
                      />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setShowNewPassword((prev) => !prev)} disabled={isChangingPassword} title={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                        {showNewPassword ? <Fi.FiEyeOff /> : <Fi.FiEye />}
                      </button>
                      <button type="button" className="btn btn-outline-primary" onClick={handleGeneratePassword} disabled={isChangingPassword} title="Gerar senha" aria-label="Gerar senha">
                        <Fi.FiZap />
                      </button>
                    </div>
                    <div className="form-text">Use o gerador para criar uma senha entre 6 e 8 digitos ou digite manualmente.</div>
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Confirmar senha *</label>
                    <div className="input-group">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        className="form-control"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        disabled={isChangingPassword}
                        placeholder="Repita a nova senha"
                        minLength={4}
                        required
                      />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setShowNewPassword((prev) => !prev)} disabled={isChangingPassword} title={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                        {showNewPassword ? <Fi.FiEyeOff /> : <Fi.FiEye />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closePasswordModal} disabled={isChangingPassword}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={isChangingPassword || !passwordCurrent.trim() || !passwordValue.trim() || !passwordConfirm.trim()}>
                    {isChangingPassword ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Salvando...
                      </>
                    ) : (
                      'Atualizar'
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
                <p className="mb-0 small opacity-75">Esta ação Não pode ser desfeita.</p>
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
