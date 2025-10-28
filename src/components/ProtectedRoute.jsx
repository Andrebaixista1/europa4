import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'
import { normalizeRole, Roles } from '../utils/roles.js'

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export default function ProtectedRoute({ children, roles, teamIds, allowMaster = true }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const normalizedUserRole = normalizeRole(user?.role)

  if (Array.isArray(roles) && roles.length > 0) {
    const allowedRoles = roles.map((role) => normalizeRole(role))
    if (!allowedRoles.includes(normalizedUserRole)) {
      notify.warn('Acesso nao permitido para seu perfil')
      return <Navigate to="/" replace />
    }
  }

  if (Array.isArray(teamIds) && teamIds.length > 0) {
    const normalizedTeamIds = teamIds
      .map((teamId) => toNumberOrNull(teamId))
      .filter((teamId) => teamId !== null)

    if (normalizedTeamIds.length > 0) {
      const userTeamId = toNumberOrNull(user?.equipe_id)
      const isMaster = normalizedUserRole === Roles.Master
      const masterBypass = allowMaster !== false && isMaster
      const hasTeamAccess = userTeamId !== null && normalizedTeamIds.includes(userTeamId)

      if (!masterBypass && !hasTeamAccess) {
        notify.warn('Acesso nao permitido para sua equipe')
        return <Navigate to="/" replace />
      }
    }
  }

  return children
}
