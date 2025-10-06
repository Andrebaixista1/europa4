/*
  Criação da tabela de saldos (IN100) por usuário
  Ambiente alvo: Microsoft SQL Server (T-SQL)

  Este script cria a tabela principal para armazenar os saldos retornados
  na consulta IN100, vinculados ao usuário (id do sistema) e ao benefício.
*/

IF OBJECT_ID('dbo.SaldosIN100', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SaldosIN100 (
        Id                   BIGINT IDENTITY(1,1)      NOT NULL PRIMARY KEY,
        UsuarioId            INT                       NOT NULL,
        NumeroBeneficio      VARCHAR(20)               NOT NULL,
        NumeroDocumento      VARCHAR(14)               NOT NULL, -- CPF sem máscara

        -- Saldos
        SaldoCartaoBeneficio     DECIMAL(18,2)        NOT NULL CONSTRAINT DF_SaldosIN100_SCB DEFAULT (0),
        SaldoCartaoConsignado    DECIMAL(18,2)        NOT NULL CONSTRAINT DF_SaldosIN100_SCC DEFAULT (0),
        SaldoCreditoConsignado   DECIMAL(18,2)        NOT NULL CONSTRAINT DF_SaldosIN100_SCCred DEFAULT (0),
        SaldoTotalDisponivel     DECIMAL(18,2)        NOT NULL CONSTRAINT DF_SaldosIN100_STD DEFAULT (0),
        SaldoTotalMaximo         DECIMAL(18,2)        NOT NULL CONSTRAINT DF_SaldosIN100_STM DEFAULT (0),
        SaldoTotalUtilizado      DECIMAL(18,2)        NOT NULL CONSTRAINT DF_SaldosIN100_STU DEFAULT (0),

        NumeroPortabilidades INT                        NULL,

        -- Dados bancários
        BancoDesembolso      VARCHAR(10)               NULL,
        AgenciaDesembolso    VARCHAR(10)               NULL,
        ContaDesembolso      VARCHAR(20)               NULL,
        DigitoDesembolso     VARCHAR(4)                NULL,

        -- Status e metadados da API
        StatusAPI            VARCHAR(50)               NULL,
        RespostaAPI          VARCHAR(100)              NULL,

        -- Datas
        DataConsulta         DATETIME2(0)              NULL,
        DataRetornoConsulta  DATETIME2(0)              NULL,

        -- Origem/Tipo da consulta (ex.: online/offline)
        Tipo                 VARCHAR(16)               NULL,

        -- Auditoria
        CriadoEm             DATETIME2(0)              NOT NULL CONSTRAINT DF_SaldosIN100_CriadoEm DEFAULT (SYSUTCDATETIME()),
        AtualizadoEm         DATETIME2(0)              NOT NULL CONSTRAINT DF_SaldosIN100_AtualizadoEm DEFAULT (SYSUTCDATETIME())
    );
END
GO

-- Índices úteis
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SaldosIN100_UsuarioId_Data' AND object_id = OBJECT_ID('dbo.SaldosIN100'))
BEGIN
    CREATE INDEX IX_SaldosIN100_UsuarioId_Data
        ON dbo.SaldosIN100 (UsuarioId, DataConsulta DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SaldosIN100_NumeroBeneficio' AND object_id = OBJECT_ID('dbo.SaldosIN100'))
BEGIN
    CREATE INDEX IX_SaldosIN100_NumeroBeneficio
        ON dbo.SaldosIN100 (NumeroBeneficio);
END
GO

-- Evitar duplicidade para a mesma fotografia de dados
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_SaldosIN100_User_Beneficio_Data' AND object_id = OBJECT_ID('dbo.SaldosIN100'))
BEGIN
    CREATE UNIQUE INDEX UQ_SaldosIN100_User_Beneficio_Data
        ON dbo.SaldosIN100 (UsuarioId, NumeroBeneficio, DataConsulta)
        WHERE DataConsulta IS NOT NULL;
END
GO

-- Atualiza carimbo de data/hora na alteração
IF OBJECT_ID('dbo.trg_SaldosIN100_UpdateTimestamp', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_SaldosIN100_UpdateTimestamp;
GO

CREATE TRIGGER dbo.trg_SaldosIN100_UpdateTimestamp
ON dbo.SaldosIN100
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE s
        SET AtualizadoEm = SYSUTCDATETIME()
    FROM dbo.SaldosIN100 s
    INNER JOIN inserted i ON i.Id = s.Id;
END
GO

-- (Opcional) Vincular à tabela de usuários, caso exista
IF OBJECT_ID('dbo.Usuarios', 'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_SaldosIN100_Usuarios' AND parent_object_id = OBJECT_ID('dbo.SaldosIN100')
    )
BEGIN
    ALTER TABLE dbo.SaldosIN100 WITH CHECK
        ADD CONSTRAINT FK_SaldosIN100_Usuarios
        FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios (Id);
END
GO

/*
  (Opcional) Procedimento para upsert de saldos
*/
IF OBJECT_ID('dbo.sp_UpsertSaldoIN100', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_UpsertSaldoIN100;
GO

CREATE PROCEDURE dbo.sp_UpsertSaldoIN100
    @UsuarioId               INT,
    @NumeroBeneficio         VARCHAR(20),
    @NumeroDocumento         VARCHAR(14),
    @SaldoCartaoBeneficio    DECIMAL(18,2) = 0,
    @SaldoCartaoConsignado   DECIMAL(18,2) = 0,
    @SaldoCreditoConsignado  DECIMAL(18,2) = 0,
    @SaldoTotalDisponivel    DECIMAL(18,2) = 0,
    @SaldoTotalMaximo        DECIMAL(18,2) = 0,
    @SaldoTotalUtilizado     DECIMAL(18,2) = 0,
    @NumeroPortabilidades    INT = NULL,
    @BancoDesembolso         VARCHAR(10) = NULL,
    @AgenciaDesembolso       VARCHAR(10) = NULL,
    @ContaDesembolso         VARCHAR(20) = NULL,
    @DigitoDesembolso        VARCHAR(4) = NULL,
    @StatusAPI               VARCHAR(50) = NULL,
    @RespostaAPI             VARCHAR(100) = NULL,
    @DataConsulta            DATETIME2(0) = NULL,
    @DataRetornoConsulta     DATETIME2(0) = NULL,
    @Tipo                    VARCHAR(16) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ChaveData DATETIME2(0) = ISNULL(@DataConsulta, SYSUTCDATETIME());

    MERGE dbo.SaldosIN100 AS tgt
    USING (
        SELECT
            @UsuarioId AS UsuarioId,
            @NumeroBeneficio AS NumeroBeneficio,
            @ChaveData AS DataConsulta
    ) AS src
    ON (tgt.UsuarioId = src.UsuarioId
        AND tgt.NumeroBeneficio = src.NumeroBeneficio
        AND tgt.DataConsulta = src.DataConsulta)
    WHEN MATCHED THEN
        UPDATE SET
            NumeroDocumento = @NumeroDocumento,
            SaldoCartaoBeneficio = @SaldoCartaoBeneficio,
            SaldoCartaoConsignado = @SaldoCartaoConsignado,
            SaldoCreditoConsignado = @SaldoCreditoConsignado,
            SaldoTotalDisponivel = @SaldoTotalDisponivel,
            SaldoTotalMaximo = @SaldoTotalMaximo,
            SaldoTotalUtilizado = @SaldoTotalUtilizado,
            NumeroPortabilidades = @NumeroPortabilidades,
            BancoDesembolso = @BancoDesembolso,
            AgenciaDesembolso = @AgenciaDesembolso,
            ContaDesembolso = @ContaDesembolso,
            DigitoDesembolso = @DigitoDesembolso,
            StatusAPI = @StatusAPI,
            RespostaAPI = @RespostaAPI,
            DataRetornoConsulta = @DataRetornoConsulta,
            Tipo = @Tipo
    WHEN NOT MATCHED THEN
        INSERT (
            UsuarioId, NumeroBeneficio, NumeroDocumento,
            SaldoCartaoBeneficio, SaldoCartaoConsignado, SaldoCreditoConsignado,
            SaldoTotalDisponivel, SaldoTotalMaximo, SaldoTotalUtilizado,
            NumeroPortabilidades, BancoDesembolso, AgenciaDesembolso,
            ContaDesembolso, DigitoDesembolso, StatusAPI, RespostaAPI,
            DataConsulta, DataRetornoConsulta, Tipo
        )
        VALUES (
            @UsuarioId, @NumeroBeneficio, @NumeroDocumento,
            @SaldoCartaoBeneficio, @SaldoCartaoConsignado, @SaldoCreditoConsignado,
            @SaldoTotalDisponivel, @SaldoTotalMaximo, @SaldoTotalUtilizado,
            @NumeroPortabilidades, @BancoDesembolso, @AgenciaDesembolso,
            @ContaDesembolso, @DigitoDesembolso, @StatusAPI, @RespostaAPI,
            @ChaveData, @DataRetornoConsulta, @Tipo
        );
END
GO

-- Exemplo de uso:
-- EXEC dbo.sp_UpsertSaldoIN100
--     @UsuarioId = 1,
--     @NumeroBeneficio = '2128805508',
--     @NumeroDocumento = '70576084700',
--     @SaldoTotalDisponivel = 0.01,
--     @SaldoTotalMaximo = 807.92,
--     @SaldoTotalUtilizado = 807.91,
--     @BancoDesembolso = '069',
--     @AgenciaDesembolso = '0001',
--     @StatusAPI = 'Sucesso',
--     @RespostaAPI = 'Concluido',
--     @DataConsulta = SYSUTCDATETIME(),
--     @DataRetornoConsulta = SYSUTCDATETIME(),
--     @Tipo = 'online';

