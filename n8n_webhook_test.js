// ============================================================
// TESTE DA NOVA API N8N WEBHOOK
// URL: https://n8n.sistemavieira.com.br/webhook-test/login
// ============================================================

// 📋 1. FUNÇÃO DE TESTE PARA A NOVA API
async function testarWebhookN8N() {
  console.log('🔗 Testando nova URL do webhook n8n...');
  
  const testCredentials = [
    { email: 'master@neo.com', senha: '123456' },
    { email: 'supervisor@neo.com', senha: '123456' },
    { email: 'operador@neo.com', senha: '123456' },
    { email: 'teste@invalido.com', senha: 'senhaerrada' }
  ];

  for (const cred of testCredentials) {
    try {
      console.log(`\n🧪 Testando: ${cred.email}`);
      
      const response = await fetch('https://n8n.sistemavieira.com.br/webhook-test/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cred.email,
          senha: cred.senha
        })
      });

      const result = await response.json();
      
      console.log(`📊 Status: ${response.status}`);
      console.log(`📋 Resposta:`, result);
      
      if (result.success) {
        console.log('✅ Login bem-sucedido');
        
        // Se login for bem-sucedido, buscar hierarquia
        await buscarHierarquiaUsuario(cred.email, result.token);
      } else {
        console.log('❌ Falha no login');
      }

    } catch (error) {
      console.error(`❌ Erro ao testar ${cred.email}:`, error.message);
    }
  }
}

// 📋 2. FUNÇÃO PARA BUSCAR HIERARQUIA APÓS LOGIN
async function buscarHierarquiaUsuario(email, webhookToken) {
  try {
    console.log(`🏢 Buscando hierarquia para: ${email}`);
    
    const response = await fetch('/api/user-hierarchy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        webhookToken: webhookToken
      })
    });

    if (response.ok) {
      const hierarchyData = await response.json();
      console.log('📊 Dados de hierarquia:', {
        nome: hierarchyData.Nome,
        role: hierarchyData.Role,
        nivel: hierarchyData.NivelHierarquia,
        permissoes: hierarchyData.Permissoes
      });
    } else {
      console.log('❌ Erro ao buscar hierarquia:', response.statusText);
    }

  } catch (error) {
    console.error('❌ Erro na busca de hierarquia:', error.message);
  }
}

// 📋 3. TESTE DIRETO COM CURL (PARA TERMINAL)
function gerarComandosCurl() {
  console.log('\n🔧 Comandos curl para testar manualmente:');
  
  const testCases = [
    { email: 'master@neo.com', senha: '123456', desc: 'Master' },
    { email: 'supervisor@neo.com', senha: '123456', desc: 'Supervisor' },
    { email: 'operador@neo.com', senha: '123456', desc: 'Operador' }
  ];

  testCases.forEach(test => {
    console.log(`\n# Teste ${test.desc}:`);
    console.log(`curl -X POST "https://n8n.sistemavieira.com.br/webhook-test/login" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{`);
    console.log(`    "email": "${test.email}",`);
    console.log(`    "senha": "${test.senha}"`);
    console.log(`  }'`);
  });
}

