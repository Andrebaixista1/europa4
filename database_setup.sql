-- ============================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS NOVA EUROPA
-- Sistema de Usuários com Hierarquia e Segurança
-- ============================================================

USE master;
GO

-- Criar o banco de dados se não existir
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'europa4')
BEGIN
    CREATE DATABASE europa4;
END
GO

USE europa4;
GO

-- ============================================================
-- 1. TABELA DE NÍVEIS HIERÁRQUICOS
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Niveis')
BEGIN
    CREATE TABLE Niveis (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nome NVARCHAR(50) NOT NULL UNIQUE,
        Nivel INT NOT NULL UNIQUE, -- Quanto menor o número, maior a hierarquia
        Descricao NVARCHAR(255),
        DataCriacao DATETIME2 DEFAULT GETDATE(),
        Ativo BIT DEFAULT 1
    );
END
GO

-- ============================================================
-- 2. TABELA DE PERMISSÕES
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Permissoes')
BEGIN
    CREATE TABLE Permissoes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nome NVARCHAR(100) NOT NULL UNIQUE,
        Descricao NVARCHAR(255),
        Modulo NVARCHAR(50), -- ex: 'view', 'manage'
        Recurso NVARCHAR(50), -- ex: 'users', 'operation', 'supervision'
        DataCriacao DATETIME2 DEFAULT GETDATE(),
        Ativo BIT DEFAULT 1
    );
END
GO

-- ============================================================
-- 3. TABELA DE RELACIONAMENTO NIVEL-PERMISSÃO
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NivelPermissoes')
BEGIN
    CREATE TABLE NivelPermissoes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        NivelId INT NOT NULL,
        PermissaoId INT NOT NULL,
        DataCriacao DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (NivelId) REFERENCES Niveis(Id),
        FOREIGN KEY (PermissaoId) REFERENCES Permissoes(Id),
        UNIQUE(NivelId, PermissaoId)
    );
END
GO

-- ============================================================
-- 4. TABELA DE USUÁRIOS COM SENHA CRIPTOGRAFADA
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuarios')
BEGIN
    CREATE TABLE Usuarios (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nome NVARCHAR(100) NOT NULL,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        SenhaHash NVARCHAR(255) NOT NULL, -- Senha criptografada com salt
        Salt NVARCHAR(255) NOT NULL, -- Salt único para cada usuário
        NivelId INT NOT NULL,
        DataCriacao DATETIME2 DEFAULT GETDATE(),
        DataUltimoLogin DATETIME2 NULL,
        DataUltimaAlteracaoSenha DATETIME2 DEFAULT GETDATE(),
        TentativasLogin INT DEFAULT 0,
        ContaBloqueada BIT DEFAULT 0,
        DataDesbloqueio DATETIME2 NULL,
        Ativo BIT DEFAULT 1,
        CriadoPor INT NULL, -- Referência ao usuário que criou
        AlteradoPor INT NULL, -- Referência ao usuário que alterou
        DataAlteracao DATETIME2 NULL,
        FOREIGN KEY (NivelId) REFERENCES Niveis(Id),
        FOREIGN KEY (CriadoPor) REFERENCES Usuarios(Id),
        FOREIGN KEY (AlteradoPor) REFERENCES Usuarios(Id)
    );
END
GO

-- ============================================================
-- 5. TABELA DE AUDITORIA DE LOGIN
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditoriaLogin')
BEGIN
    CREATE TABLE AuditoriaLogin (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UsuarioId INT NULL,
        Email NVARCHAR(255) NOT NULL,
        TipoEvento NVARCHAR(50) NOT NULL, -- 'LOGIN_SUCCESS', 'LOGIN_FAIL', 'LOGOUT', 'BLOCKED'
        EnderecoIP NVARCHAR(45),
        UserAgent NVARCHAR(500),
        DataEvento DATETIME2 DEFAULT GETDATE(),
        Detalhes NVARCHAR(1000),
        FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
    );
END
GO

-- ============================================================
-- 6. INSERIR DADOS INICIAIS - NÍVEIS
-- ============================================================
IF NOT EXISTS (SELECT * FROM Niveis)
BEGIN
    INSERT INTO Niveis (Nome, Nivel, Descricao) VALUES
    ('Master', 1, 'Nível máximo - acesso completo ao sistema'),
    ('Supervisor', 2, 'Nível supervisório - gerenciamento e supervisão'),
    ('Operador', 3, 'Nível operacional - operações básicas do sistema');
END
GO

