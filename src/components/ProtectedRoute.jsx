import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'
import { normalizeRole } from '../utils/roles.js'

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (roles && roles.length > 0) {
    const allowed = roles.map(r => normalizeRole(r))
    const userRole = normalizeRole(user?.role)
    if (!user || !allowed.includes(userRole)) {
      notify.warn('Acesso não permitido para seu perfil')
      return <Navigate to="/" replace />
    }
  }
  return children
}

