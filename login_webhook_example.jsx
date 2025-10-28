// ============================================================
// EXEMPLO COMPLETO DE INTEGRAÇÃO WEBHOOK + HIERARQUIA
// Para o projeto Nova Europa com webhook Sistema Vieira
// ============================================================

import React, { useState, useContext, createContext } from 'react';

// 📋 1. CONTEXTO DE AUTENTICAÇÃO COM HIERARQUIA
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

// 📋 2. PROVIDER DE AUTENTICAÇÃO
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Função de login integrada com webhook
  const login = async (login, senha) => {
    setLoading(true);
    
    try {
      console.log('🔐 Iniciando login com webhook...');
      
      // PASSO 1: Autenticar no webhook Sistema Vieira (n8n)
      const webhookResponse = await fetch('https://webhook.sistemavieira.com.br/webhook/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: login, // Campo LOGIN
          senha: senha
        })
      });

      const webhookResult = await webhookResponse.json();
      console.log('📡 Resposta do webhook:', webhookResult);

      if (!webhookResult.success) {
        throw new Error(webhookResult.message || 'Falha na autenticação');
      }

      // PASSO 2: Buscar hierarquia no nosso banco SQL Server
      console.log('🏢 Buscando hierarquia do usuário...');
      
      const hierarchyResponse = await fetch('/api/user-hierarchy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: login, // Campo LOGIN
          webhookToken: webhookResult.token
        })
      });

      if (!hierarchyResponse.ok) {
        throw new Error('Erro ao buscar dados de hierarquia');
      }

      const hierarchyData = await hierarchyResponse.json();
      console.log('📊 Dados de hierarquia:', hierarchyData);

      // PASSO 3: Combinar dados e criar objeto do usuário
      const userData = {
        // Dados básicos
        id: hierarchyData.Id,
        name: hierarchyData.Nome,
        login: hierarchyData.Login, // Campo LOGIN
        email: hierarchyData.Email,
        
        // Hierarquia
        role: hierarchyData.Role, // 'Master', 'Supervisor', 'Operador'
        level: hierarchyData.NivelHierarquia, // 1, 2, 3
        levelDescription: hierarchyData.DescricaoNivel,
        
        // Permissões
        permissions: hierarchyData.Permissoes ? 
          hierarchyData.Permissoes.split(',').filter(p => p.trim()) : [],
        permissionsDetails: hierarchyData.PermissoesDetalhadas ? 
          JSON.parse(hierarchyData.PermissoesDetalhadas) : [],
        
        // Tokens e metadata
        webhookToken: webhookResult.token,
        lastLogin: hierarchyData.DataUltimoLogin,
        loginTime: new Date().toISOString()
      };

      setUser(userData);
      localStorage.setItem('novaeuropaUser', JSON.stringify(userData));
      
      console.log('✅ Login realizado com sucesso:', userData);
      return { success: true, user: userData };

    } catch (error) {
      console.error('❌ Erro no login:', error);
      return { 
        success: false, 
        message: error.message || 'Erro interno do servidor' 
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem('novaeuropaUser');
    console.log('👋 Logout realizado');
  };

  // Verificar permissão específica
  const hasPermission = (permission) => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  };

  // Verificar acesso por nível hierárquico
  const canAccessLevel = (requiredLevel) => {
    if (!user) return false;
    // Menor número = maior hierarquia (1=Master, 2=Supervisor, 3=Operador)
    return user.level <= requiredLevel;
  };

  // Verificar se é Master
  const isMaster = () => user?.role === 'Master';
  
  // Verificar se é Supervisor ou superior
  const isSupervisorOrAbove = () => canAccessLevel(2);
  
  // Verificar se pode gerenciar usuários
  const canManageUsers = () => hasPermission('manage:users');

  // Recuperar usuário do localStorage na inicialização
  React.useEffect(() => {
    const savedUser = localStorage.getItem('novaeuropaUser');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        console.log('🔄 Usuário recuperado do localStorage:', userData);
      } catch (error) {
        console.error('Erro ao recuperar usuário:', error);
        localStorage.removeItem('novaeuropaUser');
      }
    }
  }, []);

  const value = {
    user,
    login,
    logout,
    loading,
    hasPermission,
    canAccessLevel,
    isMaster,
    isSupervisorOrAbove,
    canManageUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 📋 3. COMPONENTE DE LOGIN
export const LoginForm = () => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const { login: doLogin, loading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!login || !senha) {
      setError('Login e senha são obrigatórios');
      return;
    }

    const result = await doLogin(login, senha);
    
    if (!result.success) {
      setError(result.message);
    }
  };

  return (
    <div className="login-form">
      <h2>Login Nova Europa</h2>
      
      <form onSubmit={handleSubmit}>
        <div>
          <label>Login:</label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            disabled={loading}
            placeholder="andre.felipe"
          />
        </div>
        
        <div>
          <label>Senha:</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={loading}
            placeholder="Sua senha"
          />
        </div>
        
        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}
        
        <button type="submit" disabled={loading}>
          {loading ? '🔄 Entrando...' : '🔐 Entrar'}
        </button>
      </form>
      
      {/* Botões de teste */}
      <div className="test-buttons">
        <button onClick={() => { setLogin('andre.felipe'); setSenha('8996'); }}>
          👑 Teste Master
        </button>
      </div>
    </div>
  );
};

