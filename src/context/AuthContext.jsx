import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import users from '../data/users.json'
import { normalizeRole, Roles } from '../utils/roles.js'

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

const AuthContext = createContext(null)

const pad2 = (value) => String(value).padStart(2, '0')
const formatDateTime7 = (date, timeZone = 'America/Sao_Paulo') => {
  const zoned = new Date(date.toLocaleString('en-US', { timeZone }))
  const year = zoned.getFullYear()
  const month = pad2(zoned.getMonth() + 1)
  const day = pad2(zoned.getDate())
  const hours = pad2(zoned.getHours())
  const minutes = pad2(zoned.getMinutes())
  const seconds = pad2(zoned.getSeconds())
  const milliseconds = String(zoned.getMilliseconds()).padStart(3, '0')
  const fractional = `${milliseconds}0000`
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${fractional}`
}

const resolveClientIp = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    if (!response.ok) throw new Error('ipify error')
    const data = await response.json()
    const ip = data?.ip || ''
    if (ip) localStorage.setItem('ne_last_ip', ip)
    return ip || '0.0.0.0'
  } catch (error) {
    const cached = localStorage.getItem('ne_last_ip')
    return cached || '0.0.0.0'
  }
}
const normalizePermissionsList = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map(item => (item === null || item === undefined ? '' : String(item).trim()))
      .filter(Boolean)
  }
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

const deriveRoleFromProfile = (rawRole, level, permissionsList = []) => {
  const normalizedPermissions = permissionsList.map(permission => {
    const available = typeof permission.normalize === 'function' ? permission.normalize('NFD') : String(permission)
    return available.replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  })

  let resolved = normalizeRole(rawRole, level)

  if (!resolved) {
    const hasManageCapabilities = normalizedPermissions.some(p => p.startsWith('manage:'))
    const hasAdminView = normalizedPermissions.includes('view:admin')
    const hasSupervisionView = normalizedPermissions.includes('view:supervision')
    const hasOperationView = normalizedPermissions.includes('view:operation')

    if (hasAdminView && !hasManageCapabilities) {
      resolved = Roles.Administrador
    } else if (hasSupervisionView && !hasAdminView) {
      resolved = Roles.Supervisor
    } else if (!resolved && hasOperationView) {
      resolved = Roles.Operador
    }
  }

  return resolved || Roles.Operador
}



export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('ne_auth_user')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const permissions = normalizePermissionsList(parsed.permissions ?? parsed.Permissoes)
        const normalizedRole = deriveRoleFromProfile(parsed.role, parsed.level, permissions)
        const normalizedId = toNumberOrNull(parsed.id) ?? parsed.id
        const normalizedEquipeId = toNumberOrNull(parsed.equipe_id) ?? parsed.equipe_id
        const fixed = { ...parsed, role: normalizedRole, id: normalizedId, equipe_id: normalizedEquipeId, permissions }
        setUser(fixed)
        if (fixed.role !== parsed.role || fixed.id !== parsed.id || fixed.equipe_id !== parsed.equipe_id || JSON.stringify(fixed.permissions) !== JSON.stringify(parsed.permissions)) {
          localStorage.setItem('ne_auth_user', JSON.stringify(fixed))
        }
      } catch (_) {
        localStorage.removeItem('ne_auth_user')
      }
    }
  }, [])

  const login = async (loginUser, password) => {
    try {
      console.log('� Iniciando autenticação...');
      console.log('📊 Dados enviados:', { login: loginUser, senha: password });
      
      // PASSO 1: Autenticar no webhook
      const dataHoraLogin = formatDateTime7(new Date(), 'America/Sao_Paulo')
      const ultimoIp = await resolveClientIp()

      const webhookResponse = await fetch('https://n8n.apivieiracred.store/webhook/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: loginUser,
          senha: password,
          data_hora_login: dataHoraLogin,
          ultimo_ip: ultimoIp
        })
      });

      console.log('📡 Status da resposta:', webhookResponse.status);
      console.log('📡 Headers da resposta:', Object.fromEntries(webhookResponse.headers.entries()));
      
      const webhookResult = await webhookResponse.json();
      console.log('📡 Resposta COMPLETA do webhook:', JSON.stringify(webhookResult, null, 2));
      console.log('📡 Tipo da resposta:', typeof webhookResult);
      console.log('📡 É array?', Array.isArray(webhookResult));
      
      // PASSO 2: Verificar se a resposta tem dados de usuário
      if (!webhookResult) {
        console.error('� Resposta do webhook está vazia ou null');
        throw new Error('Erro na comunicação com o servidor');
      }
      
      console.log('� Verificando formato da resposta...');
      
      // Verificar se é um array vazio
      if (Array.isArray(webhookResult) && webhookResult.length === 0) {
        console.error('� Array vazio - credenciais inválidas');
        throw new Error('Credenciais inválidas');
      }
      
      // Verificar se é uma resposta de erro específica (quando vem como objeto)
      if (!Array.isArray(webhookResult) && (webhookResult.sucesso === 0 || webhookResult.sucesso === false)) {
        console.error('� Login rejeitado pelo servidor:', webhookResult.mensagem);
        throw new Error(webhookResult.mensagem || 'Credenciais inválidas');
      }

      // PASSO 3: Processar dados do usuário - CORRIGIDO PARA ARRAY
      let userData;
      console.log('� Processando dados do usuário...');
      
      if (Array.isArray(webhookResult) && webhookResult.length > 0) {
        // ✅ RESPOSTA COMO ARRAY - usar primeiro elemento
        userData = webhookResult[0];
        console.log('📊 Dados extraídos do array (posição 0):', userData);
      } else if (webhookResult.id || webhookResult.Id) {
        // Se for objeto direto com ID, usar diretamente
        userData = webhookResult;
        console.log('📊 Usando objeto direto:', userData);
      } else {
        console.error('� Formato de resposta inválido');
        console.error('� Resposta recebida:', webhookResult);
        throw new Error('Formato de resposta inválido');
      }
      
      // Verificar se tem dados essenciais - CAMPOS CORRETOS
      const userId = userData.id || userData.Id;
      const userName = userData.nome || userData.Nome || userData.name;
      const userLogin = userData.login || userData.Login;
      const userRole = userData.role || userData.Role;
      const userSucesso = userData.sucesso ?? userData.Sucesso;
      
      console.log('� Dados extraídos:');
      console.log('  - ID:', userId);
      console.log('  - Nome:', userName);
      console.log('  - Login:', userLogin);
      console.log('  - Role:', userRole);
      console.log('  - Sucesso:', userSucesso);
      
      if (!userId || !userName || !userLogin) {
        console.error('� Dados de usuário incompletos');
        console.error('� userId:', userId);
        console.error('� userName:', userName);
        console.error('� userLogin:', userLogin);
        throw new Error('Dados de usuário incompletos');
      }

      // Bloquear login quando o servidor indicar falha
      const statusContaRaw = (userData.status_conta ?? userData.StatusConta ?? '').toString().toUpperCase();
      const sucessoValor = userSucesso === undefined || userSucesso === null ? undefined : Number(userSucesso);
      const possuiFlagSucesso = sucessoValor !== undefined && !Number.isNaN(sucessoValor);
      const autenticadoComSucesso = possuiFlagSucesso ? (sucessoValor === 1) : true; // se não vier flag, assume true

      if (!autenticadoComSucesso || ['INVALID', 'BLOQUEADO', 'LOCKED'].includes(statusContaRaw)) {
        const msgSrv = userData.mensagem || userData.Mensagem || 'Credenciais inválidas';
        console.error('� Autenticação rejeitada:', { sucesso: userSucesso, status_conta: statusContaRaw, mensagem: msgSrv });
        throw new Error(msgSrv);
      }

      // PASSO 4: Criar objeto do usuário - MAPEAMENTO CORRETO
      const normalizedUserId = toNumberOrNull(userId) ?? userId
      const rawEquipeId = userData.equipe_id ?? userData.EquipeId ?? userData.equipeId ?? null
      const normalizedEquipeId = toNumberOrNull(rawEquipeId)
      const permissions = normalizePermissionsList(userData.permissoes || userData.Permissoes || 'view:operation')
      const normalizedRole = deriveRoleFromProfile(
        userData.role || userData.Role,
        userData.nivel_hierarquia || userData.NivelHierarquia,
        permissions
      )

      const payload = {
        id: normalizedUserId,
        name: userName,
        login: userLogin,
        email: userData.email || userData.Email || `${userLogin}@novaeuropa.com`,
        role: normalizedRole,
        level: userData.nivel_hierarquia || userData.NivelHierarquia || 3,
        levelDescription: userData.DescricaoNivel || `Acesso ${userData.role || 'básico'}`,
        lastLogin: userData.data_ultimo_login || userData.DataUltimoLogin,
        blocked: userData.conta_bloqueada || userData.ContaBloqueada || false,
        loginAttempts: userData.tentativas_login || userData.TentativasLogin || 0,
        permissions,
        status: userData.status_conta || userData.StatusConta || 'VALID',
        loginTime: new Date().toISOString(),
        equipe_nome: (userData.equipe_nome || userData.EquipeNome || userData.team_name || null),
        equipe_id: normalizedEquipeId ?? rawEquipeId,
        is_supervisor: (userData.is_supervisor ?? userData.IsSupervisor ?? false) ? true : false,
        success: (userSucesso !== undefined && userSucesso !== null) ? (Number(userSucesso) === 1) : true
      };

      setUser(payload);
      localStorage.setItem('ne_auth_user', JSON.stringify(payload));
      
      console.log('✅ Criando payload do usuário...');
      console.log('📊 Payload final:', payload);
      
      setUser(payload);
      localStorage.setItem('ne_auth_user', JSON.stringify(payload));
      
      console.log('✅ Login realizado com sucesso! Usuário salvo:', payload);
      return payload;
      
    } catch (error) {
      console.error('� Erro no login:', error);
      throw new Error(error.message || 'Erro na autenticação');
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('ne_auth_user')
  }

  const value = useMemo(() => ({ user, login, logout, isAuthenticated: !!user }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}