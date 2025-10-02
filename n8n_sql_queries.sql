-- ============================================================
-- SCRIPT COMPLETO PARA RECRIAR TABELAS DO ZERO
-- Sistema Nova Europa com usuário master único
-- ============================================================

USE europa4;
GO

-- ============================================================
-- 1. DROPAR TABELAS EXISTENTES (SE HOUVER)
-- ============================================================
IF OBJECT_ID('AuditoriaLogin', 'U') IS NOT NULL DROP TABLE AuditoriaLogin;
IF OBJECT_ID('NivelPermissoes', 'U') IS NOT NULL DROP TABLE NivelPermissoes;
IF OBJECT_ID('Usuarios', 'U') IS NOT NULL DROP TABLE Usuarios;
IF OBJECT_ID('Permissoes', 'U') IS NOT NULL DROP TABLE Permissoes;
IF OBJECT_ID('Niveis', 'U') IS NOT NULL DROP TABLE Niveis;
GO

-- Dropar funções e procedures
IF OBJECT_ID('dbo.CriptografarSenha', 'FN') IS NOT NULL DROP FUNCTION dbo.CriptografarSenha;
IF OBJECT_ID('sp_GerarSalt', 'P') IS NOT NULL DROP PROCEDURE sp_GerarSalt;
IF OBJECT_ID('sp_CriarUsuario', 'P') IS NOT NULL DROP PROCEDURE sp_CriarUsuario;
IF OBJECT_ID('sp_BuscarHierarquiaUsuario', 'P') IS NOT NULL DROP PROCEDURE sp_BuscarHierarquiaUsuario;
GO

-- ============================================================
-- 2. CRIAR TABELA DE NÍVEIS HIERÁRQUICOS
-- ============================================================
CREATE TABLE Niveis (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Nome NVARCHAR(50) NOT NULL UNIQUE,
    Nivel INT NOT NULL UNIQUE, -- Menor número = maior hierarquia
    Descricao NVARCHAR(255),
    DataCriacao DATETIME2 DEFAULT GETDATE(),
    Ativo BIT DEFAULT 1
);

-- Inserir níveis
INSERT INTO Niveis (Nome, Nivel, Descricao) VALUES
('Master', 1, 'Nível máximo - acesso completo ao sistema'),
('Supervisor', 2, 'Nível supervisório - gerenciamento e supervisão'),
('Operador', 3, 'Nível operacional - operações básicas do sistema');
GO

-- ============================================================
-- 3. CRIAR TABELA DE PERMISSÕES
-- ============================================================
CREATE TABLE Permissoes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Nome NVARCHAR(100) NOT NULL UNIQUE,
    Descricao NVARCHAR(255),
    Modulo NVARCHAR(50),
    Recurso NVARCHAR(50),
    DataCriacao DATETIME2 DEFAULT GETDATE(),
    Ativo BIT DEFAULT 1
);

-- Inserir permissões
INSERT INTO Permissoes (Nome, Descricao, Modulo, Recurso) VALUES
('view:master', 'Visualizar área master', 'view', 'master'),
('view:supervision', 'Visualizar área de supervisão', 'view', 'supervision'),
('view:operation', 'Visualizar área de operação', 'view', 'operation'),
('manage:users', 'Gerenciar usuários do sistema', 'manage', 'users'),
('manage:system', 'Gerenciar configurações do sistema', 'manage', 'system'),
('view:reports', 'Visualizar relatórios', 'view', 'reports'),
('export:data', 'Exportar dados do sistema', 'export', 'data');
GO

-- ============================================================
-- 4. CRIAR TABELA DE RELACIONAMENTO NIVEL-PERMISSÃO
-- ============================================================
CREATE TABLE NivelPermissoes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    NivelId INT NOT NULL,
    PermissaoId INT NOT NULL,
    DataCriacao DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (NivelId) REFERENCES Niveis(Id),
    FOREIGN KEY (PermissaoId) REFERENCES Permissoes(Id),
    UNIQUE(NivelId, PermissaoId)
);

-- Configurar permissões por nível
-- Master (todas as permissões)
INSERT INTO NivelPermissoes (NivelId, PermissaoId)
SELECT n.Id, p.Id
FROM Niveis n
CROSS JOIN Permissoes p
WHERE n.Nome = 'Master';

-- Supervisor (permissões limitadas)
INSERT INTO NivelPermissoes (NivelId, PermissaoId)
SELECT n.Id, p.Id
FROM Niveis n
CROSS JOIN Permissoes p
WHERE n.Nome = 'Supervisor'
AND p.Nome IN ('view:supervision', 'view:operation', 'view:reports');

-- Operador (permissões básicas)
INSERT INTO NivelPermissoes (NivelId, PermissaoId)
SELECT n.Id, p.Id
FROM Niveis n
CROSS JOIN Permissoes p
WHERE n.Nome = 'Operador'
AND p.Nome IN ('view:operation');
GO

