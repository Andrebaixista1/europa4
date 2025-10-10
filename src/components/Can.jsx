import { useAuth } from '../context/AuthContext.jsx'
import { can as canCheck } from '../utils/permissions.js'
import { normalizeRole } from '../utils/roles.js'

export default function Can({ permission, children }) {
  const { user } = useAuth()
  if (!user) return null
  const normalizedRole = normalizeRole(user.role, user.level)
  if (!canCheck(normalizedRole, permission)) return null
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    const normalizedPermissions = user.permissions
      .map((p) => (typeof p === 'string' ? p.trim().toLowerCase() : ''))
      .filter(Boolean)
    if (normalizedPermissions.length > 0 && !normalizedPermissions.includes(permission.toLowerCase())) {
      return null
    }
  }
  return children
}
