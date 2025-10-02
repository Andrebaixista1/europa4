import { Roles } from './roles.js'

// Simple permission map per role
const map = {
  'view:master': [Roles.Master],
  'view:supervision': [Roles.Master, Roles.Supervisor],
  'view:operation': [Roles.Master, Roles.Supervisor, Roles.Operador],
  'manage:users': [Roles.Master],
}

export function can(role, permission) {
  const allowed = map[permission] || []
  return allowed.includes(role)
}
