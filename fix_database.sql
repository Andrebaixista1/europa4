-- ============================================================
-- SCRIPT DE CORREÇÃO PARA BANCO EUROPA4 JÁ EXISTENTE
-- Execute este script se já rodou o anterior e teve erros
-- ============================================================

USE europa4;
GO

-- ============================================================
-- 1. DROPAR FUNÇÃO PROBLEMÁTICA SE EXISTIR
-- ============================================================
IF OBJECT_ID('dbo.GerarSalt', 'FN') IS NOT NULL
    DROP FUNCTION dbo.GerarSalt;
GO

-- ============================================================
-- 2. PROCEDIMENTO PARA GERAR SALT (SUBSTITUI A FUNÇÃO)
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GerarSalt
    @Salt NVARCHAR(255) OUTPUT
AS
BEGIN
    SET @Salt = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_256', CAST(NEWID() AS NVARCHAR(36))), 2);
END
GO

-- ============================================================
-- 3. CORRIGIR PROCEDIMENTO sp_CriarUsuario
-- ============================================================
DROP PROCEDURE IF EXISTS sp_CriarUsuario;
GO

CREATE PROCEDURE sp_CriarUsuario
    @Nome NVARCHAR(100),
    @Email NVARCHAR(255),
    @Senha NVARCHAR(255),
    @NivelId INT = NULL, -- ID do nível
    @NivelNome NVARCHAR(50) = NULL, -- Ou nome do nível
    @CriadoPor INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Salt NVARCHAR(255);
    DECLARE @SenhaHash NVARCHAR(255);
    DECLARE @NivelIdFinal INT;
    
    -- Determinar o ID do nível
    IF @NivelId IS NOT NULL
    BEGIN
        SET @NivelIdFinal = @NivelId;
    END
    ELSE IF @NivelNome IS NOT NULL
    BEGIN
        SELECT @NivelIdFinal = Id FROM Niveis WHERE Nome = @NivelNome AND Ativo = 1;
    END
    ELSE
    BEGIN
        RAISERROR('Deve informar @NivelId ou @NivelNome', 16, 1);
        RETURN;
    END
    
    -- Validar se o nível existe
    IF @NivelIdFinal IS NULL OR NOT EXISTS (SELECT 1 FROM Niveis WHERE Id = @NivelIdFinal AND Ativo = 1)
    BEGIN
        RAISERROR('Nível não encontrado', 16, 1);
        RETURN;
    END
    
    -- Gerar salt único
    EXEC sp_GerarSalt @Salt OUTPUT;
    
    -- Criptografar senha
    SET @SenhaHash = dbo.CriptografarSenha(@Senha, @Salt);
    
    -- Inserir usuário
    INSERT INTO Usuarios (Nome, Email, SenhaHash, Salt, NivelId, CriadoPor)
    VALUES (@Nome, @Email, @SenhaHash, @Salt, @NivelIdFinal, @CriadoPor);
    
    SELECT SCOPE_IDENTITY() as NovoUsuarioId;
END
GO

-- ============================================================
-- 4. CRIAR USUÁRIOS INICIAIS (SE NÃO EXISTIREM)
-- ============================================================
-- Verificar se usuários já existem antes de criar
IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE Email = 'master@neo.com')
BEGIN
    EXEC sp_CriarUsuario 
        @Nome = 'Maria Silva',
        @Email = 'master@neo.com',
        @Senha = '123456',
        @NivelNome = 'Master';
END

IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE Email = 'supervisor@neo.com')
BEGIN
    EXEC sp_CriarUsuario 
        @Nome = 'Carla Souza',
        @Email = 'supervisor@neo.com',
        @Senha = '123456',
        @NivelNome = 'Supervisor';
END

IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE Email = 'operador@neo.com')
BEGIN
    EXEC sp_CriarUsuario 
        @Nome = 'Diego Lima',
        @Email = 'operador@neo.com',
        @Senha = '123456',
        @NivelNome = 'Operador';
END
GO

-- ============================================================
-- 5. TESTAR O SISTEMA
-- ============================================================
PRINT '=== TESTANDO SISTEMA CORRIGIDO ===';

-- Testar criação de usuário
PRINT 'Testando criação de usuário...';
EXEC sp_CriarUsuario 
    @Nome = 'Teste User',
    @Email = 'teste@neo.com',
    @Senha = 'senha123',
    @NivelNome = 'Operador';

-- Testar login
PRINT 'Testando login...';
EXEC sp_ValidarLogin 
    @Email = 'master@neo.com', 
    @Senha = '123456';

-- Mostrar usuários criados
PRINT 'Usuários no sistema:';
SELECT * FROM vw_UsuariosCompleto;

-- ============================================================
-- 6. CRIAR ÍNDICES SE NÃO EXISTIREM
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuarios_Email' AND object_id = OBJECT_ID('Usuarios'))
    CREATE NONCLUSTERED INDEX IX_Usuarios_Email ON Usuarios(Email);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuarios_NivelId' AND object_id = OBJECT_ID('Usuarios'))
    CREATE NONCLUSTERED INDEX IX_Usuarios_NivelId ON Usuarios(NivelId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditoriaLogin_UsuarioId' AND object_id = OBJECT_ID('AuditoriaLogin'))
    CREATE NONCLUSTERED INDEX IX_AuditoriaLogin_UsuarioId ON AuditoriaLogin(UsuarioId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditoriaLogin_DataEvento' AND object_id = OBJECT_ID('AuditoriaLogin'))
    CREATE NONCLUSTERED INDEX IX_AuditoriaLogin_DataEvento ON AuditoriaLogin(DataEvento);
GO

PRINT '=== SISTEMA CORRIGIDO E FUNCIONANDO! ===';

-- ============================================================
-- 7. SCRIPT PARA REMOVER ÍNDICES DUPLICADOS (SE NECESSÁRIO)
-- ============================================================
/*
-- Use apenas se precisar remover índices duplicados:
DROP INDEX IF EXISTS IX_Usuarios_Email ON Usuarios;
DROP INDEX IF EXISTS IX_Usuarios_NivelId ON Usuarios;
DROP INDEX IF EXISTS IX_AuditoriaLogin_UsuarioId ON AuditoriaLogin;
DROP INDEX IF EXISTS IX_AuditoriaLogin_DataEvento ON AuditoriaLogin;
*/