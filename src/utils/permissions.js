import { Roles } from './roles.js'

// Simple permission map per role
const map = {
  'view:master': [Roles.Master],
  'view:admin': [Roles.Master, Roles.Admin],
  'view:supervision': [Roles.Master, Roles.Admin, Roles.Supervisor],
  'view:operation': [Roles.Master, Roles.Admin, Roles.Supervisor, Roles.Operador],
  'manage:users': [Roles.Master, Roles.Admin],
}

export function can(role, permission) {
  const allowed = map[permission] || []
  return allowed.includes(role)
}

