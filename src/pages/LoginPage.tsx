import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { transitionNavigate } from '../lib/authTransition'
import { useToast } from '../context/ToastContext'

// Tiny base64 LQIP placeholder (1×1 dark pixel — blur-up reveals the real image)
const LQIP =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8AKf/Z'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const navigate = useNavigate()
  const toast = useToast()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return setError(error.message)
    }
    toast.success('Signed in successfully')
    navigate('/app')
  }

  const emailInvalid = touched.email && !email.includes('@')
  const passwordInvalid = touched.password && password.length < 1

  return (
    // image LEFT, form RIGHT (default)
    <div className="auth-split">
      {/* ── Left image panel ── */}
      <div
        className="auth-split__image-panel"
        style={{ backgroundImage: `url('${LQIP}')` }}
        aria-hidden="true"
      >
        <img
          src="/images/split.jpg"
          alt=""
          loading="eager"
          fetchPriority="high"
          className="auth-split__image"
        />
        <div className="auth-split__image-overlay" />
        <div className="auth-split__image-content">
          <div className="auth-split__brand-mark">F</div>
          <div className="auth-split__tagline">
            <h2 className="auth-split__heading">
              Your gym,<br />
              <span>fully relayed.</span>
            </h2>
            <p className="auth-split__subtext">
              Memberships, payments, and renewals — all in one place.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-split__form-panel">
        <div className="auth-split__form-inner animate-fade-in">
          {/* Mobile-only logo */}
          <div className="auth-split__mobile-logo" aria-hidden="true">
            <div className="auth-split__brand-mark">F</div>
            <span className="auth-split__mobile-brand">FitRelay</span>
          </div>

          <div className="auth-split__form-header">
            <h1 className="auth-split__title">Welcome back</h1>
            <p className="auth-split__subtitle">Sign in to your FitRelay account</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field">
              <label htmlFor="login-email" className="auth-label">Email address</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                aria-invalid={emailInvalid}
                aria-describedby={emailInvalid ? 'login-email-err' : undefined}
                className={`auth-input${emailInvalid ? ' auth-input--error' : ''}`}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {emailInvalid && (
                <span id="login-email-err" className="auth-field-error" role="alert">
                  Please enter a valid email address.
                </span>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="login-password" className="auth-label">Password</label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, password: true }))}
                aria-invalid={passwordInvalid}
                aria-describedby={passwordInvalid ? 'login-password-err' : undefined}
                className={`auth-input${passwordInvalid ? ' auth-input--error' : ''}`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {passwordInvalid && (
                <span id="login-password-err" className="auth-field-error" role="alert">
                  Password is required.
                </span>
              )}
            </div>

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => transitionNavigate(navigate, '/signup')}
              className="auth-switch__link"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
