export const Roles = Object.freeze({
  Master: 'Master',
  Admin: 'Admin',
  Supervisor: 'Supervisor',
  Operador: 'Operador',
})

export function defaultRouteFor(role) {
  switch (role) {
    case Roles.Master:
    case Roles.Admin:
    case Roles.Supervisor:
    case Roles.Operador:
    default:
      return '/dashboard'
  }
}

