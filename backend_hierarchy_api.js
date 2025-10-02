// ============================================================
// API BACKEND PARA INTEGRAÇÃO SQL SERVER + WEBHOOK
// Endpoint para buscar hierarquia após autenticação no webhook
// ============================================================

const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// 📋 CONFIGURAÇÃO DO SQL SERVER
const sqlConfig = {
  server: 'localhost', // ou seu servidor SQL Server
  database: 'europa4',
  user: 'sa', // ou seu usuário
  password: 'SuaSenhaAqui',
  options: {
    encrypt: false, // true para Azure
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Conectar ao SQL Server na inicialização
let poolPromise = sql.connect(sqlConfig)
  .then(pool => {
    console.log('✅ Conectado ao SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('❌ Erro ao conectar SQL Server:', err);
  });

// 📋 ENDPOINT PARA BUSCAR HIERARQUIA DO USUÁRIO
app.post('/api/user-hierarchy', async (req, res) => {
  const { email, webhookToken } = req.body;

  console.log(`🔍 Buscando hierarquia para: ${email}`);

  // Validação básica
  if (!email) {
    return res.status(400).json({ 
      error: 'Email é obrigatório' 
    });
  }

  try {
    // Obter conexão do pool
    const pool = await poolPromise;
    
    // Executar procedure para buscar hierarquia
    const result = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .execute('sp_BuscarHierarquiaUsuario');

    if (result.recordset.length === 0) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      return res.status(404).json({ 
        error: 'Usuário não encontrado na hierarquia' 
      });
    }

    const userData = result.recordset[0];
    console.log(`✅ Hierarquia encontrada para ${email}:`, {
      nome: userData.Nome,
      role: userData.Role,
      nivel: userData.NivelHierarquia,
      permissoes: userData.Permissoes
    });

    // Retornar dados de hierarquia
    res.json(userData);

  } catch (error) {
    console.error('❌ Erro ao buscar hierarquia:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// 📋 ENDPOINT PARA VALIDAR LOGIN DIRETO (SEM WEBHOOK)
// Use este endpoint se quiser testar sem o webhook
app.post('/api/login-direct', async (req, res) => {
  const { email, senha, ip, userAgent } = req.body;

  console.log(`🔐 Login direto para: ${email}`);

  try {
    const pool = await poolPromise;
    
    const result = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .input('Senha', sql.NVarChar(255), senha)
      .input('EnderecoIP', sql.NVarChar(45), ip || req.ip)
      .input('UserAgent', sql.NVarChar(500), userAgent || req.get('User-Agent'))
      .execute('sp_ValidarLogin');

    const loginResult = result.recordset[0];

    if (loginResult.Sucesso === 1) {
      // Buscar dados completos de hierarquia
      const hierarchyResult = await pool.request()
        .input('Email', sql.NVarChar(255), email)
        .execute('sp_BuscarHierarquiaUsuario');

      const hierarchyData = hierarchyResult.recordset[0];

      res.json({
        success: true,
        message: loginResult.Mensagem,
        user: {
          id: loginResult.Id,
          name: loginResult.Nome,
          email: loginResult.Email,
          role: loginResult.Role,
          level: hierarchyData.NivelHierarquia,
          permissions: hierarchyData.Permissoes?.split(',').filter(p => p.trim()) || [],
          permissionsDetails: hierarchyData.PermissoesDetalhadas ? 
            JSON.parse(hierarchyData.PermissoesDetalhadas) : []
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: loginResult.Mensagem
      });
    }

  } catch (error) {
    console.error('❌ Erro no login direto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// 📋 ENDPOINT PARA CRIAR USUÁRIO
app.post('/api/create-user', async (req, res) => {
  const { nome, email, senha, nivelNome, nivelId, criadoPor } = req.body;

  console.log(`👤 Criando usuário: ${email}`);

  try {
    const pool = await poolPromise;
    
    const result = await pool.request()
      .input('Nome', sql.NVarChar(100), nome)
      .input('Email', sql.NVarChar(255), email)
      .input('Senha', sql.NVarChar(255), senha)
      .input('NivelId', sql.Int, nivelId || null)
      .input('NivelNome', sql.NVarChar(50), nivelNome || null)
      .input('CriadoPor', sql.Int, criadoPor || null)
      .execute('sp_CriarUsuario');

    const novoUsuarioId = result.recordset[0].NovoUsuarioId;

    console.log(`✅ Usuário criado com ID: ${novoUsuarioId}`);

    res.json({
      success: true,
      message: 'Usuário criado com sucesso',
      userId: novoUsuarioId
    });

  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário',
      details: error.message
    });
  }
});

// 📋 ENDPOINT PARA LISTAR USUÁRIOS (APENAS MASTERS)
app.get('/api/users', async (req, res) => {
  console.log('📋 Listando usuários');

  try {
    const pool = await poolPromise;
    
    const result = await pool.request()
      .query('SELECT * FROM vw_UsuariosCompleto ORDER BY NivelHierarquia, Nome');

    res.json({
      success: true,
      users: result.recordset
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários',
      details: error.message
    });
  }
});

// 📋 ENDPOINT PARA VERIFICAR PERMISSÕES
app.post('/api/check-permission', async (req, res) => {
  const { email, permission } = req.body;

  try {
    const pool = await poolPromise;
    
    const result = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .input('Permission', sql.NVarChar(100), permission)
      .query(`
        SELECT COUNT(*) as HasPermission
        FROM vw_PermissoesPorUsuario
        WHERE Email = @Email AND Permissao = @Permission
      `);

    const hasPermission = result.recordset[0].HasPermission > 0;

    res.json({
      email,
      permission,
      hasPermission
    });

  } catch (error) {
    console.error('❌ Erro ao verificar permissão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissão'
    });
  }
});

// 📋 ENDPOINT DE SAÚDE
app.get('/api/health', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().query('SELECT 1 as test');
    
    res.json({
      status: 'OK',
      message: 'API e banco de dados funcionando',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro na conexão com banco de dados',
      error: error.message
    });
  }
});

// 📋 MIDDLEWARE DE TRATAMENTO DE ERROS
app.use((error, req, res, next) => {
  console.error('❌ Erro não tratado:', error);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: error.message
  });
});

// 📋 INICIAR SERVIDOR
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Endpoints disponíveis:`);
  console.log(`   POST /api/user-hierarchy - Buscar hierarquia`);
  console.log(`   POST /api/login-direct - Login direto (teste)`);
  console.log(`   POST /api/create-user - Criar usuário`);
  console.log(`   GET  /api/users - Listar usuários`);
  console.log(`   POST /api/check-permission - Verificar permissão`);
  console.log(`   GET  /api/health - Status da API`);
});

// 📋 EXEMPLO DE PACKAGE.JSON NECESSÁRIO
/*
{
  "name": "novaeuropa-backend",
  "version": "1.0.0",
  "main": "backend_hierarchy_api.js",
  "scripts": {
    "start": "node backend_hierarchy_api.js",
    "dev": "nodemon backend_hierarchy_api.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mssql": "^9.1.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
*/

// 📋 COMANDOS PARA INSTALAR:
/*
npm init -y
npm install express mssql cors
npm install -g nodemon (opcional)
npm run dev (ou npm start)
*/