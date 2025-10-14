export const Roles = Object.freeze({
  Master: 'Master',
  Administrador: 'Administrador',
  Supervisor: 'Supervisor',
  Operador: 'Operador',
})

export function normalizeRole(role, level) {
  if (typeof role === 'string') {
    const r = role.trim().toLowerCase()
    if (['master'].includes(r)) return Roles.Master
    if (['admin', 'administrador', 'adm'].includes(r)) return Roles.Administrador
    if (['supervisor', 'supervisao', 'supervisÃ£o'].includes(r)) return Roles.Supervisor
    if (['operador', 'operator', 'user', 'usuario', 'usuÃ¡rio', 'operacao', 'operaÃ§Ã£o'].includes(r)) return Roles.Operador
  }
  // Fallback pelo nÃ­vel hierÃ¡rquico
  const n = typeof level === 'number' ? level : parseInt(level, 10)
  if (!Number.isNaN(n)) {
    if (n === 1) return Roles.Master
    if (n === 2) return Roles.Supervisor
    return Roles.Operador
  }
  // Ãšltimo recurso
  return Roles.Operador
}

export function defaultRouteFor(role) {
  switch (role) {
    case Roles.Master:
    case Roles.Supervisor:
    case Roles.Operador:
    default:
      return '/dashboard'
  }
}