// 📋 4. COMPONENTE PROTEGIDO COM HIERARQUIA
export const ProtectedRoute = ({ children, requiredPermission, requiredLevel, fallback }) => {
  const { user, hasPermission, canAccessLevel } = useAuth();

  if (!user) {
    return fallback || <div>❌ Acesso negado - Faça login</div>;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || <div>❌ Acesso negado - Sem permissão: {requiredPermission}</div>;
  }

  if (requiredLevel && !canAccessLevel(requiredLevel)) {
    return fallback || <div>❌ Acesso negado - Nível insuficiente</div>;
  }

  return children;
};

// 📋 5. EXEMPLO DE USO DOS COMPONENTES
export const Dashboard = () => {
  const { user, logout, hasPermission, canAccessLevel } = useAuth();

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="dashboard">
      <header>
        <h1>🏢 Nova Europa - Dashboard</h1>
        <div className="user-info">
          <span>👤 {user.name}</span>
          <span>🎭 {user.role} (Nível {user.level})</span>
          <button onClick={logout}>🚪 Sair</button>
        </div>
      </header>

      <main>
        <div className="permissions-info">
          <h3>📋 Suas Permissões:</h3>
          <ul>
            {user.permissions.map(permission => (
              <li key={permission}>✅ {permission}</li>
            ))}
          </ul>
        </div>

        {/* Área Master */}
        <ProtectedRoute requiredLevel={1}>
          <div className="master-area">
            <h3>👑 Área Master</h3>
            <p>Você tem acesso completo ao sistema!</p>
          </div>
        </ProtectedRoute>

        {/* Área Supervisor */}
        <ProtectedRoute requiredLevel={2}>
          <div className="supervisor-area">
            <h3>👨‍💼 Área de Supervisão</h3>
            <p>Você pode supervisionar operações.</p>
          </div>
        </ProtectedRoute>

        {/* Área Operador */}
        <ProtectedRoute requiredLevel={3}>
          <div className="operator-area">
            <h3>👨‍🔧 Área de Operação</h3>
            <p>Você pode realizar operações básicas.</p>
          </div>
        </ProtectedRoute>

        {/* Gerenciamento de Usuários */}
        <ProtectedRoute requiredPermission="manage:users">
          <div className="user-management">
            <h3>👥 Gerenciar Usuários</h3>
            <p>Você pode criar e gerenciar usuários.</p>
          </div>
        </ProtectedRoute>
      </main>
    </div>
  );
};

// Exemplo de uso no App.jsx:
/*
function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
*/