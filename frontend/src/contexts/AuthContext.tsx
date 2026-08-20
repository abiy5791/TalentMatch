import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'
import { api } from '../lib/api'
import { Permission } from '../lib/permissions'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  /** True when the signed-in user's role grants every permission listed. */
  can: (...permissions: Permission[]) => boolean
  /** True when the role grants at least one of the listed permissions. */
  canAny: (...permissions: Permission[]) => boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (!storedToken || !storedUser) {
      setIsLoading(false)
      return
    }
    setToken(storedToken)
    try {
      setUser(JSON.parse(storedUser) as User)
    } catch {
      localStorage.removeItem('user')
    }
    // Re-read the profile so a permission change on the server takes effect on
    // reload rather than persisting in localStorage until the token expires.
    api
      .get<User>('/auth/me')
      .then(fresh => {
        setUser(fresh)
        localStorage.setItem('user', JSON.stringify(fresh))
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false))
  }, [])

  /** Returns the signed-in user so the caller can route to the right surface. */
  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ access_token: string; user: User }>('/auth/login', { email, password })
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  const { can, canAny } = useMemo(() => {
    const granted = new Set(user?.permissions || [])
    return {
      can: (...permissions: Permission[]) => permissions.every(p => granted.has(p)),
      canAny: (...permissions: Permission[]) => permissions.some(p => granted.has(p)),
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, token, can, canAny, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
