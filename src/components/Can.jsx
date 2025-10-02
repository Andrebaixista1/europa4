import { useAuth } from '../context/AuthContext.jsx'
import { can as canCheck } from '../utils/permissions.js'

export default function Can({ permission, children }) {
  const { user } = useAuth()
  if (!user) return null
  if (!canCheck(user.role, permission)) return null
  return children
}

