-- ============================================================
-- SELECT COMPLETO PARA N8N - TODOS OS DADOS NECESSÁRIOS
-- Cole exatamente esta query no n8n
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
    -- Lista de permissões (string separada por vírgulas)
    STUFF((
        SELECT ',' + p.Nome
        FROM NivelPermissoes np
        INNER JOIN Permissoes p ON np.PermissaoId = p.Id
        WHERE np.NivelId = u.NivelId AND p.Ativo = 1
        FOR XML PATH('')
    ), 1, 1, '') as Permissoes,
    -- Status da conta
    CASE 
        WHEN u.ContaBloqueada = 1 THEN 'BLOCKED'
        WHEN u.Ativo = 0 THEN 'INACTIVE'
        ELSE 'VALID'
    END as StatusConta
FROM europa4.dbo.usuarios u
INNER JOIN europa4.dbo.niveis n ON u.NivelId = n.Id
WHERE u.Login = '{{ $json.body.login }}'
    AND u.SenhaHash = dbo.CriptografarSenha('{{ $json.body.senha }}', u.Salt)
    AND u.Ativo = 1;

-- ============================================================
-- TESTE MANUAL COM VALORES FIXOS (PARA VERIFICAR)
-- Execute este SELECT no SSMS para testar
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
    STUFF((
        SELECT ',' + p.Nome
        FROM NivelPermissoes np
        INNER JOIN Permissoes p ON np.PermissaoId = p.Id
        WHERE np.NivelId = u.NivelId AND p.Ativo = 1
        FOR XML PATH('')
    ), 1, 1, '') as Permissoes,
    CASE 
        WHEN u.ContaBloqueada = 1 THEN 'BLOCKED'
        WHEN u.Ativo = 0 THEN 'INACTIVE'
        ELSE 'VALID'
    END as StatusConta
FROM Usuarios u
INNER JOIN Niveis n ON u.NivelId = n.Id
WHERE u.Login = 'andre.felipe'  -- Valor fixo para teste
    AND u.SenhaHash = dbo.CriptografarSenha('8996', u.Salt)  -- Valor fixo para teste
    AND u.Ativo = 1;

-- ============================================================
-- RESULTADO ESPERADO DEVE SER ALGO ASSIM:
-- ============================================================
/*
Id: 1
Nome: Andre Felipe
Login: andre.felipe
Email: andre.felipe@empresa.com
Role: Master
NivelHierarquia: 1
DescricaoNivel: Nível máximo - acesso completo ao sistema
DataUltimoLogin: NULL (primeira vez)
ContaBloqueada: 0
TentativasLogin: 0
Permissoes: view:master,view:supervision,view:operation,manage:users,manage:system,view:reports,export:data
StatusConta: VALID
*/