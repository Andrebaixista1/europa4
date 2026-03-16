import { canAccessPage } from './pageAccess.js'

export function canAccessConsultasV8(user) {
  return canAccessPage(user, 'consultas_v8')
}

export function canAccessConsultasPrata(user) {
  return canAccessPage(user, 'consultas_prata')
}

export function canAccessConsultasHandMais(user) {
  return canAccessPage(user, 'consultas_handmais')
}

export function canAccessConsultaPresenca(user) {
  return canAccessPage(user, 'consultas_presenca')
}

export function canAccessConsultaClientes(user) {
  return canAccessPage(user, 'consultas_clientes')
}

export function canAccessConsultaOnline(user) {
  return canAccessPage(user, 'consultas_online')
}
