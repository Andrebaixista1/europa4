// ============================================================
// INTEGRAÇÃO COM WEBHOOK - EXEMPLO DE IMPLEMENTAÇÃO
// ============================================================

// 📋 1. FUNÇÃO PARA LOGIN COM WEBHOOK + HIERARQUIA
export async function loginComHierarquia(email, senha) {
  try {
    // Criptografar senha no formato que o webhook espera
    const senhaHash = await crypto.subtle.digest('SHA-256', 
      new TextEncoder().encode(senha)
    ).then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });

    // Fazer requisição para o webhook
    const webhookResponse = await fetch('https://webhook.sistemavieira.com.br/webhook/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        senha: senhaHash // Senha já criptografada
      })
    });

    const webhookResult = await webhookResponse.json();

    // Se o webhook autenticou, buscar dados de hierarquia no nosso banco
    if (webhookResult.success) {
      const hierarchyResponse = await fetch('/api/getUserHierarchy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          webhookToken: webhookResult.token // Token do webhook
        })
      });

      const hierarchyData = await hierarchyResponse.json();

      // Combinar dados do webhook com hierarquia
      return {
        success: true,
        user: {
          id: hierarchyData.Id,
          name: hierarchyData.Nome,
          email: hierarchyData.Email,
          role: hierarchyData.Role,
          nivel: hierarchyData.NivelHierarquia,
          permissions: hierarchyData.Permissoes?.split(',').filter(p => p) || [],
          webhookToken: webhookResult.token
        }
      };
    }

    return { success: false, message: 'Credenciais inválidas' };

  } catch (error) {
    console.error('Erro no login:', error);
    return { success: false, message: 'Erro interno do servidor' };
  }
}

// 📋 2. ENDPOINT BACKEND PARA BUSCAR HIERARQUIA (Node.js + Express)
// /api/getUserHierarchy
export async function getUserHierarchy(req, res) {
  const { email, webhookToken } = req.body;

  try {
    // Validar token do webhook (opcional - adicionar validação se necessário)
    
    // Conectar ao SQL Server e buscar dados de hierarquia
    const sql = require('mssql');
    const pool = await sql.connect(config);
    
    const result = await pool.request()
      .input('Email', sql.NVarChar, email)
      .query(`
        SELECT 
          u.Id,
          u.Nome,
          u.Email,
          n.Nome as Role,
          n.Nivel as NivelHierarquia,
          (
            SELECT p.Nome + ',' 
            FROM NivelPermissoes np
            INNER JOIN Permissoes p ON np.PermissaoId = p.Id
            WHERE np.NivelId = u.NivelId AND p.Ativo = 1
            FOR XML PATH('')
          ) as Permissoes
        FROM Usuarios u
        INNER JOIN Niveis n ON u.NivelId = n.Id
        WHERE u.Email = @Email AND u.Ativo = 1
      `);

    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).json({ error: 'Usuário não encontrado na hierarquia' });
    }

  } catch (error) {
    console.error('Erro ao buscar hierarquia:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// 📋 3. ATUALIZAR AuthContext.jsx PARA USAR HIERARQUIA
// Modificar o contexto de autenticação para incluir hierarquia
export function useAuthWithHierarchy() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    setLoading(true);
    
    const result = await loginComHierarquia(email, password);
    
    if (result.success) {
      setUser(result.user);
      localStorage.setItem('user', JSON.stringify(result.user));
      return { success: true };
    }
    
    setLoading(false);
    return { success: false, message: result.message };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  // Verificar permissões com base na hierarquia
  const hasPermission = (permission) => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };

  // Verificar se pode acessar baseado no nível hierárquico
  const canAccessLevel = (requiredLevel) => {
    if (!user) return false;
    return user.nivel <= requiredLevel; // Menor número = maior hierarquia
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  return {
    user,
    login,
    logout,
    hasPermission,
    canAccessLevel,
    loading
  };
}

// 📋 4. EXEMPLO DE USO NOS COMPONENTES
function OperationPanel() {
  const { user, hasPermission, canAccessLevel } = useAuthWithHierarchy();

  // Verificar por permissão específica
  if (!hasPermission('view:operation')) {
    return <div>Acesso negado - Sem permissão para operações</div>;
  }

  // Verificar por nível hierárquico
  if (!canAccessLevel(3)) { // Operador = nível 3
    return <div>Acesso negado - Nível insuficiente</div>;
  }

  return (
    <div>
      <h2>Painel de Operações</h2>
      <p>Bem-vindo, {user.name}!</p>
      <p>Seu nível: {user.role} (Hierarquia: {user.nivel})</p>
      
      {/* Mostrar funcionalidades baseadas no nível */}
      {canAccessLevel(2) && (
        <button>Função de Supervisor</button>
      )}
      
      {canAccessLevel(1) && (
        <button>Função de Master</button>
      )}
      
      {hasPermission('manage:users') && (
        <button>Gerenciar Usuários</button>
      )}
    </div>
  );
}

// 📋 5. CONFIGURAÇÃO DO SQL SERVER (config.js)
const config = {
  server: 'seu-servidor-sql',
  database: 'europa4',
  user: 'seu-usuario',
  password: 'sua-senha',
  options: {
    encrypt: true, // Para Azure
    trustServerCertificate: true // Para desenvolvimento local
  }
};

export default config;