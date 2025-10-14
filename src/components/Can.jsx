import { useAuth } from '../context/AuthContext.jsx'
import { can as canCheck } from '../utils/permissions.js'
import { normalizeRole, Roles } from '../utils/roles.js'

export default function Can({ permission, children }) {
  const { user } = useAuth()
  if (!user) return null
  const normalizedRole = normalizeRole(user.role, user.level)
  if (!canCheck(normalizedRole, permission)) return null
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    const normalizedPermissions = user.permissions
      .map((p) => (typeof p === 'string' ? p.trim().toLowerCase() : ''))
      .filter(Boolean)
    const wanted = String(permission || '').toLowerCase()
    const hasWanted = normalizedPermissions.includes(wanted)
      || (wanted === 'view:admin' && (normalizedPermissions.includes('view:admin') || normalizedPermissions.includes('view:master')))
    const roleOverridesAdmin = wanted === 'view:admin' && (normalizedRole === Roles.Master || normalizedRole === Roles.Administrador)
    if (normalizedPermissions.length > 0 && !hasWanted && !roleOverridesAdmin) {
      return null
    }
  }
  return children
}
