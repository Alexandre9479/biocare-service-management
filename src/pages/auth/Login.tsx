import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Stethoscope, Lock, Mail, Activity, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import supabase from '@/lib/supabase'

interface LoginForm {
  email: string
  password: string
}

export default function Login() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  // Already logged in — go to dashboard
  if (session) return <Navigate to="/dashboard" replace />

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setErrorMsg('')

    // Timeout after 20 seconds to prevent infinite spinner
    const timeout = new Promise<{ error: Error }>(resolve =>
      setTimeout(() => resolve({ error: new Error('Request timed out. Please check your internet connection and try again.') }), 20000)
    )

    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email: data.email, password: data.password }),
        timeout,
      ])

      const { error } = result as any

      if (error) {
        setErrorMsg(error.message ?? 'Invalid email or password.')
        setLoading(false)
        return
      }

      // Success — hard navigate so AuthContext re-initialises with fresh session
      window.location.replace('/dashboard')
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-900 via-biocare-purple-500/10 to-biocare-cyan-500/10 border-r border-slate-800">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-biocare-purple-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-biocare-cyan-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 flex flex-col items-center text-center px-12">
          {/* Real company logo */}
          <img
            src="/biocare-logo.png"
            alt="Biocare Health Systems"
            className="w-80 mb-8 drop-shadow-2xl"
          />
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Suppliers of Laboratory Diagnostics and Equipment, Hospital Equipment & Surgical Supplies across Kenya
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            {[
              { label: 'Equipment Tracking', color: 'text-emerald-400' },
              { label: 'Service Management', color: 'text-blue-400' },
              { label: 'Engineer Assignment', color: 'text-orange-400' },
              { label: 'Analytics & Reports', color: 'text-purple-400' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2">
                <Activity size={14} className={f.color} />
                <span className="text-xs text-slate-400">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/biocare-logo.png" alt="Biocare Health Systems" className="h-14 object-contain" />
          </div>

          <div className="card p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-50">Welcome back</h2>
              <p className="text-slate-500 text-sm mt-1">Sign in to the Service Management System</p>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" autoComplete="email" placeholder="you@biocare.co.ke"
                    className="input-field pl-9"
                    {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type={showPass ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                    className="input-field pl-9 pr-10"
                    {...register('password', { required: 'Password is required' })} />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={loading}
                className="btn-primary w-full justify-center py-3 text-sm">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-500">Contact your administrator to create or reset your account.</p>
            </div>
          </div>

          {/* Colour legend */}
          <div className="mt-4 card p-4">
            <p className="text-xs text-slate-500 mb-3 font-medium">Equipment Colour Codes</p>
            <div className="flex gap-5 flex-wrap">
              {[['bg-emerald-400', 'Cash Sale'], ['bg-orange-400', 'Placement'], ['bg-blue-400', 'Hire Purchase']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${c}`} />
                  <span className="text-xs text-slate-400">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