-- ============================================================
-- 5. CRIAR TABELA DE USUÁRIOS
-- ============================================================
CREATE TABLE Usuarios (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Nome NVARCHAR(100) NOT NULL,
    Login NVARCHAR(100) NOT NULL UNIQUE, -- Campo LOGIN em vez de EMAIL
    Email NVARCHAR(255) NULL, -- Email opcional
    SenhaHash NVARCHAR(255) NOT NULL,
    Salt NVARCHAR(255) NOT NULL,
    NivelId INT NOT NULL,
    DataCriacao DATETIME2 DEFAULT GETDATE(),
    DataUltimoLogin DATETIME2 NULL,
    DataUltimaAlteracaoSenha DATETIME2 DEFAULT GETDATE(),
    TentativasLogin INT DEFAULT 0,
    ContaBloqueada BIT DEFAULT 0,
    DataDesbloqueio DATETIME2 NULL,
    Ativo BIT DEFAULT 1,
    CriadoPor INT NULL,
    AlteradoPor INT NULL,
    DataAlteracao DATETIME2 NULL,
    FOREIGN KEY (NivelId) REFERENCES Niveis(Id),
    FOREIGN KEY (CriadoPor) REFERENCES Usuarios(Id),
    FOREIGN KEY (AlteradoPor) REFERENCES Usuarios(Id)
);
GO

-- ============================================================
-- 6. CRIAR TABELA DE AUDITORIA DE LOGIN
-- ============================================================
CREATE TABLE AuditoriaLogin (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UsuarioId INT NULL,
    Login NVARCHAR(100) NOT NULL, -- Campo LOGIN
    Email NVARCHAR(255) NULL, -- Email opcional
    TipoEvento NVARCHAR(50) NOT NULL,
    EnderecoIP NVARCHAR(45),
    UserAgent NVARCHAR(500),
    DataEvento DATETIME2 DEFAULT GETDATE(),
    Detalhes NVARCHAR(1000),
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
);
GO

-- ============================================================
-- 7. CRIAR FUNÇÕES E PROCEDURES
-- ============================================================

-- Função para criptografar senha
CREATE FUNCTION dbo.CriptografarSenha(@senha NVARCHAR(255), @salt NVARCHAR(255))
RETURNS NVARCHAR(255)
AS
BEGIN
    RETURN CONVERT(NVARCHAR(255), HASHBYTES('SHA2_512', @senha + @salt), 2);
END
GO

-- Procedure para gerar salt
CREATE PROCEDURE sp_GerarSalt
    @Salt NVARCHAR(255) OUTPUT
AS
BEGIN
    SET @Salt = CONVERT(NVARCHAR(255), HASHBYTES('SHA2_256', CAST(NEWID() AS NVARCHAR(36))), 2);
END
GO

-- Procedure para buscar hierarquia do usuário
CREATE PROCEDURE sp_BuscarHierarquiaUsuario
    @Login NVARCHAR(100) -- Parâmetro LOGIN
AS
BEGIN
    SET NOCOUNT ON;
    
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
        -- Lista de permissões
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
    FROM Usuarios u
    INNER JOIN Niveis n ON u.NivelId = n.Id
    WHERE u.Login = @Login AND u.Ativo = 1;
END
GO

-- ============================================================
-- 8. CRIAR USUÁRIO MASTER ÚNICO
-- ============================================================
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

PRINT '✅ Usuário Master criado: andre.felipe / 8996';
GO

-- ============================================================
-- 9. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE NONCLUSTERED INDEX IX_Usuarios_Login ON Usuarios(Login); -- Índice para LOGIN
CREATE NONCLUSTERED INDEX IX_Usuarios_Email ON Usuarios(Email); -- Índice para EMAIL (opcional)
CREATE NONCLUSTERED INDEX IX_Usuarios_NivelId ON Usuarios(NivelId);
CREATE NONCLUSTERED INDEX IX_AuditoriaLogin_UsuarioId ON AuditoriaLogin(UsuarioId);
CREATE NONCLUSTERED INDEX IX_AuditoriaLogin_DataEvento ON AuditoriaLogin(DataEvento);
GO

-- ============================================================
-- 10. SELECT FINAL PARA TESTAR E USAR NA API N8N
-- ============================================================
PRINT '🔍 Dados do usuário Master para a API:';

-- Query para usar no n8n (substitua os valores pelos parâmetros do webhook)
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
    -- Lista de permissões
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
FROM Usuarios u
INNER JOIN Niveis n ON u.NivelId = n.Id
WHERE u.Login = 'andre.felipe'
    AND u.SenhaHash = dbo.CriptografarSenha('8996', u.Salt)
    AND u.Ativo = 1;

PRINT '📊 Resumo do sistema:';
SELECT 
    'Níveis criados' as Tipo, 
    COUNT(*) as Quantidade 
FROM Niveis
UNION ALL
SELECT 
    'Permissões criadas' as Tipo, 
    COUNT(*) as Quantidade 
FROM Permissoes
UNION ALL
SELECT 
    'Usuários criados' as Tipo, 
    COUNT(*) as Quantidade 
FROM Usuarios;

PRINT '🎯 Sistema recriado com sucesso!';
PRINT 'Login: andre.felipe';
PRINT 'Senha: 8996';
PRINT 'Role: Master';
PRINT 'Nível: 1 (máxima hierarquia)';

-- ============================================================
-- QUERY PARA USAR NO N8N (COPY/PASTE)
-- ============================================================
/*
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
    AND u.SenhaHash = dbo.CriptografarSenha('{{ $json.body.senha }}', u.Salt)
    AND u.Ativo = 1;
*/