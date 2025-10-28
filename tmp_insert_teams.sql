SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_WARNINGS ON;
SET ANSI_PADDING ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;

BEGIN TRY
  BEGIN TRAN;

  DECLARE @now DATETIME2 = SYSUTCDATETIME();
  DECLARE @EquipeMasterId INT, @EquipeAlphaId INT;

  -- Equipe Master
  IF NOT EXISTS (SELECT 1 FROM dbo.equipes WHERE nome = N'Master')
  BEGIN
    INSERT INTO dbo.equipes (nome, descricao, ativo, created_at, updated_at)
    VALUES (N'Master', N'Equipe dos usuários Master/Admin', 1, @now, @now);
  END;
  SELECT @EquipeMasterId = id FROM dbo.equipes WHERE nome = N'Master';

  -- Equipe Alpha
  IF NOT EXISTS (SELECT 1 FROM dbo.equipes WHERE nome = N'Equipe Alpha')
  BEGIN
    INSERT INTO dbo.equipes (nome, descricao, ativo, created_at, updated_at)
    VALUES (N'Equipe Alpha', N'Equipe de operações Alpha', 1, @now, @now);
  END;
  SELECT @EquipeAlphaId = id FROM dbo.equipes WHERE nome = N'Equipe Alpha';

  -- Vincular MASTER
  UPDATE u
  SET u.equipe_id = @EquipeMasterId
  FROM dbo.usuarios u
  WHERE u.login = N'master';

  -- Vincular MARIA por login, depois por nome se necessário
  UPDATE u
  SET u.equipe_id = @EquipeAlphaId
  FROM dbo.usuarios u
  WHERE u.login = N'maria';
  IF @@ROWCOUNT = 0
  BEGIN
    UPDATE u
    SET u.equipe_id = @EquipeAlphaId
    FROM dbo.usuarios u
    WHERE u.nome LIKE N'Maria%';
  END

  -- Vincular JOAO por login, depois por nome se necessário; garantir Operador e não supervisor
  UPDATE u
  SET u.equipe_id = @EquipeAlphaId,
      u.role = COALESCE(NULLIF(u.role, N''), N'Operador'),
      u.is_supervisor = 0
  FROM dbo.usuarios u
  WHERE u.login = N'joao';
  IF @@ROWCOUNT = 0
  BEGIN
    UPDATE u
    SET u.equipe_id = @EquipeAlphaId,
        u.role = COALESCE(NULLIF(u.role, N''), N'Operador'),
        u.is_supervisor = 0
    FROM dbo.usuarios u
    WHERE u.nome COLLATE Latin1_General_CI_AI LIKE N'Jo%o%'; -- cobre João/Joao
  END

  -- Conferência
  PRINT '--- Equipes ---';
  SELECT id, nome, descricao, ativo FROM dbo.equipes WHERE id IN (@EquipeMasterId, @EquipeAlphaId);

  PRINT '--- Usuarios ---';
  SELECT id, nome, login, role, equipe_id, is_supervisor
  FROM dbo.usuarios
  WHERE login IN (N'master', N'maria', N'joao')
     OR nome IN (N'Maria Silva', N'João', N'Joao');

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
  RAISERROR(@msg, 16, 1);
END CATCH
