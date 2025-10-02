export const Roles = Object.freeze({
  Master: 'Master',
  Supervisor: 'Supervisor',
  Operador: 'Operador',
})

export function defaultRouteFor(role) {
  switch (role) {
    case Roles.Master:
    case Roles.Supervisor:
    case Roles.Operador:
    default:
      return '/dashboard'
  }
}
