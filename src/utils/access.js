export function canAccessConsultasV8(user) {
  return Boolean(user)
}

export function canAccessConsultasHandMais(user) {
  return Boolean(user)
}

export function canAccessConsultaPresenca(user) {
  return Boolean(user)
}

function resolveUserId(user) {
  const rawId = user?.id_user ?? user?.idUser ?? user?.id ?? null
  const parsed = Number(rawId)
  return Number.isFinite(parsed) ? parsed : null
}

export function canAccessConsultaClientes(user) {
  return resolveUserId(user) === 1
}
