const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export function canAccessConsultasV8(user) {
  const login = String(user?.login ?? '').trim().toLowerCase()
  const userId = toNumberOrNull(user?.id)
  return login === 'master' || userId === 1 || userId === 3347
}
