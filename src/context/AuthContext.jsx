import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import users from '../data/users.json'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('ne_auth_user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch (_) {
        localStorage.removeItem('ne_auth_user')
      }
    }
  }, [])

  const login = async (email, password) => {
    const found = users.find(
      (u) => u.email.toLowerCase() === String(email).toLowerCase() && u.password === password
    )
    if (!found) throw new Error('Credenciais inválidas')
    const payload = { id: found.id, name: found.name, role: found.role, email: found.email }
    setUser(payload)
    localStorage.setItem('ne_auth_user', JSON.stringify(payload))
    return payload
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('ne_auth_user')
  }

  const value = useMemo(() => ({ user, login, logout, isAuthenticated: !!user }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


