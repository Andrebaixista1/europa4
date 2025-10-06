import { Roles } from './roles.js'

// Simple permission map per role
const map = {
  'view:master': [Roles.Master, 'master'], // Aceita tanto maiúsculo quanto minúsculo
  'view:supervision': [Roles.Master, Roles.Supervisor, 'master', 'supervisor'],
  'view:operation': [Roles.Master, Roles.Supervisor, Roles.Operador, 'master', 'supervisor', 'operador'],
  'manage:users': [Roles.Master, 'master'],
}

export function can(role, permission) {
  const allowed = map[permission] || []
  return allowed.includes(role)
}
