import { createContext, useContext, useEffect, useState } from 'react'
import { USE_MOCK } from '../services/ideaStore'
import { supabase } from '../services/supabaseClient'
import * as auth from '../services/auth'

const AuthContext = createContext(null)

// Demo mode: a fake signed-in user so every page keeps working without Supabase.
const MOCK_USER = { id: 'demo', email: null, name: 'friend', firstName: 'friend' }

const toUser = (session) => {
  if (!session?.user) return null
  const u = session.user
  const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'friend'
  return { id: u.id, email: u.email, name, firstName: name.split(' ')[0] }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(USE_MOCK ? MOCK_USER : null)
  const [loading, setLoading] = useState(!USE_MOCK)

  useEffect(() => {
    if (USE_MOCK || !supabase) { setLoading(false); return }
    auth.getSession().then((s) => setUser(toUser(s))).finally(() => setLoading(false))
    return auth.onAuthChange((s) => setUser(toUser(s)))
  }, [])

  const value = { user, loading, isMock: USE_MOCK, signIn: auth.signInWithGoogle, signOut: auth.signOut }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)