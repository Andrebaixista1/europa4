-- ============================================================
-- SCRIPT PARA RESOLVER PROBLEMA DE ÍNDICES DUPLICADOS
-- Execute este script se receber erro de índice já existente
-- ============================================================

USE europa4;
GO

PRINT '🔧 Resolvendo problemas de índices duplicados...';

-- ============================================================
-- 1. REMOVER ÍNDICES EXISTENTES (SE NECESSÁRIO)
-- ============================================================
PRINT '📋 Verificando índices existentes...';

-- Verificar quais índices existem
SELECT 
    i.name as IndiceNome,
    t.name as TabelaNome,
    i.type_desc as TipoIndice
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE i.name IN (
    'IX_Usuarios_Email',
    'IX_Usuarios_NivelId', 
    'IX_AuditoriaLogin_UsuarioId',
    'IX_AuditoriaLogin_DataEvento'
)
ORDER BY t.name, i.name;

-- ============================================================
-- 2. REMOVER ÍNDICES DUPLICADOS (EXECUTE APENAS SE NECESSÁRIO)
-- ============================================================
/*
PRINT '🗑️ Removendo índices duplicados...';

-- Descomente as linhas abaixo apenas se precisar remover índices duplicados:

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuarios_Email' AND object_id = OBJECT_ID('Usuarios'))
BEGIN
    PRINT 'Removendo IX_Usuarios_Email...';
    DROP INDEX IX_Usuarios_Email ON Usuarios;
END

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuarios_NivelId' AND object_id = OBJECT_ID('Usuarios'))
BEGIN
    PRINT 'Removendo IX_Usuarios_NivelId...';
    DROP INDEX IX_Usuarios_NivelId ON Usuarios;
END

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditoriaLogin_UsuarioId' AND object_id = OBJECT_ID('AuditoriaLogin'))
BEGIN
    PRINT 'Removendo IX_AuditoriaLogin_UsuarioId...';
    DROP INDEX IX_AuditoriaLogin_UsuarioId ON AuditoriaLogin;
END

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditoriaLogin_DataEvento' AND object_id = OBJECT_ID('AuditoriaLogin'))
BEGIN
    PRINT 'Removendo IX_AuditoriaLogin_DataEvento...';
    DROP INDEX IX_AuditoriaLogin_DataEvento ON AuditoriaLogin;
END
*/

-- ============================================================
-- 3. CRIAR ÍNDICES COM VERIFICAÇÃO DE EXISTÊNCIA
-- ============================================================
PRINT '✅ Criando índices com verificação...';

-- Índice para email de usuários
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuarios_Email' AND object_id = OBJECT_ID('Usuarios'))
BEGIN
    PRINT 'Criando índice IX_Usuarios_Email...';
    CREATE NONCLUSTERED INDEX IX_Usuarios_Email ON Usuarios(Email);
    PRINT '✅ Índice IX_Usuarios_Email criado';
END
ELSE
BEGIN
    PRINT '⚠️ Índice IX_Usuarios_Email já existe';
END

-- Índice para nível de usuários
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuarios_NivelId' AND object_id = OBJECT_ID('Usuarios'))
BEGIN
    PRINT 'Criando índice IX_Usuarios_NivelId...';
    CREATE NONCLUSTERED INDEX IX_Usuarios_NivelId ON Usuarios(NivelId);
    PRINT '✅ Índice IX_Usuarios_NivelId criado';
END
ELSE
BEGIN
    PRINT '⚠️ Índice IX_Usuarios_NivelId já existe';
END

-- Índice para usuário na auditoria
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditoriaLogin_UsuarioId' AND object_id = OBJECT_ID('AuditoriaLogin'))
BEGIN
    PRINT 'Criando índice IX_AuditoriaLogin_UsuarioId...';
    CREATE NONCLUSTERED INDEX IX_AuditoriaLogin_UsuarioId ON AuditoriaLogin(UsuarioId);
    PRINT '✅ Índice IX_AuditoriaLogin_UsuarioId criado';
END
ELSE
BEGIN
    PRINT '⚠️ Índice IX_AuditoriaLogin_UsuarioId já existe';
END

-- Índice para data na auditoria
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditoriaLogin_DataEvento' AND object_id = OBJECT_ID('AuditoriaLogin'))
BEGIN
    PRINT 'Criando índice IX_AuditoriaLogin_DataEvento...';
    CREATE NONCLUSTERED INDEX IX_AuditoriaLogin_DataEvento ON AuditoriaLogin(DataEvento);
    PRINT '✅ Índice IX_AuditoriaLogin_DataEvento criado';
END
ELSE
BEGIN
    PRINT '⚠️ Índice IX_AuditoriaLogin_DataEvento já existe';
END

-- ============================================================
-- 4. VERIFICAR ÍNDICES FINAIS
-- ============================================================
PRINT '📊 Verificação final dos índices:';

SELECT 
    t.name as Tabela,
    i.name as Indice,
    i.type_desc as Tipo,
    CASE i.is_unique 
        WHEN 1 THEN 'Único' 
        ELSE 'Não único' 
    END as Unicidade,
    STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
    ), 1, 2, '') as Colunas
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE i.name IN (
    'IX_Usuarios_Email',
    'IX_Usuarios_NivelId', 
    'IX_AuditoriaLogin_UsuarioId',
    'IX_AuditoriaLogin_DataEvento'
)
ORDER BY t.name, i.name;

PRINT '🎯 Problema de índices resolvido!';

-- ============================================================
-- 5. TESTAR PERFORMANCE DOS ÍNDICES
-- ============================================================
PRINT '⚡ Testando performance dos índices...';

-- Teste de busca por email
SET STATISTICS IO ON;
SELECT Id, Nome, Email FROM Usuarios WHERE Email = 'master@neo.com';
SET STATISTICS IO OFF;

-- Teste de busca por nível
SELECT COUNT(*) as TotalUsuarios, n.Nome as Nivel
FROM Usuarios u
INNER JOIN Niveis n ON u.NivelId = n.Id
GROUP BY n.Nome
ORDER BY n.Nivel;

-- Teste de auditoria por data
SELECT COUNT(*) as TotalEventos, TipoEvento
FROM AuditoriaLogin
WHERE DataEvento >= DATEADD(DAY, -7, GETDATE())
GROUP BY TipoEvento
ORDER BY COUNT(*) DESC;

PRINT '✅ Testes de performance concluídos!';