-- Cria uma tabela espelho de `usuarios` sem alterar a tabela original.
-- Compatível com MySQL/MariaDB.
--
-- Objetivo:
-- 1) Duplicar estrutura atual (incluindo coluna de senha como está hoje).
-- 2) Copiar todos os dados existentes.
-- 3) Adicionar colunas de permissões de menu no espelho.
--
-- Nome da nova tabela: usuarios_permissoes

START TRANSACTION;

-- 1) Cria tabela espelho com a mesma estrutura da original
CREATE TABLE IF NOT EXISTS usuarios_permissoes LIKE usuarios;

-- 2) Garante colunas extras (somente no espelho)
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usuarios_permissoes'
    AND COLUMN_NAME = 'menu_permissions'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE usuarios_permissoes ADD COLUMN menu_permissions JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usuarios_permissoes'
    AND COLUMN_NAME = 'menu_permissions_updated_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE usuarios_permissoes ADD COLUMN menu_permissions_updated_at DATETIME NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usuarios_permissoes'
    AND COLUMN_NAME = 'menu_permissions_updated_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE usuarios_permissoes ADD COLUMN menu_permissions_updated_by INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Copia dados da tabela original para o espelho (sem duplicar id)
INSERT INTO usuarios_permissoes
SELECT u.*
FROM usuarios u
LEFT JOIN usuarios_permissoes up ON up.id = u.id
WHERE up.id IS NULL;

-- 4) Índices auxiliares para auditoria
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usuarios_permissoes'
    AND INDEX_NAME = 'idx_up_perm_updated_by'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_up_perm_updated_by ON usuarios_permissoes (menu_permissions_updated_by)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usuarios_permissoes'
    AND INDEX_NAME = 'idx_up_perm_updated_at'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_up_perm_updated_at ON usuarios_permissoes (menu_permissions_updated_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

COMMIT;

-- Observações:
-- - As senhas NÃO são recalculadas: permanecem exatamente como já estão (ex.: SHA256).
-- - A tabela original `usuarios` não é alterada.
-- - Este script só cria/copia para a tabela espelho.
