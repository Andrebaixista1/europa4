# 🗃️ Sistema de Banco de Dados Nova Europa

## 📋 Visão Geral

Este sistema foi criado especificamente para o projeto Nova Europa, implementando um sistema robusto de usuários com:

- ✅ **Senhas criptografadas** com SHA-512 + Salt único
- ✅ **Hierarquia de níveis** (Master → Supervisor → Operador)
- ✅ **Sistema de permissões** granular
- ✅ **Auditoria completa** de logins
- ✅ **Proteção contra ataques** (bloqueio por tentativas)
- ✅ **Estrutura segura** seguindo boas práticas

## 🏗️ Estrutura do Banco

### Tabelas Principais

1. **`Niveis`** - Define a hierarquia dos usuários
2. **`Permissoes`** - Lista todas as permissões do sistema
3. **`NivelPermissoes`** - Relaciona níveis com suas permissões
4. **`Usuarios`** - Tabela principal de usuários com senhas criptografadas
5. **`AuditoriaLogin`** - Log completo de todas as tentativas de login

### Hierarquia Implementada

```
Master (Nível 1)
├── Acesso completo ao sistema
├── Gerenciamento de usuários
├── Todas as permissões
└── view:master, view:supervision, view:operation, manage:users, manage:system

Supervisor (Nível 2)
├── Supervisão e relatórios
├── view:supervision, view:operation, view:reports
└── Sem acesso ao gerenciamento de usuários

Operador (Nível 3)
├── Operações básicas
└── view:operation
```

## 🚀 Como Usar no SSMS

### 1. Executar o Script

1. Abra o **SQL Server Management Studio (SSMS)**
2. Conecte-se ao seu servidor SQL Server
3. Abra o arquivo `database_setup.sql`
4. Execute o script completo (Ctrl+Shift+E ou F5)
5. O banco `NovaEuropa` será criado automaticamente

### 2. Verificar a Instalação

```sql
-- Verificar se as tabelas foram criadas
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'dbo' 
ORDER BY TABLE_NAME;

-- Verificar usuários criados
SELECT * FROM vw_UsuariosCompleto;

-- Verificar permissões
SELECT * FROM vw_PermissoesPorUsuario;
```

## 🔐 Funcionalidades de Segurança

### Criptografia de Senhas

- **Algoritmo**: SHA-512 com Salt único
- **Salt**: Gerado automaticamente para cada usuário
- **Armazenamento**: Apenas hash + salt (senha original nunca armazenada)

### Proteção contra Ataques

- **Bloqueio automático** após 5 tentativas falhidas
- **Desbloqueio automático** após 30 minutos
- **Auditoria completa** de todas as tentativas
- **Validação de IP** e User-Agent

### Controle de Acesso

- **Hierarquia respeitada** automaticamente
- **Permissões granulares** por módulo/recurso
- **Herança de permissões** por nível

## 📝 Principais Procedimentos

### Validar Login
```sql
EXEC sp_ValidarLogin 
    @Email = 'master@neo.com', 
    @Senha = '123456',
    @EnderecoIP = '192.168.1.100',
    @UserAgent = 'Mozilla/5.0...';
```

### Criar Usuário
```sql
EXEC sp_CriarUsuario 
    @Nome = 'João Silva',
    @Email = 'joao@neo.com',
    @Senha = 'senhaSegura123',
    @NivelNome = 'Operador',
    @CriadoPor = 1; -- ID do usuário que está criando
```

### Alterar Nível de Usuário
```sql
UPDATE Usuarios 
SET NivelId = (SELECT Id FROM Niveis WHERE Nome = 'Supervisor')
WHERE Email = 'joao@neo.com';
```

### Desbloquear Conta
```sql
UPDATE Usuarios 
SET ContaBloqueada = 0, TentativasLogin = 0, DataDesbloqueio = NULL
WHERE Email = 'usuario@neo.com';
```

## 📊 Consultas Úteis

### Usuários por Nível
```sql
SELECT 
    n.Nome as Nivel,
    COUNT(*) as TotalUsuarios
FROM Usuarios u
INNER JOIN Niveis n ON u.NivelId = n.Id
WHERE u.Ativo = 1
GROUP BY n.Nome, n.Nivel
ORDER BY n.Nivel;
```

### Histórico de Logins
```sql
SELECT TOP 50
    a.DataEvento,
    a.Email,
    a.TipoEvento,
    a.EnderecoIP,
    a.Detalhes
FROM AuditoriaLogin a
ORDER BY a.DataEvento DESC;
```

### Contas Bloqueadas
```sql
SELECT 
    u.Nome,
    u.Email,
    u.TentativasLogin,
    u.DataDesbloqueio
FROM Usuarios u
WHERE u.ContaBloqueada = 1
ORDER BY u.DataDesbloqueio;
```

## 🔄 Integração com seu Frontend

### Integrar com seu Frontend

O sistema retorna exatamente os campos que seu frontend espera e pode ser integrado com o webhook n8n:

```javascript
// Endpoint atualizado para n8n
const webhookResponse = await fetch('https://webhook.sistemavieira.com.br/webhook/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, senha })
});
```

```javascript
// Resposta da validação de login
{
    Sucesso: 1,
    Mensagem: "Login realizado com sucesso",
    Id: 1,
    Nome: "Maria Silva",
    Email: "master@neo.com",
    Role: "Master"
}
```

### Implementar no Backend

Se você está usando Node.js, pode conectar assim:

```javascript
const sql = require('mssql');

const config = {
    server: 'seu-servidor',
    database: 'NovaEuropa',
    user: 'seu-usuario',
    password: 'sua-senha',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function validarLogin(email, senha, ip, userAgent) {
    const pool = await sql.connect(config);
    const result = await pool.request()
        .input('Email', sql.NVarChar, email)
        .input('Senha', sql.NVarChar, senha)
        .input('EnderecoIP', sql.NVarChar, ip)
        .input('UserAgent', sql.NVarChar, userAgent)
        .execute('sp_ValidarLogin');
    
    return result.recordset[0];
}
```

## 🛡️ Boas Práticas Implementadas

1. **Nunca armazene senhas em texto plano**
2. **Use salt único para cada usuário**
3. **Implemente bloqueio por tentativas**
4. **Mantenha auditoria completa**
5. **Use procedimentos armazenados para operações críticas**
6. **Implemente índices para performance**
7. **Separe permissões por módulos**
8. **Mantenha rastreabilidade de alterações**

## 📈 Próximos Passos

1. **Execute o script** no SSMS
2. **Teste os logins** com os usuários padrão
3. **Integre com seu frontend** React
4. **Configure backup automático** do banco
5. **Implemente rotação de senhas** (opcional)
6. **Configure alertas** para tentativas suspeitas

## 🔧 Manutenção

### Limpeza de Auditoria (mensal)
```sql
-- Manter apenas últimos 90 dias de auditoria
DELETE FROM AuditoriaLogin 
WHERE DataEvento < DATEADD(DAY, -90, GETDATE());
```

### Relatório de Segurança
```sql
-- Usuários que não logam há mais de 30 dias
SELECT Nome, Email, DataUltimoLogin
FROM Usuarios 
WHERE DataUltimoLogin < DATEADD(DAY, -30, GETDATE())
OR DataUltimoLogin IS NULL;
```

---

**✅ Sistema pronto para produção com máxima segurança!**