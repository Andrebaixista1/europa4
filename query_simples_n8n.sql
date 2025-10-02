-- ============================================================
-- 🚨 CORREÇÃO DO ERRO: Invalid object name 'NivelPermissoes'
-- QUERY SIMPLIFICADA SEM DEPENDÊNCIAS COMPLEXAS
-- ============================================================

-- ✅ QUERY SIMPLIFICADA PARA N8N (SEM TABELAS DE PERMISSÕES)
-- Use esta query no n8n - ela não depende das tabelas que podem não existir
SELECT 
    u.Id,
    u.Nome,
    u.Login,
    u.Email,
    n.Nome as Role,
    n.Nivel as NivelHierarquia,
    n.Descricao as DescricaoNivel,
    u.DataUltimoLogin,
    u.ContaBloqueada,
    u.TentativasLogin,
    -- Permissões básicas baseadas no role
    CASE n.Nome
        WHEN 'Master' THEN 'view:master,view:supervision,view:operation,manage:users,manage:system,view:reports,export:data'
        WHEN 'Supervisor' THEN 'view:supervision,view:operation,view:reports'
        WHEN 'Operador' THEN 'view:operation'
        ELSE 'none'
    END as Permissoes,
    CASE 
        WHEN u.ContaBloqueada = 1 THEN 'BLOCKED'
        WHEN u.Ativo = 0 THEN 'INACTIVE'
        ELSE 'VALID'
    END as StatusConta
FROM europa4.dbo.usuarios u
INNER JOIN europa4.dbo.niveis n ON u.NivelId = n.Id
WHERE u.Login = '{{ $json.body.login }}'
    AND u.SenhaHash = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_512', '{{ $json.body.senha }}' + u.Salt), 2)
    AND u.Ativo = 1;

-- ============================================================
-- 🧪 TESTE MANUAL NO SSMS (VERIFICAR SE FUNCIONA)
-- ============================================================
SELECT 
    u.Id,
    u.Nome,
    u.Login,
    u.Email,
    n.Nome as Role,
    n.Nivel as NivelHierarquia,
    n.Descricao as DescricaoNivel,
    u.DataUltimoLogin,
    u.ContaBloqueada,
    u.TentativasLogin,
    CASE n.Nome
        WHEN 'Master' THEN 'view:master,view:supervision,view:operation,manage:users,manage:system,view:reports,export:data'
        WHEN 'Supervisor' THEN 'view:supervision,view:operation,view:reports'
        WHEN 'Operador' THEN 'view:operation'
        ELSE 'none'
    END as Permissoes,
    CASE 
        WHEN u.ContaBloqueada = 1 THEN 'BLOCKED'
        WHEN u.Ativo = 0 THEN 'INACTIVE'
        ELSE 'VALID'
    END as StatusConta
FROM Usuarios u
INNER JOIN Niveis n ON u.NivelId = n.Id
WHERE u.Login = 'andre.felipe'
    AND u.SenhaHash = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_512', '8996' + u.Salt), 2)
    AND u.Ativo = 1;

-- ============================================================
-- 📋 ALTERNATIVA AINDA MAIS SIMPLES (SE AINDA DER ERRO)
-- ============================================================

-- Query mínima apenas com dados essenciais
SELECT 
    u.Id,
    u.Nome,
    u.Login,
    u.Email,
    n.Nome as Role,
    n.Nivel as NivelHierarquia,
    'VALID' as StatusConta
FROM europa4.dbo.usuarios u
INNER JOIN europa4.dbo.niveis n ON u.NivelId = n.Id
WHERE u.Login = '{{ $json.body.login }}'
    AND u.SenhaHash = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_512', '{{ $json.body.senha }}' + u.Salt), 2)
    AND u.Ativo = 1;

-- ============================================================
-- 🔍 DIAGNÓSTICO - VERIFICAR TABELAS EXISTENTES
-- Execute no SSMS para ver quais tabelas existem
-- ============================================================
SELECT 
    TABLE_NAME as TabelaNome,
    TABLE_TYPE as TipoTabela
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_CATALOG = 'europa4'
ORDER BY TABLE_NAME;

-- ============================================================
-- 📊 VERIFICAR DADOS DO USUÁRIO
-- ============================================================
SELECT 
    u.Id,
    u.Nome,
    u.Login,
    n.Nome as Role,
    'Usuário existe' as Status
FROM Usuarios u
INNER JOIN Niveis n ON u.NivelId = n.Id
WHERE u.Login = 'andre.felipe';

-- ============================================================
-- 🎯 RESUMO DA SOLUÇÃO:
-- ============================================================
/*
1. Use a primeira query (simplificada) no n8n
2. Ela remove a dependência das tabelas NivelPermissoes e Permissoes
3. As permissões são definidas diretamente no CASE baseado no Role
4. Mantém toda funcionalidade necessária para o frontend

Teste com:
- Login: andre.felipe  
- Senha: 8996

Deve retornar:
{
  "Id": 1,
  "Nome": "Andre Felipe", 
  "Login": "andre.felipe",
  "Role": "Master",
  "NivelHierarquia": 1,
  "Permissoes": "view:master,view:supervision,view:operation,manage:users,manage:system,view:reports,export:data",
  "StatusConta": "VALID"
}
*/