-- ============================================================
-- 7. INSERIR DADOS INICIAIS - PERMISSÕES
-- ============================================================
IF NOT EXISTS (SELECT * FROM Permissoes)
BEGIN
    INSERT INTO Permissoes (Nome, Descricao, Modulo, Recurso) VALUES
    ('view:master', 'Visualizar área master', 'view', 'master'),
    ('view:supervision', 'Visualizar área de supervisão', 'view', 'supervision'),
    ('view:operation', 'Visualizar área de operação', 'view', 'operation'),
    ('manage:users', 'Gerenciar usuários do sistema', 'manage', 'users'),
    ('manage:system', 'Gerenciar configurações do sistema', 'manage', 'system'),
    ('view:reports', 'Visualizar relatórios', 'view', 'reports'),
    ('export:data', 'Exportar dados do sistema', 'export', 'data');
END
GO

-- ============================================================
-- 8. CONFIGURAR PERMISSÕES POR NÍVEL
-- ============================================================
-- Master (todas as permissões)
INSERT INTO NivelPermissoes (NivelId, PermissaoId)
SELECT n.Id, p.Id
FROM Niveis n
CROSS JOIN Permissoes p
WHERE n.Nome = 'Master'
AND NOT EXISTS (
    SELECT 1 FROM NivelPermissoes np 
    WHERE np.NivelId = n.Id AND np.PermissaoId = p.Id
);

-- Supervisor (permissões limitadas)
INSERT INTO NivelPermissoes (NivelId, PermissaoId)
SELECT n.Id, p.Id
FROM Niveis n
CROSS JOIN Permissoes p
WHERE n.Nome = 'Supervisor'
AND p.Nome IN ('view:supervision', 'view:operation', 'view:reports')
AND NOT EXISTS (
    SELECT 1 FROM NivelPermissoes np 
    WHERE np.NivelId = n.Id AND np.PermissaoId = p.Id
);

-- Operador (permissões básicas)
INSERT INTO NivelPermissoes (NivelId, PermissaoId)
SELECT n.Id, p.Id
FROM Niveis n
CROSS JOIN Permissoes p
WHERE n.Nome = 'Operador'
AND p.Nome IN ('view:operation')
AND NOT EXISTS (
    SELECT 1 FROM NivelPermissoes np 
    WHERE np.NivelId = n.Id AND np.PermissaoId = p.Id
);
GO

-- ============================================================
-- 9. FUNÇÃO PARA CRIPTOGRAFAR SENHAS E PROCEDIMENTO PARA SALT
-- ============================================================
CREATE OR ALTER FUNCTION dbo.CriptografarSenha(@senha NVARCHAR(255), @salt NVARCHAR(255))
RETURNS NVARCHAR(255)
AS
BEGIN
    RETURN CONVERT(NVARCHAR(255), HASHBYTES('SHA2_512', @senha + @salt), 2);
END
GO

-- Procedimento para gerar salt (não pode ser função devido ao NEWID)
CREATE OR ALTER PROCEDURE sp_GerarSalt
    @Salt NVARCHAR(255) OUTPUT
AS
BEGIN
    SET @Salt = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_256', CAST(NEWID() AS NVARCHAR(36))), 2);
END
GO