// 📋 4. FUNÇÃO ATUALIZADA PARA LOGIN COM HIERARQUIA
export async function loginComHierarquiaN8N(email, senha) {
  try {
    console.log('🔐 Iniciando login com webhook n8n...');
    
    // PASSO 1: Autenticar no webhook n8n
    const webhookResponse = await fetch('https://n8n.sistemavieira.com.br/webhook-test/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        senha: senha
      })
    });

    const webhookResult = await webhookResponse.json();
    console.log('📡 Resposta do webhook n8n:', webhookResult);

    if (!webhookResult.success) {
      throw new Error(webhookResult.message || 'Falha na autenticação no n8n');
    }

    // PASSO 2: Buscar hierarquia no SQL Server
    console.log('🏢 Buscando hierarquia do usuário...');
    
    const hierarchyResponse = await fetch('/api/user-hierarchy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        webhookToken: webhookResult.token
      })
    });

    if (!hierarchyResponse.ok) {
      throw new Error('Erro ao buscar dados de hierarquia');
    }

    const hierarchyData = await hierarchyResponse.json();
    console.log('📊 Dados de hierarquia:', hierarchyData);

    // PASSO 3: Combinar dados
    const userData = {
      // Dados básicos
      id: hierarchyData.Id,
      name: hierarchyData.Nome,
      email: hierarchyData.Email,
      
      // Hierarquia
      role: hierarchyData.Role,
      level: hierarchyData.NivelHierarquia,
      levelDescription: hierarchyData.DescricaoNivel,
      
      // Permissões
      permissions: hierarchyData.Permissoes ? 
        hierarchyData.Permissoes.split(',').filter(p => p.trim()) : [],
      permissionsDetails: hierarchyData.PermissoesDetalhadas ? 
        JSON.parse(hierarchyData.PermissoesDetalhadas) : [],
      
      // Metadata
      webhookToken: webhookResult.token,
      lastLogin: hierarchyData.DataUltimoLogin,
      loginTime: new Date().toISOString(),
      webhookProvider: 'n8n'
    };

    console.log('✅ Login com hierarquia realizado com sucesso:', userData);
    return { success: true, user: userData };

  } catch (error) {
    console.error('❌ Erro no login com hierarquia:', error);
    return { 
      success: false, 
      message: error.message || 'Erro interno do servidor' 
    };
  }
}

// 📋 5. MONITORAMENTO DE AUDITORIA (CONFORME ESPECIFICAÇÃO)
export async function registrarAuditoriaLogin(email, sucesso, ip, userAgent, detalhes) {
  try {
    const response = await fetch('/api/audit-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        tipoEvento: sucesso ? 'LOGIN_SUCCESS' : 'LOGIN_FAIL',
        enderecoIP: ip,
        userAgent: userAgent,
        detalhes: detalhes,
        webhookProvider: 'n8n'
      })
    });

    if (response.ok) {
      console.log('📝 Auditoria registrada com sucesso');
    }
  } catch (error) {
    console.error('❌ Erro ao registrar auditoria:', error);
  }
}

// 📋 6. COMPONENTE REACT ATUALIZADO
export const LoginFormN8N = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Capturar dados para auditoria
      const ip = await fetch('https://api.ipify.org?format=json')
        .then(r => r.json())
        .then(data => data.ip)
        .catch(() => 'unknown');
      
      const userAgent = navigator.userAgent;

      // Tentar login
      const result = await loginComHierarquiaN8N(email, senha);
      
      if (result.success) {
        // Registrar auditoria de sucesso
        await registrarAuditoriaLogin(email, true, ip, userAgent, 'Login via n8n webhook');
        
        // Salvar usuário no contexto/localStorage
        console.log('✅ Login bem-sucedido!', result.user);
      } else {
        // Registrar auditoria de falha
        await registrarAuditoriaLogin(email, false, ip, userAgent, result.message);
        setError(result.message);
      }

    } catch (error) {
      console.error('❌ Erro no login:', error);
      setError('Erro interno do servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form">
      <h2>🔐 Login Nova Europa (n8n)</h2>
      <p className="webhook-info">🔗 Webhook: n8n.sistemavieira.com.br</p>
      
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
        
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          disabled={loading}
          required
        />
        
        {error && <div className="error">❌ {error}</div>}
        
        <button type="submit" disabled={loading}>
          {loading ? '🔄 Entrando...' : '🚀 Entrar'}
        </button>
      </form>
      
      <div className="test-section">
        <h4>🧪 Testes:</h4>
        <button onClick={() => testarWebhookN8N()}>
          Testar Webhook n8n
        </button>
        <button onClick={() => gerarComandosCurl()}>
          Gerar Comandos Curl
        </button>
      </div>
    </div>
  );
};

// Para executar os testes:
// testarWebhookN8N();
// gerarComandosCurl();