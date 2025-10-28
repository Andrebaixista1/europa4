SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_WARNINGS ON;
SET ANSI_PADDING ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;

BEGIN TRY
  BEGIN TRAN;

  DECLARE @EquipeMasterId INT = (SELECT id FROM dbo.equipes WHERE nome = N'Master');
  DECLARE @EquipeAlphaId  INT = (SELECT id FROM dbo.equipes WHERE nome = N'Equipe Alpha');

  -- Garantir todos Master/Admin na equipe Master
  UPDATE u
    SET u.equipe_id = @EquipeMasterId,
        u.is_supervisor = 1
  FROM dbo.usuarios u
  WHERE LOWER(u.role) IN ('master','admin');

  -- Garantir Maria
  UPDATE u
    SET u.equipe_id = @EquipeAlphaId
  FROM dbo.usuarios u
  WHERE u.login IN (N'maria', N'mariasilva') OR u.nome LIKE N'Maria%';

  -- Garantir Joao/João
  UPDATE u
    SET u.equipe_id = @EquipeAlphaId,
        u.role = COALESCE(NULLIF(u.role, N''), N'Operador'),
        u.is_supervisor = 0
  FROM dbo.usuarios u
  WHERE u.login LIKE N'joao%' OR u.nome COLLATE Latin1_General_CI_AI LIKE N'Jo%o%';

  -- Conferência ampliada
  PRINT '--- Usuarios master/supervisor/joao ---';
  SELECT id, nome, login, role, equipe_id, is_supervisor
  FROM dbo.usuarios
  WHERE LOWER(role) IN ('master','admin','supervisor')
     OR login IN (N'master', N'maria', N'mariasilva')
     OR nome COLLATE Latin1_General_CI_AI LIKE N'Jo%o%';

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
  RAISERROR(@msg, 16, 1);
END CATCH
