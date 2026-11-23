import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { transitionNavigate } from '../lib/authTransition'
import { useToast } from '../context/ToastContext'

// Tiny base64 LQIP placeholder
const LQIP =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8AKf/Z'

export default function SignupPage() {
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
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return setError(error.message)
    }
    toast.success('Account created! Welcome to FitRelay.')
    navigate('/onboarding')
  }

  const emailInvalid = touched.email && !email.includes('@')
  const passwordInvalid = touched.password && password.length < 6

  return (
    // image RIGHT, form LEFT — flipped variant
    <div className="auth-split auth-split--flipped">
      {/* ── Right image panel (rendered first in DOM, visually placed right via direction:rtl) ── */}
      <div
        className="auth-split__image-panel"
        style={{ backgroundImage: `url('${LQIP}')` }}
        aria-hidden="true"
      >
        <img
          src="/images/split2.jpg"
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
              Join the<br />
              <span>relay.</span>
            </h2>
            <p className="auth-split__subtext">
              Set up your gym in minutes and start managing smarter today.
            </p>
          </div>
        </div>
      </div>

      {/* ── Left form panel ── */}
      <div className="auth-split__form-panel">
        <div className="auth-split__form-inner animate-fade-in">
          {/* Mobile-only logo */}
          <div className="auth-split__mobile-logo" aria-hidden="true">
            <div className="auth-split__brand-mark">F</div>
            <span className="auth-split__mobile-brand">FitRelay</span>
          </div>

          <div className="auth-split__form-header">
            <h1 className="auth-split__title">Create your account</h1>
            <p className="auth-split__subtitle">Get your gym on FitRelay today</p>
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
              <label htmlFor="signup-email" className="auth-label">Email address</label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                aria-invalid={emailInvalid}
                aria-describedby={emailInvalid ? 'signup-email-err' : undefined}
                className={`auth-input${emailInvalid ? ' auth-input--error' : ''}`}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {emailInvalid && (
                <span id="signup-email-err" className="auth-field-error" role="alert">
                  Please enter a valid email address.
                </span>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="signup-password" className="auth-label">Password</label>
              <input
                id="signup-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, password: true }))}
                aria-invalid={passwordInvalid}
                aria-describedby={passwordInvalid ? 'signup-password-err' : 'signup-password-hint'}
                className={`auth-input${passwordInvalid ? ' auth-input--error' : ''}`}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {passwordInvalid ? (
                <span id="signup-password-err" className="auth-field-error" role="alert">
                  Password must be at least 6 characters.
                </span>
              ) : (
                <span id="signup-password-hint" className="auth-field-hint">
                  At least 6 characters.
                </span>
              )}
            </div>

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => transitionNavigate(navigate, '/login')}
              className="auth-switch__link"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
