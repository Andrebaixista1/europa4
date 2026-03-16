import { canAccessPage } from './pageAccess.js'

export function canAccessConsultaClientes(user) {
  return canAccessPage(user, 'consultas_clientes')
}

export function canAccessConsultaOnline(user) {
  return canAccessPage(user, 'consultas_online')
}
