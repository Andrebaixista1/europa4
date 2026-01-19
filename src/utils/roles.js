export const Roles = Object.freeze({
  Master: 'Master',
  Administrador: 'Administrador',
  Supervisor: 'Supervisor',
  Operador: 'Operador',
})

const normalizeToken = (value) => {
  if (value === undefined || value === null) return ''
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function normalizeRole(role, level) {
  const token = normalizeToken(role)

  if (token) {
    if (['master', 'perfil master'].includes(token)) return Roles.Master
    if (['admin', 'administrador', 'adm', 'administradora'].includes(token)) return Roles.Administrador
    if (['supervisor', 'supervisao', 'supervisora', 'gestor', 'coordenador'].includes(token)) return Roles.Supervisor
    if (['operador', 'operator', 'user', 'usuario', 'usuaria', 'operacao', 'operacao', 'analista'].includes(token)) return Roles.Operador
  }

  const numericLevel = Number.parseInt(level, 10)
  if (!Number.isNaN(numericLevel)) {
    if (numericLevel <= 0) return Roles.Master
    if (numericLevel === 1) return Roles.Administrador
    if (numericLevel === 2) return Roles.Supervisor
    return Roles.Operador
  }

  return Roles.Operador
}

export function defaultRouteFor(role) {
  switch (role) {
    case Roles.Master:
    case Roles.Administrador:
    case Roles.Supervisor:
    case Roles.Operador:
    default:
      return '/dashboard'
  }
}
