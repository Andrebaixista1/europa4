import { Roles, normalizeRole } from './roles.js'

// Simple permission map per role
const map = {
  'view:admin': [Roles.Master, Roles.Administrador, 'master', 'administrador'],
  // Aceita tanto maiúsculo quanto minúsculo
  'view:supervision': [Roles.Master, Roles.Administrador, Roles.Supervisor, 'master', 'administrador', 'supervisor'],
  'view:operation': [Roles.Master, Roles.Administrador, Roles.Supervisor, Roles.Operador, 'master', 'administrador', 'supervisor', 'operador'],
  'manage:users': [Roles.Master, 'master'],
}

export function can(role, permission) {
  const allowed = map[permission] || []
  if (!allowed.length) return false

  const normalized = normalizeRole(role)
  if (!normalized) return false

  return allowed.some(allowedRole => normalizeRole(allowedRole) === normalized)
}

