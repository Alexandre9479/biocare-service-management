import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import supabase from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const ranOnce = useRef(false)

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      return (data as Profile) ?? null
    } catch {
      return null
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (s?.user) {
      const p = await loadProfile(s.user.id)
      setProfile(p)
    }
  }, [loadProfile])

  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true

    let alive = true

    // Safety net — never get stuck loading forever
    const bail = setTimeout(() => { if (alive) setLoading(false) }, 10000)

    const boot = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!alive) return

        if (!s?.user) {
          // No session — show login
          setSession(null)
          setProfile(null)
          return
        }

        const p = await loadProfile(s.user.id)
        if (!alive) return

        if (!p) {
          // Session exists but no profile — ghost session, clear it
          console.warn('No profile for session — signing out')
          await supabase.auth.signOut()
          setSession(null)
          setProfile(null)
          return
        }

        setSession(s)
        setProfile(p)
      } catch (e) {
        console.error('Auth boot error:', e)
        setSession(null)
        setProfile(null)
      } finally {
        if (alive) {
          clearTimeout(bail)
          setLoading(false)
        }
      }
    }

    boot()

    // Listen for SIGNED_OUT (logout button) — login is handled via hard page reload
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      alive = false
      clearTimeout(bail)
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    // Hard reload clears any cached state
    window.location.replace('/login')
  }, [])

  return (
    <AuthContext.Provider value={{ session, profile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-biocare-purple-500 border-t-transparent animate-spin" />
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { profile, session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
