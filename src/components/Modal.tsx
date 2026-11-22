
import { useEffect, useState } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const [visible, setVisible] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setClosing(false)
    } else if (visible) {
      setVisible(false)
    }
  }, [open])

  useEffect(() => {
    if (!visible) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [visible, closing])

  function handleClose() {
    if (closing) return

    setClosing(true)

    window.setTimeout(() => {
      setVisible(false)
      setClosing(false)
      onClose()
    }, 220)
  }

  if (!visible) return null

  return (
    <div
      className={`member-overlay ${closing ? 'member-overlay--closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className="member-overlay__backdrop" />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-labelledby="member-modal-title"
        className="member-overlay__panel"
      >
        <header className="member-overlay__header">
          <div className="member-overlay__brand">
            <span className="member-overlay__brand-mark">F</span>
            <span>FITRELAY</span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close registration"
            className="member-overlay__close"
          >
            ✕
          </button>
        </header>

        <div className="member-overlay__body">
          <div className="member-overlay__side">
            <div className="member-overlay__asset">
              <img
                src="/images/member-registration.jpg"
                alt="Athlete training in a modern gym"
              />
              <div className="member-overlay__asset-overlay" />
            </div>

            <div className="member-overlay__side-content">
              <span className="member-overlay__eyebrow">
                MEMBERSHIP MANAGEMENT / 01
              </span>

              <h1>
                Build their
                <br />
                <span>fitness journey.</span>
              </h1>

              <p>
                Every great transformation starts with showing up.
                Add a new member and get their journey started today.
              </p>
            </div>

            <div className="member-overlay__side-footer">
              <span>FITRELAY MANAGEMENT SYSTEM</span>
              <span>01 — NEW MEMBER</span>
            </div>
          </div>

          <div className="member-overlay__form-panel">
            <div className="member-overlay__form-scroll">
              <div className="member-overlay__form-heading">
                <span className="member-overlay__eyebrow">GET STARTED</span>
                <h2 id="member-modal-title">Add new member</h2>
                <p>Enter their details to create a member profile.</p>
              </div>

              {children}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
