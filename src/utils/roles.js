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
    if (['supervisor', 'supervisao', 'supervisão'].includes(r)) return Roles.Supervisor
    if (['operador', 'operator', 'user', 'usuario', 'usuário', 'operacao', 'operação'].includes(r)) return Roles.Operador
  }
  // Fallback pelo nível hierárquico
  const n = typeof level === 'number' ? level : parseInt(level, 10)
  if (!Number.isNaN(n)) {
    if (n === 1) return Roles.Master
    if (n === 2) return Roles.Supervisor
    return Roles.Operador
  }
  // Último recurso
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