import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import users from '../data/users.json'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('ne_auth_user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch (_) {
        localStorage.removeItem('ne_auth_user')
      }
    }
  }, [])

  const login = async (loginUser, password) => {
    try {
      console.log('🔐 Iniciando autenticação...');
      
      // PASSO 1: Autenticar no webhook n8n
      const webhookResponse = await fetch('https://n8n.sistemavieira.com.br/webhook-test/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: loginUser,
          senha: password
        })
      });

      const webhookResult = await webhookResponse.json();
      
      if (!webhookResult || !webhookResult.Id) {
        throw new Error('Credenciais inválidas');
      }

      // PASSO 2: Criar objeto do usuário com dados da resposta
      const payload = {
        id: webhookResult.Id,
        name: webhookResult.Nome,
        login: webhookResult.Login,
        email: webhookResult.Email,
        role: webhookResult.Role,
        level: webhookResult.NivelHierarquia,
        permissions: webhookResult.Permissoes ? 
          webhookResult.Permissoes.split(',').filter(p => p.trim()) : [],
        statusConta: webhookResult.StatusConta
      };

      setUser(payload);
      localStorage.setItem('ne_auth_user', JSON.stringify(payload));
      
      console.log('✅ Login realizado com sucesso:', payload);
      return payload;
      
    } catch (error) {
      console.error('❌ Erro no login:', error);
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


