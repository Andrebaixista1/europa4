SET NOCOUNT ON;
SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON; SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON;

DECLARE @Ident NVARCHAR(100) = N'2'; -- Maria por ID
DECLARE @ById BIT = 1;               -- 1 = busca por id

;WITH u_sel AS (
  SELECT TOP 1 u.*, e.nome AS equipe_nome
  FROM dbo.usuarios u
  LEFT JOIN dbo.equipes e ON e.id = u.equipe_id
  WHERE (@ById = 1 AND u.id = TRY_CONVERT(INT, @Ident))
)
SELECT
  0 AS ordem,
  'USUARIO' AS tipo,
  us.id, us.nome, us.login, us.role,
  us.equipe_id, us.equipe_nome, us.is_supervisor, us.ativo
FROM u_sel us
UNION ALL
SELECT
  1 AS ordem,
  'OPERADOR' AS tipo,
  o.id, o.nome, o.login, o.role,
  o.equipe_id, e.nome AS equipe_nome, o.is_supervisor, o.ativo
FROM u_sel s
JOIN dbo.usuarios o
  ON (
       (LOWER(s.role) IN ('master','admin') OR LOWER(ISNULL(s.equipe_nome,'')) = 'master')
       OR o.equipe_id = s.equipe_id
     )
LEFT JOIN dbo.equipes e ON e.id = o.equipe_id
WHERE o.ativo = 1
  AND (o.is_supervisor = 0 OR LOWER(o.role) = 'operador')
ORDER BY ordem, nome;
