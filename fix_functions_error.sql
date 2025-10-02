-- ============================================================
-- CORREÇÃO DO ERRO: Cannot find function dbo.CriptografarSenha
-- Execute este script no SSMS antes de usar o n8n
-- ============================================================

USE europa4;
GO

-- ============================================================
-- 1. VERIFICAR SE AS FUNÇÕES EXISTEM
-- ============================================================
PRINT '🔍 Verificando funções existentes...';

SELECT 
    name as FuncaoNome,
    type_desc as Tipo,
    create_date as DataCriacao
FROM sys.objects 
WHERE type IN ('FN', 'IF', 'TF')
ORDER BY name;

-- ============================================================
-- 2. DROPAR FUNÇÕES EXISTENTES (SE HOUVER PROBLEMAS)
-- ============================================================
IF OBJECT_ID('dbo.CriptografarSenha', 'FN') IS NOT NULL
BEGIN
    PRINT '🗑️ Removendo função CriptografarSenha existente...';
    DROP FUNCTION dbo.CriptografarSenha;
END

IF OBJECT_ID('sp_GerarSalt', 'P') IS NOT NULL
BEGIN
    PRINT '🗑️ Removendo procedure sp_GerarSalt existente...';
    DROP PROCEDURE sp_GerarSalt;
END

-- ============================================================
-- 3. RECRIAR FUNÇÃO DE CRIPTOGRAFIA
-- ============================================================
PRINT '🔐 Criando função CriptografarSenha...';
GO

CREATE FUNCTION dbo.CriptografarSenha(@senha NVARCHAR(255), @salt NVARCHAR(255))
RETURNS NVARCHAR(255)
AS
BEGIN
    RETURN CONVERT(NVARCHAR(255), HASHBYTES('SHA2_512', @senha + @salt), 2);
END
GO

-- ============================================================
-- 4. RECRIAR PROCEDURE PARA GERAR SALT
-- ============================================================
PRINT '🧂 Criando procedure sp_GerarSalt...';
GO

CREATE PROCEDURE sp_GerarSalt
    @Salt NVARCHAR(255) OUTPUT
AS
BEGIN
    SET @Salt = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_256', CAST(NEWID() AS NVARCHAR(36))), 2);
END
GO

-- ============================================================
-- 5. TESTAR AS FUNÇÕES CRIADAS
-- ============================================================
PRINT '🧪 Testando funções...';

-- Testar geração de salt
DECLARE @TestSalt NVARCHAR(255);
EXEC sp_GerarSalt @TestSalt OUTPUT;
PRINT '✅ Salt gerado: ' + LEFT(@TestSalt, 20) + '...';

-- Testar criptografia
DECLARE @TestHash NVARCHAR(255);
SET @TestHash = dbo.CriptografarSenha('8996', @TestSalt);
PRINT '✅ Hash gerado: ' + LEFT(@TestHash, 20) + '...';

-- ============================================================
-- 6. RECRIAR USUÁRIO MASTER COM FUNÇÕES FUNCIONANDO
-- ============================================================
PRINT '👤 Recriando usuário Master...';

-- Limpar usuário existente
DELETE FROM Usuarios WHERE Login = 'andre.felipe';

-- Criar novamente
DECLARE @Salt NVARCHAR(255);
DECLARE @SenhaHash NVARCHAR(255);
DECLARE @MasterNivelId INT;

-- Gerar salt único
EXEC sp_GerarSalt @Salt OUTPUT;

-- Criptografar senha "8996"
SET @SenhaHash = dbo.CriptografarSenha('8996', @Salt);

-- Obter ID do nível Master
SELECT @MasterNivelId = Id FROM Niveis WHERE Nome = 'Master';

-- Inserir usuário Master
INSERT INTO Usuarios (Nome, Login, Email, SenhaHash, Salt, NivelId)
VALUES ('Andre Felipe', 'andre.felipe', 'andre.felipe@empresa.com', @SenhaHash, @Salt, @MasterNivelId);

PRINT '✅ Usuário Master recriado com sucesso!';

-- ============================================================
-- 7. TESTE FINAL - VALIDAR LOGIN
-- ============================================================
PRINT '🔍 Teste final de validação...';

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM Usuarios u 
            WHERE u.Login = 'andre.felipe' 
            AND u.SenhaHash = dbo.CriptografarSenha('8996', u.Salt)
            AND u.Ativo = 1
        ) 
        THEN '✅ VALIDAÇÃO OK - Função funcionando!' 
        ELSE '❌ ERRO - Função não está funcionando' 
    END as TesteValidacao;

-- ============================================================
-- 8. QUERY ALTERNATIVA PARA N8N (SEM FUNÇÃO CUSTOMIZADA)
-- ============================================================
PRINT '📋 Query alternativa para n8n (caso ainda não funcione):';
PRINT '';
PRINT '-- OPÇÃO 1: Query com função (use se as funções estão funcionando)';
PRINT 'SELECT u.Id, u.Nome, u.Login, u.Email, n.Nome as Role, n.Nivel as NivelHierarquia';
PRINT 'FROM europa4.dbo.usuarios u';
PRINT 'INNER JOIN europa4.dbo.niveis n ON u.NivelId = n.Id';
PRINT 'WHERE u.Login = ''{{ $json.body.login }}''';
PRINT '    AND u.SenhaHash = dbo.CriptografarSenha(''{{ $json.body.senha }}'', u.Salt)';
PRINT '    AND u.Ativo = 1;';
PRINT '';
PRINT '-- OPÇÃO 2: Query direta com HASHBYTES (se função não funcionar)';
PRINT 'SELECT u.Id, u.Nome, u.Login, u.Email, n.Nome as Role, n.Nivel as NivelHierarquia';
PRINT 'FROM europa4.dbo.usuarios u';
PRINT 'INNER JOIN europa4.dbo.niveis n ON u.NivelId = n.Id';
PRINT 'WHERE u.Login = ''{{ $json.body.login }}''';
PRINT '    AND u.SenhaHash = CONVERT(NVARCHAR(255), HASHBYTES(''SHA2_512'', ''{{ $json.body.senha }}'' + u.Salt), 2)';
PRINT '    AND u.Ativo = 1;';

-- ============================================================
-- 9. VERIFICAÇÃO FINAL
-- ============================================================
SELECT 
    'Funções criadas' as Status,
    COUNT(*) as Quantidade
FROM sys.objects 
WHERE name IN ('CriptografarSenha', 'sp_GerarSalt')
UNION ALL
SELECT 
    'Usuários ativos' as Status,
    COUNT(*) as Quantidade
FROM Usuarios
WHERE Ativo = 1;

PRINT '🎯 Correção concluída!';
PRINT 'Execute novamente o teste no n8n.';
PRINT 'Login: andre.felipe';
PRINT 'Senha: 8996';