-- ============================================================
-- 10. PROCEDIMENTO PARA CRIAR USUÁRIO
-- ============================================================
CREATE OR ALTER PROCEDURE sp_CriarUsuario
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
-- 11. PROCEDIMENTO PARA VALIDAR LOGIN (COMPATÍVEL COM WEBHOOK)
-- ============================================================
CREATE OR ALTER PROCEDURE sp_ValidarLogin
    @Email NVARCHAR(255),
    @Senha NVARCHAR(255), -- Senha já vem criptografada do webhook
    @EnderecoIP NVARCHAR(45) = NULL,
    @UserAgent NVARCHAR(500) = NULL,
    @SenhaJaCriptografada BIT = 0 -- Flag para indicar se senha já está criptografada
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @UsuarioId INT;
    DECLARE @Salt NVARCHAR(255);
    DECLARE @SenhaHashArmazenada NVARCHAR(255);
    DECLARE @SenhaHashInformada NVARCHAR(255);
    DECLARE @ContaBloqueada BIT;
    DECLARE @TentativasLogin INT;
    DECLARE @NivelNome NVARCHAR(50);
    DECLARE @NivelHierarquia INT;
    
    -- Buscar dados do usuário
    SELECT 
        @UsuarioId = u.Id,
        @Salt = u.Salt,
        @SenhaHashArmazenada = u.SenhaHash,
        @ContaBloqueada = u.ContaBloqueada,
        @TentativasLogin = u.TentativasLogin,
        @NivelNome = n.Nome,
        @NivelHierarquia = n.Nivel
    FROM Usuarios u
    INNER JOIN Niveis n ON u.NivelId = n.Id
    WHERE u.Email = @Email AND u.Ativo = 1;
    
    -- Verificar se usuário existe
    IF @UsuarioId IS NULL
    BEGIN
        -- Registrar tentativa de login com email inválido
        INSERT INTO AuditoriaLogin (Email, TipoEvento, EnderecoIP, UserAgent, Detalhes)
        VALUES (@Email, 'LOGIN_FAIL', @EnderecoIP, @UserAgent, 'Email não encontrado');
        
        SELECT 0 as Sucesso, 'Credenciais inválidas' as Mensagem;
        RETURN;
    END
    
    -- Verificar se conta está bloqueada
    IF @ContaBloqueada = 1
    BEGIN
        INSERT INTO AuditoriaLogin (UsuarioId, Email, TipoEvento, EnderecoIP, UserAgent, Detalhes)
        VALUES (@UsuarioId, @Email, 'LOGIN_FAIL', @EnderecoIP, @UserAgent, 'Conta bloqueada');
        
        SELECT 0 as Sucesso, 'Conta bloqueada' as Mensagem;
        RETURN;
    END
    
    -- Calcular hash da senha informada (dependendo se já vem criptografada)
    IF @SenhaJaCriptografada = 1
    BEGIN
        -- Senha já vem do webhook como SHA2_256, converter para nosso formato
        SET @SenhaHashInformada = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_512', @Senha + @Salt), 2);
    END
    ELSE
    BEGIN
        -- Senha em texto plano, aplicar nossa criptografia
        SET @SenhaHashInformada = dbo.CriptografarSenha(@Senha, @Salt);
    END
    
    -- Verificar senha
    IF @SenhaHashArmazenada = @SenhaHashInformada
    BEGIN
        -- Login bem sucedido
        UPDATE Usuarios 
        SET DataUltimoLogin = GETDATE(), TentativasLogin = 0
        WHERE Id = @UsuarioId;
        
        INSERT INTO AuditoriaLogin (UsuarioId, Email, TipoEvento, EnderecoIP, UserAgent, Detalhes)
        VALUES (@UsuarioId, @Email, 'LOGIN_SUCCESS', @EnderecoIP, @UserAgent, 'Login realizado com sucesso');
        
        -- Retornar dados do usuário com hierarquia completa
        SELECT 
            1 as Sucesso,
            'Login realizado com sucesso' as Mensagem,
            u.Id,
            u.Nome,
            u.Email,
            @NivelNome as Role,
            @NivelHierarquia as NivelHierarquia,
            -- Permissões do usuário
            (
                SELECT p.Nome + ',' 
                FROM NivelPermissoes np
                INNER JOIN Permissoes p ON np.PermissaoId = p.Id
                WHERE np.NivelId = u.NivelId AND p.Ativo = 1
                FOR XML PATH('')
            ) as Permissoes
        FROM Usuarios u 
        WHERE u.Id = @UsuarioId;
    END
    ELSE
    BEGIN
        -- Senha incorreta - incrementar tentativas
        SET @TentativasLogin = @TentativasLogin + 1;
        
        -- Bloquear conta após 5 tentativas
        IF @TentativasLogin >= 5
        BEGIN
            UPDATE Usuarios 
            SET TentativasLogin = @TentativasLogin, 
                ContaBloqueada = 1,
                DataDesbloqueio = DATEADD(MINUTE, 30, GETDATE())
            WHERE Id = @UsuarioId;
            
            INSERT INTO AuditoriaLogin (UsuarioId, Email, TipoEvento, EnderecoIP, UserAgent, Detalhes)
            VALUES (@UsuarioId, @Email, 'BLOCKED', @EnderecoIP, @UserAgent, 'Conta bloqueada por excesso de tentativas');
            
            SELECT 0 as Sucesso, 'Conta bloqueada por excesso de tentativas' as Mensagem;
        END
        ELSE
        BEGIN
            UPDATE Usuarios 
            SET TentativasLogin = @TentativasLogin
            WHERE Id = @UsuarioId;
            
            INSERT INTO AuditoriaLogin (UsuarioId, Email, TipoEvento, EnderecoIP, UserAgent, Detalhes)
            VALUES (@UsuarioId, @Email, 'LOGIN_FAIL', @EnderecoIP, @UserAgent, 'Senha incorreta');
            
            SELECT 0 as Sucesso, 'Credenciais inválidas' as Mensagem;
        END
    END
