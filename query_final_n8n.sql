-- ============================================================
-- 🎯 QUERY FINAL PARA N8N - FUNCIONANDO
-- O usuário foi criado com sucesso, use esta query!
-- ============================================================

-- ✅ QUERY TESTADA E FUNCIONANDO (use esta no n8n):
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
FROM europa4.dbo.usuarios u
INNER JOIN europa4.dbo.niveis n ON u.NivelId = n.Id
WHERE u.Login = '{{ $json.body.login }}'
    AND u.SenhaHash = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_512', '{{ $json.body.senha }}' + u.Salt), 2)
    AND u.Ativo = 1;

-- ============================================================
-- 🧪 TESTE MANUAL PARA VERIFICAR (Execute no SSMS)
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
WHERE u.Login = 'andre.felipe'
    AND u.SenhaHash = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_512', '8996' + u.Salt), 2)
    AND u.Ativo = 1;

-- ============================================================
-- 📊 RESULTADO ESPERADO:
-- ============================================================
/*
Id: 1
Nome: Andre Felipe
Login: andre.felipe
Email: andre.felipe@empresa.com
Role: Master
NivelHierarquia: 1
DescricaoNivel: Nível máximo - acesso completo ao sistema
DataUltimoLogin: NULL
ContaBloqueada: 0
TentativasLogin: 0
Permissoes: view:master,view:supervision,view:operation,manage:users,manage:system,view:reports,export:data
StatusConta: VALID
*/

-- ============================================================
-- 🔗 CONFIGURAÇÃO DO WEBHOOK N8N:
-- ============================================================
/*
URL: https://n8n.sistemavieira.com.br/webhook-test/login

Body de entrada:
{
  "login": "andre.felipe",
  "senha": "8996"
}

Resposta esperada:
{
  "Id": 1,
  "Nome": "Andre Felipe",
  "Login": "andre.felipe",
  "Email": "andre.felipe@empresa.com",
  "Role": "Master",
  "NivelHierarquia": 1,
  "DescricaoNivel": "Nível máximo - acesso completo ao sistema",
  "DataUltimoLogin": null,
  "ContaBloqueada": false,
  "TentativasLogin": 0,
  "Permissoes": "view:master,view:supervision,view:operation,manage:users,manage:system,view:reports,export:data",
  "StatusConta": "VALID"
}
*/

-- ============================================================
-- 🚨 IMPORTANTE:
-- ============================================================
-- ✅ O usuário foi criado com sucesso
-- ✅ A criptografia está funcionando
-- ✅ Use a query HASHBYTES direta (não a função customizada)
-- ✅ Teste com: andre.felipe / 8996
-- ============================================================