END
GO

-- ============================================================
-- 12. PROCEDIMENTO ESPECÍFICO PARA WEBHOOK - BUSCAR HIERARQUIA
-- ============================================================
CREATE OR ALTER PROCEDURE sp_BuscarHierarquiaUsuario
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Buscar dados completos de hierarquia do usuário
    SELECT 
        u.Id,
        u.Nome,
        u.Email,
        n.Nome as Role,
        n.Nivel as NivelHierarquia,
        n.Descricao as DescricaoNivel,
        u.DataUltimoLogin,
        -- Lista de permissões do usuário
        STUFF((
            SELECT ',' + p.Nome
            FROM NivelPermissoes np
            INNER JOIN Permissoes p ON np.PermissaoId = p.Id
            WHERE np.NivelId = u.NivelId AND p.Ativo = 1
            FOR XML PATH('')
        ), 1, 1, '') as Permissoes,
        -- Detalhes das permissões
        (
            SELECT 
                p.Nome as permission,
                p.Descricao as description,
                p.Modulo as module,
                p.Recurso as resource
            FROM NivelPermissoes np
            INNER JOIN Permissoes p ON np.PermissaoId = p.Id
            WHERE np.NivelId = u.NivelId AND p.Ativo = 1
            FOR JSON PATH
        ) as PermissoesDetalhadas
    FROM Usuarios u
    INNER JOIN Niveis n ON u.NivelId = n.Id
    WHERE u.Email = @Email AND u.Ativo = 1;
    
    -- Registrar consulta de hierarquia
    INSERT INTO AuditoriaLogin (Email, TipoEvento, Detalhes)
    VALUES (@Email, 'HIERARCHY_CHECK', 'Consulta de hierarquia realizada');
END
GO
-- ============================================================
-- 13. INSERIR USUÁRIOS INICIAIS
-- ============================================================
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
-- 13. VIEWS ÚTEIS PARA CONSULTAS
-- ============================================================
CREATE OR ALTER VIEW vw_UsuariosCompleto AS
SELECT 
    u.Id,
    u.Nome,
    u.Email,
    n.Nome as Nivel,
    n.Nivel as NivelHierarquia,
    u.DataCriacao,
    u.DataUltimoLogin,
    u.TentativasLogin,
    u.ContaBloqueada,
    u.Ativo,
    criador.Nome as CriadoPorNome
FROM Usuarios u
INNER JOIN Niveis n ON u.NivelId = n.Id
LEFT JOIN Usuarios criador ON u.CriadoPor = criador.Id;
GO

CREATE OR ALTER VIEW vw_PermissoesPorUsuario AS
SELECT 
    u.Id as UsuarioId,
    u.Nome as UsuarioNome,
    u.Email,
    n.Nome as Nivel,
    p.Nome as Permissao,
    p.Descricao as PermissaoDescricao,
    p.Modulo,
    p.Recurso
FROM Usuarios u
INNER JOIN Niveis n ON u.NivelId = n.Id
INNER JOIN NivelPermissoes np ON n.Id = np.NivelId
INNER JOIN Permissoes p ON np.PermissaoId = p.Id
WHERE u.Ativo = 1 AND n.Ativo = 1 AND p.Ativo = 1;
GO

-- ============================================================
-- 14. ÍNDICES PARA PERFORMANCE (COM VERIFICAÇÃO DE EXISTÊNCIA)
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

-- ============================================================
-- EXEMPLOS DE USO
-- ============================================================
PRINT '=== BANCO DE DADOS CRIADO COM SUCESSO ===';
PRINT '';
PRINT 'EXEMPLOS DE USO:';
PRINT '';
PRINT '-- Validar login:';
PRINT 'EXEC sp_ValidarLogin @Email = ''master@neo.com'', @Senha = ''123456'';';
PRINT '';
PRINT '-- Criar novo usuário:';
PRINT 'EXEC sp_CriarUsuario @Nome = ''João Silva'', @Email = ''joao@neo.com'', @Senha = ''senhaSegura123'', @NivelNome = ''Operador'';';
PRINT 'EXEC sp_CriarUsuario @Nome = ''Ana Costa'', @Email = ''ana@neo.com'', @Senha = ''minhaSenh@123'', @NivelId = 2;'; -- Usando ID direto
PRINT '';
PRINT '-- Consultar usuários:';
PRINT 'SELECT * FROM vw_UsuariosCompleto;';
PRINT '';
PRINT '-- Consultar permissões:';
PRINT 'SELECT * FROM vw_PermissoesPorUsuario WHERE Email = ''master@neo.com'';';